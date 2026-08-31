import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, loadMode, modePathFor, snapshotOfMode } from '@framopia/core';
import { createJob, getJob, UnknownJobTypeError } from './jobs.js';
import { readEditPlan, writeEditPlan } from './editplan/io.js';
import { clearManualZone, ManualZoneError, setManualZone } from './frames/plan-zones.js';
import { chooseCandidate, imagesView, ImageViewError } from './image-view.js';

/** The one intro overlay this agency has; Block 7 session 1 measured it. */
const WATERMARK_ASSET = path.join(REPO_ROOT, 'assets', 'watermark', 'intro.mov');
import { WATERMARK_SIZES, type WatermarkSize, type Zone } from './editplan/types.js';
import { DEFAULT_WATERMARK_SIZE } from './placement/constants.js';
import { describeVideo, listModes, listVideosFor } from './catalogue.js';
import { fontListView } from './fonts.js';
import { subtitlePreview } from './subtitle-preview.js';
import { dryRun, DryRunError } from './dry-run.js';
import { addPicture, createClient, removePicture, type NewClient } from './clients/create.js';
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
// Imported for their side effect: registering the pipeline and build job runners.
import './pipeline.js';
import './build/job.js';
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
/**
 * An edit the caller asked for that this plan cannot take — a 400, not a 500.
 * `ManualZoneError` was the only such case and was matched by its own class;
 * this is the general one, so the next edit does not need a third branch.
 */
export class PlanEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanEditError';
  }
}

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
    if (err instanceof ManualZoneError || err instanceof PlanEditError) {
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

      /*
       * The videos to choose from. With a client, their own folder; without
       * one, the hand-kept list, which is why nothing that worked today stops.
       * Re-reading the folder is what Refresh does: nothing watches the disk.
       */
      if (req.method === 'GET' && url.pathname === '/reels') {
        sendJson(res, 200, listVideosFor(url.searchParams.get('client')));
        return;
      }

      /* One video from anywhere, for footage outside a client's folder. */
      if (req.method === 'GET' && url.pathname === '/video') {
        const file = url.searchParams.get('path');
        if (file === null || file === '') {
          sendJson(res, 400, { error: 'name the file to open' });
          return;
        }
        try {
          sendJson(res, 200, { reel: describeVideo(file) });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/clients') {
        let body: Record<string, unknown>;
        try {
          body = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>;
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        try {
          const created = createClient(body as unknown as NewClient);
          sendJson(res, 200, { ...created, modes: listModes() });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/clients/pictures') {
        let body: { client?: unknown; path?: unknown; description?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        if (typeof body.client !== 'string' || typeof body.path !== 'string') {
          sendJson(res, 400, { error: 'name the client and the picture' });
          return;
        }
        try {
          const picture = addPicture(body.client, {
            path: body.path,
            description: typeof body.description === 'string' ? body.description : '',
          });
          sendJson(res, 200, { picture });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
        return;
      }

      if (req.method === 'DELETE' && url.pathname === '/clients/pictures') {
        const client = url.searchParams.get('client');
        const picture = url.searchParams.get('picture');
        if (client === null || picture === null) {
          sendJson(res, 400, { error: 'name the client and the picture' });
          return;
        }
        try {
          removePicture(client, picture);
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/modes') {
        sendJson(res, 200, { modes: listModes() });
        return;
      }

      /*
       * The faces this After Effects can set, for the client setup screen.
       * Read-only and free; it drives the running instance and writes nothing.
       */
      if (req.method === 'GET' && url.pathname === '/fonts') {
        sendJson(res, 200, fontListView());
        return;
      }

      /*
       * A real frame to place the subtitle line against, so the height is
       * chosen by looking rather than by imagining what a pixel figure means.
       */
      if (req.method === 'GET' && url.pathname === '/subtitle-preview') {
        sendJson(res, 200, subtitlePreview());
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

      // Step 4, the image candidate picker.
      if (req.method === 'GET' && url.pathname === '/images') {
        const reel = url.searchParams.get('reel');
        if (reel === null) {
          sendJson(res, 400, { error: '"reel" is required' });
          return;
        }
        try {
          sendJson(res, 200, await imagesView(reel));
        } catch (error) {
          sendJson(res, error instanceof ImageViewError ? 404 : 500, {
            error: (error as Error).message,
          });
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/images/choose') {
        let body: {
          planPath?: unknown;
          slotId?: unknown;
          candidateId?: unknown;
          clientPictureId?: unknown;
        };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        if (typeof body.planPath !== 'string' || typeof body.slotId !== 'string') {
          sendJson(res, 400, { error: '"planPath" and "slotId" are required' });
          return;
        }
        const picture = body.clientPictureId;
        const choosingPicture = picture !== undefined;
        if (choosingPicture && picture !== null && typeof picture !== 'string') {
          sendJson(res, 400, { error: '"clientPictureId" must be a string or null' });
          return;
        }
        if (!choosingPicture && body.candidateId !== null && typeof body.candidateId !== 'string') {
          sendJson(res, 400, { error: '"candidateId" must be a string or null' });
          return;
        }
        try {
          sendJson(
            res,
            200,
            await chooseCandidate({
              planPath: body.planPath,
              slotId: body.slotId,
              candidateId: choosingPicture ? null : (body.candidateId as string | null),
              ...(choosingPicture ? { clientPictureId: picture as string | null } : {}),
            }),
          );
        } catch (error) {
          sendJson(res, error instanceof ImageViewError ? 400 : 500, {
            error: (error as Error).message,
          });
        }
        return;
      }

      /*
       * Some reels are delivered marked and some are not. The builder decided
       * it from whether the asset was on disk, which is the same answer for
       * every reel; the plan decides it now and this is what writes it.
       */
      if (req.method === 'POST' && url.pathname === '/watermark') {
        let body: { planPath?: unknown; enabled?: unknown; size?: unknown };
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
        if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
          sendJson(res, 400, { error: '"enabled" must be true or false' });
          return;
        }
        if (
          body.size !== undefined &&
          !(WATERMARK_SIZES as readonly string[]).includes(body.size as string)
        ) {
          sendJson(res, 400, { error: `"size" must be one of ${WATERMARK_SIZES.join(', ')}` });
          return;
        }
        if (body.enabled === undefined && body.size === undefined) {
          sendJson(res, 400, { error: 'send "enabled", "size", or both' });
          return;
        }
        // Either half may be sent alone, so setting the size does not silently
        // turn a mark back on and switching it off does not forget the size.
        const { enabled, size } = body as { enabled?: boolean; size?: WatermarkSize };
        await withPlan(res, body.planPath, (plan) => {
          const current = plan.watermark;
          plan.watermark = {
            assetPath: current?.assetPath ?? WATERMARK_ASSET,
            startS: current?.startS ?? 0,
            durationS: current?.durationS ?? null,
            enabled: enabled ?? current?.enabled ?? true,
            size: size ?? current?.size ?? DEFAULT_WATERMARK_SIZE,
          };
        });
        return;
      }

      /*
       * Moves a reel to the client's look as it stands now.
       *
       * Deliberately a control someone presses, never something a run does on
       * its own: a reel is built against the copy saved with it precisely so a
       * mode file edited later cannot change what was approved, and re-pinning
       * automatically would give that back.
       */
      if (req.method === 'POST' && url.pathname === '/client-snapshot') {
        let body: { planPath?: unknown };
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
        await withPlan(res, body.planPath, (plan) => {
          const id = plan.clientMode?.id;
          if (id === undefined) {
            throw new PlanEditError(
              'this video has no client yet, so there is nothing to bring it up to date with',
            );
          }
          plan.clientSnapshot = snapshotOfMode(loadMode(id), new Date().toISOString());
        });
        return;
      }

      /*
       * Attach a client to a video.
       *
       * Until now the only thing that wrote `clientMode` was the analysis
       * stage, which bills — so a video whose analysis had never run could not
       * be given a client at all without paying, and two of the five corpus
       * reels sat with none for a whole block. A build refuses in that state,
       * and its message tells the user to choose the client here, so this is
       * what makes that sentence true.
       *
       * The snapshot is taken at the same moment, because a reel is built
       * against a copy of the client's look rather than a pointer to it.
       */
      if (req.method === 'POST' && url.pathname === '/client') {
        let body: { planPath?: unknown; modeId?: unknown };
        try {
          body = JSON.parse((await readBody(req)) || '{}') as typeof body;
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        if (typeof body.planPath !== 'string' || typeof body.modeId !== 'string') {
          sendJson(res, 400, { error: '"planPath" and "modeId" are required' });
          return;
        }
        const modeId = body.modeId;
        await withPlan(res, body.planPath, (plan) => {
          let mode;
          try {
            mode = loadMode(modeId);
          } catch (err) {
            throw new PlanEditError(`there is no client "${modeId}": ${(err as Error).message}`);
          }
          plan.clientMode = { id: mode.id, version: mode.version, path: modePathFor(mode.id) };
          plan.clientSnapshot = snapshotOfMode(mode, new Date().toISOString());
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
