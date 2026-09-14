import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  croppedPicturePath,
  isInClientPictureStore,
  resolveFfmpegPath,
  squareCropOf,
} from '@framopia/core';
import { imageSize } from '../build/image-size.js';

/**
 * **A square copy of a photograph that is not square.**
 *
 * Block 13 session 108, on Mohamed's ruling of fill. Session 107 measured the
 * cause: the card behind a picture is square, so a 1200 x 630 photograph draws
 * 1000 x 525 and leaves 238 px of bare card above and below it.
 *
 * **His file is never touched.** This reads it and writes a new one beside it;
 * `croppedPicturePath` says where and why nothing can collide. The original keeps
 * its own name, its own bytes and its own dimensions.
 *
 * **It is never sent anywhere.** The only destination is the picture store, which
 * `isInClientPictureStore` is asked to confirm before a byte is written — the same
 * allow-list of one that session 83 left, asserted here rather than remembered.
 *
 * **It is cropped once.** The file's name carries the sha256 of the bytes it was
 * made from, so a second build finds it and does nothing.
 */
export class CropError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CropError';
  }
}

export interface SquareCopy {
  /** Where the square copy is. */
  path: string;
  /** Whether this call wrote it, or found it already there. */
  made: boolean;
  /** What the crop threw away, as a fraction of the original. */
  lostFraction: number;
  sourceWidth: number;
  sourceHeight: number;
  side: number;
}

/** The sha256 of a file's bytes, which is what a crop is named after. */
export function sha256Of(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/**
 * Makes the square copy if it is not already there, and answers where it is.
 *
 * `repoRoot` is a parameter so a test can point the store at a scratch directory
 * without the risk of a test writing beside his photographs.
 */
export function squareCopyOf(options: {
  sourcePath: string;
  owner: string;
  pictureId: string;
  repoRoot?: string;
}): SquareCopy {
  const { sourcePath, owner, pictureId } = options;
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  if (!existsSync(sourcePath)) {
    throw new CropError(`there is no picture at ${sourcePath}`);
  }
  const src = imageSize(sourcePath);
  const crop = squareCropOf({ sourceWidth: src.width, sourceHeight: src.height });
  const out = croppedPicturePath({
    repoRoot,
    owner,
    pictureId,
    sourceSha256: sha256Of(sourcePath),
    extension: path.extname(sourcePath),
  });

  /*
   * **The allow-list, asserted rather than assumed.** Session 83 left exactly one
   * destination a photograph may be written to. A crop is a photograph.
   */
  if (!isInClientPictureStore(repoRoot, out)) {
    throw new CropError(`a cropped picture may only be written inside the picture store`);
  }

  const already = existsSync(out) && statSync(out).size > 0;
  if (!already) {
    mkdirSync(path.dirname(out), { recursive: true });
    /*
     * ffmpeg rather than the CV sidecar: a crop is arithmetic on pixels and
     * needs no model, and ffmpeg is already a hard requirement of this machine.
     * `-update 1` so a still is written as one image rather than a sequence.
     */
    execFileSync(
      resolveFfmpegPath('ffmpeg').path,
      [
        '-v', 'error', '-y',
        '-i', sourcePath,
        '-vf', `crop=${String(crop.side)}:${String(crop.side)}:${String(crop.x)}:${String(crop.y)}`,
        '-frames:v', '1', '-update', '1',
        out,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    if (!existsSync(out)) throw new CropError(`the square copy was not written to ${out}`);
  }

  return {
    path: out,
    made: !already,
    lostFraction: crop.lostFraction,
    sourceWidth: src.width,
    sourceHeight: src.height,
    side: crop.side,
  };
}
