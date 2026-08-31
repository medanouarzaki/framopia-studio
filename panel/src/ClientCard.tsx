import { useState } from 'react';
import { fileUrl } from './picture.js';
import { ClientPictures, type ShownPicture } from './ClientPictures.js';
import { fileDialogSupport } from './file-dialog.js';
import {
  addClientPicture,
  fetchModes,
  removeClientPicture,
  type Connection,
} from './service.js';
import type { ClientMode } from './types.js';

/**
 * What a client looks like, shown rather than described.
 *
 * The panel used to print the mode file's `note` here — "Stub. The palette is
 * locked (PROJECT_SPEC §5); vocabulary is deliberately empty…" — which is
 * developer prose on a motion designer's screen. That note is the maintainer's
 * and stays in the file; what he wrote about the client is one line, and the
 * rest of what he needs is visual: the colours as swatches, the fonts set in
 * their own face, the logo if there is one.
 *
 * It sits between two pickers on a one-screen panel, so it stays small: four
 * swatches on a row, two lines of type, one line of text.
 */
export function ClientCard({
  client,
  connection,
  onModes,
}: {
  client: ClientMode;
  connection: Connection | null;
  /** The client's file changed, so every screen reading it is re-read. */
  onModes: (modes: ClientMode[]) => void;
}): JSX.Element | null {
  const look = client.look;
  if (look === undefined) return null;
  return (
    <div className="clientcard">
      {client.about == null ? null : <p className="about">{client.about}</p>}

      <ul className="swatches">
        {look.palette.map((colour) => (
          <li key={colour.role}>
            <span className="chip" style={{ background: colour.hex }} aria-hidden="true" />
            <span className="what">{colour.what}</span>
          </li>
        ))}
      </ul>

      {/* Set in the face it names, so he can see it rather than read about it. */}
      <div className="typesample">
        <p style={{ fontFamily: `"${look.fonts.latin}", sans-serif` }}>{look.fonts.latin}</p>
        <p dir="rtl" style={{ fontFamily: `"${look.fonts.arabic}", sans-serif` }}>
          {look.fonts.arabic}
        </p>
        {look.fonts.standard ? (
          <p className="hint">
            They have no fonts of their own, so the standard pair is used.
          </p>
        ) : null}
      </div>

      {look.logoPath === null ? null : (
        <img className="clientlogo" src={fileUrl(look.logoPath)} alt="" />
      )}

      {client.standards === undefined ? null : <Standards standards={client.standards} />}

      {/*
        Absent means a service older than this panel, which is not the same as a
        client with no photographs — offering an editor for a route that is not
        there would report a failure the moment he pressed it.
      */}
      {client.pictures === undefined ? null : (
        <Photographs client={client} connection={connection} onModes={onModes} />
      )}
    </div>
  );
}

function Photographs({
  client,
  connection,
  onModes,
}: {
  client: ClientMode;
  connection: Connection | null;
  onModes: (modes: ClientMode[]) => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = fileDialogSupport();

  const change = async (make: (c: Connection) => Promise<void>): Promise<void> => {
    if (connection === null) return;
    setBusy(true);
    setError(null);
    try {
      await make(connection);
      onModes(await fetchModes(connection));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClientPictures
      pictures={(client.pictures ?? []).map(
        (picture): ShownPicture => ({
          key: picture.id,
          path: picture.path,
          description: picture.description,
        }),
      )}
      dialog={dialog.available}
      busy={busy}
      error={error}
      onAdd={(photo) =>
        void change((c) => addClientPicture(c, { client: client.id, ...photo }))
      }
      onRemove={(key) =>
        void change((c) => removeClientPicture(c, { client: client.id, picture: key }))
      }
    />
  );
}

const SPOKEN: Record<string, string> = {
  darija: 'Darija',
  french: 'French',
  english: 'English',
  mixed: 'a mix of languages',
};

const SHAPE: Record<string, string> = {
  vertical: 'upright',
  square: 'square',
  landscape: 'wide',
};

/**
 * The handful of values a build uses, with the ones he chose marked as his.
 *
 * A blank that quietly decides something is worse than a question, so a client
 * who set none of these is told what he is getting rather than shown nothing.
 */
function Standards({
  standards,
}: {
  standards: NonNullable<ClientMode['standards']>;
}): JSX.Element {
  const his = new Set(standards.chosen);
  const line = [
    `Mostly ${SPOKEN[standards.language] ?? standards.language}`,
    `${SHAPE[standards.videoShape] ?? standards.videoShape} video`,
    standards.watermark ? 'your watermark on' : 'no watermark',
  ].join(' · ');
  return (
    <p className="hint">
      {line}
      {his.size === 0 ? ' — all standard, nothing set for this client' : ''}
    </p>
  );
}
