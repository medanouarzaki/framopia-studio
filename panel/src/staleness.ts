/**
 * Whether the companion service is running older code than this panel.
 *
 * The two are deployed separately — the bundle is reloaded by closing and
 * reopening the panel, the service is a long-running process — so a rebuilt
 * panel talking to an old service is the normal way to break things here. It
 * has confused what is on screen in four separate sessions: a field the new
 * panel reads and the old service does not send reads as a fact about the
 * user's work rather than as a version gap.
 *
 * Nothing else can see it. Both `serviceVersion` and `appVersion` come **from
 * the service**, so they agree with each other by construction and say nothing
 * about the bundle. The one thing the two sides do not share is *when* each
 * came into being: the bundle knows when it was built, and the service reports
 * when it started.
 */
declare const __PANEL_BUILT_AT__: string | undefined;

/** Injected at build time. Absent in tests and in a watch build. */
export function panelBuiltAt(): string | null {
  try {
    return typeof __PANEL_BUILT_AT__ === 'string' ? __PANEL_BUILT_AT__ : null;
  } catch {
    return null;
  }
}

export interface Staleness {
  stale: boolean;
  /** What to say, when there is something to say. */
  detail: string | null;
}

/**
 * A service older than the bundle, in wall-clock terms.
 *
 * It answers "is this service running the code that was on disk when the panel
 * was built" and nothing more — it cannot tell a service that is *behind* from
 * one that is *broken*, and it says nothing when either timestamp is missing.
 * A minute of slack, because building the service and starting it are two
 * commands and the second follows the first.
 */
const SLACK_MS = 60_000;

export function stalenessOf(
  builtAt: string | null,
  serviceStartedAt: string | undefined,
): Staleness {
  if (builtAt === null || serviceStartedAt === undefined) {
    return { stale: false, detail: null };
  }
  const built = Date.parse(builtAt);
  const started = Date.parse(serviceStartedAt);
  if (Number.isNaN(built) || Number.isNaN(started)) return { stale: false, detail: null };
  if (built <= started + SLACK_MS) return { stale: false, detail: null };
  return {
    stale: true,
    detail:
      'This panel was rebuilt after the companion service started, so the service is running ' +
      'older code. Quit After Effects and open it again, or run npm run service:build and ' +
      'reopen the panel.',
  };
}
