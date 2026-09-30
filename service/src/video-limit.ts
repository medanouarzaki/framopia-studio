import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from '@framopia/core';

/**
 * The hard gate on one video's run, in dollars of ledger spend across every
 * billable stage, **until he sets his own**.
 *
 * **This is not the $2.00 figure the panel shows.** That is ARCHITECTURE §6's
 * soft alarm — a number the user is warned about, per reel, cumulative. This is
 * a refusal: checked against the ledger before each billable request, so a run
 * cannot walk past it while it is happening. It sits above the alarm because a
 * reel legitimately crossing $2.00 should warn, not fail.
 *
 * CHOSEN, NOT MEASURED. A five-slot reel costs about $1.90 end to end
 * (transcription ~$0.17, keywords ~$0.18, slots ~$0.06, images ~$1.55), so this
 * leaves room for one regeneration and stops well short of a runaway.
 *
 * **It was never his, and now it is.** Block 8 chose it; Block 10 session 31
 * reported that a 40-second reel would meet it and left the figure undecided.
 * Block 15 session 119 found him refused at $6.87 on a 70-second client video
 * with nothing in the panel to raise, and he ruled: it stays a refusal, he sets
 * it on the Make screen, and it starts where it always was. This is that start.
 */
export const PIPELINE_CEILING_USD = 4;

/**
 * His own figure, in a file of its own — **not** in `cap.json`. The monthly cap
 * is written whole by `setCap`, so a second field there would be erased the
 * first time he saved a cap, and the two answer different questions anyway.
 */
export const VIDEO_LIMIT_PATH = path.join(LOCAL_DIR, 'video-limit.json');

/**
 * The most one video may cost before a run refuses it. Absent or unreadable is
 * the default, so a machine that has never had this file behaves exactly as it
 * did before the file existed.
 */
export function readVideoLimitUsd(file = VIDEO_LIMIT_PATH): number {
  if (!existsSync(file)) return PIPELINE_CEILING_USD;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const usd = parsed['usd'];
    return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : PIPELINE_CEILING_USD;
  } catch {
    return PIPELINE_CEILING_USD;
  }
}

export function setVideoLimitUsd(usd: number, file = VIDEO_LIMIT_PATH): void {
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error('the most for one video is an amount above zero');
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ usd }, null, 2)}\n`, 'utf8');
}
