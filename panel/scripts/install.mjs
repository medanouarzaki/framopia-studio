/**
 * Puts the panel where After Effects looks for it, and turns on the debug mode
 * that lets an unsigned extension load at all.
 *
 * Idempotent: run it as often as you like. It reports what it actually did
 * rather than what it would have done, because "already correct" and "just
 * fixed" are different states and the difference is the whole reason to run it
 * twice.
 *
 * The symlink means a rebuild is visible to AE without reinstalling — only the
 * panel needs reopening.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PANEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * **Overridable so it can be watched working.** The real folder is the one
 * After Effects reads, and there is exactly one of it per Mac: driving a test
 * against it would repoint the panel the person is using. This is the same
 * reason `tools/doctor/checks.ts` makes every path overridable — a step that
 * has only ever been run once, by hand, on the machine that wrote it, is not a
 * step anybody has tested.
 *
 * Setting it also skips the `defaults write` below. `PlayerDebugMode` is a
 * per-machine preference that only means anything for the real folder, so a run
 * pointed somewhere else has no business changing it.
 */
const STANDIN = process.env['FRAMOPIA_CEP_EXTENSIONS_DIR'];
const EXTENSIONS =
  STANDIN ??
  path.join(homedir(), 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
const LINK = path.join(EXTENSIONS, 'com.framopia.studio');

/**
 * AE 2026 runs CEP 12, so com.adobe.CSXS.12 is the domain that matters. The
 * neighbours are set too because a machine with several Adobe versions
 * installed will load the panel under whichever CEP the host happens to use,
 * and one unset domain reads as "extension silently absent" with no error
 * anywhere.
 */
const CSXS_DOMAINS = [10, 11, 12, 13];

const did = [];

if (STANDIN !== undefined) {
  console.log(`install: pointed at a stand-in folder, ${STANDIN}`);
  console.log('install: PlayerDebugMode left alone — it only means anything for the real folder');
}

for (const version of STANDIN === undefined ? CSXS_DOMAINS : []) {
  const domain = `com.adobe.CSXS.${version}`;
  let current = null;
  try {
    current = execFileSync('defaults', ['read', domain, 'PlayerDebugMode'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    current = null;
  }
  if (current === '1') {
    did.push(`${domain}: PlayerDebugMode already 1`);
    continue;
  }
  execFileSync('defaults', ['write', domain, 'PlayerDebugMode', '1']);
  did.push(`${domain}: PlayerDebugMode set to 1 (was ${current ?? 'unset'})`);
}

mkdirSync(EXTENSIONS, { recursive: true });

/*
 * **Said before anything is changed, every time.** There is one extensions
 * folder per Mac and it can only point at one checkout. A second checkout — a
 * partner with two clones, or a rehearsal copy on this machine — pointed the
 * same folder somewhere new without a word, and the panel the person was
 * actually using quietly became a different one.
 */
const pointsAtNow = (() => {
  const stat = lstatSync(LINK, { throwIfNoEntry: false });
  if (stat === undefined) return null;
  return stat.isSymbolicLink() ? readlinkSync(LINK) : '(a real directory, not a link)';
})();
console.log(`install: the extensions folder is ${EXTENSIONS}`);
console.log(`install: it points at    ${pointsAtNow ?? '(nothing yet)'}`);
console.log(`install: it would point at ${PANEL}`);

if (existsSync(LINK) || lstatSync(LINK, { throwIfNoEntry: false })) {
  const stat = lstatSync(LINK);
  if (stat.isSymbolicLink() && readlinkSync(LINK) === PANEL) {
    did.push(`${LINK} -> already points at ${PANEL}`);
  } else if (stat.isSymbolicLink()) {
    /*
     * **A flag rather than a question.** This is run by copy-paste from
     * `docs/SECOND_MACHINE.md`, sometimes with no terminal attached to answer a
     * prompt, and a prompt cannot be rehearsed or tested — which is what got
     * this step to session 66 unexercised. A flag is written down, is the same
     * every time, and shows up in whatever the person pastes back.
     */
    if (!process.argv.includes('--repoint')) {
      console.error('');
      console.error('install: REFUSED — this folder already points somewhere else.');
      console.error(`install:   it points at    ${readlinkSync(LINK)}`);
      console.error(`install:   you are asking for ${PANEL}`);
      console.error('');
      console.error('install: After Effects can only load the panel from one of them, and');
      console.error('install: repointing takes the panel away from the other copy. If that is');
      console.error('install: what you want, run the same command again with --repoint on the');
      console.error('install: end. If it is not, nothing here has been changed.');
      process.exit(1);
    }
    const was = readlinkSync(LINK);
    rmSync(LINK);
    symlinkSync(PANEL, LINK);
    did.push(`${LINK} -> repointed to ${PANEL} (was ${was}, and --repoint was given)`);
  } else {
    console.error(
      `install: ${LINK} exists and is not a symlink. Move it aside by hand — ` +
        'this script will not delete a real directory it did not create.',
    );
    process.exit(1);
  }
} else {
  symlinkSync(PANEL, LINK);
  did.push(`${LINK} -> created, pointing at ${PANEL}`);
}

for (const line of did) console.log(`install: ${line}`);

if (!existsSync(path.join(PANEL, 'dist', 'index.html'))) {
  console.log('install: panel/dist is empty — run `npm run panel:build` before opening the panel');
}

console.log(
  'install: After Effects reads the extensions folder at launch. ' +
    'Restart AE once after the first install; after that a rebuild only needs the panel reopened.',
);
