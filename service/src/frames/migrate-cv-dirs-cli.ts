import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR, REPO_ROOT } from '@framopia/core';
import { videoDirName } from '../video-identity.js';

/**
 * Renames what a video already owns into the name it is owed.
 *
 * `.local/cv/<name>/` and `.local/build/loudness/<name>.json` were keyed on a
 * video's filename until Block 10 session 52, and two of his files are called
 * `sora.mov`. Nothing here is recomputed: every one of those directories
 * already records which file it describes — the masks in
 * `masks-2fps/frame-analysis.json`, the loudness record in its own
 * `sourceSha256` — so this reads the hash that is already on disk and moves
 * the directory to the name that hash gives it.
 *
 * It refuses rather than guesses. A directory with no readable hash is left
 * exactly where it is and reported, because the alternative is filing one
 * reel's masks under another reel's name, which is the fault this closes.
 *
 * The manifests inside a moved directory record absolute paths to their own
 * frames and masks, so they are rewritten to the new name in the same pass. A
 * rename without that would leave `segmentation.json` pointing at files that no
 * longer exist, which is the same kind of silent wrongness one directory along.
 *
 * Free, local, and safe to run twice: a directory already carrying its hash is
 * skipped.
 */
const CV_DIR = path.join(LOCAL_DIR, 'cv');
const LOUDNESS_DIR = path.join(REPO_ROOT, '.local', 'build', 'loudness');
const dryRun = process.argv.includes('--dry-run');

function shaFromJson(file: string, field: 'sourceSha256'): string | null {
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const value = parsed[field];
    return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function sourcePathFromJson(file: string): string | null {
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { sourcePath?: unknown };
    return typeof parsed.sourcePath === 'string' ? parsed.sourcePath : null;
  } catch {
    return null;
  }
}

/** Every .json under a moved directory, so nothing keeps the old name. */
function rewritePathsIn(dir: string, from: string, to: string): number {
  let touched = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      touched += rewritePathsIn(full, from, to);
      continue;
    }
    if (!entry.name.endsWith('.json')) continue;
    const before = readFileSync(full, 'utf8');
    const after = before.split(from).join(to);
    if (after === before) continue;
    writeFileSync(full, after, 'utf8');
    touched += 1;
  }
  return touched;
}

let moved = 0;
let skipped = 0;
let refused = 0;

if (existsSync(CV_DIR)) {
  for (const entry of readdirSync(CV_DIR).sort()) {
    const dir = path.join(CV_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;

    const manifest = path.join(dir, 'masks-2fps', 'frame-analysis.json');
    const sha = shaFromJson(manifest, 'sourceSha256');
    const source = sourcePathFromJson(manifest);
    if (sha === null || source === null) {
      console.log(`cv: ${entry} — no frame analysis to say which video this is; left alone`);
      refused += 1;
      continue;
    }

    const want = videoDirName({ path: source, sha256: sha });
    if (entry === want) {
      skipped += 1;
      continue;
    }
    const target = path.join(CV_DIR, want);
    if (existsSync(target)) {
      console.log(`cv: ${entry} — ${want} already exists; left alone`);
      refused += 1;
      continue;
    }
    console.log(`cv: ${entry} -> ${want}`);
    if (!dryRun) {
      renameSync(dir, target);
      const touched = rewritePathsIn(target, `${dir}${path.sep}`, `${target}${path.sep}`);
      console.log(`cv: ${want} — ${touched} manifest(s) repointed`);
    }
    moved += 1;
  }
}

if (existsSync(LOUDNESS_DIR)) {
  for (const entry of readdirSync(LOUDNESS_DIR).sort()) {
    if (!entry.endsWith('.json')) continue;
    const file = path.join(LOUDNESS_DIR, entry);
    const sha = shaFromJson(file, 'sourceSha256');
    const source = sourcePathFromJson(file);
    if (sha === null || source === null) {
      console.log(`loudness: ${entry} — no source recorded; left alone`);
      refused += 1;
      continue;
    }
    const want = `${videoDirName({ path: source, sha256: sha })}.json`;
    if (entry === want) {
      skipped += 1;
      continue;
    }
    const target = path.join(LOUDNESS_DIR, want);
    if (existsSync(target)) {
      console.log(`loudness: ${entry} — ${want} already exists; left alone`);
      refused += 1;
      continue;
    }
    console.log(`loudness: ${entry} -> ${want}`);
    if (!dryRun) renameSync(file, target);
    moved += 1;
  }
}

console.log(
  `${dryRun ? 'would move' : 'moved'} ${moved}, already named ${skipped}, left alone ${refused}`,
);
