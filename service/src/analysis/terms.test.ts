import { describe, expect, it } from 'vitest';
import type { PlanWord } from '../editplan/types.js';
import { selectTermSpans, termIndexOf } from './terms.js';

function word(id: string, text: string, script: 'latin' | 'arabic', removed = false): PlanWord {
  return {
    id,
    start: 0,
    end: 1,
    text,
    sourceText: text,
    lang: script === 'arabic' ? 'msa' : 'darija',
    script,
    confidence: 1,
    removed,
    removedReason: removed ? 'filler' : null,
    edited: false,
  };
}

// The test-2 run that blocked session 2: eight Arabic words, three terms.
const RUN = [
  word('w1', 'kayji', 'latin'),
  word('w2', 'ترطيب', 'arabic'),
  word('w3', 'عميق', 'arabic'),
  word('w4', 'للبشرة', 'arabic'),
  word('w5', 'شد', 'arabic'),
  word('w6', 'خفيف', 'arabic'),
  word('w7', 'للبشرة', 'arabic'),
  word('w8', 'إشراقة', 'arabic'),
  word('w9', 'ونضارة', 'arabic'),
  word('w10', 'kat7taji', 'latin'),
];

describe('selectTermSpans', () => {
  it('accepts three adjacent terms inside one run', () => {
    const result = selectTermSpans({
      words: RUN,
      terms: [
        { wordIds: ['w2', 'w3', 'w4'] },
        { wordIds: ['w5', 'w6', 'w7'] },
        { wordIds: ['w8', 'w9'] },
      ],
    });
    expect(result.terms).toHaveLength(3);
    expect(result.rejected).toEqual([]);
    expect(result.uncoveredWordIds).toEqual([]);
  });

  it('orders a term by transcript position whatever order the model listed', () => {
    const result = selectTermSpans({ words: RUN, terms: [{ wordIds: ['w4', 'w2', 'w3'] }] });
    expect(result.terms[0]?.wordIds).toEqual(['w2', 'w3', 'w4']);
  });

  it('sorts the terms themselves into transcript order', () => {
    const result = selectTermSpans({
      words: RUN,
      terms: [{ wordIds: ['w8', 'w9'] }, { wordIds: ['w2', 'w3', 'w4'] }],
    });
    expect(result.terms.map((t) => t.wordIds[0])).toEqual(['w2', 'w8']);
  });

  it('rejects a term naming an unknown word', () => {
    const result = selectTermSpans({ words: RUN, terms: [{ wordIds: ['w2', 'nope'] }] });
    expect(result.terms).toEqual([]);
    expect(result.rejected[0]?.reason).toBe('unknown-word-id');
  });

  it('rejects a term containing a Latin word', () => {
    const result = selectTermSpans({ words: RUN, terms: [{ wordIds: ['w1', 'w2'] }] });
    expect(result.rejected[0]?.reason).toBe('not-arabic-script');
  });

  it('rejects a non-contiguous term', () => {
    const result = selectTermSpans({ words: RUN, terms: [{ wordIds: ['w2', 'w4'] }] });
    expect(result.rejected[0]?.reason).toBe('not-contiguous');
  });

  it('rejects a term claiming a word another term already has', () => {
    const result = selectTermSpans({
      words: RUN,
      terms: [{ wordIds: ['w2', 'w3'] }, { wordIds: ['w3', 'w4'] }],
    });
    expect(result.terms).toHaveLength(1);
    expect(result.rejected[0]?.reason).toBe('overlaps-another-term');
  });

  it('rejects a term naming a removed word', () => {
    const words = [word('w1', 'euh', 'arabic', true), word('w2', 'البشرة', 'arabic')];
    const result = selectTermSpans({ words, terms: [{ wordIds: ['w1', 'w2'] }] });
    expect(result.rejected[0]?.reason).toBe('removed-word');
  });

  it('reports Arabic words no term covers rather than inventing one', () => {
    const result = selectTermSpans({ words: RUN, terms: [{ wordIds: ['w2', 'w3', 'w4'] }] });
    expect(result.uncoveredWordIds).toEqual(['w5', 'w6', 'w7', 'w8', 'w9']);
  });
});

describe('termIndexOf', () => {
  it('maps each word to its term and leaves the rest absent', () => {
    const index = termIndexOf([{ wordIds: ['w2', 'w3'] }, { wordIds: ['w8'] }]);
    expect(index.get('w2')).toBe(0);
    expect(index.get('w3')).toBe(0);
    expect(index.get('w8')).toBe(1);
    expect(index.has('w1')).toBe(false);
  });
});
