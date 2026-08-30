import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import {
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_MAX_DELAY_MS,
  TRANSIENT_MESSAGE_MARKERS,
  isTransientFailure,
  retryDelayMs,
  statusOf,
  withTransientRetry,
} from './transient-failure.js';

/** The Google SDK throws this shape: a message carrying the JSON body. */
function apiError(code: number, status: string, message: string): Error {
  return new Error(`ApiError: {"error":{"code":${code},"message":"${message}","status":"${status}"}}`);
}

describe('statusOf', () => {
  it('reads a status property', () => {
    expect(statusOf(Object.assign(new Error('x'), { status: 503 }))).toBe(503);
    expect(statusOf(Object.assign(new Error('x'), { statusCode: 429 }))).toBe(429);
  });

  it('reads a nested response status', () => {
    expect(statusOf(Object.assign(new Error('x'), { response: { status: 500 } }))).toBe(500);
  });

  /* The exact error session 7 lost a twelve-request batch to. */
  it('reads the code out of the Google SDK’s message', () => {
    expect(
      statusOf(apiError(503, 'UNAVAILABLE', 'This model is currently experiencing high demand.')),
    ).toBe(503);
  });

  it('is null when there is no status to read', () => {
    expect(statusOf(new Error('socket hang up'))).toBeNull();
    expect(statusOf('a string')).toBeNull();
    expect(statusOf(null)).toBeNull();
  });

  it('ignores a code that is not an HTTP status', () => {
    expect(statusOf(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBeNull();
    expect(statusOf(Object.assign(new Error('x'), { code: 42 }))).toBeNull();
  });
});

describe('isTransientFailure', () => {
  it('retries a 5xx and a 429', () => {
    for (const code of [500, 502, 503, 504, 429]) {
      expect(isTransientFailure(apiError(code, 'UNAVAILABLE', 'busy')), String(code)).toBe(true);
    }
  });

  /* Retrying these burns time, and against a billing endpoint it burns money. */
  it('never retries a 4xx that is not 429', () => {
    for (const code of [400, 401, 403, 404, 422]) {
      expect(isTransientFailure(apiError(code, 'INVALID_ARGUMENT', 'bad')), String(code)).toBe(
        false,
      );
    }
  });

  /*
   * The three private copies this replaced matched on message substrings alone,
   * so a 400 whose body happened to contain "503" was retryable. A readable
   * status decides on its own now.
   */
  it('does not retry a 400 whose body merely mentions 503', () => {
    expect(isTransientFailure(apiError(400, 'INVALID_ARGUMENT', 'expected 503 in a field'))).toBe(
      false,
    );
  });

  it('falls back to the markers when no status can be read', () => {
    for (const marker of TRANSIENT_MESSAGE_MARKERS) {
      expect(isTransientFailure(new Error(`something ${marker} something`)), marker).toBe(true);
    }
    expect(isTransientFailure(new Error('the prompt was refused'))).toBe(false);
  });

  it('treats a bare network failure as transient', () => {
    expect(isTransientFailure(new Error('fetch failed: UNAVAILABLE'))).toBe(true);
  });
});

describe('retryDelayMs', () => {
  it('grows exponentially from the base', () => {
    const noJitter = (): number => 1;
    expect(retryDelayMs(1, noJitter)).toBe(RETRY_BASE_DELAY_MS);
    expect(retryDelayMs(2, noJitter)).toBe(RETRY_BASE_DELAY_MS * 2);
    expect(retryDelayMs(3, noJitter)).toBe(RETRY_BASE_DELAY_MS * 4);
  });

  it('is capped however many attempts are asked for', () => {
    expect(retryDelayMs(20, () => 1)).toBe(RETRY_MAX_DELAY_MS);
  });

  /*
   * Full jitter, not a fixed delay with noise on top: twelve requests that hit
   * one demand spike would otherwise retry in lockstep and arrive together.
   */
  it('draws over the whole interval, so two callers do not wait alike', () => {
    expect(retryDelayMs(3, () => 0)).toBe(0);
    expect(retryDelayMs(3, () => 0.5)).toBe(RETRY_BASE_DELAY_MS * 2);
    expect(retryDelayMs(3, () => 1)).toBe(RETRY_BASE_DELAY_MS * 4);
  });
});

describe('withTransientRetry', () => {
  const sleep = vi.fn(async () => undefined);

  it('returns the first success without retrying', async () => {
    const attempt = vi.fn(async () => 'ok');
    expect(await withTransientRetry(attempt, { sleep })).toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  /*
   * The money-losing case: a request the server completed and billed, sent
   * again. `await attempt()` returns straight out of the function and the loop
   * is reachable only from the catch, so there is no path from a returned value
   * to another request.
   */
  it('never calls again after a call that returned', async () => {
    let calls = 0;
    const attempt = vi.fn(async () => {
      calls += 1;
      return calls;
    });
    for (let i = 0; i < 5; i += 1) await withTransientRetry(attempt, { sleep });
    expect(attempt).toHaveBeenCalledTimes(5);
  });

  it('retries a transient failure and returns the eventual success', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'high demand'))
      .mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'high demand'))
      .mockResolvedValue('ok');
    expect(await withTransientRetry(attempt, { sleep, random: () => 0 })).toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('does not retry a refusal, and rethrows it unchanged', async () => {
    const refusal = apiError(400, 'INVALID_ARGUMENT', 'the prompt was refused');
    const attempt = vi.fn().mockRejectedValue(refusal);
    await expect(withTransientRetry(attempt, { sleep })).rejects.toBe(refusal);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('is bounded, and rethrows the last failure', async () => {
    const last = apiError(503, 'UNAVAILABLE', 'still busy');
    const attempt = vi.fn().mockRejectedValue(last);
    await expect(withTransientRetry(attempt, { sleep, random: () => 0 })).rejects.toBe(last);
    expect(attempt).toHaveBeenCalledTimes(RETRY_MAX_ATTEMPTS);
  });

  it('reports each retry with its status and its wait', async () => {
    const seen: unknown[] = [];
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'high demand'))
      .mockResolvedValue('ok');
    await withTransientRetry(attempt, { sleep, random: () => 1, onRetry: (r) => seen.push(r) });
    expect(seen).toEqual([
      { attempt: 1, status: 503, message: expect.stringContaining('high demand'), waitedMs: RETRY_BASE_DELAY_MS },
    ]);
  });

  it('waits between attempts rather than hammering', async () => {
    const waits: number[] = [];
    const attempt = vi.fn().mockRejectedValue(apiError(503, 'UNAVAILABLE', 'busy'));
    await expect(
      withTransientRetry(attempt, { sleep: async (ms) => void waits.push(ms), random: () => 1 }),
    ).rejects.toBeDefined();
    expect(waits).toEqual([RETRY_BASE_DELAY_MS, RETRY_BASE_DELAY_MS * 2]);
  });
});

/*
 * The three clients that had their own copy of this predicate. A fourth private
 * implementation is what this module exists to prevent.
 */
describe('the callers that used to carry their own copy', () => {
  const files = [
    'service/src/analysis/keywords.ts',
    'service/src/analysis/slots.ts',
    'service/src/transcription/correction.ts',
    'service/src/images/gemini-client.ts',
  ];

  it.each(files)('%s declares no private overload predicate', (file) => {
    const source = readFileSync(path.join(REPO_ROOT, file), 'utf8');
    expect(source).not.toContain('function isTransientOverload');
    expect(source).not.toContain("const OVERLOAD_MARKERS");
  });

  it('the image client retries through the shared helper', () => {
    const source = readFileSync(
      path.join(REPO_ROOT, 'service/src/images/gemini-client.ts'),
      'utf8',
    );
    expect(source).toContain('withTransientRetry');
  });
});
