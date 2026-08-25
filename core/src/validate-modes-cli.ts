import { readdirSync } from 'node:fs';
import { loadMode, MODES_DIR, ModeValidationError } from './mode.js';

/**
 * Every mode in `modes/` must parse and validate. Wired into the regression
 * gate: a mode is data a build reads, so a broken one has to fail here rather
 * than at render time in front of a client.
 */
const files = readdirSync(MODES_DIR).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`no modes found in ${MODES_DIR}`);
  process.exit(1);
}

let failed = 0;
for (const file of files.sort()) {
  const id = file.replace(/\.json$/, '');
  try {
    const mode = loadMode(id);
    console.log(`mode ${mode.id} v${mode.version}: ok (fonts ${mode.fonts.status})`);
  } catch (err) {
    failed += 1;
    if (err instanceof ModeValidationError) {
      console.error(`mode ${id}: FAILED`);
      for (const issue of err.issues) {
        console.error(`  ${issue.path === '' ? '<root>' : issue.path}: ${issue.message}`);
      }
    } else {
      console.error(`mode ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

if (failed > 0) process.exit(1);
