import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { buildChoiceFor } from './choose-candidate.js';
import { readEditPlan } from '../editplan/io.js';
import type { ImageCandidate } from '../editplan/types.js';

const rejected = (id: string): ImageCandidate =>
  ({
    id,
    path: `/v/${id}.jpg`,
    gate: { presentation: 'card', passed: false, failures: ['edge_halo 0.17 > 0.1'] },
  }) as unknown as ImageCandidate;

const passed = (id: string): ImageCandidate =>
  ({
    id,
    path: `/v/${id}.jpg`,
    gate: { presentation: 'cutout', passed: true, failures: [] },
  }) as unknown as ImageCandidate;

/**
 * **The gate advises; it never blocks** — the user's ruling, and the behaviour
 * the builder has always had. This is what stops someone later reading a
 * rejection as a refusal and "fixing" it into a slot that silently builds
 * nothing.
 */
describe('the gate never blocks a build', () => {
  it('builds a rejected candidate exactly like any other', () => {
    const choice = buildChoiceFor({
      candidates: [rejected('a'), rejected('b')],
      chosenCandidateId: null,
    });
    expect(choice.candidateId).toBe('a');
    expect(choice.reason).toBe('first candidate, nothing chosen');
  });

  it('builds a rejected candidate the user chose over a passing one', () => {
    const choice = buildChoiceFor({
      candidates: [passed('a'), rejected('b')],
      chosenCandidateId: 'b',
    });
    expect(choice.candidateId).toBe('b');
    expect(choice.reason).toBe('chosen');
  });

  it('does not prefer a passing candidate over the first', () => {
    const choice = buildChoiceFor({
      candidates: [rejected('a'), passed('b')],
      chosenCandidateId: null,
    });
    expect(choice.candidateId).toBe('a');
  });

  it('falls back to the first when the chosen id no longer exists', () => {
    const choice = buildChoiceFor({
      candidates: [rejected('a')],
      chosenCandidateId: 'gone',
    });
    expect(choice.candidateId).toBe('a');
    expect(choice.reason).toBe('first candidate, nothing chosen');
  });

  it('has nothing to build when there are no candidates', () => {
    expect(buildChoiceFor({ candidates: [], chosenCandidateId: null })).toEqual({
      candidateId: null,
      reason: 'no candidates',
    });
  });

  /*
   * The reel the user watched: eight of `vitasilk`'s ten candidates are
   * rejected and all five slots build, which is why he saw five images where
   * the gate had passed two.
   */
  it('builds all five of vitasilk’s slots, eight rejections and all', async () => {
    const plan = await readEditPlan(
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
    );
    const all = plan.images.slots.flatMap((s) => s.candidates);
    expect(all.filter((c) => c.gate?.passed === false)).toHaveLength(8);
    for (const slot of plan.images.slots) {
      expect(buildChoiceFor(slot).candidateId, slot.id).not.toBeNull();
    }
  });
});
