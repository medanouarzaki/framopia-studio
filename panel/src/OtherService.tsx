import { useState } from 'react';
import type { Connection } from './service.js';
import { stopOtherService } from './service.js';

/**
 * **Another background service is running beside the one this panel is using.**
 *
 * Block 12 session 78 found one that had been listening since 2026-09-03 — six
 * days, from a commit two days older than the route the panel was calling, with
 * the handshake naming a different process entirely. Nothing had stopped it and
 * nothing had noticed it. Session 79 made a second one impossible to start; this
 * is for the ones already standing, and for a machine where the guard could not
 * be taken.
 *
 * **It never stops anything by itself.** A process he started is his. It says
 * what is there and offers, and the offer is a button — no effect runs it.
 *
 * The wording names no command and asks him to leave nothing, which
 * `leave-the-panel.test.ts` reads this file to check.
 */
export function OtherService({
  other,
  connection,
  onStopped,
}: {
  other: { pid: number; startedAt: string } | null | undefined;
  connection: Connection | null;
  onStopped: () => void;
}): JSX.Element | null {
  const [stopping, setStopping] = useState(false);
  const [gone, setGone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (gone !== null) {
    return (
      <div className="otherservice done" role="status">
        <p className="said">
          The other background service has been stopped. This one is the only one running now.
        </p>
      </div>
    );
  }
  if (other === null || other === undefined) return null;

  return (
    <div className="otherservice" role="status">
      <p className="said">
        A second background service is running as well as this one. Yours is fine — but the other
        one may be older, and it can answer with settings this panel never sent it.
      </p>
      <p className="offer">
        Nothing has been stopped. It was started at some point and left running, and it is yours to
        keep or to end.
      </p>
      {error === null ? null : (
        <p className="say" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="ghost"
        disabled={stopping || connection === null}
        onClick={() => {
          if (connection === null) return;
          setStopping(true);
          setError(null);
          void stopOtherService(connection, other.pid)
            .then((stopped) => {
              setGone(stopped);
              onStopped();
            })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setStopping(false));
        }}
      >
        {stopping ? 'Stopping…' : 'Stop the other one'}
      </button>
    </div>
  );
}
