import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  REFERENCE_DOCUMENTATION,
  REFERENCE_FILES,
  parseAlignReference,
  type ReferenceFile,
} from '@framopia/core';

/**
 * Is every hand-made reference there, readable and parseable?
 *
 * Separate from `verify-references.ts`, which asks a different question: that
 * one scores a transcript's orthography against the guide and assumes the file
 * is present, reading it with an unguarded `readFileSync` inside a `.map`. So a
 * deleted transcript failed `npm run check` as an uncaught `ENOENT` with a
 * stack trace, and a deleted **alignment** reference failed nothing at all —
 * nothing in the gate read `benchmarks/references/align/*.json`. Block 10
 * session 12 found both while auditing whether one had already been lost.
 *
 * The two checks are kept apart because they fail for different reasons and a
 * reader needs to know which: absent is a lost file, non-conformant is a text
 * that needs correcting.
 */
export type ReferenceProblem = 'absent' | 'unreadable' | 'unparseable';

export interface ReferenceVerdict {
  readonly file: ReferenceFile;
  readonly problem: ReferenceProblem | null;
  /** Names the file and what was expected. Empty when the file is sound. */
  readonly issue: string;
}

function checkOne(file: ReferenceFile): ReferenceVerdict {
  const ok = { file, problem: null, issue: '' } as const;

  if (!existsSync(file.path)) {
    return {
      file,
      problem: 'absent',
      issue:
        `${file.path} is not there. It is a hand-made ${file.kind} reference and ` +
        `nothing regenerates it; ${file.readBy} reads it. Restore it from the backup ` +
        `(git holds the alignment references; the transcripts are gitignored).`,
    };
  }

  let source: string;
  try {
    source = readFileSync(file.path, 'utf8');
  } catch (error) {
    return {
      file,
      problem: 'unreadable',
      issue: `${file.path} could not be read: ${(error as Error).message}`,
    };
  }

  if (file.kind === 'transcript') {
    // A transcript is lines of words plus `#` comments. Empty means lost
    // content, which an existence check alone would call sound.
    const words = source
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join(' ')
      .trim();
    if (words === '') {
      return {
        file,
        problem: 'unparseable',
        issue: `${file.path} has a header but no transcript text`,
      };
    }
    return ok;
  }

  try {
    parseAlignReference(JSON.parse(source));
  } catch (error) {
    return {
      file,
      problem: 'unparseable',
      issue: `${file.path} does not parse as an alignment reference: ${(error as Error).message}`,
    };
  }
  return ok;
}

export function verifyReferenceSet(files: readonly ReferenceFile[] = REFERENCE_FILES): ReferenceVerdict[] {
  return files.map(checkOne);
}

/**
 * Files sitting in a reference directory that the declaration does not know.
 *
 * The declaration is what the gate protects, so a reference somebody added
 * without declaring it is a reference nobody is guarding — the same shape as
 * `REPO_ANCHORS` being pinned against the real directory listing. Documentation
 * is excluded by name rather than by extension: a `.md` is not automatically
 * safe to ignore.
 */
export function undeclaredReferenceFiles(
  files: readonly ReferenceFile[] = REFERENCE_FILES,
): string[] {
  const declared = new Set(files.map((f) => f.path));
  const dirs = new Set(files.map((f) => path.dirname(f.path)));
  const out: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (entry.name.startsWith('.')) continue;
      if (REFERENCE_DOCUMENTATION.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (declared.has(full)) continue;
      // The tagged `.json` forms are rebuilt by `npm run bench:tag`; only a
      // hand-made file is the gate's business.
      if (dir.endsWith(path.join('.local', 'ground-truth')) && !entry.name.endsWith('.txt')) continue;
      out.push(full);
    }
  }
  return out.sort();
}
