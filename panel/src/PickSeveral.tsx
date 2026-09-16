import type { JSX } from 'react';
import { shortLabels } from './video-names.js';
import type { Reel } from './types.js';

/**
 * **Several videos, chosen in one place, without leaving it.**
 *
 * Block 14 session 114. Mohamed works principally in queues and said the panel
 * is not smooth and not logical. It was built one client, one video, one build,
 * and the queue was a box on the right of step 2 — so the only way to add a
 * second video was to cross back to Choose, pick it, and cross to Make again.
 * Session 114 counted the walk on his own panel: **putting ten videos in a list
 * cost 41 actions, 18 of them crossings between two screens.**
 *
 * So the list of his client's videos is here, where the list is being made. He
 * picks the client once, on Choose, and everything about *which videos* happens
 * on one screen.
 *
 * **One list, not two.** The first draft had the videos to pick from above and
 * the list being assembled below, and the same video appeared in both. A ticked
 * row carries its own position instead, so what is in the list and what order it
 * is in are readable off the thing he is pressing.
 *
 * **It scrolls rather than growing.** Session 106 got every screen inside 900 px
 * and every session since has held it; a client with thirty videos would have put
 * Make past it on its own. Six rows is what the box shows, the rest is a scroll,
 * and `.pickseveral ul` is where that is set.
 *
 * **Nothing here is the accent.** Ticking a video spends nothing — the press that
 * spends is *Make these N videos* below, and that one is red.
 */
export function PickSeveral({
  reels,
  chosen,
  disabled,
  onToggle,
}: {
  /** The client's videos, as the picker on Choose has them. */
  reels: Reel[];
  /** The labels in the list now, in the order he put them there. */
  chosen: readonly string[];
  /** While a list is starting, so nothing moves under the press. */
  disabled: boolean;
  onToggle: (label: string) => void;
}): JSX.Element {
  /**
   * **A video already in the list is shown even when it is another client's.**
   *
   * The list is assembled here, out of the client picked on Choose — so changing
   * that client changes what this offers. Without this, a video put in the list
   * under one client vanished the moment he looked at another, while *Make these
   * N videos* went on counting it: work he could not see and could not take out.
   *
   * **A list is therefore not forced to one client, and that is deliberate.**
   * Every item carries its own client already — the service has taken a queue
   * that way since session 94 — and session 80's wrong-client rule protects the
   * brand per reel rather than per list. Forcing one client would have meant
   * either refusing a mixed list or discarding it silently, and neither is
   * better than showing him what he has.
   */
  const strays = chosen.filter((label) => !reels.some((r) => r.label === label));
  const rows: { label: string; present: boolean }[] = [
    ...strays.map((label) => ({ label, present: true })),
    ...reels.map((r) => ({ label: r.label, present: r.present !== false })),
  ];
  const shown = shortLabels(rows.map((r) => r.label));
  if (rows.length === 0) {
    return <p className="faint">No videos found for this client.</p>;
  }
  return (
    <div className="pickseveral">
      <ul className="facts">
        {rows.map((reel) => {
          const at = chosen.indexOf(reel.label);
          const inList = at !== -1;
          return (
            <li key={reel.label}>
              <button
                type="button"
                className={`pick ${inList ? 'chosen' : ''}`}
                aria-pressed={inList}
                disabled={disabled || !reel.present}
                title={reel.label}
                onClick={() => onToggle(reel.label)}
              >
                <span className="k">
                  {inList ? `${String(at + 1)}. ` : ''}
                  {shown.get(reel.label) ?? reel.label}
                </span>
                <span className="v">
                  {!reel.present
                    ? 'not on this Mac'
                    : inList
                      ? 'in the list'
                      : 'add'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
