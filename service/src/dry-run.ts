import { existsSync, readFileSync } from 'node:fs';
import { estimateImageRunCost, loadMode, type EntryProvenance } from '@framopia/core';
import { listReels } from './catalogue.js';
import { resolveKeywordEntry, resolveSlotEntry } from './analysis/resolve-entry.js';
import { resolveTranscriptionEntry } from './transcription/resolve-entry.js';
import { IMAGE_CACHE_STAGE } from './images/cache.js';
import { imageFingerprintInputs, imageFingerprintOf } from './images/fingerprint.js';
import { cacheEntryDir, CACHE_ROOT } from './transcription/cache.js';
import { DEFAULT_IMAGE_CONFIG } from './images/config.js';

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
 * The keys are the plan's own `pipeline` keys, read from a real plan rather
 * than guessed: transcription, analysis, images, zones, build. A label that
 * named a stage the plan does not record would report every reel as unrun.
 */
const STAGE_LABELS: Record<string, string> = {
  transcription: 'Transcribe and correct',
  analysis: 'Keywords and image slots',
  images: 'Generate images',
  zones: 'Frame analysis (local, free)',
};

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
  if (reel.planPath !== null && existsSync(reel.planPath)) {
    try {
      const plan = JSON.parse(readFileSync(reel.planPath, 'utf8')) as PlanLike;
      pipeline = plan.pipeline ?? {};
      spentUsd = typeof plan.costs?.spentUsd === 'number' ? plan.costs.spentUsd : null;
      sha = plan.source?.sha256 ?? '';
      durationS = plan.source?.durationS ?? 0;
      words = plan.transcript?.words ?? [];
      slots = plan.images?.slots ?? [];
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
    const bills = provenance === 'none';
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
      note,
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
    add('images', null, null, 'no image slots planned yet; nothing to look up');
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
    const perImage =
      estimateImageRunCost({
        modelId: DEFAULT_IMAGE_CONFIG.modelId,
        resolution: DEFAULT_IMAGE_CONFIG.resolution,
        slots: 1,
        candidatesPerSlot: 1,
      }).perImageUsd;
    imagesCeilingUsd = missing * perImage;
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
    estimateUsd: stages.reduce((sum, s) => sum + (s.estimateUsd ?? 0), 0),
    reusesOlderGuide: stages.some((s) => s.provenance === 'compatible'),
  };
}
