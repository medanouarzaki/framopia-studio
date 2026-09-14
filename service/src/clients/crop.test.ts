import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveFfmpegPath } from '@framopia/core';
import { CropError, sha256Of, squareCopyOf } from './crop.js';
import { imageSize } from '../build/image-size.js';

/**
 * **A square copy, written into a scratch store and never beside his.**
 *
 * `repoRoot` is a parameter on `squareCopyOf` for exactly this: a test that wrote
 * into `assets/client-pictures/` would be a test that can damage a user asset.
 */
let root: string;
const OWNER = 'a-scratch-client';

/** A picture of a known shape, drawn by ffmpeg so nothing of his is read. */
function drawPicture(file: string, w: number, h: number): void {
  mkdirSync(path.dirname(file), { recursive: true });
  execFileSync(
    resolveFfmpegPath('ffmpeg').path,
    ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=size=${String(w)}x${String(h)}:duration=1`,
     '-frames:v', '1', '-update', '1', file],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'framopia-crop-'));
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('a square copy of a photograph that is not square', () => {
  it('crops a wide picture to its short edge, and says what was lost', () => {
    const src = path.join(root, 'sources', 'wide.png');
    drawPicture(src, 1200, 630);
    const copy = squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic001', repoRoot: root });

    expect(copy.made).toBe(true);
    expect(copy.side).toBe(630);
    expect(imageSize(copy.path)).toEqual({ width: 630, height: 630 });
    /* 1200x630 keeps 630x630: a little under half the picture survives. */
    expect(copy.lostFraction).toBeCloseTo(1 - (630 * 630) / (1200 * 630), 6);
  });

  it('crops a tall picture the same way', () => {
    const src = path.join(root, 'sources', 'tall.png');
    drawPicture(src, 640, 1024);
    const copy = squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic002', repoRoot: root });
    expect(imageSize(copy.path)).toEqual({ width: 640, height: 640 });
  });

  /** **It lands beside his pictures, and nowhere else.** Session 62's store. */
  it('writes into the picture store, under the owner, named after the bytes', () => {
    const src = path.join(root, 'sources', 'wide.png');
    const copy = squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic001', repoRoot: root });
    const rel = path.relative(root, copy.path);
    expect(rel.startsWith(path.join('assets', 'client-pictures', OWNER))).toBe(true);
    expect(path.basename(copy.path)).toBe(`pic001-square-${sha256Of(src).slice(0, 16)}.png`);
  });

  /** **Cropped once.** A second build finds it and writes nothing. */
  it('does not crop again when the crop is already there', () => {
    const src = path.join(root, 'sources', 'again.png');
    drawPicture(src, 900, 500);
    const first = squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic003', repoRoot: root });
    const when = statSync(first.path).mtimeMs;
    const second = squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic003', repoRoot: root });
    expect(first.made).toBe(true);
    expect(second.made).toBe(false);
    expect(second.path).toBe(first.path);
    expect(statSync(second.path).mtimeMs).toBe(when);
  });

  /**
   * **Replace the photograph and the crop is remade**, because the name is a
   * function of the bytes — and the old crop is still there, because nothing in
   * this store is ever deleted.
   */
  it('remakes the crop when the photograph is replaced, and keeps the old one', () => {
    const src = path.join(root, 'sources', 'replaced.png');
    drawPicture(src, 800, 400);
    const before = squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic004', repoRoot: root });

    drawPicture(src, 1000, 400);
    const after = squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic004', repoRoot: root });

    expect(after.path).not.toBe(before.path);
    expect(after.made).toBe(true);
    expect(existsSync(before.path)).toBe(true);
  });

  /**
   * **The allow-list of one destination.** Session 83: a photograph is copied
   * into the project and written nowhere else. A crop is a photograph.
   */
  it('refuses to write anywhere but the picture store', () => {
    const src = path.join(root, 'sources', 'wide.png');
    expect(() =>
      squareCopyOf({ sourcePath: src, owner: '../../escape', pictureId: 'pic001', repoRoot: root }),
    ).toThrow(CropError);
  });

  it('says so rather than guessing when the picture is not there', () => {
    expect(() =>
      squareCopyOf({ sourcePath: path.join(root, 'nope.png'), owner: OWNER, pictureId: 'pic009', repoRoot: root }),
    ).toThrow(CropError);
  });

  /** **His file is untouched**, which is the whole promise of copy-not-modify. */
  it('leaves the source byte-identical', () => {
    const src = path.join(root, 'sources', 'untouched.png');
    drawPicture(src, 1500, 700);
    const before = sha256Of(src);
    const size = imageSize(src);
    squareCopyOf({ sourcePath: src, owner: OWNER, pictureId: 'pic005', repoRoot: root });
    expect(sha256Of(src)).toBe(before);
    expect(imageSize(src)).toEqual(size);
  });
});
