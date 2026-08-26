import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  loadSfxIndex,
  loadTemplateManifest,
  templatesById,
} from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { runBuildReel } from './drive.js';
import { imageSize } from './image-size.js';
import {
  buildReel,
  placeholderScalePercent,
  auditedSolid,
  resolveSfxDir,
  type AuditComp,
} from './reel-plan.js';

/** Free and local: drives the running After Effects, calls no API. */
const AUDIT_PATH = path.join(REPO_ROOT, 'templates', 'library.audit.json');
const AEP_PATH = path.join(REPO_ROOT, 'templates', 'library.aep');

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const planPath = flag('plan');
if (planPath === undefined) {
  console.error('usage: npm run build:reel -- --plan <abs path.editplan.json> [--out <abs path.aep>]');
  process.exit(1);
}

const plan = await readEditPlan(planPath);
const reel = path.basename(planPath).replace('.editplan.json', '').replace(/\s+/g, '_');
const audit = (JSON.parse(readFileSync(AUDIT_PATH, 'utf8')) as { comps?: AuditComp[] }).comps ?? [];
const entries = templatesById(loadTemplateManifest());
const sfxDir = resolveSfxDir(REPO_ROOT);
const sfxFiles = new Map(loadSfxIndex().sfx.map((s) => [s.id, path.join(sfxDir, s.file)]));

/**
 * No slot carries a `chosenCandidateId` — the editor picks in Block 8 — so the
 * probe takes the first candidate and the report names it. A `cutout`
 * presentation uses the cut-out PNG; a `card` uses the generated image itself.
 */
const chosenIds: string[] = [];
function candidateFileFor(slotId: string): { path: string; id: string } | null {
  const slot = plan.images.slots.find((s) => s.id === slotId);
  const c = slot?.candidates[0];
  if (slot === undefined || c === undefined) return null;
  const file = slot.presentation === 'cutout' ? (c.cutoutPath ?? c.path) : c.path;
  if (!existsSync(file)) return null;
  chosenIds.push(`${slotId}:${c.id}:${slot.presentation ?? 'null'}`);
  return { path: file, id: c.id };
}

const built = buildReel({
  plan,
  audit,
  introFor: (id) => entries.get(id)?.introS ?? 0,
  sfxFileFor: (id) => {
    const f = sfxFiles.get(id);
    if (f === undefined) throw new Error(`assets/sfx/sfx.json does not define ${id}`);
    return f;
  },
  candidateFileFor,
});

// The image scale factor is derived per element from the audited solid and the
// real source, never hardcoded. Printed so the arithmetic is on the record.
for (const e of built.elements) {
  if (e.kind !== 'image' || e.imagePath === undefined) continue;
  const c = audit.find((x) => x.name === e.templateId);
  if (c === undefined) throw new Error(`audit has no comp ${e.templateId}`);
  const solid = auditedSolid(c, 'IMG_MAIN');
  const src = imageSize(e.imagePath);
  e.placeholderScalePercent = placeholderScalePercent({
    auditedSolidWidth: solid.width,
    auditedScalePercent: solid.scalePercent,
    sourceWidth: src.width,
  });
  console.log(
    `${e.id}: solid ${solid.width}px at ${solid.scalePercent}% / source ${src.width}px ` +
      `-> placeholder scale ${e.placeholderScalePercent.toFixed(4)}%`,
  );
}

console.log(`\nchosen candidates: ${chosenIds.join(', ') || 'none'}`);
console.log(
  `elements ${built.elements.length}, placements A ${built.placementsA.length} / ` +
    `C ${built.placementsC.length}, audio ${built.audio.length}, skipped ${built.skipped.length}`,
);
for (const s of built.skipped) console.log(`  SKIPPED ${s.kind} ${s.id}: ${s.reason}`);

const startedAt = Date.now();
const result = runBuildReel({
  footagePath: plan.source.videoPath,
  templatesAepPath: AEP_PATH,
  masterWidth: plan.source.width,
  masterHeight: plan.source.height,
  reelDurationS: plan.source.durationS,
  frameRate: 30000 / 1001,
  elements: built.elements,
  masters: [
    { name: `master_${reel}_A`, placements: built.placementsA, audio: built.audio },
    { name: `master_${reel}_C`, placements: built.placementsC, audio: built.audio },
  ],
  activeComp: `master_${reel}_C`,
  parkAtS: plan.source.durationS / 2,
  savePath: flag('out') ?? path.join(REPO_ROOT, '.local', 'build', `${reel}-full.aep`),
});
const wallS = (Date.now() - startedAt) / 1000;

console.log(`\n${JSON.stringify(result, null, 2)}`);
console.log(`\nbuild wall clock ${wallS.toFixed(1)}s`);
if (!result.ok) process.exit(1);
