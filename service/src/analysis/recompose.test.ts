import { describe, expect, it } from 'vitest';
import { loadMode, type ClientMode } from '@framopia/core';
import type { EditPlan, ImageSlot } from '../editplan/types.js';
import { recomposeSlotPrompts } from './recompose.js';
import { composeNegativePrompt, composePrompt, drawVariation } from './slot-select.js';

const mode = loadMode('k2-syndicalia');

const slot = (id: string, idea: string, o: Partial<ImageSlot> = {}): ImageSlot => ({
  id, wordIds: ['w1'], start: 0, end: 2,
  contextText: 'ctx', idea,
  prompt: 'a stale prompt from an older mode',
  negativePrompt: 'stale negatives',
  candidates: [], chosenCandidateId: null, presentation: null,
  zoneId: null, templateId: null, status: 'pending',
  ...o,
});

function plan(slots: ImageSlot[]): EditPlan {
  return {
    meta: { id: 'plan-1' },
    images: { slots },
  } as unknown as EditPlan;
}

describe('recomposeSlotPrompts', () => {
  it('rebuilds each prompt from the stored idea and the current mode', () => {
    const p = plan([slot('img001', 'A clock face'), slot('img002', 'A cosmetic bottle')]);
    const result = recomposeSlotPrompts(p, mode);
    expect(result.slots[0]?.prompt).toContain('A clock face');
    expect(result.slots[1]?.prompt).toContain('A cosmetic bottle');
    expect(result.changedCount).toBe(2);
  });

  /**
   * The whole point: a mode bump must not cost a Gemini call. This asserts
   * the output is exactly what the planner would have written, so nothing is
   * gained by re-running the model — which would also return different ideas,
   * the call not being reproducible.
   */
  it('produces exactly what the planner would have, for the same index', () => {
    const p = plan([slot('img001', 'idea one'), slot('img002', 'idea two')]);
    const result = recomposeSlotPrompts(p, mode);
    result.slots.forEach((s, i) => {
      expect(s.prompt).toBe(composePrompt(mode, s.idea, drawVariation(mode, 'plan-1', i)));
      expect(s.negativePrompt).toBe(composeNegativePrompt(mode));
    });
  });

  it('stamps the mode version it composed against', () => {
    const result = recomposeSlotPrompts(plan([slot('img001', 'idea')]), mode);
    expect(result.slots[0]?.promptModeVersion).toBe(mode.version);
    expect(result.modeVersion).toBe(mode.version);
  });

  it('never mutates the slots it was given', () => {
    const original = slot('img001', 'idea');
    const before = { ...original };
    recomposeSlotPrompts(plan([original]), mode);
    expect(original).toEqual(before);
  });

  it('keeps everything that is not a prompt', () => {
    const original = slot('img001', 'idea', {
      wordIds: ['w7', 'w8'], start: 3, end: 5, templateId: 'img_float', status: 'generated',
    });
    const out = recomposeSlotPrompts(plan([original]), mode).slots[0];
    expect(out?.wordIds).toEqual(['w7', 'w8']);
    expect(out?.start).toBe(3);
    expect(out?.templateId).toBe('img_float');
    expect(out?.status).toBe('generated');
    expect(out?.idea).toBe('idea');
  });

  it('reports a slot as unchanged when the mode already produced its prompt', () => {
    const p = plan([slot('img001', 'idea')]);
    const once = recomposeSlotPrompts(p, mode);
    const twice = recomposeSlotPrompts(plan(once.slots), mode);
    expect(twice.changedCount).toBe(0);
    expect(twice.slots[0]?.prompt).toBe(once.slots[0]?.prompt);
  });

  it('carries the before and after for every slot', () => {
    const result = recomposeSlotPrompts(plan([slot('img001', 'idea')]), mode);
    expect(result.recomposed[0]?.promptBefore).toBe('a stale prompt from an older mode');
    expect(result.recomposed[0]?.promptAfter).toContain('idea');
  });

  // The draw is seeded from the plan id and the slot index, so a
  // recomposition must not shuffle which slot draws what.
  it('draws on the slot index, so the draw is stable across a recomposition', () => {
    const slots = [slot('a', 'one'), slot('b', 'two'), slot('c', 'three')];
    const first = recomposeSlotPrompts(plan(slots), mode).slots.map((s) => s.prompt);
    const second = recomposeSlotPrompts(plan(slots), mode).slots.map((s) => s.prompt);
    expect(second).toEqual(first);
  });

  it('is a no-op on a plan with no slots', () => {
    const result = recomposeSlotPrompts(plan([]), mode);
    expect(result.slots).toEqual([]);
    expect(result.changedCount).toBe(0);
  });

  it('follows a mode edit without any model call', () => {
    const bumped = {
      ...mode,
      version: mode.version + 1,
      imageStyle: { ...mode.imageStyle, stylePrompt: ['a wholly different look'] },
    } as ClientMode;
    const out = recomposeSlotPrompts(plan([slot('img001', 'idea')]), bumped).slots[0];
    expect(out?.prompt).toContain('a wholly different look');
    expect(out?.promptModeVersion).toBe(mode.version + 1);
  });
});
