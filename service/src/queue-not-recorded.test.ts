import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * **The drive going away mid-queue, made to happen rather than simulated.**
 *
 * Block 14 session 111. Session 110 measured the consequence of making the record
 * write non-fatal and reported it honestly: *the queue keeps spending and stops
 * recording silently.* The trade was right — a disk problem must not kill work
 * being paid for — and the silence was not.
 *
 * The failure here is real: `.local/queues` is replaced by a **file**, so `mkdir`
 * cannot create the directory and the write throws exactly as it does when the
 * volume is gone. Nothing is stubbed to reject.
 */
let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'framopia-noqueues-'));
  mkdirSync(path.join(root, '.local'), { recursive: true });
  writeFileSync(path.join(root, '.local', 'queues'), 'not a directory', 'utf8');
  vi.resetModules();
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.resetModules();
  vi.doUnmock('@framopia/core');
});

describe('a queue whose record cannot be written', () => {
  it('keeps running, and says what has been spent since it stopped recording', async () => {
    /* REPO_ROOT is where the record module writes; point it at the blocked root. */
    const core = await vi.importActual<typeof import('@framopia/core')>('@framopia/core');
    vi.doMock('@framopia/core', () => ({ ...core, REPO_ROOT: root }));

    const { runQueue } = await import('./queue.js');
    const { writeQueueRecord } = await import('./queue-record.js');

    /*
     * The same shape the job runner has: write after every video, keep going if
     * the write throws, and carry what was spent since the last one that worked.
     */
    let notRecorded: { spentUsd: number; why: string } | null = null;
    let lastRecordedSpendUsd = 0;
    const seen: (typeof notRecorded)[] = [];

    const done = await runQueue({
      items: [
        { reel: 'one', modeId: 'c' },
        { reel: 'two', modeId: 'c' },
      ],
      runOne: async () => ({ spentUsd: 1.25 }),
      onProgress: (progress) => {
        try {
          writeQueueRecord(
            { id: 'q1', startedAt: '2026-09-15T10:00:00.000Z', finishedAt: null, progress },
            root,
          );
          notRecorded = null;
          lastRecordedSpendUsd = progress.spentUsd;
        } catch (error) {
          notRecorded = {
            spentUsd: progress.spentUsd - lastRecordedSpendUsd,
            why: error instanceof Error ? error.message : String(error),
          };
        }
        seen.push(notRecorded);
      },
    });

    /* **It keeps working.** Both videos ran and both were paid for. */
    expect(done.items.map((i) => i.outcome)).toEqual(['done', 'done']);
    expect(done.spentUsd).toBeCloseTo(2.5, 6);

    /* **It stops being silent.** Every report after the first failure carries it. */
    expect(seen.filter((s) => s !== null).length).toBeGreaterThan(0);
    const last = seen[seen.length - 1];
    expect(last).not.toBeNull();
    /* **And the money is not lost**: what was spent since the last good write. */
    expect(last?.spentUsd).toBeCloseTo(2.5, 6);
    expect(String(last?.why)).toMatch(/ENOTDIR|EEXIST|ENOENT|not a directory/i);
  });
});
