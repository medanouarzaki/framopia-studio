// @vitest-environment happy-dom
import { act } from 'react';

// React's own flag for "act() is legal here". Without it every act() call
// warns; it is configuration, not suppression.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { runGate } from './run-gate.js';
import { formatUsd, SPEND_SOFT_ALARM_USD, spendLevel } from './spend.js';
import type { PanelHost } from './service.js';
import type { ClientMode, HealthPayload, Reel } from './types.js';

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
};

const reels: Reel[] = [
  { label: 'vitasilk', videoPath: '/v/vitasilk.mov', planPath: '/v/vitasilk.editplan.json', durationS: 25.692333, spentUsd: 1.550444 },
  { label: 'test-1', videoPath: '/v/test 1.mov', planPath: null, durationS: 21.988646, spentUsd: null },
];

const modes: ClientMode[] = [{ id: 'k2-syndicalia', name: 'K2 Syndicalia', version: 6, fontsResolved: false }];

let container: HTMLDivElement;
let root: Root;

function hostThatAnswers(): PanelHost {
  return {
    readHandshake: () => ({ port: 51234, token: 'tok', pid: 1 }),
    processAlive: () => true,
    spawnService: () => undefined,
  };
}

async function render(host: PanelHost, over: Partial<Parameters<typeof App>[0]> = {}): Promise<void> {
  await act(async () => {
    root.render(
      <App
        host={host}
        loadReels={() => Promise.resolve(reels)}
        loadModes={() => Promise.resolve(modes)}
        logoSrc={null}
        {...over}
      />,
    );
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => healthy }));
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => healthy }));
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => healthy }));
    await render(hostThatAnswers(), {
      loadReels: () => Promise.resolve([]),
      loadModes: () => Promise.resolve([]),
    });

    expect(text()).toContain('No reels found on this machine');
    expect(text()).toContain('No modes in modes/');
    expect(select('Reel').disabled).toBe(true);
  });

  it('shows the reel’s cumulative spend once one is picked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => healthy }));
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => healthy }));
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => healthy }));
    await render(hostThatAnswers());

    expect(runButton().disabled).toBe(true);
    expect(text()).toContain('Pick a video.');
  });

  it('asks for a mode once a video is picked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => healthy }));
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
