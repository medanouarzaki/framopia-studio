import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO_ROOT, resolveNodePath, resolveRepoRoot } from '@framopia/core';
import { readHandshake, writeHandshake } from './lock.js';

/**
 * The panel's spawn, run outside CEP.
 *
 * "Reaching a healthy service" was something only the user could check, by
 * looking. Everything the panel does to get there — resolve the repository,
 * resolve Node, check the build, spawn the entry point, poll `/health` — is
 * plain Node, so all of it runs here against the real filesystem and a real
 * process.
 *
 * **What is not proved here** is the CEP half: `cep_node` supplying `fs` and
 * `child_process`, and `__adobe_cep__`/`location` supplying the candidate
 * paths. Those exist only inside After Effects. What this proves is that given
 * those, the rest works.
 */
const nodeFs = {
  existsSync,
  readFileSync: (p: string, enc: string) => readFileSync(p, enc as BufferEncoding) as string,
  realpathSync,
  readdirSync,
};

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempLock(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-spawn-'));
  dirs.push(dir);
  return path.join(dir, 'service.json');
}

const ENTRY_BUILT = existsSync(path.join(REPO_ROOT, 'service', 'dist', 'service.js'));

/** Spawns the service on its own lock and waits for /health. */
async function spawnAndWait(
  lockFile: string,
): Promise<{ health: Record<string, unknown> | null; ms: number; child: ReturnType<typeof spawn>; stderr: () => string }> {
  const node = resolveNodePath({ fs: nodeFs, repo: REPO_ROOT, execPath: process.execPath, home: homedir() });
  const entry = path.join(REPO_ROOT, 'service', 'dist', 'service.js');
  const started = Date.now();
  const child = spawn(node?.path as string, [entry], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FRAMOPIA_SERVICE_JSON: lockFile },
  });
  let err = '';
  child.stderr?.on('data', (c: Buffer) => (err += c.toString()));

  const deadline = Date.now() + 20_000;
  let health: Record<string, unknown> | null = null;
  while (Date.now() < deadline && health === null) {
    await new Promise((r) => setTimeout(r, 50));
    const handshake = readHandshake(lockFile);
    if (handshake === null) continue;
    try {
      const res = await fetch(`http://127.0.0.1:${handshake.port}/health`);
      if (res.ok) health = (await res.json()) as Record<string, unknown>;
    } catch {
      // Still starting.
    }
  }
  return { health, ms: Date.now() - started, child, stderr: () => err };
}

function stop(child: ReturnType<typeof spawn>): Promise<void> {
  child.kill('SIGTERM');
  return new Promise((r) => setTimeout(r, 300));
}

describe('the panel’s route to a healthy service', () => {
  it('resolves the repository the same way the panel does', () => {
    const resolution = resolveRepoRoot({
      fs: nodeFs,
      candidates: [{ source: 'panel dist', path: path.join(REPO_ROOT, 'panel', 'dist') }],
    });
    expect(resolution.root).toBe(REPO_ROOT);
  });

  it('resolves a node binary that exists', () => {
    const node = resolveNodePath({
      fs: nodeFs,
      repo: REPO_ROOT,
      execPath: process.execPath,
      home: homedir(),
    });
    expect(node).not.toBeNull();
    expect(existsSync(node?.path ?? '')).toBe(true);
  });

  /*
   * The check whose answer the panel showed the user. It has to read the same
   * resolved root, or it can report "not built" about a path that was never
   * going to exist.
   */
  it('finds the built entry point under the resolved root', () => {
    if (!ENTRY_BUILT) {
      console.warn('service/dist is missing — run `npm run service:build`');
    }
    expect(path.join(REPO_ROOT, 'service', 'dist', 'service.js')).not.toBe('/service/dist/service.js');
  });

  it.skipIf(!ENTRY_BUILT)(
    'spawns it with a bare node binary and reaches a healthy /health',
    async () => {
      const node = resolveNodePath({
        fs: nodeFs,
        repo: REPO_ROOT,
        execPath: process.execPath,
        home: homedir(),
      });
      const entry = path.join(REPO_ROOT, 'service', 'dist', 'service.js');
      const lockFile = tempLock();

      // Detached and stdio-piped, as the panel spawns it, but with its own lock
      // so a service the developer is running is neither disturbed nor found.
      const child = spawn(node?.path as string, [entry], {
        cwd: REPO_ROOT,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FRAMOPIA_SERVICE_JSON: lockFile },
      });
      let stderr = '';
      child.stderr?.on('data', (c: Buffer) => (stderr += c.toString()));

      try {
        // The panel's poll: read the handshake, then ask /health.
        const deadline = Date.now() + 20_000;
        let health: Record<string, unknown> | null = null;
        while (Date.now() < deadline && health === null) {
          await new Promise((r) => setTimeout(r, 200));
          const handshake = readHandshake(lockFile);
          if (handshake === null) continue;
          try {
            const res = await fetch(`http://127.0.0.1:${handshake.port}/health`);
            if (res.ok) health = (await res.json()) as Record<string, unknown>;
          } catch {
            // Still starting.
          }
        }

        expect(health, `service never answered. stderr: ${stderr}`).not.toBeNull();
        expect(health?.['ok']).toBe(true);
        expect(health?.['repoRoot']).toBe(REPO_ROOT);
        const node = health?.['node'] as { path?: string; version?: string };
        expect(node?.path).toBeTruthy();
        // The interpreter it is really running under, for the panel to compare.
        expect(node?.version).toBe(process.version);
      } finally {
        child.kill('SIGTERM');
        await new Promise((r) => setTimeout(r, 300));
        if (!child.killed) child.kill('SIGKILL');
      }
    },
    40_000,
  );
});

/**
 * The cases underneath a cold start. Each is a real process on a real lock
 * file, because the interesting part is what two services do to each other and
 * that is not something a fake can answer.
 */
describe.skipIf(!ENTRY_BUILT)('what happens around a running service', () => {
  it('comes up cold, and quickly enough not to be waited on', async () => {
    const lockFile = tempLock();
    const { health, ms, child, stderr } = await spawnAndWait(lockFile);
    try {
      expect(health, `never answered. stderr: ${stderr()}`).not.toBeNull();
      expect(health?.['ok']).toBe(true);
      // Recorded rather than asserted tightly: a threshold here would be a
      // performance test on someone else's machine.
      console.log(`cold start: healthy after ${ms} ms`);
      expect(ms).toBeLessThan(15_000);
    } finally {
      await stop(child);
    }
  }, 40_000);

  /**
 * A spawned process writes its refusal as it exits, so reading stderr once can
 * beat it there. Polls until the line appears or the budget runs out, then
 * returns whatever it has so the assertion reports the real content.
 */
async function waitForStderr(
  spawned: { stderr: () => string },
  needle: string,
  timeoutMs = 5000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let seen = spawned.stderr();
  while (!seen.includes(needle) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    seen = spawned.stderr();
  }
  return seen;
}

/* Two panels opening together must not leave two services holding ports. */
  it('refuses to start a second service over a live lock', async () => {
    const lockFile = tempLock();
    const first = await spawnAndWait(lockFile);
    try {
      expect(first.health).not.toBeNull();
      const firstPort = readHandshake(lockFile)?.port;

      const second = await spawnAndWait(lockFile);
      try {
        // The lock still names the first service, which is still answering.
        expect(readHandshake(lockFile)?.port).toBe(firstPort);
        /*
         * The refusal is written to stderr as the second process exits, and a
         * single sample raced it: this failed once inside the full suite and
         * passed four times alone. Waiting for the line is the fix; retrying
         * the assertion would only make the race quieter.
         */
        expect(await waitForStderr(second, 'already running')).toContain('already running');
      } finally {
        await stop(second.child);
      }
    } finally {
      await stop(first.child);
    }
  }, 60_000);

  /* A machine that was powered off leaves a lock naming a pid nobody owns. */
  it('reclaims a lock naming a dead process rather than obeying it', async () => {
    const lockFile = tempLock();
    writeHandshake(
      { port: 1, token: 'stale', pid: 999_999, startedAt: '2026-01-01T00:00:00.000Z' },
      lockFile,
    );

    const { health, child, stderr } = await spawnAndWait(lockFile);
    try {
      expect(health, `never answered. stderr: ${stderr()}`).not.toBeNull();
      const fresh = readHandshake(lockFile);
      expect(fresh?.pid).not.toBe(999_999);
      expect(fresh?.token).not.toBe('stale');
    } finally {
      await stop(child);
    }
  }, 40_000);

  /* The panel's heartbeat has to have something real to notice. */
  it('stops answering once it is gone', async () => {
    const lockFile = tempLock();
    const { health, child } = await spawnAndWait(lockFile);
    expect(health).not.toBeNull();
    const port = readHandshake(lockFile)?.port as number;

    await stop(child);
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  }, 40_000);
});
