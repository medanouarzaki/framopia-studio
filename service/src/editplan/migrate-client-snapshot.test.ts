import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, loadMode, snapshotOfMode, snapshotsAgree } from '@framopia/core';
import { assertOnlyChangedKeys } from './migrate-guard.js';
import { readEditPlan } from './io.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');

describe('the client-snapshot migration', () => {
  /*
   * The migration's whole claim: a plan it pinned is the plan a fresh run would
   * have written. If the two could differ, a migrated corpus would build
   * differently from a newly-analysed reel and nothing would say why.
   */
  /*
   * The pin was taken at K2 Syndicalia v10 and the client is at v11 since
   * Block 9 session 12, which replaced two image-prompt fragments. Nothing a
   * build reads moved, so the two snapshots still agree on every field that
   * decides a reel — they differ only in the client's own version, which is
   * provenance. `snapshotsAgree` counts that version, which is what makes the
   * build preview report this reel as behind.
   */
  it('leaves a plan identical to one pinned fresh, but for the client’s version', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const migrated = plan.clientSnapshot;
    expect(migrated).toBeDefined();
    const pinned = migrated as NonNullable<typeof migrated>;

    const fresh = snapshotOfMode(loadMode('k2-syndicalia'), 'a different instant');

    expect(pinned.version).toBe(10);
    expect(fresh.version).toBe(11);
    expect(snapshotsAgree(pinned, fresh)).toBe(false);

    // Everything that decides the build is unchanged.
    expect(snapshotsAgree({ ...pinned, version: 0 }, { ...fresh, version: 0 })).toBe(true);
  });

  it('pinned every plan that names a client, and left the ones that do not', async () => {
    const seen: Record<string, string | null> = {};
    for (const reel of ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk']) {
      const plan = await readEditPlan(path.join(FOOTAGE, `${reel}.editplan.json`));
      seen[reel] = plan.clientSnapshot?.id ?? null;
      // A plan with no client is left to fall back, never pinned to a guess.
      if (plan.clientMode === null) expect(plan.clientSnapshot ?? null).toBeNull();
      else expect(plan.clientSnapshot?.id).toBe(plan.clientMode.id);
    }
    expect(seen).toEqual({
      'ground truth': null,
      'test 1': 'k2-syndicalia',
      'test 2': 'k2-syndicalia',
      'test 3': null,
      vitasilk: 'k2-syndicalia',
    });
  });

  it('refuses to write if anything but the copy moved', () => {
    const before = JSON.stringify({ meta: { id: 'a' }, clientSnapshot: null });
    const legal = JSON.stringify({ meta: { id: 'a' }, clientSnapshot: { id: 'k2' } });
    const illegal = JSON.stringify({ meta: { id: 'b' }, clientSnapshot: { id: 'k2' } });

    const allowed = new Set(['clientSnapshot']);
    expect(() => assertOnlyChangedKeys(before, legal, allowed, '/p.json')).not.toThrow();
    expect(() => assertOnlyChangedKeys(before, illegal, allowed, '/p.json')).toThrow(
      /may only change/,
    );
  });

  /*
   * A schema addition has to be optional with a default or ship a migration
   * that does not read through the new validator — this one does both, and the
   * plans that predate it still open.
   */
  it('leaves every plan openable, pinned or not', async () => {
    for (const reel of ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk']) {
      const raw = readFileSync(path.join(FOOTAGE, `${reel}.editplan.json`), 'utf8');
      expect(JSON.parse(raw)).toBeTruthy();
      await expect(readEditPlan(path.join(FOOTAGE, `${reel}.editplan.json`))).resolves.toBeTruthy();
    }
  });
});
