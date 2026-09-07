import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';

/** The three trees a user-facing message can be written in. */
const SCANNED = ['panel/src', 'core/src', 'service/src'];

/**
 * A message naming a path or a command is a claim, and a claim nobody checked
 * is how the panel came to tell the user to run `npm run service:build` about
 * a file at `/service/dist/service.js` that could never have existed.
 *
 * This cannot verify a path computed at runtime — that is the code's job, at
 * the moment it displays it. What it can verify is the fixed half: every
 * `npm run …` a user-facing message tells someone to type must be a script
 * that exists.
 */
/**
 * **The cases below are generated, so their input decides the test count.**
 *
 * This walked `panel/src`, `core/src` and `service/src` on disk, so anything
 * lying in the tree changed how many tests core had. Block 11 session 63 found
 * what that costs: session 62 stashed two of its three modified files, the
 * third kept a generated case alive, and the session concluded the count had
 * been wrong since session 61 and said so in its report. It had not. A count
 * that moves with untracked scratch files is not a property of a commit and
 * cannot be asserted from one session to the next.
 *
 * So the cases come from the commit. `git grep` is given the revision, which
 * reads the blobs at that commit and never looks at the working tree, and git
 * applies its own ignore rules rather than this file guessing at them.
 *
 * **What that gives up is checked separately.** Reading the commit means a
 * message written and not yet committed is not among the generated cases, and
 * the point of this file is to catch a wrong `npm run` before a person is told
 * to type it. `it('names only real scripts in the tree as it stands now')`
 * below closes that: one test, always one, that reads the tracked files as they
 * are on disk. Untracked files are still ignored — a scratch file is not the
 * product and must not fail the gate — so the count stays fixed for a commit
 * while an uncommitted edit to a real source file is still caught.
 */
function mentionedScripts(revision: string | null): Map<string, string[]> {
  const args = ['grep', '--no-color', '-I', '-o', '-E', 'npm run [a-z0-9:-]+'];
  if (revision !== null) args.push(revision);
  args.push('--', ...SCANNED, ':(exclude)*.test.ts', ':(exclude)*.test.tsx');

  let out: string;
  try {
    out = execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (error) {
    // git grep exits 1 with no output when nothing matched, which is not a
    // failure. Anything else — no git, not a repository — is, and is said
    // rather than quietly turning into an empty answer.
    const e = error as { status?: number; stdout?: string; stderr?: string };
    if (e.status !== 1) {
      throw new Error(
        `could not read ${revision ?? 'the working tree'} with git grep: ${e.stderr ?? String(error)}`,
      );
    }
    out = e.stdout ?? '';
  }

  const named = new Map<string, string[]>();
  const marker = ':npm run ';
  for (const line of out.split('\n')) {
    if (line === '') continue;
    /*
     * `<rev>:<path>:npm run <script>` with a revision, `<path>:npm run <script>`
     * without. Split at the last marker rather than on every colon: a script
     * name carries them — `panel:build`, `templates:audit` — and splitting on
     * all of them silently truncated the name to its last segment, which then
     * failed as a script that does not exist.
     */
    const at = line.lastIndexOf(marker);
    if (at === -1) continue;
    const script = line.slice(at + marker.length);
    const prefix = line.slice(0, at);
    const file = revision === null ? prefix : prefix.slice(revision.length + 1);
    if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue;
    named.set(script, [...(named.get(script) ?? []), file]);
  }
  return named;
}

const scripts = Object.keys(
  (JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }).scripts,
);

describe('every command named in a message exists', () => {
  const named = mentionedScripts('HEAD');

  it('found some to check', () => {
    expect(named.size).toBeGreaterThan(0);
  });

  it.each([...named.entries()])('npm run %s is a real script (%s)', (script) => {
    expect(scripts).toContain(script);
  });

  /*
   * One test, always one, so the count stays a property of the commit while a
   * message edited and not yet committed is still checked before anyone is told
   * to type it. Tracked files only: an untracked scratch file is not part of
   * what this project ships and must not fail the gate.
   */
  it('names only real scripts in the tree as it stands now', () => {
    const wrong = [...mentionedScripts(null).entries()]
      .filter(([script]) => !scripts.includes(script))
      .map(([script, where]) => `npm run ${script} (${where.join(', ')})`);
    expect(wrong).toEqual([]);
  });
});

describe('the node help is written once', () => {
  it('is not retyped in the panel', () => {
    const service = readFileSync(path.join(REPO_ROOT, 'panel', 'src', 'service.ts'), 'utf8');
    expect(service).toContain('NODE_NOT_FOUND_HELP');
    expect(service).not.toContain('No Node interpreter could be found');
  });
});

describe('the sidecar help names a script that is there', () => {
  it('tools/cv/setup.sh exists', () => {
    expect(existsSync(path.join(REPO_ROOT, 'tools', 'cv', 'setup.sh'))).toBe(true);
  });
});
