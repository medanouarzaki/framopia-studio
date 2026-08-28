import { describe, expect, it } from 'vitest';
import { watermarkEnabled, assertBeepsFitWatermark, placeWatermark, WatermarkBeepsRunLongError } from './watermark.js';
import { insideFrame, type Rect } from './geometry.js';
import {
  FRAME_ASPECT,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  SUBTITLE_BAND,
  watermarkMarginPx,
  WATERMARK_DURATION_S,
  WATERMARK_MARGIN_X,
  WATERMARK_WIDTH_FRACTION,
} from './constants.js';

// The real file: 1924 x 2154, last beep ending at 0.400 s.
const ART = { sourceWidth: 1924, sourceHeight: 2154 };
const TIMING = { lastBeepEndS: 0.4 };
const base = { ...ART, ...TIMING, occupied: [] as Rect[], faceBox: null as Rect | null };

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const band: Rect = { x: 0, y: SUBTITLE_BAND.y, w: 1, h: SUBTITLE_BAND.h };
const vitasilkFace: Rect = { x: 0.2385, y: 0.2073, w: 0.60, h: 0.32 };

describe('placeWatermark', () => {
  /*
   * Block 7 session 11 replaced the derived duration with a flat second. The
   * test that pinned the derived behaviour is gone rather than left green
   * against a rule that no longer applies.
   */
  it('is on screen for a flat second, whatever the beeps do', () => {
    expect(placeWatermark({ ...base, seed: 'r' }).outPointS).toBe(WATERMARK_DURATION_S);
    expect(placeWatermark({ ...base, lastBeepEndS: 0.9, seed: 'r' }).outPointS).toBe(
      WATERMARK_DURATION_S,
    );
    expect(placeWatermark({ ...base, lastBeepEndS: null, seed: 'r' }).outPointS).toBe(
      WATERMARK_DURATION_S,
    );
  });
});

/*
 * The duration stopped following the beeps, so nothing would notice a file whose
 * beeps ran past it — the sound would be cut mid-beep and read as a taste
 * decision. This is what keeps the measurement useful now that it no longer
 * sets the number.
 */
describe('assertBeepsFitWatermark', () => {
  it('accepts the real file, whose last beep ends at 0.400 s', () => {
    expect(() => assertBeepsFitWatermark(0.4)).not.toThrow();
  });

  it('accepts a beep ending exactly on the out point', () => {
    expect(() => assertBeepsFitWatermark(WATERMARK_DURATION_S)).not.toThrow();
  });

  it('refuses a file whose beeps run past the out point, naming both times', () => {
    expect(() => assertBeepsFitWatermark(1.3)).toThrow(WatermarkBeepsRunLongError);
    expect(() => assertBeepsFitWatermark(1.3)).toThrow(/1\.300s but the mark leaves at 1\.000s/);
  });

  it('says nothing when a file has no measured beeps', () => {
    expect(() => assertBeepsFitWatermark(null)).not.toThrow();
  });

  it('is a tenth of the frame wide and keeps the artwork aspect', () => {
    const r = placeWatermark({ ...base, seed: 'r' }).rect;
    expect(r.w).toBeCloseTo(WATERMARK_WIDTH_FRACTION, 10);
    expect(r.w * FRAME_WIDTH).toBeCloseTo(216, 6);
    // 216 px wide at 1924 x 2154 is 241.8 px tall.
    expect(r.h * FRAME_WIDTH * FRAME_ASPECT).toBeCloseTo((216 * 2154) / 1924, 4);
  });

  it('never leaves the frame, for any seed', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(insideFrame(placeWatermark({ ...base, seed: `s${i}` }).rect, 1e-9)).toBe(true);
    }
  });

  it('never sits in the subtitle band', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(overlaps(placeWatermark({ ...base, seed: `s${i}` }).rect, band)).toBe(false);
    }
  });

  it('never overlaps the face, on the real vitasilk face box', () => {
    for (let i = 0; i < 40; i += 1) {
      const p = placeWatermark({ ...base, faceBox: vitasilkFace, seed: `s${i}` });
      expect(overlaps(p.rect, vitasilkFace), `seed ${i}`).toBe(false);
    }
  });

  it('avoids what is already on screen and says why it rejected a corner', () => {
    const topLeftImage: Rect = { x: 0.02, y: 0.02, w: 0.4, h: 0.22 };
    const p = placeWatermark({ ...base, occupied: [topLeftImage], seed: 'img' });
    expect(overlaps(p.rect, topLeftImage)).toBe(false);
    expect(p.rejected.some((r) => r.corner === 'top-left')).toBe(true);
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(placeWatermark({ ...base, seed: 'a' }).corner).toBe(
      placeWatermark({ ...base, seed: 'a' }).corner,
    );
    const corners = new Set(
      Array.from({ length: 12 }, (_, i) => placeWatermark({ ...base, seed: `reel-${i}` }).corner),
    );
    expect(corners.size).toBeGreaterThan(1);
  });

  it('keeps its margin from the edge it lands on', () => {
    for (let i = 0; i < 20; i += 1) {
      const r = placeWatermark({ ...base, seed: `m${i}` }).rect;
      const nearLeft = Math.abs(r.x - WATERMARK_MARGIN_X) < 1e-9;
      const nearRight = Math.abs(1 - (r.x + r.w) - WATERMARK_MARGIN_X) < 1e-9;
      expect(nearLeft || nearRight).toBe(true);
    }
  });
});

describe('who decides whether a reel is marked', () => {
  it('marks a plan that has never been asked, because its reels were marked', () => {
    expect(watermarkEnabled(null)).toBe(true);
    expect(watermarkEnabled({})).toBe(true);
  });

  it('honours an explicit yes and an explicit no', () => {
    expect(watermarkEnabled({ enabled: true })).toBe(true);
    expect(watermarkEnabled({ enabled: false })).toBe(false);
  });
});

/*
 * The two insets are the same number in different units, so a single constant
 * could not make them equal on screen: the mark sits 65 px from the side and
 * 205 px from the top. Splitting them changes nothing today and is what lets
 * the user rule on the figure.
 */
describe('the inset, per axis', () => {
  it('reproduces exactly what the single constant produced', () => {
    const px = watermarkMarginPx();
    expect(px.x).toBeCloseTo(64.8, 1);
    expect(px.y).toBeCloseTo(204.8, 1);
  });

  it('would be equal in pixels only when y is x divided by the aspect', () => {
    const equal = (WATERMARK_MARGIN_X / FRAME_ASPECT) * FRAME_HEIGHT;
    expect(equal).toBeCloseTo(WATERMARK_MARGIN_X * FRAME_WIDTH, 6);
  });
});
