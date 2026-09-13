import { asStageError, runPipeline, type PipelineStageError } from './pipeline.js';
import { registerJobRunner } from './jobs.js';
import { PICTURES_STAGE_IDS, WORDS_STAGE_IDS, type PipelineStageId } from './pipeline-stages.js';

/**
 * **The queue runs everything that costs money and takes time, and stops before
 * building.**
 *
 * Mohamed's ruling of 2026-09-13. He asked for parallelism; the measured limits
 * say otherwise — Google's Tier 1 cap is $10 per rolling ten minutes, the
 * face-mask step is his own CPU, and After Effects runs one script at a time. He
 * accepted that what he actually wants is not videos running at once but **not
 * sitting and waiting**, which is a queue.
 *
 * Block 13 session 94 measured what the waiting is: on `sora-4` and `sora-5`,
 * **25.8 and 25.6 minutes** from the transcript landing to the masks being made,
 * of which he is doing something for perhaps thirty seconds of it. Five videos is
 * two hours of a person watching a progress bar.
 *
 * **It does not build.** Building is free, takes three seconds, and is where he
 * looks at what was made — so it stays with him, by his ruling.
 */
export const QUEUE_STAGE_IDS: readonly PipelineStageId[] = [
  ...WORDS_STAGE_IDS,
  ...PICTURES_STAGE_IDS,
];

export interface QueueItem {
  /** The reel label, exactly as one video carries it today. */
  reel: string;
  /** Its client. A queue never guesses one; each item says. */
  modeId: string;
}

export type QueueOutcome = 'done' | 'failed' | 'stopped' | 'not-reached';

export interface QueueResultItem extends QueueItem {
  outcome: QueueOutcome;
  /** What it cost, as the run reported it. Zero for anything that did not run. */
  spentUsd: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** Present only on `failed`, and always names the stage. */
  error?: PipelineStageError;
  /** How many times the video was attempted; 1 unless a retry was allowed. */
  attempts: number;
}

export interface QueueProgress {
  items: QueueResultItem[];
  /** Index of the item running now, or null between items and at the end. */
  runningIndex: number | null;
  spentUsd: number;
  done: boolean;
  stopped: boolean;
}

/**
 * **Two attempts, and only for a failure that is worth repeating.**
 *
 * `sora-4` hit `fetch failed` mid-run on 2026-09-12 — the network, not the tool,
 * and the same shape Block 12 session 84 saw. `asStageError` already classifies
 * that as retryable and a ceiling refusal or a missing file as not, so this
 * reuses that judgement rather than inventing a second one.
 *
 * The bound is about money. Every retry is a call nobody quoted for, and a queue
 * is exactly where an unbounded one would do the most damage: five videos each
 * retrying forever is a bill nobody agreed to. One retry is a worst case that can
 * be stated in advance — and what keeps the queue safe is not the retry but that
 * **a video which fails after its attempts is recorded and the queue moves on.**
 */
export const QUEUE_ATTEMPTS = 2;

export interface RunQueueOptions {
  items: readonly QueueItem[];
  /**
   * Runs one video. Injected so the queue can be proved without spending: the
   * money boundary is inside this, never inside the queue.
   */
  runOne: (item: QueueItem, attempt: number) => Promise<{ spentUsd: number }>;
  /** Asked before each video and between attempts. True stops the queue. */
  shouldStop?: () => boolean;
  onProgress?: (progress: QueueProgress) => void;
  now?: () => string;
}

/**
 * Runs a list of videos one at a time, in order, and reports what became of each.
 *
 * **A video that fails does not stop the queue.** It is recorded with the stage
 * that failed and why, and the next one starts. Block 12 session 91 is the reason
 * this is stated as a rule rather than left to the runner: a stage failed there
 * while the run reported `done`, and a queue that did the same would hand back
 * five videos claiming success with nothing behind them.
 *
 * **One at a time.** Nothing here runs two videos at once, deliberately and by
 * his ruling; that is a much larger change and is not this one.
 */
export async function runQueue(options: RunQueueOptions): Promise<QueueProgress> {
  const { items, runOne, shouldStop = () => false, onProgress = () => undefined } = options;
  const now = options.now ?? ((): string => new Date().toISOString());

  const results: QueueResultItem[] = items.map((item) => ({
    ...item,
    outcome: 'not-reached',
    spentUsd: 0,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
  }));

  let spentUsd = 0;
  let stopped = false;

  const progress = (runningIndex: number | null, done = false): QueueProgress => ({
    items: results.map((r) => ({ ...r })),
    runningIndex,
    spentUsd,
    done,
    stopped,
  });

  onProgress(progress(null));

  for (const [index, item] of items.entries()) {
    const record = results[index] as QueueResultItem;

    /*
     * Asked before the video starts rather than during it. A stop mid-video would
     * abandon a stage that has already been paid for, and **what has been paid
     * for is kept** — so the queue finishes what it is holding and stops cleanly
     * at the boundary.
     */
    if (shouldStop()) {
      stopped = true;
      record.outcome = 'stopped';
      for (const later of results.slice(index + 1)) later.outcome = 'not-reached';
      break;
    }

    record.startedAt = now();
    record.outcome = 'not-reached';
    onProgress(progress(index));

    for (let attempt = 1; attempt <= QUEUE_ATTEMPTS; attempt += 1) {
      record.attempts = attempt;
      try {
        const { spentUsd: cost } = await runOne(item, attempt);
        record.spentUsd += cost;
        spentUsd += cost;
        record.outcome = 'done';
        delete record.error;
        break;
      } catch (error) {
        const stageError = asStageError('images', error);
        record.error = stageError;
        record.outcome = 'failed';
        /*
         * Only a failure the classifier calls worth repeating gets a second go,
         * and only if there is one left. A ceiling refusal retried is a refusal
         * twice; a missing file retried is a missing file twice.
         */
        const worthRepeating = stageError.retryable && attempt < QUEUE_ATTEMPTS;
        if (!worthRepeating) break;
        if (shouldStop()) {
          stopped = true;
          break;
        }
      }
    }

    record.finishedAt = now();
    onProgress(progress(null));

    if (stopped) {
      for (const later of results.slice(index + 1)) later.outcome = 'not-reached';
      break;
    }
  }

  const final = progress(null, true);
  onProgress(final);
  return final;
}

/**
 * What the whole list will cost before a penny of it is spent.
 *
 * A queue is where a runaway cost hurts most — five videos of unattended spending
 * with nobody watching — so the figure is quoted from the same per-video estimate
 * the single-video screen uses, and the caller passes it in. Nothing here invents
 * a price.
 */
export function queueEstimateUsd(estimates: readonly number[]): number {
  return estimates.reduce((sum, n) => sum + n, 0);
}

/**
 * **The queue lives in the service, not in the panel**, which is what makes it
 * survive After Effects being closed.
 *
 * The panel posts a job and polls it — ARCHITECTURE §4, the same route a single
 * video already takes. The work runs in the companion service, a separate
 * process the panel starts but does not own, so closing the panel, closing After
 * Effects, or the panel crashing leaves the queue running and the results are
 * waiting when he opens it again.
 *
 * **What it does not survive is the service itself stopping** — a restart, a
 * logout, the Mac sleeping deeply enough. Jobs are held in memory, exactly as
 * every other job in this tool is. That is worth being plain about: **a queue of
 * five is about two hours, and a Mac that sleeps loses the rest of it.** What is
 * already paid for is not lost, because every stage writes what it bought onto
 * the plan as it finishes and the next run reads it back from the cache for
 * nothing — so restarting a lost queue costs time, not money.
 */
export const QUEUE_JOB_TYPE = 'queue';

/** The stop flags the HTTP route sets, by job id. */
const stopped = new Set<string>();

/** Asks a running queue to stop after the video it is holding. */
export function stopQueue(jobId: string): void {
  stopped.add(jobId);
}

export function queueWasStopped(jobId: string): boolean {
  return stopped.has(jobId);
}

registerJobRunner(QUEUE_JOB_TYPE, async (params, job) => {
  const raw = params?.['items'];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('a queue needs at least one video');
  }
  const items: QueueItem[] = raw.map((entry, i) => {
    const row = entry as { reel?: unknown; mode?: unknown; modeId?: unknown };
    const reel = row.reel;
    const modeId = row.modeId ?? row.mode;
    if (typeof reel !== 'string' || reel.length === 0) {
      throw new Error(`video ${String(i + 1)} in the queue has no video`);
    }
    /* Each item carries its own client, exactly as one video does today. */
    if (typeof modeId !== 'string' || modeId.length === 0) {
      throw new Error(`video ${String(i + 1)} in the queue has no client`);
    }
    return { reel, modeId };
  });

  return await runQueue({
    items,
    shouldStop: () => stopped.has(job.id),
    onProgress: (progress) => {
      const reached = progress.items.filter((i) => i.outcome !== 'not-reached').length;
      job.progress = items.length === 0 ? 1 : reached / items.length;
      /*
       * The summary rides along with the progress once it is finished, so the
       * panel reads the service's own sentences rather than composing its own.
       * A second copy of "is this worth trying again" in a React bundle is a
       * second place for it to drift.
       */
      job.detail = progress.done ? { ...progress, summary: queueSummary(progress) } : progress;
    },
    runOne: async (item) => {
      const result = await runPipeline({
        reel: item.reel,
        modeId: item.modeId,
        only: [...QUEUE_STAGE_IDS],
      });
      return { spentUsd: result.spentUsd };
    },
  });
});

export interface QueueSummaryLine {
  reel: string;
  /** What became of it, in words he can read. */
  said: string;
  /** True when he has something to do about this one. */
  needsHim: boolean;
}

export interface QueueSummary {
  headline: string;
  lines: QueueSummaryLine[];
  spentSaid: string;
}

/**
 * **What he comes back to.**
 *
 * He has been away for two hours and the money is already spent — he agreed to
 * that. What he needs at a glance is three things: which videos are ready to
 * build, which failed and what he would do about each, and what it all cost.
 *
 * **Plain words, naming no command and sending him nowhere.** Block 12 session 91
 * found eleven messages that did, and `leave-the-panel.test.ts` reads the whole
 * service now, so a command in here fails the gate.
 */
export function queueSummary(progress: QueueProgress): QueueSummary {
  const done = progress.items.filter((i) => i.outcome === 'done');
  const failed = progress.items.filter((i) => i.outcome === 'failed');
  const untouched = progress.items.filter(
    (i) => i.outcome === 'not-reached' || i.outcome === 'stopped',
  );

  const ready =
    done.length === 0
      ? 'Nothing is ready to build.'
      : `${String(done.length)} ${done.length === 1 ? 'video is' : 'videos are'} ready to build.`;
  const wrong = failed.length === 0 ? '' : ` ${String(failed.length)} did not finish.`;
  const left =
    untouched.length === 0
      ? ''
      : ` ${String(untouched.length)} ${untouched.length === 1 ? 'was' : 'were'} not started.`;

  const lines = progress.items.map((item): QueueSummaryLine => {
    if (item.outcome === 'done') {
      return { reel: item.reel, said: 'Ready to build.', needsHim: false };
    }
    if (item.outcome === 'stopped') {
      return {
        reel: item.reel,
        said: 'Not started — you stopped the queue here. Add it again when you want it.',
        needsHim: false,
      };
    }
    if (item.outcome === 'not-reached') {
      return {
        reel: item.reel,
        said: 'Not started. Add it again when you want it.',
        needsHim: false,
      };
    }
    /*
     * A failure says what to do about *this* failure rather than one sentence for
     * all of them: the network coming back and a picture budget being refused are
     * not the same problem and do not have the same answer.
     */
    const cause = item.error?.cause ?? 'something went wrong and it did not say what';
    const retryable = item.error?.retryable === true;
    const said = retryable
      ? `Did not finish — the connection failed, and it was tried ${String(item.attempts)} times. ` +
        `Nothing was lost. Add it to a queue again when you are back online. It said: ${cause}`
      : `Did not finish, and trying it again would fail the same way. ` +
        `Nothing you have already paid for is lost. It said: ${cause}`;
    return { reel: item.reel, said, needsHim: true };
  });

  return {
    headline: `${ready}${wrong}${left}`,
    lines,
    spentSaid:
      progress.spentUsd === 0
        ? 'Nothing was spent.'
        : `It cost $${progress.spentUsd.toFixed(2)} altogether.`,
  };
}
