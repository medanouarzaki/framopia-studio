import { useEffect, useState } from 'react';
import {
  createClient,
  loadFonts,
  loadSubtitlePreview,
  type Connection,
  type FontList,
  type SubtitlePreview,
} from './service.js';
import { fileDialogSupport, pickFolder, pickImageFile } from './file-dialog.js';
import { fileUrl } from './picture.js';
import {
  PALETTE_MEANING,
  paletteRolesInDisplayOrder,
  type PaletteRole,
} from '@framopia/core/palette-meaning';
import {
  STILL_EXTENSIONS_WITHOUT_DOT,
  judgeStill,
  stillVerdictSentence,
} from './still-formats.js';
import type { ClientMode } from './types.js';

/**
 * Setting up a client.
 *
 * **Everything but the name is optional**, and every blank takes the value the
 * tool already used — so a client with a name and a folder works exactly like
 * the one that existed before this form did. Each field says what happens if it
 * is left alone, because a blank that silently decides something is worse than
 * a question.
 *
 * A one-off is the same form with most of it hidden: a video for someone he
 * will not work with again should not put a name in his client list for years.
 */
/**
 * The four colours, with what each actually does.
 *
 * The captions and their order are `@framopia/core/palette-meaning`, which the
 * client card reads too — they were two copies until Block 10 session 18 and had
 * already drifted from what the builds do. The hexes are the defaults a client
 * with no colours gets today: the service inherits the template client's
 * palette, so a client saved without touching them comes out exactly as before.
 */
const PALETTE_FIELDS: { role: PaletteRole; what: string; hex: string }[] =
  paletteRolesInDisplayOrder().map((role) => ({
    role,
    what: PALETTE_MEANING[role],
    hex: { light: '#F8F6F2', accent: '#C9A96E', background: '#1A0000', primary: '#820000' }[role],
  }));

const DEFAULT_PALETTE: Record<string, string> = Object.fromEntries(
  PALETTE_FIELDS.map((f) => [f.role, f.hex]),
);

export function NewClient({
  connection,
  kind,
  onSaved,
  onCancel,
}: {
  connection: Connection | null;
  kind: 'permanent' | 'one-off';
  onSaved: (id: string, modes: ClientMode[]) => void;
  onCancel: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [videoFolder, setFolder] = useState('');
  const [latin, setLatin] = useState('');
  const [arabic, setArabic] = useState('');
  const [logoPath, setLogo] = useState('');
  const [language, setLanguage] = useState('');
  const [shape, setShape] = useState('');
  const [baseline, setBaseline] = useState('');
  const [watermark, setWatermark] = useState(true);
  const [palette, setPalette] = useState<Record<string, string>>(DEFAULT_PALETTE);
  const [fonts, setFonts] = useState<FontList>({
    available: false,
    names: [],
    families: null,
    trouble: null,
  });
  const [preview, setPreview] = useState<SubtitlePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permanent = kind === 'permanent';
  const dialog = fileDialogSupport();

  useEffect(() => {
    if (connection === null) return;
    void loadFonts(connection).then(setFonts);
    void loadSubtitlePreview(connection).then(setPreview);
  }, [connection]);

  const save = async (): Promise<void> => {
    if (connection === null) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (note.trim() !== '') body['about'] = note.trim();
      if (permanent) {
        if (videoFolder.trim() !== '') body['videoFolder'] = videoFolder.trim();
        if (logoPath.trim() !== '') body['logoPath'] = logoPath.trim();
        if (shape !== '') body['videoShape'] = shape;
        if (baseline.trim() !== '') body['subtitleBaselineY'] = Number(baseline);
      }
      if (latin.trim() !== '' && arabic.trim() !== '') {
        body['fonts'] = { latin: latin.trim(), arabic: arabic.trim() };
      }
      if (language !== '') body['language'] = language;
      if (!watermark) body['watermarkByDefault'] = false;
      const created = await createClient(connection, body);
      onSaved(created.id, created.modes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="editor">
      <div className="editorhead">
        <button className="back" type="button" onClick={onCancel}>
          Back
        </button>
        <h2>{permanent ? 'Set up a client' : 'Just this video'}</h2>
      </div>

      <p className="promise">
        {permanent
          ? 'Everything except the name can be left blank. Anything you skip uses what the tool already does, and you can fill it in later.'
          : 'For a video you are doing once. It is not added to your client list.'}
      </p>

      <div className="card form">
        <Field
          label="Name"
          hint="Dr Jenna — the name you will look for in a year."
          value={name}
          onChange={setName}
        />
        <Field
          label="Note"
          hint="Dermatologist, Casablanca. In six months the name alone will not be enough."
          value={note}
          onChange={setNote}
        />
        {permanent ? (
          <PathField
            label="Video folder"
            hint="Where their footage lives. This is what fills the video list. Blank keeps the old list."
            value={videoFolder}
            onChange={setFolder}
            choose={() => pickFolder('Choose their video folder', videoFolder)}
            chooseLabel="Choose folder…"
            dialog={dialog.available}
          />
        ) : null}

        <FontField
          label="Latin font"
          hint="Blank uses Inter Semi-Bold, the standard one."
          value={latin}
          onChange={setLatin}
          fonts={fonts}
        />
        <FontField
          label="Arabic font"
          hint="Blank uses Almarai Bold, the standard one."
          value={arabic}
          onChange={setArabic}
          fonts={fonts}
          rtl
        />

        <label className="field">
          <span>Mostly spoken in</span>
          <select
            aria-label="Mostly spoken in"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="">A mix — the usual</option>
            <option value="darija">Darija</option>
            <option value="french">French</option>
            <option value="english">English</option>
            <option value="mixed">A mix</option>
          </select>
        </label>

        {permanent ? (
          <>
            <PathField
              label="Logo"
              hint={`A PNG with a transparent background is what this expects. ${STILL_EXTENSIONS_WITHOUT_DOT.join(', ')} are accepted. Optional.`}
              value={logoPath}
              onChange={setLogo}
              choose={() => pickImageFile('Choose their logo', logoPath)}
              chooseLabel="Choose file…"
              dialog={dialog.available}
              say={stillVerdictSentence(judgeStill(logoPath))}
            />
            <label className="field">
              <span>Video shape</span>
              <select
                aria-label="Video shape"
                value={shape}
                onChange={(e) => setShape(e.target.value)}
              >
                <option value="">Upright, for phones — the usual</option>
                <option value="vertical">Upright</option>
                <option value="square">Square</option>
                <option value="landscape">Wide</option>
              </select>
            </label>
            <SubtitleHeight value={baseline} onChange={setBaseline} preview={preview} />
          </>
        ) : null}

        <label className="check">
          <input
            type="checkbox"
            checked={watermark}
            onChange={(e) => setWatermark(e.target.checked)}
          />
          <span>Put your watermark on their videos</span>
        </label>

        {permanent ? (
          <div className="colours">
            <span className="colourhead">Their colours</span>
            {PALETTE_FIELDS.map((f) => (
              <label className="colour" key={f.role}>
                <input
                  type="color"
                  aria-label={f.what}
                  value={palette[f.role] ?? f.hex}
                  onChange={(e) =>
                    setPalette((p) => ({ ...p, [f.role]: e.target.value.toUpperCase() }))
                  }
                />
                <span className="what">{f.what}</span>
                <code>{palette[f.role] ?? f.hex}</code>
              </label>
            ))}
            {/*
              **Nothing is waiting on anything.** The service has taken a
              client's own pictures since Block 9 — `POST /clients/pictures` and
              its DELETE — the panel's own `addClientPicture` calls that route,
              and the picture editor already offers a client's pictures beside
              the generated ones, per slot. **The only missing piece is a control
              that calls it**: `addClientPicture` is declared and nothing in any
              component invokes it. So "once there are videos to use them in"
              named a precondition that is not real and a place that does not
              exist; what is true is simply that the screen has not been built.
            */}
            <p className="note">
              Adding their own photographs is not built yet. When it is, it will be here.
            </p>
          </div>
        ) : null}
      </div>

      {error === null ? null : (
        <p className="say" role="alert">
          {error}
        </p>
      )}

      <button
        className="ghost"
        type="button"
        disabled={name.trim() === '' || saving || connection === null}
        onClick={() => void save()}
      >
        {saving ? 'Saving…' : permanent ? 'Save this client' : 'Use for this video'}
      </button>
    </main>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="field stacked">
      <span>{label}</span>
      <input
        type="text"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <em className="hint">{hint}</em>
    </label>
  );
}

/**
 * A path he points at, never one he types.
 *
 * **User ruling, 2026-08-31**, made while setting up a client for the first
 * time and stated for the whole product: no path is written by hand anywhere.
 * A path is something the machine already knows how to find, and asking someone
 * to reproduce one character for character is asking him to do the machine's
 * work and to get it wrong.
 *
 * The chooser is CEP's own `showOpenDialogEx`, the same call the video picker
 * has used since Block 8 session 44 — `chooseDirectory` is its second argument,
 * so a folder chooser and a file chooser are one call. Nothing new was invented.
 *
 * **A cancel leaves the field exactly as it was.** `pickFolder` and
 * `pickImageFile` answer null both for a cancel and for a host with no dialog,
 * and null here means "he chose nothing", never "clear what he had".
 *
 * The path is still shown, because he has to see what he picked, and the field
 * falls back to text on a host with no chooser at all — a real case this project
 * has been wrong about before, and why the button appears only when the call is
 * genuinely there.
 */
function PathField({
  label,
  hint,
  value,
  onChange,
  choose,
  chooseLabel,
  dialog,
  say,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  choose: () => string | null;
  chooseLabel: string;
  dialog: boolean;
  /** Said the moment he picks, not at build time three steps later. */
  say?: string | null;
}): JSX.Element {
  return (
    <div className="field stacked pathfield">
      <span>{label}</span>
      {dialog ? (
        <>
          <button
            className="ghost choose"
            type="button"
            onClick={() => {
              const picked = choose();
              if (picked !== null) onChange(picked);
            }}
          >
            {chooseLabel}
          </button>
          {value === '' ? null : (
            <p className="chosenpath" aria-label={`${label} chosen`}>
              {value}
            </p>
          )}
        </>
      ) : (
        <input
          type="text"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {say == null ? null : (
        <p className="say" role="status">
          {say}
        </p>
      )}
      <em className="hint">
        {hint}
        {dialog ? '' : ' This copy of After Effects offers no file chooser, so type the full path.'}
      </em>
    </div>
  );
}

/**
 * The sample, drawn in the face he chose or not drawn at all.
 *
 * **A wrong sample is worse than no sample.** Session 16 set `font-family` to
 * After Effects' name and let the browser fall back — so choosing the *italic*
 * `AdobeClean-It` drew upright text in a plain sans, showing a font nobody
 * picked. That is the same silent substitution `docs/PROJECT_SPEC.md` guards
 * against in the build, where After Effects accepts a name it cannot resolve and
 * quietly sets something else.
 *
 * So the face is loaded from its own file. The service resolves the name through
 * CoreText — the only thing that knows After Effects' naming for a variable
 * font's instance — and hands back the file and its axes. A face with no file is
 * said to be unpreviewable rather than approximated.
 *
 * `font-variation-settings` is not decoration: the file behind `Inter-SemiBold`
 * is `Inter-VariableFont`, whose default instance is Regular. Loading it without
 * `wght: 600` would draw the wrong weight and call it the sample.
 */
function fontFaceRule(name: string, face: { file: string | null }): string | null {
  if (face.file === null) return null;
  return `@font-face { font-family: "${cssFamilyFor(name)}"; src: url("${fileUrl(face.file)}"); }`;
}

/** A family name of our own, so nothing collides with an installed one. */
function cssFamilyFor(name: string): string {
  return `framopia-sample-${name.replace(/[^A-Za-z0-9-]/g, '_')}`;
}

function variationSettings(axes: Record<string, number>): string | undefined {
  const entries = Object.entries(axes);
  if (entries.length === 0) return undefined;
  return entries.map(([tag, value]) => `"${tag}" ${value}`).join(', ');
}

function FontSample({
  name,
  face,
  rtl,
}: {
  name: string;
  face: { file: string | null; axes: Record<string, number>; why: string | null } | undefined;
  rtl: boolean;
}): JSX.Element {
  /*
   * Arabic sample: a real word rather than a pangram, because Arabic has no
   * conventional one and a made-up string would show nothing about the face.
   * "شنو كتعرفي" — "what do you know" — is from the corpus's own speech, is short
   * enough to fit the field, and exercises initial, medial and final forms.
   */
  const text = rtl ? 'شنو كتعرفي' : 'The quick brown fox';
  if (face === undefined || face.file === null) {
    return (
      <p className="fontsample cannot">
        This font cannot be shown here{face?.why == null ? '' : ` — ${face.why}`}. It will still
        be used in the composition.
      </p>
    );
  }
  const family = cssFamilyFor(name);
  const settings = variationSettings(face.axes);
  return (
    <>
      <style>{fontFaceRule(name, face)}</style>
      <p
        className="fontsample"
        dir={rtl ? 'rtl' : 'ltr'}
        style={{
          fontFamily: `"${family}"`,
          ...(settings === undefined ? {} : { fontVariationSettings: settings }),
        }}
      >
        {text}
      </p>
    </>
  );
}

/**
 * A face chosen from what After Effects actually has, and searchable.
 *
 * **The names are After Effects' own**, read from `app.fonts.allFonts` through
 * the service. Session 12 measured that macOS publishes different ones for a
 * variable font's instance — `Inter-Regular_SemiBold` where After Effects says
 * `Inter-SemiBold` — so a list built from the system would offer names no build
 * can use.
 *
 * **1,188 names is not a list you can scroll.** Finding `Inter-SemiBold` meant
 * passing every Adobe UI face on the machine, so the field filters as he types.
 * **Nothing is ever removed from it**: a hidden font is a font he cannot choose,
 * and this is his tool for his clients' brands. What typing does is narrow, and
 * clearing the box gives the whole list back.
 *
 * **A list that could not be built is said out loud and the field falls back to
 * text.** An empty chooser and a chooser that could not be filled look the same
 * on screen and mean opposite things.
 */
function FontField({
  label,
  hint,
  value,
  onChange,
  fonts,
  rtl = false,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  fonts: FontList;
  rtl?: boolean;
}): JSX.Element {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const shown =
    needle === '' ? fonts.names : fonts.names.filter((n) => n.toLowerCase().includes(needle));
  const faces = fonts.faces ?? {};
  return (
    <div className="field stacked fontfield">
      <span>{label}</span>
      {fonts.available ? (
        <>
          <input
            type="search"
            className="fontsearch"
            aria-label={`Search ${label.toLowerCase()}s`}
            placeholder="Type to narrow the list"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label={label}
            size={search === '' ? undefined : 8}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">The standard one</option>
            {shown.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {needle === '' ? null : (
            <em className="hint">
              {shown.length} of {fonts.names.length} faces. Nothing is hidden — clear the box for
              all of them.
            </em>
          )}
        </>
      ) : (
        <input
          type="text"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {value === '' ? null : <FontSample name={value} face={faces[value]} rtl={rtl} />}
      <em className="hint">
        {hint}
        {fonts.available || fonts.trouble === null
          ? ''
          : ` The list of faces could not be built — ${fonts.trouble}. Type the name After Effects uses.`}
      </em>
    </div>
  );
}

/**
 * Where the first subtitle line sits, positioned by eye against a real frame.
 *
 * **The user chose this over named presets and over a typed number**
 * (2026-08-31): it is the only one of the three where he decides by looking
 * rather than by imagining what a pixel figure means. The number follows the
 * slider and stays visible and editable, so the stored value is never a mystery
 * to someone who does know the figure they want.
 *
 * **The preview says what it is showing.** A frame from a real reel when the
 * pipeline has extracted one, and a plain frame otherwise — never a plain frame
 * presented as though it were footage. It also states the scale, because a
 * 2160 × 3840 frame drawn a couple of hundred pixels wide would otherwise
 * misrepresent a position silently.
 */
function SubtitleHeight({
  value,
  onChange,
  preview,
}: {
  value: string;
  onChange: (value: string) => void;
  preview: SubtitlePreview | null;
}): JSX.Element {
  const sourceHeight = preview?.sourceHeight ?? 3840;
  const fallbackDefault = preview?.defaultBaselineY ?? 2480.4;
  const current = value.trim() === '' ? fallbackDefault : Number(value);
  const usable = Number.isFinite(current) ? current : fallbackDefault;
  const atFraction = Math.min(1, Math.max(0, usable / sourceHeight));

  return (
    <div className="field stacked heightfield">
      <span>Subtitle height</span>
      <div className="heightpreview">
        <div className="frame">
          {preview?.framePath == null ? (
            <div className="plainframe" />
          ) : (
            <img src={fileUrl(preview.framePath)} alt="" />
          )}
          <div className="baseline" style={{ top: `${(atFraction * 100).toFixed(3)}%` }} />
        </div>
        <p className="faint">
          {preview?.fromReel == null
            ? `No footage to show yet, so this is a plain ${preview?.sourceWidth ?? 2160} × ${sourceHeight} frame.`
            : `A real frame from ${preview.fromReel}.`}{' '}
          Shown at about a tenth of {preview?.sourceWidth ?? 2160} × {sourceHeight}.
        </p>
      </div>
      <input
        type="range"
        aria-label="Subtitle height"
        min={0}
        max={sourceHeight}
        step={1}
        value={Math.round(usable)}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="heightvalue">
        <input
          type="number"
          aria-label="Subtitle height in pixels"
          value={value}
          placeholder={String(fallbackDefault)}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="faint">px from the top</span>
        {value.trim() === '' ? null : (
          <button className="ghost" type="button" onClick={() => onChange('')}>
            Use the usual
          </button>
        )}
      </div>
      <em className="hint">
        Blank puts it where every video so far has it, {fallbackDefault} px. Move it for a
        client with a logo along the bottom.
      </em>
    </div>
  );
}

