import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  canResume,
  listQueueRecords,
  queueRecordDir,
  unfinishedQueues,
  videosToResume,
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

/**
 * **What a resume would run, and what it would leave alone.**
 *
 * Block 14 session 111. Session 110 kept everything a resume needs and had nothing
 * that acted on it; this is the rule that acts on it.
 */
describe('carrying on a queue that did not finish', () => {
  function mixed(): QueueRecord {
    return {
      id: 'q1',
      startedAt: '2026-09-15T10:00:00.000Z',
      finishedAt: null,
      progress: {
        items: [
          { reel: 'paid', modeId: 'c', outcome: 'done', spentUsd: 1.2, attempts: 1,
            startedAt: '2026-09-15T10:00:00.000Z', finishedAt: '2026-09-15T10:26:00.000Z' },
          { reel: 'broke', modeId: 'c', outcome: 'failed', spentUsd: 0, attempts: 2,
            startedAt: '2026-09-15T10:26:00.000Z', finishedAt: '2026-09-15T10:31:00.000Z' },
          { reel: 'held', modeId: 'c', outcome: 'stopped', spentUsd: 0, attempts: 0,
            startedAt: null, finishedAt: null },
          { reel: 'never', modeId: 'c', outcome: 'not-reached', spentUsd: 0, attempts: 0,
            startedAt: null, finishedAt: null },
        ],
        runningIndex: null, spentUsd: 1.2, done: false, stopped: true,
      },
    };
  }

  /** **It picks up where it stopped**, and the record is how it knows. */
  it('runs what never ran, and nothing that did', () => {
    expect(videosToResume(mixed())).toEqual([
      { reel: 'held', modeId: 'c' },
      { reel: 'never', modeId: 'c' },
    ]);
  });

  /** **Nothing paid for is bought again.** The whole point of keeping the record. */
  it('leaves out the video that was paid for', () => {
    expect(videosToResume(mixed()).map((i) => i.reel)).not.toContain('paid');
  });

  /**
   * **A failed video is left to its own control.** It has one press in the summary,
   * bounded by the two attempts the queue respects; sweeping it into a resume would
   * route around that bound.
   */
  it('leaves a failed video to the control that is bounded', () => {
    expect(videosToResume(mixed()).map((i) => i.reel)).not.toContain('broke');
  });

  it('keeps the order the queue had', () => {
    expect(videosToResume(mixed()).map((i) => i.reel)).toEqual(['held', 'never']);
  });

  it('says there is nothing to carry on when every video ran', () => {
    const record = mixed();
    for (const item of record.progress.items) item.outcome = 'done';
    expect(canResume(record)).toBe(false);
    expect(videosToResume(record)).toEqual([]);
  });

  /** Read back off the disk, which is where a resume finds it after a restart. */
  it('answers the same from a record read off the disk', () => {
    writeQueueRecord(mixed(), root);
    const back = listQueueRecords(root)[0];
    expect(back).toBeDefined();
    if (back === undefined) return;
    expect(videosToResume(back).map((i) => i.reel)).toEqual(['held', 'never']);
    expect(unfinishedQueues(root).map((r) => r.id)).toEqual(['q1']);
  });
});

/**
 * **The disk that will not take it.** Block 14 session 111.
 *
 * Made to fail for real rather than simulated: the directory is replaced by a
 * *file*, so `mkdirSync` cannot create it and the write genuinely throws — which is
 * what an unmounted drive does to this code path.
 */
describe('when the record cannot be written', () => {
  it('throws, rather than reporting a success it did not have', () => {
    const blocked = mkdtempSync(path.join(tmpdir(), 'framopia-blocked-'));
    mkdirSync(path.join(blocked, '.local'), { recursive: true });
    /* A file where the directory needs to be: mkdir -p cannot get past it. */
    writeFileSync(path.join(blocked, '.local', 'queues'), 'not a directory', 'utf8');
    expect(() =>
      writeQueueRecord(
        { id: 'q1', startedAt: '2026-09-15T10:00:00.000Z', finishedAt: null,
          progress: { items: [], runningIndex: null, spentUsd: 0, done: false, stopped: false } },
        blocked,
      ),
    ).toThrow();
    rmSync(blocked, { recursive: true, force: true });
  });
});
