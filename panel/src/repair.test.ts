import { describe, expect, it, vi } from 'vitest';

import { MAX_REPAIR_ATTEMPTS, repairService, type PanelHost } from './service.js';

/*
 * The service the panel talks to is an HTTP endpoint, so these stop at the
 * decision and the sequence: which repair was chosen, whether the old process
 * was stopped before a new one started, and what the user is told afterwards.
 * That the repair really works end to end was measured against a live service
 * rather than asserted here — session 26's report carries the run.
 */
function host(over: Partial<PanelHost> = {}): PanelHost {
  return {
    readHandshake: () => null,
    processAlive: () => false,
    spawnService: () => Promise.resolve({ ok: false, cause: 'no service in a unit test' }),
    resolveNode: () => ({ path: '/n/node', source: 'nvm' }),
    ...over,
  };
}

const PANEL = 'abc1234567+aaaa';

describe('repairService', () => {
  it('rebuilds when the compiled service is behind, then starts it', async () => {
    const order: string[] = [];
    const h = host({
      serviceDistStamp: () => 'abc1234567+bbbb',
      rebuildService: async () => {
        order.push('rebuild');
        return { ok: true, cause: null };
      },
      stopService: (pid) => {
        order.push(`stop:${pid}`);
        return true;
      },
      /*
       * Fails deliberately: a unit test has no service to reach, and what is
       * under test is the order, not the reconnection. The live proof is in
       * session 26's report.
       */
      spawnService: async () => {
        order.push('spawn');
        return { ok: false, cause: 'no service in a unit test' };
      },
    });

    const out = await repairService(h, 42, PANEL);

    expect(out.action).toBe('rebuild');
    // Rebuild, then stop, then start: --force takes the lock without stopping
    // the old process, which is how two services once ran at once.
    expect(order).toEqual(['rebuild', 'stop:42', 'spawn']);
  });

  it('only restarts when the compiled service already matches', async () => {
    const rebuild = vi.fn();
    const h = host({
      serviceDistStamp: () => 'zzz9999999+aaaa',
      rebuildService: async () => {
        rebuild();
        return { ok: true, cause: null };
      },
      stopService: () => true,
    });

    const out = await repairService(h, 7, PANEL);

    expect(out.action).toBe('restart');
    expect(rebuild).not.toHaveBeenCalled();
  });

  it('changes nothing when the two cannot be compared', async () => {
    const stop = vi.fn(() => true);
    const h = host({ serviceDistStamp: () => null, stopService: stop });

    const out = await repairService(h, 7, PANEL);

    expect(out.action).toBe('unknown');
    expect(out.ok).toBe(false);
    expect(stop).not.toHaveBeenCalled();
  });

  it('says what happened, and never a command to type', async () => {
    const h = host({ serviceDistStamp: () => 'abc1234567+bbbb', stopService: () => true });
    const out = await repairService(h, 1, PANEL);
    expect(out.said).not.toContain('npm run');
    expect(out.said).not.toContain('terminal');
  });

  it('reports a rebuild it could not do, in words, without a command', async () => {
    const h = host({
      serviceDistStamp: () => 'abc1234567+bbbb',
      rebuildService: async () => ({ ok: false, cause: 'compiling the service failed' }),
      stopService: () => true,
    });

    const out = await repairService(h, 1, PANEL);

    expect(out.ok).toBe(false);
    expect(out.said).toContain('could not be prepared again');
    expect(out.said).not.toContain('npm run');
  });

  it('is bounded, so a panel cannot restart a service in a loop', () => {
    expect(MAX_REPAIR_ATTEMPTS).toBe(1);
  });
});
