/**
 * Whether the panel and the companion service were built from the same code.
 *
 * **Staleness is a fact about code, never about clocks.** The panel used to
 * stamp itself with the time it was built and compare that against the moment
 * the service process started, which answers a different question and gets the
 * common case wrong: a service started before the bundle was built is accused
 * of running older code even when it is running exactly the same code, and a
 * service that really is behind but happened to restart afterwards is passed.
 * `handoffs/block-8.md` §9 recorded both limits; this replaces the check rather
 * than widening it.
 *
 * Both artifacts are stamped by `scripts/build-stamp.mjs` with one identifier —
 * a commit sha for a human plus a content hash of every source file that is
 * built. Equal stamps mean the same code, whoever started first and whenever.
 *
 * **Behind, unknown and down are three different states.** A service that
 * cannot report a stamp is a service this panel cannot tell about, which is not
 * the same accusation as one built from different code; and a service that does
 * not answer at all is neither, and is reported elsewhere. One message for all
 * three is how the wrong remedy gets printed.
 *
 * This rule lives in `core` because both sides read it: the panel to decide
 * what to show, the service to declare the field's shape.
 */
export type BuildStampVerdict = 'match' | 'different' | 'unknown';

export interface BuildStampComparison {
  verdict: BuildStampVerdict;
  /** What the panel shows. Null when there is nothing worth saying. */
  detail: string | null;
}

/**
 * The remedy, and it is the one that works.
 *
 * `npm run service` **exits 1** when a service is already running — the lock is
 * live and `service.ts` refuses rather than taking it over — so telling someone
 * to run it while their service is up sends them into an error. `--force` takes
 * the port and the lock from the running one, which is the situation this
 * message is always printed in.
 */
export const REBUILD_COMMAND = 'npm run service -- --force';

export function compareBuildStamps(
  panelStamp: string | null,
  serviceStamp: string | null | undefined,
): BuildStampComparison {
  if (
    panelStamp === null ||
    panelStamp.length === 0 ||
    serviceStamp === null ||
    serviceStamp === undefined ||
    serviceStamp.length === 0
  ) {
    return {
      verdict: 'unknown',
      detail: null,
    };
  }
  if (panelStamp === serviceStamp) return { verdict: 'match', detail: null };
  return {
    verdict: 'different',
    detail:
      'The background service was built from different code than this panel, so the two ' +
      `may not agree about what a video contains. Run ${REBUILD_COMMAND} in a terminal, ` +
      'then close this panel and open it again.',
  };
}

/**
 * The same comparison, said out loud even when it agrees.
 *
 * The main screen shows nothing when the two match — a line that is always
 * there is a line nobody reads — but the details pane names it either way, so
 * "I cannot tell" is visible as its own answer rather than as silence.
 */
export function describeBuildStamps(
  panelStamp: string | null,
  serviceStamp: string | null | undefined,
): string {
  const compared = compareBuildStamps(panelStamp, serviceStamp);
  if (compared.verdict === 'match') return `same build as this panel (${panelStamp})`;
  if (compared.verdict === 'different') {
    return `built from different code: panel ${panelStamp ?? 'unknown'}, service ${
      serviceStamp ?? 'unknown'
    }`;
  }
  if (panelStamp === null || panelStamp.length === 0) {
    return 'this panel does not say which build it is, so the two cannot be compared';
  }
  return 'this service does not say which build it is, so the two cannot be compared';
}
