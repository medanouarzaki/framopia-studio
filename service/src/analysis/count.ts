/**
 * PROJECT_SPEC §5 states 3–5 emphasized words per 30 s. The reels this runs
 * on are 21–26 s, so the count has to come from duration rather than from the
 * stated range read literally.
 *
 * `KEYWORDS_PER_30S` is the midpoint of that range, not a fourth setting: the
 * spec gives a band and the pipeline needs one number, so it takes the middle
 * of the band and scales it. Changing it changes density for every client.
 */
export const KEYWORDS_PER_30S = 4;
export const KEYWORD_WINDOW_S = 30;

/** No reel gets zero emphasized words, however short it is. */
export const MIN_KEYWORDS = 1;

/**
 * How many keywords a reel of this length gets. Pure and total: the model is
 * never asked how many keywords exist, only which words are the strongest
 * candidates, so this number is imposed on its answer downstream.
 *
 * Rounds half away from zero rather than using `Math.round`, whose half-up
 * behaviour is asymmetric and would make the rule harder to state than to
 * implement.
 */
export function keywordCountFor(durationS: number): number {
  if (!Number.isFinite(durationS) || durationS < 0) {
    throw new RangeError(`keyword count needs a non-negative duration, got ${durationS}`);
  }
  const exact = (durationS / KEYWORD_WINDOW_S) * KEYWORDS_PER_30S;
  return Math.max(MIN_KEYWORDS, Math.sign(exact) * Math.round(Math.abs(exact)));
}
