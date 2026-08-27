/**
 * What both align-review CLIs need: the reel table, the cache entry at the
 * pinned prompt version, and the repo HEAD.
 *
 * Shared so the sheet and the scorer cannot disagree about which entry they
 * read. They are two views of one pairing, and a scorer measuring a different
 * configuration from the sheet it scores would be worse than no scorer.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DraftToken } from '@framopia/core/align-review';
import {
  describeSelection,
  listTranscriptionEntries,
  selectTranscriptionEntry,
} from '@framopia/core/cache-select';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
export const CACHE_ROOT = path.join(REPO_ROOT, '.local', 'cache');
export const OUT_DIR = path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-align-review');
export const REFERENCE_DIR = path.join(REPO_ROOT, 'benchmarks', 'references', 'align');

/** Reel label to the plan basename, which is also the video basename. */
export const REELS: Record<string, string> = {
  'ground-truth': 'ground truth',
  'test-1': 'test 1',
  'test-2': 'test 2',
  'test-3': 'test 3',
  vitasilk: 'vitasilk',
};

export class ReviewError extends Error {}

export interface CachedEntry {
  name: string;
  promptVersion: number | null;
  draft: DraftToken[];
  correctedTexts: string[];
}

export function argValue(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : null;
}

export function argFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

export function reelLabels(): string {
  return Object.keys(REELS).sort().join(', ');
}

export function planPathFor(reel: string): string {
  const basename = REELS[reel];
  if (basename === undefined) throw new ReviewError(`unknown reel "${reel}"; one of ${reelLabels()}`);
  const planPath = path.join(FOOTAGE_DIR, `${basename}.editplan.json`);
  if (!existsSync(planPath)) {
    throw new ReviewError(`no edit plan at ${planPath}; the video sha comes from it`);
  }
  return planPath;
}

export function videoShaFor(reel: string): string {
  const plan = JSON.parse(readFileSync(planPathFor(reel), 'utf8')) as { source: { sha256: string } };
  return plan.source.sha256;
}

/**
 * The entry at the pinned prompt version, by the shared rule in
 * `@framopia/core/cache-select`. Never directory order: a reel holds one entry
 * per configuration and the defect record's own figures came from three
 * different ones, none of which said so.
 */
export function loadEntry(videoSha: string, reel: string, entryOverride: string | null): CachedEntry {
  const entries = listTranscriptionEntries(CACHE_ROOT, videoSha);
  if (entries.length === 0) {
    throw new ReviewError(
      `${reel}: no transcription cache entry under ${path.join(CACHE_ROOT, videoSha)}`,
    );
  }
  const chosen = selectTranscriptionEntry(entries, reel, { entryOverride });

  const manifest = JSON.parse(
    readFileSync(path.join(chosen.dir, 'manifest.json'), 'utf8'),
  ) as Record<string, unknown>;
  const scribeRaw = manifest['scribeRaw'] as { words?: unknown } | undefined;
  const words = Array.isArray(scribeRaw?.words) ? scribeRaw.words : null;
  if (words === null) throw new ReviewError(`${chosen.id}/manifest.json holds no scribeRaw.words`);
  if (manifest['correctionRaw'] === undefined) {
    throw new ReviewError(`${chosen.id}/manifest.json holds no correctionRaw`);
  }
  const correctedTexts = manifest['correctedTexts'];
  if (!Array.isArray(correctedTexts)) {
    throw new ReviewError(`${chosen.id}/manifest.json holds no correctedTexts`);
  }
  const draft = (words as { text: string; start: number; end: number; type: string }[])
    .filter((w) => w.type === 'word')
    .map(({ text, start, end }) => ({ text, start, end }));

  return {
    name: chosen.id,
    promptVersion: chosen.promptVersion,
    draft,
    correctedTexts: correctedTexts as string[],
  };
}

export function describeEntry(entry: CachedEntry): string {
  return describeSelection({ id: entry.name, dir: '', promptVersion: entry.promptVersion });
}

/**
 * Read out of .git rather than by shelling out. The allowlist test in core
 * keeps this tool's imports to fs, path and url — no child_process, so there is
 * no process it could start that could reach the network. A sha is not worth
 * widening that.
 */
export function headSha(): string {
  const gitDir = path.join(REPO_ROOT, '.git');
  try {
    const head = readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head;
    const ref = head.slice(4).trim();
    const loose = path.join(gitDir, ref);
    if (existsSync(loose)) return readFileSync(loose, 'utf8').trim();
    const packed = readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
    for (const line of packed.split('\n')) {
      const [sha, name] = line.split(' ');
      if (name === ref && sha !== undefined) return sha;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
