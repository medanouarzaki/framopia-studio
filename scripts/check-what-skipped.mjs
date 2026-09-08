/*
 * **What actually did not run, and what was missing — in plain words.**
 *
 * The gate already counts how many skip conditions the suites carry. That is a
 * property of the code and it is the same on every machine. What a person needs
 * is different: **on this run, on this Mac, what was skipped and why.**
 *
 * Block 12 session 74 measured that six conditions can skip on a machine that is
 * not the one this was written on — two needing a browser, one the picture
 * tools, one ffmpeg, one a test reel, one a file kept only in the cloud — and
 * that only the picture tools were ever announced. Those are exactly the things
 * a fresh Mac has not got, so the partner's first green run could have skipped a
 * large part of the suite and looked identical to one that ran all of it.
 *
 * **It never fails.** A Mac without ffmpeg is not a broken Mac, and telling
 * somebody their setup is wrong when it is merely incomplete is how a real
 * failure later gets ignored. The green stays green and carries the list with
 * it.
 *
 * Each thing is checked the same way the test checks it, so this cannot say
 * "present" about something a test then finds absent.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** ffmpeg, resolved the way `resolveFfmpegPath` does: PATH, then Homebrew. */
function hasFfmpeg() {
  const places = [
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ];
  for (const p of places) if (existsSync(p)) return true;
  try {
    // execSync, not execFileSync with a shell: passing args to a shelled child
    // is deprecated in Node 24 and prints a warning into the gate's output.
    execSync('command -v ffmpeg', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** A file Google Drive keeps in the cloud, which macOS reports with zero blocks. */
function hasCloudOnlyFile() {
  const drive = path.join(homedir(), 'Library', 'CloudStorage');
  if (!existsSync(drive)) return false;
  try {
    for (const account of readdirSync(drive)) {
      const myDrive = path.join(drive, account, 'My Drive');
      if (!existsSync(myDrive)) continue;
      for (const name of readdirSync(myDrive)) {
        try {
          const s = statSync(path.join(myDrive, name));
          if (s.isFile() && s.size > 0 && s.blocks === 0) return true;
        } catch {
          // A file that cannot be stat'd is not one to judge by.
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

/** Playwright's browser, which the two review-sheet checks open. */
function hasBrowser() {
  const cache = path.join(homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!existsSync(cache)) return false;
  try {
    return readdirSync(cache).some((d) => d.startsWith('chromium'));
  } catch {
    return false;
  }
}

const CHECKS = [
  {
    present: () => existsSync(path.join(root, 'tools', 'cv', '.venv', 'bin', 'python')),
    skipped: 'the checks that look at the real pictures',
    missing: 'the picture tools are not installed',
    matters: 'Framopia can still make videos; nothing here checks the colours in a frame.',
  },
  {
    present: hasFfmpeg,
    skipped: 'the checks that pull the sound out of a video',
    missing: 'ffmpeg is not installed',
    matters: 'Framopia cannot transcribe anything without it, so this one is worth fixing.',
  },
  {
    present: () =>
      existsSync(path.join(root, 'my files', 'test videos', 'vitasilk.mov')) &&
      hasFfmpeg() &&
      existsSync(path.join(root, 'tools', 'cv', '.venv', 'bin', 'python')),
    skipped: 'the checks that run a whole video through, end to end',
    missing: 'the test videos, ffmpeg or the picture tools are not all here',
    matters: 'Expected on a Mac set up without the test videos. Nothing is wrong.',
  },
  {
    present: hasBrowser,
    skipped: 'the checks that open a real browser window',
    missing: 'the test browser has not been downloaded',
    matters: 'Expected until `npm install` has finished fetching it.',
  },
  {
    present: hasCloudOnlyFile,
    skipped: 'the check for a file kept only in the cloud',
    missing: 'this Mac has no Google Drive file that is not downloaded',
    matters: 'Expected, and harmless. It needs a file in that exact state to look at.',
  },
];

const absent = CHECKS.filter((c) => !c.present());

if (absent.length === 0) {
  console.log('check: nothing was skipped for want of anything on this Mac');
} else {
  console.log('');
  console.log(`check: ${absent.length} thing(s) could not be checked on this Mac.`);
  console.log('       This is not a failure. It is what was not looked at:');
  console.log('');
  for (const c of absent) {
    console.log(`  - ${c.skipped}`);
    console.log(`      because ${c.missing}`);
    console.log(`      ${c.matters}`);
  }
  console.log('');
}
