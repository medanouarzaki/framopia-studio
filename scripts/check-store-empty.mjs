/*
 * `assets/client-pictures/` holds clients' own photographs, and it is tracked.
 *
 * Since Block 11 session 62 attaching a photograph copies it there, so every
 * test that creates a client with one writes into the repository. Three suites
 * left 14 photographs behind before their cleanup was fixed, and the failure
 * that guards against is a client's photograph committed by accident — the one
 * kind of file this project is most careful never to move without being told.
 *
 * A clean run was observed once. An observation is not a guard, which is why
 * this runs after the suites on every gate.
 *
 * **It used to demand the directory be empty, and that stopped being true.**
 * Block 12 session 81 found the gate failing on 14 photographs of Dr Loubna
 * Kfafi's, added through the panel — the product doing exactly what session 62
 * built it to do. Emptiness was never the invariant; *the tests leaving nothing
 * behind* is. So the gate records what is there before the suites run and this
 * reports what is there afterwards and was not before. A real client's
 * photographs can sit here for years and say nothing.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = path.join(root, 'assets', 'client-pictures');

/*
 * `--record` writes the list and says nothing. The gate calls it before the
 * suites; comparing against a list made *after* them would compare a run to
 * itself and pass whatever happened.
 */
const recording = process.argv.includes('--record');
const ledgerPath = path.join(root, '.local', 'client-pictures-before.json');

const found = [];
const walk = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Absent is empty: nothing has attached a photograph on this machine.
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else found.push(path.relative(root, full));
  }
};
walk(store);

if (recording) {
  mkdirSync(path.dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(found.sort()), 'utf8');
  process.exit(0);
}

let before = [];
try {
  before = JSON.parse(readFileSync(ledgerPath, 'utf8'));
} catch {
  /*
   * No record means nothing to compare against, and passing on that would be a
   * green that checked nothing — the failure this whole file exists to prevent.
   */
  console.error(
    `check: FAIL — no record of assets/client-pictures/ from before the tests.\n` +
      `Without it a photograph left behind cannot be told from one that was\n` +
      `already there, so this cannot answer and does not pretend to.`,
  );
  process.exit(1);
}

const wasThere = new Set(before);
const left = found.filter((f) => !wasThere.has(f));

if (left.length > 0) {
  console.error(
    `check: FAIL — the tests left ${left.length} file(s) in assets/client-pictures/.\n` +
      `That directory is tracked, and a client's photograph must never be\n` +
      `committed by accident. The suite that made them has to remove its copies\n` +
      `the way it removes its mode files.\n` +
      `Nothing here is deleted for you: look at them, then move them aside.\n\n` +
      left.map((f) => `  ${f}`).join('\n'),
  );
  process.exit(1);
}

console.log(
  found.length === 0
    ? 'check: the tests left nothing in assets/client-pictures/, which was empty'
    : `check: the tests left nothing in assets/client-pictures/; ` +
      `${found.length} photograph(s) were there before and still are`,
);
