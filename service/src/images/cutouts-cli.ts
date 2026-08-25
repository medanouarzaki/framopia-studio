import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { removeBackground, type RemoveBgResult } from './sidecar.js';
import { buildCutoutPage } from './cutout-page.js';

/**
 * Runs the cutout gate over the Block 4 bake-off corpus. **Generates
 * nothing** — it reads the images already on disk.
 */
const CORPUS_DIR = path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-imagebakeoff');
const OUT_DIR = path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-cutouts');

const images = readdirSync(CORPUS_DIR)
  .filter((f) => f.endsWith('.jpg') || f.endsWith('.png'))
  .sort();

mkdirSync(OUT_DIR, { recursive: true });

const results: RemoveBgResult[] = [];
const rows: { result: RemoveBgResult; cutoutFile: string; originalFile: string }[] = [];
for (const file of images) {
  const stem = file.replace(/\.(jpg|png)$/, '');
  process.stderr.write(`${file} ... `);
  const started = Date.now();
  const result = await removeBackground({
    imagePath: path.join(CORPUS_DIR, file),
    outPath: path.join(OUT_DIR, `${stem}.cutout.png`),
    ocr: true,
  });
  process.stderr.write(
    `${result.gate.presentation} ${((Date.now() - started) / 1000).toFixed(1)}s ` +
      `text=${result.ocr?.hasText ?? '?'}\n`,
  );
  results.push(result);
  rows.push({ result, cutoutFile: `${stem}.cutout.png`, originalFile: file });
}

// The originals live next door; copy them in so the page is self-contained
// and can be moved or opened from anywhere.
for (const file of images) {
  copyFileSync(path.join(CORPUS_DIR, file), path.join(OUT_DIR, file));
}

writeFileSync(
  path.join(OUT_DIR, 'index.html'),
  buildCutoutPage(rows, {
    MAX_ALPHA_EDGE_NOISE: 0.02,
    MAX_HOLE_RATIO: 0.01,
    MIN_FOREGROUND_AREA: 0.05,
    MAX_FOREGROUND_AREA: 0.92,
    MAX_EDGE_HALO: 0.1,
  }),
  'utf8',
);

writeFileSync(path.join(OUT_DIR, 'cutouts.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(results, null, 2));
