import type { JSX } from 'react';
import { aroundPhrase } from './words.js';

/**
 * **A sentence that names a place, with a way there inside it.**
 *
 * Block 13 session 102, from Mohamed's words: *"when I click a button, the next
 * button I'm going to click on should be near to it."* Fitts's law says the next
 * target belongs under the pointer that is already there; this panel kept telling
 * him where to go and leaving him to find it — *Go to Build*, with Build a tab at
 * the top of the screen.
 *
 * **No wording changes and nothing is deleted.** The whole sentence is still
 * rendered, character for character; one span of it is a control. When the phrase
 * is not in the sentence — a sentence reworded, a service older than this panel —
 * the sentence renders as plain text, because a way there that goes nowhere is
 * worse than no way there.
 *
 * `.linky` is the panel's existing inline control — the queue's *take it out* —
 * which until this session carried no CSS rule at all and drew as a native grey
 * button. It has one now: underlined, the text's own colour, no colour of its
 * own, because colour in this panel means *this spends money*.
 */
export function Sentence({
  text,
  phrase,
  onPress,
  className = 'say',
}: {
  text: string;
  phrase: string;
  onPress: () => void;
  className?: string;
}): JSX.Element {
  const split = aroundPhrase(text, phrase);
  if (split === null) {
    return (
      <p className={className} role="status">
        {text}
      </p>
    );
  }
  return (
    <p className={className} role="status">
      {split.before}
      <button type="button" className="linky" onClick={onPress}>
        {split.phrase}
      </button>
      {split.after}
    </p>
  );
}
