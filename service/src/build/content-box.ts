import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

/**
 * Where the actual picture sits inside a generated file.
 *
 * Block 7 session 7 measured the subject at a median 0.701 of a file's long
 * edge, so scaling a file to fill a square fills the file's margin as much as
 * its content. The builder needs the content box to scale by what is drawn
 * rather than by what was saved.
 *
 * Reads files already on disk through `tools/cv/content_boxes.py`; runs no
 * model and regenerates nothing.
 */
const PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const SCRIPT = path.join(REPO_ROOT, 'tools', 'cv', 'content_boxes.py');

export interface ContentBox {
  canvasW: number;
  canvasH: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Raw {
  path: string;
  width: number;
  height: number;
  boxes: Record<string, { x: number; y: number; w: number; h: number } | null>;
}

export function contentBoxes(
  files: { path: string; kind: 'cutout' | 'original' }[],
): Map<string, ContentBox> {
  const out = new Map<string, ContentBox>();
  const present = files.filter((f) => existsSync(f.path));
  if (present.length === 0 || !existsSync(PY)) return out;

  const raw = execFileSync(PY, [SCRIPT], {
    input: JSON.stringify({ images: present }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  for (const image of (JSON.parse(raw) as { images: Raw[] }).images) {
    const kind = present.find((f) => f.path === image.path)?.kind;
    const box = kind === 'cutout' ? image.boxes.alpha : image.boxes.t24;
    if (!box) continue;
    out.set(image.path, {
      canvasW: image.width,
      canvasH: image.height,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
    });
  }
  return out;
}

/**
 * Scale for a replaced placeholder so the file's **content** occupies what its
 * canvas used to.
 *
 * The template's own design is left alone: `IMG_MAIN` is 1000 inside a 1200
 * comp and stays that way, so the picture still sits where the template put it
 * and the surrounding transparent margin is what overflows. For a file whose
 * content already fills its canvas this returns exactly the previous value, so
 * a card that was correct stays correct.
 */
export function contentAwareScalePercent(options: {
  auditedSolidWidth: number;
  auditedScalePercent: number;
  sourceWidth: number;
  content?: ContentBox | undefined;
}): number {
  const { auditedSolidWidth, auditedScalePercent, sourceWidth, content } = options;
  if (sourceWidth <= 0) throw new Error('source width must be positive');
  const canvasScale = (auditedSolidWidth / sourceWidth) * auditedScalePercent;
  if (content === undefined) return canvasScale;
  const longEdge = Math.max(content.w, content.h);
  const canvasLong = Math.max(content.canvasW, content.canvasH);
  if (longEdge <= 0) return canvasScale;
  return canvasScale * (canvasLong / longEdge);
}

/**
 * How far the layer must move so the content's centre lands where the canvas's
 * centre would have. In comp units at the given scale, so the caller adds it to
 * the position it already computed.
 */
export function contentCentreOffset(
  content: ContentBox,
  scalePercent: number,
): { dx: number; dy: number } {
  const s = scalePercent / 100;
  // `-0` compares unequal to `0` under deep equality and would read as a
  // correction where there is none.
  const zeroed = (v: number): number => (v === 0 ? 0 : v);
  return {
    dx: zeroed(-(content.x + content.w / 2 - content.canvasW / 2) * s),
    dy: zeroed(-(content.y + content.h / 2 - content.canvasH / 2) * s),
  };
}
