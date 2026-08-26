import { describe, expect, it } from 'vitest';
import type { TemplateEntry } from '@framopia/core';
import {
  applyDisplayTiming,
  displayWindow,
  findShortWords,
  MIN_SANE_WORD_DURATION_S,
} from './display-timing.js';
import type { PlanWord, SubtitleGroup } from '../editplan/types.js';

// Floor of 0.33s, the guide's own subtitle budget.
const sub: TemplateEntry = {
  id: 'sub_pop',
  file: 'library.aep',
  type: 'subtitle',
  placeholders: ['TXT_MAIN'],
  introS: 0.13,
  outroS: 0.13,
  minHoldS: 0.07,
  anchor: 'center',
  imagePresentation: null,
  sfx: [],
  notes: 'n',
};
const templates = new Map([[sub.id, sub]]);

const group = (o: Partial<SubtitleGroup> & { id: string; start: number; end: number }): SubtitleGroup => ({
  wordIds: [`w-${o.id}`],
  templateId: 'sub_pop',
  supersededBy: null,
  ...o,
});

const run = (groups: SubtitleGroup[], reelDurationS = 30) =>
  applyDisplayTiming({ maxWords: 2, groups, templates, reelDurationS });

describe('displayWindow', () => {
  it('falls back to the speech window when a plan predates the fields', () => {
    expect(displayWindow(group({ id: 'g001', start: 1, end: 1.2 }))).toEqual({ start: 1, end: 1.2 });
  });

  it('uses the display fields when they are there', () => {
    const g = { ...group({ id: 'g001', start: 1, end: 1.2 }), displayStart: 1, displayEnd: 1.5 };
    expect(displayWindow(g)).toEqual({ start: 1, end: 1.5 });
  });
});

describe('applyDisplayTiming', () => {
  it('never modifies word timings, which are the single timing authority', () => {
    const groups = [group({ id: 'g001', start: 1, end: 1.1 }), group({ id: 'g002', start: 5, end: 5.5 })];
    const result = run(groups);
    expect(result.groups.map((g) => [g.start, g.end])).toEqual([
      [1, 1.1],
      [5, 5.5],
    ]);
  });

  it('extends a short card forward into the silence that follows it', () => {
    const result = run([group({ id: 'g001', start: 1, end: 1.1 }), group({ id: 'g002', start: 5, end: 5.5 })]);
    expect(result.groups[0]?.displayStart).toBe(1);
    expect(result.groups[0]?.displayEnd).toBeCloseTo(1.33, 10);
    expect(result.unbuildable).toEqual([]);
  });

  it('leaves a card already long enough exactly as it is', () => {
    const result = run([group({ id: 'g001', start: 1, end: 2 })]);
    expect(result.groups[0]?.displayEnd).toBe(2);
  });

  it('never extends into the next group', () => {
    // The next group holds two words, so merging is refused and extension is
    // the only lever; it must stop at the next group's start even though that
    // leaves the card short.
    const result = run([
      group({ id: 'g001', start: 1, end: 1.1, wordIds: ['a'] }),
      group({ id: 'g002', start: 1.25, end: 2, wordIds: ['b', 'c'] }),
    ]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]?.displayEnd).toBeCloseTo(1.25, 10);
    expect(result.unbuildable[0]?.reason).toBe('merge-would-exceed-two-words');
  });

  it('prefers a merge over leaving a card short, when the merge is legal', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.1 }),
      group({ id: 'g002', start: 1.2, end: 2 }),
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.displayEnd).toBe(2);
  });

  it('never extends past the end of the reel', () => {
    const result = run([group({ id: 'g001', start: 9.9, end: 9.95 })], 10);
    expect(result.groups[0]?.displayEnd).toBeLessThanOrEqual(10);
  });

  it('merges with the next group when extension cannot reach the floor', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.05 }),
      group({ id: 'g002', start: 1.06, end: 1.5 }),
    ]);
    expect(result.merged).toEqual([{ from: ['g001', 'g002'], wordIds: ['w-g001', 'w-g002'] }]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.wordIds).toEqual(['w-g001', 'w-g002']);
    expect(result.groups[0]?.templateId).toBeNull();
  });

  it('refuses a merge that would exceed two words', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.05, wordIds: ['a'] }),
      group({ id: 'g002', start: 1.06, end: 1.5, wordIds: ['b', 'c'] }),
    ]);
    expect(result.merged).toEqual([]);
    expect(result.unbuildable[0]?.reason).toBe('merge-would-exceed-two-words');
    expect(result.groups).toHaveLength(2);
  });

  it('never merges a group a keyword supersedes', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.05, supersededBy: 'k001' }),
      group({ id: 'g002', start: 1.06, end: 1.5 }),
    ]);
    expect(result.merged).toEqual([]);
    expect(result.unbuildable[0]?.reason).toBe('merge-blocked-by-keyword');
    expect(result.groups[0]?.supersededBy).toBe('k001');
  });

  it('never merges into a group a keyword supersedes either', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.05 }),
      group({ id: 'g002', start: 1.06, end: 1.5, supersededBy: 'k001' }),
    ]);
    expect(result.merged).toEqual([]);
    expect(result.groups[1]?.supersededBy).toBe('k001');
  });

  it('reports a group it can neither extend nor merge, and changes nothing', () => {
    const groups = [
      group({ id: 'g001', start: 1, end: 1.05, wordIds: ['a'] }),
      group({ id: 'g002', start: 1.06, end: 1.5, wordIds: ['b', 'c'] }),
    ];
    const result = run(groups);
    expect(result.unbuildable[0]).toMatchObject({ wordIds: ['a'], needS: expect.any(Number) });
    expect(result.groups[0]?.start).toBe(1);
    expect(result.groups[0]?.end).toBe(1.05);
  });

  it('accepts a card that exactly meets the floor, despite float arithmetic', () => {
    // 0.13 + 0.07 + 0.13 is 0.33000000000000007 in binary floating point.
    const result = run([group({ id: 'g001', start: 0, end: 0.33 })]);
    expect(result.unbuildable).toEqual([]);
  });

  it('leaves an unassigned group alone rather than guessing a floor', () => {
    const result = run([group({ id: 'g001', start: 1, end: 1.05, templateId: null })]);
    expect(result.unbuildable).toEqual([]);
    expect(result.groups[0]?.displayEnd).toBe(1.05);
  });

  it('is deterministic', () => {
    const groups = [
      group({ id: 'g001', start: 1, end: 1.05 }),
      group({ id: 'g002', start: 1.06, end: 1.5 }),
      group({ id: 'g003', start: 4, end: 4.1 }),
    ];
    expect(JSON.stringify(run(groups))).toBe(JSON.stringify(run(groups)));
  });

  it('renumbers groups contiguously after a merge', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.05 }),
      group({ id: 'g002', start: 1.06, end: 1.5 }),
      group({ id: 'g003', start: 4, end: 4.6 }),
    ]);
    expect(result.groups.map((g) => g.id)).toEqual(['g001', 'g002']);
  });
});

describe('findShortWords', () => {
  const word = (id: string, start: number, end: number, confidence: number | null): PlanWord => ({
    id,
    start,
    end,
    text: id,
    sourceText: id,
    lang: 'darija',
    script: 'latin',
    confidence,
    removed: false,
    removedReason: null,
    edited: false,
  });

  it('reports a zero-duration word and says its timing was interpolated', () => {
    const found = findShortWords([word('w0', 1, 1, null), word('w1', 2, 2.5, 0.9)]);
    expect(found).toEqual([{ id: 'w0', text: 'w0', durationS: 0, interpolated: true }]);
  });

  it('distinguishes a scribe timing from an interpolated one', () => {
    const found = findShortWords([word('w0', 1, 1.02, 0.8)]);
    expect(found[0]?.interpolated).toBe(false);
  });

  it('ignores a removed word, which never renders', () => {
    const removed = { ...word('w0', 1, 1, null), removed: true };
    expect(findShortWords([removed])).toEqual([]);
  });

  it('leaves a word of sane duration alone', () => {
    expect(findShortWords([word('w0', 1, 1 + MIN_SANE_WORD_DURATION_S, 0.9)])).toEqual([]);
  });
});
