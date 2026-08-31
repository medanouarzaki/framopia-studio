import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, resolveStoredPath } from '@framopia/core';

/**
 * The reel catalogue, which lives in benchmarks/ because that is where it was
 * first needed. Frame analysis reads it for the same reason the benchmark
 * does: it is the only list of the footage that exists, and the footage
 * itself is gitignored.
 */
export const FOOTAGE_PATH = path.join(REPO_ROOT, 'benchmarks', 'footage.json');

export interface Reel {
  label: string;
  path: string;
  durationS: number;
}

/**
 * The one place `benchmarks/footage.json` is read, so the one place its stored
 * paths have to be re-rooted.
 *
 * They are absolute and were written on the drive this project grew up on.
 * Resolving here rather than at each of the dozen `reel.path` readers is the
 * same shape as `readTranscriptionCache` overwriting a manifest's stored
 * `audioPath`: the file keeps what it says, and every caller gets a path that
 * works on the machine it is running on.
 */
export function loadReels(): Reel[] {
  const parsed = JSON.parse(readFileSync(FOOTAGE_PATH, 'utf8')) as { reels?: Reel[] };
  if (!parsed.reels?.length) throw new Error(`${FOOTAGE_PATH} lists no reels`);
  return parsed.reels.map((reel) => ({
    ...reel,
    path: resolveStoredPath(reel.path, { field: `footage.json ${reel.label}.path` }),
  }));
}

export function reelByLabel(label: string): Reel {
  const reels = loadReels();
  const reel = reels.find((r) => r.label === label);
  if (!reel) {
    throw new Error(`no reel labelled ${label}; known: ${reels.map((r) => r.label).join(', ')}`);
  }
  return reel;
}
