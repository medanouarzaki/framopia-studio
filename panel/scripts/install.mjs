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
const EXTENSIONS = path.join(
  homedir(),
  'Library',
  'Application Support',
  'Adobe',
  'CEP',
  'extensions',
);
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

for (const version of CSXS_DOMAINS) {
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

if (existsSync(LINK) || lstatSync(LINK, { throwIfNoEntry: false })) {
  const stat = lstatSync(LINK);
  if (stat.isSymbolicLink() && readlinkSync(LINK) === PANEL) {
    did.push(`${LINK} -> already points at ${PANEL}`);
  } else if (stat.isSymbolicLink()) {
    rmSync(LINK);
    symlinkSync(PANEL, LINK);
    did.push(`${LINK} -> repointed to ${PANEL}`);
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
