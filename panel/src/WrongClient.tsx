import { useState, type JSX } from 'react';
import { attachClient, type Connection } from './service.js';
import type { ClientMismatch } from './types.js';

/**
 * **The tool notices, and offers. It never re-attaches by itself.**
 *
 * Mohamed's ruling of 2026-09-09, after session 75 found `sora-995f2d27` — Dr
 * Loubna Kfafi's footage — built in K2 Syndicalia's four colours. Its plan was
 * made four days before her client existed, so it pinned K2 and never let go.
 * He confirmed that reel was a test and was never sent. Nothing warned him.
 *
 * **It sits where the money is spent**, above the buttons that bill, rather than
 * after a composition exists — by then the wrong brand is already in it.
 *
 * **The build is never refused.** He may build a reel attached to whoever he
 * likes; the tool notices, it does not decide. Nothing here disables anything,
 * and `panel/src/wrong-client.test.ts` holds it to that.
 */
export function WrongClient({
  mismatch,
  planPath,
  connection,
  onAttached,
}: {
  mismatch: ClientMismatch | null | undefined;
  planPath: string | null;
  connection: Connection | null;
  onAttached: () => void;
}): JSX.Element | null {
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  if (mismatch === null || mismatch === undefined) return null;

  if (kept !== null) {
    return (
      <div className="wrongclient done" role="status">
        <p className="said">
          This video is now set up as {mismatch.looksLike.name}. The way it was set up
          before was kept, so nothing is lost.
        </p>
      </div>
    );
  }

  return (
    <div className="wrongclient" role="status">
      <p className="said">{mismatch.says}</p>
      <p className="offer">{mismatch.offer}</p>
      <button
        type="button"
        className="ghost"
        disabled={busy || planPath === null || connection === null}
        onClick={() => {
          void (async () => {
            if (planPath === null || connection === null) return;
            setBusy(true);
            setTrouble(null);
            try {
              const done = await attachClient(connection, planPath, mismatch.looksLike.id);
              setKept(done.keptPreviousAt ?? 'kept');
              onAttached();
            } catch (error) {
              setTrouble((error as Error).message);
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? 'Changing…' : `Use ${mismatch.looksLike.name} instead`}
      </button>
      {trouble === null ? null : (
        <p className="say" role="alert">
          {trouble}
        </p>
      )}
    </div>
  );
}
