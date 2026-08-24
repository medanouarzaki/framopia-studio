import { describe, expect, it } from 'vitest';
import { align, computeSubsetWer, computeWer, scoreAlignment } from './wer.js';
import type { GroundTruthWord } from './types.js';

describe('computeWer', () => {
  it('is zero for an identical hypothesis', () => {
    const result = computeWer(['wach', 'nta', 'mzyan'], ['wach', 'nta', 'mzyan']);
    expect(result.wer).toBe(0);
    expect(result.matches).toBe(3);
  });

  it('counts a single substitution', () => {
    // reference: wach nta mzyan / hyp: wach nta zwina -> 1 sub / 3 ref words
    const result = computeWer(['wach', 'nta', 'mzyan'], ['wach', 'nta', 'zwina']);
    expect(result.substitutions).toBe(1);
    expect(result.wer).toBeCloseTo(1 / 3, 12);
  });

  it('counts a single insertion', () => {
    // hyp has an extra word not in reference
    const result = computeWer(['wach', 'nta'], ['wach', 'daba', 'nta']);
    expect(result.insertions).toBe(1);
    expect(result.wer).toBeCloseTo(1 / 2, 12);
  });

  it('counts a single deletion', () => {
    // hyp is missing a reference word
    const result = computeWer(['wach', 'nta', 'mzyan'], ['wach', 'mzyan']);
    expect(result.deletions).toBe(1);
    expect(result.wer).toBeCloseTo(1 / 3, 12);
  });

  it('normalizes case and terminal punctuation before scoring', () => {
    const result = computeWer(['Wach', 'nta?'], ['wach', 'nta']);
    expect(result.wer).toBe(0);
  });

  it('preserves 3/7/9 as letters, not punctuation', () => {
    const result = computeWer(['3lach'], ['3lach']);
    expect(result.wer).toBe(0);
  });
});

describe('align', () => {
  it('produces a full match alignment for identical sequences', () => {
    const pairs = align(['a', 'b'], ['a', 'b']);
    expect(pairs.every((p) => p.op === 'match')).toBe(true);
  });
});

describe('computeSubsetWer', () => {
  const referenceWords: GroundTruthWord[] = [
    { text: 'wach', lang: 'darija', script: 'latin' },
    { text: 'kanposter', lang: 'darija', script: 'latin' },
    { text: 'le', lang: 'fr', script: 'latin' },
    { text: 'contenu', lang: 'fr', script: 'latin' },
    { text: 'daba', lang: 'darija', script: 'latin' },
  ];

  it('scores only the code-switched (fr) subset', () => {
    // hypothesis gets the fr words wrong, darija words right
    const hypothesis = ['wach', 'kanposter', 'la', 'contenu', 'daba'];
    const result = computeSubsetWer(referenceWords, hypothesis, ['fr']);
    expect(result.referenceCount).toBe(2);
    expect(result.substitutions).toBe(1);
    expect(result.wer).toBeCloseTo(0.5, 12);
  });

  it('scores only the darija subset', () => {
    const hypothesis = ['wach', 'kanposter', 'la', 'contenu', 'daba'];
    const result = computeSubsetWer(referenceWords, hypothesis, ['darija']);
    expect(result.referenceCount).toBe(3);
    expect(result.wer).toBe(0);
  });
});

describe('scoreAlignment', () => {
  it('handles an empty reference without dividing by zero', () => {
    const result = scoreAlignment(align([], []));
    expect(result.wer).toBe(0);
    expect(result.referenceCount).toBe(0);
  });
});

describe('computeWer — mixed-script joins', () => {
  it('charges a joined token one error instead of derailing the alignment', () => {
    const reference = ['wa7d', 'واحد', 'cocktail', 'dial'];
    const joined = computeWer(reference, ['wa7d', 'واحدcocktail', 'dial']);
    expect(joined.wer).toBe(0);
  });
});
