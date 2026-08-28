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
  /** The composition's start, before which a layer cannot begin. */
  compStartS?: number;
}

export interface SfxPlacement {
  /** When the audio layer starts, snapped to the frame grid. */
  inPointS: number;
  /** Where the peak actually lands after snapping. */
  peakAtS: number;
  /** Frames the peak sits from the impact after snapping; 0 when exact. */
  snapErrorFrames: number;
  /**
   * True when the ideal in-point was before the composition's start and had to
   * be clamped, so the peak lands late by `clampedByS`.
   */
  clamped: boolean;
  clampedByS: number;
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

export function placeSfx(input: SfxPlacementInput): SfxPlacement {
  const { elementStartS, impactS, peakOffsetS, fps, compStartS = 0 } = input;

  // The peak must land here; the layer therefore starts its own peak offset
  // earlier, and that is the whole derivation.
  const impactAtS = elementStartS + impactS;
  const ideal = impactAtS - peakOffsetS;
  const snapped = snapToFrame(ideal, fps);

  /*
   * A file whose peak sits later than the impact needs a negative in-point.
   * Inside a composition that is impossible: a layer cannot begin before the
   * comp does, so the sound is clamped to the start and its peak lands late by
   * the difference. Reported rather than silently absorbed — a hit that is late
   * by a known amount is a decision to make, and one that is late invisibly is
   * the defect this replaces.
   */
  const clamped = snapped < compStartS;
  const inPointS = clamped ? compStartS : snapped;
  const peakAtS = inPointS + peakOffsetS;

  return {
    inPointS,
    peakAtS,
    snapErrorFrames: Number(((peakAtS - impactAtS) * fps).toFixed(4)),
    clamped,
    clampedByS: clamped ? Number((compStartS - snapped).toFixed(6)) : 0,
  };
}
