import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { chooseImageSide, imagesView, imagesViewForPlan, ImageViewError } from './image-view.js';
import { readEditPlan } from './editplan/io.js';
import { humanFlaggedItems } from './editplan/merge.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');

function scratch(reel = 'vitasilk'): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-side-'));
  const to = path.join(dir, `${reel}.editplan.json`);
  copyFileSync(path.join(FOOTAGE, `${reel}.editplan.json`), to);
  return to;
}

/**
 * The zone editor, as it can honestly be after the placement became derived.
 *
 * The stored zones — 20 on `vitasilk` — have not been read by placement since
 * Block 7 session 9, so a list of them would be a control pretending to a
 * choice that no longer exists. What is real is which side of the speaker.
 */
describe('where an image sits', () => {
  it('says which side it is on and how big it is', async () => {
    const view = await imagesView('vitasilk');
    for (const slot of view.slots) {
      expect(slot.placedWhere, slot.id).not.toBeNull();
      expect(slot.placedSidePx as number, slot.id).toBeGreaterThan(0);
      expect(slot.placementChosenByHuman, slot.id).toBe(false);
    }
  });

  it('offers the sides that exist, with what each is worth', async () => {
    const view = await imagesView('vitasilk');
    for (const slot of view.slots) {
      expect(slot.placementOptions?.map((o) => o.key), slot.id).toEqual([
        'above', 'left', 'right',
      ]);
      for (const option of slot.placementOptions ?? []) {
        expect(option.sidePx, `${slot.id}/${option.key}`).toBeGreaterThanOrEqual(0);
        expect(option.label, `${slot.id}/${option.key}`).toMatch(/you/);
      }
    }
  });

  /* The roomiest side is taken unless a human says otherwise. */
  it('takes the roomiest side by default, which is not always above', async () => {
    const view = await imagesView('vitasilk');
    expect(view.slots.find((s) => s.id === 'img001')?.placedWhere).toBe('above you');
    expect(view.slots.find((s) => s.id === 'img002')?.placedWhere).toBe('to your left');
  });
});

describe('moving an image to another side', () => {
  it('writes the choice and moves the picture', async () => {
    const planPath = scratch();
    const view = await chooseImageSide({ planPath, slotId: 'img001', band: 'left' });
    const slot = view.slots.find((s) => s.id === 'img001');
    expect(slot?.placedWhere).toBe('to your left');
    expect(slot?.placementChosenByHuman).toBe(true);
    const plan = await readEditPlan(planPath);
    expect(plan.images.slots.find((s) => s.id === 'img001')?.placementBand).toBe('left');
  });

  /*
   * A re-run clears the images block, and this stops it taking the decision
   * with it — the same protection a chosen candidate already has.
   */
  it('is a human-flagged decision a re-run cannot discard', async () => {
    const planPath = scratch();
    await chooseImageSide({ planPath, slotId: 'img001', band: 'left' });
    const plan = await readEditPlan(planPath);
    const flags = humanFlaggedItems(plan);
    expect(flags.some((f) => f.block === 'images' && f.itemId === 'img001')).toBe(true);
  });

  /* Refused with a reason, never clamped to something else. */
  it('refuses a side with no room, and says how little there is', async () => {
    const planPath = scratch();
    await expect(
      chooseImageSide({ planPath, slotId: 'img002', band: 'right' }),
    ).rejects.toThrow(/not enough room/);
    const plan = await readEditPlan(planPath);
    expect(plan.images.slots.find((s) => s.id === 'img002')?.placementBand).toBeUndefined();
  });

  it('hands the choice back to the tool', async () => {
    const planPath = scratch();
    await chooseImageSide({ planPath, slotId: 'img001', band: 'left' });
    await chooseImageSide({ planPath, slotId: 'img001', band: null });
    const plan = await readEditPlan(planPath);
    expect(plan.images.slots.find((s) => s.id === 'img001')?.placementBand).toBeUndefined();
    expect(
      (await imagesViewForPlan(planPath)).slots.find((s) => s.id === 'img001')?.placedWhere,
    ).toBe('above you');
  });

  it('refuses an unknown slot by name', async () => {
    await expect(
      chooseImageSide({ planPath: scratch(), slotId: 'nope', band: 'above' }),
    ).rejects.toThrow(ImageViewError);
  });

  it('touches nothing but the slot and the timestamp', async () => {
    const planPath = scratch();
    const before = await readEditPlan(planPath);
    await chooseImageSide({ planPath, slotId: 'img001', band: 'left' });
    const after = await readEditPlan(planPath);
    expect(JSON.stringify(after.transcript)).toBe(JSON.stringify(before.transcript));
    expect(JSON.stringify(after.keywords)).toBe(JSON.stringify(before.keywords));
    expect(JSON.stringify(after.sfx)).toBe(JSON.stringify(before.sfx));
    expect(JSON.stringify(after.zones)).toBe(JSON.stringify(before.zones));
  });
});
