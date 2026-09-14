import { describe, expect, it, vi } from 'vitest';
import { createJob, getJob, listJobs, registerJobRunner, UnknownJobTypeError } from './jobs.js';

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

/**
 * **What this service has been asked to do.**
 *
 * Block 14 session 109. A queue outlives the panel, and until this route existed
 * nothing could ask what was running — so closing the panel mid-queue meant
 * coming back to a screen that said nothing had happened while money was still
 * being spent.
 */
describe('listing what has been asked for', () => {
  it('lists a job with when it started, newest first', async () => {
    const first = createJob('noop');
    await vi.waitFor(() => {
      expect(getJob(first.id)?.status).toBe('done');
    });
    const second = createJob('noop');
    await vi.waitFor(() => {
      expect(getJob(second.id)?.status).toBe('done');
    });

    const listed = listJobs();
    const ids = listed.map((j) => j.id);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
    /* Newest first, which is the order a returning panel wants. */
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it('stamps when a job started and when it stopped', async () => {
    const job = createJob('noop');
    expect(job.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await vi.waitFor(() => {
      expect(getJob(job.id)?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
    const done = getJob(job.id);
    expect(Date.parse(done?.finishedAt ?? '')).toBeGreaterThanOrEqual(
      Date.parse(done?.startedAt ?? ''),
    );
  });

  /** A job that failed is still listed: it is the one he most needs to find. */
  it('lists a job that failed, with when it stopped', async () => {
    registerJobRunner('a-runner-that-throws', async () => {
      throw new Error('it did not work');
    });
    const job = createJob('a-runner-that-throws');
    await vi.waitFor(() => {
      expect(getJob(job.id)?.status).toBe('error');
    });
    const listed = listJobs().find((j) => j.id === job.id);
    expect(listed?.status).toBe('error');
    expect(listed?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
