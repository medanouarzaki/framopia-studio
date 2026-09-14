import { describe, expect, it, vi } from 'vitest';
import {
  QUEUE_ATTEMPTS,
  QUEUE_STAGE_IDS,
  queueEstimateUsd,
  queueSummary,
  runQueue,
  type QueueItem,
} from './queue.js';

const item = (reel: string): QueueItem => ({ reel, modeId: 'a-client' });

/** A clock that never repeats, so started/finished are checkable. */
function clock(): () => string {
  let n = 0;
  return () => `2026-09-13T00:00:${String(n++).padStart(2, '0')}.000Z`;
}

describe('what the queue runs', () => {
  /*
   * His ruling: the queue runs the picture ideas and the pictures for every
   * video, and he builds the compositions himself.
   */
  it('runs everything that costs money and takes time', () => {
    expect(QUEUE_STAGE_IDS).toEqual(['transcription', 'analysis', 'images', 'zones']);
  });

  it('does not build', () => {
    expect(QUEUE_STAGE_IDS).not.toContain('build');
  });
});

describe('a queue of videos', () => {
  it('runs them one at a time, in order', async () => {
    const order: string[] = [];
    let running = 0;
    await runQueue({
      items: [item('one'), item('two'), item('three')],
      now: clock(),
      runOne: async (it) => {
        running += 1;
        expect(running).toBe(1);
        order.push(it.reel);
        await new Promise((r) => setTimeout(r, 1));
        running -= 1;
        return { spentUsd: 1 };
      },
    });
    expect(order).toEqual(['one', 'two', 'three']);
  });

  it('adds up what the whole list spent', async () => {
    const out = await runQueue({
      items: [item('one'), item('two')],
      now: clock(),
      runOne: async () => ({ spentUsd: 2.5 }),
    });
    expect(out.spentUsd).toBe(5);
    expect(out.items.map((i) => i.spentUsd)).toEqual([2.5, 2.5]);
    expect(out.done).toBe(true);
  });

  it('quotes the whole list before it starts', () => {
    expect(queueEstimateUsd([2.19, 2.81, 2.56])).toBeCloseTo(7.56, 10);
    expect(queueEstimateUsd([])).toBe(0);
  });
});

/**
 * **Block 12 session 91: a stage failed while the run reported `done`.** A queue
 * that did the same would hand back five videos claiming success with nothing
 * behind them, which is worse, because nobody was watching.
 */
describe('a video that fails', () => {
  const boom = (reel: string) =>
    vi.fn(async (it: QueueItem) => {
      if (it.reel === reel) throw new Error('ENOENT: no such file or directory, open nowhere');
      return { spentUsd: 1 };
    });

  it('does not stop the queue', async () => {
    const runOne = boom('two');
    const out = await runQueue({
      items: [item('one'), item('two'), item('three')],
      now: clock(),
      runOne,
    });
    expect(out.items.map((i) => i.outcome)).toEqual(['done', 'failed', 'done']);
    expect(runOne).toHaveBeenCalledTimes(3);
  });

  it('is reported as failed, and never as done', async () => {
    const out = await runQueue({
      items: [item('one')],
      now: clock(),
      runOne: boom('one'),
    });
    expect(out.items[0]?.outcome).toBe('failed');
    expect(out.items[0]?.outcome).not.toBe('done');
    expect(out.done).toBe(true);
  });

  it('records the stage and the cause, verbatim', async () => {
    const out = await runQueue({
      items: [item('one')],
      now: clock(),
      runOne: boom('one'),
    });
    expect(out.items[0]?.error?.cause).toBe('ENOENT: no such file or directory, open nowhere');
    expect(out.items[0]?.error?.stage).toBe('images');
  });

  it('keeps what the videos before it spent', async () => {
    const out = await runQueue({
      items: [item('one'), item('two')],
      now: clock(),
      runOne: boom('two'),
    });
    expect(out.spentUsd).toBe(1);
  });
});

/**
 * `sora-4` hit `fetch failed` on 2026-09-12: the network, not the tool.
 */
describe('a network error', () => {
  it('is tried again, and bounded', async () => {
    let calls = 0;
    const out = await runQueue({
      items: [item('one')],
      now: clock(),
      runOne: async () => {
        calls += 1;
        throw new Error('fetch failed');
      },
    });
    expect(calls).toBe(QUEUE_ATTEMPTS);
    expect(QUEUE_ATTEMPTS).toBe(2);
    expect(out.items[0]?.attempts).toBe(2);
    expect(out.items[0]?.outcome).toBe('failed');
  });

  it('succeeds on the second attempt when the network comes back', async () => {
    let calls = 0;
    const out = await runQueue({
      items: [item('one')],
      now: clock(),
      runOne: async () => {
        calls += 1;
        if (calls === 1) throw new Error('fetch failed');
        return { spentUsd: 2 };
      },
    });
    expect(out.items[0]?.outcome).toBe('done');
    expect(out.items[0]?.attempts).toBe(2);
    expect(out.items[0]?.error).toBeUndefined();
    expect(out.spentUsd).toBe(2);
  });

  /* A refusal repeated is a refusal twice, and a missing file is still missing. */
  it('is not tried again when repeating it cannot help', async () => {
    for (const cause of ['ENOENT: no such file', 'the ceiling would be crossed']) {
      let calls = 0;
      await runQueue({
        items: [item('one')],
        now: clock(),
        runOne: async () => {
          calls += 1;
          throw new Error(cause);
        },
      });
      expect(`${cause}: ${calls}`).toBe(`${cause}: 1`);
    }
  });
});

describe('stopping the queue', () => {
  it('stops at the next video, and keeps what has been paid for', async () => {
    let stop = false;
    const out = await runQueue({
      items: [item('one'), item('two'), item('three')],
      now: clock(),
      shouldStop: () => stop,
      runOne: async () => {
        stop = true;
        return { spentUsd: 3 };
      },
    });
    expect(out.items.map((i) => i.outcome)).toEqual(['done', 'stopped', 'not-reached']);
    expect(out.spentUsd).toBe(3);
    expect(out.stopped).toBe(true);
  });

  /* A video already running is finished rather than abandoned mid-stage. */
  it('does not abandon the video it is holding', async () => {
    let stop = false;
    let finished = false;
    const out = await runQueue({
      items: [item('one'), item('two')],
      now: clock(),
      shouldStop: () => stop,
      runOne: async () => {
        stop = true;
        await new Promise((r) => setTimeout(r, 1));
        finished = true;
        return { spentUsd: 1 };
      },
    });
    expect(finished).toBe(true);
    expect(out.items[0]?.outcome).toBe('done');
  });

  it('stops before spending anything when stopped at once', async () => {
    const runOne = vi.fn(async () => ({ spentUsd: 5 }));
    const out = await runQueue({
      items: [item('one'), item('two')],
      now: clock(),
      shouldStop: () => true,
      runOne,
    });
    expect(runOne).not.toHaveBeenCalled();
    expect(out.spentUsd).toBe(0);
    expect(out.items.map((i) => i.outcome)).toEqual(['stopped', 'not-reached']);
  });
});

describe('what the queue reports while it runs', () => {
  it('says which video is running, and stops saying so at the end', async () => {
    const seen: (number | null)[] = [];
    const out = await runQueue({
      items: [item('one'), item('two')],
      now: clock(),
      onProgress: (p) => seen.push(p.runningIndex),
      runOne: async () => ({ spentUsd: 1 }),
    });
    expect(seen).toContain(0);
    expect(seen).toContain(1);
    expect(out.runningIndex).toBeNull();
    expect(out.done).toBe(true);
  });

  it('reports the running total as it goes, not only at the end', async () => {
    const totals: number[] = [];
    await runQueue({
      items: [item('one'), item('two')],
      now: clock(),
      onProgress: (p) => totals.push(p.spentUsd),
      runOne: async () => ({ spentUsd: 2 }),
    });
    expect(totals).toContain(2);
    expect(totals[totals.length - 1]).toBe(4);
  });

  it('times every video it reached', async () => {
    const out = await runQueue({
      items: [item('one')],
      now: clock(),
      runOne: async () => ({ spentUsd: 1 }),
    });
    expect(out.items[0]?.startedAt).not.toBeNull();
    expect(out.items[0]?.finishedAt).not.toBeNull();
  });
});

/**
 * **He comes back to a finished queue**, two hours later, with the money already
 * spent. Three questions, at a glance: what is ready, what failed and what he
 * would do about it, and what it cost.
 */
describe('what he comes back to', () => {
  const ran = async (runOne: Parameters<typeof runQueue>[0]['runOne']) =>
    queueSummary(
      await runQueue({ items: [item('one'), item('two')], now: clock(), runOne }),
    );

  it('says how many are ready to build, and what it cost', async () => {
    const s = await ran(async () => ({ spentUsd: 2.5 }));
    expect(s.headline).toBe('2 videos are ready to build.');
    expect(s.spentSaid).toBe('It cost $5.00 altogether.');
    expect(s.lines.map((l) => l.said)).toEqual(['Ready to build.', 'Ready to build.']);
    expect(s.lines.every((l) => !l.needsHim)).toBe(true);
  });

  it('counts one video as one video', async () => {
    const s = queueSummary(
      await runQueue({ items: [item('one')], now: clock(), runOne: async () => ({ spentUsd: 1 }) }),
    );
    expect(s.headline).toBe('1 video is ready to build.');
  });

  it('says which failed and marks it as needing him', async () => {
    const s = await ran(async (it) => {
      if (it.reel === 'two') throw new Error('ENOENT: no such file');
      return { spentUsd: 1 };
    });
    expect(s.headline).toBe('1 video is ready to build. 1 did not finish.');
    expect(s.lines[1]?.needsHim).toBe(true);
    expect(s.lines[0]?.needsHim).toBe(false);
  });

  /* The network coming back and a refusal are different problems. */
  it('tells him a connection failure is worth trying again, and a refusal is not', async () => {
    const net = await ran(async () => {
      throw new Error('fetch failed');
    });
    expect(net.lines[0]?.said).toContain('the connection failed');
    expect(net.lines[0]?.said).toContain('Add it to a queue again when you are back online');

    const hard = await ran(async () => {
      throw new Error('ENOENT: no such file');
    });
    expect(hard.lines[0]?.said).toContain('trying it again would fail the same way');
  });

  /**
   * **This asked for the stage error verbatim, and session 101 took it off.**
   *
   * It was written in session 94 so he could say what happened, and what it
   * actually produced was *"It said: re-generating would discard editor work on 8
   * slot(s): img002 (a candidate was chosen (img002-c2)); …"* — the message
   * sessions 98 and 100 both named and neither could reach. The refusal is
   * unchanged; only what he reads about it.
   */
  it('says why it stopped in his words, and never quotes the stage error', async () => {
    const s = await ran(async () => {
      throw new Error('the model returned 503 Service Unavailable');
    });
    expect(s.lines[0]?.said).not.toContain('503');
    expect(s.lines[0]?.said).toContain('the connection failed');
  });

  /* The one he actually hit: a video he had already chosen pictures for. */
  it('says plainly when his own choices are what stopped it', async () => {
    const s = await ran(async () => {
      throw new Error(
        're-generating would discard editor work on 8 slot(s): img002 (a candidate was ' +
          'chosen (img002-c2)); img003 (a candidate was chosen (img003-c2))',
      );
    });
    const said = s.lines[0]?.said ?? '';
    expect(said).toContain('You have already chosen pictures for this one');
    expect(said).not.toContain('img002');
    expect(said).not.toContain('slot(s)');
  });

  it('never puts the stage error in front of him, whatever it is', async () => {
    for (const cause of [
      'ENOENT: no such file or directory, open /x/y',
      'there is no video called "sora-9" any more',
      'the ceiling would be crossed',
      'TypeError: cannot read properties of undefined',
    ]) {
      const s = await ran(async () => {
        throw new Error(cause);
      });
      expect(`${cause.slice(0, 18)}: ${(s.lines[0]?.said ?? '').includes(cause)}`).toBe(
        `${cause.slice(0, 18)}: false`,
      );
    }
  });

  it('says plainly when a video was never started', async () => {
    const out = await runQueue({
      items: [item('one'), item('two')],
      now: clock(),
      shouldStop: () => true,
      runOne: async () => ({ spentUsd: 0 }),
    });
    const s = queueSummary(out);
    expect(s.headline).toContain('Nothing is ready to build.');
    expect(s.lines[0]?.said).toContain('you stopped the queue here');
    expect(s.spentSaid).toBe('Nothing was spent.');
  });

  /* Session 91 found eleven messages that sent him out of the panel. */
  it('names no command and sends him nowhere', async () => {
    const all = [
      await ran(async () => ({ spentUsd: 1 })),
      await ran(async () => {
        throw new Error('fetch failed');
      }),
      await ran(async () => {
        throw new Error('ENOENT: no such file');
      }),
    ]
      .flatMap((s) => [s.headline, s.spentSaid, ...s.lines.map((l) => l.said)])
      .join(' ');
    expect(all).not.toMatch(/npm run|terminal|quit|restart|reopen|relaunch/i);
  });
});
