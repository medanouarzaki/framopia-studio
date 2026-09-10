import { describe, expect, it } from 'vitest';
import {
  fillSlotsFromClientPictures,
  slotsForSpokenPictures,
} from './client-picture-slots.js';
import { slotNeedsGenerating, slotsNeedingGeneration } from '../editplan/slot-fill.js';
import type { ImageSlot, PlanWord } from '../editplan/types.js';

function word(id: string, text: string, over: Partial<PlanWord> = {}): PlanWord {
  return {
    id, text, sourceText: text, start: 0, end: 1,
    lang: null, script: 'latin', confidence: 1,
    removed: false, removedReason: null, edited: false,
    ...over,
  };
}

function slot(id: string, wordIds: string[], over: Partial<ImageSlot> = {}): ImageSlot {
  return {
    id, wordIds, start: 0, end: 2,
    contextText: '', idea: 'something', prompt: 'p', negativePrompt: 'n',
    candidates: [], chosenCandidateId: null,
    presentation: null, zoneId: null, templateId: null, status: 'pending',
    ...over,
  } as ImageSlot;
}

const PICTURES = [
  { id: 'pic001', path: '/clients/x/botox.png', description: 'the Botox box', label: 'Botox' },
  { id: 'pic002', path: '/clients/x/clinic.png', description: 'the clinic', label: 'العيادة' },
];

describe('the slots a client’s own pictures already answer', () => {
  it('fills the slot whose spoken word is on a label, and says which word', () => {
    const words = [word('w1', 'كنديرو'), word('w2', 'Botox')];
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1', 'w2'])],
      words,
      mode: { pictures: PICTURES },
    });
    expect(out.filled).toEqual([{ slotId: 'img001', pictureId: 'pic001', word: 'Botox' }]);
    expect(out.slots[0]?.chosenClientPictureId).toBe('pic001');
    expect(out.slots[0]?.chosenClientPictureWord).toBe('Botox');
  });

  /* The whole point: a slot a client's picture fills is never bought. */
  it('takes that slot out of what the image stage generates', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1']), slot('img002', ['w2'])],
      words: [word('w1', 'Botox'), word('w2', 'شكرا')],
      mode: { pictures: PICTURES },
    });
    expect(slotsNeedingGeneration(out.slots).map((s) => s.id)).toEqual(['img002']);
    expect(slotNeedsGenerating(out.slots[0] as ImageSlot)).toBe(false);
  });

  it('leaves a client with no pictures exactly as it found it', () => {
    const slots = [slot('img001', ['w1'])];
    const out = fillSlotsFromClientPictures({
      slots, words: [word('w1', 'Botox')], mode: {},
    });
    expect(out.filled).toEqual([]);
    expect(out.slots).toBe(slots);
    expect(slotsNeedingGeneration(out.slots).map((s) => s.id)).toEqual(['img001']);
  });

  it('leaves a client whose labels never fire exactly as it found it', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'])],
      words: [word('w1', 'شكرا')],
      mode: { pictures: PICTURES },
    });
    expect(out.filled).toEqual([]);
    expect(out.slots[0]?.chosenClientPictureId).toBeUndefined();
  });

  it('works for a client with fifty pictures', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: `pic${i}`, path: `/clients/x/${i}.png`, description: `n ${i}`, label: `thing${i}`,
    }));
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'])],
      words: [word('w1', 'Thing42')],
      mode: { pictures: many },
    });
    expect(out.filled[0]?.pictureId).toBe('pic42');
  });
});

/* A person's decision is never revised by a rule. */
describe('what it will not overwrite', () => {
  it('leaves a slot whose picture he chose by hand', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'], { chosenClientPictureId: 'pic002' })],
      words: [word('w1', 'Botox')],
      mode: { pictures: PICTURES },
    });
    expect(out.filled).toEqual([]);
    expect(out.slots[0]?.chosenClientPictureId).toBe('pic002');
  });

  it('leaves a slot whose generated candidate he chose', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'], { chosenCandidateId: 'img001-c2' })],
      words: [word('w1', 'Botox')],
      mode: { pictures: PICTURES },
    });
    expect(out.filled).toEqual([]);
    expect(out.slots[0]?.chosenClientPictureId).toBeUndefined();
  });

  it('does not hear a word the cleaning marks removed', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'])],
      words: [word('w1', 'Botox', { removed: true, removedReason: 'filler' })],
      mode: { pictures: PICTURES },
    });
    expect(out.filled).toEqual([]);
  });

  it('hears only the words of the slot’s own span', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'])],
      words: [word('w1', 'شكرا'), word('w2', 'Botox')],
      mode: { pictures: PICTURES },
    });
    expect(out.filled).toEqual([]);
  });
});

/**
 * **A thing named gets a picture, whatever the clock allowed.**
 *
 * Block 12 session 85: `sora-1` is 10.2 seconds, so `imageSlotCountFor` allowed
 * three slots, and Dr Loubna Kfafi names six things in it. She says Profhilo,
 * `pic010` is labelled `profhilo`, and **nothing was placed at all** — no slot
 * ever spanned that word, so the matcher never saw it. The density rule counts
 * pictures against the clock; a label counts against what she said.
 */
describe('slots for the pictures she names that the clock left out', () => {
  const words = (...pairs: [string, string][]): PlanWord[] =>
    pairs.map(([id, text], i) => ({ id, text, start: i, end: i + 0.5 }) as PlanWord);

  const mode = {
    pictures: [
      { id: 'pic010', path: '/p/10.jpg', description: '', label: 'profhilo' },
      { id: 'pic014', path: '/p/14.jpg', description: '', label: 'sculptra' },
    ],
  };

  const nextId = (i: number): string => `img${String(i + 1).padStart(3, '0')}`;

  it('adds a slot for a word no planned slot covers', () => {
    const out = slotsForSpokenPictures({
      slots: [],
      words: words(['w1', 'خاصك'], ['w2', 'Profhilo']),
      mode,
      nextId,
    });
    expect(out.added).toEqual([{ slotId: 'img001', pictureId: 'pic010', word: 'Profhilo' }]);
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]?.chosenClientPictureId).toBe('pic010');
  });

  /* A word a planned slot already spans is that slot's business. */
  it('leaves a word a planned slot already covers alone', () => {
    const planned = {
      id: 'img001',
      wordIds: ['w2'],
      start: 1,
      end: 1.5,
      contextText: 'Profhilo',
      idea: 'a thing',
      prompt: 'p',
      negativePrompt: '',
      candidates: [],
      chosenCandidateId: null,
      presentation: null,
      zoneId: null,
      templateId: null,
      status: 'pending',
    } as unknown as ImageSlot;
    const out = slotsForSpokenPictures({
      slots: [planned],
      words: words(['w1', 'خاصك'], ['w2', 'Profhilo']),
      mode,
      nextId,
    });
    expect(out.added).toEqual([]);
    expect(out.slots).toHaveLength(1);
  });

  /* One picture is placed once, however many times its word is said. */
  it('places a picture once however often the word is said', () => {
    const out = slotsForSpokenPictures({
      slots: [],
      words: words(['w1', 'Profhilo'], ['w2', 'Profhilo'], ['w3', 'Profhilo']),
      mode,
      nextId,
    });
    expect(out.added).toHaveLength(1);
  });

  it('says nothing about a word no label matches', () => {
    const out = slotsForSpokenPictures({
      slots: [],
      words: words(['w1', 'filler'], ['w2', 'volume']),
      mode,
      nextId,
    });
    expect(out.added).toEqual([]);
    expect(out.slots).toEqual([]);
  });

  it('adds nothing at all for a client with no pictures', () => {
    const out = slotsForSpokenPictures({
      slots: [],
      words: words(['w1', 'Profhilo']),
      mode: { pictures: [] },
      nextId,
    });
    expect(out.added).toEqual([]);
  });

  /* Added slots can never be generated: they are born answered. */
  it('gives every added slot a picture and no prompt', () => {
    const out = slotsForSpokenPictures({
      slots: [],
      words: words(['w1', 'Profhilo'], ['w2', 'Sculptra']),
      mode,
      nextId,
    });
    expect(out.added).toHaveLength(2);
    for (const slot of out.slots) {
      expect(`${slot.id}: ${slot.prompt}`).toBe(`${slot.id}: `);
      expect(typeof slot.chosenClientPictureId).toBe('string');
    }
  });

  it('keeps the slots in the order they are spoken', () => {
    const out = slotsForSpokenPictures({
      slots: [],
      words: words(['w1', 'Sculptra'], ['w2', 'x'], ['w3', 'Profhilo']),
      mode,
      nextId,
    });
    expect(out.slots.map((s) => s.chosenClientPictureId)).toEqual(['pic014', 'pic010']);
  });
});
