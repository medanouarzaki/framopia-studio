/**
 * `npm run check:attribution` — no AI fingerprints in the repository or its
 * history.
 *
 * Scans every tracked text file and every commit message. See
 * `core/src/attribution.ts` for what counts as a marker and why a quoted
 * occurrence does not.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ATTRIBUTION_HISTORICAL_COMMITS,
  ATTRIBUTION_PATTERNS,
  REPO_ROOT,
  findAttribution,
  formatAttributionHit,
  type AttributionHit,
} from '@framopia/core';

const root = process.env['FRAMOPIA_ATTRIBUTION_ROOT'] ?? REPO_ROOT;

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Tracked files, minus anything git reports as binary. */
function trackedTextFiles(): string[] {
  return git(['ls-files', '-z'])
    .split('\0')
    .filter((f) => f !== '')
    .filter((f) => {
      try {
        const numstat = git(['diff', '--numstat', '--no-index', '/dev/null', f]);
        return !numstat.startsWith('-\t-\t');
      } catch {
        return true;
      }
    });
}

const hits: AttributionHit[] = [];

let files = 0;
for (const file of trackedTextFiles()) {
  let text: string;
  try {
    text = readFileSync(path.join(root, file), 'utf8');
  } catch {
    continue;
  }
  files += 1;
  hits.push(...findAttribution(file, text));
}

// Commit messages, which is where a trailer is injected and where nothing else
// in this repo would ever look. Fourteen from a superseded generation of the
// project cannot be corrected without rewriting pushed history; they are listed
// by sha in core, dated, and everything else fails.
const historical = new Set(ATTRIBUTION_HISTORICAL_COMMITS);
let commits = 0;
let skippedHistorical = 0;
const log = git(['log', '--format=%H%x1f%B%x1e']);
for (const entry of log.split('\x1e')) {
  const trimmed = entry.replace(/^\n+/, '');
  if (trimmed === '') continue;
  const [sha, body] = trimmed.split('\x1f');
  if (sha === undefined || body === undefined) continue;
  commits += 1;
  if (historical.has(sha)) {
    skippedHistorical += 1;
    continue;
  }
  hits.push(...findAttribution(`commit ${sha.slice(0, 10)}`, body));
}

console.log(
  `attribution: ${files} tracked text file(s), ${commits - skippedHistorical} commit message(s), ` +
    `${ATTRIBUTION_PATTERNS.length} marker patterns`,
);
console.log(
  `             ${skippedHistorical} historical commit(s) from 2026-07 carry a trailer and are ` +
    'listed by sha: pushed history is not rewritten',
);
console.log(
  '             a marker inside quotes is this repository stating the rule, not attribution',
);

if (hits.length > 0) {
  console.error(`\n${hits.length} AI attribution marker(s):\n`);
  for (const hit of hits) console.error(formatAttributionHit(hit));
  console.error(
    '\nPROJECT_SPEC §1 and CLAUDE_CODE_GUIDELINES §1 forbid these anywhere in the ' +
      'repository, its documentation and its history. Remove the marker; if a document ' +
      'needs to name one to state the rule, quote it.',
  );
  process.exit(1);
}
console.log('attribution: PASS');
