import {
  clientPictures,
  matchClientPicture,
  type ClientMode,
  type ClientPicture,
} from '@framopia/core';
import type { ImageSlot, PlanWord } from '../editplan/types.js';

export interface ClientPictureFill {
  slotId: string;
  pictureId: string;
  word: string;
}

/**
 * Fills the slots whose spoken words name one of the client's own pictures.
 *
 * **Where this belongs, and why here.** The decision has to be made at the last
 * free moment before money can move. Making it at build time would mean paying
 * for a generated square and then not using it; making it inside the image
 * stage would mean that stage reading a client's photographs, which it must
 * never be able to do. Slot planning is where a moment first has an idea and a
 * span, it is free and local, and everything downstream — the cost screen, the
 * image stage, the picture editor, the build — reads the answer off the plan.
 *
 * **A choice a person made is never overwritten.** A slot that already names a
 * client picture, or whose candidate has been chosen by hand, is left exactly
 * as it is: this fills empty slots, it does not revise decisions.
 *
 * Nothing here knows anything about a client's name, language or domain. It
 * asks `matchClientPicture`, which compares words.
 *
 * **A picture attached to this reel beats one on the client, and it beats it by
 * being first in the list rather than by a rule of its own.** `matchClientPicture`
 * already takes the first picture whose label holds the word, so putting the
 * reel's own pictures in front of the client's is the whole of the preference —
 * one declaration, not a second copy of the matching rule. It is the right way
 * round because the reel's list is the more specific statement: a picture put on
 * one video was chosen for that video, while a client's applies to everything
 * they will ever make.
 */
export function fillSlotsFromClientPictures(options: {
  slots: ImageSlot[];
  words: readonly PlanWord[];
  mode: Pick<ClientMode, 'pictures'>;
  /** Pictures attached to this reel alone. Searched before the client's. */
  ownPictures?: readonly ClientPicture[];
}): { slots: ImageSlot[]; filled: ClientPictureFill[] } {
  const { slots, words, mode } = options;
  const pictures = [...(options.ownPictures ?? []), ...clientPictures(mode)];
  if (pictures.length === 0) return { slots, filled: [] };

  const byId = new Map(words.map((word) => [word.id, word]));
  const filled: ClientPictureFill[] = [];

  const next = slots.map((slot) => {
    if (slot.chosenClientPictureId !== undefined) return slot;
    if (slot.chosenCandidateId !== null) return slot;

    const spoken = slot.wordIds
      .map((id) => byId.get(id))
      .filter((word): word is PlanWord => word !== undefined && !word.removed)
      .map((word) => ({ id: word.id, text: word.text }));

    const match = matchClientPicture(pictures, spoken, slot.nameWordId);
    if (match === null) return slot;

    filled.push({ slotId: slot.id, pictureId: match.pictureId, word: match.word });
    return {
      ...slot,
      chosenClientPictureId: match.pictureId,
      chosenClientPictureWord: match.word,
    };
  });

  return { slots: next, filled };
}
