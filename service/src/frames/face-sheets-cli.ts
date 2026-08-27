import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { runSidecar } from '../images/sidecar.js';

/**
 * Contact sheets of the **face-only** mask, so the user can judge it the way
 * Block 5's hair-is-head ruling was judged: by looking at five sheets.
 *
 * Reuses the sidecar's `head_overlay` task rather than adding a renderer. That
 * task tints whichever mask it is handed — it does not know or care which
 * categories went into it — so passing the face mask where it expects the head
 * mask renders the face sheet with the same code, the same tint and the same
 * labels.
 *
 * Free and local: it reads masks already on disk and runs no model.
 */
const OUT_DIR = path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-face');
const REELS = ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk'];

interface FrameEntry {
  index: string;
  framePath: string;
  binaryMaskPath: string;
  headMaskPath: string;
  headRatio: number;
  headBottomY: number;
}

interface SegmentationRecord {
  frames?: { framePath: string; binaryMaskPath: string; facePixelRatio?: number; faceBottomY?: number }[];
}

const sheets: { reel: string; sheet: string; worst: string }[] = [];

for (const reel of REELS) {
  const masks = path.join(REPO_ROOT, '.local', 'cv', reel, 'masks-2fps');
  const record = path.join(masks, 'segmentation.json');
  if (!existsSync(record)) {
    console.log(`${reel}: no segmentation record; skipped`);
    continue;
  }
  const parsed = JSON.parse(readFileSync(record, 'utf8')) as SegmentationRecord;
  const frames: FrameEntry[] = [];
  for (const f of parsed.frames ?? []) {
    const stem = path.basename(f.framePath, path.extname(f.framePath));
    const face = path.join(masks, `${stem}-face.png`);
    if (!existsSync(face)) continue;
    frames.push({
      index: stem.replace('frame-', ''),
      framePath: f.framePath,
      binaryMaskPath: f.binaryMaskPath,
      headMaskPath: face,
      headRatio: f.facePixelRatio ?? 0,
      headBottomY: f.faceBottomY ?? 0,
    });
  }
  if (frames.length === 0) {
    console.log(`${reel}: no face masks on disk; skipped`);
    continue;
  }

  const prefix = reel.replace(/\s+/g, '-');
  const result = await runSidecar<{ contactSheet: string }>({
    task: 'head_overlay',
    frames,
    outDir: OUT_DIR,
    prefix: `${prefix}-face`,
  });

  /*
   * The frame most worth looking at is the one where the mask is smallest
   * relative to the reel: under-coverage shows as a mask that has shrunk away
   * from the face it is meant to protect. This does not decide anything — it
   * points the eye at where to look, and the user rules.
   */
  const ratios = frames.map((f) => f.headRatio);
  const median = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)] ?? 0;
  let worstIndex = 0;
  for (let i = 1; i < ratios.length; i += 1) {
    if ((ratios[i] as number) < (ratios[worstIndex] as number)) worstIndex = i;
  }
  const worst = frames[worstIndex] as FrameEntry;
  const shortfall = median === 0 ? 0 : 1 - (ratios[worstIndex] as number) / median;
  const worstNote =
    `frame ${worst.index}: face area ${(ratios[worstIndex] as number).toFixed(5)} of frame, ` +
    `${(100 * shortfall).toFixed(1)}% below this reel's median of ${median.toFixed(5)}`;

  sheets.push({ reel, sheet: result.contactSheet, worst: worstNote });
  console.log(`${reel.padEnd(14)} ${frames.length} frames -> ${result.contactSheet}`);
  console.log(`   worst frame to check: ${worstNote}`);
}

console.log('\nabsolute paths:');
for (const s of sheets) console.log(`  ${s.sheet}`);
