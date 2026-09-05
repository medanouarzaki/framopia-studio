import { useState } from 'react';
import { fileUrl } from './picture.js';
import { ClientPictures, type ShownPicture } from './ClientPictures.js';
import { ColourField } from './ColourField.js';
import { fileDialogSupport, pickFolder, pickImageFile } from './file-dialog.js';
import {
  addClientPicture,
  fetchModes,
  removeClientPicture,
  setClientPictureLabel,
  deleteClient,
  setClientDetails,
  setClientPalette,
  type ClientDetailsEdit,
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

      {/*
        Absent means a service older than this panel, which cannot be edited
        through — the same reason the photographs hide themselves one field up.
      */}
      {client.editable === undefined || connection === null ? null : (
        <Details client={client} connection={connection} onModes={onModes} />
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
          ...(picture.label === undefined ? {} : { label: picture.label }),
          ...(picture.onThisMachine === undefined ? {} : { onThisMachine: picture.onThisMachine }),
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
      onLabel={(key, label) =>
        void change(async (c) => {
          await setClientPictureLabel(c, { client: client.id, picture: key, label });
        })
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

/**
 * Everything about a client except their colours and their photographs, and the
 * only way to change any of it.
 *
 * **Until Block 10 session 54 only the palette could be corrected.** A name
 * typed wrong, a folder that moved, a face chosen before this client had one —
 * all of it was fixed for the life of the client, and the only way out was to
 * make a second client and abandon the first.
 *
 * It opens closed, like the palette editor beside it: the card is a thing to
 * read, and editing is a thing you ask for. **Only what changed is sent**, so
 * pressing save after touching one field leaves the other eight exactly as they
 * are — including the ones the client never named, which is what keeps a blank
 * meaning *standard* rather than becoming a choice nobody made.
 */
function Details({
  client,
  connection,
  onModes,
}: {
  client: ClientMode;
  connection: Connection;
  onModes: (modes: ClientMode[]) => void;
}): JSX.Element | null {
  const stored = client.editable;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ClientDetailsEdit>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [gone, setGone] = useState<string | null>(null);
  const dialog = fileDialogSupport();
  if (stored === undefined) return null;

  const set = (change: ClientDetailsEdit): void => setDraft((d) => ({ ...d, ...change }));
  const text = (key: 'name' | 'about' | 'videoFolder' | 'logoPath'): string => {
    const drafted = draft[key];
    if (drafted !== undefined) return drafted ?? '';
    return stored[key] ?? '';
  };
  const choice = (key: 'language' | 'videoShape'): string => {
    const drafted = draft[key];
    if (drafted !== undefined) return drafted ?? '';
    return stored[key] ?? '';
  };
  const fonts = draft.fonts === undefined ? stored.fonts : (draft.fonts ?? undefined);
  const face = (role: 'latin' | 'emphasis' | 'arabic'): string => fonts?.[role] ?? '';
  const setFace = (role: 'latin' | 'emphasis' | 'arabic', value: string): void => {
    const next = {
      latin: face('latin'),
      arabic: face('arabic'),
      ...(face('emphasis') === '' ? {} : { emphasis: face('emphasis') }),
      [role]: value,
    } as { latin: string; arabic: string; emphasis?: string };
    if (next.emphasis === '') delete next.emphasis;
    set({ fonts: next.latin === '' && next.arabic === '' ? null : next });
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      onModes(await setClientDetails(connection, { client: client.id, details: draft }));
      setDraft({});
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const answer = await deleteClient(connection, client.id);
      setGone(answer.movedTo);
      onModes(answer.modes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (gone !== null) {
    return (
      <p className="hint" role="status">
        {client.name} is off the list. Nothing was thrown away — their details were kept.
      </p>
    );
  }

  if (!editing) {
    return (
      <button type="button" className="ghost" onClick={() => { setDraft({}); setEditing(true); }}>
        Change their details
      </button>
    );
  }

  return (
    <div className="clientdetails">
      <label className="field stacked">
        <span>Their name</span>
        <input
          type="text"
          aria-label="Their name"
          value={text('name')}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      <label className="field stacked">
        <span>About them</span>
        <input
          type="text"
          aria-label="About them"
          value={text('about')}
          onChange={(e) => set({ about: e.target.value })}
        />
      </label>

      {/*
        No path is ever typed or pasted — the rule for the whole product since
        session 16 — so both of these are the native chooser and nothing else.
      */}
      <PathRow
        what="Their video folder"
        value={text('videoFolder')}
        dialog={dialog.available}
        onChoose={() => {
          const chosen = pickFolder('Choose their video folder', text('videoFolder'));
          if (chosen !== null) set({ videoFolder: chosen });
        }}
        onClear={() => set({ videoFolder: null })}
      />
      <PathRow
        what="Their logo"
        value={text('logoPath')}
        dialog={dialog.available}
        onChoose={() => {
          const chosen = pickImageFile('Choose their logo', text('logoPath'));
          if (chosen !== null) set({ logoPath: chosen });
        }}
        onClear={() => set({ logoPath: null })}
      />

      <label className="field">
        <span>Mostly spoken in</span>
        <select
          aria-label="Mostly spoken in"
          value={choice('language')}
          onChange={(e) => set({ language: e.target.value === '' ? null : e.target.value })}
        >
          <option value="">Not said</option>
          {Object.entries(SPOKEN).map(([id, said]) => (
            <option key={id} value={id}>{said}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Video shape</span>
        <select
          aria-label="Video shape"
          value={choice('videoShape')}
          onChange={(e) => set({ videoShape: e.target.value === '' ? null : e.target.value })}
        >
          <option value="">Not said</option>
          {Object.entries(SHAPE).map(([id, shape]) => (
            <option key={id} value={id}>{shape}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Their watermark</span>
        <select
          aria-label="Their watermark"
          value={
            draft.watermarkByDefault === undefined
              ? stored.watermarkByDefault === undefined
                ? ''
                : String(stored.watermarkByDefault)
              : draft.watermarkByDefault === null
                ? ''
                : String(draft.watermarkByDefault)
          }
          onChange={(e) =>
            set({ watermarkByDefault: e.target.value === '' ? null : e.target.value === 'true' })
          }
        >
          <option value="">Standard — their videos carry it</option>
          <option value="true">On</option>
          <option value="false">Off</option>
        </select>
      </label>

      <label className="field">
        <span>Subtitles from the top</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Subtitles from the top"
          value={
            draft.subtitleBaselineY === undefined
              ? (stored.subtitleBaselineY ?? '')
              : (draft.subtitleBaselineY ?? '')
          }
          onChange={(e) =>
            set({
              subtitleBaselineY: e.target.value.trim() === '' ? null : Number(e.target.value),
            })
          }
        />
      </label>

      {/*
        Three faces, the user's ruling: a Latin sans, a Latin serif for the
        words you emphasise, and an Arabic. Dr Loubna Kfafi's are borrowed from
        K2 and pending her own, which is exactly what this is for.
      */}
      <FaceRow what="Latin font" value={face('latin')} onChange={(v) => setFace('latin', v)} />
      <FaceRow
        what="Emphasis font"
        value={face('emphasis')}
        onChange={(v) => setFace('emphasis', v)}
      />
      <FaceRow what="Arabic font" value={face('arabic')} onChange={(v) => setFace('arabic', v)} />

      <p className="hint">
        A new name or new fonts apply to videos you make from now on. Videos already made keep
        the look they were made with, until you move them forward yourself.
      </p>

      {error === null ? null : <p className="trouble">{error}</p>}

      <button type="button" className="ghost" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save their details'}
      </button>
      <button
        type="button"
        className="ghost"
        disabled={saving}
        onClick={() => { setDraft({}); setEditing(false); }}
      >
        Cancel
      </button>

      {confirming ? (
        <div className="confirmremove">
          {/*
            What removal does, in full, before he presses it. A reel pins the
            client's look when it is analysed and rebuilds from that pin, so the
            videos already made are safe; what does break is a video using one of
            this client's own photographs, because the photo is named by an id on
            this client and there would be nothing to look it up in.
          */}
          <p className="hint">
            Take {client.name} off the list? Videos already made keep the look they were made
            with and can still be rebuilt. A video that uses one of their photographs would no
            longer find it. Their details are kept, not thrown away.
          </p>
          <button type="button" className="ghost" disabled={saving} onClick={() => void remove()}>
            {saving ? 'Removing…' : `Yes, take ${client.name} off the list`}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={saving}
            onClick={() => setConfirming(false)}
          >
            Keep them
          </button>
        </div>
      ) : (
        <button type="button" className="ghost" onClick={() => setConfirming(true)}>
          Take them off the list
        </button>
      )}
    </div>
  );
}

/** A path, chosen or cleared, never typed. */
function PathRow({
  what,
  value,
  dialog,
  onChoose,
  onClear,
}: {
  what: string;
  value: string;
  dialog: boolean;
  onChoose: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="field stacked">
      <span>{what}</span>
      <p className="chosenpath">{value === '' ? 'Not set' : value}</p>
      {dialog ? (
        <button type="button" className="ghost choose" aria-label={`Choose ${what}`} onClick={onChoose}>
          Choose…
        </button>
      ) : (
        <em className="hint">This copy of After Effects offers no file chooser.</em>
      )}
      {value === '' ? null : (
        <button type="button" className="chip" aria-label={`Clear ${what}`} onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  );
}

/**
 * One face, set in itself.
 *
 * A plain box rather than the setup screen's searchable list: this card sits
 * inside a scrolling panel beside four other controls, and the name it holds
 * came from that list in the first place. It is drawn in the face it names so a
 * wrong one is visible rather than described.
 */
function FaceRow({
  what,
  value,
  onChange,
}: {
  what: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="field stacked">
      <span>{what}</span>
      <input
        type="text"
        aria-label={what}
        value={value}
        style={value === '' ? undefined : { fontFamily: `"${value}", sans-serif` }}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
