import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

/**
 * What this project cannot get back.
 *
 * The test is not "expensive" — it is **"no amount of money reproduces this
 * file"**. Almost everything here can be rebuilt from the repository: frames
 * and masks are bit-identical across runs (measured in Block 5), extracted
 * audio is ffmpeg, every report regenerates from disk. Four things fail the
 * test, and only one of them was ever written down:
 *
 * - **The Gemini correction call is not reproducible.** Re-transcribing a reel
 *   costs about $0.17 and returns *different* corrected words, so the cached
 *   entries are not a saved expense — they are the only copy of the transcript
 *   both hand-made references describe.
 * - **The hand-made alignment references** are a human's judgement, and the
 *   only non-circular measure of aligner correctness in this project. They are
 *   in git, which is the one part of this that is already safe.
 * - **The hand-written ground truth** in `.local/ground-truth/` is the same
 *   kind of thing — a person transcribing four reels by ear — and it is
 *   **gitignored**, so it exists on this disk and nowhere else.
 * - **The cost ledger** is a record of money that was actually spent. A new one
 *   would be a different claim about the past.
 *
 * Everything a **person decided** belongs here too: the Edit Plans carry chosen
 * candidates, promoted and removed keywords, and edited words, and none of that
 * survives being re-derived.
 */
export interface BackupGroup {
  id: string;
  /** What it is, in the words the report uses. */
  title: string;
  /** Why it cannot be got back, or what regenerating it would cost. */
  recovery: string;
  /** True when git already holds it. */
  inGit: boolean;
  /** Included unless the user asks otherwise; video is opt-in for its size. */
  optIn?: boolean;
  files: () => string[];
}

function walk(dir: string, keep: (file: string) => boolean = () => true): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, keep));
    else if (keep(full)) out.push(full);
  }
  return out;
}

/** Cache entries of one stage, across every video hash. */
function cacheEntries(prefixes: string[]): string[] {
  const root = path.join(REPO_ROOT, '.local', 'cache');
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const video of readdirSync(root, { withFileTypes: true })) {
    if (!video.isDirectory()) continue;
    const videoDir = path.join(root, video.name);
    for (const entry of readdirSync(videoDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!prefixes.some((p) => entry.name.startsWith(`${p}-`))) continue;
      out.push(...walk(path.join(videoDir, entry.name)));
    }
  }
  return out.sort();
}

const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

export const BACKUP_GROUPS: readonly BackupGroup[] = [
  {
    id: 'transcription-cache',
    title: 'Transcription cache entries',
    recovery:
      'CANNOT be regenerated. Re-transcribing costs about $0.17 a reel and the ' +
      'Gemini correction is not reproducible, so it returns different words — ' +
      'and both hand-made references describe the transcript that is here.',
    inGit: false,
    files: () => cacheEntries(['transcription']),
  },
  {
    id: 'analysis-cache',
    title: 'Keyword and image-slot analysis entries',
    recovery:
      'CANNOT be regenerated identically. About $0.18 a reel, and three ' +
      'identical calls have returned three different answers.',
    inGit: false,
    files: () => cacheEntries(['analysis', 'imageslots']),
  },
  {
    id: 'ground-truth',
    title: 'Hand-written ground-truth transcripts',
    recovery:
      'CANNOT be regenerated. A person transcribed four reels by ear; this is ' +
      'the WER baseline for the whole project. Gitignored, so this disk is the ' +
      'only copy.',
    inGit: false,
    files: () =>
      walk(path.join(REPO_ROOT, '.local', 'ground-truth'), (f) => !f.endsWith('.html')),
  },
  {
    id: 'align-references',
    title: 'Hand-made alignment references',
    recovery:
      'CANNOT be regenerated. A human’s verdicts, and the only non-circular ' +
      'measure of aligner correctness here. Already in git.',
    inGit: true,
    files: () => walk(path.join(REPO_ROOT, 'benchmarks', 'references', 'align')),
  },
  {
    id: 'ledger',
    title: 'The cost ledger',
    recovery:
      'CANNOT be regenerated. It records money that was actually spent; a fresh ' +
      'one would be a different claim about the past.',
    inGit: false,
    files: () => {
      const p = path.join(REPO_ROOT, '.local', 'costs.jsonl');
      return existsSync(p) ? [p] : [];
    },
  },
  {
    id: 'plans',
    title: 'Edit Plans, including their backups',
    recovery:
      'CANNOT be regenerated as they stand. They carry chosen candidates, ' +
      'promoted and removed keywords and edited words — decisions a person made, ' +
      'which re-deriving discards.',
    inGit: false,
    files: () => walk(FOOTAGE_DIR, (f) => f.includes('.editplan.json')),
  },
  {
    id: 'images',
    title: 'Generated images and their cutouts',
    recovery:
      'About $1.55 a reel to regenerate, and an image model returns different ' +
      'pictures each time — so the ones already reviewed would be gone.',
    inGit: false,
    files: () => [
      ...cacheEntries(['images']),
      ...walk(path.join(FOOTAGE_DIR, 'cutouts')),
    ],
  },
  {
    id: 'config',
    title: 'Machine-local config',
    recovery:
      'Holds API keys. New keys can be issued, but a backup without it cannot ' +
      'run anything. **Keep the destination somewhere you would keep keys.**',
    inGit: false,
    files: () => {
      const p = path.join(REPO_ROOT, '.local', 'config.json');
      return existsSync(p) ? [p] : [];
    },
  },
  {
    id: 'footage',
    title: 'Source video',
    recovery:
      'CANNOT be regenerated by this project at all. Large, and you may already ' +
      'have it elsewhere, so it is opt-in: pass --with-video.',
    inGit: false,
    optIn: true,
    files: () => walk(FOOTAGE_DIR, (f) => /\.(mov|mp4|m4v)$/i.test(f)),
  },
];

export interface GroupSurvey extends BackupGroup {
  paths: string[];
  bytes: number;
}

export function surveyGroups(): GroupSurvey[] {
  return BACKUP_GROUPS.map((group) => {
    const paths = group.files();
    let bytes = 0;
    for (const p of paths) bytes += statSync(p).size;
    return { ...group, paths, bytes };
  });
}

/**
 * Where a backup goes when the user does not say. Machine-local, like every
 * other per-machine setting — a default written into the repository would be a
 * path that is right on one disk and wrong on the next.
 */
export function configuredDestination(): string | null {
  const configPath = path.join(REPO_ROOT, '.local', 'config.json');
  if (!existsSync(configPath)) return null;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { backupDir?: unknown };
    return typeof config.backupDir === 'string' && config.backupDir.length > 0
      ? config.backupDir
      : null;
  } catch {
    return null;
  }
}

export function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} bytes`;
}
