import type { JSX } from 'react';
import { usd } from './Money.js';

/**
 * **What a spend takes the month to, against the cap — and it never refuses.**
 *
 * Mohamed's ruling, the same standing as the soft-picture warning: the tool says
 * what it thinks and the person decides. Nothing here disables a button, and
 * `panel/src/cap.test.ts` holds it to that by asserting the button is still
 * pressable when the estimate is far past the cap.
 *
 * **There is no second threshold.** Session 69 measured what the history could
 * support: six reels carry a spend and **only two have ever had a complete run**,
 * both the same client's footage at 13.5 s and 40.5 s. A rule about a video
 * costing "far more than anything before" cannot be derived from two points that
 * differ mostly because one is three times longer, and a number chosen today
 * that can only be justified by pointing at an existing reel is not a
 * measurement. So the cap is all there is until the history can carry more.
 */
export function CapWarning({
  estimateUsd,
  monthSoFarUsd,
  capUsd,
}: {
  estimateUsd: number;
  monthSoFarUsd: number;
  capUsd: number | null;
}): JSX.Element | null {
  if (capUsd === null || estimateUsd <= 0) return null;
  const after = monthSoFarUsd + estimateUsd;
  if (after <= capUsd) return null;

  return (
    <p className="capwarning" role="status">
      This takes the month to {usd(after)}, past the {usd(capUsd)} you asked to be
      warned about. The button still works — this is only so you know.
    </p>
  );
}
