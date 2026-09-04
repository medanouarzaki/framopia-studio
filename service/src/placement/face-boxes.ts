import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import type { EditPlan } from '../editplan/types.js';
import type { Rect } from './geometry.js';
import { reelMasksDir } from '../frames/segment.js';
import { videoOf } from '../video-identity.js';
import { pictureLives, pictureWindows } from '../build/picture-life.js';
import { imageEntranceS } from '../analysis/template-impacts.js';

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

export function faceBoxesFor(plan: EditPlan): Map<string, Rect[]> {
  const boxes = new Map<string, Rect[]>();
  const dir = reelMasksDir(videoOf(plan.source));
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
  /*
   * Over the picture's **life**, not its words, and as the frames themselves
   * rather than their union — the same two things the builder does, because a
   * panel that predicts a different size from the one the build draws is worse
   * than one that predicts none.
   */
  const wordStartById = new Map(plan.transcript.words.map((w) => [w.id, w.start]));
  const entranceS = imageEntranceS();
  const lives = new Map(
    pictureLives(
      pictureWindows(plan.images.slots, (id) => wordStartById.get(id)),
      entranceS,
    ).map((l) => [l.id, l]),
  );
  for (const slot of plan.images.slots) {
    const life = lives.get(slot.id);
    const from = life?.screenStartS ?? slot.start;
    const to = life?.screenEndS ?? slot.end;
    const spans = frames
      .filter((f) => {
        const t = Number(f.index) / fps;
        return f.box !== null && t >= from - 1 / fps && t <= to + 1 / fps;
      })
      .map((f) => f.box as [number, number, number, number]);
    if (spans.length === 0) continue;
    boxes.set(
      slot.id,
      spans.map((b) => ({ x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] })),
    );
  }
  return boxes;
}
