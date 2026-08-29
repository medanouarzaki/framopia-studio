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

/** Same floor for image slots: a reel with no image is not a reel we build. */
export const MIN_IMAGE_SLOTS = MIN_KEYWORDS;

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

/**
 * How many images a 30-second reel gets.
 *
 * **8, the user's ruling of 2026-08-29**, amending PROJECT_SPEC §5's band of
 * 5–6. He watched a built reel and asked for more; at 5.5 a 25.7-second reel
 * gets five, and at 8 it gets seven.
 *
 * A mode may set its own `imageSlotsPer30s`, so a client can be denser or
 * sparser than the default without every client moving with it.
 */
export const IMAGE_SLOTS_PER_30S = 8;

/**
 * Images are independent of keywords (§5), so this shares only the rule.
 *
 * **This is the one declaration**, read by the planner and by the dry run, so
 * what a run would plan and what it is priced at cannot drift — session 25's
 * fix, when the dry run computed its own count and read zero for a reel with no
 * slots yet.
 */
export function imageSlotCountFor(durationS: number, perThirtySeconds?: number): number {
  if (!Number.isFinite(durationS) || durationS < 0) {
    throw new RangeError(`image slot count needs a non-negative duration, got ${durationS}`);
  }
  const density = perThirtySeconds ?? IMAGE_SLOTS_PER_30S;
  const exact = (durationS / KEYWORD_WINDOW_S) * density;
  return Math.max(MIN_IMAGE_SLOTS, Math.sign(exact) * Math.round(Math.abs(exact)));
}
