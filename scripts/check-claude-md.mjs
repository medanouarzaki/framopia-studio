#!/usr/bin/env node
/*
 * CLAUDE.md is read at the start of every session, so its size is a cost paid
 * every time. It reached 530,588 characters over 142 commits — 10,009 lines
 * added and 579 removed, because every session was told to update it and none
 * was told what did not belong in it. Past a certain size it is not read whole
 * at all, and nobody can say which part survived.
 *
 * CLAUDE_MD_MAX_CHARS is CHOSEN, NOT MEASURED. The tool warns at 150,000
 * characters; that figure comes from the warning itself and could not be
 * confirmed from the installed CLI, so it is recorded as the outer bound rather
 * than used as the limit. 20,000 is roughly twice what the file needs to say
 * what it says, and small enough that the warning can never fire again.
 *
 * FRAMOPIA_CLAUDE_MD re-points the check at a scratch copy, so a failure can be
 * watched without growing the real file — the same device
 * FRAMOPIA_REFERENCE_ROOT gives the reference-set gate.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLAUDE_MD_MAX_CHARS = 20_000;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env['FRAMOPIA_CLAUDE_MD'] ?? path.join(repoRoot, 'CLAUDE.md');

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (error) {
  console.error(`claude-md: cannot read ${file} — ${(error).message}`);
  process.exit(1);
}

const chars = [...text].length;
if (chars > CLAUDE_MD_MAX_CHARS) {
  console.error(
    `claude-md: ${file} is ${chars.toLocaleString('en-US')} characters, over the ` +
      `${CLAUDE_MD_MAX_CHARS.toLocaleString('en-US')} it is allowed.`,
  );
  console.error(
    'claude-md: it is orientation, not a record. Session history belongs in ' +
      'reports/, how the system works in docs/ARCHITECTURE.md, a ruling in ' +
      'docs/PROJECT_SPEC.md, a working rule in docs/CLAUDE_CODE_GUIDELINES.md, ' +
      'a command in docs/COMMANDS.md. See CLAUDE_CODE_GUIDELINES.md §5.',
  );
  process.exit(1);
}

console.log(
  `claude-md: ${chars.toLocaleString('en-US')} of ${CLAUDE_MD_MAX_CHARS.toLocaleString('en-US')} characters`,
);
