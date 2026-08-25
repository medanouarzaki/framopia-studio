import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadReels, reelByLabel } from './footage.js';
import { readFramesManifest } from './sample.js';
import {
  SEGMENTATION_DEBUG_DIR,
  reelMasksDir,
  segmentOverlay,
  segmentPerson,
  summarise,
  type SegmentPersonResult,
} from './segment.js';

/**
 * Person segmentation over an already-sampled reel. Local and free, so it is
 * run over every reel in the catalogue rather than the one or two that most
 * of this project's headline numbers rest on.
 */
const argv = process.argv.slice(2);
const all = argv.includes('--all');
const noDebug = argv.includes('--no-debug');
const reelIndex = argv.indexOf('--reel');
const label = reelIndex === -1 ? undefined : argv[reelIndex + 1];

if (!all && !label) {
  console.error('usage: npm run segment -- (--reel <label> | --all) [--no-debug]');
  process.exit(2);
}

const reels = all ? loadReels() : [reelByLabel(label as string)];
if (!noDebug) mkdirSync(SEGMENTATION_DEBUG_DIR, { recursive: true });

for (const reel of reels) {
  const manifest = readFramesManifest(reel.path);
  const outDir = reelMasksDir(reel.path);

  const started = Date.now();
  const result: SegmentPersonResult = await segmentPerson({
    framePaths: manifest.frames.map((f) => f.path),
    outDir,
  });
  const elapsedS = (Date.now() - started) / 1000;

  const summary = summarise(result.frames);
  writeFileSync(
    path.join(outDir, 'segmentation.json'),
    `${JSON.stringify({ reel: reel.label, elapsedS, ...result }, null, 2)}\n`,
    'utf8',
  );

  if (!noDebug) {
    await segmentOverlay({
      frames: result.frames.map((frame, index) => {
        const sampled = manifest.frames[index];
        if (!sampled) {
          throw new Error(
            `segmentation returned ${result.frames.length} frames for a manifest of ` +
              `${manifest.frames.length}`,
          );
        }
        return {
          index: sampled.index,
          timeS: sampled.timeS,
          framePath: frame.framePath,
          binaryMaskPath: frame.binaryMaskPath,
        };
      }),
      outDir: SEGMENTATION_DEBUG_DIR,
      prefix: reel.label,
    });
  }

  console.log(
    `${reel.label}: ${result.frames.length} frames in ${elapsedS.toFixed(1)}s, ` +
      `ratio min ${summary.min.toFixed(4)} median ${summary.median.toFixed(4)} ` +
      `max ${summary.max.toFixed(4)}, ${summary.nullBoxes} null bbox`,
  );
}
