import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { measureLoudness, REPO_ROOT, type LoudnessMeasurement } from '@framopia/core';

/**
 * Measures each reel's dialogue loudness, so sound levels can be set against
 * the voice instead of against nothing.
 *
 * **Why this exists.** The SFX targets were −20 dB and −24 dB, chosen in
 * Block 5 before any comp existed and never heard. They are **absolute**: a
 * sound at −20 dBFS is loud under a quiet reel and inaudible under a loud one.
 * The user built `vitasilk` and could not hear the hits — its dialogue runs
 * −14.4 LUFS with a true peak at 0.0 dBFS, so a −20 dBFS transient sits twenty
 * decibels under the voice and is masked by it.
 *
 * Integrated loudness (EBU R128) is the anchor rather than peak: it is what the
 * ear averages over a reel, and it is what a quiet reel and a loud one actually
 * differ by. Peak is reported beside it because a reel already at 0.0 dBFS has
 * no headroom, which is a different fact.
 *
 * $0.00 and local: ffmpeg through session 16's resolver, never a bare name on
 * `PATH`, which a Finder-launched After Effects does not inherit.
 *
 * **The measurement itself is `measureLoudness` in core**, which the pipeline
 * also calls, so this file and the driven stage cannot measure differently.
 * What is left here is the sweep over every catalogued reel and the table.
 */
const FOOTAGE = path.join(REPO_ROOT, 'benchmarks', 'footage.json');
const OUT = path.join(REPO_ROOT, '.local', 'build', 'loudness.json');

const footage = JSON.parse(readFileSync(FOOTAGE, 'utf8')) as {
  reels: { label: string; path: string }[];
};

const rows: LoudnessMeasurement[] = [];
for (const reel of footage.reels) {
  if (!existsSync(reel.path)) {
    console.log(`${reel.label.padEnd(14)} not on this machine; skipped`);
    continue;
  }
  rows.push(measureLoudness(reel.path, reel.label));
}

const pad = (s: string | number, n: number): string => String(s).padStart(n);
console.log(`${'reel'.padEnd(14)}${pad('integrated', 13)}${pad('LRA', 9)}${pad('true peak', 13)}`);
for (const row of rows) {
  console.log(
    row.reel.padEnd(14) +
      pad(`${row.integratedLufs.toFixed(1)} LUFS`, 13) +
      pad(`${row.lraLu.toFixed(1)} LU`, 9) +
      pad(`${row.truePeakDbfs.toFixed(1)} dBFS`, 13),
  );
}

writeFileSync(OUT, `${JSON.stringify({ reels: rows }, null, 2)}\n`, 'utf8');
console.log(`\nwritten to ${path.relative(REPO_ROOT, OUT)}. $0.00 — local measurement.`);
