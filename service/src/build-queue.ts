import { registerJobRunner } from './jobs.js';
import { runBuildJob, BuildJobError } from './build/job.js';

/**
 * **Build every finished video, one press.**
 *
 * Block 14 session 114. Mohamed works principally in queues, and the panel was
 * built the other way round: one client, one video, one build. Session 114
 * counted the walk on his own panel — **ten videos cost 81 actions, 39 of them
 * crossings between screens**, and 40 of those 81 were building them one at a
 * time. The run queue saved him the watching; it never saved him the work.
 *
 * **After Effects runs one script at a time.** That is a hard limit, not a
 * choice: `runBuildJob` spawns the build CLI, which drives the running instance
 * over AppleScript, and two at once would interleave inside one application. So
 * this is a sequence, exactly as the run queue is, and for the same reason.
 *
 * **A build that fails does not stop the rest**, which is the rule the run queue
 * has followed since Block 13 session 94. A reel whose plan has gone, or whose
 * pictures were never made, is recorded and the next one is built.
 *
 * **It bills nothing.** Building is free — it reads a plan and writes an `.aep` —
 * so there is no ceiling here, no ledger, and no retry. A retry exists in the run
 * queue because a dropped connection mid-purchase is worth one more attempt; a
 * build that failed will fail the same way a second later, and session 94's
 * reasoning about bounding retries applies with more force when there is nothing
 * to gain.
 */
export interface BuildQueueItem {
  /** The reel label, exactly as one video carries it today. */
  reel: string;
  /** Its Edit Plan, which is what the builder is actually given. */
  planPath: string;
  /** Its client, so a reel builds in the brand it was made for. */
  modeId?: string;
}

export type BuildOutcome = 'built' | 'failed' | 'stopped' | 'not-reached';

export interface BuildQueueResultItem extends BuildQueueItem {
  outcome: BuildOutcome;
  /** Where the project was written, once it has been. */
  savePath: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** The builder's own words, present only on `failed`. */
  error?: string;
}

export interface BuildQueueProgress {
  items: BuildQueueResultItem[];
  /** Index of the one building now, or null between items and at the end. */
  buildingIndex: number | null;
  /** How far the one building now has got, 0..1. Null between items. */
  buildingPercent: number | null;
  done: boolean;
  stopped: boolean;
}

export interface RunBuildQueueOptions {
  items: readonly BuildQueueItem[];
  /**
   * Builds one reel. Injected so the sequence can be proved without driving
   * After Effects — the whole of this file's behaviour is the ordering and what
   * it does with a failure, and neither needs a real build.
   */
  buildOne?: (
    item: BuildQueueItem,
    onPercent: (percent: number) => void,
  ) => Promise<{ savePath: string | null }>;
  /** Asked before each build. True stops after the one in hand. */
  shouldStop?: () => boolean;
  onProgress?: (progress: BuildQueueProgress) => void;
  now?: () => string;
}

async function buildWithTheRealBuilder(
  item: BuildQueueItem,
  onPercent: (percent: number) => void,
): Promise<{ savePath: string | null }> {
  const progress = await runBuildJob({
    reel: item.reel,
    planPath: item.planPath,
    ...(item.modeId === undefined ? {} : { modeId: item.modeId }),
    onProgress: (p) => onPercent(p.percent),
  });
  if (progress.error !== null) throw new BuildJobError(progress.error);
  return { savePath: progress.savePath };
}

export async function runBuildQueue(
  options: RunBuildQueueOptions,
): Promise<BuildQueueProgress> {
  const {
    items,
    buildOne = buildWithTheRealBuilder,
    shouldStop = (): boolean => false,
    onProgress = (): void => undefined,
    now = () => new Date().toISOString(),
  } = options;

  if (items.length === 0) throw new Error('a build list needs at least one video');

  const results: BuildQueueResultItem[] = items.map((item) => ({
    ...item,
    outcome: 'not-reached',
    savePath: null,
    startedAt: null,
    finishedAt: null,
  }));

  let buildingIndex: number | null = null;
  let buildingPercent: number | null = null;
  let stopped = false;

  const progress = (): BuildQueueProgress => ({
    items: results.map((r) => ({ ...r })),
    buildingIndex,
    buildingPercent,
    done: false,
    stopped,
  });

  onProgress(progress());

  for (let index = 0; index < results.length; index += 1) {
    const record = results[index] as BuildQueueResultItem;
    if (shouldStop()) {
      stopped = true;
      break;
    }
    buildingIndex = index;
    buildingPercent = 0;
    record.startedAt = now();
    onProgress(progress());
    try {
      const { savePath } = await buildOne(record, (percent) => {
        buildingPercent = percent;
        onProgress(progress());
      });
      record.outcome = 'built';
      record.savePath = savePath;
      delete record.error;
    } catch (error) {
      /*
       * **The whole point of the sequence.** A reel whose plan has gone, or whose
       * pictures were never made, stops itself and nothing else — the same rule
       * the run queue has kept since session 94.
       */
      record.outcome = 'failed';
      record.error = error instanceof Error ? error.message : String(error);
    }
    record.finishedAt = now();
    buildingIndex = null;
    buildingPercent = null;
    onProgress(progress());
  }

  if (stopped) {
    for (const later of results) {
      if (later.outcome === 'not-reached') later.outcome = 'stopped';
    }
  }

  const finished: BuildQueueProgress = {
    items: results.map((r) => ({ ...r })),
    buildingIndex: null,
    buildingPercent: null,
    done: true,
    stopped,
  };
  onProgress(finished);
  return finished;
}

export const BUILD_QUEUE_JOB_TYPE = 'build-queue';

/** The stop flags the HTTP route sets, by job id. Mirrors the run queue's. */
const asked = new Set<string>();

export function stopBuildQueue(jobId: string): void {
  asked.add(jobId);
}

export function buildQueueWasStopped(jobId: string): boolean {
  return asked.has(jobId);
}

registerJobRunner(BUILD_QUEUE_JOB_TYPE, async (params, job) => {
  const raw = params?.['items'];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('a build list needs at least one video');
  }
  const items: BuildQueueItem[] = raw.map((entry) => {
    const item = entry as Partial<BuildQueueItem>;
    if (typeof item.reel !== 'string' || item.reel === '') {
      throw new Error('every video in a build list needs its name');
    }
    if (typeof item.planPath !== 'string' || item.planPath === '') {
      throw new Error(`${item.reel} has nothing to build from`);
    }
    return {
      reel: item.reel,
      planPath: item.planPath,
      ...(typeof item.modeId === 'string' && item.modeId !== '' ? { modeId: item.modeId } : {}),
    };
  });

  return await runBuildQueue({
    items,
    shouldStop: () => buildQueueWasStopped(job.id),
    onProgress: (progress) => {
      const settled = progress.items.filter((i) => i.outcome !== 'not-reached').length;
      job.progress = progress.items.length === 0 ? 0 : settled / progress.items.length;
      job.detail = progress;
    },
  });
});
