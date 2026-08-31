import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * A path stored in a file, resolved against the repository that is running now.
 *
 * The Edit Plans hold **absolute** paths — `source.videoPath`,
 * `source.audioPath`, `clientMode.path`, `watermark.assetPath`,
 * `candidates[].path`, `candidates[].cutoutPath` — and Block 10 session 10
 * measured 52 of them across the five plans, every one rooted at the drive this
 * project was written on. That made the whole thing portable only to a machine
 * with a volume of that name, which is not a thing the partner has.
 *
 * **The precedent is `readTranscriptionCache`**, which does
 * `path.join(ref.dir, AUDIO)` and overwrites the manifest's stored absolute
 * path before returning it. Session 10 proved that is exactly why a relocated
 * cache entry still hits. This gives the plans the same property, at read time:
 * the stored value stays what it is — it is provenance — and every reader gets
 * a path that works here.
 *
 * **It does not guess.** A value it cannot classify throws with the path named,
 * because a plausible-looking wrong path is how a build comes to place another
 * video's footage while every check reports success.
 */

/**
 * The repository's own top-level directories.
 *
 * A stored path that begins with one of these, at a segment boundary, is a
 * repo-relative path wearing an old root. `stored-path.test.ts` reads the real
 * directory listing and fails if this drifts from it, so a new top-level
 * directory cannot quietly become unresolvable.
 */
export const REPO_ANCHORS: readonly string[] = [
  '.local',
  'assets',
  'benchmarks',
  'core',
  'docs',
  'handoffs',
  'modes',
  'my files',
  'panel',
  'reports',
  'scripts',
  'service',
  'templates',
  'tools',
];

export class StoredPathError extends Error {}

/** Whether `child` is `parent` or sits inside it, by segments rather than by prefix. */
function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Where the repository-relative part of a stored path begins, or null.
 *
 * The **first** matching segment wins: a repo root is a prefix, so anything
 * before the first anchor is the old root. Matching later would cut inside the
 * tail — `.local/cache/…/images-…` has one anchor, but a reel under
 * `my files/test videos/cutouts` would split at the wrong place if the scan ran
 * backwards.
 */
export function repoRelativeTail(stored: string): string | null {
  const segments = stored.split(path.sep);
  for (let i = 0; i < segments.length; i += 1) {
    if (REPO_ANCHORS.includes(segments[i] as string)) {
      return segments.slice(i).join(path.sep);
    }
  }
  return null;
}

export interface ResolveStoredPathOptions {
  /** The repository running now. Defaults to this one. */
  repoRoot?: string;
  /** Named in the error, so a throw says which field held the bad value. */
  field?: string;
}

/**
 * The four cases, in the order they are decided:
 *
 * 1. Already inside the repository running now — returned unchanged.
 * 2. Inside some other repository root — **re-rooted** onto this one.
 * 3. Genuinely outside any repository — returned unchanged. It is not the
 *    repo's to move: a client's own photograph lives where its owner put it.
 * 4. Not an absolute path at all — **throws**, naming the value.
 *
 * Case 1 is checked first on purpose. A repository whose own path happens to
 * contain a word like `docs` or `core` would otherwise be split at that word.
 */
export function resolveStoredPath(
  stored: string,
  options: ResolveStoredPathOptions = {},
): string {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const where = options.field === undefined ? '' : ` (${options.field})`;

  if (typeof stored !== 'string' || stored.trim() === '') {
    throw new StoredPathError(`a stored path${where} is empty, so nothing can be resolved from it`);
  }
  if (!path.isAbsolute(stored)) {
    throw new StoredPathError(
      `the stored path${where} "${stored}" is not absolute, so it cannot be told from a ` +
        'repository-relative one. Nothing in this project writes a relative path, so this ' +
        'is a corrupt value rather than a portable one.',
    );
  }

  if (isInside(repoRoot, stored)) return stored;

  const tail = repoRelativeTail(stored);
  if (tail === null) return stored;
  return path.join(repoRoot, tail);
}

/** How a value was resolved, for a report that wants to say so. */
export type StoredPathOutcome = 'already-here' | 're-rooted' | 'outside-the-repo';

export function classifyStoredPath(
  stored: string,
  options: ResolveStoredPathOptions = {},
): StoredPathOutcome {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  if (isInside(repoRoot, stored)) return 'already-here';
  return repoRelativeTail(stored) === null ? 'outside-the-repo' : 're-rooted';
}
