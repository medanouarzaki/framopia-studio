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
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = path.join(root, 'assets', 'client-pictures');

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

if (found.length > 0) {
  console.error(
    `check: FAIL — assets/client-pictures/ is not empty after the tests.\n` +
      `${found.length} file(s) are test leavings in a tracked directory, and a\n` +
      `client's photograph must never be committed by accident. The suite that\n` +
      `made them has to remove its copies the way it removes its mode files.\n` +
      `Nothing here is deleted for you: look at them, then move them aside.\n\n` +
      found.map((f) => `  ${f}`).join('\n'),
  );
  process.exit(1);
}
