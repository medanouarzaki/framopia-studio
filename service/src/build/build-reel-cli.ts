import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  SUBTITLE_SAFE_WIDTH,
  loadSfxIndex,
  loadTemplateManifest,
  templatesById,
} from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { runBuildReel } from './drive.js';
import { imageSize } from './image-size.js';
import { contentAnchorPoint, contentAwareScalePercent, contentBoxes } from './content-box.js';
import { assertPathsPresent, type PathRef } from './preflight.js';
import { COMP_SIDE_PX } from '../placement/constants.js';
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
  chosenIds.push(`${slotId}:${c.id}:${slot.presentation ?? 'null'}`);
  return { path: file, id: c.id };
}

/*
 * Everything the build is about to reference, checked before a single comp is
 * duplicated. A missing file used to make `candidateFileFor` return null, which
 * the planner recorded as a skipped slot and the build then quietly produced
 * without — session 4 lost 4 of 5 images that way and nobody was told.
 */
const refs: PathRef[] = [
  { elementId: 'source', kind: 'footage', path: plan.source.videoPath },
  { elementId: 'templates', kind: 'aep', path: AEP_PATH },
];
for (const slot of plan.images.slots) {
  const c = slot.candidates[0];
  if (c === undefined) continue;
  const file = slot.presentation === 'cutout' ? (c.cutoutPath ?? c.path) : c.path;
  refs.push({ elementId: slot.id, kind: `image (${slot.presentation ?? 'card'})`, path: file });
}
for (const e of plan.sfx.events) {
  const f = sfxFiles.get(e.sfxId);
  refs.push({ elementId: e.id, kind: `audio ${e.sfxId}`, path: f ?? '(not in sfx.json)' });
}
assertPathsPresent(refs);
console.log(`pre-flight: ${refs.length} referenced files all present`);

/*
 * Image sizes to compare, from `npm run image-ceiling`. **No constant is
 * changed**: the variants are parameters, and which becomes the default is the
 * user's ruling after he has looked.
 *
 *   strict — today's rules, the reference point
 *   loose  — the zone rectangle dropped, every clearance and fill at its most
 *            permissive, hair still counting as head
 *   face   — the face-only mask, with the same loosened constants
 *
 * Image handling is the only thing that differs between them: the subtitle,
 * keyword and audio placements are the same list in every comp.
 */
const ceilingsPath = path.join(REPO_ROOT, '.local', 'build', 'image-ceilings.json');
interface Ceilings {
  sizes: Record<string, Record<string, number>>;
  rects: Record<string, Record<string, { x: number; y: number; w: number; h: number }>>;
}
const ceilings: Ceilings = existsSync(ceilingsPath)
  ? (JSON.parse(readFileSync(ceilingsPath, 'utf8')) as Ceilings)
  : { sizes: {}, rects: {} };
const variantSizes = ceilings.sizes;
const IMAGE_VARIANTS = ['strict', 'loose', 'face'] as const;
const sizeFor = (variant: string) => (slotId: string): number => {
  const px = variantSizes[variant]?.[slotId];
  const slot = plan.images.slots.find((s) => s.id === slotId);
  return px ?? (slot?.scale ?? 0) * COMP_SIDE_PX;
};

const built = buildReel({
  plan,
  audit,
  imageVariants: Object.keys(variantSizes).length === 0
    ? []
    : IMAGE_VARIANTS.map((name) => ({
        name,
        scaleFor: sizeFor(name),
        rectFor: (slotId: string) => ceilings.rects[name]?.[slotId],
      })),
  introFor: (id) => entries.get(id)?.introS ?? 0,
  sfxFileFor: (id) => {
    const f = sfxFiles.get(id);
    if (f === undefined) throw new Error(`assets/sfx/sfx.json does not define ${id}`);
    return f;
  },
  candidateFileFor,
});

/*
 * The image scale is derived per element from the audited solid and the file,
 * never hardcoded — and from the file's **content** rather than its canvas
 * since Block 7 session 7, which measured the subject at a median 0.701 of a
 * file's long edge. A file whose content already fills its canvas gets exactly
 * the previous number, so nothing that was right changes.
 */
const contentFiles = built.elements
  .filter((e) => e.kind === 'image' && e.imagePath !== undefined)
  .map((e) => {
    const slot = plan.images.slots.find((s) => s.id === e.id);
    return {
      path: e.imagePath as string,
      kind: (slot?.presentation === 'cutout' ? 'cutout' : 'original') as 'cutout' | 'original',
    };
  });
const boxes = contentBoxes(contentFiles);

for (const e of built.elements) {
  if (e.kind !== 'image' || e.imagePath === undefined) continue;
  const c = audit.find((x) => x.name === e.templateId);
  if (c === undefined) throw new Error(`audit has no comp ${e.templateId}`);
  const solid = auditedSolid(c, 'IMG_MAIN');
  const src = imageSize(e.imagePath);
  const content = boxes.get(e.imagePath);
  const canvasOnly = placeholderScalePercent({
    auditedSolidWidth: solid.width,
    auditedScalePercent: solid.scalePercent,
    sourceWidth: src.width,
  });
  e.placeholderScalePercent = contentAwareScalePercent({
    auditedSolidWidth: solid.width,
    auditedScalePercent: solid.scalePercent,
    sourceWidth: src.width,
    content,
  });
  e.contentAnchor = content === undefined ? undefined : contentAnchorPoint(content);
  const longEdge = content === undefined ? src.width : Math.max(content.w, content.h);
  console.log(
    `${e.id}: solid ${solid.width}px at ${solid.scalePercent}% / canvas ${src.width}px ` +
      `/ content ${longEdge}px -> scale ${canvasOnly.toFixed(4)}% (canvas) ` +
      `-> ${e.placeholderScalePercent.toFixed(4)}% (content), ` +
      `anchor ${e.contentAnchor === undefined ? 'canvas centre' : `${e.contentAnchor.x.toFixed(0)}, ${e.contentAnchor.y.toFixed(0)}`}`,
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
  safeWidth: SUBTITLE_SAFE_WIDTH,
  elements: built.elements,
  masters: [
    { name: `master_${reel}_A`, placements: built.placementsA, audio: built.audio },
    { name: `master_${reel}_C`, placements: built.placementsC, audio: built.audio },
    ...[...built.variantPlacements].map(([name, images]) => ({
      // Retiming held at C so the only difference between the three is size.
      name: `master_img_${name}`,
      placements: [...built.placementsC.filter((p) => p.kind !== 'image'), ...images],
      audio: built.audio,
    })),
  ],
  activeComp: flag('active') ?? `master_${reel}_C`,
  // Reported so the frame bound can be checked per comp rather than trusted.
  reportPlacements: true,
  parkAtS: Number(flag('park') ?? plan.source.durationS / 2),
  // --park pins the playhead at a named moment; without it the build finds a
  // wrapped card, which is only useful when wrapping is what is being judged.
  parkOnWrapped: flag('park') === undefined,
  savePath: flag('out') ?? path.join(REPO_ROOT, '.local', 'build', `${reel}-full.aep`),
});
const wallS = (Date.now() - startedAt) / 1000;

console.log(`\n${JSON.stringify(result, null, 2)}`);
console.log(`\nbuild wall clock ${wallS.toFixed(1)}s`);
if (!result.ok) process.exit(1);
