/**
 * The identifier both halves of this tool stamp themselves with at build time.
 *
 * **Staleness is a fact about code, never about clocks.** The panel used to
 * compare its own build timestamp against the moment the service process
 * started, which answers a different question: it cannot tell a service that is
 * genuinely behind from one that was simply started first, and it accused a
 * service that was running exactly the right code. Two artifacts built from the
 * same source are the same, whoever started when.
 *
 * The stamp is a commit sha for a human to read plus a content hash of the
 * source both artifacts are built from, and the content hash is what actually
 * decides. The sha alone would call a dirty tree current; the hash alone would
 * be unreadable in a report.
 *
 * **One stamp for the whole build, not one per artifact.** The panel and the
 * service have to be able to compare theirs directly, so both hash the same set
 * of files rather than only their own — a change in `core` reaches both, and a
 * change in `service` changes the contract the panel is written against.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

/**
 * What gets hashed. Source that is compiled or evaluated, and nothing else:
 * tests churn on every session and are not in either artifact, so including
 * them would report a difference where none can reach the user.
 */
const SOURCE_DIRS = [
  ['core', 'src'],
  ['service', 'src'],
  ['panel', 'src'],
  ['panel', 'jsx'],
];

const SOURCE_FILES = [
  ['panel', 'index.html'],
  ['panel', 'CSXS', 'manifest.xml'],
];

const BUILT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.xml']);

function isTest(file) {
  return /\.(test|browser\.test)\.[cm]?[jt]sx?$/.test(file) || file.endsWith('.test.tsx');
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!BUILT_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (isTest(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Every file that is built, relative to the repository root, sorted. */
export function sourceFiles() {
  const found = [];
  for (const parts of SOURCE_DIRS) walk(path.join(REPO_ROOT, ...parts), found);
  for (const parts of SOURCE_FILES) {
    const full = path.join(REPO_ROOT, ...parts);
    try {
      if (statSync(full).isFile()) found.push(full);
    } catch {
      // A file that is not there cannot have been built into anything.
    }
  }
  return found.map((f) => path.relative(REPO_ROOT, f)).sort();
}

export function sourceHash() {
  const hash = createHash('sha256');
  for (const relative of sourceFiles()) {
    hash.update(relative);
    hash.update('\0');
    hash.update(createHash('sha256').update(readFileSync(path.join(REPO_ROOT, relative))).digest());
  }
  return hash.digest('hex').slice(0, 16);
}

/**
 * The commit, for a human. Provenance only — a dirty tree still reports the
 * commit it was based on, which is why the content hash is what decides.
 */
export function commitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short=10', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'nogit';
  }
}

export function buildStamp() {
  return `${commitSha()}+${sourceHash()}`;
}
