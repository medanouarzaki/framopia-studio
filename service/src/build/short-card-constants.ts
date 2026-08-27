/**
 * Shortest entrance a subtitle card may be given: two frames at 29.97 fps.
 *
 * **CHOSEN, NOT MEASURED.** Below two frames an entrance stops reading as
 * motion and becomes a flash, which is worse than a card that simply appears.
 * What would change it is the user's eye on a built reel.
 */
export const MIN_INTRO_S = 2 / (30000 / 1001);
