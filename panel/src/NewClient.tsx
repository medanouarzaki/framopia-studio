import { useState } from 'react';
import { createClient, type Connection } from './service.js';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permanent = kind === 'permanent';

  const save = async (): Promise<void> => {
    if (connection === null) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (note.trim() !== '') body['note'] = note.trim();
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
          <Field
            label="Video folder"
            hint="The full path to where their footage lives. This is what fills the video list. Blank keeps the old list."
            value={videoFolder}
            onChange={setFolder}
          />
        ) : null}

        <Field
          label="Latin font"
          hint="Blank uses Inter Semi-Bold, the standard one."
          value={latin}
          onChange={setLatin}
        />
        <Field
          label="Arabic font"
          hint="Blank uses Almarai Bold, the standard one."
          value={arabic}
          onChange={setArabic}
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
            <Field
              label="Logo"
              hint="The full path to their logo. Optional."
              value={logoPath}
              onChange={setLogo}
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
            <Field
              label="Subtitle height"
              hint="Pixels from the top of the frame. Blank puts it where every video so far has it. Move it for a client with a logo along the bottom."
              value={baseline}
              onChange={setBaseline}
            />
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

        {/*
          Colours and their own pictures are not here on purpose: a colour is
          chosen by looking at it, and a picture is chosen by pointing at a file.
          Both are edits to a client that exists, not questions on the way in.
        */}
        <p className="note">
          Colours and their own pictures are added afterwards, once the client exists.
        </p>
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
