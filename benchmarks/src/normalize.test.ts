import { describe, expect, it } from 'vitest';
import { normalizeForWer, normalizeToken, normalizeWords, splitScriptBoundaries } from './normalize.js';

describe('splitScriptBoundaries', () => {
  it('splits a joined arabic/latin token, the real واحدcocktail case', () => {
    expect(splitScriptBoundaries('واحدcocktail')).toEqual(['واحد', 'cocktail']);
  });

  it('leaves a single-script token alone', () => {
    expect(splitScriptBoundaries('mésothérapie')).toEqual(['mésothérapie']);
    expect(splitScriptBoundaries('الكولاجين')).toEqual(['الكولاجين']);
  });

  it('keeps latin punctuation attached to its latin side', () => {
    expect(splitScriptBoundaries("l'ADNالحمض")).toEqual(["l'ADN", 'الحمض']);
  });
});

describe('normalizeWords — script boundaries', () => {
  it('costs a join one extra token rather than mangling the whole word', () => {
    expect(normalizeWords(['wa7d', 'واحدcocktail', 'dl'])).toEqual([
      'wa7d',
      'واحد',
      'cocktail',
      'dl',
    ]);
  });
});

describe('normalizeForWer — numerals', () => {
  it('maps the spelled-out forms the engines produced onto digits', () => {
    expect(normalizeForWer(['khmstach', 'yom'])).toEqual(['15', 'yom']);
    expect(normalizeForWer(['rb3a'])).toEqual(['4']);
    expect(normalizeForWer(['tmentach', 'tal', '3chrin'])).toEqual(['18', 'tal', '20']);
  });

  it('leaves a digit the ground truth already wrote alone', () => {
    expect(normalizeForWer(['15', 'yom'])).toEqual(['15', 'yom']);
  });

  it('does not touch wa7d or joj, which are articles here and not numerals', () => {
    expect(normalizeForWer(['wa7d', 'le', 'cocktail'])).toEqual(['wa7d', 'le', 'cocktail']);
    expect(normalizeForWer(['joj', 'dial', 'l7essass'])).toEqual(['joj', 'dial', 'l7essass']);
  });

  it('still splits mixed-script tokens on the way through', () => {
    expect(normalizeForWer(['واحدcocktail'])).toEqual(['واحد', 'cocktail']);
  });
});

describe('normalizeToken — arabic punctuation', () => {
  it('strips an arabic question mark the ground truth attached to a word', () => {
    expect(normalizeToken('للوجه؟')).toBe('للوجه');
    expect(normalizeToken('للوجه')).toBe('للوجه');
  });

  it('leaves the arabic letters themselves untouched', () => {
    expect(normalizeToken('المنطقة')).toBe('المنطقة');
  });
});
