import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadTemplateManifest, templatesById } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { applyDisplayTiming } from './display-timing.js';

/**
 * Gives every existing plan the display timing the pipeline has always been
 * able to compute but never persisted.
 *
 * `applyDisplayTiming` is pure — it reads the group list, the manifest and the
 * reel duration, and calls nothing. **This migration cannot bill**, and it
 * imports the one function rather than reimplementing it, so a plan migrated
 * here and a plan written by the slot stage carry identical windows.
 *
 * Dry-run by default. The field is optional-with-default, so a plan written
 * before it existed opens fine and one written by this opens fine too.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dirIndex = argv.indexOf('--footage');
const dir = dirIndex === -1 ? FOOTAGE_DIR : (argv[dirIndex + 1] as string);

const templates = templatesById(loadTemplateManifest());

let totalGained = 0;
let totalAlready = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(dir, file);
  const plan = await readEditPlan(planPath);
  const groups = plan.subtitles.groups;
  if (groups.length === 0) {
    console.log(`${reel.padEnd(14)} no subtitle groups; skipped`);
    continue;
  }

  const before = groups.filter((g) => g.displayStart !== undefined).length;
  const timing = applyDisplayTiming({
    groups,
    templates,
    reelDurationS: plan.source.durationS,
  });
  const after = timing.groups.filter((g) => g.displayStart !== undefined).length;
  // A merge removes a card, so `after` can be lower than `before` without
  // anything having lost its window. Reporting the difference as a "gain"
  // printed "-1 would gain", which reads as a defect and is not one.
  const untimedBefore = groups.length - before;
  totalGained += untimedBefore;
  totalAlready += before;

  console.log(
    `${reel.padEnd(14)} ${groups.length} groups: ${before} already timed, ` +
      `${untimedBefore} untimed; after: ${after} timed of ${timing.groups.length} groups ` +
      `(merged ${timing.merged.length}, unbuildable ${timing.unbuildable.length})`,
  );
  for (const u of timing.unbuildable) {
    console.log(`    unbuildable ${u.groupId} "${u.wordIds.join(' ')}" ` +
      `${u.haveS.toFixed(3)}s of ${u.needS.toFixed(3)}s (${u.reason})`);
  }

  if (apply) {
    plan.subtitles.groups = timing.groups;
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    const reread = await readEditPlan(planPath);
    const confirmed = reread.subtitles.groups.filter((g) => g.displayStart !== undefined).length;
    console.log(`    written and reopened: ${confirmed}/${reread.subtitles.groups.length} timed`);
  }
}

console.log(
  `\n${totalAlready} already timed, ${totalGained} untimed. ` +
    '$0.00 — this migration makes no model call.',
);
if (!apply) console.log('dry run — pass --apply to write');
