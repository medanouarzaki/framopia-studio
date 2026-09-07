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
import { existsSync, readdirSync, statSync } from 'node:fs';
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
