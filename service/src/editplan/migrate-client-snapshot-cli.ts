import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadMode, REPO_ROOT, snapshotOfMode, snapshotsAgree } from '@framopia/core';
import { assertOnlyChangedKeys } from './migrate-guard.js';

/**
 * Free, local, `$0.00` and no API call. Pins every existing plan to its
 * client's look as it stands now.
 *
 * **It does not read through `readEditPlan`, and that is the standing schema
 * rule rather than a shortcut.** `readEditPlan` validates on read, so a schema
 * addition that a plan predates would make the plan unopenable for the very
 * migration meant to add it. This reads and writes the JSON directly, changes
 * exactly one top-level key, and asserts that by comparing the file before and
 * after rather than by intending to.
 *
 * A plan with no `clientMode` is **left alone**: nothing on disk says which
 * client it belongs to, and pinning it to a guess would be worse than leaving
 * it to fall back to the live file with the fallback said out loud.
 *
 * A plan already pinned to the same look is left byte-identical, so the
 * migration is idempotent and re-running it is not a way to lose a pin.
 */
const dir = path.join(REPO_ROOT, 'my files', 'test videos');
const apply = process.argv.includes('--apply');

const WRITABLE_KEYS = new Set(['clientSnapshot']);

interface PlainPlan {
  clientMode?: { id?: string; version?: number } | null;
  clientSnapshot?: unknown;
}

let pinned = 0;
let already = 0;
let skipped = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const planPath = path.join(dir, file);
  const reel = file.replace('.editplan.json', '');
  const before = readFileSync(planPath, 'utf8');
  const plan = JSON.parse(before) as PlainPlan;

  const id = plan.clientMode?.id;
  if (typeof id !== 'string') {
    skipped += 1;
    console.log(`${reel.padEnd(14)} no client on the plan — left to fall back, and it says so`);
    continue;
  }

  const mode = loadMode(id);
  const existing = plan.clientSnapshot;
  const snapshot = snapshotOfMode(mode, new Date().toISOString());
  if (
    existing !== undefined &&
    existing !== null &&
    snapshotsAgree(existing as ReturnType<typeof snapshotOfMode>, snapshot)
  ) {
    already += 1;
    console.log(`${reel.padEnd(14)} already saved with ${mode.name} v${mode.version}`);
    continue;
  }

  pinned += 1;
  console.log(
    `${reel.padEnd(14)} ${existing === undefined || existing === null ? 'pinning to' : 'moving to'} ` +
      `${mode.name} v${mode.version}`,
  );

  if (!apply) continue;
  plan.clientSnapshot = snapshot;
  const after = `${JSON.stringify(plan, null, 2)}\n`;
  assertOnlyChangedKeys(before, after, WRITABLE_KEYS, planPath);
  writeFileSync(planPath, after, 'utf8');
}

console.log(
  `\n${pinned} ${apply ? 'pinned' : 'would be pinned'}, ${already} already current, ` +
    `${skipped} left without a client${apply ? '' : ' — dry run, pass --apply'}`,
);
