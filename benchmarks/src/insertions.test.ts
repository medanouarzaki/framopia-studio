import { describe, expect, it } from 'vitest';
import { analyseEdits, normalizeWithProvenance, type AnalysisWord } from './insertions.js';
import { mapNumeral } from './normalize.js';

const word = (text: string, overrides: Partial<AnalysisWord> = {}): AnalysisWord => ({
  text,
  startS: 1,
  endS: 2,
  lang: 'darija',
  script: 'latin',
  confidence: 0.9,
  ...overrides,
});

describe('normalizeWithProvenance', () => {
  it('maps every normalized slot back to the token it came from', () => {
    const { normalized, sourceIndex } = normalizeWithProvenance(
      ['bghiti', 'واحدcocktail'],
      mapNumeral,
    );
    expect(normalized).toEqual(['bghiti', 'واحد', 'cocktail']);
    expect(sourceIndex).toEqual([0, 1, 1]);
  });

  it('drops tokens that normalize to nothing without shifting the mapping', () => {
    const { normalized, sourceIndex } = normalizeWithProvenance(['a', '—', 'b'], mapNumeral);
    expect(normalized).toEqual(['a', 'b']);
    expect(sourceIndex).toEqual([0, 2]);
  });
});

describe('analyseEdits', () => {
  it('names an inserted token with its timing, tags and context', () => {
    const result = analyseEdits({
      hypothesis: [word('mabin'), word('7ta', { startS: 3, endS: 4 }), word('7essa')],
      reference: ['mabin', '7essa'],
      freezeList: new Set(['7ta']),
      numeralMap: mapNumeral,
    });

    expect(result.inserted).toHaveLength(1);
    const inserted = result.inserted[0];
    expect(inserted?.text).toBe('7ta');
    expect(inserted?.startS).toBe(3);
    expect(inserted?.onFreezeList).toBe(true);
    expect(inserted?.before).toEqual(['mabin']);
    expect(inserted?.after).toEqual(['7essa']);
    expect(result.deleted).toEqual([]);
  });

  it('marks an inserted token whose timing was interpolated', () => {
    const result = analyseEdits({
      hypothesis: [word('mabin'), word('w', { confidence: null }), word('7essa')],
      reference: ['mabin', '7essa'],
      freezeList: new Set(),
      numeralMap: mapNumeral,
    });
    expect(result.inserted[0]?.interpolatedTiming).toBe(true);
  });

  it('names a deleted token by its reference text', () => {
    const result = analyseEdits({
      hypothesis: [word('wa7d'), word('cocktail')],
      reference: ['wa7d', 'l', 'cocktail'],
      freezeList: new Set(),
      numeralMap: mapNumeral,
    });
    expect(result.deleted.map((t) => t.text)).toEqual(['l']);
    expect(result.inserted).toEqual([]);
  });

  it('counts a substitution without listing it as an edit token', () => {
    const result = analyseEdits({
      hypothesis: [word('chhor')],
      reference: ['chhour'],
      freezeList: new Set(),
      numeralMap: mapNumeral,
    });
    expect(result.substitutions).toBe(1);
    expect(result.inserted).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('compares numerals the way WER does, so a spelled-out number is a match', () => {
    const result = analyseEdits({
      hypothesis: [word('khmstach')],
      reference: ['15'],
      freezeList: new Set(),
      numeralMap: mapNumeral,
    });
    expect(result.matches).toBe(1);
    expect(result.inserted).toEqual([]);
  });
});
