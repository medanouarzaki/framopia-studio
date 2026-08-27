import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServiceAlreadyRunningError, startServer, type RunningService } from './server.js';
import { readHandshake, writeHandshake } from './lock.js';

/*
 * Every test drives its own lock file. Sharing `.local/service.json` would
 * make the suite refuse to start a second server the moment startServer began
 * honouring the lock, and would clobber a service the developer is running.
 */
const tempDirs: string[] = [];
function lockFileFor(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-server-'));
  tempDirs.push(dir);
  return path.join(dir, `${name}.json`);
}

afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('server', () => {
  let running: RunningService;
  let base: string;

  beforeEach(async () => {
    running = await startServer({ force: true, lockFile: lockFileFor('suite') });
    base = `http://127.0.0.1:${running.port}`;
  });

  afterEach(() => {
    running.server.close();
  });

  it('serves /health without a token', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; serviceVersion: string };
    expect(typeof body.ok).toBe('boolean');
    expect(typeof body.serviceVersion).toBe('string');
  });

  it('rejects requests without the service token', async () => {
    const res = await fetch(`${base}/jobs`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('runs a noop job end to end through the HTTP API', async () => {
    const createRes = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers: { 'x-service-token': running.token, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'noop' }),
    });
    expect(createRes.status).toBe(201);
    const { id } = (await createRes.json()) as { id: string };

    let status = '';
    for (let attempt = 0; attempt < 20 && status !== 'done'; attempt += 1) {
      const getRes = await fetch(`${base}/jobs/${id}`, {
        headers: { 'x-service-token': running.token },
      });
      const job = (await getRes.json()) as { status: string };
      status = job.status;
      if (status !== 'done') {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    expect(status).toBe('done');
  });

  it('returns a structured 400 for an unknown job type', async () => {
    const res = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers: { 'x-service-token': running.token, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'bogus' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/bogus/);
  });
});

describe('the health route and the token wall', () => {
  it('serves health without a token, because the panel reads it before it has one', async () => {
    const { server, port } = await startServer({ force: true, lockFile: lockFileFor('health') });
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        serviceVersion: expect.any(String),
        appVersion: expect.any(String),
        promptVersion: expect.any(Number),
      });
      expect(body['ffmpeg']).toMatchObject({ present: expect.any(Boolean), detail: expect.any(String) });
      expect(body['ffprobe']).toMatchObject({ present: expect.any(Boolean) });
      expect(body['sidecar']).toMatchObject({ pythonPath: expect.any(String) });
      expect(body['templates']).toMatchObject({ valid: expect.any(Boolean), issues: expect.any(Array) });
      expect(typeof body['ok']).toBe('boolean');
    } finally {
      server.close();
    }
  });

  it('rejects every other route without the token, with a structured error', async () => {
    const { server, port } = await startServer({ force: true, lockFile: lockFileFor('token') });
    try {
      const res = await fetch(`http://127.0.0.1:${port}/jobs`, { method: 'POST', body: '{}' });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: 'missing or wrong service token',
        stage: 'auth',
        cause: 'missing or wrong service token',
        retryable: false,
      });
    } finally {
      server.close();
    }
  });

  it('rejects a wrong token as firmly as a missing one', async () => {
    const { server, port } = await startServer({ force: true, lockFile: lockFileFor('wrong') });
    try {
      const res = await fetch(`http://127.0.0.1:${port}/jobs`, {
        method: 'POST',
        headers: { 'x-service-token': 'not-the-token' },
        body: '{}',
      });
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });
});

describe('the handshake the panel reads', () => {
  it('binds 127.0.0.1 and publishes port, token and pid', async () => {
    const lockFile = lockFileFor('handshake');
    const { server, port, token } = await startServer({ force: true, lockFile });
    try {
      const published = readHandshake(lockFile);
      expect(published).toMatchObject({ port, token, pid: process.pid });
      expect(server.address()).toMatchObject({ address: '127.0.0.1' });
      expect(port).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it('refuses to start over a lock naming a live process', async () => {
    const lockFile = lockFileFor('busy');
    writeHandshake(
      { port: 1, token: 'x', pid: process.pid, startedAt: new Date().toISOString() },
      lockFile,
    );
    await expect(startServer({ lockFile })).rejects.toThrow(ServiceAlreadyRunningError);
  });

  /*
   * The case the pid exists for: a service killed with the machine leaves its
   * file behind, and obeying it would strand every future panel.
   */
  it('starts over a lock naming a dead process', async () => {
    const lockFile = lockFileFor('stale');
    writeHandshake(
      { port: 1, token: 'stale', pid: 999999, startedAt: '2026-01-01T00:00:00.000Z' },
      lockFile,
    );
    const { server, token } = await startServer({ lockFile });
    try {
      expect(token).not.toBe('stale');
      expect(readHandshake(lockFile)?.pid).toBe(process.pid);
    } finally {
      server.close();
    }
  });
});
