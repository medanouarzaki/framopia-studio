/*
 * A client's own photograph must never be committed.
 *
 * Mohamed ruled on 2026-09-05 that attaching a photograph copies it into the
 * project, so a client's picture keeps working when the drive it came from is
 * unplugged. The consequence is that a real person's face sits inside a working
 * copy of a repository that has a remote, and until Block 12 session 82 nothing
 * kept it out of a commit: fourteen of Dr Loubna Kfafi's were sitting untracked
 * in a directory nobody had ignored, and `git add -A` would have staged all
 * fourteen and pushed 25.5 MB of them to GitHub.
 *
 * `.gitignore` now covers the store, and that is the part that stops the
 * accident. **This is the part that stops the ignore being wrong.** An ignore
 * file can be edited, `git add -f` overrides it outright, and a file that is
 * already tracked ignores the ignore completely — so the gate asks git what is
 * actually staged rather than trusting that arrangement to hold.
 *
 * It reports; it never unstages anything and it never deletes a photograph.
 * They are the client's, and what to do about one that has been staged is a
 * decision, not a cleanup.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = 'assets/client-pictures/';

let staged = [];
try {
  /*
   * The index against HEAD, which is what a commit would actually carry —
   * `git status` would also show a merely-untracked file and answer a different
   * question. `-z` because a photograph's name is the client's, and a client's
   * name may hold anything.
   */
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], {
    cwd: root,
    encoding: 'utf8',
  });
  staged = out.split('\0').filter((line) => line !== '');
} catch (error) {
  console.error(
    `check: FAIL — could not ask git what is staged: ${error.message}\n` +
      `Without an answer this cannot tell whether a client's photograph is\n` +
      `about to be committed, and it does not pretend to.`,
  );
  process.exit(1);
}

const photographs = staged.filter((file) => file.startsWith(STORE));

if (photographs.length > 0) {
  console.error(
    `check: FAIL — ${photographs.length} of a client's photograph(s) are staged.\n` +
      `They are copied into the project so a client's picture survives the drive\n` +
      `it came from, not so they can be published. Committing one puts a real\n` +
      `person's face in a repository with a remote, and pushing it cannot be\n` +
      `undone by deleting it later.\n` +
      `Nothing here is unstaged or deleted for you: they are the client's.\n\n` +
      photographs.map((f) => `  ${f}`).join('\n'),
  );
  process.exit(1);
}

console.log("check: no client's photograph is staged");
