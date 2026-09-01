import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidecarError, runSidecar, setAbnormalExitReporter } from './sidecar.js';

/**
 * A sidecar that dies the way the real one does, in a scratch package, so the
 * real one is never touched.
 *
 * onnxruntime's bundled Microsoft telemetry aborts during static destruction —
 * the main thread is inside `exit()` while a worker thread throws a
 * `system_error` from a mutex that is already gone. 29 crash reports had
 * accumulated on the user's machine since 25 August and nothing in this project
 * had ever mentioned one, because `child.on('close', () => …)` took no
 * arguments and the exit status was never read.
 */
function scratchSidecar(body: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-sidecar-'));
  const pkg = path.join(dir, 'framopia_cv');
  mkdirSync(pkg);
  writeFileSync(path.join(pkg, '__init__.py'), '');
  writeFileSync(path.join(pkg, 'cli.py'), body);
  return dir;
}

const DIES_MID_WORK = 'import sys, os\nsys.stdin.read()\nsys.stderr.write("model blew up\\n")\nos.abort()\n';
const ANSWERS_THEN_DIES =
  'import sys, os, json\nsys.stdin.read()\n' +
  'print(json.dumps({"ok": True, "task": "remove_bg"}), flush=True)\nos.abort()\n';

afterEach(() => {
  setAbnormalExitReporter((message) => console.error(message));
  vi.unstubAllEnvs();
});

describe('the picture tools, when they die', () => {
  it('refuses when the process dies before answering, and names how it died', async () => {
    vi.stubEnv('FRAMOPIA_SIDECAR_DIR', scratchSidecar(DIES_MID_WORK));
    await expect(runSidecar({ task: 'remove_bg' })).rejects.toThrow(SidecarError);
    await runSidecar({ task: 'remove_bg' }).catch((error: SidecarError) => {
      expect(error.message).toContain('stopped during remove_bg');
      expect(error.message).toContain('SIGABRT');
      expect(error.message).toContain('wrote nothing');
      // stderr is carried, so the cause is not lost with the process.
      expect(error.stderr).toContain('model blew up');
    });
  }, 30_000);

  /*
   * A complete answer and an abnormal exit at once is the shape this project
   * actually has: the work is finished and the JSON flushed before the process
   * dies. Failing on the exit status alone would break the image stage, which
   * is why the answer decides and the death is reported rather than raised.
   */
  it('uses an answer that arrived before the death, and says the death happened', async () => {
    vi.stubEnv('FRAMOPIA_SIDECAR_DIR', scratchSidecar(ANSWERS_THEN_DIES));
    const said: string[] = [];
    setAbnormalExitReporter((message) => said.push(message));
    const result = await runSidecar<{ ok: boolean; task: string }>({ task: 'remove_bg' });
    expect(result.ok).toBe(true);
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('remove_bg finished and answered');
    expect(said[0]).toContain('SIGABRT');
  }, 30_000);
});
