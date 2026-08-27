// @vitest-environment happy-dom
import { act } from 'react';

// React's own flag for "act() is legal here". Without it every act() call
// warns; it is configuration, not suppression.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { cepNodeAvailable, detectHost } from './host.js';
import { runGate } from './run-gate.js';
import { formatUsd, SPEND_SOFT_ALARM_USD, spendLevel } from './spend.js';
import { setClockForTests, type PanelHost } from './service.js';
import type { ClientMode, HealthPayload, HostEnvironment, Reel } from './types.js';

const good = (detail: string) => ({ present: true, detail });

const healthy: HealthPayload = {
  ok: true,
  serviceVersion: '0.1.0',
  appVersion: '0.1.0',
  promptVersion: 4,
  ffmpeg: good('ffmpeg version 8.0.1'),
  ffprobe: good('ffprobe version 8.0.1'),
  sidecar: { venv: good('Python 3.11.14'), pythonPath: '/repo/tools/cv/.venv/bin/python' },
  templates: { valid: true, issues: [], count: 6 },
  repoRoot: '/repo',
  node: { path: '/n/node', source: 'nvm' },
};

const reels: Reel[] = [
  { label: 'vitasilk', videoPath: '/v/vitasilk.mov', planPath: '/v/vitasilk.editplan.json', durationS: 25.692333, spentUsd: 1.550444 },
  { label: 'test-1', videoPath: '/v/test 1.mov', planPath: null, durationS: 21.988646, spentUsd: null },
];

const modes: ClientMode[] = [{ id: 'k2-syndicalia', name: 'K2 Syndicalia', version: 6, fontsResolved: false }];

let container: HTMLDivElement;
let root: Root;

function hostThatAnswers(over: Partial<PanelHost> = {}): PanelHost {
  return {
    readHandshake: () => ({ port: 51234, token: 'tok', pid: 1 }),
    processAlive: () => true,
    spawnService: () => Promise.resolve({ ok: true, nodePath: '/n/node', source: 'nvm' }),
    resolveNode: () => ({ path: '/n/node', source: 'nvm' }),
    ...over,
  };
}

type AvailableEnv = Extract<HostEnvironment, { available: true }>;

function envFor(host: PanelHost, over: Partial<AvailableEnv> = {}): AvailableEnv {
  return {
    available: true,
    repo: '/repo',
    rootSource: 'window.location',
    host,
    logoSrc: null,
    ...over,
  };
}

async function render(host: PanelHost, over: Partial<AvailableEnv> = {}): Promise<void> {
  await act(async () => {
    root.render(<App detect={() => envFor(host, over)} />);
  });
}

async function renderEnv(env: HostEnvironment): Promise<void> {
  await act(async () => {
    root.render(<App detect={() => env} />);
  });
}

/**
 * The service, as the panel sees it: health, the two catalogues and the dry
 * run, routed by URL. The pickers come over HTTP now, so a fetch that answers
 * only /health would leave them empty and every picker test would pass for the
 * wrong reason.
 */
function serviceFetch(
  over: { health?: HealthPayload; reels?: Reel[]; modes?: ClientMode[] } = {},
): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation((url: string) => {
    const body = url.includes('/health')
      ? (over.health ?? healthy)
      : url.includes('/reels')
        ? { reels: over.reels ?? reels }
        : url.includes('/modes')
          ? { modes: over.modes ?? modes }
          : { reel: 'vitasilk', stages: [], estimateUsd: 0 };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
}

const text = (): string => container.textContent ?? '';
const runButton = (): HTMLButtonElement =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === 'Run pipeline') as HTMLButtonElement;
const select = (label: string): HTMLSelectElement =>
  container.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('service state', () => {
  it('shows healthy with the payload read as words, not raw JSON', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render(hostThatAnswers());

    expect(text()).toContain('Ready');
    expect(text()).toContain('correction prompt v4');
    expect(text()).toContain('ffmpeg version 8.0.1');
    expect(text()).toContain('Python 3.11.14');
    expect(text()).toContain('6 valid');
    expect(text()).not.toContain('{');
  });

  it('shows unreachable with the service’s own cause, stage and retryability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));
    await render(hostThatAnswers());

    expect(text()).toContain('Not reachable');
    expect(text()).toContain('connect ECONNREFUSED');
    expect(text()).toContain('service-connect');
    expect(text()).toContain('yes');
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === 'Retry')).toBe(true);
  });

  it('shows starting while the health call is in flight', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
    await render(hostThatAnswers());

    expect(text()).toContain('Starting');
    expect(text()).toContain('Looking for the companion service');
  });

  it('reports problems without claiming the machine is ready', async () => {
    const broken: HealthPayload = {
      ...healthy,
      ok: false,
      ffmpeg: { present: false, detail: 'not found' },
      templates: { valid: false, issues: ['sub_pop: comp missing'], count: 0 },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => broken }));
    await render(hostThatAnswers());

    expect(text()).toContain('Running, with problems');
    expect(text()).toContain('missing');
    expect(text()).toContain('sub_pop: comp missing');
  });
});

describe('the pickers', () => {
  it('populates reels and modes from the fixtures', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render(hostThatAnswers());

    expect([...select('Reel').options].map((o) => o.textContent)).toEqual([
      'Select a video…',
      'vitasilk — 25.7s',
      'test-1 — 22.0s',
    ]);
    expect([...select('Client mode').options].map((o) => o.textContent)).toEqual([
      'Select a client…',
      'K2 Syndicalia — v6',
    ]);
  });

  it('says so rather than showing an empty dropdown when nothing is found', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    vi.stubGlobal('fetch', serviceFetch({ reels: [], modes: [] }));
    await render(hostThatAnswers());

    expect(text()).toContain('No reels found on this machine');
    expect(text()).toContain('No modes in modes/');
    expect(select('Reel').disabled).toBe(true);
  });

  it('shows the reel’s cumulative spend once one is picked', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render(hostThatAnswers());

    expect(text()).not.toContain('spent on this reel');
    await act(async () => {
      select('Reel').value = 'vitasilk';
      select('Reel').dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(text()).toContain('$1.5504');
    expect(text()).toContain('spent on this reel so far');
    expect(text()).toContain('soft alarm $2.00');
  });

  it('says a reel has no plan rather than showing $0', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render(hostThatAnswers());
    await act(async () => {
      select('Reel').value = 'test-1';
      select('Reel').dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(text()).toContain('not run yet');
    expect(text()).toContain('No edit plan yet');
  });
});

describe('the Run control', () => {
  it('is disabled and says why while the service is starting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
    await render(hostThatAnswers());

    expect(runButton().disabled).toBe(true);
    expect(text()).toContain('Waiting for the companion service to answer.');
  });

  it('asks for a video before anything else once the service is up', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render(hostThatAnswers());

    expect(runButton().disabled).toBe(true);
    expect(text()).toContain('Pick a video.');
  });

  it('asks for a mode once a video is picked', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render(hostThatAnswers());
    await act(async () => {
      select('Reel').value = 'vitasilk';
      select('Reel').dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(text()).toContain('Pick a client mode.');
  });
});

/*
 * The gate is asserted directly as well as through the DOM: the reason strings
 * are the contract, and a change to one should fail here rather than inside a
 * render.
 */
describe('runGate', () => {
  const base = { reel: reels[0] as Reel, mode: modes[0] as ClientMode };

  it('names the missing tools when the machine is not ready', () => {
    const gate = runGate({
      ...base,
      service: {
        kind: 'healthy',
        health: { ...healthy, ok: false, ffmpeg: { present: false, detail: 'x' }, templates: { valid: false, issues: [], count: 0 } },
      },
    });
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toBe('This machine is missing ffmpeg and a valid template manifest.');
  });

  it('refuses a mode whose fonts are still tbd', () => {
    const gate = runGate({ ...base, service: { kind: 'healthy', health: healthy } });
    expect(gate.reason).toContain('has no fonts yet');
  });

  /*
   * Honest about the real blocker: with everything else satisfied, Run is off
   * because the runner does not exist. A button that looked ready and did
   * nothing would be worse.
   */
  it('says the runner is not built when nothing else is wrong', () => {
    const gate = runGate({
      reel: reels[0] as Reel,
      mode: { ...(modes[0] as ClientMode), fontsResolved: true },
      service: { kind: 'healthy', health: healthy },
    });
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toBe('The pipeline runner is not built yet.');
  });
});

describe('spend', () => {
  it('reads null as unspent rather than zero', () => {
    expect(spendLevel(null)).toBe('none');
    expect(formatUsd(null)).toBe('not run yet');
  });

  it('raises the soft alarm at the envelope, not above it', () => {
    expect(spendLevel(SPEND_SOFT_ALARM_USD - 0.0001)).toBe('normal');
    expect(spendLevel(SPEND_SOFT_ALARM_USD)).toBe('alarm');
  });

  it('is not triggerable by anything on this machine today', () => {
    expect(spendLevel(1.550444)).toBe('normal');
  });
});

/**
 * The regression this suite missed. happy-dom never provides `cep_node`, so
 * before this session the throwing branch was the only one ever taken and it
 * passed by being universal — while inside After Effects the same branch threw
 * at module load and the user got a blank panel.
 *
 * The fix is only meaningful if all three shapes are exercised: present,
 * absent, and present-but-unusable.
 */
describe('host detection', () => {
  const cepGlobal = globalThis as { cep_node?: unknown; CSInterface?: unknown };

  afterEach(() => {
    delete cepGlobal.cep_node;
    delete cepGlobal.CSInterface;
  });

  const fakePath = {
    resolve: (...p: string[]) => p.slice(0, -1).join('/') || '/repo',
    join: (...p: string[]) => p.join('/'),
  };
  const fakeSpawn = { spawn: () => ({ unref: () => undefined, on: () => undefined, stderr: null }) };
  const fakeOs = { homedir: () => '/home' };

  /*
   * A filesystem that really contains the repository: the resolver verifies a
   * candidate against package.json's name and the marker directories, so a
   * stub that answers false to everything cannot produce a root.
   */
  function repoFs(root = '/repo'): Record<string, unknown> {
    const present = new Set([
      `${root}/package.json`,
      `${root}/service`,
      `${root}/modes`,
      `${root}/core`,
    ]);
    return {
      existsSync: (p: string) => present.has(p),
      readFileSync: (p: string) =>
        p === `${root}/package.json` ? JSON.stringify({ name: 'framopia-studio' }) : '{}',
      readdirSync: () => [],
      realpathSync: (p: string) => p,
    };
  }

  function fakeCepNode(modules: Record<string, unknown>): void {
    cepGlobal.cep_node = {
      require: (id: string) => {
        const mod = modules[id];
        if (mod === undefined) throw new Error(`fake cep_node has no module "${id}"`);
        return mod;
      },
      global: {},
    };
  }

  it('reports cep_node as available when it is', () => {
    fakeCepNode({ path: { resolve: () => '/repo', join: (...p: string[]) => p.join('/') } });
    expect(cepNodeAvailable()).toBe(true);
  });

  it('reports it as unavailable when it is not, without throwing', () => {
    expect(cepNodeAvailable()).toBe(false);
    expect(() => detectHost()).not.toThrow();
  });

  it('mounts and names the missing capability when cep_node is absent', async () => {
    const env = detectHost();
    expect(env.available).toBe(false);
    await renderEnv(env);

    expect(text()).toContain('Framopia');
    expect(text()).toContain('cep_node');
    expect(text()).toContain('--enable-nodejs');
    expect(text()).toContain('--mixed-context');
    expect(text()).toContain('restarted');
    expect(text()).toContain('reel list');
  });

  /*
   * The dangerous middle case: Node is there but something under it is not.
   * Reporting "you are not running inside After Effects" to a user who plainly
   * is would send him looking in the wrong place entirely.
   */
  it('mounts and distinguishes a malformed host from a missing one', async () => {
    fakeCepNode({});
    const env = detectHost();

    expect(env.available).toBe(false);
    expect(env.available === false && env.missing).toBe('the repository');
    expect(env.available === false && env.cause).toContain('Node is available');

    await renderEnv(env);
    expect(text()).toContain('the repository');
    expect(text()).not.toContain('--enable-nodejs');
  });

  it('resolves a working host into a mountable environment', async () => {
    fakeCepNode({ path: fakePath, fs: repoFs(), child_process: fakeSpawn, os: fakeOs });
    cepGlobal.CSInterface = class {
      getSystemPath(): string {
        return '/repo/panel';
      }
    };

    const env = detectHost();
    expect(env.available).toBe(true);

    vi.stubGlobal('fetch', serviceFetch());
    await renderEnv(env);

    // It mounted the real screen, not the unavailable one.
    expect(text()).toContain('Service');
    expect(text()).toContain('Video');
    expect(text()).not.toContain('is not providing');
  });

  it('never throws for any shape of the global, including a hostile one', () => {
    for (const value of [undefined, null, 0, '', {}, { require: 'not a function' }]) {
      cepGlobal.cep_node = value;
      expect(() => detectHost()).not.toThrow();
    }
  });
});

/**
 * The spawn, which reported success it had never checked: it said "one has
 * been started. Retry in a moment." while `spawn npm` had already failed with
 * ENOENT. Nothing may assert a state it has not verified.
 */
describe('starting the service', () => {
  const noService: PanelHost = {
    readHandshake: () => null,
    processAlive: () => false,
    spawnService: () => Promise.resolve({ ok: true, nodePath: '/n/node', source: 'nvm' }),
    resolveNode: () => ({ path: '/n/node', source: 'nvm' }),
  };

  beforeEach(() => {
    // A clock the test drives, so a twelve-second timeout costs no time.
    let t = 0;
    setClockForTests({
      now: () => t,
      sleep: (ms: number) => {
        t += ms;
        return Promise.resolve();
      },
    });
  });

  afterEach(() => {
    setClockForTests({
      now: () => Date.now(),
      sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
    });
  });

  it('surfaces the real spawn error rather than claiming a start', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render({
      ...noService,
      spawnService: () =>
        Promise.resolve({ ok: false, cause: 'spawn /n/node ENOENT', nodePath: '/n/node' }),
    });

    expect(text()).toContain('spawn /n/node ENOENT');
    expect(text()).toContain('/n/node');
    expect(text()).toContain('service-spawn');
    expect(text()).not.toContain('Retry in a moment');
  });

  it('reports a service that exits immediately, with its stderr', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render({
      ...noService,
      spawnService: () =>
        Promise.resolve({
          ok: false,
          cause: 'the service exited immediately with code 1: Cannot find module',
          nodePath: '/n/node',
        }),
    });

    expect(text()).toContain('exited immediately with code 1');
    expect(text()).toContain('Cannot find module');
  });

  /*
   * A spawn that succeeds is not a service that answers. This is the case the
   * old code called success.
   */
  it('reports a timeout as a timeout, not as started', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));
    await render(noService);

    expect(text()).toContain('service-start-timeout');
    expect(text()).toContain('did not answer');
    expect(text()).toContain('/n/node');
    expect(text()).not.toContain('Ready');
  });

  it('reports healthy once the service answers after starting', async () => {
    let handshake: { port: number; token: string; pid: number } | null = null;
    vi.stubGlobal('fetch', serviceFetch());
    await render({
      ...noService,
      readHandshake: () => handshake,
      spawnService: () => {
        handshake = { port: 51234, token: 'tok', pid: 7 };
        return Promise.resolve({ ok: true, nodePath: '/n/node', source: 'nvm' });
      },
    });

    expect(text()).toContain('Ready');
  });

  it('names what is missing when no node resolves at all', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render({ ...noService, resolveNode: () => null });

    expect(text()).toContain('node-missing');
    expect(text()).toContain('.local/config.json');
    expect(text()).toContain('does not inherit your shell PATH');
  });
});

describe('the dry run', () => {
  it('shows what a run would do once a reel and a mode are picked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const body = url.includes('/health')
          ? healthy
          : url.includes('/reels')
            ? { reels }
            : url.includes('/modes')
              ? { modes }
              : {
                  reel: 'vitasilk',
                  videoPath: '/v/vitasilk.mov',
                  modeId: 'k2-syndicalia',
                  modeName: 'K2 Syndicalia',
                  modeVersion: 6,
                  planPath: '/v/vitasilk.editplan.json',
                  spentUsd: 1.550444,
                  stages: [
                    { id: 'transcription', label: 'Transcribe and correct', status: 'done', estimateUsd: null, note: 'cached' },
                    { id: 'images', label: 'Generate images', status: 'pending', estimateUsd: 1.55, note: 'not run yet' },
                  ],
                  estimateUsd: 1.55,
                };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
      }),
    );
    await render(hostThatAnswers());

    await act(async () => {
      select('Reel').value = 'vitasilk';
      select('Reel').dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      select('Client mode').value = 'k2-syndicalia';
      select('Client mode').dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(text()).toContain('Transcribe and correct');
    expect(text()).toContain('cached');
    expect(text()).toContain('to run, about $1.55');
    expect(text()).toContain('about $1.55');
    expect(text()).toContain('estimated for the stages not yet run');
  });
});

/**
 * Retry looked dead. It was wired and it did re-run the health check — but the
 * host, and with it the repository root, had been resolved once at module load,
 * so every press produced byte-identical text and nothing on screen moved. The
 * user had just built the service and could not tell whether the button worked.
 */
describe('retry', () => {
  it('re-runs detection, so a root resolved wrongly at load can be corrected', async () => {
    let broken = true;
    const detect = vi.fn((): HostEnvironment =>
      broken
        ? { available: false, missing: 'the repository', cause: 'not found', prevents: 'nothing works' }
        : envFor(hostThatAnswers()),
    );

    vi.stubGlobal('fetch', serviceFetch());
    await act(async () => {
      root.render(<App detect={detect} />);
    });
    expect(text()).toContain('the repository');

    broken = false;
    await act(async () => {
      (container.querySelector('button.retry') as HTMLElement).click();
    });

    expect(detect).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Ready');
  });

  /*
   * Two identical failures must still look different, or a working button is
   * indistinguishable from a dead one.
   */
  it('renders a distinguishable state for two consecutive identical failures', async () => {
    const env: HostEnvironment = {
      available: false,
      missing: 'the repository',
      cause: 'identical every time',
      prevents: 'nothing works',
    };
    await act(async () => {
      root.render(<App detect={() => env} />);
    });

    const first = text();
    const firstAttempt = container.querySelector('.attempt')?.getAttribute('data-attempt');

    await act(async () => {
      (container.querySelector('button.retry') as HTMLElement).click();
    });
    const second = text();
    const secondAttempt = container.querySelector('.attempt')?.getAttribute('data-attempt');

    expect(second).not.toBe(first);
    expect(firstAttempt).toBe('0');
    expect(secondAttempt).toBe('1');
    expect(second).toContain('attempt 2');

    await act(async () => {
      (container.querySelector('button.retry') as HTMLElement).click();
    });
    expect(text()).toContain('attempt 3');
    expect(text()).not.toBe(second);
  });

  it('marks the first check as such rather than as attempt 1', async () => {
    vi.stubGlobal('fetch', serviceFetch());
    await render(hostThatAnswers());
    expect(text()).toContain('first check');
  });

  it('re-runs the whole chain, not just health', async () => {
    const spawnService = vi.fn(() =>
      Promise.resolve({ ok: false as const, cause: 'still not built', nodePath: '/n/node' }),
    );
    const host = hostThatAnswers({ readHandshake: () => null, processAlive: () => false, spawnService });
    vi.stubGlobal('fetch', serviceFetch());

    let t = 0;
    setClockForTests({ now: () => t, sleep: (ms: number) => ((t += ms), Promise.resolve()) });
    try {
      await render(host);
      expect(spawnService).toHaveBeenCalledTimes(1);

      await act(async () => {
        (container.querySelector('button.retry') as HTMLElement).click();
      });
      expect(spawnService).toHaveBeenCalledTimes(2);
    } finally {
      setClockForTests({ now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
    }
  });
});
