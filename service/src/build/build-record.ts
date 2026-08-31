import { existsSync, statSync } from 'node:fs';

import type { Build } from '../editplan/types.js';

/**
 * What a build writes onto the plan when it succeeds.
 *
 * `plan.build` has been defined since the Edit Plan's first version and nothing
 * has ever written it: every plan on disk reads `{ status: 'none' }` however
 * many times it has been built, so a reel that was built is indistinguishable
 * from one that never was, and `mergeIntoExistingPlan`'s stale branch — which
 * fires only on `status === 'built'` — has never been reachable.
 *
 * The record is written at the point the build knows the `.aep` is on disk, in
 * the CLI that does the building, never in a wrapper around it. `appendCost`
 * follows the same rule for the same reason: a wrapper cannot know whether the
 * thing it wraps really happened, so it fabricates.
 */
export interface BuildRecordInput {
  /** What After Effects reported saving, read back from it rather than echoed. */
  aepPath: string | null;
  builtAt: string;
}

export class BuildRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildRecordError';
  }
}

/**
 * The record for a build that succeeded, or a refusal.
 *
 * The file is checked on disk rather than trusted: a plan claiming a build that
 * produced no file is worse than a plan claiming nothing, because the claim is
 * what a later session would act on. An empty file counts as absent — After
 * Effects creating and not writing one is the failure this is guarding.
 */
export function buildRecordFor(input: BuildRecordInput): Build {
  if (input.aepPath === null || input.aepPath.length === 0) {
    throw new BuildRecordError(
      'the build reported no save path, so there is nothing to record. The plan is left saying nothing rather than claiming a build.',
    );
  }
  if (!existsSync(input.aepPath) || statSync(input.aepPath).size === 0) {
    throw new BuildRecordError(
      `the build reported saving ${input.aepPath} and there is no file there. The plan is left saying nothing rather than claiming a build.`,
    );
  }
  return { status: 'built', aepPath: input.aepPath, builtAt: input.builtAt };
}

/**
 * What a failed build leaves behind: whatever was already there.
 *
 * A build that refuses did not un-build the last one. Its `.aep` is still on
 * disk and the record still describes it truthfully, so overwriting with
 * `none` would erase a fact that is still true. `stale` is not this function's
 * to set either — that word means the plan has moved on from the comp, and
 * `mergeIntoExistingPlan` is the one thing that decides it.
 */
export function buildRecordAfterFailure(previous: Build): Build {
  return previous;
}
