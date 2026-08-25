import { describe, expect, it } from 'vitest';
import { selectKeywords } from './select.js';
import type { AnalysisWord, KeywordCandidate } from './types.js';

const words: AnalysisWord[] = [
  { id: 'w0', text: 'bghiti', start: 0, end: 0.4, removed: false },
  { id: 'w1', text: 'chd', start: 0.4, end: 0.9, removed: false },
  { id: 'w2', text: 'euh', start: 0.9, end: 1.0, removed: true },
  { id: 'w3', text: 'tabi3i', start: 1.0, end: 1.6, removed: false },
  { id: 'w4', text: 'lkolajin', start: 1.6, end: 2.3, removed: false },
];

const cand = (o: Partial<KeywordCandidate>): KeywordCandidate => ({
  wordIds: ['w0'],
  text: 'bghiti',
  score: 0.5,
  reason: 'r',
  ...o,
});

describe('selectKeywords', () => {
  it('takes the top N by score and imposes the count', () => {
    const result = selectKeywords(
      [
        cand({ wordIds: ['w0'], text: 'bghiti', score: 0.2 }),
        cand({ wordIds: ['w4'], text: 'lkolajin', score: 0.9 }),
        cand({ wordIds: ['w1'], text: 'chd', score: 0.6 }),
      ],
      words,
      2,
    );
    expect(result.items.map((i) => i.text)).toEqual(['lkolajin', 'chd']);
    expect(result.requestedCount).toBe(2);
  });

  it('breaks a score tie on start time, not on incoming order', () => {
    const later = cand({ wordIds: ['w4'], text: 'lkolajin', score: 0.7 });
    const earlier = cand({ wordIds: ['w1'], text: 'chd', score: 0.7 });
    expect(selectKeywords([later, earlier], words, 2).items.map((i) => i.text)).toEqual([
      'chd',
      'lkolajin',
    ]);
    expect(selectKeywords([earlier, later], words, 2).items.map((i) => i.text)).toEqual([
      'chd',
      'lkolajin',
    ]);
  });

  it('drops an unresolvable word id and counts it, never repairing it', () => {
    const result = selectKeywords(
      [cand({ wordIds: ['w99'], text: 'ghost', score: 0.9 }), cand({ score: 0.1 })],
      words,
      2,
    );
    expect(result.items.map((i) => i.text)).toEqual(['bghiti']);
    expect(result.failures).toEqual([
      { candidate: expect.objectContaining({ wordIds: ['w99'] }), reason: 'unknown-word-id' },
    ]);
  });

  it('never lets a removed word become a keyword', () => {
    const result = selectKeywords([cand({ wordIds: ['w2'], text: 'euh', score: 1 })], words, 2);
    expect(result.items).toEqual([]);
    expect(result.failures[0]?.reason).toBe('removed-word');
  });

  it('rejects a keyword overlapping one already selected', () => {
    const result = selectKeywords(
      [
        cand({ wordIds: ['w0', 'w1'], text: 'bghiti chd', score: 0.9 }),
        cand({ wordIds: ['w1'], text: 'chd', score: 0.8 }),
      ],
      words,
      2,
    );
    expect(result.items.map((i) => i.text)).toEqual(['bghiti chd']);
    expect(result.failures[0]?.reason).toBe('overlaps-a-selected-keyword');
  });

  it('rejects an empty id list and a score outside 0-1', () => {
    const result = selectKeywords(
      [cand({ wordIds: [] }), cand({ score: 1.4 }), cand({ score: -0.1 })],
      words,
      3,
    );
    expect(result.items).toEqual([]);
    expect(result.failures.map((f) => f.reason)).toEqual([
      'empty-word-ids',
      'score-out-of-range',
      'score-out-of-range',
    ]);
  });

  it('spans a multi-word term with the outer timestamps', () => {
    const [item] = selectKeywords(
      [cand({ wordIds: ['w3', 'w4'], text: 'tabi3i lkolajin', score: 0.9 })],
      words,
      1,
    ).items;
    expect(item?.start).toBe(1.0);
    expect(item?.end).toBe(2.3);
    expect(item?.wordIds).toEqual(['w3', 'w4']);
  });

  it('takes text from the plan and records a model disagreement', () => {
    const result = selectKeywords(
      [cand({ wordIds: ['w0'], text: 'bghit', score: 0.9 })],
      words,
      1,
    );
    expect(result.items[0]?.text).toBe('bghiti');
    expect(result.textMismatches).toEqual([
      { wordIds: ['w0'], modelText: 'bghit', planText: 'bghiti' },
    ]);
  });

  it('is stable: the same candidates always give the same items', () => {
    const candidates = [
      cand({ wordIds: ['w4'], text: 'lkolajin', score: 0.9 }),
      cand({ wordIds: ['w1'], text: 'chd', score: 0.9 }),
      cand({ wordIds: ['w3'], text: 'tabi3i', score: 0.4 }),
    ];
    const once = selectKeywords(candidates, words, 2);
    const again = selectKeywords([...candidates].reverse(), words, 2);
    expect(again.items).toEqual(once.items);
  });
});
