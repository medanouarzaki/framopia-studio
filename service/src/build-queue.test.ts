import { describe, expect, it, vi } from 'vitest';
import {
  runBuildQueue,
  stopBuildQueue,
  buildQueueWasStopped,
  BUILD_QUEUE_JOB_TYPE,
  type BuildQueueItem,
} from './build-queue.js';

/**
 * **Building them all, proved without driving After Effects.**
 *
 * `buildOne` is injected for the same reason the run queue injects `runOne`: the
 * boundary this file owns is the ordering and what it does with a failure, and a
 * real build would drive Mohamed's own running instance.
 */
function list(n: number): BuildQueueItem[] {
  return Array.from({ length: n }, (_, i) => ({
    reel: `reel-${String(i + 1)}`,
    planPath: `/plans/reel-${String(i + 1)}.json`,
    modeId: 'dr-loubna-kfafi',
  }));
}

describe('building every finished video in one press', () => {
  it('builds them one after another, in the order they were listed', async () => {
    const order: string[] = [];
    const done = await runBuildQueue({
      items: list(5),
      buildOne: async (item) => {
        order.push(item.reel);
        return { savePath: `/out/${item.reel}.aep` };
      },
    });
    expect(order).toEqual(['reel-1', 'reel-2', 'reel-3', 'reel-4', 'reel-5']);
    expect(done.items.every((i) => i.outcome === 'built')).toBe(true);
    expect(done.items.map((i) => i.savePath)).toEqual([
      '/out/reel-1.aep', '/out/reel-2.aep', '/out/reel-3.aep',
      '/out/reel-4.aep', '/out/reel-5.aep',
    ]);
  });

  /**
   * **A build that fails does not stop the rest** — session 94's rule for runs,
   * which has to hold here too or one bad plan in ten costs him the other nine.
   */
  it('carries a failure through and builds everything after it', async () => {
    const built: string[] = [];
    const done = await runBuildQueue({
      items: list(5),
      buildOne: async (item) => {
        if (item.reel === 'reel-2') throw new Error('there is no Edit Plan at /plans/reel-2.json');
        built.push(item.reel);
        return { savePath: `/out/${item.reel}.aep` };
      },
    });
    expect(built).toEqual(['reel-1', 'reel-3', 'reel-4', 'reel-5']);
    expect(done.items.map((i) => i.outcome)).toEqual([
      'built', 'failed', 'built', 'built', 'built',
    ]);
    expect(done.items[1]?.error).toBe('there is no Edit Plan at /plans/reel-2.json');
    expect(done.done).toBe(true);
  });

  /** After Effects runs one script at a time, so two may never be in flight. */
  it('never has two builds running at once', async () => {
    let inFlight = 0;
    let most = 0;
    await runBuildQueue({
      items: list(4),
      buildOne: async (item) => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((go) => setTimeout(go, 5));
        inFlight -= 1;
        return { savePath: `/out/${item.reel}.aep` };
      },
    });
    expect(most).toBe(1);
  });

  it('says which one it is building and how far it has got', async () => {
    const seen: string[] = [];
    await runBuildQueue({
      items: list(3),
      buildOne: async (item, onPercent) => {
        onPercent(0.5);
        return { savePath: `/out/${item.reel}.aep` };
      },
      onProgress: (p) => {
        if (p.buildingIndex !== null) {
          seen.push(`${String(p.buildingIndex)}@${String(p.buildingPercent ?? 0)}`);
        }
      },
    });
    expect(seen).toContain('0@0');
    expect(seen).toContain('0@0.5');
    expect(seen).toContain('2@0.5');
  });

  it('stops after the one in hand, and marks the rest stopped', async () => {
    const built: string[] = [];
    let after = 0;
    const done = await runBuildQueue({
      items: list(4),
      shouldStop: () => after >= 2,
      buildOne: async (item) => {
        built.push(item.reel);
        after += 1;
        return { savePath: `/out/${item.reel}.aep` };
      },
    });
    expect(built).toEqual(['reel-1', 'reel-2']);
    expect(done.stopped).toBe(true);
    expect(done.items.map((i) => i.outcome)).toEqual(['built', 'built', 'stopped', 'stopped']);
  });

  it('refuses an empty list rather than reporting an empty success', async () => {
    await expect(runBuildQueue({ items: [], buildOne: vi.fn() })).rejects.toThrow(
      /needs at least one video/,
    );
  });

  it('is a job type of its own, and its stop flag is its own', () => {
    expect(BUILD_QUEUE_JOB_TYPE).toBe('build-queue');
    expect(buildQueueWasStopped('never-asked')).toBe(false);
    stopBuildQueue('asked-for');
    expect(buildQueueWasStopped('asked-for')).toBe(true);
  });
});
