import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  listTranscriptionEntries,
  selectTranscriptionEntry,
} from '@framopia/core';
import { CACHE_ROOT } from './cache.js';

/**
 * Cache entries a committed hand-made reference depends on, which eviction may
 * never remove.
 *
 * A reference in `benchmarks/references/align/` is a human's judgement of the
 * pairing between specific corrected words and specific draft tokens. The
 * Gemini correction call is not reproducible, so evicting the entry those words
 * came from does not cost a re-transcription — it makes the reference a
 * description of a transcript that no longer exists and **cannot be recreated
 * at any price**. It is the project's only non-circular measure of aligner
 * correctness.
 *
 * **The set is derived, never typed.** The reference names its reel; the reel
 * names its plan; the plan carries the video hash; and the entry is whichever
 * one the declared selection rule picks. A hardcoded directory name would be a
 * list nobody checks, and would silently stop protecting anything the day a
 * reference was added for another reel.
 *
 * The one thing a reference does not record is the entry id itself, so this
 * resolves it through `selectTranscriptionEntry` — the same rule every review
 * tool reads by. That is exact while the pinned prompt version is the one the
 * references were collected at, and `ACTIVE_PROMPT_VERSION` is frozen for
 * Block 8 precisely because moving it invalidates them anyway.
 */
export const REFERENCE_DIR = path.join(
  REPO_ROOT,
  'benchmarks',
  'references',
  'align',
);
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

/** Reel label to the plan basename, which is also the video basename. */
const PLAN_BASENAME: Record<string, string> = {
  'ground-truth': 'ground truth',
  'test-1': 'test 1',
  'test-2': 'test 2',
  'test-3': 'test 3',
  vitasilk: 'vitasilk',
};

export interface ProtectedEntry {
  reel: string;
  reference: string;
  videoSha256: string;
  dir: string;
  entryId: string;
}

function reelsWithReferences(
  referenceDir: string,
): { reel: string; file: string }[] {
  if (!existsSync(referenceDir)) return [];
  const found: { reel: string; file: string }[] = [];
  for (const file of readdirSync(referenceDir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    try {
      const parsed = JSON.parse(
        readFileSync(path.join(referenceDir, file), 'utf8'),
      ) as {
        reel?: unknown;
      };
      if (typeof parsed.reel === 'string')
        found.push({ reel: parsed.reel, file });
    } catch {
      // A reference that does not parse protects nothing, and is not this
      // function's problem to report: the scorer refuses on it already.
    }
  }
  return found;
}

/**
 * Every entry directory a committed reference depends on. Unresolvable reels —
 * no plan on this machine, no entry at the pinned version — are skipped
 * silently: this is a guard against deletion, and a reel whose entry cannot be
 * found has nothing to delete.
 */
export function protectedEntryDirs(
  options: {
    cacheRoot?: string;
    referenceDir?: string;
    footageDir?: string;
  } = {},
): ProtectedEntry[] {
  const cacheRoot = options.cacheRoot ?? CACHE_ROOT;
  const footageDir = options.footageDir ?? FOOTAGE_DIR;
  const protectedEntries: ProtectedEntry[] = [];
  const seen = new Set<string>();

  for (const { reel, file } of reelsWithReferences(
    options.referenceDir ?? REFERENCE_DIR,
  )) {
    const basename = PLAN_BASENAME[reel];
    if (basename === undefined) continue;
    const planPath = path.join(footageDir, `${basename}.editplan.json`);
    if (!existsSync(planPath)) continue;

    let videoSha256: string;
    try {
      videoSha256 = (
        JSON.parse(readFileSync(planPath, 'utf8')) as {
          source?: { sha256?: string };
        }
      ).source?.sha256 as string;
    } catch {
      continue;
    }
    if (typeof videoSha256 !== 'string' || videoSha256 === '') continue;

    let chosen;
    try {
      chosen = selectTranscriptionEntry(
        listTranscriptionEntries(cacheRoot, videoSha256),
        reel,
      );
    } catch {
      continue;
    }
    if (seen.has(chosen.dir)) continue;
    seen.add(chosen.dir);
    protectedEntries.push({
      reel,
      reference: file,
      videoSha256,
      dir: chosen.dir,
      entryId: chosen.id,
    });
  }

  return protectedEntries;
}

export function protectedDirsFor(
  videoSha256: string,
  options: Parameters<typeof protectedEntryDirs>[0] = {},
): string[] {
  return protectedEntryDirs(options)
    .filter((e) => e.videoSha256 === videoSha256)
    .map((e) => e.dir);
}
