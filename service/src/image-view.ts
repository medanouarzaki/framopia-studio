import { existsSync } from 'node:fs';
import { REPO_ROOT } from '@framopia/core';
import { listReels } from './catalogue.js';
import { readEditPlan, writeEditPlan } from './editplan/io.js';
import { dryRun } from './dry-run.js';
import { buildChoiceFor } from './build/choose-candidate.js';
import { reelPlacements, type ReelSlotPlacement } from './placement/top-left.js';
import { clientPictures, loadMode } from '@framopia/core';
import { FRAME_WIDTH } from './placement/constants.js';
import { faceBoxesFor } from './placement/face-boxes.js';
import { nothingIsMeasured, rendersAsCutout, verdictFor } from './images/verdict.js';
import type { EditPlan, ImageCandidate, ImageSlot } from './editplan/types.js';

/**
 * Step 4, the image candidate picker: every slot, every candidate, and the
 * choice.
 *
 * **Rejected candidates are shown.** The gate's yield on the only reel with
 * images is 2 of 10, and four of the failures are genuine halo — a picker that
 * hid them would hide the reason a slot looks the way it does, and would leave
 * the user unable to override a verdict he disagrees with. The gate advises;
 * he decides.
 */
export class ImageViewError extends Error {}

export interface CandidateView {
  id: string;
  /** Absolute paths; the panel loads them over `file://`, as it does audio. */
  imagePath: string;
  imageExists: boolean;
  cutoutPath: string | null;
  cutoutExists: boolean;
  /**
   * The file the build would actually place for this candidate — the generated
   * picture on a card slot, the cut-out subject on a cutout slot.
   *
   * Derived here rather than in the panel, from the same `presentation` the
   * builder reads, so the picker cannot show a version of the picture the build
   * will not use. It showed the cut-out for every candidate until Block 8
   * session 31, which on four of `vitasilk`'s five slots was a picture the user
   * would never see.
   */
  renderedPath: string;
  renderedExists: boolean;
  modelId: string | null;
  resolution: string | null;
  generatedAt: string | null;
  /** What the plan records for this image. See `reelSpentUsd` for the caveat. */
  costUsd: number | null;
  metrics: {
    alphaEdgeNoise: number;
    holeRatio: number;
    foregroundArea: number;
    edgeHalo: number;
  } | null;
  /** The §5.4 gate: the worst headroom across the metrics, 0 when it failed. */
  cutoutQuality: number | null;
  /**
   * Whether the cutout measurement bears on what this candidate would build.
   * False on a slot that shows the whole picture, where the matte is never
   * drawn — which is every slot in the corpus but one.
   */
  qualityApplies: boolean;
  /** Null when nothing about this candidate is measured. */
  backgroundCameAwayCleanly: boolean | null;
  /** What the matte failed, where the matte matters. Empty otherwise. */
  problems: string[];
  /** The raw verdict as the gate recorded it, kept as evidence. */
  gatePassed: boolean | null;
  gateFailures: string[];
  /** Words the OCR pass found that the slot's idea did not ask for. */
  unexpectedText: string[];
  chosen: boolean;
}

export interface ImageSlotView {
  id: string;
  start: number;
  end: number;
  idea: string;
  /** What the gate settled on, when every candidate agreed. */
  presentation: 'cutout' | 'card' | null;
  /**
   * Whether this slot renders its subject cut out of its background. One slot
   * in the corpus does; the rest show the whole generated picture inside the
   * frame, which is what makes the cutout metrics irrelevant to them.
   */
  rendersAsCutout: boolean;
  /**
   * True when the gate has nothing to say about this slot at all — it shows the
   * whole picture, so cutout quality is not a property of what gets built, and
   * no other check exists.
   */
  nothingIsMeasured: boolean;
  templateId: string | null;
  zoneId: string | null;
  candidates: CandidateView[];
  chosenCandidateId: string | null;
  /** The gate failures a deliberate choice overrode, when it overrode any. */
  overriddenFailures: string[];
  /**
   * How big this picture is on screen, and what limits it.
   *
   * **There is no choice of position to offer.** Images sit in the top-left
   * corner on every reel (the user's ruling, Block 7 session 9 and again in
   * session 34 after seeing them moved), so what the picker can honestly show
   * is the size and the reason for it — not a control over a decision nobody
   * makes per slot.
   */
  placedSidePx: number | null;
  placementLimit: string | null;
  /**
   * The candidate the builder would use right now. With nothing chosen it is
   * the first, which is a documented placeholder rather than a decision.
   */
  buildsWith: string | null;
  buildsWithReason: 'chosen' | 'first candidate, nothing chosen' | 'no candidates';
}

export interface ImagesView {
  reel: string;
  planPath: string;
  slots: ImageSlotView[];
  /** Present when the reel has slots but no candidates on any of them. */
  generationEstimateUsd: number | null;
  generationNote: string | null;
  /**
   * Cumulative money actually spent on this reel's images. The per-candidate
   * figures read 0 across the corpus because the plan was last written from a
   * cached run, and a cached run costs nothing; this is where the money is.
   */
  reelSpentUsd: number | null;
  source: {
    clientMode: string | null;
    clientModeVersion: number | null;
    stageStatus: string;
    cacheEntryId: string | null;
    cacheProvenance: string | null;
  };
  /**
   * The client's own pictures, offered beside the generated ones.
   *
   * **Nothing matches them to a moment.** Deciding that "the clinic exterior"
   * is what a slot wants is the judgement the image-prompt defect is about, and
   * that is Block 9 — he chooses, from pictures he described himself.
   */
  clientPictures: { id: string; path: string; description: string; label?: string }[];
  /**
   * Pictures attached to this reel alone.
   *
   * Offered beside the client's in the picker, and **listed first**, because
   * that is the order the matcher searches: a picture put on one video is the
   * more specific statement.
   */
  videoPictures: { id: string; path: string; description: string; label?: string }[];
  /** Every image is drawn in a card frame, whatever the gate said. */
  cardFrameForced: boolean;
}

function planFor(reelLabel: string): { planPath: string } {
  const reel = listReels().find((r) => r.label === reelLabel);
  if (reel === undefined) {
    throw new ImageViewError(`no reel labelled "${reelLabel}" in benchmarks/footage.json`);
  }
  if (reel.planPath === null || !existsSync(reel.planPath)) {
    throw new ImageViewError(
      `${reelLabel} has no edit plan yet. Run the pipeline before picking images.`,
    );
  }
  return { planPath: reel.planPath };
}

function candidateViewOf(candidate: ImageCandidate, slot: ImageSlot): CandidateView {
  const cutoutPath = candidate.cutoutPath ?? null;
  const asCutout = slot.presentation === 'cutout' && cutoutPath !== null;
  const renderedPath = asCutout ? (cutoutPath as string) : candidate.path;
  const verdict = verdictFor(slot, candidate);
  return {
    id: candidate.id,
    imagePath: candidate.path,
    imageExists: existsSync(candidate.path),
    cutoutPath,
    cutoutExists: cutoutPath !== null && existsSync(cutoutPath),
    renderedPath,
    renderedExists: existsSync(renderedPath),
    modelId: candidate.modelId ?? null,
    resolution: candidate.resolution ?? null,
    generatedAt: candidate.generatedAt ?? null,
    costUsd: candidate.costUsd ?? null,
    metrics: candidate.metrics ?? null,
    cutoutQuality: candidate.cutoutQuality ?? null,
    qualityApplies: verdict.applies,
    backgroundCameAwayCleanly: verdict.backgroundCameAwayCleanly,
    problems: verdict.problems,
    gatePassed: candidate.gate?.passed ?? null,
    gateFailures: candidate.gate?.failures ?? [],
    unexpectedText: candidate.textVerdict?.unexpected ?? [],
    chosen: slot.chosenCandidateId === candidate.id,
  };
}

function slotViewOf(slot: ImageSlot, placement: ReelSlotPlacement): ImageSlotView {
  const choice = buildChoiceFor(slot);
  return {
    id: slot.id,
    start: slot.start,
    end: slot.end,
    idea: slot.idea,
    presentation: slot.presentation,
    rendersAsCutout: rendersAsCutout(slot),
    nothingIsMeasured: nothingIsMeasured(slot),
    templateId: slot.templateId,
    zoneId: slot.zoneId,
    candidates: slot.candidates.map((c) => candidateViewOf(c, slot)),
    chosenCandidateId: slot.chosenCandidateId,
    overriddenFailures: slot.overriddenGateFailures ?? [],
    placedSidePx: Math.round(placement.rect.w * FRAME_WIDTH),
    placementLimit: placement.boundBy,
    buildsWith: choice.candidateId,
    buildsWithReason: choice.reason,
  };
}

async function viewOf(plan: EditPlan, planPath: string, reelLabel: string): Promise<ImagesView> {
  const faces = faceBoxesFor(plan);
  const placed = new Map(
    reelPlacements(
      plan.images.slots.map((slot) => ({
        id: slot.id,
        faceBox: faces.get(slot.id) ?? null,
        seed: `${plan.meta.id}:${slot.id}`,
      })),
    ).slots.map((p) => [p.id, p]),
  );
  const slots = plan.images.slots.flatMap((slot) => {
    const placement = placed.get(slot.id);
    return placement === undefined ? [] : [slotViewOf(slot, placement)];
  });
  const noCandidates = slots.length > 0 && slots.every((s) => s.candidates.length === 0);
  /*
   * Read from the client the plan records, not from the picker: the builder
   * reads the same one, and two sources here is two lists that can disagree.
   */
  let pictures: { id: string; path: string; description: string }[] = [];
  if (plan.clientMode !== null) {
    try {
      pictures = clientPictures(loadMode(plan.clientMode.id)).map((p) => ({ ...p }));
    } catch {
      pictures = [];
    }
  }

  /*
   * The estimate comes from the dry run rather than being computed again here.
   * Two implementations of what a stage costs is how the dry run and the runner
   * came to disagree on screen in the first place.
   */
  let generationEstimateUsd: number | null = null;
  let generationNote: string | null = null;
  if (noCandidates) {
    const modeId = plan.clientMode?.id;
    if (modeId === undefined) {
      generationNote = 'no client on the plan, so the cost of generating cannot be read';
    } else {
      try {
        const dry = await dryRun(reelLabel, modeId);
        const stage = dry.stages.find((s) => s.id === 'images');
        generationEstimateUsd = stage?.estimateUsd ?? null;
        generationNote = stage?.note ?? null;
      } catch (error) {
        generationNote = `the dry run could not price it: ${(error as Error).message}`;
      }
    }
  }

  return {
    reel: reelLabel,
    planPath,
    slots,
    generationEstimateUsd,
    generationNote,
    reelSpentUsd: plan.costs.spentByStage?.['images'] ?? null,
    clientPictures: pictures,
    videoPictures: (plan.pictures ?? []).map((p) => ({ ...p })),
    source: {
      clientMode: plan.clientMode?.id ?? null,
      clientModeVersion: plan.clientMode?.version ?? null,
      stageStatus: plan.pipeline.images.status,
      cacheEntryId: plan.pipeline.images.cacheEntryId ?? null,
      cacheProvenance: plan.pipeline.images.cacheProvenance ?? null,
    },
    // Block 7 session 9: `img_float` is forced on every slot, so every image is
    // framed whatever the gate settled on. `presentation` still selects which
    // file goes inside the frame — the cutout PNG or the generated image.
    cardFrameForced: true,
  };
}

export async function imagesView(reelLabel: string): Promise<ImagesView> {
  const { planPath } = planFor(reelLabel);
  return viewOf(await readEditPlan(planPath), planPath, reelLabel);
}

export async function imagesViewForPlan(planPath: string): Promise<ImagesView> {
  const label = listReels().find((r) => r.planPath === planPath)?.label ?? planPath;
  return viewOf(await readEditPlan(planPath), planPath, label);
}

/**
 * Choose a candidate for a slot, or clear the choice.
 *
 * `chosenCandidateId` is itself the human-flagged marker: `humanFlaggedItems`
 * reads it, and `PlanMergeBlockedError` refuses to discard a slot that carries
 * one. So a re-run cannot quietly lose the choice.
 *
 * **Choosing a rejected candidate is allowed and is recorded as an override**,
 * with the verdict it overrode, so the plan says the gate was disagreed with
 * rather than that it passed.
 */
export async function chooseCandidate(edit: {
  planPath: string;
  slotId: string;
  candidateId: string | null;
  /** One of the client's own pictures instead. Null clears that choice. */
  clientPictureId?: string | null;
}): Promise<ImagesView> {
  const plan = await readEditPlan(edit.planPath);
  const slot = plan.images.slots.find((s) => s.id === edit.slotId);
  if (slot === undefined) {
    throw new ImageViewError(`${edit.planPath} has no image slot ${edit.slotId}`);
  }

  /*
   * The two choices are exclusive: picking one of his own pictures clears the
   * generated one, and picking a generated one clears his. Leaving both set
   * would make the builder's precedence a thing nobody can see on screen.
   */
  if (edit.clientPictureId !== undefined) {
    if (edit.clientPictureId === null) delete slot.chosenClientPictureId;
    else {
      slot.chosenClientPictureId = edit.clientPictureId;
      slot.chosenCandidateId = null;
      delete slot.overriddenGateFailures;
    }
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(edit.planPath, plan);
    return await imagesViewForPlan(edit.planPath);
  }
  delete slot.chosenClientPictureId;

  if (edit.candidateId === null) {
    slot.chosenCandidateId = null;
    delete slot.overriddenGateFailures;
  } else {
    const candidate = slot.candidates.find((c) => c.id === edit.candidateId);
    if (candidate === undefined) {
      throw new ImageViewError(`${edit.slotId} has no candidate ${edit.candidateId}`);
    }
    slot.chosenCandidateId = candidate.id;
    const failures = candidate.gate?.failures ?? [];
    if (candidate.gate?.passed === false && failures.length > 0) {
      slot.overriddenGateFailures = [...failures];
    } else {
      delete slot.overriddenGateFailures;
    }
  }

  plan.meta.updatedAt = new Date().toISOString();
  await writeEditPlan(edit.planPath, plan);
  return imagesViewForPlan(edit.planPath);
}

void REPO_ROOT;

