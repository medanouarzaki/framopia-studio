import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BUILD_CLI, BuildJobError, runBuildJob, type BuildProgress } from './job.js';

/*
 * The spawn, for real, without After Effects.
 *
 * A plan whose schema version is unreadable fails in `readEditPlan`, which is
 * the line after the first stage marker and long before anything sends an Apple
 * event — so this exercises the whole of the job's own machinery (the child
 * process, the stage markers, the stderr capture, the failure sentence) and
 * touches nothing the user has open.
 */
describe.skipIf(!existsSync(BUILD_CLI))('the build job, spawned', () => {
  it('refuses a reel with no plan, by name and before spawning anything', async () => {
    await expect(
      runBuildJob({ reel: 'nowhere', planPath: '/does/not/exist.editplan.json' }),
    ).rejects.toThrow(/no Edit Plan at \/does\/not\/exist/);
  });

  it('reports the build’s own words when it fails, and the stage it reached', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-build-'));
    const planPath = path.join(dir, 'unreadable.editplan.json');
    writeFileSync(planPath, JSON.stringify({ schemaVersion: 999 }), 'utf8');

    const seen: BuildProgress[] = [];
    await expect(
      runBuildJob({ reel: 'unreadable', planPath, onProgress: (p) => seen.push(p) }),
    ).rejects.toThrow(BuildJobError);

    const last = seen[seen.length - 1];
    expect(last?.stages.map((s) => s.state)).toEqual(['running', 'waiting', 'waiting']);
    expect(last?.error).toMatch(/schema|version|999/i);
    expect(last?.savePath).toBeNull();
  }, 30_000);
});
