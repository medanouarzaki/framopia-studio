import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServiceAlreadyRunningError, startServer, type RunningService } from './server.js';
import { readHandshake, writeHandshake } from './lock.js';
import { REPO_ROOT, loadMode, modePathFor } from '@framopia/core';
import { createClient } from './clients/create.js';

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

  /*
   * The only writer of `clientMode` was the analysis stage, which bills, so a
   * video whose analysis had never run could not be given a client without
   * paying for one. A build refuses without a client and tells the user to
   * choose one in the panel; this is what makes that sentence true.
   */
  /*
   * A client's four colours could be chosen when the client was created and
   * never afterwards — Block 10 session 40 found there was no route, and 44
   * found the screen that chose them never sent them, so they had never reached
   * anything for anybody but K2 Syndicalia.
   */
  describe('POST /clients/palette', () => {
    const ID = 'server-palette-test-scratch';
    const THEIRS = {
      background: '#06131F',
      primary: '#12507A',
      accent: '#5FD0F0',
      light: '#F2FBFF',
    };

    afterEach(() => rmSync(modePathFor(ID), { force: true }));

    async function post(body: unknown): Promise<Response> {
      return await fetch(`${base}/clients/palette`, {
        method: 'POST',
        headers: { 'x-service-token': running.token, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    it('saves the four colours and hands the modes back', async () => {
      rmSync(modePathFor(ID), { force: true });
      createClient({ name: 'Server Palette Test Scratch' });
      const res = await post({ client: ID, palette: THEIRS });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { modes: { id: string }[] };
      expect(body.modes.some((m) => m.id === ID)).toBe(true);
      expect(loadMode(ID).palette).toEqual(THEIRS);
    });

    it('refuses a palette with a colour missing, and writes nothing', async () => {
      rmSync(modePathFor(ID), { force: true });
      createClient({ name: 'Server Palette Test Scratch' });
      const before = loadMode(ID).palette;
      const res = await post({ client: ID, palette: { light: '#FFFFFF' } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('all four colours');
      expect(loadMode(ID).palette).toEqual(before);
    });

    it('refuses a client that does not exist', async () => {
      const res = await post({ client: 'no-such-client-anywhere', palette: THEIRS });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('there is no client');
    });

    it('needs both a client and a palette', async () => {
      expect((await post({ palette: THEIRS })).status).toBe(400);
      expect((await post({ client: ID })).status).toBe(400);
    });

    it('rejects a request with no token', async () => {
      const res = await fetch(`${base}/clients/palette`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client: ID, palette: THEIRS }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /client', () => {
    /* A copy with the client stripped, so the route is exercised on the state
     * it exists for: a plan whose analysis has never run. */
    function scratchPlan(): string {
      const dir = mkdtempSync(path.join(tmpdir(), 'framopia-plan-'));
      tempDirs.push(dir);
      const copied = path.join(dir, 'scratch.editplan.json');
      const plan = JSON.parse(
        readFileSync(path.join(REPO_ROOT, 'my files', 'test videos', 'test 3.editplan.json'), 'utf8'),
      ) as Record<string, unknown>;
      plan['clientMode'] = null;
      delete plan['clientSnapshot'];
      writeFileSync(copied, JSON.stringify(plan));
      return copied;
    }

    async function post(body: unknown): Promise<Response> {
      return await fetch(`${base}/client`, {
        method: 'POST',
        headers: { 'x-service-token': running.token, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    it('attaches a client and pins its look in one write', async () => {
      const planPath = scratchPlan();
      const before = JSON.parse(readFileSync(planPath, 'utf8')) as Record<string, unknown>;
      expect(before['clientMode']).toBeNull();

      const res = await post({ planPath, modeId: 'k2-syndicalia' });
      expect(res.status).toBe(200);

      const after = JSON.parse(readFileSync(planPath, 'utf8')) as {
        clientMode: { id: string; version: number; path: string } | null;
        clientSnapshot: { id: string; version: number } | null;
      };
      expect(after.clientMode?.id).toBe('k2-syndicalia');
      expect(after.clientSnapshot?.id).toBe('k2-syndicalia');
      expect(after.clientMode?.version).toBe(after.clientSnapshot?.version);
    });

    /**
     * `watermark` joined the list at Block 10 session 44. Choosing a client for
     * a reel that has decided nothing about the mark is the moment that
     * client's own default applies — a client created with the mark off used to
     * be watermarked anyway, because nothing between the client file and the
     * build read the setting.
     */
    it('changes nothing but the client, the watermark and the timestamp', async () => {
      const planPath = scratchPlan();
      const before = JSON.parse(readFileSync(planPath, 'utf8')) as Record<string, unknown>;
      expect(before['watermark']).toBeNull();
      await post({ planPath, modeId: 'k2-syndicalia' });
      const after = JSON.parse(readFileSync(planPath, 'utf8')) as Record<string, unknown>;
      const moved = Object.keys(after).filter(
        (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]),
      );
      expect(moved.sort()).toEqual(['clientMode', 'clientSnapshot', 'meta', 'watermark']);
      // K2 names no preference, so the reel keeps the mark it has always had.
      expect((after['watermark'] as { enabled: boolean }).enabled).toBe(true);
    });

    /** A decision the reel already carries is never overwritten by a client. */
    it('leaves a reel’s own watermark choice alone', async () => {
      const planPath = scratchPlan();
      const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Record<string, unknown>;
      plan['watermark'] = { assetPath: '/a', startS: 0, durationS: null, enabled: false };
      writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8');
      await post({ planPath, modeId: 'k2-syndicalia' });
      const after = JSON.parse(readFileSync(planPath, 'utf8')) as Record<string, unknown>;
      expect((after['watermark'] as { enabled: boolean }).enabled).toBe(false);
    });

    it('refuses a client that does not exist, and writes nothing', async () => {
      const planPath = scratchPlan();
      const before = readFileSync(planPath, 'utf8');
      const res = await post({ planPath, modeId: 'no-such-client' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('there is no client "no-such-client"');
      expect(readFileSync(planPath, 'utf8')).toBe(before);
    });

    it('needs both a plan and a client', async () => {
      const res = await post({ planPath: scratchPlan() });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('"planPath" and "modeId" are required');
    });

    it('rejects a request with no token', async () => {
      const res = await fetch(`${base}/client`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planPath: 'x', modeId: 'k2-syndicalia' }),
      });
      expect(res.status).toBe(401);
    });
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
