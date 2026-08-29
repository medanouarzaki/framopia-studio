import { describe, expect, it } from 'vitest';
import { loadMode, snapshotOfMode, type ClientSnapshot } from '@framopia/core';
import { isArabicTemplate, textStyleFor } from './text-style.js';

const K2 = snapshotOfMode(loadMode('k2-syndicalia'), 'now');

function withFonts(fonts: ClientSnapshot['fonts']): ClientSnapshot {
  return { ...K2, fonts };
}

describe('textStyleFor', () => {
  it('sets an ordinary Latin word in the ordinary face, in crème, at the template size', () => {
    const style = textStyleFor({
      kind: 'subtitle',
      templateId: 'sub_pop',
      templateFontSize: 343,
      snapshot: K2,
    });

    expect(style?.font).toBe('Inter-SemiBold');
    // #F8F6F2, the palette's light, as After Effects wants it.
    expect(style?.fillColor.map((v) => Math.round(v * 255))).toEqual([248, 246, 242]);
    expect(style?.fontSize).toBeUndefined();
  });

  it('sets an emphasized Latin word in the emphasis face, in gold, at the ratio', () => {
    const style = textStyleFor({
      kind: 'keyword',
      templateId: 'kw_slam',
      templateFontSize: 425,
      snapshot: K2,
    });

    expect(style?.font).toBe('CormorantGaramondItalic-SemiBoldItalic');
    // #C9A96E, the palette's accent.
    expect(style?.fillColor.map((v) => Math.round(v * 255))).toEqual([201, 169, 110]);
    expect(style?.fontSize).toBe(572.858);
  });

  /*
   * The emphasis face is a Latin serif with no Arabic in it, so an Arabic
   * keyword is gold Almarai rather than gold Cormorant — and its size stays the
   * template's, which is already ARABIC_SIZE_RATIO of the Latin one.
   */
  it('keeps Arabic in its own face at the template’s size, gold when emphasized', () => {
    const subtitle = textStyleFor({
      kind: 'subtitle',
      templateId: 'sub_pop_ar',
      templateFontSize: 367,
      snapshot: K2,
    });
    const keyword = textStyleFor({
      kind: 'keyword',
      templateId: 'kw_slam_ar',
      templateFontSize: 455,
      snapshot: K2,
    });

    expect(subtitle?.font).toBe('Almarai-Bold');
    expect(subtitle?.fontSize).toBeUndefined();
    expect(keyword?.font).toBe('Almarai-Bold');
    expect(keyword?.fontSize).toBeUndefined();
    expect(keyword?.fillColor.map((v) => Math.round(v * 255))).toEqual([201, 169, 110]);
    expect(subtitle?.fillColor.map((v) => Math.round(v * 255))).toEqual([248, 246, 242]);
  });

  it('takes an overridden ratio, which is how one reel is built at two of them', () => {
    const style = textStyleFor({
      kind: 'keyword',
      templateId: 'kw_slam',
      templateFontSize: 425,
      snapshot: K2,
      emphasisSizeRatio: 1.1641,
    });

    expect(style?.fontSize).toBe(494.742);
  });

  /*
   * The defect the whole guard exists for. After Effects accepts a font name it
   * cannot resolve and renders a substitute without saying so, so a build that
   * invented a name would not fail — it would silently set the wrong type. A
   * client with no measured names therefore gets **no style at all**, and the
   * template's own type is left alone.
   */
  describe('a name that has not been checked on a host never reaches a layer', () => {
    it('returns nothing when the client has no measured names', () => {
      expect(
        textStyleFor({
          kind: 'subtitle',
          templateId: 'sub_pop',
          templateFontSize: 343,
          snapshot: withFonts({ status: 'set', latin: 'Inter Semi-Bold', arabic: 'Almarai Bold' }),
        }),
      ).toBeNull();
    });

    it('returns nothing when the client has no fonts at all', () => {
      expect(
        textStyleFor({
          kind: 'subtitle',
          templateId: 'sub_pop',
          templateFontSize: 343,
          snapshot: withFonts({ status: 'tbd', note: 'later' }),
        }),
      ).toBeNull();
    });

    it('returns nothing for an Arabic card when only the Latin name was measured', () => {
      expect(
        textStyleFor({
          kind: 'subtitle',
          templateId: 'sub_pop_ar',
          templateFontSize: 367,
          snapshot: withFonts({
            status: 'set',
            latin: 'A',
            arabic: 'B',
            postScriptNames: { latin: 'A-Reg' },
          }),
        }),
      ).toBeNull();
    });

    it('falls back to the ordinary face when no emphasis name was measured', () => {
      const style = textStyleFor({
        kind: 'keyword',
        templateId: 'kw_slam',
        templateFontSize: 425,
        snapshot: withFonts({
          status: 'set',
          latin: 'A',
          arabic: 'B',
          postScriptNames: { latin: 'A-Reg', arabic: 'B-Bold' },
        }),
      });

      expect(style?.font).toBe('A-Reg');
      // No emphasis face means no emphasis ratio: the size stays the template's.
      expect(style?.fontSize).toBeUndefined();
    });

    /* A name with a space cannot be written to a layer at all. */
    it('never produces a font name containing a space', () => {
      for (const [kind, templateId, size] of [
        ['subtitle', 'sub_pop', 343],
        ['subtitle', 'sub_pop_ar', 367],
        ['keyword', 'kw_slam', 425],
        ['keyword', 'kw_slam_ar', 455],
      ] as const) {
        const style = textStyleFor({ kind, templateId, templateFontSize: size, snapshot: K2 });
        expect(style?.font, templateId).not.toMatch(/\s/);
      }
    });
  });
});

describe('isArabicTemplate', () => {
  it('reads the variant suffix assignTemplates writes', () => {
    expect(isArabicTemplate('sub_pop_ar')).toBe(true);
    expect(isArabicTemplate('kw_slam_ar')).toBe(true);
    expect(isArabicTemplate('sub_pop')).toBe(false);
    expect(isArabicTemplate('kw_slam')).toBe(false);
  });
});
