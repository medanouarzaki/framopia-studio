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

  it('narrows an over-long span instead of dropping it', () => {
    const long: AnalysisWord[] = [
      { id: 'a0', text: 'la', start: 0, end: 0.2, removed: false },
      { id: 'a1', text: 'mésothérapie', start: 0.2, end: 1.0, removed: false },
      { id: 'a2', text: 'dial', start: 1.0, end: 1.2, removed: false },
      { id: 'a3', text: 'المنطقة', start: 1.2, end: 1.8, removed: false },
      { id: 'a4', text: 'العينين', start: 1.8, end: 2.4, removed: false },
    ];
    const result = selectKeywords(
      [cand({ wordIds: ['a0', 'a1', 'a2', 'a3', 'a4'], text: 'la mésothérapie dial المنطقة العينين', score: 0.9 })],
      long,
      1,
    );
    expect(result.items[0]?.text).toBe('mésothérapie');
    expect(result.items[0]?.wordIds).toEqual(['a1']);
    expect(result.items[0]?.start).toBe(0.2);
    expect(result.items[0]?.end).toBe(1.0);
    expect(result.narrowed).toEqual([
      {
        originalWordIds: ['a0', 'a1', 'a2', 'a3', 'a4'],
        originalText: 'la mésothérapie dial المنطقة العينين',
        wordIds: ['a1'],
        text: 'mésothérapie',
      },
    ]);
    expect(result.failures).toEqual([]);
  });

  it('narrows a three-token Arabic term, which the guide treats as one unit', () => {
    const arabic: AnalysisWord[] = [
      { id: 'b0', text: 'تحفيز', start: 0, end: 0.5, removed: false },
      { id: 'b1', text: 'طبيعي', start: 0.5, end: 1.0, removed: false },
      { id: 'b2', text: 'للكولاجين', start: 1.0, end: 1.6, removed: false },
    ];
    const result = selectKeywords(
      [cand({ wordIds: ['b0', 'b1', 'b2'], text: 'تحفيز طبيعي للكولاجين', score: 0.9 })],
      arabic,
      1,
    );
    expect(result.items[0]?.text).toBe('تحفيز طبيعي');
    expect(result.narrowed).toHaveLength(1);
  });

  it('never emits a keyword longer than two words', () => {
    const result = selectKeywords(
      [cand({ wordIds: ['w0', 'w1', 'w3', 'w4'], text: 'x', score: 0.9 })],
      words,
      1,
    );
    expect(result.items[0]?.wordIds.length).toBeLessThanOrEqual(2);
  });

  it('skips a candidate sharing a head term and takes the next by score', () => {
    const collide: AnalysisWord[] = [
      { id: 'c0', text: 'محفزات', start: 0, end: 0.5, removed: false },
      { id: 'c1', text: 'الكولاجين', start: 0.5, end: 1.0, removed: false },
      { id: 'c2', text: 'تحفيز', start: 1.0, end: 1.5, removed: false },
      { id: 'c3', text: 'للكولاجين', start: 1.5, end: 2.0, removed: false },
      { id: 'c4', text: 'chher', start: 2.0, end: 2.5, removed: false },
    ];
    const result = selectKeywords(
      [
        cand({ wordIds: ['c0', 'c1'], text: 'محفزات الكولاجين', score: 0.95 }),
        cand({ wordIds: ['c2', 'c3'], text: 'تحفيز للكولاجين', score: 0.92 }),
        cand({ wordIds: ['c4'], text: 'chher', score: 0.5 }),
      ],
      collide,
      2,
    );
    expect(result.items.map((i) => i.text)).toEqual(['محفزات الكولاجين', 'chher']);
    expect(result.failures.map((f) => f.reason)).toEqual(['shares-a-head-term']);
    expect(result.shortfall).toBe(0);
  });

  it('reports a shortfall rather than padding when diversity runs the list out', () => {
    const collide: AnalysisWord[] = [
      { id: 'd0', text: 'lkolajin', start: 0, end: 0.5, removed: false },
      { id: 'd1', text: 'kolajin', start: 0.5, end: 1.0, removed: false },
    ];
    const result = selectKeywords(
      [
        cand({ wordIds: ['d0'], text: 'lkolajin', score: 0.9 }),
        cand({ wordIds: ['d1'], text: 'kolajin', score: 0.8 }),
      ],
      collide,
      3,
    );
    expect(result.items).toHaveLength(1);
    expect(result.shortfall).toBe(2);
    expect(result.failures.map((f) => f.reason)).toEqual(['shares-a-head-term']);
  });

  it('reserves a place for a label and a promise, not just the top scores', () => {
    const result = selectKeywords(
      [
        cand({ wordIds: ['w0'], text: 'bghiti', score: 0.99, kind: 'label' }),
        cand({ wordIds: ['w1'], text: 'chd', score: 0.98, kind: 'label' }),
        cand({ wordIds: ['w3'], text: 'tabi3i', score: 0.20, kind: 'promise' }),
      ],
      words,
      2,
    );
    expect(result.items.map((i) => i.kind).sort()).toEqual(['label', 'promise']);
    expect(result.kindShortfall).toEqual([]);
  });

  it('reports a kind shortfall rather than inventing a kind', () => {
    const result = selectKeywords(
      [
        cand({ wordIds: ['w0'], text: 'bghiti', score: 0.9, kind: 'label' }),
        cand({ wordIds: ['w1'], text: 'chd', score: 0.8, kind: 'label' }),
      ],
      words,
      2,
    );
    expect(result.kindShortfall).toEqual(['promise']);
    expect(result.items.every((i) => i.kind === 'label')).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('carries the kind through to the selected item', () => {
    const result = selectKeywords(
      [cand({ wordIds: ['w0'], text: 'bghiti', score: 0.9, kind: 'promise' })],
      words,
      1,
    );
    expect(result.items[0]?.kind).toBe('promise');
  });

  it('lets a label and a promise share a head term', () => {
    const shared: AnalysisWord[] = [
      { id: 'e0', text: 'lkolajin', start: 0, end: 0.5, removed: false },
      { id: 'e1', text: 'kolajin', start: 1, end: 1.5, removed: false },
    ];
    const result = selectKeywords(
      [
        cand({ wordIds: ['e0'], text: 'lkolajin', score: 0.9, kind: 'label' }),
        cand({ wordIds: ['e1'], text: 'kolajin', score: 0.8, kind: 'promise' }),
      ],
      shared,
      2,
    );
    expect(result.items).toHaveLength(2);
    expect(result.failures).toEqual([]);
  });

  it('still refuses two labels on one head term', () => {
    const shared: AnalysisWord[] = [
      { id: 'e0', text: 'lkolajin', start: 0, end: 0.5, removed: false },
      { id: 'e1', text: 'kolajin', start: 1, end: 1.5, removed: false },
    ];
    const result = selectKeywords(
      [
        cand({ wordIds: ['e0'], text: 'lkolajin', score: 0.9, kind: 'label' }),
        cand({ wordIds: ['e1'], text: 'kolajin', score: 0.8, kind: 'label' }),
      ],
      shared,
      2,
    );
    expect(result.items).toHaveLength(1);
    expect(result.failures[0]?.reason).toBe('shares-a-head-term');
  });

  it('leaves unkinded candidates working as they did before', () => {
    const result = selectKeywords(
      [
        cand({ wordIds: ['w4'], text: 'lkolajin', score: 0.9 }),
        cand({ wordIds: ['w0'], text: 'bghiti', score: 0.5 }),
      ],
      words,
      2,
    );
    expect(result.items.map((i) => i.text)).toEqual(['lkolajin', 'bghiti']);
    expect(result.kindShortfall).toEqual(['label', 'promise']);
  });

  it('returns items in score order even though kinds are reserved first', () => {
    const result = selectKeywords(
      [
        cand({ wordIds: ['w0'], text: 'bghiti', score: 0.4, kind: 'promise' }),
        cand({ wordIds: ['w1'], text: 'chd', score: 0.95, kind: 'label' }),
      ],
      words,
      2,
    );
    expect(result.items.map((i) => i.score)).toEqual([0.95, 0.4]);
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
