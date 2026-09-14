import crypto from 'node:crypto';

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  result?: unknown;
  error?: string;
  /**
   * Whatever the runner wants the poller to see while it is still running.
   * The pipeline puts its per-stage report here, so a panel that polls sees
   * stages finish rather than a number creeping up with nothing behind it.
   */
  detail?: unknown;
  /**
   * When the job was created and when it stopped, ISO 8601.
   *
   * **Optional with a default**, like every schema addition: a job object made
   * before Block 14 session 109 has neither, and `listJobs` sorts such a job last
   * rather than throwing. They exist so a panel coming back can say *what you
   * asked for, and when* instead of making him remember.
   */
  startedAt?: string;
  finishedAt?: string;
}

type JobRunner = (params: Record<string, unknown> | undefined, job: Job) => Promise<unknown>;

const runners: Record<string, JobRunner> = {
  noop: async () => null,
};

/**
 * Registration rather than a static map so jobs.ts stays free of pipeline
 * imports; the HTTP path and the CLI then run the same runner.
 */
export function registerJobRunner(type: string, runner: JobRunner): void {
  runners[type] = runner;
}

const jobs = new Map<string, Job>();

export class UnknownJobTypeError extends Error {
  constructor(type: string) {
    super(`Unknown job type: ${type}`);
  }
}

export function createJob(type: string, params?: Record<string, unknown>): Job {
  const runner = runners[type];
  if (!runner) {
    throw new UnknownJobTypeError(type);
  }

  const job: Job = {
    id: crypto.randomUUID(),
    type,
    status: 'pending',
    progress: 0,
    startedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);

  job.status = 'running';
  runner(params, job)
    .then((result) => {
      job.status = 'done';
      job.progress = 1;
      job.result = result;
      job.finishedAt = new Date().toISOString();
    })
    .catch((err: unknown) => {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      job.finishedAt = new Date().toISOString();
    });

  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * **Every job this service has, newest first.**
 *
 * Block 14 session 109. A queue survives the panel being closed — the work is the
 * service's, not the panel's — but the panel held its job id in React state and
 * there was **no way to ask what was running**. So closing the panel during a
 * two-hour queue meant coming back to a screen that said nothing had ever
 * happened, while the service was still spending money in the background.
 *
 * `startedAt` is what makes a resumption summary possible: a returning panel can
 * say what it asked for and when, rather than making him remember.
 */
export function listJobs(): Job[] {
  return [...jobs.values()].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
}
