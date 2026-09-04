import type { ImageSlot } from './types.js';

/**
 * Whether a slot still has to have a picture made for it.
 *
 * **This is what keeps a client's own picture from being bought twice.** A slot
 * the client has already filled needs nothing generated, and generating it
 * anyway is money spent on a square nobody will ever see: session 43 shipped
 * the hand-chosen path and the images stage went on billing for those slots
 * regardless, because it was handed every slot on the plan.
 *
 * It lives here rather than in `service/src/images/` deliberately. That
 * directory must not be able to read a client's pictures —
 * `service/src/clients/pictures.test.ts` fails if any file in it so much as
 * names them — so the image graph asks the general question, *does this need
 * generating*, and is told yes or no without being told why.
 */
export function slotNeedsGenerating(slot: Pick<ImageSlot, 'chosenClientPictureId'>): boolean {
  return slot.chosenClientPictureId === undefined;
}

export function slotsNeedingGeneration<T extends Pick<ImageSlot, 'chosenClientPictureId'>>(
  slots: readonly T[],
): T[] {
  return slots.filter((slot) => slotNeedsGenerating(slot));
}
