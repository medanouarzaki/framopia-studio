import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, resolveStoredPath } from '@framopia/core';
import { editPlanPathFor } from '../editplan/io.js';
import { type VideoIdentity } from '../video-identity.js';

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

/**
 * A corpus reel's full identity, taken from the plan beside its video.
 *
 * `footage.json` records a label, a path and a duration but not a hash, and
 * every directory a video owns is now named for its content as well as its
 * name. The plan has the hash — transcription computed it and wrote it there —
 * so the catalogue does not need a second copy that could drift out of step
 * with the file. Read raw rather than through `readEditPlan`: this wants one
 * field, and validating the whole plan to get it would make every measurement
 * CLI fail on a schema it does not read.
 */
export function reelVideo(reel: Reel): VideoIdentity {
  const planPath = editPlanPathFor(reel.path);
  let sha256: unknown;
  try {
    const raw = JSON.parse(readFileSync(planPath, 'utf8')) as { source?: { sha256?: unknown } };
    sha256 = raw.source?.sha256;
  } catch {
    throw new Error(`${reel.label}: no readable plan at ${planPath}, so its video has no hash`);
  }
  if (typeof sha256 !== 'string') {
    throw new Error(`${reel.label}: ${planPath} records no source.sha256`);
  }
  return { path: reel.path, sha256 };
}

/** The same, by label, for the CLIs that take one. */
export function videoByLabel(label: string): VideoIdentity {
  return reelVideo(reelByLabel(label));
}
