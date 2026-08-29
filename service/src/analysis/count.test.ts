import { describe, expect, it } from 'vitest';
import {
  imageSlotCountFor, IMAGE_SLOTS_PER_30S, keywordCountFor, KEYWORDS_PER_30S, MIN_IMAGE_SLOTS,
} from './count.js';

describe('keywordCountFor', () => {
  it('gives the per-30s midpoint at exactly 30 s', () => {
    expect(keywordCountFor(30)).toBe(KEYWORDS_PER_30S);
    expect(keywordCountFor(30)).toBe(4);
  });

  it('scales pro-rata over longer reels', () => {
    expect(keywordCountFor(60)).toBe(8);
    expect(keywordCountFor(90)).toBe(12);
    expect(keywordCountFor(15)).toBe(2);
  });

  it('floors at one however short the reel', () => {
    expect(keywordCountFor(0)).toBe(1);
    expect(keywordCountFor(0.4)).toBe(1);
    expect(keywordCountFor(3)).toBe(1);
    // 3.75s is exactly 0.5 keywords: the floor decides, not the rounding.
    expect(keywordCountFor(3.75)).toBe(1);
  });

  it('rounds to nearest on non-integer durations', () => {
    // 22.0s -> 2.933, 22.5s -> 3.0, 26.0s -> 3.467, 33.75s -> 4.5
    expect(keywordCountFor(22)).toBe(3);
    expect(keywordCountFor(22.5)).toBe(3);
    expect(keywordCountFor(26)).toBe(3);
    expect(keywordCountFor(33.75)).toBe(5);
  });

  it('gives the five real reels the counts they will actually run with', () => {
    expect(keywordCountFor(21.187833)).toBe(3);
    expect(keywordCountFor(21.988646)).toBe(3);
    expect(keywordCountFor(22.322313)).toBe(3);
    expect(keywordCountFor(23.256567)).toBe(3);
    expect(keywordCountFor(25.692333)).toBe(3);
  });

  it('rejects a duration that cannot be scaled', () => {
    expect(() => keywordCountFor(-1)).toThrow(RangeError);
    expect(() => keywordCountFor(Number.NaN)).toThrow(RangeError);
    expect(() => keywordCountFor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

/**
 * The user watched a built reel and asked for more pictures. 5.5 per 30 s gave
 * `vitasilk` five in 25.7 seconds; 8 gives it seven.
 */
describe('image density', () => {
  it('gives vitasilk seven where it gave five', () => {
    expect(imageSlotCountFor(25.7, 5.5)).toBe(5);
    expect(imageSlotCountFor(25.7)).toBe(7);
  });

  it('is 8 per 30 seconds by default', () => {
    expect(IMAGE_SLOTS_PER_30S).toBe(8);
    expect(imageSlotCountFor(30)).toBe(8);
    expect(imageSlotCountFor(60)).toBe(16);
  });

  /* A client may be denser or sparser without every client moving with it. */
  it('takes a client’s own density when the mode names one', () => {
    expect(imageSlotCountFor(30, 4)).toBe(4);
    expect(imageSlotCountFor(30, 12)).toBe(12);
  });

  it('still gives the shortest reel one image', () => {
    expect(imageSlotCountFor(0.5)).toBeGreaterThanOrEqual(MIN_IMAGE_SLOTS);
    expect(imageSlotCountFor(0.5, 1)).toBe(MIN_IMAGE_SLOTS);
  });

  it('refuses a duration that is not one', () => {
    expect(() => imageSlotCountFor(-1)).toThrow(RangeError);
    expect(() => imageSlotCountFor(Number.NaN, 8)).toThrow(RangeError);
  });
});
