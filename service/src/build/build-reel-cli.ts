import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  SUBTITLE_SAFE_WIDTH,
  cardFrameColour,
  dialogueAttenuationDb,
  loadMode,
  loadSfxIndex,
  loadTemplateManifest,
  parseHexColour,
  resolveUserPath,
  templatesById,
  MIX_CEILING_DBFS,
  toAeColour,
} from '@framopia/core';
import { edgeLuminance } from '../images/sidecar.js';
import { readEditPlan } from '../editplan/io.js';
import { runBuildReel } from './drive.js';
import { imageSize } from './image-size.js';
import { canvasScalePercent, contentBoxes } from './content-box.js';
import { assertAllPlaced, assertPathsPresent, type PathRef } from './preflight.js';
import { buildChoiceFor } from './choose-candidate.js';
import {
  COMP_SIDE_PX,
  WATERMARK_GAIN_DB,
  WATERMARK_DURATION_S,
} from '../placement/constants.js';
import { assertBeepsFitWatermark, placeWatermark, watermarkEnabled } from '../placement/watermark.js';
import { placeImageDetail, placementIsSafe } from '../placement/image-placement.js';
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

const planArg = flag('plan');
if (planArg === undefined) {
  console.error('usage: npm run build:reel -- --plan <path.editplan.json> [--out <path.aep>]');
  process.exit(1);
}
// Relative to where the command was typed, not to the workspace npm runs it in.
const planPath = resolveUserPath(planArg);
const outArg = flag('out');

const plan = await readEditPlan(planPath);
const reel = path.basename(planPath).replace('.editplan.json', '').replace(/\s+/g, '_');
const audit = (JSON.parse(readFileSync(AUDIT_PATH, 'utf8')) as { comps?: AuditComp[] }).comps ?? [];
const entries = templatesById(loadTemplateManifest());
const sfxDir = resolveSfxDir(REPO_ROOT);
const sfxFiles = new Map(loadSfxIndex().sfx.map((s) => [s.id, path.join(sfxDir, s.file)]));

/**
 * The slot's chosen candidate, or the first one when nothing has been chosen.
 *
 * **Taking the first is a documented placeholder, not a decision**: it dates
 * from Block 7, when the picker did not exist and every slot's
 * `chosenCandidateId` was null. Step 4 sets it now, and a slot that carries a
 * choice is built with it. The report names which of the two happened.
 *
 * A `cutout` presentation uses the cut-out PNG; a `card` uses the generated
 * image itself.
 */
const chosenIds: string[] = [];
function candidateFileFor(slotId: string): { path: string; id: string } | null {
  const slot = plan.images.slots.find((s) => s.id === slotId);
  if (slot === undefined) return null;
  const choice = buildChoiceFor(slot);
  const c = slot.candidates.find((x) => x.id === choice.candidateId);
  if (c === undefined) return null;
  const file = slot.presentation === 'cutout' ? (c.cutoutPath ?? c.path) : c.path;
  const how = choice.reason;
  const override =
    (slot.overriddenGateFailures ?? []).length > 0
      ? ` overriding ${(slot.overriddenGateFailures ?? []).join('; ')}`
      : '';
  chosenIds.push(`${slotId}:${c.id}:${slot.presentation ?? 'null'} (${how}${override})`);
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
 * Where each image goes: the largest square in the free band around the
 * speaker's face, preferring the one above it. Derived here from the reel's own
 * masks — it used to be read from `.local/build/topleft-<reel>.json`, which the
 * build then depended on someone having regenerated.
 *
 * Both hard bounds are asserted rather than assumed. A picture over the
 * speaker's face, or off the edge of the frame, is not something to discover in
 * a built comp.
 */
const placementModeId = flag('mode') ?? plan.clientMode?.id;
const imageScale =
  placementModeId === undefined ? 1 : (loadMode(placementModeId).imageScale ?? 1);
const imagePlacements: Record<string, { x: number; y: number; w: number; h: number }> = {};
for (const slot of plan.images.slots) {
  const faceBox = faceSpan(slot.start, slot.end);
  const detail = placeImageDetail({
    faceBox,
    seed: `${plan.meta.id}:${slot.id}`,
    scale: imageScale,
    prefer: slot.placementBand,
  });
  const safe = placementIsSafe(detail.rect, faceBox);
  if (!safe.insideFrame || !safe.clearsFace) {
    console.error(
      `${slot.id}: placement ${safe.insideFrame ? '' : 'leaves the frame'}` +
        `${safe.clearsFace ? '' : 'overlaps the speaker’s face'}`,
    );
    process.exit(1);
  }
  imagePlacements[slot.id] = detail.rect;
  console.log(
    `${slot.id}: ${(detail.rect.w * plan.source.width).toFixed(0)}px ${detail.band}` +
      (slot.placementBand === undefined ? '' : ' (your choice)') +
      (detail.clamped
        ? `, smaller than the ${imageScale}x asked for (the band holds ${detail.bandSidePx.toFixed(0)}px)`
        : ''),
  );
}

const built = buildReel({
  plan,
  audit,
  // Derived here from the reel's own face masks rather than read from a side
  // file the build would otherwise depend on being regenerated.
  topLeftFor: (slotId: string) => imagePlacements[slotId],
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

/*
 * The frame around a card is only a frame if it separates from the picture. The
 * corpus is generated against the mode's own dark palette, so a dark frame is
 * invisible on every candidate and the user reported exactly that: some images
 * disappear. The colour is derived per image rather than set once, so a light
 * picture on a future reel gets a dark frame without anyone deciding again.
 */
/*
 * The plan says which client it was built for. `--mode` overrides it, for
 * rebuilding a reel against a different client deliberately; without either the
 * card frame keeps the template's own colour, which is a fallback rather than a
 * decision and is said out loud.
 */
const modeOverride = flag('mode');
const modeId = modeOverride ?? plan.clientMode?.id;
const modeSource =
  modeOverride !== undefined
    ? `--mode (overriding the plan's ${plan.clientMode?.id ?? 'none'})`
    : plan.clientMode === null
      ? 'nothing'
      : `the plan (recorded v${plan.clientMode.version})`;
if (modeId === undefined) {
  console.log(
    '\nno client mode on the plan and none given: the card frame keeps the ' +
      'template’s own colour',
  );
} else {
  console.log(`\nclient mode ${modeId}, from ${modeSource}`);
  const palette = Object.fromEntries(
    Object.entries(loadMode(modeId).palette).map(([role, hex]) => [role, parseHexColour(hex)]),
  );
  for (const e of built.elements) {
    if (e.kind !== 'image' || e.imagePath === undefined) continue;
    const edge = await edgeLuminance(e.imagePath);
    const frame = cardFrameColour({ edgeLuminance: edge.meanLuminance, palette });
    e.cardColor = toAeColour(frame.colour);
    console.log(
      `${e.id}: edge luminance ${edge.meanLuminance.toFixed(4)} -> frame ${frame.role} ` +
        `at ${frame.contrast.toFixed(2)}:1` +
        (frame.meetsMinimum ? '' : ' — BELOW the 3:1 minimum, best available'),
    );
  }
}

console.log(`\nchosen candidates: ${chosenIds.join(', ') || 'none'}`);
console.log(
  `elements ${built.elements.length}, placements A ${built.placementsA.length} / ` +
    `C ${built.placementsC.length}, audio ${built.audio.length}, skipped ${built.skipped.length}`,
);
for (const s of built.skipped) console.log(`  SKIPPED ${s.kind} ${s.id}: ${s.reason}`);
assertAllPlaced(built.skipped);
const onFloor = built.shortened.filter((s) => s.onFloor).length;
console.log(
  `short-card entrances: ${built.shortened.length} shortened, ${onFloor} on the two-frame floor`,
);

/*
 * Placed against the face over its own window and against whatever else is on
 * screen then, so it never lands on the speaker or under an image.
 */
let watermark: Record<string, unknown> | undefined;
/*
 * The plan decides, not the disk. This asked only whether the measurement file
 * and the asset existed, so every reel got a mark whether or not it was meant
 * to — including one the plan recorded nothing about at all.
 */
if (!watermarkEnabled(plan.watermark)) {
  console.log('\nwatermark: off for this reel');
} else if (watermarkFacts !== null && existsSync(WATERMARK_PATH)) {
  // The duration is flat now, so the measured beeps have to be checked against
  // it rather than setting it.
  assertBeepsFitWatermark(watermarkFacts.lastBeepEndS);
  const outPointS = WATERMARK_DURATION_S;
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
      `frame ${(placed.outPointS * (30000 / 1001)).toFixed(2)} of ${watermarkFacts.frames}; ` +
      `last beep ends ${(watermarkFacts.lastBeepEndS ?? 0).toFixed(3)}s, ` +
      `${((placed.outPointS) - (watermarkFacts.lastBeepEndS ?? 0)).toFixed(3)}s of margin`,
  );
  for (const r of placed.rejected) console.log(`  rejected ${r.corner}: ${r.reason}`);
} else {
  console.log('watermark: no measured facts on disk; not placed');
}

const startedAt = Date.now();
/*
 * The reel comes down so the sound effects fit. Derived from the same rule the
 * event gains are, so the layer and the sounds cannot drift apart; a reel whose
 * loudness or peak was never measured is left alone.
 */
const dialogueGainDb =
  plan.source.dialogueLufs === undefined || plan.source.dialoguePeakDbfs === undefined
    ? 0
    : -dialogueAttenuationDb({
        dialogueLufs: plan.source.dialogueLufs,
        dialoguePeakDbfs: plan.source.dialoguePeakDbfs,
      });
console.log(
  dialogueGainDb === 0
    ? '\ndialogue: unmeasured, placed at its own level'
    : `\ndialogue: ${plan.source.dialogueLufs} LUFS peaking ${plan.source.dialoguePeakDbfs} dBFS -> ` +
      `${dialogueGainDb.toFixed(2)} dB, leaving ${MIX_CEILING_DBFS} dBFS for the mix`,
);

const result = runBuildReel({
  footagePath: plan.source.videoPath,
  dialogueGainDb,
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
  savePath:
    outArg === undefined
      ? path.join(REPO_ROOT, '.local', 'build', `${reel}-full.aep`)
      : resolveUserPath(outArg),
});
const wallS = (Date.now() - startedAt) / 1000;

console.log(`\n${JSON.stringify(result, null, 2)}`);

/*
 * What After Effects stored, against what it was asked for.
 *
 * An audio layer's `startTime` may now be negative — a sound whose lead-in is
 * longer than the reel in front of its element begins before the composition —
 * and the whole point of that placement is a number AE has to honour. A build
 * that silently disagrees with its plan is the defect this thread was about, so
 * it is checked here rather than trusted.
 */
if (result.ok) {
  const masters = (result['masters'] ?? []) as {
    name: string;
    audio?: { sourceElementId: string; askedStartTimeS: number; startTimeS: number; inPointS: number }[];
  }[];
  /*
   * A hundredth of a frame. After Effects re-derives a layer's start onto its
   * own grid using a **float32** frame rate — 29.9700317382812 rather than the
   * exact 30000/1001 — so a start snapped with the rational lands a fraction
   * off and AE stores its nearest value. Measured across this corpus the
   * residue is at most 5.8e-4 frames and grows with time, exactly as a frame
   * rate difference does. A real disagreement is a whole frame or more, so this
   * clears the storage artefact by more than an order of magnitude while still
   * catching one.
   */
  const TOLERANCE_FRAMES = 0.01;
  const wrong: string[] = [];
  let worstFrames = 0;
  let checked = 0;
  for (const master of masters) {
    for (const layer of master.audio ?? []) {
      checked += 1;
      const offBy = Math.abs(layer.startTimeS - layer.askedStartTimeS) * (30000 / 1001);
      worstFrames = Math.max(worstFrames, offBy);
      if (offBy > TOLERANCE_FRAMES) {
        wrong.push(
          `${master.name}/${layer.sourceElementId}: asked ${layer.askedStartTimeS.toFixed(4)}s, ` +
            `After Effects stored ${layer.startTimeS.toFixed(4)}s`,
        );
      }
    }
  }
  console.log(
    `\naudio layers verified against the plan: ${checked} checked, ${wrong.length} disagreeing ` +
      `(worst ${worstFrames.toExponential(1)} frames, tolerance ${TOLERANCE_FRAMES})`,
  );
  for (const line of wrong) console.log(`  ${line}`);
  const early = masters
    .flatMap((m) => (m.audio ?? []).map((a) => ({ master: m.name, ...a })))
    .filter((a) => a.startTimeS < 0);
  for (const a of early) {
    console.log(
      `  ${a.master}/${a.sourceElementId} starts ${(-a.startTimeS).toFixed(4)}s before the ` +
        `composition, playing from its in-point at ${a.inPointS.toFixed(4)}s`,
    );
  }
  if (wrong.length > 0) {
    console.error('\nthe built comp does not match the plan');
    process.exit(1);
  }
}

console.log(`\nbuild wall clock ${wallS.toFixed(1)}s`);
if (!result.ok) process.exit(1);
