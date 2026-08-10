import { normalizeToken } from './normalize.js';
import type { TranscribedWord } from './types.js';

// There is no ground-truth timestamp source (hand-writing exact word
// timings is impractical), so timestamp quality is assessed two ways
// instead: agreement between engines (crossEngineDeviation) and internal
// sanity (sanityCheck) — never against a "true" timestamp.

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(p * sortedValues.length) - 1));
  return sortedValues[index]!;
}

export interface CrossEngineDeviation {
  medianAbsDeltaS: number;
  p90AbsDeltaS: number;
  pairCount: number;
}

/**
 * For each word in `a` with a normalized-text match in `b`, finds the
 * nearest-in-time occurrence in `b` and records the absolute start-time
 * delta. Matching is nearest-neighbor per `a` word, not a strict 1:1
 * assignment — a repeated word can match the same `b` occurrence twice,
 * which is acceptable for a deviation summary statistic.
 */
export function crossEngineDeviation(a: TranscribedWord[], b: TranscribedWord[]): CrossEngineDeviation {
  const byText = new Map<string, TranscribedWord[]>();
  for (const word of b) {
    if (word.startS === null) continue;
    const key = normalizeToken(word.text);
    if (key.length === 0) continue;
    const list = byText.get(key) ?? [];
    list.push(word);
    byText.set(key, list);
  }

  const deltas: number[] = [];
  for (const word of a) {
    if (word.startS === null) continue;
    const key = normalizeToken(word.text);
    const candidates = byText.get(key);
    if (!candidates || candidates.length === 0) continue;

    let best: number | null = null;
    for (const candidate of candidates) {
      const delta = Math.abs(word.startS - (candidate.startS as number));
      if (best === null || delta < best) best = delta;
    }
    if (best !== null) deltas.push(best);
  }

  deltas.sort((x, y) => x - y);
  return {
    medianAbsDeltaS: percentile(deltas, 0.5),
    p90AbsDeltaS: percentile(deltas, 0.9),
    pairCount: deltas.length,
  };
}

export interface TimestampSanity {
  nullStartCount: number;
  monotonicityViolations: number;
}

export function sanityCheck(words: TranscribedWord[]): TimestampSanity {
  let nullStartCount = 0;
  let monotonicityViolations = 0;
  let previousStart: number | null = null;

  for (const word of words) {
    if (word.startS === null) {
      nullStartCount += 1;
      continue;
    }
    if (previousStart !== null && word.startS < previousStart) {
      monotonicityViolations += 1;
    }
    previousStart = word.startS;
  }

  return { nullStartCount, monotonicityViolations };
}
