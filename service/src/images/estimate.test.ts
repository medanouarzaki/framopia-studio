import { describe, expect, it } from 'vitest';
import {
  GEMINI_IMAGE_MODEL_FLASH,
  GEMINI_IMAGE_MODEL_PRO,
  IMAGE_COST_MULTIPLIER,
} from '@framopia/core';
import { parseImageConfig } from './config.js';
import { assertWithinCeiling, estimateRun, formatEstimate, ImageBudgetExceededError } from './estimate.js';

describe('estimateRun', () => {
  it('costs a five-slot reel at three candidates on each model', () => {
    const flash = estimateRun(5, parseImageConfig({
      modelId: GEMINI_IMAGE_MODEL_FLASH, candidatesPerSlot: 3 }));
    const pro = estimateRun(5, parseImageConfig({
      modelId: GEMINI_IMAGE_MODEL_PRO, candidatesPerSlot: 3 }));
    expect(flash.images).toBe(15);
    // Budgeted figures carry the gate multiplier; published rates do not.
    expect(flash.publishedUsd).toBe(0.067);
    expect(flash.usd).toBeCloseTo(15 * 0.067 * IMAGE_COST_MULTIPLIER, 10);
    expect(pro.usd).toBeCloseTo(15 * 0.134 * IMAGE_COST_MULTIPLIER, 10);
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
    expect(text).toMatch(/\$0\.0670 published per image/);
    expect(text).toMatch(/budgeted at \$0\.0905/);
    expect(text).toMatch(/8 images/);
  });

  it('discounts what is already cached', () => {
    const e = estimateRun(4, parseImageConfig());
    expect(formatEstimate(e, 8)).toMatch(/\$0\.0000/);
    expect(formatEstimate(e, 8)).toMatch(/8 already cached, 0 to generate/);
  });
});

describe('the §5.4 candidate default', () => {
  /**
   * Amended from 3 to 2 at Block 4 session 5. pro bills ~$0.151 per 2K image,
   * so three candidates on a five-slot reel is $2.26 — outside PROJECT_SPEC's
   * $2.00 per-reel envelope before a single retry.
   */
  it('puts a five-slot pro reel inside the per-reel envelope', () => {
    const published = estimateRun(5, parseImageConfig({ modelId: GEMINI_IMAGE_MODEL_PRO }));
    expect(published.candidatesPerSlot).toBe(2);
    expect(published.images).toBe(10);
    expect(published.publishedUsd * published.images).toBeLessThan(2.0);
  });

  it('would not have at three', () => {
    const three = estimateRun(5, parseImageConfig({
      modelId: GEMINI_IMAGE_MODEL_PRO, candidatesPerSlot: 3 }));
    expect(three.publishedUsd * three.images).toBeGreaterThan(2.0);
  });
});
