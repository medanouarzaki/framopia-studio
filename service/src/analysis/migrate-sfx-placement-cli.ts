import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadSfxIndex, loadTemplateManifest, REPO_ROOT, templatesById } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { deriveSfxDetail } from './sfx.js';
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

/*
 * The reels' measured dialogue loudness, so sound levels can be set against the
 * voice. Written onto each plan as it is migrated, because the level rule needs
 * it wherever sfx are derived — not only here.
 */
/**
 * What this migration is allowed to touch. `meta` carries the timestamp,
 * `source` the measured loudness the levels are set from, `sfx` the events
 * themselves; anything else changing means the derivation reached somewhere it
 * has no business in.
 */
const WRITABLE_KEYS = new Set(['meta', 'source', 'sfx']);

function assertOnlyChanged(before: string, after: string, planPath: string): void {
  const a = JSON.parse(before) as Record<string, unknown>;
  const b = JSON.parse(after) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed = [...keys].filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
  const illegal = changed.filter((k) => !WRITABLE_KEYS.has(k));
  if (illegal.length > 0) {
    throw new Error(
      `${planPath}: this migration may only change ${[...WRITABLE_KEYS].join(', ')}, ` +
        `and it changed ${illegal.join(', ')}`,
    );
  }
}

const loudnessPath = path.join(REPO_ROOT, '.local', 'build', 'loudness.json');
const loudness = new Map<string, { integratedLufs: number; truePeakDbfs: number }>();
if (existsSync(loudnessPath)) {
  const measured = JSON.parse(readFileSync(loudnessPath, 'utf8')) as {
    reels: { reel: string; integratedLufs: number; truePeakDbfs: number }[];
  };
  for (const row of measured.reels) {
    loudness.set(row.reel, {
      integratedLufs: row.integratedLufs,
      truePeakDbfs: row.truePeakDbfs,
    });
  }
}
/** The plan basename differs from the reel label on three reels. */
const REEL_OF: Record<string, string> = {
  'ground truth': 'ground-truth',
  'test 1': 'test-1',
  'test 2': 'test-2',
  'test 3': 'test-3',
  vitasilk: 'vitasilk',
};

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
let unplaceableTotal = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(dir, file);
  const plan = await readEditPlan(planPath);
  // The file as it stands, so what the migration touched is asserted rather
  // than reasoned about. A placement migration that reached the transcript or
  // the keywords would be a defect nothing downstream would question.
  const planTextBefore = readFileSync(planPath, 'utf8');

  // The measurements go on before the events are derived, so the level rule
  // sees them on the very first pass rather than needing a second run.
  const measured = loudness.get(REEL_OF[reel] ?? reel);
  if (measured !== undefined) {
    plan.source.dialogueLufs = measured.integratedLufs;
    plan.source.dialoguePeakDbfs = measured.truePeakDbfs;
  }

  const before = new Map(plan.sfx.events.map((e) => [e.sourceElementId + e.sfxId, e]));
  const detail = deriveSfxDetail(
    plan,
    templates,
    sfxIndex,
    impacts,
    plan.source.dialogueLufs,
    plan.source.dialoguePeakDbfs,
  );
  const after = detail.events;

  let reelMoved = 0;
  const lines: string[] = detail.unplaceable.map(
    (u) =>
      `    NO SOUND ${u.elementId.padEnd(6)} ${u.sfxId.padEnd(10)} would have been ` +
      `${u.lateByS.toFixed(3)}s late; the element starts too near the reel`,
  );
  unplaceableTotal += detail.unplaceable.length;
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

  if (apply && (after.length > 0 || measured !== undefined)) {
    plan.sfx = { events: after };
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    assertOnlyChanged(planTextBefore, readFileSync(planPath, 'utf8'), planPath);
    const reread = await readEditPlan(planPath);
    console.log(
      `    written and reopened: ${reread.sfx.events.length} events, ` +
        `dialogue ${reread.source.dialogueLufs ?? 'unmeasured'} LUFS ` +
        `peak ${reread.source.dialoguePeakDbfs ?? '?'} dBFS, ` +
        `keywords ${reread.keywords.items.length}, ` +
        `removedWordIds ${(reread.keywords.removedWordIds ?? []).length}`,
    );
  }
}

console.log('');
console.log(
  `${moved} of ${total} events moved; ${clamped} clamped at the composition start; ` +
    `${unplaceableTotal} not placed for want of room before the element. ` +
    '$0.00 — this migration makes no model call.',
);
if (!apply) console.log('dry run — pass --apply to write');
