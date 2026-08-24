import { describe, expect, it } from 'vitest';
import { crossEngineDeviation, sanityCheck } from './timestamps.js';
import type { TranscribedWord } from './types.js';

function word(text: string, startS: number | null): TranscribedWord {
  return { text, startS, endS: startS === null ? null : startS + 0.3, confidence: null };
}

describe('crossEngineDeviation', () => {
  it('is zero when both engines agree exactly', () => {
    const a = [word('wach', 0.1), word('nta', 0.5)];
    const b = [word('wach', 0.1), word('nta', 0.5)];
    const result = crossEngineDeviation(a, b);
    expect(result.medianAbsDeltaS).toBe(0);
    expect(result.p90AbsDeltaS).toBe(0);
    expect(result.pairCount).toBe(2);
  });

  it('computes median and p90 deltas for disagreements', () => {
    const a = [word('wach', 0.0), word('nta', 1.0), word('mzyan', 2.0)];
    const b = [word('wach', 0.1), word('nta', 1.5), word('mzyan', 2.0)];
    // deltas: 0.1, 0.5, 0.0 -> sorted [0, 0.1, 0.5]
    const result = crossEngineDeviation(a, b);
    expect(result.pairCount).toBe(3);
    expect(result.medianAbsDeltaS).toBeCloseTo(0.1, 9);
    expect(result.p90AbsDeltaS).toBeCloseTo(0.5, 9);
  });

  it('skips words with no timestamp on either side', () => {
    const a = [word('wach', null)];
    const b = [word('wach', 0.1)];
    expect(crossEngineDeviation(a, b).pairCount).toBe(0);
  });

  it('picks the nearest occurrence when a word repeats', () => {
    const a = [word('daba', 5.0)];
    const b = [word('daba', 0.1), word('daba', 4.9)];
    const result = crossEngineDeviation(a, b);
    expect(result.medianAbsDeltaS).toBeCloseTo(0.1, 9);
  });
});

describe('sanityCheck', () => {
  it('finds no violations for clean monotonic timestamps', () => {
    const words = [word('wach', 0), word('nta', 0.5), word('mzyan', 1.0)];
    const result = sanityCheck(words);
    expect(result.nullStartCount).toBe(0);
    expect(result.monotonicityViolations).toBe(0);
  });

  it('counts null start timestamps', () => {
    const words = [word('wach', 0), word('nta', null), word('mzyan', 1.0)];
    expect(sanityCheck(words).nullStartCount).toBe(1);
  });

  it('counts monotonicity violations, ignoring nulls', () => {
    const words = [word('wach', 1.0), word('nta', 0.2), word('mzyan', null), word('daba', 0.1)];
    // 1.0 -> 0.2 is a violation; 0.2 -> (null skipped) -> 0.1 is another
    expect(sanityCheck(words).monotonicityViolations).toBe(2);
  });
});
