import { useState } from 'react';
import { fileUrl } from './picture.js';
import { ClientPictures, type ShownPicture } from './ClientPictures.js';
import { ColourField } from './ColourField.js';
import { fileDialogSupport } from './file-dialog.js';
import {
  addClientPicture,
  fetchModes,
  removeClientPicture,
  setClientPalette,
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

      <Palette client={client} connection={connection} onModes={onModes} />

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
  /*
   * **Only what decides a build is stated as a fact.** The watermark and the
   * subtitle baseline reach the comp; the language and the shape are recorded
   * about the client and read by nothing that builds a reel, so they are
   * described as noted rather than applied. Block 10 session 43 found all four
   * reported alike, and a client card saying "no watermark" over a reel
   * carrying one is the reason the distinction is drawn here.
   */
  const applied = [
    standards.watermark ? 'your watermark on' : 'no watermark',
    ...(his.has('subtitleBaselineY')
      ? [`subtitles at ${Math.round(standards.subtitleBaselineY)}px`]
      : []),
  ].join(' · ');
  const noted = `Mostly ${SPOKEN[standards.language] ?? standards.language}, ` +
    `${SHAPE[standards.videoShape] ?? standards.videoShape} video`;
  return (
    <>
      <p className="hint">
        {applied}
        {his.size === 0 ? ' — all standard, nothing set for this client' : ''}
      </p>
      <p className="hint">{noted} — noted, neither changes what is built.</p>
    </>
  );
}


/**
 * The client's four colours, and the only way to change them.
 *
 * They could be chosen when the client was created and never afterwards, so a
 * client saved with the wrong colours stayed wrong — Block 10 session 40 found
 * the missing route and 45 added it. The swatches are still the resting state;
 * editing is a thing you ask for.
 */
function Palette({
  client,
  connection,
  onModes,
}: {
  client: ClientMode;
  connection: Connection | null;
  onModes: (modes: ClientMode[]) => void;
}): JSX.Element | null {
  const look = client.look;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (look === undefined) return null;

  const start = (): void => {
    setDraft(Object.fromEntries(look.palette.map((c) => [c.role, c.hex])));
    setError(null);
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    if (connection === null) return;
    setSaving(true);
    setError(null);
    try {
      onModes(await setClientPalette(connection, { client: client.id, palette: draft }));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="palette">
      <ul className="swatches">
        {look.palette.map((colour) => (
          <li key={colour.role}>
            {editing ? (
              /*
                The same field as the New Client screen, for the same reason:
                the swatch alone could only be dragged, and a brand colour is a
                code. Here every role already has a value, so emptying the box
                puts back the one it had rather than unsetting it — a client's
                palette is all four or nothing.
              */
              <ColourField
                what={colour.what}
                unset={colour.hex}
                value={draft[colour.role] ?? colour.hex}
                onChange={(hex) =>
                  setDraft((d) => ({ ...d, [colour.role]: hex ?? colour.hex }))
                }
              />
            ) : (
              <>
                <span className="chip" style={{ background: colour.hex }} aria-hidden="true" />
                <span className="what">{colour.what}</span>
              </>
            )}
          </li>
        ))}
      </ul>

      {connection === null ? null : editing ? (
        <div className="paletteedit">
          {/*
            What an edit does and does not touch. A reel pins the client's look
            when it is analysed and rebuilds from that pin, so the videos already
            made keep the look they were made with — this says so before he
            presses, rather than leaving him to find out.
          */}
          <p className="hint">
            New colours apply to videos you make from now on. Videos already made keep the
            look they were made with, until you move them forward yourself.
          </p>
          {error === null ? null : <p className="trouble">{error}</p>}
          <button type="button" className="ghost" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save their colours'}
          </button>
          <button type="button" className="ghost" disabled={saving} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="ghost" onClick={start}>
          Change their colours
        </button>
      )}
    </div>
  );
}
