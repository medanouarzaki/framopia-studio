import { describe, expect, it } from 'vitest';
import { placementIsSafe, topLeftPlacement, topLeftPlacementDetail } from './top-left.js';
import { insideFrame, type Rect } from './geometry.js';
import {
  FRAME_ASPECT, FRAME_HEIGHT, FRAME_WIDTH, HEAD_CLEARANCE, TOP_LEFT_MARGIN, TOP_LEFT_POSITION_JITTER,
} from './constants.js';

/*
 * `placementIsSafe` is the one declaration of what "clears the face" means, so
 * the test asks it rather than growing the box a second time — the copy here
 * had the same aspect-ratio bug the placement did, and a wrong check cannot
 * catch a wrong rule.
 */

// vitasilk's face over a slot span: the tightest real case in the corpus.
const vitasilkFace: Rect = { x: 0.4213, y: 0.2385, w: 0.30, h: 0.29 };

/**
 * **The corner rule is how images are placed** — the user's ruling in Block 7
 * session 9 and again in session 34, after session 33 moved them off it and he
 * saw the result.
 */
describe('topLeftPlacement', () => {
  /*
   * The margin is one number, so it has to be the same number of pixels on both
   * axes. It was not: the y conversion multiplied by the frame's aspect ratio
   * where a width fraction becomes a height fraction by dividing, putting the
   * top inset at 205 px against the side's 65. Asserted in pixels, because that
   * is the only form in which the two are comparable.
   */
  it('anchors the same distance from the top as from the side', () => {
    // Jitter off: the nudge is what varies, and this is about the anchor.
    const r = topLeftPlacement({ faceBox: null, seed: 'a', jitter: 0 });
    expect(r.x * FRAME_WIDTH).toBeCloseTo(TOP_LEFT_MARGIN * FRAME_WIDTH, 6);
    expect(r.y * FRAME_HEIGHT).toBeCloseTo(TOP_LEFT_MARGIN * FRAME_WIDTH, 6);
  });

  it('never overlaps the face, with its clearance, on the tightest real case', () => {
    for (let i = 0; i < 50; i += 1) {
      const r = topLeftPlacement({ faceBox: vitasilkFace, seed: `slot-${i}` });
      expect(placementIsSafe(r, vitasilkFace).clearsFace, `seed ${i}`).toBe(true);
    }
  });

  /*
   * The corner is bounded by whichever leaves more room: the space beside the
   * speaker or the space above his head. Correcting the units made the space
   * above usable — it had been understated by 327 px — and it is what bounds
   * eight of the corpus's nine slots.
   */
  it('is bounded by the space above the speaker when that is the larger', () => {
    const detail = topLeftPlacementDetail({ faceBox: vitasilkFace, seed: 'a' });
    expect(detail.boundBy).toBe('the space above the speaker');
    expect(detail.cornerSidePx).toBeCloseTo(
      vitasilkFace.y * FRAME_HEIGHT - HEAD_CLEARANCE * FRAME_WIDTH - TOP_LEFT_MARGIN * FRAME_WIDTH,
      6,
    );
  });

  it('never leaves the frame, for any seed or face position', () => {
    for (let i = 0; i < 50; i += 1) {
      for (const face of [null, vitasilkFace, { x: 0.05, y: 0.05, w: 0.9, h: 0.5 }]) {
        const rect = topLeftPlacement({ faceBox: face, seed: `s${i}` });
        expect(insideFrame(rect, 1e-9)).toBe(true);
        expect(placementIsSafe(rect, face).clearsFace).toBe(true);
      }
    }
  });

  /*
   * Retires the size-jitter rule of Block 7 session 9. The user watched a build
   * whose five pictures came out 912, 801, 852, 917 and 871 px and read it as a
   * mistake rather than as variation; jitter moves the square now.
   */
  it('gives every seed the whole square the corner can hold', () => {
    const full = topLeftPlacementDetail({ faceBox: vitasilkFace, seed: 'x', jitter: 0 });
    for (let i = 0; i < 30; i += 1) {
      const d = topLeftPlacementDetail({ faceBox: vitasilkFace, seed: `x${i}` });
      expect(d.rect.w).toBeCloseTo(full.rect.w, 12);
      expect(d.rect.w * FRAME_WIDTH).toBeCloseTo(d.cornerSidePx, 9);
    }
  });

  it('keeps the nudge inside its declared bound, and only ever inward', () => {
    const corner = { x: TOP_LEFT_MARGIN, y: TOP_LEFT_MARGIN / FRAME_ASPECT };
    for (let i = 0; i < 30; i += 1) {
      const d = topLeftPlacementDetail({ faceBox: vitasilkFace, seed: `j${i}` });
      expect(d.offsetPx.x).toBeGreaterThanOrEqual(0);
      expect(d.offsetPx.y).toBeGreaterThanOrEqual(0);
      expect(d.offsetPx.x).toBeLessThanOrEqual(TOP_LEFT_POSITION_JITTER * FRAME_WIDTH + 1e-9);
      expect(d.offsetPx.y).toBeLessThanOrEqual(TOP_LEFT_POSITION_JITTER * FRAME_WIDTH + 1e-9);
      expect(d.rect.x).toBeGreaterThanOrEqual(corner.x - 1e-12);
      expect(d.rect.y).toBeGreaterThanOrEqual(corner.y - 1e-12);
    }
  });

  it('is deterministic for the same seed, and varies position not size', () => {
    expect(topLeftPlacement({ faceBox: vitasilkFace, seed: 'k' })).toEqual(
      topLeftPlacement({ faceBox: vitasilkFace, seed: 'k' }),
    );
    const rects = Array.from({ length: 8 }, (_, i) =>
      topLeftPlacement({ faceBox: vitasilkFace, seed: `v${i}` }),
    );
    expect(new Set(rects.map((r) => r.w)).size).toBe(1);
    expect(new Set(rects.map((r) => `${r.x},${r.y}`)).size).toBeGreaterThan(1);
  });

  /*
   * A square bounded beside the speaker has no room to move right at all — its
   * right edge is already on his clearance — so the nudge has to go the other
   * way or not happen. vitasilk `img002` is the real case.
   */
  it('moves down rather than right when the bound is the speaker beside it', () => {
    const tall: Rect = { x: 0.42, y: 0.02, w: 0.4, h: 0.5 };
    for (let i = 0; i < 30; i += 1) {
      const d = topLeftPlacementDetail({ faceBox: tall, seed: `beside${i}` });
      expect(d.boundBy).toBe('the space beside the speaker');
      expect(d.offsetPx.x).toBe(0);
      expect(placementIsSafe(d.rect, tall).clearsFace).toBe(true);
    }
  });

  it('takes the larger of going left of the face or above it', () => {
    // A face far to the left leaves almost nothing beside it and plenty above.
    const low: Rect = { x: 0.1, y: 0.45, w: 0.6, h: 0.2 };
    const detail = topLeftPlacementDetail({ faceBox: low, seed: 'low', jitter: 0 });
    const beside = low.x * FRAME_WIDTH - HEAD_CLEARANCE * FRAME_WIDTH - TOP_LEFT_MARGIN * FRAME_WIDTH;
    expect(detail.boundBy).toBe('the space above the speaker');
    expect(detail.cornerSidePx).toBeGreaterThan(beside);
    expect(placementIsSafe(detail.rect, low).clearsFace).toBe(true);
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
    expect(asked.wantedSidePx).toBeGreaterThan(asked.rect.w);
    expect(asked.rect.w).toBeCloseTo(full.rect.w, 9);
  });

  it('clears the face at any scale, nudge included', () => {
    for (const scale of [0.7, 1, 1.4, 2]) {
      const d = topLeftPlacementDetail({ faceBox, seed, scale });
      const safe = placementIsSafe(d.rect, faceBox);
      expect(safe.clearsFace).toBe(true);
      expect(safe.insideFrame).toBe(true);
    }
  });

  it('grows into a frame-bounded corner, where there is room to grow', () => {
    const grown = topLeftPlacementDetail({ faceBox: null, seed, scale: 1.4 });
    expect(grown.clamped).toBe(true);
  });
});
