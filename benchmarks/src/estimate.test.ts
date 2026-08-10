import { describe, expect, it } from 'vitest';
import { estimateCosts, estimateGeminiCallCost } from './estimate.js';

describe('estimateGeminiCallCost', () => {
  it('is zero for zero-duration audio', () => {
    expect(estimateGeminiCallCost(0)).toBeCloseTo(0);
  });

  it('grows with duration', () => {
    expect(estimateGeminiCallCost(60)).toBeGreaterThan(estimateGeminiCallCost(10));
  });
});

describe('estimateCosts', () => {
  it('includes one estimate per requested engine', () => {
    const estimates = estimateCosts(30, ['scribe', 'gemini', 'whisper', 'hybrid'], false);
    expect(estimates.map((e) => e.engine)).toEqual(['scribe', 'gemini', 'whisper', 'hybrid']);
  });

  it('whisper is always free', () => {
    const [whisper] = estimateCosts(30, ['whisper'], false);
    expect(whisper?.usd).toBe(0);
  });

  it('hybrid costs at least as much as scribe alone', () => {
    const [scribeEstimate] = estimateCosts(30, ['scribe'], false);
    const [hybridEstimate] = estimateCosts(30, ['hybrid'], false);
    expect(hybridEstimate?.usd).toBeGreaterThan(scribeEstimate?.usd ?? 0);
  });

  it('omits engines that were not requested', () => {
    const estimates = estimateCosts(30, ['whisper'], false);
    expect(estimates).toHaveLength(1);
  });
});
