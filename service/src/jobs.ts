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
  };
  jobs.set(job.id, job);

  job.status = 'running';
  runner(params, job)
    .then((result) => {
      job.status = 'done';
      job.progress = 1;
      job.result = result;
    })
    .catch((err: unknown) => {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
    });

  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
