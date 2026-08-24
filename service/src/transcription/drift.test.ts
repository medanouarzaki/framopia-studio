import { describe, expect, it } from 'vitest';
import { assembleHybridResult } from './index.js';
import { driftWarning, measureTokenDrift, DRIFT_WARNING_THRESHOLD } from './drift.js';
import type { ScribeResult } from './scribe.js';
import type { CorrectionResult } from './correction.js';
import type { TranscriptWord } from './types.js';

function words(n: number): TranscriptWord[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `w${i}`,
    start: i,
    end: i + 0.5,
    confidence: 0.9,
  }));
}

function scribeResult(n: number): ScribeResult {
  return {
    words: words(n),
    raw: { language_code: 'ary', language_probability: 1, text: '', words: [] },
    wallTimeS: 2,
  };
}

function correctionResult(n: number): CorrectionResult {
  return {
    correctedTexts: Array.from({ length: n }, (_, i) => `c${i}`),
    promptVersion: 2,
    model: 'gemini-3.1-pro-preview',
    costUsd: 0.1,
    wallTimeS: 60,
    usage: {},
  };
}

describe('measureTokenDrift', () => {
  it('is zero drift when the counts match', () => {
    expect(measureTokenDrift(100, 100)).toMatchObject({
      absoluteDelta: 0,
      fraction: 0,
      exceedsThreshold: false,
    });
  });

  it('measures added and removed tokens the same way', () => {
    expect(measureTokenDrift(100, 110).fraction).toBeCloseTo(0.1, 12);
    expect(measureTokenDrift(100, 90).fraction).toBeCloseTo(0.1, 12);
  });

  it('does not divide by zero on an empty draft', () => {
    expect(measureTokenDrift(0, 5)).toMatchObject({ fraction: 0, exceedsThreshold: false });
  });

  it('treats drift exactly at the threshold as within tolerance', () => {
    const drift = measureTokenDrift(100, 100 + DRIFT_WARNING_THRESHOLD * 100);
    expect(drift.fraction).toBeCloseTo(DRIFT_WARNING_THRESHOLD, 12);
    expect(drift.exceedsThreshold).toBe(false);
  });
});

describe('driftWarning', () => {
  it('is null below the threshold', () => {
    expect(driftWarning(measureTokenDrift(100, 105))).toBeNull();
  });

  it('names the stage, the counts and the direction above the threshold', () => {
    const warning = driftWarning(measureTokenDrift(100, 130));
    expect(warning?.stage).toBe('correction');
    expect(warning?.cause).toContain('30.0%');
    expect(warning?.cause).toContain('100 draft tokens, 130 corrected');
    expect(warning?.cause).toContain('added');
  });

  it('says removed when the correction dropped tokens', () => {
    expect(driftWarning(measureTokenDrift(100, 70))?.cause).toContain('removed');
  });
});

describe('assembleHybridResult — drift reporting', () => {
  it('returns the transcript with no warning below the threshold', () => {
    const result = assembleHybridResult(scribeResult(100), correctionResult(105));
    expect(result.warnings).toEqual([]);
    expect(result.words).toHaveLength(105);
    expect(result.drift).toMatchObject({ draftCount: 100, correctedCount: 105 });
  });

  it('still returns the transcript when drift is flagged', () => {
    const result = assembleHybridResult(scribeResult(100), correctionResult(140));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.stage).toBe('correction');
    // The flagged correction is returned in full, never dropped or replaced.
    expect(result.words).toHaveLength(140);
    expect(result.drift.exceedsThreshold).toBe(true);
  });
});
