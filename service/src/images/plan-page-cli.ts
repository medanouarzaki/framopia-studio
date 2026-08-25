import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { buildPlanPage } from './plan-page.js';

/**
 * The review page for a plan's candidates. Reads what the job wrote and
 * copies the images next to the page so it opens from anywhere. Generates
 * nothing and costs nothing.
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const planPath = flag('plan');
if (planPath === undefined) {
  console.error('usage: npm run plan-page -- --plan <abs path.editplan.json> [--out <dir>]');
  process.exit(1);
}

const outDir =
  flag('out') ?? path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-cutouts', 'vitasilk');
mkdirSync(outDir, { recursive: true });

const plan = await readEditPlan(planPath);
const files = new Map<string, { original: string; cutout: string }>();

for (const slot of plan.images.slots) {
  for (const candidate of slot.candidates) {
    const original = `${candidate.id}.jpg`;
    const cutout = `${candidate.id}.cutout.png`;
    copyFileSync(candidate.path, path.join(outDir, original));
    if (candidate.cutoutPath !== null) {
      copyFileSync(candidate.cutoutPath, path.join(outDir, cutout));
    }
    files.set(candidate.id, { original, cutout });
  }
}

writeFileSync(
  path.join(outDir, 'index.html'),
  buildPlanPage(plan, files, `${path.basename(planPath, '.editplan.json')} — image candidates`),
  'utf8',
);
console.log(`wrote ${files.size} candidates to ${outDir}/index.html`);
