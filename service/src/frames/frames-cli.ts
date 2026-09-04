import { loadReels, reelByLabel, reelVideo } from './footage.js';
import { sampleFrames } from './sample.js';

/**
 * Frame sampling, ARCHITECTURE §5.5. Local, free, and idempotent only by
 * request: an existing sample is refused rather than replaced, because the
 * masks beside it were computed from those exact frames.
 */
const argv = process.argv.slice(2);
const force = argv.includes('--force');
const all = argv.includes('--all');
const reelIndex = argv.indexOf('--reel');
const label = reelIndex === -1 ? undefined : argv[reelIndex + 1];

if (!all && !label) {
  console.error('usage: npm run frames -- (--reel <label> | --all) [--force]');
  process.exit(2);
}

const reels = all ? loadReels() : [reelByLabel(label as string)];

for (const reel of reels) {
  const manifest = await sampleFrames(reel.label, reelVideo(reel), {
    force,
    onProgress: (message) => process.stderr.write(`${message}\n`),
  });
  console.log(
    `${reel.label}: ${manifest.frames.length} frames at ${manifest.width}x${manifest.height} ` +
      `(scale ${manifest.scale.toFixed(4)}, timestamps ${manifest.timestamps})`,
  );
}
