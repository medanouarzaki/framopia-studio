import { describe, expect, it } from 'vitest';
import { align, DEFAULT_ALIGN_COSTS, TRANSLITERATION_COSTS } from './align.js';
import {
  hasArabic,
  MIN_CROSS_SCRIPT_COST,
  transliterate,
  transliterationDistance,
  transliterationSubstituteCost,
} from './transliterate.js';

describe('transliterate', () => {
  it('applies ORTHOGRAPHY_GUIDE §2 for the letters the guide names', () => {
    expect(transliterate('ع')).toBe('3');
    expect(transliterate('ح')).toBe('7');
    expect(transliterate('ق')).toBe('9');
    expect(transliterate('خ')).toBe('kh');
    expect(transliterate('ش')).toBe('ch');
    expect(transliterate('غ')).toBe('gh');
  });

  it('drops harakat, which carry no Arabizi letter', () => {
    expect(transliterate('مَنْ')).toBe(transliterate('من'));
  });

  /* A digit or a stray Latin letter is kept, so it can still match itself. */
  it('keeps a character the table does not cover', () => {
    expect(transliterate('26')).toBe('26');
    expect(transliterate('مvita')).toBe('mvita');
  });
});

describe('transliterationDistance', () => {
  it('is zero for the pairings the aligner had no signal on', () => {
    expect(transliterationDistance('من', 'mn')).toBe(0);
    expect(transliterationDistance('شنو', 'chno')).toBe(0);
    expect(transliterationDistance('دقيقة', 'd9i9a')).toBe(0);
  });

  /* `غير` is `ghyr` by the first form and `ghir` by the alternative for ي. */
  it('takes the best of a letter’s accepted forms', () => {
    expect(transliterationDistance('غير', 'ghir')).toBe(0);
    expect(transliterationDistance('نور', 'nour')).toBe(0);
  });

  it('is one for two words with nothing in common', () => {
    expect(transliterationDistance('من', 'ghir')).toBe(1);
  });

  /*
   * Without normalising by length a long pair differing in two characters
   * would score worse than a short pair differing in one, and the aligner
   * would systematically prefer pairing short words.
   */
  it('is normalised by the longer side', () => {
    const short = transliterationDistance('من', 'mx');
    const long = transliterationDistance('كتسني', 'katsnx');
    expect(short).toBeGreaterThan(long);
  });

  it('never exceeds one', () => {
    expect(transliterationDistance('م', 'aaaaaaaaaaaaaaaa')).toBeLessThanOrEqual(1);
  });
});

describe('transliterationSubstituteCost', () => {
  it('leaves a same-script substitution at the flat cost', () => {
    expect(transliterationSubstituteCost('bonjour', 'bonsoir')).toBe(1);
    expect(transliterationSubstituteCost('من', 'غير')).toBe(1);
  });

  /*
   * A perfect transliteration bottoms out above zero: a real match is
   * evidence, a transliteration is a guess that happens to be good, and the
   * two should not cost the same.
   */
  it('floors a perfect transliteration above a match', () => {
    expect(transliterationSubstituteCost('من', 'mn')).toBeCloseTo(MIN_CROSS_SCRIPT_COST);
    expect(MIN_CROSS_SCRIPT_COST).toBeGreaterThan(0);
  });

  it('costs a wrong cross-script pairing the full amount', () => {
    expect(transliterationSubstituteCost('من', 'ghir')).toBeCloseTo(1);
  });

  it('orders the pairing the defect turns on', () => {
    expect(transliterationSubstituteCost('من', 'mn')).toBeLessThan(
      transliterationSubstituteCost('غير', 'mn'),
    );
  });
});

describe('hasArabic', () => {
  it('separates the two scripts', () => {
    expect(hasArabic('من')).toBe(true);
    expect(hasArabic('mn')).toBe(false);
    expect(hasArabic('26')).toBe(false);
  });
});

/**
 * The whole point, in miniature: a run whose corrected side carries one extra
 * token. Under the flat model every pairing costs 1, the paths tie, and the
 * backtrace puts the insertion first and shifts the rest. With a
 * transliteration cost the straight pairing is strictly cheaper.
 */
describe('the run the experiment exists for', () => {
  /*
   * vitasilk's second run in miniature, and the exact shape that produces the
   * defect: four corrected words against three draft tokens, every pair
   * cross-script, closing on an exact match. Under the flat model every path
   * costs the same and the backtrace puts the insertion first, so each word
   * takes the token *before* its own.
   */
  const draft = ['silk', 'من', 'غير', 'أنه', 'et'];
  const corrected = ['silk', 'mn', 'ghir', 'anno', 'il', 'et'];

  const anchors = (costs: Parameters<typeof align>[2]): (string | null)[] =>
    corrected.map((_, hyp) => {
      const pair = align(draft, corrected, costs).find((p) => p.hypIndex === hyp);
      return pair === undefined || pair.refIndex === null ? null : (draft[pair.refIndex] as string);
    });

  it('shifts under the default model: every word takes the token before its own', () => {
    expect(anchors(DEFAULT_ALIGN_COSTS)).toEqual(['silk', null, 'من', 'غير', 'أنه', 'et']);
  });

  it('pairs each word with its own token under the transliteration model', () => {
    expect(anchors(TRANSLITERATION_COSTS)).toEqual(['silk', 'من', 'غير', 'أنه', null, 'et']);
  });

  it('leaves the default model byte-identical', () => {
    expect(align(draft, corrected)).toEqual(align(draft, corrected, DEFAULT_ALIGN_COSTS));
  });
});
