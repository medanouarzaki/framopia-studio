import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadMode } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot } from '../editplan/types.js';
import { FRAME_HEIGHT, FRAME_WIDTH, HEAD_CLEARANCE, TOP_LEFT_MARGIN } from './constants.js';
import { type Rect } from './geometry.js';
import { placementIsSafe, topLeftPlacementDetail } from './top-left.js';

/**
 * Where each image slot goes, per reel, and what the change from the corner is
 * worth.
 *
 * Free and local: it reads masks already on disk and runs no model. The builder
 * derives the same placement itself, so this is a report rather than an input —
 * a side file the build depended on is a side file that can go stale.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const SCRIPT = path.join(REPO_ROOT, 'tools', 'cv', 'head_boxes.py');

interface MaskFrame { index: string; box: [number, number, number, number] | null }

function maskBoxes(reel: string, kind: 'face' | 'head'): MaskFrame[] | null {
  const dir = path.join(REPO_ROOT, '.local', 'cv', reel, 'masks-2fps');
  if (!existsSync(dir) || !existsSync(PY)) return null;
  const raw = execFileSync(PY, [SCRIPT, dir, kind], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (JSON.parse(raw) as { frames: MaskFrame[] }).frames;
}

let placedTotal = 0;
let escapes = 0;
let faceHits = 0;
let clamped = 0;
const sides: number[] = [];

/*
 * How large the client wants its images, as a multiple of the largest square
 * the corner holds. Read from the mode rather than a constant: it is taste, and
 * the two clients this tool has will not agree about it.
 */
const modeArg = process.argv.indexOf('--mode');
const imageScale =
  modeArg === -1 ? 1 : (loadMode(process.argv[modeArg + 1] as string).imageScale ?? 1);

for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const plan: EditPlan = await readEditPlan(path.join(FOOTAGE_DIR, file));
  if (plan.images.slots.length === 0) continue;
  const faces = maskBoxes(reel, 'face');
  const sampleFps = plan.zones.sampleFps || 2;

  const spanBox = (slot: ImageSlot): Rect | null => {
    if (faces === null) return null;
    const boxes = faces
      .filter((f) => {
        const t = Number(f.index) / sampleFps;
        return f.box !== null && t >= slot.start - 1 / sampleFps && t <= slot.end + 1 / sampleFps;
      })
      .map((f) => f.box as [number, number, number, number]);
    if (boxes.length === 0) return null;
    const x0 = Math.min(...boxes.map((b) => b[0]));
    const y0 = Math.min(...boxes.map((b) => b[1]));
    return {
      x: x0,
      y: y0,
      w: Math.max(...boxes.map((b) => b[2])) - x0,
      h: Math.max(...boxes.map((b) => b[3])) - y0,
    };
  };

  const out: Record<string, Rect> = {};
  for (const slot of plan.images.slots as ImageSlot[]) {
    const faceBox = spanBox(slot);
    const seed = `${plan.meta.id}:${slot.id}`;
    const detail = topLeftPlacementDetail({ faceBox, seed, scale: imageScale });
    const rect = detail.rect;
    if (detail.clamped) clamped += 1;
    out[slot.id] = rect;
    placedTotal += 1;

    const safe = placementIsSafe(rect, faceBox);
    if (!safe.insideFrame) escapes += 1;
    if (!safe.clearsFace) faceHits += 1;
    const px = (v: number): string => (v * FRAME_WIDTH).toFixed(0);
    const py = (v: number): string => (v * FRAME_HEIGHT).toFixed(0);
    console.log(
      `${reel.padEnd(14)} ${slot.id}: ${px(rect.w)}px at (${px(rect.x)}, ${py(rect.y)})` +
        `  bounded by ${detail.boundBy}` +
        `  nudged ${detail.offsetPx.x.toFixed(0)}px right, ${detail.offsetPx.y.toFixed(0)}px down` +
        `  clears face ${safe.clearsFace ? 'yes' : 'NO'}, in frame ${safe.insideFrame ? 'yes' : 'NO'}` +
        `${detail.clamped ? `  (asked ${detail.wantedSidePx.toFixed(0)}px, corner holds ${detail.cornerSidePx.toFixed(0)})` : ''}` +
        `${faceBox === null ? '  [no face mask; frame-bounded only]' : ''}`,
    );
    sides.push(rect.w * FRAME_WIDTH);
  }
  mkdirSync(path.join(REPO_ROOT, '.local', 'build'), { recursive: true });
  writeFileSync(
    path.join(REPO_ROOT, '.local', 'build', `image-placement-${reel}.json`),
    `${JSON.stringify(out, null, 2)}\n`,
    'utf8',
  );
}

console.log(
  `\n${placedTotal} slots placed top-left, margin ${(TOP_LEFT_MARGIN * FRAME_WIDTH).toFixed(0)}px, ` +
    `clearance ${(HEAD_CLEARANCE * FRAME_WIDTH).toFixed(0)}px, imageScale ${imageScale}. ` +
    `Sides ${Math.min(...sides).toFixed(0)}-${Math.max(...sides).toFixed(0)}px.`,
);
console.log(
  `${escapes} outside the frame, ${faceHits} overlapping the face, ` +
    `${clamped} smaller than the mode asked for. $0.00 — no model call.`,
);
if (escapes > 0 || faceHits > 0) {
  console.error('a placement left the frame or touched the face');
  process.exit(1);
}
