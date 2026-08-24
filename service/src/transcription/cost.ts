import { computeGeminiCost, estimateScribeCost, type GeminiUsage } from '@framopia/core';

export interface HybridCostBreakdown {
  /** Scribe bills per audio-hour; its response carries no duration, so this
   * is derived from the duration the caller already has. */
  scribeUsd: number;
  /** From the recorded usage, thinking tokens included — they bill at the
   * output rate and are roughly 5x the visible output on this workload. */
  geminiUsd: number;
  totalUsd: number;
}

export function computeHybridCost(
  durationS: number,
  keytermsUsed: boolean,
  usage: GeminiUsage,
): HybridCostBreakdown {
  const scribeUsd = estimateScribeCost(durationS, keytermsUsed);
  const geminiUsd = computeGeminiCost(usage);
  return { scribeUsd, geminiUsd, totalUsd: scribeUsd + geminiUsd };
}
