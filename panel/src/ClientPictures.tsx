import { useState } from 'react';
import { fileUrl } from './picture.js';
import {
  STILL_EXTENSIONS_WITHOUT_DOT,
  judgeStill,
  stillVerdictSentence,
} from './still-formats.js';
import { pickImageFile } from './file-dialog.js';

/**
 * The client's own photographs, on the client's own screen.
 *
 * **User ruling, 2026-08-31**: they are added where a client is set up, not in
 * the picture editor half-way through a video. So this renders on both client
 * screens — the setup form, where a client does not exist yet and the list is
 * sent with the client, and the client card, where each change goes straight to
 * the service. One component, because two would drift.
 *
 * **The file never moves and never leaves this machine.** What is stored is a
 * path; the thumbnail is drawn from the file where he put it, and
 * `core/src/client-pictures.ts` holds the rule and the tests that enforce it.
 * Removing one therefore forgets it rather than deleting it, and the screen
 * says so before he presses anything.
 *
 * **A description is required**, by the service and here. It is the only thing
 * that will tell him which photograph is which when he is choosing one for a
 * moment in a video a month from now.
 */
export interface ShownPicture {
  /** The id on a saved client; the path on one being set up. */
  key: string;
  path: string;
  description: string;
}

export function ClientPictures({
  pictures,
  dialog,
  busy,
  error,
  onAdd,
  onRemove,
}: {
  pictures: ShownPicture[];
  /** Whether this host really has a file chooser. Never assumed. */
  dialog: boolean;
  busy: boolean;
  error: string | null;
  onAdd: (picture: { path: string; description: string }) => void;
  onRemove: (key: string) => void;
}): JSX.Element {
  const [picked, setPicked] = useState('');
  const [description, setDescription] = useState('');

  const verdict = judgeStill(picked);
  const usable = verdict.kind === 'ok' || verdict.kind === 'not-previewable';
  const ready = usable && description.trim() !== '' && !busy;

  return (
    <div className="ownphotos">
      <span className="colourhead">Their own photographs</span>
      <p className="hint">
        Photographs they gave you — the clinic, their products, their team. You pick one by hand
        for a moment in a video; nothing works out which one belongs where. They stay where they
        are on this disk and are never sent anywhere.
      </p>

      {pictures.length === 0 ? (
        <p className="hint">None yet.</p>
      ) : (
        <ul className="photos">
          {pictures.map((picture) => (
            <li key={picture.key}>
              <Thumbnail path={picture.path} description={picture.description} />
              <span className="what">{picture.description}</span>
              <button
                type="button"
                className="chip"
                disabled={busy}
                aria-label={`Forget ${picture.description}`}
                onClick={() => onRemove(picture.key)}
              >
                Forget this
              </button>
            </li>
          ))}
        </ul>
      )}

      {pictures.length === 0 ? null : (
        <p className="hint">Forgetting a photo leaves the file itself exactly where it is.</p>
      )}

      {dialog ? (
        <div className="addphoto">
          <button
            className="ghost choose"
            type="button"
            disabled={busy}
            onClick={() => {
              const chosen = pickImageFile('Choose one of their photographs', picked);
              // A cancel answers nothing, and nothing must never clear what he
              // already picked.
              if (chosen !== null) setPicked(chosen);
            }}
          >
            Choose a photo…
          </button>
          {picked === '' ? null : (
            <p className="chosenpath" aria-label="Photo chosen">
              {picked}
            </p>
          )}
          {stillVerdictSentence(verdict, 'photo') === null ? null : (
            <p className="say" role="status">
              {stillVerdictSentence(verdict, 'photo')}
            </p>
          )}
          <label className="field stacked">
            <span>What is it?</span>
            <input
              type="text"
              aria-label="What is it?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <em className="hint">
              The clinic exterior. In your words — it is how you will find it again.
            </em>
          </label>
          <button
            className="ghost"
            type="button"
            disabled={!ready}
            onClick={() => {
              onAdd({ path: picked, description: description.trim() });
              setPicked('');
              setDescription('');
            }}
          >
            {busy ? 'Adding…' : 'Add this photo'}
          </button>
        </div>
      ) : (
        <p className="hint">
          This copy of After Effects offers no file chooser, so a photograph cannot be added from
          here. {STILL_EXTENSIONS_WITHOUT_DOT.join(', ')} are what it accepts when it can.
        </p>
      )}

      {error === null ? null : (
        <p className="say" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The photograph itself, or a sentence saying why it is not here.
 *
 * A `.psd` is a legitimate photograph the build can place and this panel cannot
 * draw, and a file that has been moved or unplugged is a different thing again.
 * Both say which, rather than leaving a broken image.
 */
function Thumbnail({ path, description }: { path: string; description: string }): JSX.Element {
  const [unreadable, setUnreadable] = useState(false);
  if (judgeStill(path).kind === 'not-previewable') {
    return <p className="cannot">This panel cannot show a preview of this kind of file.</p>;
  }
  if (unreadable) {
    return <p className="cannot">This photo could not be shown — has it moved?</p>;
  }
  return (
    <img
      className="shot"
      src={fileUrl(path)}
      alt={description}
      onError={() => setUnreadable(true)}
    />
  );
}
