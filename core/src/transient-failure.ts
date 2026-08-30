/**
 * What is worth another attempt, and what is not.
 *
 * ARCHITECTURE §8: *automatic retries only for transient network/5xx (bounded,
 * jittered)*. Three clients each carried a private copy of the same predicate
 * and the same marker list — `analysis/keywords.ts`, `analysis/slots.ts` and
 * `transcription/correction.ts` — and the one client that had none was the image
 * client, which is the most expensive to restart: Block 10 session 7 lost a
 * twelve-request batch to a 503 on the first call and billed nothing for it.
 *
 * A rule shared by more than one caller is one declaration pinned by a test, so
 * this is that declaration.
 *
 * **A 4xx is never retried.** A 400, a 401, a 403 or a content refusal will fail
 * again identically; retrying burns time, and against an endpoint that bills on
 * receipt it can burn money. The one exception is 429, which is rate limiting
 * and is exactly what waiting fixes.
 */

/** Rate limiting. Waiting is the correct response and the only one. */
export const RATE_LIMITED_STATUS = 429;

/**
 * Substrings that mark an overload when no status can be read.
 *
 * The Google SDK throws an `ApiError` whose message carries the JSON body
 * rather than a typed status, so these were how the three existing clients
 * recognised a 503. Kept verbatim from them, and now subordinate to a status
 * when one is readable — a 400 whose body happens to contain "503" was
 * retryable under the old copies and is not under this one.
 */
export const TRANSIENT_MESSAGE_MARKERS = ['503', 'UNAVAILABLE', 'high demand', 'overloaded'];

/** Attempts in total, not retries after the first. Bounded so a run cannot spin. */
export const RETRY_MAX_ATTEMPTS = 3;

/** The first wait. Doubles per attempt, then jitters. */
export const RETRY_BASE_DELAY_MS = 1_000;

/** No wait may exceed this, however many attempts a caller allows. */
export const RETRY_MAX_DELAY_MS = 8_000;

/**
 * The HTTP status carried by an error, when one can be read at all.
 *
 * Three shapes reach here: a `status` or `code` property (undici, node-fetch),
 * a nested `response.status`, and the Google SDK's message, which is a JSON
 * body with `"code": 503` inside it. Null means the error carries no status,
 * which is the network-failure case rather than a refusal.
 */
export function statusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const record = error as Record<string, unknown>;
  for (const key of ['status', 'statusCode', 'code'] as const) {
    const value = record[key];
    if (typeof value === 'number' && value >= 100 && value <= 599) return value;
  }
  const response = record['response'];
  if (typeof response === 'object' && response !== null) {
    const nested = (response as Record<string, unknown>)['status'];
    if (typeof nested === 'number') return nested;
  }
  const message = error instanceof Error ? error.message : null;
  if (message !== null) {
    const match = /"code"\s*:\s*(\d{3})\b/u.exec(message);
    if (match !== undefined && match !== null) return Number(match[1]);
  }
  return null;
}

/**
 * Whether another attempt is worth making.
 *
 * A readable status decides on its own: 5xx and 429 yes, anything else no. Only
 * when there is no status at all do the message markers get a say, because that
 * is the case the Google SDK used to leave undecidable.
 */
export function isTransientFailure(error: unknown): boolean {
  const status = statusOf(error);
  if (status !== null) return status >= 500 || status === RATE_LIMITED_STATUS;
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_MESSAGE_MARKERS.some((marker) => message.includes(marker));
}

/**
 * How long to wait before attempt `attempt`, counting the first as 1.
 *
 * Exponential from `RETRY_BASE_DELAY_MS`, capped, then **full jitter** — a
 * uniform draw over the whole interval rather than a fixed delay with noise on
 * top. Twelve image requests that all hit one demand spike would otherwise
 * retry in lockstep and arrive together, which is the thundering herd the
 * jitter exists to break up.
 */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const exponential = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.round(random() * Math.min(exponential, RETRY_MAX_DELAY_MS));
}

export interface RetryAttemptReport {
  /** 1 for the first call, 2 for the first retry. */
  attempt: number;
  status: number | null;
  message: string;
  waitedMs: number;
}

export interface TransientRetryOptions {
  maxAttempts?: number;
  /** Injected by tests so a retry costs no wall clock. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Called after each failed attempt that will be retried. */
  onRetry?: (report: RetryAttemptReport) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt`, retrying only a transient failure.
 *
 * **A successful call is never repeated, and that is structural rather than
 * careful.** `await attempt()` returns straight out of the function; the loop is
 * only reachable from the `catch`, so there is no path from a returned value to
 * another request. This is the money-losing case — a request the server
 * completed and billed, sent again — and it is worth more than a comment.
 *
 * The last failure is rethrown unchanged, so a caller's own error wrapping and
 * the message a user reads are exactly what they were before.
 */
export async function withTransientRetry<T>(
  attempt: () => Promise<T>,
  options: TransientRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? RETRY_MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let n = 1; n <= maxAttempts; n += 1) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (n >= maxAttempts || !isTransientFailure(error)) break;
      const waitedMs = retryDelayMs(n, options.random);
      options.onRetry?.({
        attempt: n,
        status: statusOf(error),
        message: error instanceof Error ? error.message : String(error),
        waitedMs,
      });
      await sleep(waitedMs);
    }
  }
  throw lastError;
}
