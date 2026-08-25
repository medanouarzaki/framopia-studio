import { describe, expect, it } from 'vitest';
import { headStem, isDroppable, narrowSpan, significantStems } from './span.js';

const narrow = (tokens: string[]): string[] =>
  narrowSpan(tokens).indices.map((i) => tokens[i] as string);

describe('isDroppable', () => {
  it('drops function words in all three languages', () => {
    for (const t of ['dial', 'li', 'la', 'les', 'the', 'من', 'ديال']) {
      expect(isDroppable(t)).toBe(true);
    }
  });

  it('drops a bare number, which is a qualifier and not the point', () => {
    expect(isDroppable('18')).toBe(true);
    expect(isDroppable('25')).toBe(true);
  });

  it('keeps content words, including Arabizi ones with digits in them', () => {
    for (const t of ['lkolajin', 'chher', '7essass', 'lissage', 'الكولاجين']) {
      expect(isDroppable(t)).toBe(false);
    }
  });

  it('ignores edge punctuation and case', () => {
    expect(isDroppable('La,')).toBe(true);
    expect(isDroppable('Chher.')).toBe(false);
  });
});

describe('narrowSpan', () => {
  it('leaves a one or two word span alone', () => {
    expect(narrowSpan(['lkolajin']).narrowed).toBe(false);
    expect(narrow(['محفزات', 'الكولاجين'])).toEqual(['محفزات', 'الكولاجين']);
    expect(narrowSpan(['محفزات', 'الكولاجين']).narrowed).toBe(false);
  });

  it('narrows a five-token span to its head', () => {
    const tokens = ['la', 'mésothérapie', 'dial', 'المنطقة', 'العينين'];
    expect(narrow(tokens)).toEqual(['mésothérapie']);
    expect(narrowSpan(tokens).narrowed).toBe(true);
  });

  it('narrows a three-token Arabic term to its first two content words', () => {
    expect(narrow(['تحفيز', 'طبيعي', 'للكولاجين'])).toEqual(['تحفيز', 'طبيعي']);
  });

  it('strips the qualifiers off a number span down to the content word', () => {
    expect(narrow(['18', '7ta', 'l', '25', 'chher'])).toEqual(['chher']);
  });

  it('keeps two content words when both survive the trim', () => {
    expect(narrow(['dial', 'lissage', 'brésilien', 'w'])).toEqual(['lissage', 'brésilien']);
  });

  it('returns contiguous indices, always', () => {
    const tokens = ['w', 'chd', 'dial', 'tabi3i', 'lkolajin'];
    const { indices } = narrowSpan(tokens);
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBe((indices[i - 1] as number) + 1);
    }
  });

  it('never returns more than two tokens, whatever it is given', () => {
    const tokens = Array.from({ length: 12 }, (_, i) => `word${i}`);
    expect(narrowSpan(tokens).indices).toHaveLength(2);
  });

  it('keeps something even when every token is droppable', () => {
    expect(narrow(['dial', 'li', 'mn'])).toEqual(['mn']);
  });

  it('handles an empty span', () => {
    expect(narrowSpan([])).toEqual({ indices: [], narrowed: false });
  });
});

describe('headStem', () => {
  it('sees through the Arabic definite article and the l- proclitic', () => {
    expect(headStem('للكولاجين')).toBe(headStem('الكولاجين'));
    expect(headStem('الكولاجين')).toBe('كولاجين');
  });

  it('sees through an attached Latin definite article', () => {
    expect(headStem('lvidéo')).toBe('vidéo');
    expect(headStem("l'acide")).toBe('acide');
  });

  it('refuses to strip a word down to a stub', () => {
    expect(headStem('لبن')).toBe('لبن');
    expect(headStem('lik')).toBe('lik');
  });

  it('leaves an unprefixed word alone', () => {
    expect(headStem('تحفيز')).toBe('تحفيز');
    expect(headStem('chher')).toBe('chher');
  });
});

describe('significantStems', () => {
  it('catches the session-3 collision the model produced', () => {
    const a = significantStems(['محفزات', 'الكولاجين']);
    const b = significantStems(['تحفيز', 'طبيعي', 'للكولاجين']);
    expect([...a].some((s) => b.has(s))).toBe(true);
  });

  it('does not collide two spans that share only a function word', () => {
    const a = significantStems(['dial', 'lissage']);
    const b = significantStems(['dial', 'chher']);
    expect([...a].some((s) => b.has(s))).toBe(false);
  });

  it('does not collide two spans that share only a bare number', () => {
    const a = significantStems(['18', 'chher']);
    const b = significantStems(['18', 'ssa3a']);
    expect([...a].some((s) => b.has(s))).toBe(false);
  });
});
