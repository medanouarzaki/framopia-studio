import type { TranscriptionWarning } from './types.js';

/**
 * The correction prompt lets the model add and remove words, and the
 * alignment layer absorbs insertions by interpolating between anchors, so a
 * runaway rewrite would produce plausible-looking timings over text that is
 * no longer a transcript. Nothing here constrains the model; it measures.
 *
 * 15% is a starting value picked without evidence — the Block 1 reels and
 * vitasilk are the only data, and none of them has been measured this way.
 * Revisit once several reels have been through with drift recorded.
 */
export const DRIFT_WARNING_THRESHOLD = 0.15;

export interface TokenDrift {
  draftCount: number;
  correctedCount: number;
  absoluteDelta: number;
  /** Absolute delta over draft count. Zero when the draft was empty. */
  fraction: number;
  exceedsThreshold: boolean;
}

export function measureTokenDrift(draftCount: number, correctedCount: number): TokenDrift {
  const absoluteDelta = Math.abs(correctedCount - draftCount);
  const fraction = draftCount === 0 ? 0 : absoluteDelta / draftCount;
  return {
    draftCount,
    correctedCount,
    absoluteDelta,
    fraction,
    exceedsThreshold: fraction > DRIFT_WARNING_THRESHOLD,
  };
}

export function driftWarning(drift: TokenDrift): TranscriptionWarning | null {
  if (!drift.exceedsThreshold) return null;
  const direction = drift.correctedCount > drift.draftCount ? 'added' : 'removed';
  return {
    stage: 'correction',
    cause: `token count drifted ${(drift.fraction * 100).toFixed(1)}% (${drift.draftCount} draft tokens, ${drift.correctedCount} corrected, ${drift.absoluteDelta} ${direction}); the correction is returned unchanged`,
  };
}
