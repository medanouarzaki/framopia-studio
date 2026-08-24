import { describe, expect, it } from 'vitest';
import { computeGeminiCost, estimateCosts, estimateGeminiCallCost } from './pricing.js';
import { modelConfig } from './model-config.js';

describe('estimateGeminiCallCost', () => {
  // Not zero: the orthography guide goes into every prompt whatever the
  // duration, so a zero-length call still costs those fixed input tokens.
  // The old assertion said "is zero" and passed only because 0.004 falls
  // inside toBeCloseTo's default tolerance of 0.005.
  it('charges the fixed guide-prompt tokens even for zero-duration audio', () => {
    const expected = (2000 / 1_000_000) * modelConfig.geminiPrices.textInputUsdPerMillionTokens;
    expect(estimateGeminiCallCost(0)).toBeCloseTo(expected, 12);
    expect(estimateGeminiCallCost(0)).toBeGreaterThan(0);
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

// Moved from benchmarks/src/engines/gemini.test.ts with the pricing code.
describe('computeGeminiCost', () => {
  it('prices text and audio prompt tokens separately via promptTokensDetails', () => {
    const { geminiPrices } = modelConfig;
    const cost = computeGeminiCost({
      promptTokenCount: 1200,
      candidatesTokenCount: 40,
      promptTokensDetails: [
        { modality: 'TEXT', tokenCount: 900 },
        { modality: 'AUDIO', tokenCount: 300 },
      ],
    });
    const expected =
      (900 / 1_000_000) * geminiPrices.textInputUsdPerMillionTokens +
      (300 / 1_000_000) * geminiPrices.audioInputUsdPerMillionTokens +
      (40 / 1_000_000) * geminiPrices.outputUsdPerMillionTokens;
    expect(cost).toBeCloseTo(expected, 12);
  });

  it('falls back to a flat prompt-token rate without a modality breakdown', () => {
    const { geminiPrices } = modelConfig;
    const cost = computeGeminiCost({ promptTokenCount: 1000, candidatesTokenCount: 100 });
    const expected =
      (1000 / 1_000_000) * geminiPrices.textInputUsdPerMillionTokens +
      (100 / 1_000_000) * geminiPrices.outputUsdPerMillionTokens;
    expect(cost).toBeCloseTo(expected, 12);
  });

  it('is zero for empty usage', () => {
    expect(computeGeminiCost({})).toBe(0);
  });

  it('bills thinking tokens at the output rate alongside visible output', () => {
    const { geminiPrices } = modelConfig;
    const withoutThinking = computeGeminiCost({
      promptTokenCount: 1000,
      candidatesTokenCount: 1000,
    });
    const withThinking = computeGeminiCost({
      promptTokenCount: 1000,
      candidatesTokenCount: 1000,
      thoughtsTokenCount: 1000,
    });
    expect(withThinking - withoutThinking).toBeCloseTo(
      (1000 / 1_000_000) * geminiPrices.outputUsdPerMillionTokens,
      12,
    );
  });

  // Pins the exact re-costing of the Block 1 session-4 ledger correction
  // (benchmarks/RESULTS-block1.md): if these constants or this arithmetic
  // move, that recorded $0.155208 stops being reproducible.
  it('reproduces the recorded cost of the session-4 gemini call', () => {
    const cost = computeGeminiCost({
      promptTokenCount: 3330,
      candidatesTokenCount: 2084,
      thoughtsTokenCount: 10295,
      promptTokensDetails: [
        { modality: 'TEXT', tokenCount: 2748 },
        { modality: 'AUDIO', tokenCount: 582 },
      ],
    });
    expect(cost).toBeCloseTo(0.155208, 9);
  });
});
