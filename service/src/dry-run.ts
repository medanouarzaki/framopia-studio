import { existsSync, readFileSync } from 'node:fs';
import { loadMode } from '@framopia/core';
import { listReels } from './catalogue.js';

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
  /** Sum of the pending stages' estimates. */
  estimateUsd: number;
}

export class DryRunError extends Error {}

interface PipelineRecord {
  status?: string;
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
  images: 1.55,
  zones: 0,
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

export function dryRun(reelLabel: string, modeId: string): DryRunPlan {
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
  if (reel.planPath !== null && existsSync(reel.planPath)) {
    try {
      const plan = JSON.parse(readFileSync(reel.planPath, 'utf8')) as {
        pipeline?: Record<string, PipelineRecord>;
        costs?: { spentUsd?: number };
      };
      pipeline = plan.pipeline ?? {};
      spentUsd = typeof plan.costs?.spentUsd === 'number' ? plan.costs.spentUsd : null;
    } catch (error) {
      throw new DryRunError(`${reel.planPath} did not parse: ${(error as Error).message}`);
    }
  }

  const stages: DryRunStage[] = Object.keys(STAGE_LABELS).map((id) => {
    const done = pipeline[id]?.status === 'done';
    return {
      id,
      label: STAGE_LABELS[id] as string,
      status: done ? 'done' : 'pending',
      estimateUsd: done ? null : (STAGE_ESTIMATES[id] ?? null),
      note: done ? 'already on the plan; a re-run reads the cache and bills nothing' : 'not run yet',
    };
  });

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
  };
}
