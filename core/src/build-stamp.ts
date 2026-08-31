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
 * The command a person used to be told to type, kept only so the repair can run
 * the same thing without them.
 *
 * `npm run service` **exits 1** when a service is already running — the lock is
 * live and `service.ts` refuses rather than taking it over — so this always
 * needed `--force`. The panel no longer prints it: it stops the old service and
 * starts a new one itself, which is what `--force` was standing in for.
 */
export const REBUILD_COMMAND = 'npm run service -- --force';

/**
 * What it takes to make a disagreeing panel and service agree.
 *
 * The panel's stamp is baked into its bundle; the service's is read **once, at
 * startup**, out of `service/dist/build-stamp.json`. So there are two different
 * disagreements wearing the same banner, and only one of them a restart can fix:
 *
 * - `restart` — the compiled service on disk already matches this panel, and the
 *   process running is simply older than it. Starting it again is enough.
 * - `rebuild` — the compiled service on disk does not match either, so restarting
 *   would read the same stale file and report the same mismatch. It has to be
 *   compiled first. This is the ordinary case after `npm run check`, which
 *   rebuilds the panel bundle and never touches `service/dist`.
 * - `unknown` — one of the three stamps is missing, so nothing can be concluded.
 *   Never repaired on a guess.
 */
export type ServiceRepair = 'restart' | 'rebuild' | 'unknown';

export function repairFor(
  panelStamp: string | null,
  distStamp: string | null | undefined,
): ServiceRepair {
  if (
    panelStamp === null ||
    panelStamp.length === 0 ||
    distStamp === null ||
    distStamp === undefined ||
    distStamp.length === 0
  ) {
    return 'unknown';
  }
  return sourceHalf(panelStamp) === sourceHalf(distStamp) ? 'restart' : 'rebuild';
}

/**
 * The half that decides: the content hash, not the commit.
 *
 * A stamp is `<commit>+<content hash>`, and **the commit moves when nothing
 * about the code does**. Committing a report is enough to make an artifact
 * built a minute earlier compare unequal to one built a minute later from
 * identical source — which is a false alarm of exactly the kind this whole
 * check replaced. The commit is for a human to read; the hash is the claim.
 */
function sourceHalf(stamp: string): string {
  const at = stamp.lastIndexOf('+');
  return at === -1 ? stamp : stamp.slice(at + 1);
}

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
  if (sourceHalf(panelStamp) === sourceHalf(serviceStamp)) return { verdict: 'match', detail: null };
  return {
    verdict: 'different',
    detail:
      'The background service was built from different code than this panel, so the two ' +
      'may not agree about what a video contains. Restarting it now.',
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
  if (compared.verdict === 'match') {
    return panelStamp === serviceStamp
      ? `same build as this panel (${panelStamp ?? 'unknown'})`
      : `same code as this panel (panel ${panelStamp ?? 'unknown'}, service ${
          serviceStamp ?? 'unknown'
        } — the same source at different commits)`;
  }
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
