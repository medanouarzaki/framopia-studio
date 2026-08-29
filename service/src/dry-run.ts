import { existsSync, readFileSync } from 'node:fs';
import { estimateImageRunCost, loadMode, type EntryProvenance } from '@framopia/core';
import { listReels } from './catalogue.js';
import { resolveKeywordEntry, resolveSlotEntry } from './analysis/resolve-entry.js';
import { imageSlotCountFor } from './analysis/count.js';
import { PIPELINE_STAGES } from './pipeline-stages.js';
import { resolveTranscriptionEntry } from './transcription/resolve-entry.js';
import { IMAGE_CACHE_STAGE } from './images/cache.js';
import { imageFingerprintInputs, imageFingerprintOf } from './images/fingerprint.js';
import { cacheEntryDir, CACHE_ROOT } from './transcription/cache.js';
import { DEFAULT_IMAGE_CONFIG } from './images/config.js';
import { watermarkEnabled } from './placement/watermark.js';

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
  /**
   * The client the plan itself records, and the version it was built at. Null
   * on a plan whose analysis has never run, which is the only honest answer:
   * nothing on disk says which client it belongs to.
   */
  planClientMode: { id: string; version: number } | null;
  /** Sum of the stages that would actually bill. */
  estimateUsd: number;
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
}

interface PlanLike {
  pipeline?: Record<string, PipelineRecord>;
  costs?: { spentUsd?: number };
  source?: { sha256?: string; durationS?: number };
  transcript?: { words?: PlanLikeWord[] };
  images?: { slots?: PlanLikeSlot[] };
  watermark?: { enabled?: boolean } | null;
  clientMode?: { id?: string; version?: number } | null;
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
  let planClientMode: { id: string; version: number } | null = null;
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
      planClientMode =
        typeof plan.clientMode?.id === 'string' && typeof plan.clientMode.version === 'number'
          ? { id: plan.clientMode.id, version: plan.clientMode.version }
          : null;
    } catch (error) {
      throw new DryRunError(`${reel.planPath} did not parse: ${(error as Error).message}`);
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
    const skipped = done;
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
    for (const slot of slots) {
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
    add(
      'images',
      hit === total ? 'exact' : 'none',
      null,
      `${hit} of ${total} candidate images are cached` +
        (hit === total
          ? '; a run would bill nothing'
          : `; a run would generate ${missing}, budgeted at most $${imagesCeilingUsd.toFixed(2)}`),
    );
  }

  add('zones', null, null, 'local computer vision; free whether or not it re-runs');

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
    planClientMode,
    estimateUsd: stages.reduce((sum, s) => sum + (s.estimateUsd ?? 0), 0),
    reusesOlderGuide: stages.some((s) => s.provenance === 'compatible'),
  };
}
