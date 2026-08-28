import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import type { EditPlan } from '../editplan/types.js';
import type { Rect } from './geometry.js';

/**
 * Each image slot's face box: the union of the face mask over the frames the
 * slot is on screen.
 *
 * Free and local — it reads masks already on disk and runs no model. Written
 * once here because three callers needed it: the builder, the placement report
 * and the picker, and three copies of a mask walk is three chances to disagree
 * about which frames a slot covers.
 *
 * A reel with no masks yields an empty map rather than an error: placement
 * falls back to the frame, which is what it does for a slot with no face.
 */
const PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const SCRIPT = path.join(REPO_ROOT, 'tools', 'cv', 'head_boxes.py');

interface MaskFrame {
  index: string;
  box: [number, number, number, number] | null;
}

export function faceBoxesFor(plan: EditPlan): Map<string, Rect> {
  const boxes = new Map<string, Rect>();
  // The CV directory is named after the reel as it appears on disk, spaces and
  // all, which is the video's own basename.
  const stem = path.basename(plan.source.videoPath).replace(/\.[^.]+$/, '');
  const dir = path.join(REPO_ROOT, '.local', 'cv', stem, 'masks-2fps');
  if (!existsSync(dir) || !existsSync(PY)) return boxes;

  let frames: MaskFrame[];
  try {
    frames = (
      JSON.parse(
        execFileSync(PY, [SCRIPT, dir, 'face'], {
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        }),
      ) as { frames: MaskFrame[] }
    ).frames;
  } catch {
    return boxes;
  }

  const fps = plan.zones.sampleFps || 2;
  for (const slot of plan.images.slots) {
    const spans = frames
      .filter((f) => {
        const t = Number(f.index) / fps;
        return f.box !== null && t >= slot.start - 1 / fps && t <= slot.end + 1 / fps;
      })
      .map((f) => f.box as [number, number, number, number]);
    if (spans.length === 0) continue;
    const x0 = Math.min(...spans.map((b) => b[0]));
    const y0 = Math.min(...spans.map((b) => b[1]));
    boxes.set(slot.id, {
      x: x0,
      y: y0,
      w: Math.max(...spans.map((b) => b[2])) - x0,
      h: Math.max(...spans.map((b) => b[3])) - y0,
    });
  }
  return boxes;
}
