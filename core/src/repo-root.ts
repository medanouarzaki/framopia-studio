/**
 * Where the repository is, decided once.
 *
 * The panel spent a session telling the user
 * `/service/dist/service.js does not exist` — an absolute path from the root
 * of the disk, and a perfectly authoritative-looking message about a location
 * that never existed. The root had resolved to `/`, and every path built from
 * it composed silently into nonsense.
 *
 * Two rules follow, and they are the whole point of this module:
 *
 * 1. **It never returns an empty string, or any unverified value.** Failure is
 *    a `RepoRootError` naming every candidate tried and what each returned.
 * 2. **A root that resolves to something is not a root that resolves to the
 *    repository.** Every candidate is checked against markers that only this
 *    repo has before it is believed.
 *
 * Filesystem access is injected because the panel's is CEP's `fs`, reached
 * through `cep_node`, and a test's is neither.
 */
export interface RepoRootFs {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, enc: string) => string;
  /** Follows symlinks. CEP always loads the extension through one. */
  realpathSync: (p: string) => string;
}

export interface RepoRootCandidate {
  /** Named in the error, so a failure says which mechanism produced what. */
  source: string;
  /** Any directory inside the repository, or null when the source gave nothing. */
  path: string | null;
}

export interface RepoRootAttempt {
  source: string;
  /** What the source produced, before any resolution. */
  raw: string | null;
  /** What it became after following symlinks and walking up, or null. */
  resolved: string | null;
  /** Why it was rejected, or 'accepted'. */
  outcome: string;
}

export interface RepoRootResolution {
  root: string;
  source: string;
  attempts: RepoRootAttempt[];
}

export class RepoRootError extends Error {
  constructor(
    message: string,
    readonly attempts: RepoRootAttempt[],
  ) {
    super(message);
  }
}

/** The package name in the root `package.json`. */
export const REPO_PACKAGE_NAME = 'framopia-studio';

/**
 * Directories that must be present. `service/` because the panel spawns out of
 * it and `modes/` because the client modes live there — between them they rule
 * out `/`, a parent directory, and the CEP extensions folder, which are the
 * three wrong answers this has actually produced.
 */
export const REPO_MARKER_DIRS = ['service', 'modes', 'core'] as const;

/** How far up from a candidate to look. panel/dist is two; nothing is more. */
const MAX_WALK_UP = 4;

/**
 * Null when the directory really is this repository, otherwise the reason it
 * is not. Checking the package name as well as the directories is what stops a
 * different checkout of a different project from being accepted.
 */
export function verifyRepoRoot(fs: RepoRootFs, candidate: string): string | null {
  if (candidate === '') return 'empty path';
  const pkg = `${candidate}/package.json`;
  if (!fs.existsSync(pkg)) return 'no package.json';
  let name: unknown;
  try {
    name = (JSON.parse(fs.readFileSync(pkg, 'utf8')) as { name?: unknown }).name;
  } catch {
    return 'package.json did not parse';
  }
  if (name !== REPO_PACKAGE_NAME) {
    return `package.json names "${String(name)}", not "${REPO_PACKAGE_NAME}"`;
  }
  for (const dir of REPO_MARKER_DIRS) {
    if (!fs.existsSync(`${candidate}/${dir}`)) return `no ${dir}/ directory`;
  }
  return null;
}

function parentOf(p: string): string {
  const trimmed = p.replace(/\/+$/, '');
  const cut = trimmed.lastIndexOf('/');
  if (cut <= 0) return '/';
  return trimmed.slice(0, cut);
}

/**
 * The first candidate that verifies, after following symlinks and walking up.
 *
 * Walking up rather than taking a fixed number of `..` steps is deliberate:
 * one caller knows the extension directory and another knows `dist` inside it,
 * and hardcoding the depth in each is how they drift apart.
 */
export function resolveRepoRoot(options: {
  fs: RepoRootFs;
  candidates: RepoRootCandidate[];
}): RepoRootResolution {
  const { fs, candidates } = options;
  const attempts: RepoRootAttempt[] = [];

  for (const candidate of candidates) {
    if (candidate.path === null || candidate.path === '') {
      attempts.push({
        source: candidate.source,
        raw: candidate.path,
        resolved: null,
        outcome: 'the source produced nothing',
      });
      continue;
    }

    let start: string;
    try {
      start = fs.realpathSync(candidate.path);
    } catch (error) {
      attempts.push({
        source: candidate.source,
        raw: candidate.path,
        resolved: null,
        outcome: `could not be resolved: ${(error as Error).message}`,
      });
      continue;
    }

    let here = start;
    let reason = 'not the repository';
    let found: string | null = null;
    for (let step = 0; step <= MAX_WALK_UP; step += 1) {
      const problem = verifyRepoRoot(fs, here);
      if (problem === null) {
        found = here;
        break;
      }
      reason = problem;
      const up = parentOf(here);
      if (up === here) break;
      here = up;
    }

    if (found !== null) {
      attempts.push({ source: candidate.source, raw: candidate.path, resolved: found, outcome: 'accepted' });
      return { root: found, source: candidate.source, attempts };
    }
    attempts.push({
      source: candidate.source,
      raw: candidate.path,
      resolved: start,
      outcome: `no repository within ${MAX_WALK_UP} levels above it (${reason})`,
    });
  }

  throw new RepoRootError(
    `the repository root could not be resolved. Tried:\n${attempts
      .map((a) => `  ${a.source}: ${a.raw === null ? '(nothing)' : a.raw} -> ${a.outcome}`)
      .join('\n')}`,
    attempts,
  );
}
