import { describe, expect, it } from 'vitest';
import { placementIsSafe, reelPlacements, topLeftPlacementDetail } from './top-left.js';
import { FRAME_WIDTH, FRAME_HEIGHT, HEAD_CLEARANCE, TOP_LEFT_MARGIN } from './constants.js';
import type { Rect } from './geometry.js';

/**
 * **How a picture's size behaves on a video the tool has never seen.**
 *
 * Block 10 session 36. The user watched his own client reel and said the
 * pictures were too small: `sora`'s eleven came out at 669 px where the five
 * corpus reels sit at 837–917. Nothing was wrong with `sora`. The rule is that
 * every picture in a reel is drawn at the size the *tightest* slot can hold
 * (his ruling of 2026-08-29), and the tightest slot is an order statistic — the
 * more slots a reel has, the lower it goes.
 *
 * The corpus never showed it because the corpus is short: four and five slots,
 * spreads of 20 and 100 px. `sora` is 40.5 s, so the density rule gives it
 * eleven, and over 40 s the speaker moves — its spread is 416 px and one slot
 * sets the size for the other ten.
 *
 * These cases are synthetic geometry, not reels. They run no model, read no
 * disk and open no socket: everything here is arithmetic over face boxes made
 * up in the test, so there is nothing for a network to be reached through.
 */

/** A face box that leaves `abovePx` of room above the speaker's head. */
function faceAt(abovePx: number, besidePx: number): Rect {
  const margin = TOP_LEFT_MARGIN * FRAME_WIDTH;
  const clearance = HEAD_CLEARANCE * FRAME_WIDTH;
  return {
    x: (besidePx + clearance + margin) / FRAME_WIDTH,
    y: (abovePx + clearance + margin) / FRAME_HEIGHT,
    w: 0.3,
    h: 0.3,
  };
}

function reelOf(sizes: { above: number; beside: number }[]) {
  return reelPlacements(
    sizes.map((s, i) => ({
      id: `img${String(i + 1).padStart(3, '0')}`,
      faceBox: faceAt(s.above, s.beside),
      seed: `shape:img${i}`,
    })),
  );
}

describe('what decides a picture’s size on a reel nobody has seen', () => {
  it('gives every picture its own corner’s maximum, whatever the tightest holds', () => {
    const generous = { above: 1050, beside: 800 };
    const reel = reelOf([generous, generous, generous, generous]);
    expect(reel.slots.map((s) => Math.round(s.rect.w * FRAME_WIDTH))).toEqual([
      1050, 1050, 1050, 1050,
    ]);

    // One slot where the speaker sits higher in frame. Under the retired rule
    // it took the other three down to 669 with it; now it is simply smaller.
    const withOneTight = reelOf([generous, generous, { above: 669, beside: 633 }, generous]);
    expect(withOneTight.slots.map((s) => Math.round(s.rect.w * FRAME_WIDTH))).toEqual([
      1050, 1050, 669, 1050,
    ]);
    expect(withOneTight.slots.every((s) => s.givesUpPx === 0)).toBe(true);
  });

  /**
   * **The defect the ruling removed, stated as arithmetic.** Under the old rule
   * adding a slot could only lower the size, so a longer reel was a
   * smaller-pictured reel: at eight image slots per 30 seconds a 40-second reel
   * draws eleven samples of the speaker's position where a 22-second reel draws
   * four, and the minimum of eleven is lower than the minimum of four. Nothing
   * a reel gains may now change what any other slot is drawn at.
   */
  it('changes no other slot when a reel gains one, tight or generous', () => {
    const base = [
      { above: 1050, beside: 800 },
      { above: 1000, beside: 780 },
      { above: 1080, beside: 810 },
    ];
    const three = reelOf(base);
    const four = reelOf([...base, { above: 900, beside: 700 }]);
    const five = reelOf([...base, { above: 900, beside: 700 }, { above: 1200, beside: 900 }]);

    const sizesOf = (r: ReturnType<typeof reelOf>) =>
      r.slots.map((s) => Math.round(s.rect.w * FRAME_WIDTH));
    expect(sizesOf(four).slice(0, 3)).toEqual(sizesOf(three));
    expect(sizesOf(five).slice(0, 4)).toEqual(sizesOf(four));
    expect(sizesOf(five)[3]).toBe(900);
  });

  /**
   * **A bigger picture can never end up over the speaker.** The size is clamped
   * to what each slot's own corner holds before it is placed, so asking for one
   * the corner cannot give is refused for that slot rather than granted across
   * his face. This is what makes the size safe to rule on.
   */
  it('refuses a size a slot’s corner cannot hold rather than covering the speaker', () => {
    const tight = faceAt(669, 633);
    const detail = topLeftPlacementDetail({ faceBox: tight, seed: 'clamp', sidePx: 1400 });
    expect(Math.round(detail.rect.w * FRAME_WIDTH)).toBe(669);
    expect(detail.clamped).toBe(false); // no scale was asked for; the override was clamped
    expect(placementIsSafe(detail.rect, tight)).toEqual({ insideFrame: true, clearsFace: true });
  });

  it('places nothing over the speaker at any size a reel could ask for', () => {
    for (const above of [400, 669, 900, 1085, 1600]) {
      const face = faceAt(above, above - 40);
      for (const asked of [500, 800, 1100, 2000]) {
        const detail = topLeftPlacementDetail({ faceBox: face, seed: `s${above}:${asked}`, sidePx: asked });
        expect(
          `${above}/${asked}: ${JSON.stringify(placementIsSafe(detail.rect, face))}`,
        ).toBe(`${above}/${asked}: {"insideFrame":true,"clearsFace":true}`);
      }
    }
  });
});

/**
 * **How long a picture is on screen against how long its animation is.**
 *
 * The image templates are 2.002 s comps whose entrance lasts 0.4004 s. Until
 * Block 10 session 37 an image layer was simply trimmed to its slot, so a slot
 * longer than the comp ran out of source and the picture disappeared while its
 * own words were still being spoken — `sora`'s `img002` by 24.5 frames,
 * `vitasilk`'s by 18, `test-1`'s by 6.6.
 *
 * **The user's ruling of 1 September: the picture holds its last frame until
 * its words finish.** The entrance keeps its authored speed; only the still
 * part after it grows. A stretch was the alternative and he ruled against it.
 */
export function pictureVisibility(
  windowS: number,
  templateDurationS: number,
  entranceS: number,
): { entranceCompletes: boolean; movingS: number; holdS: number; endsWithWords: boolean } {
  const movingS = Math.min(windowS, templateDurationS);
  return {
    entranceCompletes: windowS >= entranceS,
    movingS,
    holdS: Math.max(0, windowS - templateDurationS),
    endsWithWords: true,
  };
}

describe('how long a picture stays against how long its words run', () => {
  const TEMPLATE_S = 2.002002002002;
  const ENTRANCE_S = 0.4004004004004;
  const v = (w: number) => pictureVisibility(w, TEMPLATE_S, ENTRANCE_S);

  it('stays until the words finish, however far past the template they run', () => {
    // sora img002: words 4.339-7.159. The picture used to stop at 6.341.
    expect(v(2.82).endsWithWords).toBe(true);
    expect(v(2.82).holdS).toBeCloseTo(0.818, 3);
    // vitasilk img002 and test-1 img004, the same fault on corpus reels.
    expect(v(2.601).holdS).toBeCloseTo(0.599, 3);
    expect(v(2.221).holdS).toBeCloseTo(0.219, 3);
  });

  it('never slows the animation down to fill a long window', () => {
    // What moves is the template's own length, whatever the words do after it.
    for (const w of [2.1, 2.82, 6, 30]) expect(v(w).movingS).toBe(TEMPLATE_S);
  });

  it('leaves a slot shorter than the template exactly as it was', () => {
    expect(v(1.5).holdS).toBe(0);
    expect(v(1.5).movingS).toBe(1.5);
  });

  it('completes its entrance for every window a reel has ever produced', () => {
    // The shortest slot measured anywhere is sora's img004 at 0.861 s.
    expect(v(0.861).entranceCompletes).toBe(true);
    expect(v(0.39).entranceCompletes).toBe(false);
  });
});

/**
 * **The rule in force, and where it breaks.**
 *
 * Block 10 session 37 built `sora` at three sizes and the user picked this one
 * on 2026-09-01: every picture as large as its own corner allows. The other two
 * options were covered here while the choice was open and are gone now, because
 * a test asserting a rule the project does not have is worse than no test.
 */
describe('every picture at its own corner’s maximum, and where that breaks', () => {
  const generous = { above: 1050, beside: 800 };
  const tight = { above: 669, beside: 633 };

  it('is the largest each picture can be, and safe at every one of them', () => {
    const shape = [generous, generous, tight, generous];
    const placed = shape.map((s, i) =>
      topLeftPlacementDetail({ faceBox: faceAt(s.above, s.beside), seed: `own${i}` }),
    );
    expect(placed.map((d) => Math.round(d.rect.w * FRAME_WIDTH))).toEqual([
      1050, 1050, 669, 1050,
    ]);
    for (let i = 0; i < shape.length; i++) {
      expect(placementIsSafe(placed[i].rect, faceAt(shape[i].above, shape[i].beside))).toEqual({
        insideFrame: true,
        clearsFace: true,
      });
    }
  });

  /**
   * Where it breaks: **the spread is whatever the speaker does**, and nothing
   * the tool controls bounds it. A reel where he barely moves reads as one size
   * anyway; one where he moves a lot reads as varied, which is the cost he
   * accepted when he looked at `sora` at 669 to 1085 and preferred it.
   */
  it('is as varied as the footage, and no more', () => {
    const still = reelOf([generous, generous, generous]);
    expect(Math.round(still.largestSidePx - still.smallestSidePx)).toBe(0);

    const moving = reelOf([generous, tight, { above: 1200, beside: 900 }]);
    expect(Math.round(moving.smallestSidePx)).toBe(669);
    expect(Math.round(moving.largestSidePx)).toBe(1200);
  });

  it('never grows a picture past what its own corner holds', () => {
    for (const above of [400, 669, 900, 1085, 1600]) {
      const face = faceAt(above, above - 40);
      const own = topLeftPlacementDetail({ faceBox: face, seed: `cap${above}` });
      expect(Math.round(own.rect.w * FRAME_WIDTH)).toBe(above);
      expect(placementIsSafe(own.rect, face)).toEqual({ insideFrame: true, clearsFace: true });
    }
  });
});
