import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { chooseCandidate, imagesView, imagesViewForPlan, ImageViewError } from './image-view.js';
import { readEditPlan } from './editplan/io.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');

/** A copy, so a test never writes to a committed plan. */
function scratch(reel = 'vitasilk'): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-images-'));
  const to = path.join(dir, `${reel}.editplan.json`);
  copyFileSync(path.join(FOOTAGE, `${reel}.editplan.json`), to);
  return to;
}

describe('imagesView', () => {
  it('shows every candidate, rejected ones included', async () => {
    const view = await imagesView('vitasilk');
    expect(view.slots).toHaveLength(5);
    const all = view.slots.flatMap((s) => s.candidates);
    expect(all).toHaveLength(10);
    // The gate's yield on this reel is 2 of 10, and all ten are on screen.
    expect(all.filter((c) => c.gatePassed === true)).toHaveLength(2);
    expect(all.filter((c) => c.gatePassed === false)).toHaveLength(8);
  });

  it('carries the verdict, the reason and the metrics behind it', async () => {
    const view = await imagesView('vitasilk');
    const first = view.slots[0]?.candidates[0];
    expect(first?.gatePassed).toBe(false);
    expect(first?.gateFailures).toEqual(['edge_halo 0.1004 > 0.1']);
    expect(first?.metrics?.edgeHalo).toBeCloseTo(0.1004, 4);
  });

  it('says every candidate’s file is on disk', async () => {
    const view = await imagesView('vitasilk');
    for (const slot of view.slots) {
      for (const c of slot.candidates) {
        expect(c.imageExists, `${slot.id}/${c.id}`).toBe(true);
        expect(c.cutoutExists, `${slot.id}/${c.id}`).toBe(true);
      }
    }
  });

  /*
   * Taking the first candidate is a documented placeholder from Block 7, when
   * the picker did not exist. The view says which of the two is happening so
   * that a build nobody chose for is not mistaken for a choice.
   */
  it('names what the builder would use, and why', async () => {
    const view = await imagesView('vitasilk');
    for (const slot of view.slots) {
      expect(slot.buildsWith, slot.id).toBe(slot.candidates[0]?.id);
      expect(slot.buildsWithReason, slot.id).toBe('first candidate, nothing chosen');
    }
  });

  /*
   * The per-candidate figures read 0 across the corpus because the plan was
   * last written from a cached run. The money is the cumulative reel figure,
   * and the view carries both rather than implying the images were free.
   */
  it('reports the reel’s cumulative image spend beside the per-candidate zeros', async () => {
    const view = await imagesView('vitasilk');
    expect(view.slots.flatMap((s) => s.candidates).every((c) => c.costUsd === 0)).toBe(true);
    expect(view.reelSpentUsd).toBeCloseTo(1.550444, 6);
  });

  it('prices a slot with nothing generated from the dry run', async () => {
    const view = await imagesView('test-1');
    expect(view.slots).toHaveLength(4);
    expect(view.slots.every((s) => s.candidates.length === 0)).toBe(true);
    expect(view.generationNote).toContain('8');
  });

  it('names the client the plan records', async () => {
    expect((await imagesView('vitasilk')).source.clientMode).toBe('k2-syndicalia');
  });

  /* Block 7 session 9 forced the card frame on every slot. */
  it('states that every image is framed whatever the gate said', async () => {
    const view = await imagesView('vitasilk');
    expect(view.cardFrameForced).toBe(true);
    expect(view.slots.find((s) => s.id === 'img002')?.presentation).toBe('cutout');
  });

  /*
   * The picker showed a cut-out for every candidate, which on four of five
   * slots is a picture the build never places. What the build places is
   * `presentation`'s business, and the view answers it once so the panel does
   * not decide it a second time.
   */
  it('names the file the build would actually place', async () => {
    const view = await imagesView('vitasilk');
    for (const slot of view.slots) {
      for (const c of slot.candidates) {
        if (slot.rendersAsCutout) {
          expect(c.renderedPath, `${slot.id}/${c.id}`).toBe(c.cutoutPath);
        } else {
          expect(c.renderedPath, `${slot.id}/${c.id}`).toBe(c.imagePath);
        }
        expect(c.renderedExists, `${slot.id}/${c.id}`).toBe(true);
      }
    }
  });

  it('has one cutout slot in the corpus and four that show the whole picture', async () => {
    const view = await imagesView('vitasilk');
    expect(view.slots.filter((s) => s.rendersAsCutout).map((s) => s.id)).toEqual(['img002']);
    expect(view.slots.filter((s) => !s.rendersAsCutout)).toHaveLength(4);
  });

  it('refuses a reel with no plan by name', async () => {
    await expect(imagesView('nope')).rejects.toThrow(ImageViewError);
  });
});

describe('choosing a candidate', () => {
  it('writes the choice, which is itself the human-flagged marker', async () => {
    const planPath = scratch();
    const view = await chooseCandidate({ planPath, slotId: 'img002', candidateId: 'img002-c2' });
    expect(view.slots.find((s) => s.id === 'img002')?.chosenCandidateId).toBe('img002-c2');
    const plan = await readEditPlan(planPath);
    expect(plan.images.slots.find((s) => s.id === 'img002')?.chosenCandidateId).toBe('img002-c2');
  });

  it('changes what the builder would use', async () => {
    const planPath = scratch();
    await chooseCandidate({ planPath, slotId: 'img002', candidateId: 'img002-c2' });
    const slot = (await imagesViewForPlan(planPath)).slots.find((s) => s.id === 'img002');
    expect(slot?.buildsWith).toBe('img002-c2');
    expect(slot?.buildsWithReason).toBe('chosen');
  });

  /* The gate advises and the user decides — but the plan records the argument. */
  it('records the verdict a rejected choice overrode', async () => {
    const planPath = scratch();
    await chooseCandidate({ planPath, slotId: 'img001', candidateId: 'img001-c2' });
    const plan = await readEditPlan(planPath);
    expect(plan.images.slots.find((s) => s.id === 'img001')?.overriddenGateFailures).toEqual([
      'edge_halo 0.1187 > 0.1',
    ]);
  });

  it('records no override when the choice passed the gate', async () => {
    const planPath = scratch();
    await chooseCandidate({ planPath, slotId: 'img002', candidateId: 'img002-c1' });
    const plan = await readEditPlan(planPath);
    expect(
      plan.images.slots.find((s) => s.id === 'img002')?.overriddenGateFailures,
    ).toBeUndefined();
  });

  it('clears the choice and the override together', async () => {
    const planPath = scratch();
    await chooseCandidate({ planPath, slotId: 'img001', candidateId: 'img001-c2' });
    await chooseCandidate({ planPath, slotId: 'img001', candidateId: null });
    const plan = await readEditPlan(planPath);
    const slot = plan.images.slots.find((s) => s.id === 'img001');
    expect(slot?.chosenCandidateId).toBeNull();
    expect(slot?.overriddenGateFailures).toBeUndefined();
  });

  it('refuses an unknown slot or candidate by name', async () => {
    const planPath = scratch();
    await expect(
      chooseCandidate({ planPath, slotId: 'nope', candidateId: 'x' }),
    ).rejects.toThrow(/nope/);
    await expect(
      chooseCandidate({ planPath, slotId: 'img001', candidateId: 'nope' }),
    ).rejects.toThrow(/nope/);
  });

  it('touches nothing but the slot and the timestamp', async () => {
    const planPath = scratch();
    const before = await readEditPlan(planPath);
    await chooseCandidate({ planPath, slotId: 'img002', candidateId: 'img002-c2' });
    const after = await readEditPlan(planPath);
    expect(JSON.stringify(after.transcript)).toBe(JSON.stringify(before.transcript));
    expect(JSON.stringify(after.keywords)).toBe(JSON.stringify(before.keywords));
    expect(JSON.stringify(after.sfx)).toBe(JSON.stringify(before.sfx));
    expect(JSON.stringify(after.subtitles)).toBe(JSON.stringify(before.subtitles));
  });
});
