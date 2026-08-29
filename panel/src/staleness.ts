/*
 * The subpath, never the barrel. The panel is bundled for CEP's Chromium and
 * `@framopia/core`'s index reaches `node:fs` through the config loader, which
 * esbuild cannot resolve for a browser target. `build-stamp.ts` imports
 * nothing, so its own graph is clean — the same reason `align-review` has a
 * subpath of its own.
 */
import {
  compareBuildStamps,
  describeBuildStamps,
  type BuildStampComparison,
} from '@framopia/core/build-stamp';

/**
 * Whether the companion service was built from the same code as this panel.
 *
 * The two are deployed separately — the bundle is reloaded by closing and
 * reopening the panel, the service is a long-running process — so a rebuilt
 * panel talking to a service built from other code is the normal way to break
 * things here. A field the new panel reads and the old service does not send
 * reads as a fact about the user's work rather than as a version gap.
 *
 * **This used to compare clocks and it was wrong.** The bundle stamped the time
 * it was built and the service reported when its process started; a service
 * started before the bundle was built was accused of running older code even
 * when it was running exactly the same code, and the user could not clear the
 * banner by any means because nothing about the code was being measured. Both
 * limits were recorded in `handoffs/block-8.md` §9 before they cost a session.
 *
 * Both sides now carry one build stamp, and the rule that compares them lives
 * in `@framopia/core` so the panel and the service read the same one.
 */
declare const __PANEL_BUILD_STAMP__: string | undefined;

/** Injected at build time by `panel/scripts/build.mjs`. Absent in tests. */
export function panelBuildStamp(): string | null {
  try {
    return typeof __PANEL_BUILD_STAMP__ === 'string' ? __PANEL_BUILD_STAMP__ : null;
  } catch {
    return null;
  }
}

export type Staleness = BuildStampComparison;

/**
 * Behind, unknown and down are three different states.
 *
 * This answers only the first two: a service that does not answer at all is not
 * this function's business and is reported by the connection itself. `detail`
 * is null unless there is something to act on, so the main screen stays quiet
 * when the two agree **and** when they cannot be compared — the details pane
 * carries the difference between those two, through `describeBuildStamps`.
 */
export function stalenessOf(
  panelStamp: string | null,
  serviceStamp: string | null | undefined,
): Staleness {
  return compareBuildStamps(panelStamp, serviceStamp);
}

export { describeBuildStamps };
