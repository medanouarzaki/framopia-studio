import { describe, expect, it } from 'vitest';
import { GEMINI_IMAGE_MODEL_FLASH, GEMINI_IMAGE_MODEL_PRO } from '@framopia/core';
import { parseImageConfig } from './config.js';
import { assertWithinCeiling, estimateRun, formatEstimate, ImageBudgetExceededError } from './estimate.js';

describe('estimateRun', () => {
  it('costs a five-slot reel at three candidates on each model', () => {
    const flash = estimateRun(5, parseImageConfig({ modelId: GEMINI_IMAGE_MODEL_FLASH }));
    const pro = estimateRun(5, parseImageConfig({ modelId: GEMINI_IMAGE_MODEL_PRO }));
    expect(flash.images).toBe(15);
    expect(flash.usd).toBeCloseTo(15 * 0.067, 10);
    expect(pro.usd).toBeCloseTo(15 * 0.134, 10);
    expect(pro.usd).toBeGreaterThan(flash.usd);
  });

  it('is zero for a plan with no slots', () => {
    expect(estimateRun(0, parseImageConfig()).usd).toBe(0);
  });
});

describe('assertWithinCeiling', () => {
  it('passes at the ceiling and throws above it', () => {
    const e = estimateRun(5, parseImageConfig());
    expect(() => assertWithinCeiling(e, e.usd)).not.toThrow();
    expect(() => assertWithinCeiling(e, e.usd - 0.0001)).toThrow(ImageBudgetExceededError);
  });

  it('says what was estimated and that nothing was generated', () => {
    const e = estimateRun(5, parseImageConfig());
    expect(() => assertWithinCeiling(e, 0.01)).toThrow(/Nothing was generated/);
  });
});

describe('formatEstimate', () => {
  it('names the model and the per-image rate', () => {
    const text = formatEstimate(estimateRun(4, parseImageConfig()));
    expect(text).toMatch(GEMINI_IMAGE_MODEL_FLASH);
    expect(text).toMatch(/\$0\.0670 per image/);
    expect(text).toMatch(/12 images/);
  });

  it('discounts what is already cached', () => {
    const e = estimateRun(4, parseImageConfig());
    expect(formatEstimate(e, 12)).toMatch(/\$0\.0000/);
    expect(formatEstimate(e, 12)).toMatch(/12 already cached, 0 to generate/);
  });
});
