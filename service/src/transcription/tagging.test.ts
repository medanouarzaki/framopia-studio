import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tagWord, tagWords } from './tagging.js';
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
