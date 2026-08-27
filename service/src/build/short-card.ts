import { MIN_INTRO_S } from './short-card-constants.js';

/**
 * A card too short for the standard entrance gets a faster one.
 *
 * 120 of 343 cards are shorter than `introS + minHoldS`, so a third of the
 * words have nothing readable on screen — a card whose whole life is 1.2 frames
 * never finishes a 3.9-frame fade. **Dropping a word is worse than animating it
 * faster** (Block 7 session 9's ruling).
 *
 * The retiming is **layer time stretch**, not keyframe editing:
 * TEMPLATE_LIBRARY_GUIDE §5 forbids the system touching a template's
 * keyframes, and a stretch scales the whole instance's animation without
 * altering the comp it came from. The same instance can therefore be stretched
 * differently in two masters and the template is untouched either way.
 */
export interface ShortCardTiming {
  /** Layer time stretch as a percentage; 100 leaves the instance alone. */
  stretchPercent: number;
  /** What the entrance actually lasts after the stretch. */
  introS: number;
  /** True when the entrance sat on the floor rather than fitting. */
  onFloor: boolean;
}

/**
 * How much to stretch a card's instance so its entrance and hold fit.
 *
 * A card long enough keeps 100%. A shorter one is compressed in proportion,
 * down to the point where the entrance reaches `MIN_INTRO_S`; below that the
 * entrance stops shrinking and the card is simply short.
 */
export function shortCardTiming(options: {
  cardDurationS: number;
  introS: number;
  minHoldS: number;
}): ShortCardTiming {
  const { cardDurationS, introS, minHoldS } = options;
  const need = introS + minHoldS;
  if (introS <= 0 || cardDurationS >= need - 1e-9) {
    return { stretchPercent: 100, introS, onFloor: false };
  }
  const wanted = Math.max(cardDurationS / need, 0);
  const floor = MIN_INTRO_S / introS;
  const factor = Math.max(wanted, floor);
  return {
    stretchPercent: factor * 100,
    introS: introS * factor,
    onFloor: factor <= floor + 1e-12 && wanted < floor,
  };
}
