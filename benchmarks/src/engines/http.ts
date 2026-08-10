/**
 * Fetch with exactly one retry: on a network error or a 5xx response, try
 * once more before giving up. 4xx responses are not retried since they
 * won't succeed on a second attempt.
 */
export async function fetchWithOneRetry(input: string, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init);
    if (response.ok || response.status < 500) return response;
    return await fetch(input, init);
  } catch {
    return await fetch(input, init);
  }
}

export class EngineRequestError extends Error {
  constructor(
    public readonly engine: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`${engine} request failed: ${status} ${body}`);
  }
}
