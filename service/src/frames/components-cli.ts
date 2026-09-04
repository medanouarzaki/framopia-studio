import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runSidecar } from '../images/sidecar.js';
import { loadReels, reelVideo } from './footage.js';
import {
  COMPONENTS_DEBUG_DIR,
  componentStats,
  maskFramesFor,
  type MaskComponent,
} from './zones.js';

/**
 * Component analysis over the stored binary masks: what the person footprint
 * is made of, and what PERSON_COMPONENT_FLOOR removes from it. Reads masks
 * and writes renders; no mask on disk is modified.
 *
 * The renders are the check on the floor. A histogram says how many
 * components a floor drops; only the picture says whether one was a hand.
 */
const RENDER_COUNT = 12;

const argv = process.argv.slice(2);
const floorIndex = argv.indexOf('--floor');
const componentFloor = floorIndex === -1 ? undefined : Number(argv[floorIndex + 1]);

mkdirSync(COMPONENTS_DEBUG_DIR, { recursive: true });

interface Dropped {
  reel: string;
  frameIndex: number;
  areaFrameFraction: number;
  framePath: string;
  maskPath: string;
  components: MaskComponent[];
}

const perReel: Record<string, { counts: number[]; nonLargest: number[] }> = {};
const worst: Dropped[] = [];
let floorUsed = 0;

for (const reel of loadReels()) {
  const frames = maskFramesFor(reelVideo(reel));
  const stats = await componentStats({
    maskPaths: frames.map((frame) => frame.binaryMaskPath),
    componentFloor,
  });
  floorUsed = stats.componentFloor;

  const counts: number[] = [];
  const nonLargest: number[] = [];
  stats.frames.forEach((entry, index) => {
    const frame = frames[index];
    if (!frame) throw new Error(`component stats returned more frames than the reel has`);
    counts.push(entry.components.length);
    entry.components
      .slice(1)
      .forEach((component) => nonLargest.push(component.areaFrameFraction));

    const dropped = entry.components.filter((component) => component.dropped);
    if (dropped.length > 0) {
      const largest = Math.max(...dropped.map((component) => component.areaFrameFraction));
      worst.push({
        reel: reel.label,
        frameIndex: frame.index,
        areaFrameFraction: largest,
        framePath: frame.framePath,
        maskPath: frame.binaryMaskPath,
        components: entry.components,
      });
    }
  });
  perReel[reel.label] = { counts, nonLargest };
}

worst.sort((a, b) => b.areaFrameFraction - a.areaFrameFraction);
const renders = worst.slice(0, RENDER_COUNT);

if (renders.length > 0) {
  await runSidecar({
    task: 'component_overlay',
    outDir: COMPONENTS_DEBUG_DIR,
    entries: renders.map((entry) => ({
      name: `${entry.reel}-frame-${entry.frameIndex}`,
      framePath: entry.framePath,
      maskPath: entry.maskPath,
      caption:
        `${entry.reel} frame ${entry.frameIndex}: largest dropped ` +
        `${entry.areaFrameFraction.toFixed(6)} of frame (floor ${floorUsed})`,
      components: entry.components,
    })),
  });
}

const quantile = (values: number[], q: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[at] ?? 0;
};

const report = Object.entries(perReel).map(([reel, data]) => ({
  reel,
  frames: data.counts.length,
  componentCounts: {
    one: data.counts.filter((n) => n === 1).length,
    two: data.counts.filter((n) => n === 2).length,
    three: data.counts.filter((n) => n === 3).length,
    fourToNine: data.counts.filter((n) => n >= 4 && n <= 9).length,
    tenPlus: data.counts.filter((n) => n >= 10).length,
    max: Math.max(...data.counts),
  },
  nonLargestArea: {
    n: data.nonLargest.length,
    median: quantile(data.nonLargest, 0.5),
    p90: quantile(data.nonLargest, 0.9),
    max: data.nonLargest.length ? Math.max(...data.nonLargest) : 0,
  },
}));

const largestDropped = worst[0];
writeFileSync(
  path.join(COMPONENTS_DEBUG_DIR, 'components.json'),
  `${JSON.stringify({ componentFloor: floorUsed, perReel: report, largestDropped: largestDropped ? { reel: largestDropped.reel, frameIndex: largestDropped.frameIndex, areaFrameFraction: largestDropped.areaFrameFraction } : null, rendered: renders.length }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({ componentFloor: floorUsed, perReel: report }, null, 2));
if (largestDropped) {
  console.log(
    `largest dropped component: ${largestDropped.reel} frame ${largestDropped.frameIndex} ` +
      `at ${largestDropped.areaFrameFraction.toFixed(6)} of frame`,
  );
}
