import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer, type RunningService } from './server.js';

describe('server', () => {
  let running: RunningService;
  let base: string;

  beforeEach(async () => {
    running = await startServer();
    base = `http://127.0.0.1:${running.port}`;
  });

  afterEach(() => {
    running.server.close();
  });

  it('serves /health without a token', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; version: string };
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe('string');
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
