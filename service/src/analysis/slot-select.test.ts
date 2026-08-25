import { describe, expect, it } from 'vitest';
import type { ClientMode } from '@framopia/core';
import {
  composeNegativePrompt,
  composePrompt,
  drawVariation,
  MIN_SLOT_GAP_S,
  planSlots,
} from './slot-select.js';
import { imageSlotCountFor } from './count.js';
import type { AnalysisWord } from './types.js';

const mode = (): ClientMode =>
  ({
    id: 'k2-syndicalia',
    name: 'K2 Syndicalia',
    version: 2,
    palette: { background: '#1A0000', primary: '#820000', accent: '#C9A96E', light: '#F8F6F2' },
    fonts: { status: 'tbd', note: 'n' },
    imageStyle: {
      stylePrompt: ['a single clear idea', 'dominant palette of {{palette.primary}}'],
      negativePrompt: ['no background clutter', 'nothing in frame that is not carrying the idea'],
    },
    imageVariation: {
      note: 'n',
      axes: {
        composition: ['centred', 'off-centre', 'low in frame', 'edge to edge'],
        lighting: ['hard', 'soft', 'rim', 'flat'],
        crop: ['wide', 'medium', 'close', 'macro'],
      },
    },
    allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
    vocabulary: [],
  }) satisfies ClientMode;

// A 20s reel, one word per second.
const words: AnalysisWord[] = Array.from({ length: 20 }, (_, i) => ({
  id: `w${i}`,
  text: `t${i}`,
  start: i,
  end: i + 0.5,
  removed: false,
}));

describe('imageSlotCountFor', () => {
  it('gives the per-30s midpoint at exactly 30 s', () => {
    expect(imageSlotCountFor(30)).toBe(6);
  });

  it('scales pro-rata and floors at one', () => {
    expect(imageSlotCountFor(60)).toBe(11);
    expect(imageSlotCountFor(0)).toBe(1);
    expect(imageSlotCountFor(1)).toBe(1);
  });

  it('gives the five real reels the counts they will run with', () => {
    expect(imageSlotCountFor(21.187833)).toBe(4);
    expect(imageSlotCountFor(21.988646)).toBe(4);
    expect(imageSlotCountFor(22.322313)).toBe(4);
    expect(imageSlotCountFor(23.256567)).toBe(4);
    expect(imageSlotCountFor(25.692333)).toBe(5);
  });

  it('rejects a duration that cannot be scaled', () => {
    expect(() => imageSlotCountFor(-1)).toThrow(RangeError);
    expect(() => imageSlotCountFor(Number.NaN)).toThrow(RangeError);
  });
});

describe('drawVariation', () => {
  it('is deterministic for the same plan and slot', () => {
    expect(drawVariation(mode(), 'plan-a', 0)).toEqual(drawVariation(mode(), 'plan-a', 0));
  });

  it('never gives consecutive slots the same value on an axis', () => {
    for (let i = 0; i < 12; i += 1) {
      const a = drawVariation(mode(), 'plan-a', i);
      const b = drawVariation(mode(), 'plan-a', i + 1);
      for (const axis of Object.keys(a)) expect(a[axis]).not.toBe(b[axis]);
    }
  });

  it('walks the whole axis rather than alternating between two values', () => {
    const seen = new Set(
      Array.from({ length: 4 }, (_, i) => drawVariation(mode(), 'plan-a', i).crop),
    );
    expect(seen.size).toBe(4);
  });

  it('draws differently for a different plan', () => {
    const a = Array.from({ length: 4 }, (_, i) => JSON.stringify(drawVariation(mode(), 'plan-a', i)));
    const b = Array.from({ length: 4 }, (_, i) => JSON.stringify(drawVariation(mode(), 'plan-b', i)));
    expect(a).not.toEqual(b);
  });
});

describe('composePrompt', () => {
  it('puts the idea first, then the invariant style, then the variation', () => {
    const prompt = composePrompt(mode(), 'a bottle on a plinth', { crop: 'close' });
    expect(prompt).toBe(
      'a bottle on a plinth. a single clear idea. dominant palette of #820000. close',
    );
  });

  it('resolves the palette from mode data, never from a literal', () => {
    expect(composePrompt(mode(), 'x', {})).toContain('#820000');
  });

  it('adds the global negatives to the mode ones', () => {
    expect(composeNegativePrompt(mode())).toBe(
      'no background clutter, nothing in frame that is not carrying the idea, no text, no watermark, no logo',
    );
  });
});

describe('planSlots', () => {
  const plan = (candidates: { wordIds: string[]; idea: string }[], requestedCount = 4) =>
    planSlots({ candidates, words, mode: mode(), planId: 'plan-a', requestedCount, durationS: 20 });

  it('spreads slots across the reel, one per window', () => {
    const result = plan([
      { wordIds: ['w0'], idea: 'first' },
      { wordIds: ['w1'], idea: 'also first window' },
      { wordIds: ['w6'], idea: 'second' },
      { wordIds: ['w11'], idea: 'third' },
      { wordIds: ['w16'], idea: 'fourth' },
    ]);
    expect(result.slots.map((s) => s.idea)).toEqual(['first', 'second', 'third', 'fourth']);
    expect(result.failures.map((f) => f.reason)).toEqual(['window-taken']);
    expect(result.shortfall).toBe(0);
  });

  it('rejects a slot that overlaps one already taken', () => {
    const result = plan([
      { wordIds: ['w0', 'w1', 'w2'], idea: 'wide' },
      { wordIds: ['w1'], idea: 'inside it' },
      { wordIds: ['w10'], idea: 'later' },
    ]);
    expect(result.failures.some((f) => f.reason === 'overlaps-a-selected-slot')).toBe(true);
    expect(result.slots.map((s) => s.idea)).toEqual(['wide', 'later']);
  });

  it('rejects a slot closer than the minimum gap', () => {
    const tight: AnalysisWord[] = [
      { id: 'a', text: 'a', start: 0, end: 1, removed: false },
      { id: 'b', text: 'b', start: 1 + MIN_SLOT_GAP_S / 2, end: 2, removed: false },
    ];
    const result = planSlots({
      candidates: [
        { wordIds: ['a'], idea: 'one' },
        { wordIds: ['b'], idea: 'two' },
      ],
      words: tight,
      mode: mode(),
      planId: 'p',
      requestedCount: 2,
      durationS: 20,
    });
    expect(result.slots).toHaveLength(1);
    expect(result.failures[0]?.reason).toBe('too-close');
  });

  it('drops an unresolvable slot and counts it, never fuzzy-matching', () => {
    const result = plan([
      { wordIds: ['w99'], idea: 'ghost' },
      { wordIds: ['w5'], idea: 'real' },
    ]);
    expect(result.slots.map((s) => s.idea)).toEqual(['real']);
    expect(result.failures[0]?.reason).toBe('unknown-word-id');
  });

  it('rejects an empty id list', () => {
    expect(plan([{ wordIds: [], idea: 'nothing' }]).failures[0]?.reason).toBe('empty-word-ids');
  });

  it('reports a shortfall rather than padding a window twice', () => {
    const result = plan([
      { wordIds: ['w0'], idea: 'first' },
      { wordIds: ['w2'], idea: 'same window' },
    ]);
    expect(result.slots).toHaveLength(1);
    expect(result.shortfall).toBe(3);
    expect(result.failures.some((f) => f.reason === 'window-taken')).toBe(true);
  });

  it('reports gaps and uncovered time', () => {
    const result = plan([
      { wordIds: ['w0'], idea: 'a' },
      { wordIds: ['w6'], idea: 'b' },
    ]);
    expect(result.gaps).toEqual([5.5]);
    expect(result.uncoveredS).toBeCloseTo(19, 10);
  });

  it('is deterministic: same candidates, same plan, same slots and prompts', () => {
    const candidates = [
      { wordIds: ['w0'], idea: 'a' },
      { wordIds: ['w6'], idea: 'b' },
      { wordIds: ['w11'], idea: 'c' },
    ];
    expect(JSON.stringify(plan(candidates))).toBe(
      JSON.stringify(plan([...candidates].reverse())),
    );
  });

  it('does not care whether a span is also a keyword', () => {
    // Images are independent of keywords per PROJECT_SPEC §5, so the planner
    // is never told about them: nothing here can prefer or exclude one.
    const result = plan([{ wordIds: ['w0'], idea: 'a' }]);
    expect(result.slots[0]?.wordIds).toEqual(['w0']);
  });
});
