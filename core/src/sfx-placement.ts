/**
 * Where a sound's layer starts, so that its loudest point lands on the frame
 * the animation impacts.
 *
 * **The rule this replaces was: file start at the card's start plus 0.13 s.**
 * That assumed a sound's impact is at its first sample. Nothing had measured
 * where the loudest point in any SFX file actually is, and `hit_01`'s is
 * **2.0525 s in** — so its impact was landing over two seconds after the card
 * it belongs to, on every reel, every build.
 *
 * Both inputs are measurements: the peak from `npm run sfx:measure`, the impact
 * frame from the template audit. Neither is authored, and when either is
 * missing this returns null rather than a plausible number.
 */
export interface SfxPlacementInput {
  /** When the element the sound belongs to starts, in seconds on the reel. */
  elementStartS: number;
  /** The template's impact, in seconds from the element's own start. */
  impactS: number;
  /** The file's peak, in seconds from its first sample. */
  peakOffsetS: number;
  fps: number;
}

export interface SfxPlacement {
  /**
   * When the audio layer starts, snapped to the frame grid. **May be negative:
   * a layer whose lead-in is longer than the reel in front of its element
   * begins before the composition.**
   */
  inPointS: number;
  /** Where the peak actually lands after snapping. Always the impact. */
  peakAtS: number;
  /** Frames the peak sits from the impact after snapping; 0 when exact. */
  snapErrorFrames: number;
  /** Seconds of the file that fall before the composition and are not heard. */
  beforeCompS: number;
}

/**
 * Rounds to the nearest frame, and **ties round down** — earlier.
 *
 * A sound that arrives a fraction early reads as part of the impact; one that
 * arrives a fraction late reads as a separate event, because the eye has
 * already moved on. Half a frame at 29.97 is 16.7 ms, which is inside the
 * window where the two are heard together, so the direction only matters at
 * the tie and it is spent on being early.
 */
export function snapToFrame(seconds: number, fps: number): number {
  const frames = seconds * fps;
  const rounded = Math.ceil(frames - 0.5);
  return rounded / fps;
}

/**
 * The peak lands on the impact, always — including when that puts the layer's
 * start before the composition.
 *
 * **After Effects honours a negative `startTime`**, observed in Block 8
 * session 28's probe and again in session 29: asked for −0.4671 s it reports
 * −0.4671 s, and for −1.5 s it reports −1.5 s. The portion of the file before
 * frame zero simply is not heard, which is what `beforeCompS` reports.
 *
 * This used to clamp at the composition start, so a sound whose lead-in did not
 * fit played late by the difference — `whoosh_01`'s anchor is 0.6913 s into the
 * file and the first image of a reel sits 0.0990 s in, which put its peak 14
 * frames behind the picture. Session 27 dropped those sounds rather than play
 * them late; nothing is dropped now, because nothing has to be.
 */
export function placeSfx(input: SfxPlacementInput): SfxPlacement {
  const { elementStartS, impactS, peakOffsetS, fps } = input;

  // The peak must land here; the layer therefore starts its own peak offset
  // earlier, and that is the whole derivation.
  const impactAtS = elementStartS + impactS;
  const inPointS = snapToFrame(impactAtS - peakOffsetS, fps);
  const peakAtS = inPointS + peakOffsetS;

  return {
    inPointS,
    peakAtS,
    snapErrorFrames: Number(((peakAtS - impactAtS) * fps).toFixed(4)),
    beforeCompS: inPointS < 0 ? Number((-inPointS).toFixed(6)) : 0,
  };
}
