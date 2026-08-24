import { describe, expect, it } from 'vitest';
import { normalizeWords, splitScriptBoundaries } from './normalize.js';

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
