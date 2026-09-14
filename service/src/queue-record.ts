import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import type { QueueProgress, QueueSummary } from './queue.js';

/**
 * **Where a queue's record lives, and why it is not in a cache.**
 *
 * Mohamed's ruling of 2026-09-15: a queue's record is kept **forever**. It records
 * money that was actually spent, it is a few lines of text per video, and if it
 * ever grows unwieldy the answer is folding the old ones out of sight — never
 * deleting them.
 *
 * `.local/queues/`, beside `.local/plans/` and `.local/costs.jsonl`, which is
 * where this project already keeps a person's own material. **Deliberately not
 * under `.local/cache/`:** Block 13 session 92 measured that the caches had
 * evicted 6% more of the project's own cost evidence between two sessions. A
 * record of spending in an evicting store is a record that quietly stops being
 * true.
 *
 * One file per queue, named so the directory sorts oldest-first by name without
 * anything parsing a date.
 */
export const QUEUE_RECORD_DIR = ['.local', 'queues'] as const;

export function queueRecordDir(repoRoot = REPO_ROOT): string {
  return path.join(repoRoot, ...QUEUE_RECORD_DIR);
}

export interface QueueRecord {
  /** The job's id, which is what the panel polls and what names the file. */
  id: string;
  startedAt: string;
  /** Null while it is still running. */
  finishedAt: string | null;
  progress: QueueProgress;
  summary?: QueueSummary;
}

function fileFor(record: Pick<QueueRecord, 'id' | 'startedAt'>, repoRoot: string): string {
  /* Colons are legal on this disk and awkward everywhere else. */
  const stamp = record.startedAt.replace(/[:.]/g, '-');
  return path.join(queueRecordDir(repoRoot), `${stamp}-${record.id}.json`);
}

/**
 * **Written after every video, not at the end.**
 *
 * A queue four videos in that loses all four has lost real money: the work is
 * done and paid for, and only the record of it says so. Session 109 left the list
 * in memory, so a service restart took it — and the service restarts by itself
 * when the panel repairs it.
 *
 * **Written to a temporary name and renamed**, so a restart in the middle of a
 * write leaves the previous record intact rather than half of a new one. Rename
 * is atomic within a filesystem, which this always is: both paths are under
 * `.local`.
 */
export function writeQueueRecord(record: QueueRecord, repoRoot = REPO_ROOT): string {
  const dir = queueRecordDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  const out = fileFor(record, repoRoot);
  const temp = `${out}.writing`;
  writeFileSync(temp, `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  renameSync(temp, out);
  return out;
}

/**
 * Every queue this machine has run, **newest first**.
 *
 * A file this reader cannot parse is skipped rather than thrown over: one
 * unreadable record must not hide the other forty-nine, and the count the panel
 * shows is of what was actually read.
 */
export function listQueueRecords(repoRoot = REPO_ROOT): QueueRecord[] {
  const dir = queueRecordDir(repoRoot);
  if (!existsSync(dir)) return [];
  const out: QueueRecord[] = [];
  for (const name of readdirSync(dir).sort().reverse()) {
    if (!name.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as QueueRecord;
      if (typeof parsed.id === 'string' && parsed.progress !== undefined) out.push(parsed);
    } catch {
      // An unreadable record is not evidence about the others.
    }
  }
  return out;
}

/**
 * The queues that were still running when they were last written.
 *
 * **What a restart leaves behind.** The service died mid-queue, so the record says
 * `done: false` and some videos are `not-reached`. Nothing here resumes anything:
 * spending money is a thing he presses, and a service that restarted and carried
 * on buying would be the worst possible reading of "it survived".
 */
export function unfinishedQueues(repoRoot = REPO_ROOT): QueueRecord[] {
  return listQueueRecords(repoRoot).filter((r) => r.finishedAt === null && !r.progress.done);
}
