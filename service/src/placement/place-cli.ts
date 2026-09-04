import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { editPlanPathFor, readEditPlan } from '../editplan/io.js';
import { loadReels, reelByLabel, reelVideo } from '../frames/footage.js';
import { maskFramesFor } from '../frames/zones.js';
import { runSidecar } from '../images/sidecar.js';
import { FRAME_HEIGHT, FRAME_WIDTH, SUBTITLE_BAND } from './constants.js';
import { writePlacementsToPlan } from './plan-placement.js';
import { solvePlacements } from './solve.js';

/**
 * The placement solver over a reel's Edit Plan. Local, free, deterministic.
 * `--dry-run` solves and reports without writing the plan.
 */
export const PLACEMENT_DEBUG_DIR = path.join(
  REPO_ROOT,
  'benchmarks',
  'results',
  'latest-placement',
);

const argv = process.argv.slice(2);
const all = argv.includes('--all');
const dryRun = argv.includes('--dry-run');
const noDebug = argv.includes('--no-debug');
const reelIndex = argv.indexOf('--reel');
const label = reelIndex === -1 ? undefined : argv[reelIndex + 1];

if (!all && !label) {
  console.error('usage: npm run place -- (--reel <label> | --all) [--dry-run] [--no-debug]');
  process.exit(2);
}

const reels = all ? loadReels() : [reelByLabel(label as string)];
if (!noDebug) mkdirSync(PLACEMENT_DEBUG_DIR, { recursive: true });

for (const reel of reels) {
  const planPath = editPlanPathFor(reel.path);
  const plan = await readEditPlan(planPath);
  if (plan.images.slots.length === 0) {
    console.log(`${reel.label}: no image slots, nothing to place`);
    continue;
  }

  const solved = dryRun
    ? solvePlacements(plan)
    : await writePlacementsToPlan(planPath, new Date().toISOString()).then((result) => {
        console.log(
          `${reel.label}: plan updated, keys changed [${result.changedTopLevelKeys.join(', ')}]`,
        );
        return result;
      });

  for (const placement of solved.placements) {
    const px = {
      x: placement.rect.x * FRAME_WIDTH,
      y: placement.rect.y * FRAME_HEIGHT,
      side: placement.rect.w * FRAME_WIDTH,
    };
    console.log(
      `  ${placement.slotId}  zone ${placement.zoneId.padEnd(11)} ${placement.presentation.padEnd(6)} ` +
        `pos (${placement.position.x.toFixed(4)}, ${placement.position.y.toFixed(4)})  ` +
        `scale ${placement.scale.toFixed(4)}  ` +
        `px (${px.x.toFixed(0)}, ${px.y.toFixed(0)}, ${px.side.toFixed(0)}sq)`,
    );
  }
  console.log(
    `  time-overlap constraint fired: ${solved.timeOverlapConstraintFired ? 'yes' : 'no'}`,
  );

  if (noDebug) continue;

  const frames = maskFramesFor(reelVideo(reel));
  const nearest = (timeS: number) =>
    frames.reduce((best, frame) =>
      Math.abs(frame.timeS - timeS) < Math.abs(best.timeS - timeS) ? frame : best,
    );

  const slotEntries = solved.placements.map((placement) => {
    const slot = plan.images.slots.find((s) => s.id === placement.slotId);
    const midpoint = slot ? (slot.start + slot.end) / 2 : 0;
    const frame = nearest(midpoint);
    const zone = plan.zones.zones.find((z) => z.id === placement.zoneId);
    return {
      name: `${reel.label}-slot-${placement.slotId}`,
      framePath: frame.framePath,
      maskPath: frame.binaryMaskPath,
      subtitleBand: SUBTITLE_BAND,
      zoneKind: zone?.kind ?? 'top',
      zoneRect: zone?.rect ?? placement.rect,
      rect: placement.rect,
      label: `${placement.slotId} ${placement.presentation} scale ${placement.scale.toFixed(3)}`,
      caption:
        `${reel.label} ${placement.slotId} at ${midpoint.toFixed(2)}s in ${placement.zoneId} ` +
        `(frame ${frame.index}, ${frame.timeS.toFixed(3)}s)`,
    };
  });

  await runSidecar({
    task: 'placement_overlay',
    outDir: PLACEMENT_DEBUG_DIR,
    slots: slotEntries,
    overview: {
      name: `${reel.label}-overview`,
      framePath: nearest(reel.durationS / 2).framePath,
      maskPath: nearest(reel.durationS / 2).binaryMaskPath,
      subtitleBand: SUBTITLE_BAND,
      caption: `${reel.label}: ${solved.placements.length} placements on one frame`,
      placements: solved.placements.map((placement) => ({
        rect: placement.rect,
        label: `${placement.slotId} ${placement.scale.toFixed(3)}`,
      })),
    },
  });
}
