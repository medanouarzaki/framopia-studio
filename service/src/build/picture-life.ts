/**
 * When each picture arrives and when it leaves, as opposed to when its words
 * run.
 *
 * **The single declaration of both ends**, read by everything that has to
 * agree about them: `reel-plan` sets the layer's in and out points from it,
 * `build-reel-cli` sizes each picture from the face mask over the span it
 * returns, and `analysis/sfx` places the whoosh that leads it. Sizing over the
 * words' span while living to the handover is the defect this module exists to
 * make impossible — Block 10 session 39 measured 13 of 26 slots across four
 * reels landing over the speaker that way, `sora`'s `img002` by 376px.
 */

export interface PictureWindow {
  id: string;
  /** When the words this picture illustrates begin. */
  start: number;
  /** When they end. */
  end: number;
  /**
   * When the word the picture is *about* begins, if the model named one.
   *
   * Absent means it named none, or the plan predates slot prompt v3, and the
   * picture arrives with its sentence — which is what every plan did before.
   */
  nameStartS?: number;
}

export interface PictureLife extends PictureWindow {
  /** When the layer arrives. Never earlier than `start`, never later than `end`. */
  screenStartS: number;
  /** When it leaves. Never earlier than `end`. */
  screenEndS: number;
}

/**
 * Where a picture arrives, given the word it is about.
 *
 * **The user's ruling of 1 September**: *"At the very beginning of the video
 * the doctor says hello. She doesn't say 'I'm doctor' etc. He should display
 * the photo at the time she says 'I am doctor'."* A picture was placed across
 * the whole span it was given, so it arrived with the sentence rather than with
 * the thing it depicts.
 *
 * `minOnScreenS` is the template's own authored entrance, read from the audit
 * by the caller — nothing here carries a duration of its own. A picture never
 * starts so late that its entrance could not finish inside its own words, which
 * is the only bound that matters: under the handover it then stays until the
 * next picture anyway, and the last picture in a reel has nothing after it.
 *
 * Clamped against the words' own end rather than against the next picture, so
 * this depends on one slot alone and every caller can compute it without
 * knowing what follows.
 */
export function pictureStartOf(window: PictureWindow, minOnScreenS: number): number {
  if (window.nameStartS === undefined) return window.start;
  const latest = Math.max(window.start, window.end - minOnScreenS);
  return Math.min(Math.max(window.nameStartS, window.start), latest);
}

/**
 * Every picture's screen life, in the order the windows were given.
 *
 * **A picture stays until the next one appears** — the user's ruling of
 * 1 September, given after looking at his own reel built two ways. It leaves on
 * the frame the next one arrives; the alternative, where the outgoing picture
 * stayed underneath for the length of the incoming one's fade, was rejected.
 *
 * The handover is to the next picture's **arrival**, which since prompt v3 is
 * the word it is about rather than the start of its sentence. So a picture that
 * now arrives later also leaves later, and there is still no gap.
 *
 * The last picture ends with its own words: the ruling names the next picture
 * as what a picture waits for, and where there is none there is nothing to wait
 * for. Holding it to the end of the reel would be a second ruling nobody has
 * given.
 */
export function pictureLives(windows: PictureWindow[], minOnScreenS: number): PictureLife[] {
  const startFor = new Map(windows.map((w) => [w.id, pictureStartOf(w, minOnScreenS)]));
  const order = windows
    .map((w, i) => ({ w, i }))
    .sort((a, b) => (startFor.get(a.w.id) as number) - (startFor.get(b.w.id) as number) || a.i - b.i);
  const endFor = new Map<string, number>();

  order.forEach(({ w }, position) => {
    const next = order[position + 1]?.w;
    // A slot whose words outlast the next slot's arrival would otherwise be cut
    // short by the handover; the words always win. `planSlots` forbids the
    // overlap that would cause it, but this module does not depend on that.
    endFor.set(
      w.id,
      next === undefined ? w.end : Math.max(w.end, startFor.get(next.id) as number),
    );
  });

  return windows.map((w) => ({
    ...w,
    screenStartS: startFor.get(w.id) as number,
    screenEndS: endFor.get(w.id) as number,
  }));
}

/**
 * The windows for a reel's slots, with the named word resolved to a time.
 *
 * Written once because three callers need it and three copies of "which word is
 * this picture about" is three chances to disagree about when it arrives.
 */
export function pictureWindows(
  slots: { id: string; start: number; end: number; nameWordId?: string }[],
  wordStartOf: (wordId: string) => number | undefined,
): PictureWindow[] {
  return slots.map((s) => {
    const named = s.nameWordId === undefined ? undefined : wordStartOf(s.nameWordId);
    return { id: s.id, start: s.start, end: s.end, ...(named === undefined ? {} : { nameStartS: named }) };
  });
}
