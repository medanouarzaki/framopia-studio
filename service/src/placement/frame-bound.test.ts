import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { fitInsideFrame, insideFrame } from './geometry.js';
import { COMP_SIDE_PX, FRAME_HEIGHT, FRAME_WIDTH } from './constants.js';

const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

describe('fitInsideFrame', () => {
  it('leaves a square that already fits exactly where it was', () => {
    const r = fitInsideFrame(0.5, 0.5, 0.2);
    expect(r.x).toBeCloseTo(0.4, 10);
    expect(insideFrame(r)).toBe(true);
  });

  /*
   * The case the user saw: vitasilk img001 at the variant (c) side, centred on
   * the solved (a) centre, crossed the left frame edge by 130 source pixels.
   */
  it('pulls back the placement that crossed the left edge', () => {
    const centreX = 219.6 / FRAME_WIDTH;
    const centreY = 1452.9 / FRAME_HEIGHT;
    const side = 698.93 / FRAME_WIDTH;
    const before = centreX - side / 2;
    expect(before * FRAME_WIDTH).toBeLessThan(-100);

    const r = fitInsideFrame(centreX, centreY, side);
    expect(r.x).toBe(0);
    expect(r.w).toBeCloseTo(side, 10);
    expect(insideFrame(r)).toBe(true);
  });

  it('pulls back the placement that crossed the top edge', () => {
    const r = fitInsideFrame(1601 / FRAME_WIDTH, 315.1 / FRAME_HEIGHT, 674.93 / FRAME_WIDTH);
    expect(r.y).toBe(0);
    expect(insideFrame(r)).toBe(true);
  });

  it('shrinks only when the square cannot fit the frame at all', () => {
    expect(fitInsideFrame(0.5, 0.5, 2).w).toBe(1);
    expect(insideFrame(fitInsideFrame(0.5, 0.5, 2))).toBe(true);
  });

  it('keeps every corner inside for a sweep of centres and sides', () => {
    for (let cx = -0.5; cx <= 1.5; cx += 0.1) {
      for (let cy = -0.5; cy <= 1.5; cy += 0.1) {
        for (const side of [0.05, 0.3, 0.6, 0.95]) {
          expect(insideFrame(fitInsideFrame(cx, cy, side))).toBe(true);
        }
      }
    }
  });
});

/*
 * Real slot geometry, not invented: every stored placement on every reel, at
 * every side the size variants can ask for, has to land inside the frame.
 */
describe('no placement on any reel escapes the frame', () => {
  const plans = readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort();

  it('holds for the stored placements themselves', async () => {
    for (const file of plans) {
      const plan = await readEditPlan(path.join(FOOTAGE_DIR, file));
      for (const slot of plan.images.slots) {
        if (slot.position == null || slot.scale == null) continue;
        const side = (slot.scale * COMP_SIDE_PX) / FRAME_WIDTH;
        const rect = { x: slot.position.x, y: slot.position.y, w: side, h: side * (FRAME_WIDTH / FRAME_HEIGHT) };
        expect(insideFrame(rect, 1e-6), `${file} ${slot.id}`).toBe(true);
      }
    }
  });

  it('holds for every variant side up to the whole frame width', async () => {
    for (const file of plans) {
      const plan = await readEditPlan(path.join(FOOTAGE_DIR, file));
      for (const slot of plan.images.slots) {
        if (slot.position == null || slot.scale == null) continue;
        const side = (slot.scale * COMP_SIDE_PX) / FRAME_WIDTH;
        const cx = slot.position.x + side / 2;
        const cy = slot.position.y + (side * FRAME_WIDTH) / FRAME_HEIGHT / 2;
        for (const want of [side, side * 1.5, side * 2, 0.9, 1]) {
          const r = fitInsideFrame(cx, cy, want);
          expect(insideFrame(r), `${file} ${slot.id} at ${want}`).toBe(true);
        }
      }
    }
  });
});
