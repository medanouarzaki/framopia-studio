/*
 * **What the gate's counts depended on.**
 *
 * Block 11 session 64 measured that the service suite reports 1378 tests or
 * 1398, and the panel 122 or 244, according to whether the corpus Edit Plans
 * are on this disk — `render.browser.test.ts` cannot collect its 122 tests
 * without `vitasilk.editplan.json`. So a gate signature is a property of this
 * machine, not of the commit, and two sessions can honestly report different
 * numbers for the same code.
 *
 * That is not fixed here: making the counts independent of the disk means
 * changing tests, which is a larger change than one line of reporting. What
 * this does is stop the dependency being invisible, so a count is never again
 * read as a property of the code.
 *
 * Measured at run time, immediately after the suites, and never asserted: this
 * says what was true on this machine at this moment.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = path.join(root, 'my files', 'test videos');

const plans = existsSync(corpus)
  ? readdirSync(corpus).filter((f) => f.endsWith('.editplan.json'))
  : [];
const reels = existsSync(corpus) ? readdirSync(corpus).filter((f) => f.endsWith('.mov')) : [];
const bytes = reels.reduce((n, f) => n + statSync(path.join(corpus, f)).size, 0);

const gb = (bytes / 1024 ** 3).toFixed(2);
console.log(
  `check: counted with ${plans.length}/5 corpus Edit Plans and ${reels.length}/5 reels ` +
    `(${gb} GB) on this disk — the suite sizes depend on both, so this signature ` +
    `belongs to this machine, not to the commit`,
);

/*
 * **And what was skipped, by name.**
 *
 * A skipped test reads as a passing one in a total. Block 12 session 73 found
 * two panel skips that had been in the signature since before Block 11 and that
 * nobody had ever said the names of. A skip is often right — a test needing
 * hardware this machine has not got should not fail — but it is never right for
 * it to be invisible.
 *
 * Re-running the suites here would double the gate, so this asks git nothing and
 * vitest nothing: it reads the skip conditions out of the source, which is what
 * decides them.
 */
const SKIP = /\.skipIf\(|\bit\.skip\(|\bdescribe\.skip\(/;

function skippingFiles(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.test\.tsx?$/.test(e.name)) {
        const text = readFileSync(full, 'utf8');
        const n = (text.match(new RegExp(SKIP.source, 'g')) ?? []).length;
        if (n > 0) out.push({ file: path.relative(root, full), n });
      }
    }
  };
  walk(dir);
  return out;
}

const skipping = ['core', 'service', 'panel', 'benchmarks'].flatMap((w) =>
  skippingFiles(path.join(root, w, 'src')),
);
const total = skipping.reduce((n, f) => n + f.n, 0);
console.log(
  `check: ${total} skip conditions across ${skipping.length} test files — a skip is a ` +
    `test that did not run, and is counted here so a green total never hides one. ` +
    `reports/block-12-session-73.md names every one and says which are correct.`,
);
