import { describe, expect, it } from 'vitest';
import type { TemplateEntry } from '@framopia/core';
import {
  MAX_SUBTITLE_HOLD_S,
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

  // Block 7 session 7: a card holds until the next card's word, not merely
  // until it reaches its template floor, so the screen is never blank between
  // two cards. The bound is MAX_SUBTITLE_HOLD_S.
  it('holds a short card until the next card begins, up to the bound', () => {
    const result = run([group({ id: 'g001', start: 1, end: 1.1 }), group({ id: 'g002', start: 5, end: 5.5 })]);
    expect(result.groups[0]?.displayStart).toBe(1);
    expect(result.groups[0]?.displayEnd).toBeCloseTo(1 + MAX_SUBTITLE_HOLD_S, 10);
    expect(result.unbuildable).toEqual([]);
  });

  it('holds a card that already reaches its floor, rather than stopping at its word', () => {
    // The next card binds before the hold bound does: 1 + 1.2 would be 2.2.
    const result = run([group({ id: 'g001', start: 1, end: 2 }), group({ id: 'g002', start: 2.15, end: 3 })]);
    expect(result.groups[0]?.displayEnd).toBeCloseTo(2.15, 10);
  });

  it('never ends a card before its own word is finished', () => {
    // The next card starts while this word is still being spoken, which the
    // hold must not shorten it below.
    const result = run([group({ id: 'g001', start: 1, end: 2 }), group({ id: 'g002', start: 1.5, end: 3 })]);
    expect(result.groups[0]?.displayEnd).toBe(2);
  });

  it('holds the last card of a reel to the reel end, under the same bound', () => {
    const short = run([group({ id: 'g001', start: 1, end: 1.1 })], 1.5);
    expect(short.groups[0]?.displayEnd).toBeCloseTo(1.5, 10);
    const long = run([group({ id: 'g001', start: 1, end: 1.1 })], 30);
    expect(long.groups[0]?.displayEnd).toBeCloseTo(1 + MAX_SUBTITLE_HOLD_S, 10);
  });

  it('never exceeds MAX_SUBTITLE_HOLD_S, however long the silence', () => {
    const result = run([group({ id: 'g001', start: 1, end: 1.1 }), group({ id: 'g002', start: 20, end: 20.5 })]);
    const g = result.groups[0];
    expect((g?.displayEnd ?? 0) - (g?.displayStart ?? 0)).toBeCloseTo(MAX_SUBTITLE_HOLD_S, 10);
  });

  it('never starts a window before its own word', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.1 }),
      group({ id: 'g002', start: 3, end: 3.4 }),
    ]);
    for (const g of result.groups) expect(g.displayStart).toBe(g.start);
  });

  it('never overlaps the next card window', () => {
    const result = run([
      group({ id: 'g001', start: 1, end: 1.1 }),
      group({ id: 'g002', start: 1.6, end: 1.7 }),
      group({ id: 'g003', start: 2.0, end: 2.6 }),
    ]);
    for (let i = 1; i < result.groups.length; i += 1) {
      expect(result.groups[i - 1]?.displayEnd).toBeLessThanOrEqual(
        result.groups[i]?.displayStart ?? 0,
      );
    }
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
    // The merged card is the only one, so it holds to the bound rather than
    // stopping at its own last word.
    expect(result.groups[0]?.displayEnd).toBeCloseTo(1 + MAX_SUBTITLE_HOLD_S, 10);
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

  // The hold is about continuity, not about a floor, so a card with no
  // template still holds — but it is never reported unbuildable, because
  // without a template there is no floor to miss. Assignment runs before this
  // pass since session 6, so an untemplated card should not arise in practice.
  it('reports no floor failure for an unassigned group, but still holds it', () => {
    const result = run([group({ id: 'g001', start: 1, end: 1.05, templateId: null })]);
    expect(result.unbuildable).toEqual([]);
    expect(result.groups[0]?.displayEnd).toBeGreaterThan(1.05);
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
