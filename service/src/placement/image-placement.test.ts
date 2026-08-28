import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadMode, REPO_ROOT } from '@framopia/core';
import { bandsAround, placeImageDetail, placementIsSafe } from './image-placement.js';
import {
  FRAME_HEIGHT, FRAME_WIDTH, HEAD_CLEARANCE, SUBTITLE_BAND, TOP_LEFT_MARGIN,
} from './constants.js';
import { topLeftPlacementDetail } from './top-left.js';
import { readEditPlan } from '../editplan/io.js';
import type { Rect } from './geometry.js';

const px = (v: number): number => v * FRAME_WIDTH;
/** A face roughly where `vitasilk`'s sits: centre-ish, top at 1088 px. */
const FACE: Rect = { x: 920 / FRAME_WIDTH, y: 1088 / FRAME_HEIGHT, w: 620 / FRAME_WIDTH, h: 936 / FRAME_HEIGHT };

describe('the bands around the face', () => {
  const margin = TOP_LEFT_MARGIN * FRAME_WIDTH;
  const clearance = HEAD_CLEARANCE * FRAME_WIDTH;

  it('gives the band above the face the whole frame width', () => {
    const above = bandsAround(FACE, margin, clearance).find((b) => b.name === 'above the face');
    expect(above?.x0).toBeCloseTo(margin, 6);
    expect(above?.x1).toBeCloseTo(FRAME_WIDTH - margin, 6);
    // Bounded below by the face, with the clearance already spent.
    expect(above?.y1).toBeCloseTo(1088 - clearance, 6);
  });

  /* An image never reaches the subtitles, so the side bands stop at the band. */
  it('stops the side bands at the subtitle band', () => {
    for (const name of ['left of the face', 'right of the face'] as const) {
      const band = bandsAround(FACE, margin, clearance).find((b) => b.name === name);
      expect(band?.y1, name).toBeCloseTo(SUBTITLE_BAND.y * FRAME_HEIGHT, 6);
    }
  });

  it('offers the whole frame when there is no face to avoid', () => {
    const bands = bandsAround(null, margin, clearance);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.name).toBe('the frame');
  });
});

describe('where an image goes', () => {
  it('takes the band above the face when that is the largest', () => {
    const detail = placeImageDetail({ faceBox: FACE, seed: 'p:img001' });
    expect(detail.band).toBe('above the face');
    expect(px(detail.rect.w)).toBeGreaterThan(800);
  });

  /*
   * `vitasilk`'s `img002`: the speaker's face reaches higher there, so the band
   * beside him is the larger one and taking it is what earns the measured gain.
   * A rule that only ever looked above the face would make that slot smaller
   * than the corner did.
   */
  it('takes the band beside the face where the face sits high', () => {
    const high: Rect = { x: 988 / FRAME_WIDTH, y: 916 / FRAME_HEIGHT, w: 816 / FRAME_WIDTH, h: 980 / FRAME_HEIGHT };
    expect(placeImageDetail({ faceBox: high, seed: 'p:img002' }).band).toBe('left of the face');
  });

  it('is bigger than the corner rule it replaces', () => {
    for (const seed of ['p:a', 'p:b', 'p:c', 'p:d']) {
      const now = placeImageDetail({ faceBox: FACE, seed });
      const was = topLeftPlacementDetail({ faceBox: FACE, seed });
      expect(now.rect.w, seed).toBeGreaterThan(was.rect.w);
    }
  });

  it('is deterministic', () => {
    const a = placeImageDetail({ faceBox: FACE, seed: 'p:img001', scale: 1.4 });
    const b = placeImageDetail({ faceBox: FACE, seed: 'p:img001', scale: 1.4 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  /* Jitter can only shrink, so it cannot push a square onto the boundary. */
  it('never grows past what the band holds, at any scale', () => {
    for (const scale of [0.5, 1, 1.4, 2]) {
      const detail = placeImageDetail({ faceBox: FACE, seed: 'p:img001', scale });
      expect(px(detail.rect.w), String(scale)).toBeLessThanOrEqual(detail.bandSidePx + 1e-6);
      expect(placementIsSafe(detail.rect, FACE).clearsFace, String(scale)).toBe(true);
    }
  });

  it('clears the face and stays in frame for any seed and any face', () => {
    for (let i = 0; i < 200; i += 1) {
      const face: Rect = {
        x: (700 + (i % 40) * 10) / FRAME_WIDTH,
        y: (800 + (i % 25) * 20) / FRAME_HEIGHT,
        w: (280 + (i % 17) * 30) / FRAME_WIDTH,
        h: (400 + (i % 13) * 40) / FRAME_HEIGHT,
      };
      const detail = placeImageDetail({ faceBox: face, seed: `seed:${i}`, scale: 1.4 });
      const safe = placementIsSafe(detail.rect, face);
      expect(safe.clearsFace, `seed ${i}`).toBe(true);
      expect(safe.insideFrame, `seed ${i}`).toBe(true);
    }
  });

  it('still places when there is no face mask', () => {
    const detail = placeImageDetail({ faceBox: null, seed: 'p:img001' });
    expect(detail.band).toBe('the frame');
    expect(placementIsSafe(detail.rect, null).insideFrame).toBe(true);
  });
});

/**
 * The corpus, against the real face masks — the same measurement the CLI
 * prints, asserted so it cannot regress silently.
 */
const MASK_PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const MASK_SCRIPT = path.join(REPO_ROOT, 'tools', 'cv', 'head_boxes.py');
interface MaskFrame { index: string; box: [number, number, number, number] | null }

describe.skipIf(!existsSync(MASK_PY))('every slot in the corpus', () => {
  const scale = loadMode('k2-syndicalia').imageScale ?? 1;

  it('clears the face, stays in frame, and beats the corner', async () => {
    let checked = 0;
    for (const reel of ['test 1', 'vitasilk']) {
      const plan = await readEditPlan(
        path.join(REPO_ROOT, 'my files', 'test videos', `${reel}.editplan.json`),
      );
      const dir = path.join(REPO_ROOT, '.local', 'cv', reel, 'masks-2fps');
      if (!existsSync(dir)) continue;
      const frames = (
        JSON.parse(
          execFileSync(MASK_PY, [MASK_SCRIPT, dir, 'face'], {
            encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
          }),
        ) as { frames: MaskFrame[] }
      ).frames;
      const fps = plan.zones.sampleFps || 2;

      for (const slot of plan.images.slots) {
        const boxes = frames
          .filter((f) => {
            const t = Number(f.index) / fps;
            return f.box !== null && t >= slot.start - 1 / fps && t <= slot.end + 1 / fps;
          })
          .map((f) => f.box as [number, number, number, number]);
        if (boxes.length === 0) continue;
        const x0 = Math.min(...boxes.map((b) => b[0]));
        const y0 = Math.min(...boxes.map((b) => b[1]));
        const faceBox: Rect = {
          x: x0,
          y: y0,
          w: Math.max(...boxes.map((b) => b[2])) - x0,
          h: Math.max(...boxes.map((b) => b[3])) - y0,
        };
        const seed = `${plan.meta.id}:${slot.id}`;
        const now = placeImageDetail({ faceBox, seed, scale });
        const was = topLeftPlacementDetail({ faceBox, seed, scale });
        const safe = placementIsSafe(now.rect, faceBox);
        const where = `${reel}/${slot.id}`;
        expect(safe.clearsFace, where).toBe(true);
        expect(safe.insideFrame, where).toBe(true);
        expect(now.rect.w, where).toBeGreaterThan(was.rect.w);
        checked += 1;
      }
    }
    expect(checked, 'no slot was checked').toBeGreaterThan(0);
  });
});
