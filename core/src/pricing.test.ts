import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMAGE_RESOLUTIONS,
  computeGeminiCost,
  computeImageCost,
  IMAGE_COST_MULTIPLIER,
  computeImageCostFromUsage,
  estimateImageRunCost,
  imageModelPrices,
  isAllowedImageResolution,
  UnknownImageModelError,
  UnsupportedImageResolutionError,
  estimateCosts,
  estimateGeminiCallCost,
  estimateGeminiTextCallCost,
} from './pricing.js';
import {
  GEMINI_IMAGE_MODEL_FLASH,
  GEMINI_IMAGE_MODEL_PRO,
  modelConfig,
} from './model-config.js';

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

describe('estimateGeminiCallCost — gating headroom', () => {
  // The most expensive correction call recorded on a comparable workload:
  // noise-floor run 1, 23.256567s, $0.162406 (RESULTS-block2-noisefloor.md).
  const WORST_RECORDED_USD = 0.162406;
  const WORST_RECORDED_DURATION_S = 23.256567;

  it('estimates at or above the worst actual recorded for the same reel', () => {
    expect(estimateGeminiCallCost(WORST_RECORDED_DURATION_S)).toBeGreaterThanOrEqual(
      WORST_RECORDED_USD,
    );
  });

  it('covers the worst recorded billed-output token count with headroom', () => {
    // Run 1 billed 411 visible + 12396 thinking = 12807 output tokens.
    const worstBilledOutputUsd =
      (12807 / 1_000_000) * modelConfig.geminiPrices.outputUsdPerMillionTokens;
    expect(estimateGeminiCallCost(WORST_RECORDED_DURATION_S)).toBeGreaterThan(
      worstBilledOutputUsd,
    );
  });

  it('stays a gate rather than a scare figure', () => {
    // Pessimistic, but not so pessimistic that every real run looks free by
    // comparison; if this ever fails the multiplier has drifted too high.
    expect(estimateGeminiCallCost(WORST_RECORDED_DURATION_S)).toBeLessThan(
      WORST_RECORDED_USD * 3,
    );
  });
});

describe('estimateGeminiTextCallCost', () => {
  it('lands in the right order of magnitude for a real analysis call', () => {
    // The Block 3 session 3 keyword prompt was ~2600 characters and asked for
    // nine candidates; the five recorded actuals ran $0.0498 to $0.0582.
    const estimate = estimateGeminiTextCallCost({
      promptChars: 2600,
      expectedOutputTokens: 270,
    });
    expect(estimate).toBeGreaterThan(0.03);
    expect(estimate).toBeLessThan(0.12);
  });

  it('grows with the prompt and with the expected answer', () => {
    const base = estimateGeminiTextCallCost({ promptChars: 1000, expectedOutputTokens: 100 });
    expect(estimateGeminiTextCallCost({ promptChars: 4000, expectedOutputTokens: 100 })).toBeGreaterThan(base);
    expect(estimateGeminiTextCallCost({ promptChars: 1000, expectedOutputTokens: 400 })).toBeGreaterThan(base);
  });

  it('is never zero for a real prompt', () => {
    expect(estimateGeminiTextCallCost({ promptChars: 1, expectedOutputTokens: 1 })).toBeGreaterThan(0);
  });
});

describe('computeImageCost', () => {
  it('prices each tier at the published per-image rate', () => {
    expect(computeImageCost('gemini-3-pro-image', '1K')).toBe(0.134);
    expect(computeImageCost('gemini-3-pro-image', '2K')).toBe(0.134);
    expect(computeImageCost('gemini-3.1-flash-image', '1K')).toBe(0.067);
    expect(computeImageCost('gemini-3.1-flash-image', '2K')).toBe(0.101);
  });

  // A spend gate that reads a typo as free is worse than no gate at all.
  it('throws on an unknown model rather than returning zero', () => {
    expect(() => computeImageCost('gemini-4-imaginary', '1K')).toThrow(UnknownImageModelError);
    expect(() => computeImageCost('', '1K')).toThrow(UnknownImageModelError);
  });

  it('names the priced models in the error', () => {
    expect(() => computeImageCost('nope', '1K')).toThrow(/gemini-3-pro-image/);
  });

  it('throws on a tier the model does not offer', () => {
    expect(() => computeImageCost('gemini-3-pro-image', '0.5K')).toThrow(
      UnsupportedImageResolutionError,
    );
  });
});

describe('image resolution policy', () => {
  it('allows 1K and 2K only', () => {
    expect(ALLOWED_IMAGE_RESOLUTIONS).toEqual(['1K', '2K']);
    expect(isAllowedImageResolution('1K')).toBe(true);
    expect(isAllowedImageResolution('2K')).toBe(true);
  });

  it('rejects 4K, which is paid-for pixels the comps scale away', () => {
    expect(isAllowedImageResolution('4K')).toBe(false);
    expect(isAllowedImageResolution('0.5K')).toBe(false);
  });

  // The tier is still priced even though it is not selectable, so the report
  // can say what was avoided.
  it('still prices 4K for both candidates', () => {
    expect(computeImageCost('gemini-3-pro-image', '4K')).toBe(0.24);
    expect(computeImageCost('gemini-3.1-flash-image', '4K')).toBe(0.151);
  });
});

describe('estimateImageRunCost', () => {
  it('multiplies slots by candidates by the per-image rate', () => {
    const e = estimateImageRunCost({
      modelId: 'gemini-3-pro-image', resolution: '1K', slots: 5, candidatesPerSlot: 3,
    });
    expect(e.images).toBe(15);
    // The estimate carries the gate multiplier; the published rate is kept
    // beside it so the two can be compared.
    expect(e.publishedUsd).toBe(0.134);
    expect(e.usd).toBeCloseTo(15 * 0.134 * IMAGE_COST_MULTIPLIER, 12);
    expect(e.modelId).toBe('gemini-3-pro-image');
  });

  it('is zero images and zero dollars when there are no slots', () => {
    const e = estimateImageRunCost({
      modelId: 'gemini-3.1-flash-image', resolution: '2K', slots: 0, candidatesPerSlot: 3,
    });
    expect(e.images).toBe(0);
    expect(e.usd).toBe(0);
  });

  it('throws before estimating anything for an unknown model', () => {
    expect(() =>
      estimateImageRunCost({
        modelId: 'ghost', resolution: '1K', slots: 5, candidatesPerSlot: 3,
      }),
    ).toThrow(UnknownImageModelError);
  });
});

describe('image model pins', () => {
  it('names both candidates and neither is the retiring 2.5 model', () => {
    expect(GEMINI_IMAGE_MODEL_PRO).toBe('gemini-3-pro-image');
    expect(GEMINI_IMAGE_MODEL_FLASH).toBe('gemini-3.1-flash-image');
    expect([GEMINI_IMAGE_MODEL_PRO, GEMINI_IMAGE_MODEL_FLASH]).not.toContain(
      'gemini-2.5-flash-image',
    );
  });

  it('records the shutdown date that rules gemini-2.5-flash-image out', () => {
    expect(imageModelPrices('gemini-2.5-flash-image').retiresOn).toBe('2026-10-02');
    expect(imageModelPrices(GEMINI_IMAGE_MODEL_PRO).retiresOn).toBeNull();
    expect(imageModelPrices(GEMINI_IMAGE_MODEL_FLASH).retiresOn).toBeNull();
  });
});

describe('computeImageCostFromUsage', () => {
  // Google prices an image at a fixed token count per tier, so the billed
  // figure lands within rounding of the published per-image rate. 1,680
  // output tokens is the documented 2K count for gemini-3.1-flash-image and
  // yields $0.1008 against a published $0.101 — the published figure is the
  // rounded display, so the two agree to 0.2% and not exactly.
  it('reproduces the published per-image rate from the documented token count', () => {
    const usd = computeImageCostFromUsage('gemini-3.1-flash-image', {
      promptTokenCount: 0,
      candidatesTokenCount: 1680,
    });
    const published = computeImageCost('gemini-3.1-flash-image', '2K');
    expect(Math.abs(usd - published) / published).toBeLessThan(0.01);
  });

  it('charges prompt tokens at the input rate', () => {
    const withPrompt = computeImageCostFromUsage('gemini-3-pro-image', {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 0,
    });
    expect(withPrompt).toBeCloseTo(2.0, 10);
  });

  it('is zero when the response reported no usage at all', () => {
    expect(computeImageCostFromUsage('gemini-3-pro-image', {})).toBe(0);
  });

  it('throws on an unknown model rather than costing zero', () => {
    expect(() => computeImageCostFromUsage('ghost', { candidatesTokenCount: 1120 })).toThrow(
      UnknownImageModelError,
    );
  });
});

describe('IMAGE_COST_MULTIPLIER', () => {
  // Ten images, every one billed above its published rate. The gate must sit
  // above the worst of them, not near the mean.
  const observed = [1.152, 1.171, 1.261, 1.185, 1.220, 1.169, 1.129, 1.125, 1.113, 1.139];

  it('clears every ratio observed so far', () => {
    expect(IMAGE_COST_MULTIPLIER).toBeGreaterThan(Math.max(...observed));
  });

  it('is a gate, not a mean', () => {
    const mean = observed.reduce((a, b) => a + b, 0) / observed.length;
    expect(IMAGE_COST_MULTIPLIER).toBeGreaterThan(mean);
  });

  it('inflates the run estimate above the published rate', () => {
    const e = estimateImageRunCost({
      modelId: 'gemini-3.1-flash-image', resolution: '2K', slots: 5, candidatesPerSlot: 3,
    });
    expect(e.publishedUsd).toBe(0.101);
    expect(e.perImageUsd).toBeCloseTo(0.101 * IMAGE_COST_MULTIPLIER, 12);
    expect(e.usd).toBeCloseTo(15 * 0.101 * IMAGE_COST_MULTIPLIER, 12);
    expect(e.usd).toBeGreaterThan(15 * 0.101);
  });

  // The gate is for estimates only. A recorded cost must never be inflated.
  it('does not touch computeImageCost or the usage-based actual', () => {
    expect(computeImageCost('gemini-3.1-flash-image', '2K')).toBe(0.101);
    expect(
      computeImageCostFromUsage('gemini-3.1-flash-image', { candidatesTokenCount: 1680 }),
    ).toBeCloseTo(0.1008, 6);
  });

  it('would have covered the real bake-off', () => {
    const budgeted = estimateImageRunCost({
      modelId: 'gemini-3-pro-image', resolution: '2K', slots: 1, candidatesPerSlot: 3,
    }).usd;
    // The three pro images actually billed this much.
    expect(budgeted).toBeGreaterThan(0.151246 + 0.150766 + 0.149086);
  });
});
