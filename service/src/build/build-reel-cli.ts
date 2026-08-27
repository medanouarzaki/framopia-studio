import { execFileSync } from 'node:child_process';
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
import { canvasScalePercent, contentBoxes } from './content-box.js';
import { assertPathsPresent, type PathRef } from './preflight.js';
import {
  COMP_SIDE_PX,
  WATERMARK_GAIN_DB,
  WATERMARK_HOLD_AFTER_LAST_BEEP_S,
} from '../placement/constants.js';
import { placeWatermark } from '../placement/watermark.js';
import {
  buildReel,
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
 * Every image is framed and every image is top-left (Block 7 session 9's
 * rulings). `img_float` is the card template; `img_slide_left` stays in the
 * library and the manifest but is no longer chosen automatically.
 */
const CARD_TEMPLATE = 'img_float';

/*
 * The watermark. Its duration is derived from the measured last beep rather
 * than a constant, so a different file recomputes; the facts come from
 * `npm run watermark:measure`.
 */
const WATERMARK_PATH = path.join(REPO_ROOT, 'assets', 'watermark', 'intro.mov');
const watermarkFactsPath = path.join(REPO_ROOT, '.local', 'build', 'watermark.json');
interface WatermarkFacts {
  width: number;
  height: number;
  frames: number;
  lastBeepEndS: number | null;
  alphaIsPremultiplied: boolean;
}
const watermarkFacts: WatermarkFacts | null = existsSync(watermarkFactsPath)
  ? (JSON.parse(readFileSync(watermarkFactsPath, 'utf8')) as WatermarkFacts)
  : null;

const faceBoxesPath = path.join(REPO_ROOT, '.local', 'build', `topleft-${path.basename(planPath).replace('.editplan.json', '')}.json`);
const topLeft: Record<string, { x: number; y: number; w: number; h: number }> = existsSync(faceBoxesPath)
  ? (JSON.parse(readFileSync(faceBoxesPath, 'utf8')) as Record<string, { x: number; y: number; w: number; h: number }>)
  : {};

const built = buildReel({
  plan,
  audit,
  topLeftFor: (slotId: string) => topLeft[slotId],
  cardTemplateId: CARD_TEMPLATE,
  introFor: (id) => entries.get(id)?.introS ?? 0,
  minHoldFor: (id) => entries.get(id)?.minHoldS ?? 0,
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

  /*
   * Every image is a card now, so the whole canvas is opaque picture and the
   * canvas is what the CARD layer has to contain. Sizing by content — right
   * for a cutout, whose margin is transparent — renders the canvas at
   * 1000 x canvas/content and spills it past the 1080 px frame on any file
   * whose content fills less than 0.926 of its canvas. Two of vitasilk's five
   * do, which is the misalignment that was reported.
   */
  e.placeholderScalePercent = canvasScalePercent({
    auditedSolidWidth: solid.width,
    auditedScalePercent: solid.scalePercent,
    sourceWidth: src.width,
  });
  // The canvas is the picture, so its own centre is the right anchor.
  e.contentAnchor = undefined;
  const longEdge = content === undefined ? src.width : Math.max(content.w, content.h);
  const rendered = src.width * (e.placeholderScalePercent / 100);
  console.log(
    `${e.id}: canvas ${src.width}px, content ${longEdge}px -> scale ` +
      `${e.placeholderScalePercent.toFixed(4)}% -> renders ${rendered.toFixed(0)}px ` +
      `inside a ${solid.width}px solid and an 1080px frame`,
  );
}

console.log(`\nchosen candidates: ${chosenIds.join(', ') || 'none'}`);
console.log(
  `elements ${built.elements.length}, placements A ${built.placementsA.length} / ` +
    `C ${built.placementsC.length}, audio ${built.audio.length}, skipped ${built.skipped.length}`,
);
for (const s of built.skipped) console.log(`  SKIPPED ${s.kind} ${s.id}: ${s.reason}`);
const onFloor = built.shortened.filter((s) => s.onFloor).length;
console.log(
  `short-card entrances: ${built.shortened.length} shortened, ${onFloor} on the two-frame floor`,
);

/**
 * The face mask over a window, as one box. Read from masks already on disk;
 * runs no model.
 */
const MASK_PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const MASK_SCRIPT = path.join(REPO_ROOT, 'tools', 'cv', 'head_boxes.py');
interface MaskFrame { index: string; box: [number, number, number, number] | null }
// The CV directory is named after the reel as it appears on disk, spaces and
// all; `reel` has had them replaced for comp naming.
const maskDir = path.join(REPO_ROOT, '.local', 'cv', path.basename(planPath).replace('.editplan.json', ''), 'masks-2fps');
const faceFrames: MaskFrame[] = existsSync(maskDir) && existsSync(MASK_PY)
  ? (JSON.parse(
      execFileSync(MASK_PY, [MASK_SCRIPT, maskDir, 'face'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
    ) as { frames: MaskFrame[] }).frames
  : [];

function faceSpan(startS: number, endS: number): { x: number; y: number; w: number; h: number } | null {
  const fps = plan.zones.sampleFps || 2;
  const boxes = faceFrames
    .filter((f) => {
      const t = Number(f.index) / fps;
      return f.box !== null && t >= startS - 1 / fps && t <= endS + 1 / fps;
    })
    .map((f) => f.box as [number, number, number, number]);
  if (boxes.length === 0) return null;
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  return {
    x: x0,
    y: y0,
    w: Math.max(...boxes.map((b) => b[2])) - x0,
    h: Math.max(...boxes.map((b) => b[3])) - y0,
  };
}

/*
 * Placed against the face over its own window and against whatever else is on
 * screen then, so it never lands on the speaker or under an image.
 */
let watermark: Record<string, unknown> | undefined;
if (watermarkFacts !== null && watermarkFacts.lastBeepEndS !== null && existsSync(WATERMARK_PATH)) {
  const outPointS = watermarkFacts.lastBeepEndS + WATERMARK_HOLD_AFTER_LAST_BEEP_S;
  const occupied = built.placementsC
    .filter((p) => p.kind === 'image' && p.inPointS < outPointS && 0 < p.outPointS)
    .map((p) => {
      const side = ((p.scalePercent ?? 0) / 100) * COMP_SIDE_PX;
      return {
        x: (p.positionX - side / 2) / plan.source.width,
        y: (p.positionY - side / 2) / plan.source.height,
        w: side / plan.source.width,
        h: side / plan.source.height,
      };
    });
  const wmFace = faceSpan(0, outPointS);
  const placed = placeWatermark({
    faceBox: wmFace,
    occupied,
    sourceWidth: watermarkFacts.width,
    sourceHeight: watermarkFacts.height,
    lastBeepEndS: watermarkFacts.lastBeepEndS,
    holdAfterLastBeepS: WATERMARK_HOLD_AFTER_LAST_BEEP_S,
    seed: plan.meta.id,
  });
  // Width is what is fitted; the artwork is 1924 x 2154 so the height follows
  // its own aspect rather than being squared off.
  const scalePercent = ((placed.rect.w * plan.source.width) / watermarkFacts.width) * 100;
  watermark = {
    filePath: WATERMARK_PATH,
    premultiplied: watermarkFacts.alphaIsPremultiplied,
    outPointS: placed.outPointS,
    positionX: (placed.rect.x + placed.rect.w / 2) * plan.source.width,
    positionY: (placed.rect.y + placed.rect.h / 2) * plan.source.height,
    scalePercent,
    gainDb: WATERMARK_GAIN_DB,
  };
  console.log(
    `watermark: ${placed.corner}, ${(placed.rect.w * plan.source.width).toFixed(0)} x ` +
      `${(placed.rect.h * plan.source.height).toFixed(0)} px from ${watermarkFacts.width}x${watermarkFacts.height} ` +
      `-> scale ${scalePercent.toFixed(4)}%; out at ${placed.outPointS.toFixed(3)}s = ` +
      `frame ${(placed.outPointS * (30000 / 1001)).toFixed(2)} of ${watermarkFacts.frames}`,
  );
  for (const r of placed.rejected) console.log(`  rejected ${r.corner}: ${r.reason}`);
} else {
  console.log('watermark: no measured facts on disk; not placed');
}

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
    { name: 'master_final', placements: built.placementsC, audio: built.audio, watermark },
    {
      // The same elements with the images and their audio left out, so the
      // subtitles can be judged with nothing else on screen. One difference.
      name: 'master_subs_only',
      placements: built.placementsC.filter((p) => p.kind !== 'image'),
      // An image's whoosh belongs to the image, so it goes with it.
      audio: built.audio.filter((a) => !a.sourceElementId.startsWith('img')),
    },
  ],
  activeComp: flag('active') ?? 'master_final',
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
