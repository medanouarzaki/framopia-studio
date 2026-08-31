/**
 * The transcript, arranged so a person can read it.
 *
 * The word editor lists one word a row with its id, its confidence and its
 * controls — which is what editing needs and is not reading. A 41-second reel
 * is roughly 340 rows, and nobody judges an orthography by scrolling 340 rows.
 *
 * Session 29 reversed the orthography rules so that Arabic is written in Arabic
 * letters, and **no transcript has ever been produced under them**. The four
 * hand-written references are in the old Latin style and cannot score one. His
 * eye is the only judge there is, so it has to be given something to look at.
 *
 * Nothing here decides anything about the transcript. It groups words into
 * lines and says which way each line runs.
 */
export interface ReadableWord {
  text: string;
  start: number;
  end: number;
  script: 'latin' | 'arabic';
  removed: boolean;
}

export interface ReadLine {
  /** Seconds from the start of the reel, for the first word on the line. */
  startS: number;
  words: ReadableWord[];
  /** Which way the line runs, from the script most of its words are in. */
  dir: 'rtl' | 'ltr';
}

/**
 * A new line starts after a silence longer than this.
 *
 * **Measured, not chosen.** Across the 343 words of the five corpus reels the
 * gap between consecutive words is 0.059 s at the median and 0.181 s at the
 * 95th percentile, and the whole corpus holds none longer than 0.381 s. At
 * 0.20 s the transcript breaks 15 times and reads at about 17 words a line; at
 * 0.30 s it breaks 3 times and runs to 43 words a line, which is a wall again.
 */
export const READ_LINE_GAP_S = 0.2;

/**
 * Which way a line of mixed script runs.
 *
 * **The word editor sets direction per token and never on a container, and that
 * rule is right there**: a row is one word beside its id and its controls, and
 * a direction on the row would reorder the columns. A line of prose is a
 * different thing — its direction is a real property of the sentence, and a
 * wholly Arabic line rendered left-to-right puts the last word first. So the
 * line takes the direction of the script most of its words are written in, and
 * each word still carries its own so a French word inside an Arabic line reads
 * correctly.
 */
export function lineDirection(words: ReadableWord[]): 'rtl' | 'ltr' {
  const arabic = words.filter((w) => w.script === 'arabic').length;
  return arabic * 2 > words.length ? 'rtl' : 'ltr';
}

export function readLines(
  words: ReadableWord[],
  gapS: number = READ_LINE_GAP_S,
): ReadLine[] {
  // A removed word is a filler the build will not draw, and reading is about
  // what will be on screen.
  const spoken = words.filter((w) => !w.removed);
  const lines: ReadLine[] = [];
  let current: ReadableWord[] = [];

  const close = (): void => {
    if (current.length === 0) return;
    lines.push({
      startS: current[0]?.start ?? 0,
      words: current,
      dir: lineDirection(current),
    });
    current = [];
  };

  for (const word of spoken) {
    const previous = current[current.length - 1];
    if (previous !== undefined && word.start - previous.end > gapS) close();
    current.push(word);
  }
  close();
  return lines;
}

/** `m:ss` — a reel is under a minute or two, so nothing here needs hours. */
export function timecode(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
