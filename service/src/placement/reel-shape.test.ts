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
  it('gives every picture the size of the tightest slot, whatever the rest could hold', () => {
    const generous = { above: 1050, beside: 800 };
    const reel = reelOf([generous, generous, generous, generous]);
    expect(Math.round(reel.commonSidePx)).toBe(1050);

    // One slot where the speaker sits higher in frame, and the whole reel
    // follows it down. This is `sora`: ten slots at 881-1085, one at 669.
    const withOneTight = reelOf([generous, generous, { above: 669, beside: 633 }, generous]);
    expect(Math.round(withOneTight.commonSidePx)).toBe(669);
    expect(withOneTight.setBy).toBe('img003');
    expect(withOneTight.slots.filter((s) => s.givesUpPx > 1)).toHaveLength(3);
  });

  /**
   * **The defect, stated as arithmetic.** Adding slots can only lower the size,
   * never raise it, so a longer reel is a smaller-pictured reel whenever the
   * speaker moves at all. At eight image slots per 30 seconds, a 40-second reel
   * draws eleven samples of the speaker's position where a 22-second reel draws
   * four.
   */
  it('never grows when a reel gains a slot, and shrinks whenever the new one is tighter', () => {
    const base = [
      { above: 1050, beside: 800 },
      { above: 1000, beside: 780 },
      { above: 1080, beside: 810 },
    ];
    const four = reelOf(base);
    const five = reelOf([...base, { above: 900, beside: 700 }]);
    const six = reelOf([...base, { above: 900, beside: 700 }, { above: 1200, beside: 900 }]);

    expect(five.commonSidePx).toBeLessThan(four.commonSidePx);
    // A generous sixth slot cannot give the reel anything back.
    expect(six.commonSidePx).toBe(five.commonSidePx);
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
 * **The three sizing rules, so whichever the user picks is already proven.**
 *
 * Block 10 session 37 built `sora` at all three for him to look at. Only the
 * first is in force; the other two are here so that adopting one is a change to
 * the builder and not to what is known about it. Each case says where that rule
 * breaks, which is the part a reel cannot be asked.
 */
describe('the three sizing rules, and where each one breaks', () => {
  const generous = { above: 1050, beside: 800 };
  const tight = { above: 669, beside: 633 };

  it('A — one size, the reel minimum: correct, consistent, and falls as slots are added', () => {
    const reel = reelOf([generous, generous, tight, generous]);
    expect(Math.round(reel.commonSidePx)).toBe(669);
    expect(new Set(reel.slots.map((s) => Math.round(s.rect.w * FRAME_WIDTH))).size).toBe(1);
    // Where it breaks: one tight slot, and every other picture follows it down.
    expect(Math.round(Math.max(...reel.slots.map((s) => s.givesUpPx)))).toBe(381);
  });

  it('B — one size at a floor, with a slot below it left at its own maximum', () => {
    const floorPx = 799;
    const slots = [generous, generous, tight, generous];
    const placed = slots.map((s, i) =>
      topLeftPlacementDetail({ faceBox: faceAt(s.above, s.beside), seed: `b${i}`, sidePx: floorPx }),
    );
    const sizes = placed.map((d) => Math.round(d.rect.w * FRAME_WIDTH));
    expect(sizes).toEqual([799, 799, 669, 799]);
    // Where it breaks: the reel is no longer one size, and the floor is a
    // number no video can be asked for — it has to come from the user's eye.
    expect(new Set(sizes).size).toBe(2);
    for (let i = 0; i < slots.length; i++) {
      const face = faceAt(slots[i].above, slots[i].beside);
      expect(placementIsSafe(placed[i].rect, face)).toEqual({
        insideFrame: true,
        clearsFace: true,
      });
    }
  });

  it('C — each slot at its own maximum: largest, safe, and as varied as the speaker', () => {
    const slots = [generous, generous, tight, generous];
    const placed = slots.map((s, i) =>
      topLeftPlacementDetail({ faceBox: faceAt(s.above, s.beside), seed: `c${i}` }),
    );
    const sizes = placed.map((d) => Math.round(d.rect.w * FRAME_WIDTH));
    expect(sizes).toEqual([1050, 1050, 669, 1050]);
    // Where it breaks: the spread is whatever the speaker does. It is bounded
    // by nothing the tool controls, so a reel where he moves a lot reads as
    // inconsistent — which is the reason the one-size rule exists.
    expect(Math.max(...sizes) - Math.min(...sizes)).toBe(381);
    for (let i = 0; i < slots.length; i++) {
      const face = faceAt(slots[i].above, slots[i].beside);
      expect(placementIsSafe(placed[i].rect, face)).toEqual({
        insideFrame: true,
        clearsFace: true,
      });
    }
  });
});
