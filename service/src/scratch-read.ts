import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { readEditPlan } from './editplan/io.js';
for (const name of ['vitasilk', 'test 1', 'ground truth', 'test 2', 'test 3']) {
  const p = path.join(REPO_ROOT, 'my files', 'test videos', `${name}.editplan.json`);
  try {
    const plan = await readEditPlan(p);
    const s = plan.images.slots;
    console.log(`OK   ${name.padEnd(13)} v${plan.schemaVersion} words=${plan.transcript.words.length} ` +
      `slots=${s.length} candidates=${s.reduce((n, x) => n + x.candidates.length, 0)} ` +
      `modeV=[${s.map((x) => x.promptModeVersion ?? '-').join(',')}]`);
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}
