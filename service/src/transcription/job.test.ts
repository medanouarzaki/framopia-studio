import { describe, expect, it } from 'vitest';
import { createJob, getJob, UnknownJobTypeError } from '../jobs.js';
import { TRANSCRIBE_JOB_TYPE } from './job.js';

describe('transcribe job registration', () => {
  it('registers the transcribe job type with the shared framework', () => {
    // Importing job.js is what registers it; before that the type is unknown.
    expect(() => createJob('definitely-not-a-job-type')).toThrow(UnknownJobTypeError);
    const job = createJob(TRANSCRIBE_JOB_TYPE, {});
    expect(getJob(job.id)?.type).toBe(TRANSCRIBE_JOB_TYPE);
  });

  it('fails the job rather than throwing when videoPath is missing', async () => {
    const job = createJob(TRANSCRIBE_JOB_TYPE, {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getJob(job.id)?.status).toBe('error');
    expect(getJob(job.id)?.error).toContain('videoPath');
  });
});
