import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveLang, tagWord, tagWords } from './tagging.js';
import { parseCorrectionResponse } from './correction.js';

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
);

describe('tagWord — script', () => {
  it('reads Arabic script off the characters', () => {
    expect(tagWord({ text: 'شعرك' }).script).toBe('arabic');
    expect(tagWord({ text: 'الكافيين' }).script).toBe('arabic');
  });

  it('treats Arabizi as Latin even with 3, 7 and 9 in it', () => {
    for (const text of ['3ndk', '7essa', 'l7loul', 'bzaf']) {
      expect(tagWord({ text }).script).toBe('latin');
    }
  });

  it('treats French and English as Latin', () => {
    for (const text of ['mésothérapie', "l'effet", 'cocktail']) {
      expect(tagWord({ text }).script).toBe('latin');
    }
  });

  it('prefers what the model said over what the characters show', () => {
    expect(tagWord({ text: 'شعرك', script: 'latin' }).script).toBe('latin');
  });

  it('falls back to the characters when the model says something unknown', () => {
    expect(tagWord({ text: 'شعرك', script: 'cyrillic' }).script).toBe('arabic');
  });
});

describe('tagWord — language', () => {
  it('is null when the model says nothing, rather than guessing darija', () => {
    expect(tagWord({ text: 'bzaf' }).lang).toBeNull();
    expect(tagWord({ text: 'mésothérapie' }).lang).toBeNull();
  });

  it('carries a language the model did supply', () => {
    expect(tagWord({ text: 'bzaf', lang: 'darija' }).lang).toBe('darija');
    expect(tagWord({ text: 'cocktail', lang: 'fr' }).lang).toBe('fr');
  });

  it('rejects a language outside the schema enum', () => {
    expect(tagWord({ text: 'bzaf', lang: 'moroccan' }).lang).toBeNull();
  });
});

describe('tagWords on the recorded correction fixture', () => {
  it('tags every word of a real correction response', () => {
    const raw = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'correction-response.json'), 'utf8'),
    ) as { text: string };
    const words = parseCorrectionResponse(raw.text);
    const tags = tagWords(words);

    expect(tags).toHaveLength(words.length);
    // The vitasilk opening is entirely Arabizi and digits.
    expect(tags.every((t) => t.script === 'latin')).toBe(true);
    expect(tags.every((t) => t.lang === null)).toBe(true);
  });
});

describe('deriveLang — the local cross-check', () => {
  it('recognises French from a closed-class word', () => {
    expect(deriveLang('la')).toBe('fr');
    expect(deriveLang('des')).toBe('fr');
  });

  it('recognises French from an accent Arabizi never carries', () => {
    expect(deriveLang('mésothérapie')).toBe('fr');
    expect(deriveLang('dernière')).toBe('fr');
  });

  it('recognises French from an elided article', () => {
    expect(deriveLang("l'effet")).toBe('fr');
  });

  it('recognises the English words the reels actually use', () => {
    expect(deriveLang('the')).toBe('en');
    expect(deriveLang('glow')).toBe('en');
  });

  it('has no opinion on Arabizi', () => {
    for (const text of ['bzaf', 'ch3rk', 'l7loul', '3ndhom', 'katsnay']) {
      expect(deriveLang(text)).toBeNull();
    }
  });

  it('has no opinion on Arabic script, which could be msa or darija', () => {
    expect(deriveLang('شعرك')).toBeNull();
    expect(deriveLang('نتائج')).toBeNull();
  });

  it('ignores case and edge punctuation', () => {
    expect(deriveLang('Cernes,')).toBe('fr');
  });
});

describe('tagWord — disagreement between the model and the derivation', () => {
  it('flags a conflict without overwriting either side', () => {
    const tags = tagWord({ text: 'mésothérapie', lang: 'darija' });
    expect(tags.lang).toBe('darija');
    expect(tags.derivedLang).toBe('fr');
    expect(tags.langDisagreement).toBe(true);
  });

  it('does not flag when they agree', () => {
    const tags = tagWord({ text: 'mésothérapie', lang: 'fr' });
    expect(tags.langDisagreement).toBe(false);
  });

  it('does not flag when the derivation has no opinion', () => {
    const tags = tagWord({ text: 'bzaf', lang: 'darija' });
    expect(tags.derivedLang).toBeNull();
    expect(tags.langDisagreement).toBe(false);
  });

  it('does not flag when the model said nothing, and still does not guess', () => {
    const tags = tagWord({ text: 'mésothérapie' });
    expect(tags.lang).toBeNull();
    expect(tags.derivedLang).toBe('fr');
    expect(tags.langDisagreement).toBe(false);
  });

  it('carries an out-of-enum model value through as null, not as a conflict', () => {
    const tags = tagWord({ text: 'la', lang: 'french' });
    expect(tags.lang).toBeNull();
    expect(tags.langDisagreement).toBe(false);
  });
});
