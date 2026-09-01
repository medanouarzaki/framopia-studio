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
 * The image templates are 2.002 s comps whose entrance lasts 0.4004 s, and the
 * builder gives an image layer no time stretch — cards get one, images do not.
 * So a slot longer than the comp loses its tail: the picture disappears while
 * its own words are still being spoken. `sora`'s `img002` runs 2.820 s and the
 * picture stops at 2.002, twenty-four and a half frames before the sentence
 * ends; `vitasilk`'s `img002` loses eighteen.
 *
 * The two bounds are the template's own duration and its own entrance. Nothing
 * here says what the right answer is — stretching the instance, holding the
 * last frame, or trimming the window is the user's eye.
 */
export function pictureVisibility(
  windowS: number,
  templateDurationS: number,
  entranceS: number,
): { shownS: number; lostAtEndS: number; entranceCompletes: boolean; holdS: number } {
  const shownS = Math.min(windowS, templateDurationS);
  return {
    shownS,
    lostAtEndS: Math.max(0, windowS - templateDurationS),
    entranceCompletes: windowS >= entranceS,
    holdS: Math.max(0, shownS - entranceS),
  };
}

describe('how much of a picture a reel actually shows', () => {
  const TEMPLATE_S = 2.002002002002;
  const ENTRANCE_S = 0.4004004004004;
  const v = (w: number) => pictureVisibility(w, TEMPLATE_S, ENTRANCE_S);

  it('shows the whole animation and no more, however long the words run', () => {
    expect(v(2.002002002002).lostAtEndS).toBe(0);
    expect(v(1.5).lostAtEndS).toBe(0);
    expect(v(1.5).shownS).toBe(1.5);
  });

  it('loses the tail of a window longer than the template, second for second', () => {
    // sora img002: words 4.339-7.159, picture stops at 6.341.
    const sora = v(2.82);
    expect(sora.lostAtEndS).toBeCloseTo(0.818, 3);
    expect(Math.round(sora.lostAtEndS * 29.9700317)).toBe(25);
    // vitasilk img002, the same fault on a corpus reel nobody looked at.
    expect(v(2.601).lostAtEndS).toBeCloseTo(0.599, 3);
  });

  it('completes its entrance for every window a reel has ever produced', () => {
    // The shortest slot measured anywhere is sora's img004 at 0.861 s.
    expect(v(0.861).entranceCompletes).toBe(true);
    expect(v(0.861).holdS).toBeCloseTo(0.461, 3);
    // And it names where that would stop being true.
    expect(v(0.39).entranceCompletes).toBe(false);
  });
});
