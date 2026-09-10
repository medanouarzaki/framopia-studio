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

/**
 * Slots for the client's own pictures whose words are spoken and which no
 * planned slot covers.
 *
 * **The density rule counts pictures against the clock; a label counts against
 * what she said.** `imageSlotCountFor` gives a reel one picture per 3.75
 * seconds, Mohamed's ruling of 2026-08-29, and that governs how many ideas the
 * model is asked for. It is the right rule for the thing it was made for:
 * generated pictures cost money and a reel that flashes one every second is
 * unwatchable.
 *
 * It is the wrong rule for a picture the client has already given us. Block 12
 * session 85: `sora-1` is 10.2 seconds, so the clock allowed three slots, and
 * she names six things in it. Sculptra and Radiesse landed on two of the three
 * and were matched; **Profhilo was spoken, `pic010` is labelled `profhilo`, and
 * nothing was placed at all** — no slot ever covered that word, so
 * `fillSlotsFromClientPictures` never saw it. The matcher was not wrong; it was
 * never asked.
 *
 * A label is the client saying *when I say this word, show this picture*. That
 * is a decision they have already made, about a file they have already given us,
 * and honouring it costs nothing: these slots can never be generated, because
 * they are born already answered. So the clock does not get to overrule it.
 *
 * **Nothing here knows what a product is, or a result, or this client's
 * subject.** It compares spoken words against labels, which is what session 53
 * built and all this does is ask it about every word rather than about three.
 */
export function slotsForSpokenPictures(options: {
  slots: readonly ImageSlot[];
  words: readonly PlanWord[];
  mode: Pick<ClientMode, 'pictures'>;
  ownPictures?: readonly ClientPicture[];
  /** Ids already taken, so a new slot cannot collide with a planned one. */
  nextId: (index: number) => string;
}): { slots: ImageSlot[]; added: ClientPictureFill[] } {
  const { slots, words, mode, nextId } = options;
  const pictures = [...(options.ownPictures ?? []), ...clientPictures(mode)];
  if (pictures.length === 0) return { slots: [...slots], added: [] };

  /*
   * **A word is spoken for only when the slot spanning it shows *its* picture.**
   *
   * This skipped every word any slot spanned, and `sora-1` showed why that is
   * not the same thing: she says "khaskek Sculptra wela Planiti" in one breath,
   * one planned slot covered all four words, and it showed Sculptra. Planiti has
   * a label and a picture of its own and got nothing — the same failure as
   * Profhilo, one level in.
   *
   * So a covering slot only settles a word if it is already showing what that
   * word names. Otherwise the word gets its own slot and the covering one gives
   * up the time from there, which is why the split below exists rather than two
   * pictures being on screen at once.
   */
  const showing = new Map<string, string | undefined>();
  for (const slot of slots) {
    for (const wordId of slot.wordIds) showing.set(wordId, slot.chosenClientPictureId);
  }
  /* One picture is placed once, however many times its word is said. */
  const used = new Set(
    slots
      .map((s) => s.chosenClientPictureId)
      .filter((id): id is string => typeof id === 'string'),
  );

  const added: ClientPictureFill[] = [];
  const extra: ImageSlot[] = [];

  for (const word of words) {
    const match = matchClientPicture(pictures, [{ id: word.id, text: word.text }], word.id);
    if (match === null || used.has(match.pictureId)) continue;
    if (showing.has(word.id) && showing.get(word.id) === match.pictureId) continue;
    used.add(match.pictureId);
    const id = nextId(slots.length + extra.length);
    extra.push({
      id,
      wordIds: [word.id],
      start: word.start,
      end: word.end,
      contextText: word.text,
      /*
       * The idea is what a picture would have been generated from, and this one
       * never will be. It says where it came from so the picture editor and the
       * report read as sentences rather than as a blank.
       */
      idea: `The client's own picture for ${JSON.stringify(word.text)}`,
      nameWordId: word.id,
      prompt: '',
      negativePrompt: '',
      candidates: [],
      chosenCandidateId: null,
      chosenClientPictureId: match.pictureId,
      chosenClientPictureWord: match.word,
      presentation: null,
      zoneId: null,
      templateId: null,
      status: 'pending',
    } as ImageSlot);
    added.push({ slotId: id, pictureId: match.pictureId, word: match.word });
  }

  /*
   * A slot that was spanning a word now taken by a new one ends where the new
   * one begins. Nothing overlaps, and the picture that was already there keeps
   * every frame up to the moment she names the next thing.
   */
  const trimmed = slots.map((slot) => {
    const cutter = extra.find((e) => e.start > slot.start && e.start < slot.end);
    return cutter === undefined ? slot : { ...slot, end: cutter.start };
  });

  const all = [...trimmed, ...extra].sort((a, b) => a.start - b.start);
  return { slots: all, added };
}
