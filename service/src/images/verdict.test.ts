import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { nothingIsMeasured, rendersAsCutout, verdictFor } from './verdict.js';
import { readEditPlan } from '../editplan/io.js';

const gate = (passed: boolean, failures: string[] = []) =>
  ({ gate: { presentation: passed ? 'cutout' : 'card', passed, failures } }) as never;

/**
 * The cutout metrics measure how cleanly a background came away. That bears on
 * a slot whose build shows the subject cut out, and on nothing else — which is
 * why the picker read as 8 of 10 failing while all five slots built correctly.
 */
describe('what the gate has to say, given what the slot renders', () => {
  it('judges the matte on a slot that shows a cut-out subject', () => {
    const v = verdictFor({ presentation: 'cutout' }, gate(false, ['edge_halo 0.17 > 0.1']));
    expect(v.applies).toBe(true);
    expect(v.backgroundCameAwayCleanly).toBe(false);
    expect(v.problems).toEqual(['edge_halo 0.17 > 0.1']);
  });

  it('has nothing to say about a slot that shows the whole picture', () => {
    for (const presentation of ['card', null] as const) {
      const v = verdictFor({ presentation }, gate(false, ['edge_halo 0.17 > 0.1']));
      expect(v.applies, String(presentation)).toBe(false);
      expect(v.backgroundCameAwayCleanly, String(presentation)).toBeNull();
      expect(v.problems, String(presentation)).toEqual([]);
    }
  });

  it('says plainly that a whole-picture slot has nothing measured', () => {
    expect(nothingIsMeasured({ presentation: 'card' })).toBe(true);
    expect(nothingIsMeasured({ presentation: 'cutout' })).toBe(false);
    expect(rendersAsCutout({ presentation: 'cutout' })).toBe(true);
  });

  it('has nothing to say when the gate never ran', () => {
    expect(verdictFor({ presentation: 'cutout' }, { gate: undefined }).applies).toBe(false);
  });
});

describe('the corpus, before and after', () => {
  it('drops all eight rejections, every one of them on a whole-picture slot', async () => {
    const plan = await readEditPlan(
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
    );
    let stillJudged = 0;
    let noLongerJudged = 0;
    let cleanlyCut = 0;
    for (const slot of plan.images.slots) {
      for (const candidate of slot.candidates) {
        const v = verdictFor(slot, candidate);
        if (!v.applies) {
          noLongerJudged += 1;
          // Every candidate that stops being judged is one the gate rejected.
          expect(candidate.gate?.passed, `${slot.id}/${candidate.id}`).toBe(false);
          continue;
        }
        stillJudged += 1;
        if (v.backgroundCameAwayCleanly === true) cleanlyCut += 1;
      }
    }
    // Two candidates on the one cutout slot, both clean; eight on card slots.
    expect(stillJudged).toBe(2);
    expect(cleanlyCut).toBe(2);
    expect(noLongerJudged).toBe(8);
  });

  it('leaves no candidate reported as failing anywhere in the corpus', async () => {
    for (const reel of ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk']) {
      const plan = await readEditPlan(
        path.join(REPO_ROOT, 'my files', 'test videos', `${reel}.editplan.json`),
      );
      for (const slot of plan.images.slots) {
        for (const candidate of slot.candidates) {
          expect(verdictFor(slot, candidate).problems, `${reel}/${slot.id}`).toEqual([]);
        }
      }
    }
  });
});
