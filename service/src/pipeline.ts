import { existsSync } from 'node:fs';
import { readCosts } from '@framopia/core';
import { listReels } from './catalogue.js';
import { registerJobRunner } from './jobs.js';
import { readEditPlan } from './editplan/io.js';
import { PIPELINE_STAGES, type PipelineStageId } from './pipeline-stages.js';
import { transcribeVideo } from './transcription/job.js';
import { analyseKeywordsForPlan, planImageSlotsForPlan } from './analysis/job.js';
import { generateImagesForPlan } from './images/job.js';
import { resolveTranscriptionEntry } from './transcription/resolve-entry.js';
import { analyseFrames, assertFrameAnalysisAvailable, type FrameAnalysisProgress } from './frames/analyse.js';
import { applyLoudnessToPlan, ensureLoudness, ensureWatermarkFacts } from './build/measurements.js';
import type { EditPlan } from './editplan/types.js';

/**
 * The pipeline runner: one reel, one mode, four stages, driven from the panel.
 *
 * **The Edit Plan is the source of truth, not this function.** Each stage
 * writes its own result and its cache provenance into the plan as it finishes,
 * so a run that is interrupted — the service dies, the machine sleeps — resumes
 * from the plan rather than starting again and paying twice. A stage the plan
 * already records as `done` is skipped with its reason said out loud, never
 * silently.
 *
 * **Nothing here spends.** Every billable call is made by the stage functions,
 * which write their own ledger lines at the point of spend; this orchestrates
 * them and refuses one that would cross the ceiling. The ledger writer is
 * deliberately not imported here, and a test asserts it stays that way — a
 * wrapper that bills is how eight fabricated ledger lines were written in
 * Block 3.
 */
export type StageState = 'waiting' | 'running' | 'done' | 'skipped' | 'failed';

export interface StageReport {
  id: PipelineStageId;
  label: string;
  state: StageState;
  /** Why a stage was skipped, in the words the panel shows. */
  reason: string | null;
  /**
   * Where a long stage has got to, in the same words. Optional with a default
   * of null: a stage that finishes in one step has nothing to say here, and a
   * panel older than this reads it as absent rather than as empty.
   */
  detail?: string | null;
  /** What this stage actually billed, in dollars. Zero for a cache hit. */
  costUsd: number;
  /** The cache entry this stage resolved, when it resolved one. */
  cacheEntryId: string | null;
  cacheProvenance: 'exact' | 'compatible' | 'none' | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: PipelineStageError | null;
}

/** ARCHITECTURE §8: stage, cause, retry-ability, surfaced verbatim. */
export interface PipelineStageError {
  stage: PipelineStageId;
  cause: string;
  retryable: boolean;
}

export interface PipelineProgress {
  reel: string;
  modeId: string;
  planPath: string | null;
  stages: StageReport[];
  /** 0..1 across the four stages. */
  percent: number;
  /** What this run has billed so far, summed from the stages. */
  spentUsd: number;
  /** Cumulative spend recorded on the plan, which is what the alarm reads. */
  planSpentUsd: number | null;
  done: boolean;
  error: PipelineStageError | null;
}

export class PipelineError extends Error {
  constructor(readonly detail: PipelineStageError) {
    super(detail.cause);
    this.name = 'PipelineError';
  }
}

/**
 * The hard gate on a run, in dollars of ledger spend across every billable
 * stage.
 *
 * **This is not the $2.00 figure the panel shows.** That is ARCHITECTURE §6's
 * soft alarm — a number the user is warned about, per reel, cumulative. This is
 * a refusal: checked against the ledger before each billable request, so a run
 * cannot walk past it while it is happening. It sits above the alarm because a
 * reel legitimately crossing $2.00 should warn, not fail.
 *
 * CHOSEN, NOT MEASURED. A five-slot reel costs about $1.90 end to end
 * (transcription ~$0.17, keywords ~$0.18, slots ~$0.06, images ~$1.55), so this
 * leaves room for one regeneration and stops well short of a runaway.
 */
export const PIPELINE_CEILING_USD = 4;

/** Every ledger stage a pipeline run can append to. */
const BILLABLE_LEDGER_STAGES = [
  'transcribe-scribe',
  'transcribe-gemini-correction',
  'analysis-keywords',
  'analysis-slots',
  'images-generate',
];

export function ledgerSpendUsd(costsPath?: string): number {
  const totals = readCosts(costsPath);
  return BILLABLE_LEDGER_STAGES.reduce((sum, stage) => sum + (totals[stage] ?? 0), 0);
}

export class PipelineCeilingError extends Error {
  constructor(
    readonly stage: PipelineStageId,
    readonly spentUsd: number,
    readonly ceilingUsd: number,
  ) {
    super(
      `stopping before ${stage}: this run has already billed $${spentUsd.toFixed(4)} against ` +
        `a $${ceilingUsd.toFixed(2)} ceiling. The run is aborted, not truncated, and nothing ` +
        'was requested.',
    );
    this.name = 'PipelineCeilingError';
  }
}

export interface RunPipelineOptions {
  reel: string;
  modeId: string;
  /** Stages to run again even though the plan records them done. */
  redo?: PipelineStageId[];
  /**
   * Run only these stages; the rest are skipped without being looked at.
   *
   * Frame analysis is free while the three stages before it are not, so
   * "re-do the frame analysis" has to be expressible without walking past a
   * billable stage and hoping its cache still hits. Empty or absent means all
   * of them, which is what pressing Run does.
   */
  only?: PipelineStageId[];
  ceilingUsd?: number;
  costsPath?: string;
  cacheRoot?: string;
  onProgress?: (progress: PipelineProgress) => void;
  log?: (message: string) => void;
  now?: () => string;
  /** Injected so the whole runner can be exercised without an API key. */
  stages?: Partial<PipelineStageImpl>;
  /**
   * The check that everything the free last stage needs is present, run before
   * the first billable one. Injected so a test can prove it refuses *before*
   * anything spends, which is the whole point of moving it forward.
   */
  preflight?: () => void;
  /** Injected for the same reason: the measurements are disk and ffmpeg work. */
  measure?: (options: {
    planPath: string;
    videoPath: string;
    reelLabel: string;
    log: (message: string) => void;
  }) => Promise<void>;
}

export interface PipelineStageImpl {
  transcribe: typeof transcribeVideo;
  keywords: typeof analyseKeywordsForPlan;
  slots: typeof planImageSlotsForPlan;
  images: typeof generateImagesForPlan;
  zones: (options: FrameAnalysisStageOptions) => Promise<{ skipped: string | null }>;
}

/**
 * What the frame-analysis stage is given. It needs the video, not only the
 * plan: the frames come out of the file, and the plan is where the zones land.
 */
export interface FrameAnalysisStageOptions {
  reelLabel: string;
  videoPath: string;
  planPath: string;
  force: boolean;
  onProgress: (progress: FrameAnalysisProgress) => void;
  log: (message: string) => void;
}

function blankStages(): StageReport[] {
  return PIPELINE_STAGES.map((spec) => ({
    id: spec.id,
    label: spec.label,
    state: 'waiting' as StageState,
    reason: null,
    detail: null,
    costUsd: 0,
    cacheEntryId: null,
    cacheProvenance: null,
    startedAt: null,
    finishedAt: null,
    error: null,
  }));
}

/**
 * Frame analysis, driven.
 *
 * Block 8 shipped this stage reporting what the user should type instead of
 * doing it, so a video that had never been through the sidecar could not go
 * from footage to comp without leaving the panel — while image placement reads
 * exactly the face masks it produces. `analyseFrames` is the same sampling,
 * the same segmentation and the same zone derivation the three CLIs run; what
 * this adds is that the runner calls it.
 *
 * It is local and free, and it is the slowest stage that costs nothing.
 */
async function driveFrameAnalysis(
  options: FrameAnalysisStageOptions,
): Promise<{ skipped: string | null }> {
  const result = await analyseFrames({
    reelLabel: options.reelLabel,
    videoPath: options.videoPath,
    planPath: options.planPath,
    force: options.force,
    onProgress: options.onProgress,
    log: options.log,
  });
  if (result.skipped !== null) return { skipped: result.skipped };
  return { skipped: null };
}

/**
 * The two free measurements a build refuses without, taken as soon as there is
 * a plan to put them on.
 *
 * **Here rather than in a stage of their own**: together they are under three
 * seconds, and a fifth row in the panel for three seconds of ffmpeg would be a
 * story about the tool rather than about the video. `handoffs/block-8.md` §9
 * lists both as terminal-only and the user does not use a terminal.
 *
 * **In the transcription stage rather than later** because the level has to be
 * on the plan before the analysis stage derives SFX gains from it — otherwise
 * the sounds are levelled against nothing and the plan needs a second pass. It
 * runs on the skip path too: a plan transcribed before this existed has no
 * level on it, and skipping the stage must not mean skipping the measurement.
 */
async function takeBuildMeasurements(options: {
  planPath: string;
  videoPath: string;
  reelLabel: string;
  log: (message: string) => void;
}): Promise<void> {
  const { planPath, videoPath, reelLabel, log } = options;
  ensureWatermarkFacts({ log });
  const plan = await readEditPlan(planPath);
  const { record } = ensureLoudness({
    videoPath,
    reel: reelLabel,
    sourceSha256: plan.source.sha256,
    log,
  });
  await applyLoudnessToPlan({ planPath, record, log });
}

export async function runPipeline(options: RunPipelineOptions): Promise<PipelineProgress> {
  const {
    reel: reelLabel,
    modeId,
    redo = [],
    only = [],
    ceilingUsd = PIPELINE_CEILING_USD,
    costsPath,
    cacheRoot,
    onProgress = (): void => undefined,
    log = (): void => undefined,
    now = () => new Date().toISOString(),
    preflight = assertFrameAnalysisAvailable,
    measure = takeBuildMeasurements,
  } = options;

  const impl: PipelineStageImpl = {
    transcribe: transcribeVideo,
    keywords: analyseKeywordsForPlan,
    slots: planImageSlotsForPlan,
    images: generateImagesForPlan,
    zones: driveFrameAnalysis,
    ...options.stages,
  };

  const reel = listReels().find((r) => r.label === reelLabel);
  if (reel === undefined) {
    throw new PipelineError({
      stage: 'transcription',
      cause: `no reel labelled "${reelLabel}" in benchmarks/footage.json`,
      retryable: false,
    });
  }
  if (!reel.present) {
    throw new PipelineError({
      stage: 'transcription',
      cause: `${reelLabel} is catalogued but ${reel.videoPath} is not on this machine`,
      retryable: false,
    });
  }

  const stages = blankStages();
  const baselineUsd = ledgerSpendUsd(costsPath);
  let planPath: string | null = reel.planPath;

  const progress = (): PipelineProgress => {
    const settled = stages.filter((s) => s.state === 'done' || s.state === 'skipped').length;
    const failed = stages.find((s) => s.error !== null)?.error ?? null;
    return {
      reel: reelLabel,
      modeId,
      planPath,
      stages: stages.map((s) => ({ ...s })),
      percent: settled / stages.length,
      spentUsd: stages.reduce((sum, s) => sum + s.costUsd, 0),
      planSpentUsd: planSpent,
      done: settled === stages.length || failed !== null,
      error: failed,
    };
  };

  let planSpent: number | null = null;
  const readPlanSpend = async (): Promise<void> => {
    if (planPath === null || !existsSync(planPath)) return;
    try {
      const plan: EditPlan = await readEditPlan(planPath);
      planSpent = plan.costs.spentUsd ?? null;
    } catch {
      // A plan that will not open is the stage's problem to report, not this
      // bookkeeping read's.
    }
  };

  const stageOf = (id: PipelineStageId): StageReport =>
    stages.find((s) => s.id === id) as StageReport;

  /** Refuses before the request, never after: a run is aborted, not truncated. */
  const assertWithinCeiling = (id: PipelineStageId): void => {
    const spent = ledgerSpendUsd(costsPath) - baselineUsd;
    if (spent >= ceilingUsd) throw new PipelineCeilingError(id, spent, ceilingUsd);
  };

  const run = async <T>(
    id: PipelineStageId,
    body: () => Promise<{ costUsd?: number; reason?: string | null; skipped?: boolean } & T>,
  ): Promise<void> => {
    const stage = stageOf(id);
    stage.state = 'running';
    stage.startedAt = now();
    onProgress(progress());
    try {
      const result = await body();
      stage.state = result.skipped === true ? 'skipped' : 'done';
      stage.reason = result.reason ?? null;
      stage.detail = null;
      stage.costUsd = result.costUsd ?? 0;
      stage.finishedAt = now();
      await readPlanSpend();
      onProgress(progress());
    } catch (error) {
      stage.state = 'failed';
      stage.finishedAt = now();
      stage.error = asStageError(id, error);
      onProgress(progress());
      throw new PipelineError(stage.error);
    }
  };

  const planIfAny = async (): Promise<EditPlan | null> => {
    if (planPath === null || !existsSync(planPath)) return null;
    try {
      return await readEditPlan(planPath);
    } catch {
      return null;
    }
  };

  const wants = (id: PipelineStageId): boolean => redo.includes(id);
  const asked = (id: PipelineStageId): boolean => only.length === 0 || only.includes(id);

  /*
   * Frame analysis runs last, so everything it needs — ffmpeg, the CV venv, the
   * segmentation model — used to be discovered *after* three billable stages
   * had spent. A machine missing the venv paid for a transcript, keywords and
   * eight images and then could not finish. The stage keeps its position; only
   * the discovery moves.
   */
  preflight();

  await run('transcription', async () => {
    if (!asked('transcription')) return { skipped: true, reason: 'not part of this run' };
    const existing = await planIfAny();
    if (existing?.pipeline.transcription.status === 'done' && !wants('transcription')) {
      const entry = existing.pipeline.transcription;
      stageOf('transcription').cacheEntryId = entry.cacheEntryId ?? null;
      stageOf('transcription').cacheProvenance = entry.cacheProvenance ?? null;
      if (planPath !== null) {
        await measure({ planPath, videoPath: reel.videoPath, reelLabel, log });
      }
      return { skipped: true, reason: 'already on the plan' };
    }

    /*
     * Resolved before the stage runs so the reason can be reported before any
     * work: `compatible` means an entry made against an older orthography guide
     * is reused and **nothing is re-transcribed**. The stage resolves the same
     * way internally — one resolver, session 14 — so this cannot disagree with
     * what actually happens.
     */
    /*
     * The hash comes from the plan when there is one. Without a plan there is
     * nothing to resolve against yet, and the stage will hash the video itself
     * on the way to transcribing — a first run for this reel, which bills.
     */
    const entry =
      existing === null
        ? null
        : await resolveTranscriptionEntry({ videoSha256: existing.source.sha256, cacheRoot });
    stageOf('transcription').cacheEntryId = entry?.id ?? null;
    stageOf('transcription').cacheProvenance = entry?.provenance ?? null;
    if (entry === null || entry.provenance === 'none') assertWithinCeiling('transcription');
    log(`transcription: ${entry?.note ?? 'no plan yet; this reel has never been transcribed'}`);
    const result = await impl.transcribe({
      videoPath: reel.videoPath,
      cacheRoot,
      log,
    });
    planPath = result.planPath;
    await measure({ planPath, videoPath: reel.videoPath, reelLabel, log });
    return {
      costUsd: result.cached ? 0 : result.transcript.cost.totalUsd,
      reason: entry?.provenance === 'compatible' ? 'reusing an older guide' : null,
    };
  });

  await run('analysis', async () => {
    if (!asked('analysis')) return { skipped: true, reason: 'not part of this run' };
    const existing = await planIfAny();
    if (existing?.pipeline.analysis.status === 'done' && !wants('analysis')) {
      return { skipped: true, reason: 'already on the plan' };
    }
    if (planPath === null) return { skipped: true, reason: 'no plan to analyse' };

    assertWithinCeiling('analysis');
    const keywords = await impl.keywords({ planPath, modeId, keywordMode: 'auto', cacheRoot, log });
    assertWithinCeiling('analysis');
    const slots = await impl.slots({ planPath, modeId, cacheRoot, log });
    const cost =
      (keywords.cached ? 0 : keywords.analysis.costUsd) + (slots.cached ? 0 : slots.analysis.costUsd);
    return { costUsd: cost, reason: keywords.cached && slots.cached ? 'cached' : null };
  });

  await run('images', async () => {
    if (!asked('images')) return { skipped: true, reason: 'not part of this run' };
    const existing = await planIfAny();
    if (existing !== null && existing.images.slots.length === 0) {
      return { skipped: true, reason: 'no image slots on the plan' };
    }
    /*
     * **`pipeline.images` says `done` before a single picture exists.** The
     * *slot* stage writes that record when it plans the slots, so a plan can
     * hold slots, zero candidates and a done image stage at once — and reading
     * the record alone meant a first run on a new video planned eleven slots,
     * skipped the pictures with "already on the plan", and reported every stage
     * green. The user's reel only has its pictures because he pressed the
     * panel's *Make the pictures*, which sends `redo`.
     *
     * The pictures decide, not the record: a stage that has produced no
     * candidate has not been done. Block 10 session 32 made the dry run read it
     * the same way. The double-write itself is untouched and still open.
     */
    const illustrated =
      existing !== null && existing.images.slots.every((slot) => slot.candidates.length > 0);
    if (existing?.pipeline.images.status === 'done' && illustrated && !wants('images')) {
      return { skipped: true, reason: 'already on the plan' };
    }
    if (planPath === null) return { skipped: true, reason: 'no plan to illustrate' };

    assertWithinCeiling('images');
    /*
     * The run's ceiling is the image stage's ceiling. Without this the stage
     * falls back to its own DEFAULT_CEILING_USD, so a caller that asked for a
     * tighter bound got $3 — and Block 10 session 7 had to inject the real
     * stage function through the `stages` hook to make an authorised figure
     * bind. The stage re-reads the ledger before every candidate, so passing it
     * down is what turns one pre-flight check into twelve.
     */
    const result = await impl.images({ planPath, modeId, cacheRoot, costsPath, log, ceilingUsd });
    return {
      costUsd: result.totalUsd,
      reason: result.billedImages === 0 ? 'cached' : null,
    };
  });

  await run('zones', async () => {
    if (!asked('zones')) return { skipped: true, reason: 'not part of this run' };
    if (planPath === null) return { skipped: true, reason: 'no plan' };
    const { skipped } = await impl.zones({
      reelLabel,
      videoPath: reel.videoPath,
      planPath,
      force: wants('zones'),
      onProgress: (frameProgress) => {
        stageOf('zones').detail = frameProgress.message;
        onProgress(progress());
      },
      log,
    });
    return skipped === null ? {} : { skipped: true, reason: skipped };
  });

  await readPlanSpend();
  return progress();
}

/**
 * Anything a stage threw, as §8's structured error. Retry-ability is decided
 * from the error rather than assumed: a ceiling refusal and a missing file are
 * not worth retrying, and a 5xx or a socket failure is.
 */
export function asStageError(stage: PipelineStageId, error: unknown): PipelineStageError {
  const cause = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const terminal =
    name === 'PipelineCeilingError' ||
    name === 'ImageCeilingReachedError' ||
    name === 'ImageBudgetExceededError' ||
    name === 'PlanMergeBlockedError' ||
    name === 'SlotsReplaceBlockedError' ||
    name === 'ImagesReplaceBlockedError' ||
    name === 'CacheEntrySelectionError' ||
    /ENOENT|not found|does not exist|no such file/i.test(cause);
  const transient = /\b(5\d\d|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed)\b/i.test(
    cause,
  );
  return { stage, cause, retryable: !terminal && transient };
}

export const PIPELINE_JOB_TYPE = 'pipeline';

/**
 * ARCHITECTURE §4: the panel posts a job and polls it. The runner's progress is
 * written onto the job as it goes, so a poller sees stages finish rather than a
 * number creeping up with nothing behind it — and so the user can leave step 1
 * and come back without the run being lost. **The job lives here; the panel is
 * a viewer.**
 */
registerJobRunner(PIPELINE_JOB_TYPE, async (params, job) => {
  const reel = params?.['reel'];
  const modeId = params?.['mode'];
  if (typeof reel !== 'string' || reel.length === 0) {
    throw new Error('pipeline job requires a reel');
  }
  if (typeof modeId !== 'string' || modeId.length === 0) {
    throw new Error('pipeline job requires a mode');
  }
  const stageIds = (raw: unknown): PipelineStageId[] =>
    Array.isArray(raw)
      ? raw.filter((id): id is PipelineStageId => PIPELINE_STAGES.some((s) => s.id === id))
      : [];
  const redo = stageIds(params?.['redo']);
  const only = stageIds(params?.['only']);

  return await runPipeline({
    reel,
    modeId,
    redo,
    only,
    onProgress: (progress) => {
      job.progress = progress.percent;
      job.detail = progress;
    },
  });
});
