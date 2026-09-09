import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from '@framopia/core';

/**
 * **A copy of the plan as it stood, before its client is changed.**
 *
 * Re-attaching rewrites `clientMode` and `clientSnapshot` — the colours, the
 * faces and the shadow the reel will be built in. That is a deliberate act with
 * consequences, and the standing rule is that nothing a person made is thrown
 * away: **the previous attachment is copied aside, never overwritten in place
 * without a trace**, and the reply says exactly where it went.
 *
 * The whole plan file is copied rather than the two fields, because the two
 * fields are not the whole of what changes — `applyClientDefaultsToPlan` may
 * move the watermark too, and a copy of the file cannot be wrong about what it
 * held.
 */
/**
 * **Overridable, for the reason sessions 69 to 71 paid for twice.** A test that
 * writes here writes into the directory a client's own plans live in, and a run
 * that is interrupted leaves its copies behind in the real one. The override is
 * where a test points; production, with nothing set, answers as it always did.
 */
export function beforeReattachDir(): string {
  return process.env['FRAMOPIA_REATTACH_DIR'] ?? path.join(LOCAL_DIR, 'plans', 'before-reattach');
}

/**
 * Copies the plan aside and answers where. Never overwrites a copy: a plan
 * re-attached twice keeps both, because either might be the one wanted back.
 */
export function keepPreviousAttachment(planPath: string, now = new Date()): string {
  const dir = beforeReattachDir();
  mkdirSync(dir, { recursive: true });
  const stem = path.basename(planPath).replace(/\.editplan\.json$/, '');
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  let to = path.join(dir, `${stem}-${stamp}.editplan.json`);
  for (let n = 2; existsSync(to); n += 1) {
    to = path.join(dir, `${stem}-${stamp}-${n}.editplan.json`);
  }
  copyFileSync(planPath, to);
  return to;
}
