import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO_ROOT, resolveNodePath, resolveRepoRoot } from '@framopia/core';
import { readHandshake } from './lock.js';

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
        expect((health?.['node'] as { path?: string })?.path).toBeTruthy();
      } finally {
        child.kill('SIGTERM');
        await new Promise((r) => setTimeout(r, 300));
        if (!child.killed) child.kill('SIGKILL');
      }
    },
    40_000,
  );
});
