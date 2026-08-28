import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJob, getJob, UnknownJobTypeError } from './jobs.js';
import { readEditPlan, writeEditPlan } from './editplan/io.js';
import { clearManualZone, ManualZoneError, setManualZone } from './frames/plan-zones.js';
import type { Zone } from './editplan/types.js';
import { listModes, listReels } from './catalogue.js';
import { dryRun, DryRunError } from './dry-run.js';
import { stepsFor, StepsError } from './steps.js';
import {
  editCard,
  editWord,
  transcriptView,
  TranscriptViewError,
} from './transcript-view.js';
import {
  addKeyword,
  keywordsView,
  KeywordViewError,
  removeKeyword,
} from './keyword-view.js';
// Imported for its side effect: registering the pipeline job runner.
import './pipeline.js';
import { health } from './health.js';
import { clearHandshake, inspectLock, SERVICE_JSON_PATH, writeHandshake } from './lock.js';

const packageJsonPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json',
);
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

/**
 * ARCHITECTURE §8: every failure carries stage, cause and whether retrying
 * could help, and the panel shows it verbatim rather than paraphrasing. The
 * legacy `error` string stays alongside it so nothing that reads the old shape
 * breaks while the panel is being built.
 */
export interface ServiceError {
  error: string;
  stage: string;
  cause: string;
  retryable: boolean;
}

export function serviceError(stage: string, cause: string, retryable: boolean): ServiceError {
  return { error: cause, stage, cause, retryable };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Read a plan, apply one edit, write it back. A plan that will not open is a
 * 404 rather than a 500: the caller supplied the path.
 */
async function withPlan(
  res: ServerResponse,
  planPath: string,
  edit: (plan: import('./editplan/types.js').EditPlan) => void,
): Promise<void> {
  let plan;
  try {
    plan = await readEditPlan(planPath);
  } catch (err) {
    sendJson(res, 404, { error: `could not read ${planPath}: ${(err as Error).message}` });
    return;
  }
  try {
    edit(plan);
  } catch (err) {
    if (err instanceof ManualZoneError) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    throw err;
  }
  plan.meta.updatedAt = new Date().toISOString();
  await writeEditPlan(planPath, plan);
  sendJson(res, 200, { zones: plan.zones });
}

export function createApp(token: string): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      /*
       * Health is the one route outside the token wall. The panel calls it
       * before it has read the handshake file — that is how it finds out
       * whether the service it is about to talk to is the one whose token it
       * holds — and it discloses nothing an attacker on this machine could not
       * read from .local/service.json anyway. Everything else is behind the
       * token.
       */
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, health(version));
        return;
      }

      if (req.headers['x-service-token'] !== token) {
        sendJson(res, 401, serviceError('auth', 'missing or wrong service token', false));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/reels') {
        sendJson(res, 200, { reels: listReels() });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/modes') {
        sendJson(res, 200, { modes: listModes() });
        return;
      }

      /*
       * What a run would do, before anything is paid for. It runs nothing:
       * every figure is read off the plan and the pricing constants.
       */
      if (req.method === 'GET' && url.pathname === '/dry-run') {
        const reel = url.searchParams.get('reel');
        const mode = url.searchParams.get('mode');
        if (reel === null || mode === null) {
          sendJson(res, 400, serviceError('dry-run', 'reel and mode are both required', false));
          return;
        }
        try {
          sendJson(res, 200, await dryRun(reel, mode));
        } catch (error) {
          if (!(error instanceof DryRunError)) throw error;
          sendJson(res, 400, serviceError('dry-run', error.message, false));
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/steps') {
        const reel = url.searchParams.get('reel');
        const mode = url.searchParams.get('mode');
        if (reel === null || mode === null) {
          sendJson(res, 400, serviceError('steps', 'reel and mode are both required', false));
          return;
        }
        try {
          sendJson(res, 200, stepsFor(reel, mode));
        } catch (error) {
          if (!(error instanceof StepsError)) throw error;
          sendJson(res, 400, serviceError('steps', error.message, false));
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/transcript') {
        const reel = url.searchParams.get('reel');
        if (reel === null) {
          sendJson(res, 400, serviceError('transcript', 'reel is required', false));
          return;
        }
        try {
          sendJson(res, 200, await transcriptView(reel));
        } catch (error) {
          if (!(error instanceof TranscriptViewError)) throw error;
          sendJson(res, 400, serviceError('transcript', error.message, false));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/transcript/word') {
        let body: {
          planPath?: unknown;
          wordId?: unknown;
          text?: unknown;
          restore?: unknown;
          script?: unknown;
        };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, serviceError('transcript', 'invalid JSON body', false));
          return;
        }
        if (typeof body.planPath !== 'string' || typeof body.wordId !== 'string') {
          sendJson(res, 400, serviceError('transcript', 'planPath and wordId are required', false));
          return;
        }
        try {
          sendJson(
            res,
            200,
            await editWord({
              planPath: body.planPath,
              wordId: body.wordId,
              ...(typeof body.text === 'string' ? { text: body.text } : {}),
              ...(body.restore === true ? { restore: true } : {}),
              ...(body.script === 'latin' || body.script === 'arabic'
                ? { script: body.script }
                : {}),
            }),
          );
        } catch (error) {
          if (!(error instanceof TranscriptViewError)) throw error;
          sendJson(res, 400, serviceError('transcript', error.message, false));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/transcript/card') {
        let body: { planPath?: unknown; cardId?: unknown; displayStart?: unknown; displayEnd?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, serviceError('transcript', 'invalid JSON body', false));
          return;
        }
        if (
          typeof body.planPath !== 'string' ||
          typeof body.cardId !== 'string' ||
          typeof body.displayStart !== 'number' ||
          typeof body.displayEnd !== 'number'
        ) {
          sendJson(
            res,
            400,
            serviceError('transcript', 'planPath, cardId, displayStart and displayEnd are required', false),
          );
          return;
        }
        try {
          sendJson(
            res,
            200,
            await editCard({
              planPath: body.planPath,
              cardId: body.cardId,
              displayStart: body.displayStart,
              displayEnd: body.displayEnd,
            }),
          );
        } catch (error) {
          if (!(error instanceof TranscriptViewError)) throw error;
          sendJson(res, 400, serviceError('transcript', error.message, false));
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/keywords') {
        const reel = url.searchParams.get('reel');
        if (reel === null) {
          sendJson(res, 400, serviceError('keywords', 'reel is required', false));
          return;
        }
        try {
          sendJson(res, 200, await keywordsView(reel));
        } catch (error) {
          if (!(error instanceof KeywordViewError)) throw error;
          sendJson(res, 400, serviceError('keywords', error.message, false));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/keywords/add') {
        let body: { planPath?: unknown; wordId?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, serviceError('keywords', 'invalid JSON body', false));
          return;
        }
        if (typeof body.planPath !== 'string' || typeof body.wordId !== 'string') {
          sendJson(res, 400, serviceError('keywords', 'planPath and wordId are required', false));
          return;
        }
        try {
          sendJson(res, 200, await addKeyword({ planPath: body.planPath, wordId: body.wordId }));
        } catch (error) {
          if (!(error instanceof KeywordViewError)) throw error;
          sendJson(res, 400, serviceError('keywords', error.message, false));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/keywords/remove') {
        let body: { planPath?: unknown; keywordId?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, serviceError('keywords', 'invalid JSON body', false));
          return;
        }
        if (typeof body.planPath !== 'string' || typeof body.keywordId !== 'string') {
          sendJson(res, 400, serviceError('keywords', 'planPath and keywordId are required', false));
          return;
        }
        try {
          sendJson(
            res,
            200,
            await removeKeyword({ planPath: body.planPath, keywordId: body.keywordId }),
          );
        } catch (error) {
          if (!(error instanceof KeywordViewError)) throw error;
          sendJson(res, 400, serviceError('keywords', error.message, false));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/jobs') {
        let body: { type?: unknown; params?: Record<string, unknown> };
        try {
          body = JSON.parse((await readBody(req)) || '{}');
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }

        if (typeof body.type !== 'string') {
          sendJson(res, 400, { error: '"type" is required' });
          return;
        }

        try {
          const job = createJob(body.type, body.params);
          sendJson(res, 201, { id: job.id });
        } catch (err) {
          if (err instanceof UnknownJobTypeError) {
            sendJson(res, 400, { error: err.message });
            return;
          }
          throw err;
        }
        return;
      }

      // Manual zones, ARCHITECTURE §5.5: the panel's zone editor writes rects
      // the solver treats as ground truth. Both routes rewrite only the zones
      // block and meta.updatedAt.
      if (req.method === 'POST' && url.pathname === '/zones/manual') {
        let body: { planPath?: unknown; zone?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        if (typeof body.planPath !== 'string') {
          sendJson(res, 400, { error: '"planPath" is required' });
          return;
        }
        if (typeof body.zone !== 'object' || body.zone === null) {
          sendJson(res, 400, { error: '"zone" is required' });
          return;
        }
        await withPlan(res, body.planPath, (plan) => {
          plan.zones = setManualZone(plan.zones, body.zone as Zone);
        });
        return;
      }

      const clearMatch = req.method === 'DELETE' && url.pathname === '/zones/manual';
      if (clearMatch) {
        const planPath = url.searchParams.get('planPath');
        const zoneId = url.searchParams.get('zoneId');
        if (!planPath || !zoneId) {
          sendJson(res, 400, { error: '"planPath" and "zoneId" are required' });
          return;
        }
        await withPlan(res, planPath, (plan) => {
          plan.zones = clearManualZone(plan.zones, zoneId);
        });
        return;
      }

      const jobMatch = /^\/jobs\/([^/]+)$/.exec(url.pathname);
      if (req.method === 'GET' && jobMatch) {
        const job = getJob(jobMatch[1] as string);
        if (!job) {
          sendJson(res, 404, { error: 'job not found' });
          return;
        }
        sendJson(res, 200, job);
        return;
      }

      sendJson(res, 404, { error: 'not found' });
    })();
  });
}

export interface RunningService {
  server: http.Server;
  port: number;
  token: string;
}

export class ServiceAlreadyRunningError extends Error {
  constructor(readonly pid: number, readonly port: number) {
    super(`a service is already running as pid ${pid} on port ${port}`);
  }
}

/**
 * Binds 127.0.0.1 on a free port and publishes the handshake.
 *
 * `force` exists for tests and for a deliberate restart; by default a live
 * lock is refused rather than overwritten, because two services would each
 * write the file and the panel would talk to whichever wrote last while the
 * other went on holding a port.
 */
export function startServer(
  options: { force?: boolean; lockFile?: string } = {},
): Promise<RunningService> {
  const lockFile = options.lockFile ?? SERVICE_JSON_PATH;
  const lock = inspectLock(lockFile);
  if (lock.state === 'held' && options.force !== true) {
    return Promise.reject(
      new ServiceAlreadyRunningError(lock.handshake.pid, lock.handshake.port),
    );
  }

  const token = crypto.randomBytes(24).toString('hex');
  const server = createApp(token);

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('failed to bind server to a port');
      }
      const port = address.port;

      writeHandshake(
        { port, token, pid: process.pid, startedAt: new Date().toISOString() },
        lockFile,
      );

      resolve({ server, port, token });
    });
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const lock = inspectLock();
  if (lock.state === 'free' && lock.reason === 'lock names a dead process') {
    console.log('reclaiming a stale lock: the pid it names is not running');
  }

  startServer({ force: process.argv.includes('--force') })
    .then(({ port }) => {
      console.log(`framopia-service listening on 127.0.0.1:${port}`);
      // The handshake describes a live process; leaving it behind on a clean
      // exit would make the next start reclaim a lock rather than find none.
      const stop = (): void => {
        clearHandshake();
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    })
    .catch((err: unknown) => {
      if (err instanceof ServiceAlreadyRunningError) {
        console.error(`${err.message}; pass --force to take it over`);
        process.exit(1);
      }
      console.error(err);
      process.exit(1);
    });
}
