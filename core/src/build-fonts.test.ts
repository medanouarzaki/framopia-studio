import { describe, expect, it } from 'vitest';
import { buildFonts } from './build-fonts.js';
import { ARABIC_FONT, ARABIC_SIZE_RATIO, EMPHASIS_SIZE_RATIO, LATIN_FONT } from './typography.js';

/**
 * The fallback was real but incidental: `requireFonts` throws on a `tbd` mode
 * and nothing outside core has ever called it, so every Block 7 build used the
 * global pair without anyone deciding it should. This states the rule.
 *
 * `k2-syndicalia` stopped being the mode that exercises it at Block 9 session 2
 * — it has its own faces now — so the fallback cases below use a client that
 * really has none, which is every client yet to be made. The `name` here is a
 * fixture, not a claim about K2.
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

  /*
   * A third face is optional, and a client with two must keep building exactly
   * as it did — which is what every mode written before Block 9 session 2 is.
   */
  it('sets emphasised words in the ordinary Latin face when a client has no third', () => {
    const fonts = buildFonts({
      name: 'Two Faces',
      fonts: { status: 'set', latin: 'Fake Sans', arabic: 'Fake Arabic' },
    });

    expect(fonts.emphasis).toBe('Fake Sans');
    expect(fonts.emphasisSource).toBe('latin');
  });

  it('takes the client’s own emphasis face when there is one', () => {
    const fonts = buildFonts({
      name: 'Three Faces',
      fonts: {
        status: 'set',
        latin: 'Fake Sans',
        arabic: 'Fake Arabic',
        emphasis: 'Fake Serif Italic',
      },
    });

    expect(fonts.emphasis).toBe('Fake Serif Italic');
    expect(fonts.emphasisSource).toBe('mode');
  });

  /*
   * 1.0 is CHOSEN, NOT MEASURED and near-certainly wrong — Cormorant sets much
   * smaller than Inter at the same size. Pinned so the day it is measured is a
   * deliberate change with this test in the diff, rather than a number quietly
   * appearing in every build.
   */
  it('reports the emphasis ratio, which nobody has measured', () => {
    expect(EMPHASIS_SIZE_RATIO).toBe(1);
    expect(buildFonts({ name: 'x', fonts: { status: 'tbd' } }).emphasisSizeRatio).toBe(1);
  });

  it('falls back with an emphasis face too, so the field is never absent', () => {
    const fonts = buildFonts({ name: 'x', fonts: { status: 'tbd' } });
    expect(fonts.emphasis).toBe(LATIN_FONT);
    expect(fonts.emphasisSource).toBe('latin');
  });
});
