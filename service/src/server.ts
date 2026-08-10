import crypto from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJob, getJob, UnknownJobTypeError } from './jobs.js';
import { LOCAL_DIR } from './paths.js';

const SERVICE_JSON_PATH = path.join(LOCAL_DIR, 'service.json');

const packageJsonPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json',
);
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

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

export function createApp(token: string): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true, version });
        return;
      }

      if (req.headers['x-service-token'] !== token) {
        sendJson(res, 401, { error: 'unauthorized' });
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

export function startServer(): Promise<RunningService> {
  const token = crypto.randomBytes(24).toString('hex');
  const server = createApp(token);

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('failed to bind server to a port');
      }
      const port = address.port;

      mkdirSync(LOCAL_DIR, { recursive: true });
      writeFileSync(SERVICE_JSON_PATH, JSON.stringify({ port, token }, null, 2), 'utf8');

      resolve({ server, port, token });
    });
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  startServer()
    .then(({ port }) => {
      console.log(`framopia-service listening on 127.0.0.1:${port}`);
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
