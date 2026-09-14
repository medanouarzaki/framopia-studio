import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listQueueRecords,
  queueRecordDir,
  unfinishedQueues,
  writeQueueRecord,
  type QueueRecord,
} from './queue-record.js';
import type { QueueProgress } from './queue.js';

/**
 * **The record Mohamed ruled is kept forever.**
 *
 * Block 14 session 110. Written into a scratch root, never beside his: a test
 * that wrote into `.local/queues/` would be a test that can put fiction in a
 * record of real spending.
 */
let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'framopia-queues-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function progressOf(over: Partial<QueueProgress> = {}): QueueProgress {
  return {
    items: [
      { reel: 'one', modeId: 'a-client', outcome: 'done', spentUsd: 1.2, attempts: 1,
        startedAt: '2026-09-15T10:00:00.000Z', finishedAt: '2026-09-15T10:26:00.000Z' },
      { reel: 'two', modeId: 'a-client', outcome: 'not-reached', spentUsd: 0, attempts: 0,
        startedAt: null, finishedAt: null },
    ],
    runningIndex: 1,
    spentUsd: 1.2,
    done: false,
    stopped: false,
    ...over,
  };
}

function recordOf(id: string, startedAt: string, over: Partial<QueueRecord> = {}): QueueRecord {
  return { id, startedAt, finishedAt: null, progress: progressOf(), ...over };
}

describe('a queue’s record on disk', () => {
  it('lands in .local/queues, beside his plans and his ledger', () => {
    const at = writeQueueRecord(recordOf('q1', '2026-09-15T10:00:00.000Z'), root);
    expect(path.relative(root, at).startsWith(path.join('.local', 'queues'))).toBe(true);
    expect(queueRecordDir(root)).toBe(path.join(root, '.local', 'queues'));
    /* Deliberately not under .local/cache, which evicts. Session 92. */
    expect(at).not.toContain(path.join('.local', 'cache'));
  });

  it('reads back what was written, newest first', () => {
    writeQueueRecord(recordOf('older', '2026-09-14T09:00:00.000Z'), root);
    writeQueueRecord(recordOf('newer', '2026-09-15T10:00:00.000Z'), root);
    expect(listQueueRecords(root).map((r) => r.id)).toEqual(['newer', 'older']);
  });

  /** **Written after every video**: the same queue writes to one file, not many. */
  it('keeps one file per queue however often it is written', () => {
    const record = recordOf('q1', '2026-09-15T10:00:00.000Z');
    writeQueueRecord(record, root);
    writeQueueRecord({ ...record, progress: progressOf({ spentUsd: 2.4 }) }, root);
    writeQueueRecord({ ...record, finishedAt: '2026-09-15T11:00:00.000Z',
      progress: progressOf({ done: true, spentUsd: 3.6 }) }, root);
    expect(readdirSync(queueRecordDir(root)).filter((f) => f.endsWith('.json'))).toHaveLength(1);
    expect(listQueueRecords(root)[0]?.progress.spentUsd).toBe(3.6);
  });

  /** Nothing half-written is ever left where a reader will find it. */
  it('leaves no partial file behind', () => {
    writeQueueRecord(recordOf('q1', '2026-09-15T10:00:00.000Z'), root);
    expect(readdirSync(queueRecordDir(root)).some((f) => f.endsWith('.writing'))).toBe(false);
  });

  /**
   * **One unreadable record must not hide the other forty-nine.** A record of
   * spending that disappears because a neighbour is corrupt is worse than useless.
   */
  it('skips a record it cannot read and returns the rest', () => {
    writeQueueRecord(recordOf('good', '2026-09-15T10:00:00.000Z'), root);
    writeFileSync(path.join(queueRecordDir(root), '2026-bad.json'), '{ not json', 'utf8');
    expect(listQueueRecords(root).map((r) => r.id)).toEqual(['good']);
  });

  it('says nothing at all before any queue has run', () => {
    expect(listQueueRecords(root)).toEqual([]);
    expect(existsSync(queueRecordDir(root))).toBe(false);
  });

  /**
   * **What a restart leaves behind.** The service died mid-queue, so the record
   * still says it was running. Nothing resumes by itself — spending is a thing he
   * presses — but the four videos already paid for are on disk and known.
   */
  it('finds the queue that was still running when the service stopped', () => {
    writeQueueRecord(recordOf('interrupted', '2026-09-15T10:00:00.000Z'), root);
    writeQueueRecord(recordOf('finished', '2026-09-14T10:00:00.000Z', {
      finishedAt: '2026-09-14T11:00:00.000Z',
      progress: progressOf({ done: true }),
    }), root);
    expect(unfinishedQueues(root).map((r) => r.id)).toEqual(['interrupted']);
  });

  /** And what it already paid for is in the record, so a resume need not re-buy. */
  it('keeps what each video cost, so a resume knows what is already bought', () => {
    writeQueueRecord(recordOf('q1', '2026-09-15T10:00:00.000Z'), root);
    const back = listQueueRecords(root)[0];
    expect(back?.progress.items[0]).toMatchObject({ reel: 'one', outcome: 'done', spentUsd: 1.2 });
    expect(back?.progress.items[1]).toMatchObject({ reel: 'two', outcome: 'not-reached' });
  });
});
