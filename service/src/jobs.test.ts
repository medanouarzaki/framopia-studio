import { describe, expect, it, vi } from 'vitest';
import { createJob, getJob, UnknownJobTypeError } from './jobs.js';

describe('jobs', () => {
  it('runs a noop job to completion', async () => {
    const job = createJob('noop');
    expect(job.status).toBe('running');

    await vi.waitFor(() => {
      expect(getJob(job.id)?.status).toBe('done');
    });

    const finished = getJob(job.id);
    expect(finished?.progress).toBe(1);
    expect(finished?.error).toBeUndefined();
  });

  it('rejects unknown job types', () => {
    expect(() => createJob('does-not-exist')).toThrow(UnknownJobTypeError);
  });

  it('returns undefined for unknown ids', () => {
    expect(getJob('missing-id')).toBeUndefined();
  });
});
