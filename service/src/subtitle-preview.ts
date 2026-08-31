import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR, SUBTITLE_ANCHOR_BASELINE_Y } from '@framopia/core';
import { FRAME_HEIGHT, FRAME_WIDTH } from './placement/constants.js';

/**
 * A real frame to position the subtitle line against.
 *
 * **The user chose a slider over a preview above named presets and above a
 * typed number** (2026-08-31), because it is the only one of the three where he
 * decides by looking. That only holds if what he is looking at is real, so this
 * finds a frame the pipeline already extracted rather than drawing something
 * approximate.
 *
 * **When there is none it says so rather than substituting quietly.** A client
 * with no footage yet has no frame, and judging a position against a plain
 * rectangle while believing it is footage is worse than judging it against a
 * rectangle you know is one.
 */
export interface SubtitlePreview {
  /** Absolute; the panel loads it over `file://` as the picture editor does. */
  framePath: string | null;
  /** Which reel it came from, for the sentence on screen. Null when there is none. */
  fromReel: string | null;
  /** The frame's own pixels, which are a quarter of the source on this corpus. */
  frameWidth: number;
  frameHeight: number;
  /** The source frame the baseline is measured in. */
  sourceWidth: number;
  sourceHeight: number;
  /** Where every video so far puts it, read from the constant. */
  defaultBaselineY: number;
}

const FRAMES_DIR = 'frames-2fps';

/**
 * A frame from the middle of a reel, which is likelier to have the speaker in
 * frame than the first one. Deterministic, so the preview does not change
 * between openings of the same screen.
 */
function middleFrameOf(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const frames = readdirSync(dir)
    .filter((f) => f.startsWith('frame-') && f.endsWith('.png') && !f.includes('final'))
    .sort();
  if (frames.length === 0) return null;
  return path.join(dir, frames[Math.floor(frames.length / 2)] as string);
}

export function subtitlePreview(): SubtitlePreview {
  const base = {
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    sourceWidth: FRAME_WIDTH,
    sourceHeight: FRAME_HEIGHT,
    defaultBaselineY: SUBTITLE_ANCHOR_BASELINE_Y,
  };
  const cv = path.join(LOCAL_DIR, 'cv');
  if (!existsSync(cv)) return { ...base, framePath: null, fromReel: null };
  for (const stem of readdirSync(cv).sort()) {
    const frame = middleFrameOf(path.join(cv, stem, FRAMES_DIR));
    if (frame !== null) return { ...base, framePath: frame, fromReel: stem };
  }
  return { ...base, framePath: null, fromReel: null };
}
