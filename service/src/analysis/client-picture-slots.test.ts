import { describe, expect, it } from 'vitest';
import { fillSlotsFromClientPictures } from './client-picture-slots.js';
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
