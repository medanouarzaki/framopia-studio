import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadMode, REPO_ROOT } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { renderComparePage, type LuminanceRow } from './prompt-compare-page.js';

/**
 * Free and local. Renders the before-and-after the user judges the image
 * prompt on; generates nothing and reads no network.
 *
 * The luminance figures come from `tools/image-luminance/measure.py --json`,
 * which is the tool that reproduced session 34's published table before it was
 * used for anything new.
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');
const newReel = flag('new') ?? 'test 1';
const oldReel = flag('old') ?? 'vitasilk';
const outDir = flag('out') ?? path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-image-prompt');

function luminance(reel: string): LuminanceRow[] {
  const file = path.join(REPO_ROOT, '.local', 'build', `luminance-${reel.replace(/\s+/g, '-')}.json`);
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as LuminanceRow[];
  } catch {
    console.warn(`no luminance file for ${reel} at ${file}; the page will say "not measured"`);
    return [];
  }
}

const newPlan = await readEditPlan(path.join(FOOTAGE, `${newReel}.editplan.json`));
const oldPlan = await readEditPlan(path.join(FOOTAGE, `${oldReel}.editplan.json`));
const mode = loadMode('k2-syndicalia');

/*
 * Classified from each slot's own words, by hand, as the decision document's
 * own table is. It is a judgement about language and there is no measurement
 * of it — see the report.
 */
const kinds: Record<string, { kind: 'concrete' | 'mood'; why: string }> = {
  img001: { kind: 'mood', why: 'a desired outcome — a natural lift — not an object' },
  img002: { kind: 'concrete', why: 'collagen stimulators: the vial is the thing' },
  img003: { kind: 'mood', why: 'an effect, a light tightening, not a thing' },
  img004: { kind: 'mood', why: 'an outcome — improved skin quality' },
  img005: { kind: 'concrete', why: 'she names the brand' },
};

const html = renderComparePage({
  newPlan, newReel, oldPlan, oldReel,
  newLuminance: luminance(newReel),
  oldLuminance: luminance(oldReel),
  promptBefore: [
    'dominant colour palette of {{palette.background}}, {{palette.primary}} and {{palette.accent}}',
    'lit against {{palette.background}}, with {{palette.light}} reserved for highlights',
  ],
  promptAfter: mode.imageStyle.stylePrompt.slice(2),
  kinds,
});

mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'index.html');
writeFileSync(out, html);
console.log(out);
