import { useEffect, useState } from 'react';
import { normaliseHexColour } from '@framopia/core/palette-meaning';

/**
 * One brand colour: a swatch to drag, and a code to type.
 *
 * **Why the code field exists.** Until Block 10 session 47 this row was a
 * native `<input type="color">` and a `<code>` label. The label was not an
 * input — `contentEditable` false, unable even to take focus — so the only way
 * to set a colour was to drag inside the operating system's picker, and
 * pressing a key with that picker open just dismisses it, because it is an OS
 * window and nothing on the page owns it. A brand colour is a code that arrives
 * in a document. The control had never been usable for the one way it would
 * ever be used, and the user found it the first time he set up a second client.
 *
 * **Both halves stay.** Some people drag; the swatch is not being taken away.
 * They are two views of one value and each follows the other.
 *
 * **What is typed is held as typed until it parses.** A field that rewrote
 * every keystroke would make `#E8873A` impossible to enter — the first three
 * characters are a valid short form, so the value would jump to `#EE8833`
 * mid-word. So the draft is whatever is in the box, and the colour changes only
 * when the draft is a colour.
 */
export function ColourField({
  what,
  unset,
  value,
  onChange,
}: {
  what: string;
  /** The grey shown while nothing is chosen. Never sent; see `NewClient`. */
  unset: string;
  /** The chosen colour, or undefined while this one is still unset. */
  value: string | undefined;
  /** A colour, or null when the box has been emptied back to unset. */
  onChange: (hex: string | null) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(value ?? '');

  // Follows the swatch, and follows a value that arrived from anywhere else.
  useEffect(() => setDraft(value ?? ''), [value]);

  const typed = (next: string): void => {
    setDraft(next);
    if (next.trim() === '') {
      onChange(null);
      return;
    }
    const hex = normaliseHexColour(next);
    if (hex !== null) onChange(hex);
  };

  const refused = draft.trim() !== '' && normaliseHexColour(draft) === null;

  return (
    <label className="colour">
      <input
        type="color"
        aria-label={what}
        value={value ?? unset}
        onChange={(e) => {
          const hex = e.target.value.toUpperCase();
          setDraft(hex);
          onChange(hex);
        }}
      />
      <span className="what">{what}</span>
      <input
        className={`hex${refused ? ' refused' : ''}`}
        type="text"
        inputMode="text"
        spellCheck={false}
        autoComplete="off"
        aria-label={`${what} — colour code`}
        aria-invalid={refused}
        placeholder="not set"
        value={draft}
        onChange={(e) => typed(e.target.value)}
        onBlur={() => setDraft(value ?? '')}
      />
      {/*
        Said out loud rather than repaired. Turning `#12345` into black would be
        a wrong colour nobody notices; a refusal is one they cannot miss.
      */}
      {refused ? (
        <span className="trouble" role="status">
          not a colour code
        </span>
      ) : null}
    </label>
  );
}
