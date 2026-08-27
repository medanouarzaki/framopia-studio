import { describe, expect, it } from 'vitest';
import { placeWatermark } from './watermark.js';
import { insideFrame, type Rect } from './geometry.js';
import {
  FRAME_ASPECT,
  FRAME_WIDTH,
  SUBTITLE_BAND,
  WATERMARK_MARGIN,
  WATERMARK_WIDTH_FRACTION,
} from './constants.js';

// The real file: 1924 x 2154, last beep ending at 0.400 s.
const ART = { sourceWidth: 1924, sourceHeight: 2154 };
const TIMING = { lastBeepEndS: 0.4, holdAfterLastBeepS: 1 };
const base = { ...ART, ...TIMING, occupied: [] as Rect[], faceBox: null as Rect | null };

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const band: Rect = { x: 0, y: SUBTITLE_BAND.y, w: 1, h: SUBTITLE_BAND.h };
const vitasilkFace: Rect = { x: 0.2385, y: 0.2073, w: 0.60, h: 0.32 };

describe('placeWatermark', () => {
  it('derives its out point from the measured beep rather than a constant', () => {
    expect(placeWatermark({ ...base, seed: 'r' }).outPointS).toBeCloseTo(1.4, 10);
    // A different file recomputes rather than inheriting 1.4.
    expect(
      placeWatermark({ ...base, lastBeepEndS: 0.9, seed: 'r' }).outPointS,
    ).toBeCloseTo(1.9, 10);
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
      const nearLeft = Math.abs(r.x - WATERMARK_MARGIN) < 1e-9;
      const nearRight = Math.abs(1 - (r.x + r.w) - WATERMARK_MARGIN) < 1e-9;
      expect(nearLeft || nearRight).toBe(true);
    }
  });
});
