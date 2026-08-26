import { existsSync } from 'node:fs';

/**
 * Every file a build is about to reference, checked before anything is built.
 *
 * Block 7 session 4's first full build **silently skipped 4 of 5 image slots**
 * because session 1's cache re-key had left the plan's candidate paths pointing
 * at directories that no longer existed. Nothing warned; it was found by
 * noticing the images were missing from the comp. That is the second time a
 * cheap fix broke something downstream without saying so, and a comp with gaps
 * is worse than no comp — the gaps look like a design decision.
 *
 * Every missing path is collected and reported together rather than failing on
 * the first: one run should tell you everything that is wrong.
 */
export interface PathRef {
  elementId: string;
  kind: string;
  path: string;
}

export class MissingBuildInputsError extends Error {
  constructor(readonly missing: PathRef[]) {
    super(
      `${missing.length} file(s) the plan references are not on disk; refusing to build a comp ` +
        `with gaps:\n${missing.map((m) => `  ${m.kind} ${m.elementId}: ${m.path}`).join('\n')}`,
    );
    this.name = 'MissingBuildInputsError';
  }
}

export function findMissingPaths(refs: PathRef[]): PathRef[] {
  return refs.filter((r) => !existsSync(r.path));
}

export function assertPathsPresent(refs: PathRef[]): void {
  const missing = findMissingPaths(refs);
  if (missing.length > 0) throw new MissingBuildInputsError(missing);
}
