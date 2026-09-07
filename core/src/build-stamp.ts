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

/**
 * **Which of the two is behind**, which is not what `compareBuildStamps` answers.
 *
 * That one says only *they disagree*, and everything downstream then assumed the
 * service was the stale half, because for a long time it always was: the panel
 * was rebuilt by `npm run check` and the service was not. **After a `git pull`
 * it is the other way round.** The service gets compiled, the panel bundle does
 * not, and the panel then tells the user the service was built from different
 * code and restarts it — which cannot change the panel's own stamp, so the
 * banner comes back and the repair runs again. Block 11 session 65 hit this and
 * lost a run to it; session 66 measured the loop.
 *
 * **The third stamp settles it, and it was already being read.** `distStamp` is
 * the compiled service on disk. If the running service matches what is compiled,
 * then the service is running the newest code there is and the panel is the odd
 * one out. No new field, no schema change: `repairService` already reads all
 * three.
 */
export type BehindSide = 'panel' | 'service' | 'unknown';

export function whichIsBehind(
  panelStamp: string | null,
  serviceStamp: string | null | undefined,
  distStamp: string | null | undefined,
): BehindSide {
  const known = (v: string | null | undefined): v is string =>
    typeof v === 'string' && v.length > 0;
  if (!known(panelStamp) || !known(serviceStamp)) return 'unknown';
  if (sourceHalf(panelStamp) === sourceHalf(serviceStamp)) return 'unknown';
  if (!known(distStamp)) return 'service';
  // The service is running exactly what is compiled, so nothing about the
  // service is out of date and the panel is what is behind.
  return sourceHalf(serviceStamp) === sourceHalf(distStamp) ? 'panel' : 'service';
}

/**
 * What the panel says when it is the stale half.
 *
 * **It names a command, and that is a ruling rather than an oversight.** No
 * message in this panel sends the user out of it — session 26 made the panel
 * start, prepare and restart the service by itself so that none would need to,
 * and `panel/src/leave-the-panel.test.ts` holds every message to it.
 *
 * **This one case cannot be repaired from inside.** The stale artefact is the
 * running code: the bundle has to be built on disk and then loaded, and the
 * thing that would do the loading is the bundle. Session 66 shipped a sentence
 * that said something was wrong and stopped there, because every complete
 * sentence broke the rule — which is the failure the rule exists to prevent,
 * reached from the other side. **Mohamed ruled on 2026-09-07** that this message,
 * and no other, may name the one command that fixes it.
 *
 * The exemption is an allow-list of this exact string in
 * `leave-the-panel.test.ts`, imported rather than retyped, so a second message
 * that names a command still fails and so does a drifted copy of this one.
 *
 * **The route that would end the exemption, and what it would take.**
 * The service is an ordinary Node process with the repository in front of it,
 * so it could run the panel's own build itself — the panel already asks it to
 * rebuild the *service* through `host.rebuildService`, and this would sit beside
 * that as the same shape of request. The bundle on disk would then be current,
 * and the last step is the one nobody has measured: whether a CEP panel can
 * reload itself into the new bundle, by `location.reload()` or otherwise, and
 * come back with its host connection intact. If it can, no one is sent anywhere
 * and this constant goes back to naming nothing.
 *
 * What would have to be proved, in order: that the service can run the panel
 * build without disturbing the panel that asked for it; that a reload picks up
 * the new bundle rather than a cached one, CEP having its own cache; and that
 * the reloaded panel still has `cep_node` and its handshake, since a panel that
 * reloads into a broken state is worse than a sentence. What could go wrong is
 * that the reload happens while the bundle is half-written, or that CEP serves
 * the old file, or that reloading drops the extension entirely and the only way
 * back is restarting After Effects — the very thing this whole rule is about.
 *
 * **None of it can be measured without driving After Effects**, so it waits for
 * the partner's first real run rather than being guessed at here.
 */
export const PANEL_IS_BEHIND =
  'This panel is showing older code than the rest of the tool, so what you see here may ' +
  'not match what it does. Nothing you have made is affected. To put it right, run ' +
  '`npm run panel:build` in a terminal, then close this panel and open it again from ' +
  'Window → Extensions.';
