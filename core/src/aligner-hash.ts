import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * A fingerprint of the code that produces a pairing, so a reference judges the
 * aligner rather than the repo.
 *
 * A reference used to carry only `headSha`, which changes on every commit to
 * anything — a report, a stylesheet, this comment. `align:score` then refused
 * to score a reference the aligner had never stopped agreeing with, and the
 * only way through was `--allow-sha-drift`, which disables the check entirely
 * and so answers a narrow question with a blunt instrument.
 *
 * **The set is deliberately small**: the aligner, the normaliser it compares
 * through, and the module that turns its output into rows. Nothing else can
 * change which draft token a corrected word is paired with.
 */
export const ALIGNER_SOURCE_FILES = [
  'core/src/align.ts',
  'core/src/normalize.ts',
  'core/src/align-review.ts',
] as const;

/**
 * Known limitation, stated rather than engineered around: `align-review.ts`
 * also holds the reference schema and re-exports the sheet renderer, so an
 * edit to either bumps this hash without any pairing changing. That is a false
 * positive on a file, against `headSha`'s false positive on the whole
 * repository. Splitting the pairing projection into its own module would fix
 * it and is not worth the churn until it bites.
 */
export function alignerHash(repoRoot = REPO_ROOT): string {
  const hash = createHash('sha256');
  for (const file of ALIGNER_SOURCE_FILES) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(path.join(repoRoot, file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}
