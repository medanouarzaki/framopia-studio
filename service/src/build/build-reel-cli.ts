import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  savedOutputNote,
  savedOutputSentence,
  REPO_ROOT,
  SUBTITLE_SAFE_WIDTH,
  SHRINK_MAX_ATTEMPTS,
  assertEveryCardFits,
  summariseShrinks,
  type ShrinkRow,
  cardColours,
  dialogueAttenuationDb,
  loudestBoundOffsetDb,
  clientPictureById,
  fitByLongEdge,
  loadMode,
  loadSfxIndex,
  loadTemplateManifest,
  parseHexColour,
  resolveUserPath,
  templatesById,
  MIX_CEILING_DBFS,
  toAeColour,
} from '@framopia/core';
import { edgeLuminance, flattenCutout } from '../images/sidecar.js';
import { readEditPlan } from '../editplan/io.js';
import { runBuildReel } from './drive.js';
import { emitBuildStage } from './stages.js';
import { imageSize } from './image-size.js';
import { contentBoxes } from './content-box.js';
import { assertAllPlaced, assertPathsPresent, type PathRef } from './preflight.js';
import { resolveClientIdentity } from './client-identity.js';
import { requiredFonts } from './required-fonts.js';
import { textStyleFor } from './text-style.js';
import {
  assertRequirementsMet,
  buildRequirements,
  readBuildDisk,
} from './requirements.js';
import { buildChoiceFor } from './choose-candidate.js';
import {
  COMP_SIDE_PX,
  WATERMARK_GAIN_DB,
  WATERMARK_DURATION_S,
} from '../placement/constants.js';
import { assertBeepsFitWatermark, placeWatermark, watermarkEnabled, watermarkSizeOf } from '../placement/watermark.js';
import { placementIsSafe, reelPlacements } from '../placement/top-left.js';
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

emitBuildStage('prepare');
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

  /*
   * One of the client's own pictures wins over anything generated: he pointed
   * at a photograph, and a square from a model is not what he asked for. The
   * file is used where it sits — nothing copies it and nothing sends it.
   */
  if (slot.chosenClientPictureId !== undefined && placementModeId !== undefined) {
    const picture = clientPictureById(loadMode(placementModeId), slot.chosenClientPictureId);
    if (picture !== null) {
      chosenIds.push(`${slotId}:${picture.id} (the client’s own picture)`);
      return { path: picture.path, id: picture.id };
    }
    console.error(
      `${slotId}: the client picture ${slot.chosenClientPictureId} is not on this client any more`,
    );
    process.exit(1);
  }

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
/*
 * Every measurement a correct build needs, checked before anything is placed.
 * Session 38 found a reel with no masks building a picture across the speaker's
 * face and saying nothing; a missing input names itself and stops here now.
 */
/*
 * The client's look comes from the copy on the plan, not from the mode file as
 * it stands today. A reel approved in March must rebuild in June as it was
 * approved; where there is no copy the live file is read, exactly as every
 * build did before, and the fallback is printed rather than assumed.
 *
 * Resolved before the requirements check, because whether an identity resolved
 * at all is one of the things that check refuses on.
 */
const identity = resolveClientIdentity(plan, {
  ...(flag('mode') === undefined ? {} : { modeIdOverride: flag('mode') as string }),
});

assertRequirementsMet(
  buildRequirements(plan, readBuildDisk(planPath), {
    ...(flag('mode') === undefined ? {} : { modeId: flag('mode') as string }),
    knownTemplateIds: new Set(entries.keys()),
    clientSource: identity.source,
  }),
);
console.log(`\nclient: ${identity.note}`);
if (identity.behind === true) {
  console.log(
    'the client’s look has changed since this video was set up; this build uses the ' +
      'saved one. Move it forward from the panel if that is what you want.',
  );
}
const imageScale = identity.snapshot?.imageScale ?? 1;
/*
 * A client's own pictures are read from the live mode file, never from the
 * snapshot: they are paths to files on disk that a person chose by hand, and a
 * pinned path would break the moment one is moved or replaced.
 */
const placementModeId = flag('mode') ?? plan.clientMode?.id;
const imagePlacements: Record<string, { x: number; y: number; w: number; h: number }> = {};
const slotFaces = new Map(
  plan.images.slots.map((slot) => [slot.id, faceSpan(slot.start, slot.end)]),
);
const reelPlaced = reelPlacements(
  plan.images.slots.map((slot) => ({
    id: slot.id,
    faceBox: slotFaces.get(slot.id) ?? null,
    seed: `${plan.meta.id}:${slot.id}`,
  })),
  { scale: imageScale },
);
if (reelPlaced.slots.length > 0) {
  console.log(
    `every picture in this reel is ${reelPlaced.commonSidePx.toFixed(0)}px, ` +
      `the largest ${reelPlaced.setBy} can hold`,
  );
}
for (const detail of reelPlaced.slots) {
  const faceBox = slotFaces.get(detail.id) ?? null;
  if (faceBox === null) {
    // The requirements check above refuses a reel with no masks, so reaching
    // here means the masks exist and cover no frame of this slot's window.
    console.error(
      `${detail.id}: the face masks cover no frame between ${detail.id} start and end, so ` +
        'there is nothing to place this picture clear of. Re-sample the reel with ' +
        'npm run frames -- --reel <label> --force, then npm run segment.',
    );
    process.exit(1);
  }
  const safe = placementIsSafe(detail.rect, faceBox);
  if (!safe.insideFrame || !safe.clearsFace) {
    console.error(
      `${detail.id}: placement ${safe.insideFrame ? '' : 'leaves the frame'}` +
        `${safe.clearsFace ? '' : 'overlaps the speaker’s face'}`,
    );
    process.exit(1);
  }
  imagePlacements[detail.id] = detail.rect;
  console.log(
    `${detail.id}: ${(detail.rect.w * plan.source.width).toFixed(0)}px in the top-left corner, ` +
      `bounded by ${detail.boundBy}` +
      (detail.givesUpPx > 0.5
        ? `; ${detail.givesUpPx.toFixed(0)}px smaller than this slot alone could hold`
        : '') +
      (detail.clamped
        ? `; smaller than the ${imageScale}x asked for, which the corner cannot hold`
        : ''),
  );
}

/*
 * `--emphasis-ratio` exists so one reel can be built at two ratios and looked
 * at side by side. Absent takes EMPHASIS_SIZE_RATIO, which is what a normal
 * build does; nothing in the pipeline passes it.
 */
const emphasisRatioFlag = flag('emphasis-ratio');
const emphasisRatio = emphasisRatioFlag === undefined ? undefined : Number(emphasisRatioFlag);
if (emphasisRatio !== undefined && (!Number.isFinite(emphasisRatio) || emphasisRatio <= 0)) {
  console.error(`--emphasis-ratio needs a positive number, not ${emphasisRatioFlag}`);
  process.exit(2);
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
  /*
   * The face, size and colour for each card. Null for a client with no
   * measured font names, which leaves the template's own type exactly as it
   * was — the state every build was in before Block 9 session 6.
   */
  /*
   * Declared by the manifest, not guessed from the audit: a text layer the
   * build finds and fills has to be one the template says is there, or a
   * duplicated layer becomes something the build quietly writes to.
   */
  shadowLayersFor: (templateId) => entries.get(templateId)?.shadowLayers ?? [],
  textStyleFor: (card) => {
    if (identity.snapshot === null) return undefined;
    const c = audit.find((x) => x.name === card.templateId);
    const size = c?.layers.find((l) => l.name === 'TXT_MAIN')?.text?.fontSize;
    if (size === undefined) return undefined;
    const style = textStyleFor({
      kind: card.kind,
      templateId: card.templateId,
      templateFontSize: size,
      snapshot: identity.snapshot,
      ...(emphasisRatio === undefined ? {} : { emphasisSizeRatio: emphasisRatio }),
    });
    return style ?? undefined;
  },
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
  /*
   * Fitted by the **long edge**, not by the width.
   *
   * Every generated image is a 2048x2048 square, so scaling by width alone put
   * the height where it belonged for free. One of the client's own pictures is
   * a photograph: a phone's 3024x4032 at a 1000px width draws 1333px tall,
   * over the top and the bottom of a 1200px comp and far outside the 1080px
   * frame behind it. On a square this is the same arithmetic it always was.
   */
  const fit = fitByLongEdge({
    boxPx: solid.width,
    templateScalePercent: solid.scalePercent,
    sourceWidth: src.width,
    sourceHeight: src.height,
  });
  e.placeholderScalePercent = fit.scalePercent;
  // The canvas is the picture, so its own centre is the right anchor.
  e.contentAnchor = undefined;
  const longEdge = content === undefined ? src.width : Math.max(content.w, content.h);
  console.log(
    `${e.id}: ${src.width}x${src.height}px, content ${longEdge}px -> scale ` +
      `${e.placeholderScalePercent.toFixed(4)}% -> draws ` +
      `${fit.drawnWidth.toFixed(0)}x${fit.drawnHeight.toFixed(0)}px ` +
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
if (identity.snapshot === null) {
  console.log(
    '\nno client for this video: the card frame keeps the template’s own colour',
  );
} else {
  const snapshot = identity.snapshot;
  console.log(
    `\ncard frames from ${snapshot.name} v${snapshot.version}, ${identity.source === 'plan' ? 'as saved for this video' : 'as the client file stands now'}`,
  );
  const palette = Object.fromEntries(
    Object.entries(snapshot.palette).map(([role, hex]) => [role, parseHexColour(hex)]),
  );
  for (const e of built.elements) {
    if (e.kind !== 'image' || e.imagePath === undefined) continue;
    const slot = plan.images.slots.find((s) => s.id === e.id);
    const rendersAsCutout = slot?.presentation === 'cutout';
    const measurement = await edgeLuminance(e.imagePath);
    const colours = cardColours({
      rendersAsCutout,
      edgeLuminance: measurement.meanLuminance,
      subjectLitLuminance: measurement.subjectLitLuminance,
      palette,
    });
    e.cardColor = toAeColour(colours.frame.colour);

    /*
     * A cut-out is composited onto its chosen ground before it is placed, so
     * the card behind it stays a border instead of showing through the whole
     * square. The flattened file is a build artefact beside the cutout; the
     * cutout itself is untouched.
     */
    if (colours.fill !== null) {
      const flat = await flattenCutout({
        cutoutPath: e.imagePath,
        fillRgb: [colours.fill.colour.r, colours.fill.colour.g, colours.fill.colour.b],
        outPath: e.imagePath.replace(/\.png$/i, '.on-fill.png'),
      });
      e.imagePath = flat.outPath;
      console.log(
        `${e.id}: cut out, so it sits on ${colours.fill.role} at ` +
          `${colours.fill.contrast.toFixed(2)}:1 and the frame is ${colours.frame.role} at ` +
          `${colours.frame.contrast.toFixed(2)}:1` +
          (colours.fallback === null ? '' : ` — ${colours.fallback}`),
      );
    } else {
      console.log(
        `${e.id}: the picture's own edge measures ${measurement.meanLuminance.toFixed(4)} -> ` +
          `frame ${colours.frame.role} at ${colours.frame.contrast.toFixed(2)}:1` +
          (colours.fallback === null ? '' : ` — ${colours.fallback}`),
      );
    }
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
    size: watermarkSizeOf(plan.watermark),
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
    `watermark: ${watermarkSizeOf(plan.watermark)}, ${placed.corner}, ` +
      `${(placed.rect.w * plan.source.width).toFixed(0)} x ` +
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
        /*
         * Against the loudest sound a template actually binds, which is what
         * `deriveSfxEvents` gains the sounds for. Session 27 added this to the
         * derivation and not here, so the voice was coming down 3.80 dB while
         * the sounds were gained for 3.07 — the two halves of one rule
         * disagreeing, which is exactly what sharing it is supposed to prevent.
         */
        loudestOffsetDb: loudestBoundOffsetDb(entries),
      });
console.log(
  dialogueGainDb === 0
    ? '\ndialogue: unmeasured, placed at its own level'
    : `\ndialogue: ${plan.source.dialogueLufs} LUFS peaking ${plan.source.dialoguePeakDbfs} dBFS -> ` +
      `${dialogueGainDb.toFixed(2)} dB, leaving ${MIX_CEILING_DBFS} dBFS for the mix`,
);

emitBuildStage('after-effects');
const result = runBuildReel({
  footagePath: plan.source.videoPath,
  /*
   * Where this tool's own output lives. A project open from here is a previous
   * build, not work the user would lose, so the build saves it and proceeds
   * rather than refusing — the guard had stopped him four times running on his
   * own last build.
   */
  buildDir: path.join(REPO_ROOT, '.local', 'build'),
  dialogueGainDb,
  templatesAepPath: AEP_PATH,
  masterWidth: plan.source.width,
  masterHeight: plan.source.height,
  reelDurationS: plan.source.durationS,
  frameRate: 30000 / 1001,
  safeWidth: SUBTITLE_SAFE_WIDTH,
  shrinkMaxAttempts: SHRINK_MAX_ATTEMPTS,
  elements: built.elements,
  /*
   * Checked inside After Effects before a card is placed. Empty today, because
   * nothing sets a font yet — type comes from the template comps.
   */
  requiredFonts: requiredFonts(identity.snapshot),
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
  parkOnShrunk: flag('park') === undefined,
  savePath:
    outArg === undefined
      ? path.join(REPO_ROOT, '.local', 'build', `${reel}-full.aep`)
      : resolveUserPath(outArg),
});
const wallS = (Date.now() - startedAt) / 1000;
emitBuildStage('check');

if (result.ok) {
  // The same sentence the panel shows, through the same rule: saving the file
  // the build is about to overwrite is not a rescue and must not read as one.
  const note = savedOutputSentence(
    savedOutputNote(
      typeof result['savedOwnOutput'] === 'string' ? String(result['savedOwnOutput']) : null,
      typeof result['savePath'] === 'string' ? String(result['savePath']) : null,
    ),
  );
  if (note !== null) console.log(`\n${note}`);
}

console.log(`\n${JSON.stringify(result, null, 2)}`);

/*
 * Every card, against the bound it was built to.
 *
 * After Effects refuses a card it could not bring under the safe width, so this
 * cannot normally fire — and that is the point: a check that can only pass
 * because of something upstream is worth keeping only if it reads the same
 * measurement independently. This reads the width AE measured last, not the
 * arithmetic that produced the size, and it is the one place the whole set is
 * seen at once.
 */
if (result.ok) {
  const textFits = (result['textFits'] ?? []) as {
    id: string;
    kind: 'subtitle' | 'keyword';
    templateId: string;
    font: string | null;
    shrink: {
      text: string;
      lines: string[];
      broken: boolean;
      baseFontSize: number;
      finalFontSize: number;
      factor: number;
      widthBeforePx: number;
      widthAfterPx: number;
      lineWidthsPx: number[];
      attempts: number;
      measurements: { fontSize: number; broken: boolean; widthPx: number }[];
      fits: boolean;
    };
  }[];
  const rows: ShrinkRow[] = textFits.map((f) => ({
    reel,
    id: f.id,
    kind: f.kind,
    text: f.shrink.text,
    lines: f.shrink.lines,
    broken: f.shrink.broken,
    templateId: f.templateId,
    font: f.font,
    baseFontSize: f.shrink.baseFontSize,
    finalFontSize: f.shrink.finalFontSize,
    factor: f.shrink.factor,
    widthBeforePx: f.shrink.widthBeforePx,
    widthAfterPx: f.shrink.widthAfterPx,
    lineWidthsPx: f.shrink.lineWidthsPx,
    safeWidthPx: SUBTITLE_SAFE_WIDTH,
    attempts: f.shrink.attempts,
    measurements: f.shrink.measurements,
    fits: f.shrink.fits,
  }));
  assertEveryCardFits(rows);

  const summary = summariseShrinks(rows);
  const shrinkPath = path.join(REPO_ROOT, '.local', 'build', `${reel}-shrink.json`);
  writeFileSync(
    shrinkPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        reel,
        planPath,
        aepPath: result['savePath'] ?? null,
        aeVersion: result['aeVersion'] ?? null,
        measuredAt: new Date().toISOString(),
        safeWidthPx: SUBTITLE_SAFE_WIDTH,
        maxAttempts: SHRINK_MAX_ATTEMPTS,
        summary,
        cards: rows,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `\ntype: ${summary.cards} cards, ${summary.untouched} on one line at full size, ` +
      `${summary.broken} broken onto two, ${summary.shrunk} shrunk` +
      (summary.smallestFactor === null
        ? ''
        : ` (smallest x${summary.smallestFactor.toFixed(4)})`) +
      `, widest line ${summary.widestAfterPx?.toFixed(2)}px against ${SUBTITLE_SAFE_WIDTH}`,
  );
  console.log(`wrote ${path.relative(REPO_ROOT, shrinkPath)}`);
}

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
if (!result.ok) {
  /*
   * One clean sentence on stderr as well as the JSON above. The unsaved-changes
   * refusal is written for a person to act on, and until now it reached one
   * only inside a pretty-printed object; the panel shows this line verbatim.
   */
  console.error(`\nbuild refused at ${result.stage}: ${result.message}`);
  process.exit(1);
}
