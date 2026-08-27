import { describe, expect, it } from 'vitest';
import { buildFonts } from './build-fonts.js';
import { ARABIC_FONT, ARABIC_SIZE_RATIO, LATIN_FONT } from './typography.js';

/**
 * The fallback was real but incidental: `requireFonts` throws on a `tbd` mode
 * and nothing outside core has ever called it, so every Block 7 build used the
 * global pair without anyone deciding it should. This states the rule.
 */
describe('buildFonts', () => {
  it('falls back to the global subtitle pair when a mode has none', () => {
    const fonts = buildFonts({ name: 'K2 Syndicalia', fonts: { status: 'tbd' } });

    expect(fonts.source).toBe('global');
    expect(fonts.latin).toBe(LATIN_FONT);
    expect(fonts.arabic).toBe(ARABIC_FONT);
    expect(fonts.arabicSizeRatio).toBe(ARABIC_SIZE_RATIO);
  });

  it('names both fallback fonts in the warning, so the user knows what will render', () => {
    const { warning } = buildFonts({ name: 'K2 Syndicalia', fonts: { status: 'tbd' } });

    expect(warning).toContain('K2 Syndicalia');
    expect(warning).toContain(LATIN_FONT);
    expect(warning).toContain(ARABIC_FONT);
    expect(warning).toContain('1.07');
    expect(warning).toContain('Block 9');
  });

  it('takes the mode’s own fonts once they are set, with no warning', () => {
    const fonts = buildFonts({
      name: 'K2',
      fonts: { status: 'set', latin: 'Fake Sans', arabic: 'Fake Arabic' },
    });

    expect(fonts).toMatchObject({ source: 'mode', latin: 'Fake Sans', arabic: 'Fake Arabic', warning: null });
  });

  it('falls back rather than trusting a mode that claims set but names nothing', () => {
    expect(buildFonts({ name: 'K2', fonts: { status: 'set' } }).source).toBe('global');
  });
});
