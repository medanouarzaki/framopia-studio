import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, resolveUserPath } from '@framopia/core';
import {
  configuredDestination,
  humanBytes,
  surveyGroups,
  type GroupSurvey,
} from './set.js';
import { classifyDestination, type DestinationKind } from './destination.js';
import { classifyFile } from './secrets.js';

/**
 * Copy what cannot be got back, and prove the copy is the same.
 *
 * Free and local: it reads files and writes files, calls nothing and bills
 * nothing. **It never deletes anything at the destination** — a file already
 * there whose hash matches is left alone, one that differs is replaced by the
 * current version, and nothing else in the destination is touched.
 *
 * Verification is the point. A copy that silently truncated is worse than no
 * copy, because it is a backup you would trust; every file is re-hashed after
 * writing and a mismatch fails the whole run.
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function printSurvey(groups: GroupSurvey[], withVideo: boolean): void {
  console.log('What this backup protects\n');
  let total = 0;
  for (const g of groups) {
    const skipped = g.optIn === true && !withVideo;
    const size = humanBytes(g.bytes);
    if (!skipped) total += g.bytes;
    console.log(
      `${g.title}\n  ${g.paths.length} ${g.paths.length === 1 ? 'file' : 'files'}, ${size}` +
        `${g.inGit ? ' — already in git' : ''}` +
        `${skipped ? ' — NOT included (pass --with-video)' : ''}\n  ${g.recovery}\n`,
    );
  }
  console.log(`Total to copy: ${humanBytes(total)}`);
}

const groups = surveyGroups();
const withVideo = has('with-video');
const destinationArg = flag('to');
const destination =
  destinationArg === undefined ? configuredDestination() : resolveUserPath(destinationArg);

if (destination === null) {
  printSurvey(groups, withVideo);
  console.log(
    '\nNo destination. Pass --to <directory>, or set "backupDir" in .local/config.json.\n' +
      'Nothing was copied.',
  );
  process.exit(0);
}

if (!existsSync(destination)) {
  console.error(
    `there is no directory at ${destination}. Make it, or plug the disk in, and run this again — ` +
      'this tool does not create a destination, because a typo would silently make one ' +
      'and report a successful backup into it.',
  );
  process.exit(1);
}

const writable = destination;
const declared: DestinationKind | null = has('cloud') ? 'cloud' : has('local') ? 'local' : null;
const kind = declared ?? classifyDestination(writable);
if (kind === 'unknown') {
  console.error(
    `this tool cannot tell whether ${writable} is a cloud folder or a local disk, and it will ` +
      'not guess: getting it wrong one way copies your API keys into a shared folder.\n' +
      'A macOS sync folder is not a mount — Google Drive reports the same filesystem as your ' +
      'own home directory — so nothing on disk separates the two before writing.\n' +
      'Say which it is: pass --cloud or --local.',
  );
  process.exit(1);
}
console.log(
  `\nDestination: ${writable}\n  treated as ${kind === 'cloud' ? 'a cloud folder' : 'a local disk'}` +
    `${declared === null ? '' : ' (you said so)'}` +
    `${kind === 'cloud' ? ', so nothing holding a key will be copied' : ''}`,
);

printSurvey(groups, withVideo);
const root = path.join(writable, 'framopia-studio');
console.log(`\nCopying into ${root}\n`);

let copied = 0;
let already = 0;
let bytes = 0;
const failures: string[] = [];
const skipped: { file: string; reason: string }[] = [];
const startedAt = Date.now();

for (const group of groups) {
  if (group.optIn === true && !withVideo) continue;
  for (const source of group.paths) {
    const relative = path.relative(REPO_ROOT, source);

    /*
     * A dead disk and a shared cloud folder are different risks. A key can be
     * reissued; the ground-truth transcripts cannot — so the key is the one
     * item worth leaving out rather than protecting, and leaving it out is said
     * out loud, because a backup that quietly omits something is one you would
     * over-trust.
     */
    if (kind === 'cloud') {
      const verdict = classifyFile(source);
      if (verdict.secret) {
        skipped.push({ file: relative, reason: verdict.reason ?? 'it holds a credential' });
        continue;
      }
    }

    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });

    const want = sha256(source);
    if (existsSync(target) && sha256(target) === want) {
      already += 1;
      continue;
    }
    copyFileSync(source, target);
    // Re-read from the destination: a copy that truncated is exactly the kind
    // of failure a backup must not report as success.
    if (sha256(target) !== want) {
      failures.push(relative);
      continue;
    }
    copied += 1;
    bytes += statSync(source).size;
  }
  console.log(`  ${group.title}: done`);
}

const seconds = (Date.now() - startedAt) / 1000;
console.log(
  `\n${copied} copied (${humanBytes(bytes)}), ${already} already there and identical, ` +
    `${failures.length} failed verification.`,
);
console.log(
  `Took ${seconds.toFixed(1)}s` +
    (bytes > 0 ? `, about ${humanBytes(bytes / Math.max(seconds, 0.001))} a second.` : '.'),
);

if (skipped.length > 0) {
  console.log(
    `\nNot copied, because this is a cloud folder and ${skipped.length === 1 ? 'this file holds' : 'these files hold'} a key:`,
  );
  for (const s of skipped) console.log(`  ${s.file} — ${s.reason}`);
  console.log('  Keep a copy of it somewhere you would keep passwords. Nothing else was left out.');
}

if (failures.length > 0) {
  console.error('\nthese files did not match after copying, so this backup is NOT complete:');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nEvery file was re-read from the destination and matched by sha256.');
