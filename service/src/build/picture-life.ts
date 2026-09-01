/**
 * How long each picture is on screen, as opposed to how long its words run.
 *
 * **The single declaration of the handover**, read by two callers that must not
 * be allowed to disagree: `build-reel-cli` sizes each picture from the face
 * mask over the span this returns, and `reel-plan` sets the layer's out point
 * from it. Sizing from the words' span while living to the handover is the
 * defect this module exists to make impossible — Block 10 session 39 measured
 * 13 of 26 slots across four reels landing over the speaker that way, `sora`'s
 * `img002` by 376px.
 */

export interface PictureWindow {
  id: string;
  /** When the words this picture illustrates begin. */
  start: number;
  /** When they end. */
  end: number;
}

export interface PictureLife extends PictureWindow {
  /** When the layer leaves. Never earlier than `end`. */
  screenEndS: number;
}

/**
 * Every picture's screen life, in the order the windows were given.
 *
 * **The user's ruling of 1 September**, given after looking at his own reel
 * built two ways: *"The images shouldn't cut off. After each image appears, it
 * should stay until the next one appears. They should be consecutive. There is
 * no void between them, layer after layer."* A picture leaves on the frame the
 * next one arrives — he was shown that against a version where the outgoing
 * picture stayed underneath for the length of the incoming one's fade, and
 * chose this one.
 *
 * The last picture ends with its own words: the ruling names the next picture
 * as what a picture waits for, and where there is none there is nothing to wait
 * for. Holding it to the end of the reel would be a second ruling nobody has
 * given.
 */
export function pictureLives(windows: PictureWindow[]): PictureLife[] {
  const order = windows.map((w, i) => ({ w, i })).sort((a, b) => a.w.start - b.w.start || a.i - b.i);
  const endFor = new Map<string, number>();

  order.forEach(({ w }, position) => {
    const next = order[position + 1]?.w;
    // A slot whose words outlast the next slot's start would otherwise be cut
    // short by the handover; the words always win. `planSlots` forbids the
    // overlap that would cause it, but this module does not depend on that.
    endFor.set(w.id, next === undefined ? w.end : Math.max(w.end, next.start));
  });

  return windows.map((w) => ({ ...w, screenEndS: endFor.get(w.id) as number }));
}
