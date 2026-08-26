import { describe, expect, it } from 'vitest';
import {
  ARABIC_SIZE_RATIO,
  FONT_METRICS,
  inkExtent,
  KEYWORD_FONT_SIZE,
  SUBTITLE_FONT_SIZE,
  worstCaseExtent,
} from './typography.js';

describe('font metrics', () => {
  // The raw values read from the two font files with fontTools. Pinned so that
  // editing them is a deliberate act with a re-measurement behind it, rather
  // than a number nudged until a placement fits.
  it('pins the extents read from the installed font files', () => {
    expect(FONT_METRICS.latin).toEqual({ unitsPerEm: 2048, ascent: 2269, descent: 660 });
    expect(FONT_METRICS.arabic).toEqual({ unitsPerEm: 1000, ascent: 1108, descent: 453 });
  });

  it('scales linearly with size', () => {
    const single = inkExtent('latin', 100);
    const double = inkExtent('latin', 200);
    expect(double.ascentPx).toBeCloseTo(single.ascentPx * 2, 10);
    expect(double.descentPx).toBeCloseTo(single.descentPx * 2, 10);
  });

  it('reads Inter at the keyword size', () => {
    const { ascentPx, descentPx } = inkExtent('latin', KEYWORD_FONT_SIZE);
    expect(ascentPx).toBeCloseTo(470.8618, 3);
    expect(descentPx).toBeCloseTo(136.9629, 3);
  });

  it('reads Almarai at the keyword size, which carries the 1.07 ratio', () => {
    const { ascentPx, descentPx } = inkExtent('arabic', KEYWORD_FONT_SIZE * ARABIC_SIZE_RATIO);
    expect(ascentPx).toBeCloseTo(503.863, 3);
    expect(descentPx).toBeCloseTo(206.0018, 3);
  });
});

describe('worstCaseExtent', () => {
  it('is Almarai in both directions, which is why the band is built on it', () => {
    const worst = worstCaseExtent();
    const latin = inkExtent('latin', KEYWORD_FONT_SIZE);
    const arabic = inkExtent('arabic', KEYWORD_FONT_SIZE * ARABIC_SIZE_RATIO);
    expect(arabic.ascentPx).toBeGreaterThan(latin.ascentPx);
    expect(arabic.descentPx).toBeGreaterThan(latin.descentPx);
    expect(worst).toEqual(arabic);
  });

  it('covers the subtitle size too, so one band serves both tracks', () => {
    const worst = worstCaseExtent();
    for (const face of ['latin', 'arabic'] as const) {
      const size = face === 'arabic' ? SUBTITLE_FONT_SIZE * ARABIC_SIZE_RATIO : SUBTITLE_FONT_SIZE;
      const sub = inkExtent(face, size);
      expect(sub.ascentPx).toBeLessThanOrEqual(worst.ascentPx);
      expect(sub.descentPx).toBeLessThanOrEqual(worst.descentPx);
    }
  });
});
