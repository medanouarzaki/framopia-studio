import { BOTTOM_EXCLUSION, FRAME_ASPECT, SUBTITLE_BAND } from './constants.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function right(rect: Rect): number {
  return rect.x + rect.w;
}

export function bottom(rect: Rect): number {
  return rect.y + rect.h;
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);
}

export function insideFrame(rect: Rect, epsilon = 1e-9): boolean {
  return (
    rect.x >= -epsilon &&
    rect.y >= -epsilon &&
    right(rect) <= 1 + epsilon &&
    bottom(rect) <= 1 + epsilon
  );
}

/** The side of the largest square that fits, in units of frame width. */
export function largestSquare(rect: Rect): number {
  return Math.min(rect.w, rect.h * FRAME_ASPECT);
}

/** A square of side `side` (frame-width units) as a rect at (x, y). */
export function square(x: number, y: number, side: number): Rect {
  return { x, y, w: side, h: side / FRAME_ASPECT };
}

/**
 * A rect inset on every side by `clearance`, given in units of frame width so
 * the vertical inset is the same physical distance as the horizontal one.
 */
export function inset(rect: Rect, clearance: number): Rect {
  const vertical = clearance / FRAME_ASPECT;
  return {
    x: rect.x + clearance,
    y: rect.y + vertical,
    w: rect.w - 2 * clearance,
    h: rect.h - 2 * vertical,
  };
}

/**
 * The parts of a rect an image may occupy: clipped above the bottom exclusion,
 * then split by the subtitle band.
 *
 * The band is a full-width horizontal strip, so subtracting it leaves at most
 * an above and a below piece. Both are returned; the caller picks. Degenerate
 * pieces are dropped rather than returned with a non-positive extent.
 */
export function usableRegions(rect: Rect): Rect[] {
  const clipped: Rect = {
    ...rect,
    h: Math.min(bottom(rect), 1 - BOTTOM_EXCLUSION) - rect.y,
  };
  if (clipped.h <= 0 || clipped.w <= 0) return [];
  if (!intersects(clipped, SUBTITLE_BAND)) return [clipped];

  const pieces: Rect[] = [];
  const above = SUBTITLE_BAND.y - clipped.y;
  if (above > 0) pieces.push({ ...clipped, h: above });
  const belowY = bottom(SUBTITLE_BAND);
  const below = bottom(clipped) - belowY;
  if (below > 0) pieces.push({ ...clipped, y: belowY, h: below });
  return pieces;
}
