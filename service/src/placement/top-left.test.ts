import { describe, expect, it } from 'vitest';
import { topLeftPlacement, topLeftPlacementDetail } from './top-left.js';
import { insideFrame, type Rect } from './geometry.js';
import { FRAME_ASPECT, FRAME_WIDTH, HEAD_CLEARANCE, TOP_LEFT_JITTER, TOP_LEFT_MARGIN } from './constants.js';

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const grown = (b: Rect): Rect => ({
  x: b.x - HEAD_CLEARANCE,
  y: b.y - HEAD_CLEARANCE * FRAME_ASPECT,
  w: b.w + 2 * HEAD_CLEARANCE,
  h: b.h + 2 * HEAD_CLEARANCE * FRAME_ASPECT,
});

// vitasilk's face over a slot span: the tightest real case in the corpus.
const vitasilkFace: Rect = { x: 0.4213, y: 0.2385, w: 0.30, h: 0.29 };

describe('topLeftPlacement', () => {
  it('anchors at the margin', () => {
    const r = topLeftPlacement({ faceBox: null, seed: 'a' });
    expect(r.x).toBeCloseTo(TOP_LEFT_MARGIN, 10);
    expect(r.y).toBeCloseTo(TOP_LEFT_MARGIN * FRAME_ASPECT, 10);
  });

  it('never overlaps the face, with its clearance, on the tightest real case', () => {
    for (let i = 0; i < 50; i += 1) {
      const r = topLeftPlacement({ faceBox: vitasilkFace, seed: `slot-${i}` });
      expect(overlaps(r, grown(vitasilkFace)), `seed ${i}`).toBe(false);
    }
  });

  it('never leaves the frame, for any seed or face position', () => {
    for (let i = 0; i < 50; i += 1) {
      for (const face of [null, vitasilkFace, { x: 0.05, y: 0.05, w: 0.9, h: 0.5 }]) {
        expect(insideFrame(topLeftPlacement({ faceBox: face, seed: `s${i}` }), 1e-9)).toBe(true);
      }
    }
  });

  it('jitters only downward, so it can never grow onto the face', () => {
    const full = topLeftPlacement({ faceBox: vitasilkFace, seed: 'x', jitter: 0 });
    for (let i = 0; i < 30; i += 1) {
      expect(topLeftPlacement({ faceBox: vitasilkFace, seed: `x${i}` }).w).toBeLessThanOrEqual(
        full.w + 1e-12,
      );
    }
  });

  it('keeps jitter inside its declared bound', () => {
    const full = topLeftPlacement({ faceBox: vitasilkFace, seed: 'x', jitter: 0 }).w;
    for (let i = 0; i < 30; i += 1) {
      const w = topLeftPlacement({ faceBox: vitasilkFace, seed: `j${i}` }).w;
      expect(w).toBeGreaterThanOrEqual(full * (1 - TOP_LEFT_JITTER) - 1e-12);
    }
  });

  it('is deterministic for the same seed and varies across seeds', () => {
    expect(topLeftPlacement({ faceBox: vitasilkFace, seed: 'k' })).toEqual(
      topLeftPlacement({ faceBox: vitasilkFace, seed: 'k' }),
    );
    const widths = new Set(
      Array.from({ length: 8 }, (_, i) => topLeftPlacement({ faceBox: vitasilkFace, seed: `v${i}` }).w),
    );
    expect(widths.size).toBeGreaterThan(1);
  });

  it('takes the larger of going left of the face or above it', () => {
    // A face low in the frame leaves room above it that beats the room beside.
    const low: Rect = { x: 0.1, y: 0.7, w: 0.6, h: 0.2 };
    const r = topLeftPlacement({ faceBox: low, seed: 'low', jitter: 0 });
    expect(r.w * FRAME_WIDTH).toBeGreaterThan(0.1 * FRAME_WIDTH);
    expect(overlaps(r, grown(low))).toBe(false);
  });
});

describe('imageScale', () => {
  const faceBox = { x: 0.52, y: 0.18, w: 0.3, h: 0.24 };
  const seed = 'plan:img001';

  it('leaves a mode with no scale exactly where it was', () => {
    expect(topLeftPlacement({ faceBox, seed })).toEqual(
      topLeftPlacement({ faceBox, seed, scale: 1 }),
    );
  });

  it('shrinks when the client asks for less', () => {
    const small = topLeftPlacementDetail({ faceBox, seed, scale: 0.6 });
    const full = topLeftPlacementDetail({ faceBox, seed });
    expect(small.rect.w).toBeCloseTo(full.rect.w * 0.6, 9);
    expect(small.clamped).toBe(false);
  });

  /*
   * The corner is already the largest square that clears the face, so asking
   * for more is refused rather than granted over the speaker.
   */
  it('clamps a request the corner cannot hold, and says it clamped', () => {
    const asked = topLeftPlacementDetail({ faceBox, seed, scale: 1.4 });
    const full = topLeftPlacementDetail({ faceBox, seed });
    expect(asked.clamped).toBe(true);
    expect(asked.wantedSide).toBeGreaterThan(asked.rect.w);
    expect(asked.rect.w).toBeCloseTo(full.rect.w, 9);
  });

  it('keeps jitter a shrink at any scale, so nothing sits on the boundary', () => {
    for (const scale of [0.7, 1, 1.4, 2]) {
      const d = topLeftPlacementDetail({ faceBox, seed, scale });
      expect(d.rect.x + d.rect.w).toBeLessThan(faceBox.x - HEAD_CLEARANCE);
    }
  });

  it('grows into a frame-bounded corner, where there is room to grow', () => {
    const grown = topLeftPlacementDetail({ faceBox: null, seed, scale: 1.4 });
    expect(grown.clamped).toBe(true);
  });
});
