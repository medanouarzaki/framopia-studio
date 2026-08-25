import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runSidecar } from '../images/sidecar.js';
import { loadReels, reelByLabel } from './footage.js';
import { reelMasksDir } from './segment.js';
import { SAMPLE_FPS } from './sample.js';
import {
  ZONES_DEBUG_DIR,
  computeZones,
  maskFramesFor,
  summariseZones,
  type ComputeZonesResult,
} from './zones.js';

/**
 * Zone derivation over an already-segmented reel. Local, free, no inference:
 * it reads the masks session 1 wrote and never re-segments.
 *
 * `--threshold` re-thresholds the stored confidence masks instead of reading
 * the binary ones, which is how the sensitivity sweep runs one variable.
 */
const argv = process.argv.slice(2);
const all = argv.includes('--all');
const noDebug = argv.includes('--no-debug');
const reelIndex = argv.indexOf('--reel');
const label = reelIndex === -1 ? undefined : argv[reelIndex + 1];
const thresholdIndex = argv.indexOf('--threshold');
const threshold = thresholdIndex === -1 ? undefined : Number(argv[thresholdIndex + 1]);

if (!all && !label) {
  console.error(
    'usage: npm run zones -- (--reel <label> | --all) [--threshold <t>] [--no-debug]',
  );
  process.exit(2);
}
if (threshold !== undefined && !Number.isFinite(threshold)) {
  console.error('--threshold needs a number');
  process.exit(2);
}

const reels = all ? loadReels() : [reelByLabel(label as string)];
if (!noDebug) mkdirSync(ZONES_DEBUG_DIR, { recursive: true });

for (const reel of reels) {
  const frames = maskFramesFor(reel.path);
  const maskPaths = frames.map((frame) =>
    threshold === undefined ? frame.binaryMaskPath : frame.confidenceMaskPath,
  );

  const started = Date.now();
  const result: ComputeZonesResult = await computeZones({
    frames: maskPaths.map((maskPath, index) => ({
      maskPath,
      timeS: frames[index]?.timeS ?? 0,
    })),
    sampleFps: SAMPLE_FPS,
    threshold,
  });
  const elapsedS = (Date.now() - started) / 1000;

  const summary = summariseZones(result.zones);
  const suffix = threshold === undefined ? '' : `-t${threshold}`;
  writeFileSync(
    path.join(reelMasksDir(reel.path), `zones${suffix}.json`),
    `${JSON.stringify({ reel: reel.label, elapsedS, ...result }, null, 2)}\n`,
    'utf8',
  );

  if (!noDebug) {
    // Only the frames whose zones are actually active at that instant are
    // drawn, so the sheet shows what the reduction decided rather than every
    // rectangle that ever existed.
    await runSidecar({
      task: 'zone_overlay',
      outDir: ZONES_DEBUG_DIR,
      prefix: reel.label,
      durationS: reel.durationS,
      zones: result.zones,
      frames: frames.map((frame) => ({
        index: frame.index,
        timeS: frame.timeS,
        framePath: frame.framePath,
        binaryMaskPath: frame.binaryMaskPath,
        zones: result.zones
          .filter((zone) =>
            zone.valid.some(([start, end]) => frame.timeS >= start && frame.timeS <= end),
          )
          .map((zone) => ({ kind: zone.kind, rect: zone.rect })),
      })),
    });
  }

  console.log(
    `${reel.label}: ${result.zones.length} zones in ${elapsedS.toFixed(1)}s, ` +
      `${result.emptySamples} empty samples of ${result.perFrame.length}` +
      summary
        .map((row) => `\n    ${row.kind}: ${row.count} zones, mean area ` +
          `${row.meanRectArea.toFixed(4)}, ${row.totalValidS.toFixed(2)}s valid`)
        .join(''),
  );
}
