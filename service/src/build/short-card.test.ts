import { describe, expect, it } from 'vitest';
import { shortCardTiming } from './short-card.js';
import { MIN_INTRO_S } from './short-card-constants.js';

const STANDARD = { introS: 0.13, minHoldS: 0.1 };

describe('shortCardTiming', () => {
  it('leaves a card long enough completely alone', () => {
    const t = shortCardTiming({ cardDurationS: 0.5, ...STANDARD });
    expect(t.stretchPercent).toBe(100);
    expect(t.introS).toBe(0.13);
    expect(t.onFloor).toBe(false);
  });

  it('leaves a card exactly at the floor alone', () => {
    expect(shortCardTiming({ cardDurationS: 0.23, ...STANDARD }).stretchPercent).toBe(100);
  });

  it('compresses a short card in proportion', () => {
    // 80% of the room it needs, so 80% of the entrance. The floor sits at
    // 51.3% of the standard entrance, so proportion still governs here.
    const t = shortCardTiming({ cardDurationS: 0.184, ...STANDARD });
    expect(t.stretchPercent).toBeCloseTo(80, 6);
    expect(t.introS).toBeCloseTo(0.104, 6);
    expect(t.onFloor).toBe(false);
  });

  it('never takes the entrance below the floor, however short the card', () => {
    for (const d of [0.12, 0.06, 0.04, 0.02, 0.001, 0]) {
      const t = shortCardTiming({ cardDurationS: d, ...STANDARD });
      expect(t.introS).toBeGreaterThanOrEqual(MIN_INTRO_S - 1e-12);
    }
  });

  it('reports when a card landed on the floor rather than fitting', () => {
    expect(shortCardTiming({ cardDurationS: 0.02, ...STANDARD }).onFloor).toBe(true);
    expect(shortCardTiming({ cardDurationS: 0.184, ...STANDARD }).onFloor).toBe(false);
  });

  it('never stretches a card longer than the template', () => {
    for (const d of [0.001, 0.115, 0.23, 5]) {
      expect(shortCardTiming({ cardDurationS: d, ...STANDARD }).stretchPercent).toBeLessThanOrEqual(100);
    }
  });

  it('is a stretch, so it never asks anyone to move a keyframe', () => {
    // The contract this rests on: the only output is a layer time stretch.
    const t = shortCardTiming({ cardDurationS: 0.05, ...STANDARD });
    expect(Object.keys(t).sort()).toEqual(['introS', 'onFloor', 'stretchPercent']);
  });

  it('leaves a template with no entrance alone', () => {
    expect(shortCardTiming({ cardDurationS: 0.01, introS: 0, minHoldS: 0.1 }).stretchPercent).toBe(100);
  });
});
