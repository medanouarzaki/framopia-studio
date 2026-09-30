import { useState, type JSX } from 'react';
import { LIMIT_LABEL, money } from './words.js';

/**
 * **The most one video may cost, and it refuses.**
 *
 * Block 15 session 119. A run refused him at $6.87 and told him to *"raise the
 * limit"*; the only money control he could find was the monthly cap, which only
 * warns, and the figure that refused was a constant in the service. He ruled that
 * it stays a refusal and that he sets it — so this is the one place it is set,
 * shown on Make beside *Make the pictures* when a video is over it, and always on
 * the money screen.
 *
 * Saving writes a figure and nothing else: it does not start a run, and a run
 * already going keeps the figure it started with.
 */
export function VideoLimit({
  limitUsd,
  save,
}: {
  limitUsd: number;
  save: (usd: number) => Promise<void>;
}): JSX.Element {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const onSave = (): void => {
    if (busy) return;
    const wanted = Number(draft.trim().replace(/^\$/, ''));
    if (draft.trim() === '' || !Number.isFinite(wanted) || wanted <= 0) {
      setTrouble('Type an amount in dollars, like 8.');
      return;
    }
    setBusy(true);
    setTrouble(null);
    void save(wanted).then(
      () => {
        setDraft('');
        setBusy(false);
      },
      (error: Error) => {
        setTrouble(error.message);
        setBusy(false);
      },
    );
  };

  return (
    <div className="videolimit">
      <label className="capentry">
        <span>{LIMIT_LABEL}</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          placeholder={money(limitUsd)}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className="ghost" disabled={busy} onClick={onSave}>
          Save
        </button>
      </label>
      {trouble === null ? null : (
        <p className="hint" role="status">
          {trouble}
        </p>
      )}
    </div>
  );
}
