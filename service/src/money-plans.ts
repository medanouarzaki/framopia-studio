import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { browsedPlansDir } from './videos.js';

/**
 * Every Edit Plan on this machine, which is the only thing that knows what a
 * reel cost. Two places hold them: the corpus beside its footage, and
 * `.local/plans/` for a client's own videos, because a client's footage never
 * gets a file written beside it.
 */
export function planPathsForMoney(): string[] {
  const dirs = [path.join(REPO_ROOT, 'my files', 'test videos'), browsedPlansDir()];
  const out: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.editplan.json')) out.push(path.join(dir, f));
    }
  }
  return out;
}
