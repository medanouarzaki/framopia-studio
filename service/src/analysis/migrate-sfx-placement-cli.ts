import { readdirSync } from 'node:fs';
import path from 'node:path';
import { loadSfxIndex, loadTemplateManifest, REPO_ROOT, templatesById } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { deriveSfxEvents } from './sfx.js';
import { templateImpacts } from './template-impacts.js';

/**
 * Re-derives every plan's SFX under the measured placement rule and reports
 * what moved, in frames.
 *
 * **$0.00 and local.** `deriveSfxEvents` is the single generator and this
 * imports it rather than reimplementing it, so a migrated plan and one written
 * by the analysis stage carry identical events.
 *
 * Dry-run by default.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const FPS = 30000 / 1001;

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dirIndex = argv.indexOf('--footage');
const dir = dirIndex === -1 ? FOOTAGE_DIR : (argv[dirIndex + 1] as string);

const templates = templatesById(loadTemplateManifest());
const sfxIndex = loadSfxIndex();
const impacts = templateImpacts();

console.log(
  `impact frames: ${
    impacts.size === 0
      ? 'none derivable from the audit; nothing will move'
      : [...impacts].map(([id, s]) => `${id} ${(s * FPS).toFixed(2)}f`).join(', ')
  }`,
);
console.log('');

let moved = 0;
let total = 0;
let clamped = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(dir, file);
  const plan = await readEditPlan(planPath);

  const before = new Map(plan.sfx.events.map((e) => [e.sourceElementId + e.sfxId, e]));
  const after = deriveSfxEvents(plan, templates, sfxIndex, impacts);

  let reelMoved = 0;
  const lines: string[] = [];
  for (const event of after) {
    total += 1;
    const was = before.get(event.sourceElementId + event.sfxId);
    const deltaFrames = was === undefined ? null : (event.timeS - was.timeS) * FPS;
    if (deltaFrames !== null && Math.abs(deltaFrames) > 0.001) reelMoved += 1;
    if (event.clamped === true) clamped += 1;
    lines.push(
      `    ${event.id} ${event.sourceElementId.padEnd(6)} ${event.sfxId.padEnd(10)} ` +
        `${was === undefined ? '   new' : was.timeS.toFixed(3)} -> ${event.timeS.toFixed(3)}s` +
        `${deltaFrames === null ? '' : ` (${deltaFrames >= 0 ? '+' : ''}${deltaFrames.toFixed(2)}f)`}` +
        `${event.clamped === true ? `  CLAMPED, anchor late by ${(event.clampedByS ?? 0).toFixed(3)}s` : ''}` +
        `  gain ${event.gainDb.toFixed(2)}dB`,
    );
  }
  moved += reelMoved;

  console.log(`${reel.padEnd(14)} ${after.length} events, ${reelMoved} moved`);
  for (const line of lines) console.log(line);

  if (apply && after.length > 0) {
    plan.sfx = { events: after };
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    const reread = await readEditPlan(planPath);
    console.log(
      `    written and reopened: ${reread.sfx.events.length} events, ` +
        `keywords ${reread.keywords.items.length}, ` +
        `removedWordIds ${(reread.keywords.removedWordIds ?? []).length}`,
    );
  }
}

console.log('');
console.log(
  `${moved} of ${total} events moved; ${clamped} clamped at the composition start. ` +
    '$0.00 — this migration makes no model call.',
);
if (!apply) console.log('dry run — pass --apply to write');
