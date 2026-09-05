import { existsSync, readFileSync } from 'node:fs';
import { estimateImageRunCost, loadMode, type EntryProvenance } from '@framopia/core';
import { listReels } from './catalogue.js';
import { knownVideos } from './videos.js';
import { resolveKeywordEntry, resolveSlotEntry } from './analysis/resolve-entry.js';
import { imageSlotCountFor } from './analysis/count.js';
import { PIPELINE_STAGES, WORDS_STAGE_IDS, type PipelineStageId } from './pipeline-stages.js';
import { resolveTranscriptionEntry } from './transcription/resolve-entry.js';
import { IMAGE_CACHE_STAGE } from './images/cache.js';
import { imageFingerprintInputs, imageFingerprintOf } from './images/fingerprint.js';
import { cacheEntryDir, CACHE_ROOT } from './transcription/cache.js';
import { DEFAULT_IMAGE_CONFIG } from './images/config.js';
import { watermarkEnabled, watermarkSizeOf } from './placement/watermark.js';
import { WATERMARK_SIZES, type WatermarkSize } from './editplan/types.js';
import { slotNeedsGenerating, slotsNeedingGeneration } from './editplan/slot-fill.js';
import { FRAME_WIDTH, watermarkWidthFraction } from './placement/constants.js';

/**
 * What a run *would* do, before any of it is paid for.
 *
 * PROJECT_SPEC §5 puts a finished reel at $0.50–2.00 and ARCHITECTURE §6 puts
 * a soft alarm at $2.00, so the user is entitled to see which stages are
 * already cached and what the rest would cost before he presses anything. This
 * is the screen he reads to decide, and it is worth having before the thing
 * that spends.
 *
 * **It runs nothing and bills nothing.** Every figure comes off disk: the
 * plan's own pipeline record for what is done, and the pricing constants for
 * what is not.
 */
export interface DryRunStage {
  id: string;
  label: string;
  /** `done` when the plan records it complete, `pending` otherwise. */
  status: 'done' | 'pending';
  /**
   * How the cache answers for this stage **right now**, not what the plan
   * remembers. `none` means a run bills, whatever the plan says.
   */
  provenance: EntryProvenance | null;
  /** The entry that would be reused, when there is one. */
  entryId: string | null;
  /** Null when the stage costs nothing or nothing can be estimated for it. */
  estimateUsd: number | null;
  /**
   * **What a run will actually do with this stage**, which is the question the
   * user is asking and the one the panel must render.
   *
   * `provenance` and `estimateUsd` between them cannot answer it: a stage the
   * plan records as done is skipped whatever its cache says, and the panel used
   * to infer "to run" from a null estimate — so `vitasilk`'s analysis read "to
   * run" in the cost block and "skipped — already on the plan" in the run
   * beneath it. Saying it here rather than leaving the panel to work it out is
   * what stops the two disagreeing.
   */
  action: 'skip' | 'reuse' | 'run';
  note: string;
}

export interface DryRunPlan {
  reel: string;
  videoPath: string;
  modeId: string;
  modeName: string;
  modeVersion: number;
  planPath: string | null;
  /** Cumulative spend already on this reel. */
  spentUsd: number | null;
  stages: DryRunStage[];
  /** Whether this reel is built with the intro watermark. */
  watermark: boolean;
  /** How large the mark is drawn. Absent on the plan means the default. */
  watermarkSize: WatermarkSize;
  /**
   * What each size is in source pixels across, so the panel can label the
   * choice without doing placement arithmetic of its own.
   */
  watermarkWidthsPx: Record<WatermarkSize, number>;
  /**
   * The client the plan itself records, and the version it was built at. Null
   * on a plan whose analysis has never run, which is the only honest answer:
   * nothing on disk says which client it belongs to.
   */
  planClientMode: { id: string; version: number } | null;
  /**
   * The sentence to show when this reel has no client at all, and null when it
   * has one.
   *
   * A build refuses in that state — a client mode is what decides the type and
   * the colour, and without one every card silently keeps whatever the template
   * carries. Saying so here means it is read before a run starts rather than
   * discovered partway through one.
   */
  buildBlockedBecause: string | null;
  /** Sum of the stages that would actually bill. */
  estimateUsd: number;
  /**
   * The same figure split the way the money actually splits: what the words
   * cost and what the pictures cost.
   *
   * It is here rather than in the panel because the panel is a view — which
   * stages are "the words" is `WORDS_STAGE_IDS`, and a second copy of that in a
   * React bundle is a second place for it to drift.
   */
  wordsUsd: number;
  picturesUsd: number;
  /**
   * Which stages that figure covers, so the panel can ask for exactly them
   * rather than holding its own copy of what "the words" means.
   */
  wordsStages: string[];
  /**
   * Whether the subtitles exist yet.
   *
   * **The pictures are made from the subtitles**, so the second of the two run
   * buttons cannot do anything until this is true, and the panel has to be able
   * to say so rather than offering a control that would fail. It is computed
   * here for the reason `wordsUsd` is: which stages are "the words" is
   * `WORDS_STAGE_IDS`, and a second copy of that in a React bundle is a second
   * place for it to drift.
   *
   * A cost of zero is not the same answer: the words can cost nothing because
   * they are cached and still never have been written onto this plan.
   */
  wordsDone: boolean;
  /** True when any stage resolves `compatible`; the panel says so plainly. */
  reusesOlderGuide: boolean;
}

export class DryRunError extends Error {}

interface PipelineRecord {
  status?: string;
}

interface PlanLikeWord {
  id: string;
  text: string;
  removed: boolean;
  start: number;
  end: number;
}

interface PlanLikeSlot {
  prompt: string;
  negativePrompt: string;
  /** Empty on a slot that has been planned and never illustrated. */
  candidates?: unknown[];
  /** Set on a slot one of the client's own pictures fills, which never bills. */
  chosenClientPictureId?: string;
}

interface PlanLike {
  pipeline?: Record<string, PipelineRecord>;
  costs?: { spentUsd?: number };
  source?: { sha256?: string; durationS?: number };
  transcript?: { words?: PlanLikeWord[] };
  images?: { slots?: PlanLikeSlot[] };
  watermark?: { enabled?: boolean; size?: WatermarkSize } | null;
  clientMode?: { id?: string; version?: number } | null;
  clientSnapshot?: { id?: string } | null;
}

/**
 * Pessimistic on purpose, on the `IMAGE_COST_MULTIPLIER` precedent: this feeds
 * a decision about money, and an estimate that reads low is worse than one
 * that reads high. These are order-of-magnitude figures from the recorded
 * actuals in CLAUDE.md, not a model of the pricing table — the exact cost is
 * whatever `usageMetadata` says after the fact, and nothing here pretends
 * otherwise.
 */
const STAGE_ESTIMATES: Record<string, number> = {
  transcription: 0.17,
  analysis: 0.18,
  zones: 0,
  // `images` is deliberately absent: it is computed per reel from that reel's
  // own slot count, because a flat figure is wrong for every reel but one.
};

/**
 * The labels come from the shared stage declaration, not a second copy here.
 * The dry run and the runner are two views of the same work, and a user who
 * reads an estimate and then watches differently-named stages go past has been
 * told two stories.
 */
const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.id, s.label]),
);

/** The gate's per-image budget: published rate x IMAGE_COST_MULTIPLIER. */
function perImageCeilingUsd(): number {
  return estimateImageRunCost({
    modelId: DEFAULT_IMAGE_CONFIG.modelId,
    resolution: DEFAULT_IMAGE_CONFIG.resolution,
    slots: 1,
    candidatesPerSlot: 1,
  }).perImageUsd;
}

export async function dryRun(reelLabel: string, modeId: string): Promise<DryRunPlan> {
  const reel = listReels().find((r) => r.label === reelLabel);
  if (reel === undefined) {
    throw new DryRunError(`no reel labelled "${reelLabel}" in benchmarks/footage.json`);
  }
  if (!reel.present) {
    throw new DryRunError(`${reelLabel} is catalogued but ${reel.videoPath} is not on this machine`);
  }

  let mode;
  try {
    mode = loadMode(modeId);
  } catch (error) {
    throw new DryRunError(`mode "${modeId}" did not load: ${(error as Error).message}`);
  }

  let pipeline: Record<string, PipelineRecord> = {};
  let spentUsd: number | null = null;
  let sha = '';
  let durationS = 0;
  let words: PlanLikeWord[] = [];
  let slots: PlanLikeSlot[] = [];
  let watermark = true;
  let watermarkSize: WatermarkSize = watermarkSizeOf(null);
  let planClientMode: { id: string; version: number } | null = null;
  let hasClientSnapshot = false;
  if (reel.planPath !== null && existsSync(reel.planPath)) {
    try {
      const plan = JSON.parse(readFileSync(reel.planPath, 'utf8')) as PlanLike;
      pipeline = plan.pipeline ?? {};
      spentUsd = typeof plan.costs?.spentUsd === 'number' ? plan.costs.spentUsd : null;
      sha = plan.source?.sha256 ?? '';
      durationS = plan.source?.durationS ?? 0;
      words = plan.transcript?.words ?? [];
      slots = plan.images?.slots ?? [];
      watermark = watermarkEnabled(plan.watermark ?? null);
      watermarkSize = watermarkSizeOf(plan.watermark ?? null);
      planClientMode =
        typeof plan.clientMode?.id === 'string' && typeof plan.clientMode.version === 'number'
          ? { id: plan.clientMode.id, version: plan.clientMode.version }
          : null;
      hasClientSnapshot = typeof plan.clientSnapshot?.id === 'string';
    } catch (error) {
      throw new DryRunError(`${reel.planPath} did not parse: ${(error as Error).message}`);
    }
  }
  /*
   * A video opened through Browse has no plan until its first run, and the
   * question "what will pressing Run cost" is exactly the one being asked
   * *before* that run. The hash and the duration were read from the file when
   * it was opened, so both are on hand and the whole run can be priced.
   *
   * The old behaviour threw, which put an error where the cost belonged and
   * left the panel with nothing to say — and the user reading it had already
   * been told his video did not exist.
   */
  if (sha === '') {
    const known = knownVideos().find((v) => v.path === reel.videoPath);
    if (known !== undefined) {
      sha = known.sha256;
      durationS = known.durationS;
    }
  }
  if (sha === '') {
    throw new DryRunError(
      `${reelLabel} has no edit plan yet, so nothing can be looked up in the cache by video hash. ` +
        'A first run transcribes and bills.',
    );
  }

  const stages: DryRunStage[] = [];
  let imagesCeilingUsd: number | null = null;
  const add = (
    id: string,
    provenance: EntryProvenance | null,
    entryId: string | null,
    note: string,
    /**
     * Overrides "the plan says done, so a run skips it" for the one stage where
     * that reading is false.
     */
    skippedOverride?: boolean,
  ): void => {
    const done = pipeline[id]?.status === 'done';
    /*
     * **A stage the plan already records as done will be skipped by a run**, so
     * it cannot bill however its cache resolves. Pricing it anyway was the
     * mirror of the defect session 14 fixed: a screen that answers "what would
     * this stage cost" when the user is asking "what will happen if I press
     * Run". `vitasilk` read $0.18 for analysis — its keyword entry is at an
     * older analysis prompt version — while a run skips the stage entirely.
     *
     * The cache state is still reported, because redoing the stage deliberately
     * *would* bill and the note is where that is said.
     */
    const skipped = skippedOverride ?? done;
    const bills = provenance === 'none' && !skipped;
    const estimateUsd = !bills
      ? null
      : id === 'images' && imagesCeilingUsd !== null
        ? imagesCeilingUsd
        : (STAGE_ESTIMATES[id] ?? null);
    stages.push({
      id,
      label: STAGE_LABELS[id] as string,
      status: done ? 'done' : 'pending',
      provenance,
      entryId,
      estimateUsd,
      action: skipped
        ? 'skip'
        : provenance === 'exact' || provenance === 'compatible'
          ? 'reuse'
          : 'run',
      note: skipped ? `${note.replace(/\.$/, '')}. Already on the plan, so a run skips it` : note,
    });
  };

  const transcription = await resolveTranscriptionEntry({ videoSha256: sha });
  add('transcription', transcription.provenance, transcription.id, transcription.note);

  if (words.length === 0) {
    const why = 'no transcript on the plan yet, so the analysis cache cannot be addressed';
    add('analysis', 'none', null, `${why}; a run would transcribe first, then bill for analysis`);
  } else {
    const keyword = resolveKeywordEntry({ videoSha256: sha, mode, words, durationS });
    const slot = resolveSlotEntry({ videoSha256: sha, mode, words, durationS });
    const provenance: EntryProvenance =
      keyword.provenance === 'exact' && slot.provenance === 'exact' ? 'exact' : 'none';
    add(
      'analysis',
      provenance,
      [keyword.id, slot.id].filter((x): x is string => x !== null).join(' + ') || null,
      `keywords: ${keyword.note}. Image slots: ${slot.note}`,
    );
  }

  if (slots.length === 0) {
    /*
     * **A stage that has never run still costs money**, and reading zero for it
     * was the same defect session 14 fixed one stage earlier: a cost screen
     * honest only about work someone already did. `ground-truth`, `test-2` and
     * `test-3` have no slots planned, so the uncached-candidate count is zero
     * and they read about $0.18 — while a real Run would plan slots *and*
     * generate ten or twelve images.
     *
     * The count comes from ARCHITECTURE §5.3's density, through the same
     * `imageSlotCountFor` the planner uses, so the estimate and the planner
     * cannot drift. It is labelled as a **planned** count rather than a known
     * one, because nothing has decided these slots yet.
     */
    /*
     * Images can only bill if there will be slots to fill. There are none on
     * the plan, so the only way any appear is the analysis stage running and
     * planning them — and if analysis is already done and planned none, a run
     * will never reach an image call at all. `test-2` read $1.45 for images
     * while a run skips both stages.
     */
    if (pipeline['analysis']?.status === 'done') {
      add(
        'images',
        null,
        null,
        'no image slots on the plan, and analysis has already run without planning any',
      );
    } else {
      const planned = imageSlotCountFor(durationS, mode.imageSlotsPer30s);
      const images = planned * DEFAULT_IMAGE_CONFIG.candidatesPerSlot;
      imagesCeilingUsd = images * perImageCeilingUsd();
      add(
        'images',
        'none',
        null,
        `no image slots planned yet; a run would plan about ${planned} for a ` +
          `${durationS.toFixed(1)}s reel and generate ${images} candidates, ` +
          `budgeted at most $${imagesCeilingUsd.toFixed(2)}`,
      );
    }
  } else {
    let hit = 0;
    let total = 0;
    /*
     * A slot the client's own picture already fills is never generated, so it
     * cannot cost anything and must not be quoted for. The cost screen is the
     * number he decides on; quoting money for a picture nobody will buy is the
     * same defect as quoting nothing for a stage that will run.
     */
    const billable = slotsNeedingGeneration(slots);
    const filled = slots.length - billable.length;
    for (const slot of billable) {
      for (let index = 0; index < DEFAULT_IMAGE_CONFIG.candidatesPerSlot; index += 1) {
        total += 1;
        const fingerprint = imageFingerprintOf(
          imageFingerprintInputs({
            prompt: slot.prompt,
            negativePrompt: slot.negativePrompt,
            modelId: DEFAULT_IMAGE_CONFIG.modelId,
            resolution: DEFAULT_IMAGE_CONFIG.resolution,
            aspectRatio: DEFAULT_IMAGE_CONFIG.aspectRatio,
            candidateIndex: index,
            mode,
          }),
        );
        if (existsSync(cacheEntryDir(sha, IMAGE_CACHE_STAGE, fingerprint, CACHE_ROOT))) hit += 1;
      }
    }
    /*
     * Computed from this reel's own slots, not a flat constant. It used to be
     * a fixed $1.55 — `vitasilk`'s five-slot actual — reported for every reel
     * whatever its slot count, so `test-1`'s four slots read $1.55 when the
     * budget for eight images is $1.45 and the expected actual is $1.24.
     *
     * The figure is the **budgeted ceiling**: published rate times
     * IMAGE_COST_MULTIPLIER, the same pessimistic gate the generation stage
     * refuses to start above. It reads high on purpose, and the note says so
     * rather than leaving the user to guess whether it is a forecast.
     */
    const missing = total - hit;
    imagesCeilingUsd = missing * perImageCeilingUsd();
    /*
     * **`pipeline.images` says `done` before a single picture exists.** The
     * *slot* stage writes that record when it plans the slots, so a plan can
     * hold six slots, zero candidates and a `done` image stage at the same
     * time — which is exactly what a words-only run leaves behind, and what
     * `ground-truth` has held since Block 10 session 6.
     *
     * Read the record alone and this stage reports `skip` and prices at
     * nothing: `ground-truth` read **$0.00 total** while owing $2.17 of
     * pictures, its own note saying "0 of 12 candidate images are cached… a
     * run would generate 12" and "already on the plan, so a run skips it" in
     * one sentence. So the pictures decide, not the record: a stage that has
     * produced no candidate has not been done.
     *
     * The double-write itself is untouched — that is a change to what the slot
     * stage records, and it is reported rather than made here.
     */
    const illustrated = slots.every(
      (slot) => (slot.candidates ?? []).length > 0 || !slotNeedsGenerating(slot),
    );
    const ownPictures =
      filled === 0 ? '' : `${filled} slot(s) use one of the client's own pictures and cost nothing. `;
    add(
      'images',
      hit === total ? 'exact' : 'none',
      null,
      `${ownPictures}${hit} of ${total} candidate images are cached` +
        (hit === total
          ? '; a run would bill nothing'
          : `; a run would generate ${missing}, budgeted at most $${imagesCeilingUsd.toFixed(2)}`),
      illustrated ? undefined : false,
    );
  }

  add(
    'zones',
    null,
    null,
    'free, and done on this machine. It can take a few minutes the first time for a video.',
  );

  return {
    reel: reel.label,
    videoPath: reel.videoPath,
    modeId: mode.id,
    modeName: mode.name,
    modeVersion: mode.version,
    planPath: reel.planPath,
    spentUsd,
    stages,
    watermark,
    watermarkSize,
    watermarkWidthsPx: Object.fromEntries(
      WATERMARK_SIZES.map((size) => [size, Math.round(watermarkWidthFraction(size) * FRAME_WIDTH)]),
    ) as Record<WatermarkSize, number>,
    planClientMode,
    buildBlockedBecause:
      planClientMode === null && !hasClientSnapshot
        ? 'This video has no client yet, so a build would have nothing to take its type and ' +
          'colours from. Choose the client for this video before building.'
        : null,
    estimateUsd: stages.reduce((sum, s) => sum + (s.estimateUsd ?? 0), 0),
    wordsUsd: stages
      .filter((s) => WORDS_STAGE_IDS.includes(s.id as PipelineStageId))
      .reduce((sum, s) => sum + (s.estimateUsd ?? 0), 0),
    picturesUsd: stages
      .filter((s) => s.id === 'images')
      .reduce((sum, s) => sum + (s.estimateUsd ?? 0), 0),
    wordsStages: [...WORDS_STAGE_IDS],
    wordsDone: stages
      .filter((s) => WORDS_STAGE_IDS.includes(s.id as PipelineStageId))
      .every((s) => s.status === 'done'),
    reusesOlderGuide: stages.some((s) => s.provenance === 'compatible'),
  };
}
