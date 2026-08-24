import type { GoogleGenAI } from '@google/genai';

const OVERLOAD_MARKERS = ['503', 'UNAVAILABLE', 'high demand', 'overloaded'];
const RETRY_DELAY_MS = 20_000;

function isTransientOverload(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return OVERLOAD_MARKERS.some((marker) => message.includes(marker));
}

/**
 * Gemini 3.1 Pro Preview returns 503 "high demand" often enough that a
 * sixteen-call benchmark sweep will hit it; the SDK does not retry on its
 * own. One retry after a pause, and only for overload — a 4xx is a real
 * problem and should surface immediately.
 */
export async function generateWithOneRetry(
  ai: GoogleGenAI,
  request: Parameters<GoogleGenAI['models']['generateContent']>[0],
): Promise<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>> {
  try {
    return await ai.models.generateContent(request);
  } catch (error) {
    if (!isTransientOverload(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return ai.models.generateContent(request);
  }
}
