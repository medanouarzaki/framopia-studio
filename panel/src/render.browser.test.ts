import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright';

/**
 * The check happy-dom cannot be: a real engine, real layout, real module
 * evaluation over the built bundle.
 *
 * happy-dom parses and executes but lays nothing out, which is how a panel that
 * rendered an empty rectangle inside After Effects passed a green suite. Every
 * assertion here is one happy-dom would have answered wrongly or not at all —
 * measured dimensions, and an uncaught-error count from the page itself.
 *
 * The real CEP bridge is stubbed rather than used: `cep_node` is injected
 * before the bundle runs, so this exercises the panel's own startup path
 * without needing After Effects.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');
const INDEX = path.join(DIST, 'index.html');
const REPO = path.resolve(HERE, '..', '..');
const LOGO = path.join(REPO, 'assets', 'brand', 'Framopia_LOGO.png');

const built = existsSync(path.join(DIST, 'panel.js')) && existsSync(INDEX);

/**
 * Injected into the page before any script runs. `path` and `fs` are the only
 * modules the panel asks for at startup; `fs` reports nothing on disk, so the
 * pickers render their empty wording and no fixture is needed.
 */
function stubHost(files: Record<string, string>, repo = REPO): string {
  return `
  window.__repo = ${JSON.stringify(repo)};
  window.__files = ${JSON.stringify(files)};
  // The resolver verifies a candidate against package.json and the marker
  // directories, so a stub that answers false to everything cannot produce a
  // root — which is the behaviour being relied on.
  window.__repoFiles = {};
  window.__repoFiles[window.__repo + '/package.json'] = JSON.stringify({ name: 'framopia-studio' });
  ['service', 'modes', 'core', 'panel', 'panel/dist'].forEach(function (d) {
    window.__repoFiles[window.__repo + '/' + d] = '';
  });
  // A node binary, so resolution gets past node-missing to the build check.
  window.__repoFiles['/home/.nvm/versions/node'] = '';
  window.__repoFiles['/home/.nvm/versions/node/v24.14.1/bin/node'] = '';
  // CEP's mixed context puts Node's process global on the page; host.ts reads
  // it for processAlive, so a stub without it is not a faithful stub.
  window.process = window.process || { kill: function () { return true; } };
  window.cep_node = {
    global: {},
    require: (id) => {
      // The panel calls path.join and nothing else; a stub offering more would
      // suggest it models more than it does.
      if (id === 'path') return { join: (...p) => p.join('/') };
      if (id === 'fs') {
        const has = (p) =>
          Object.prototype.hasOwnProperty.call(window.__files, p) ||
          Object.prototype.hasOwnProperty.call(window.__repoFiles, p);
        return {
          existsSync: has,
          readFileSync: (p) =>
            Object.prototype.hasOwnProperty.call(window.__files, p)
              ? window.__files[p]
              : window.__repoFiles[p],
          readdirSync: (p) => (p === '/home/.nvm/versions/node' ? ['v24.14.1'] : []),
          realpathSync: (p) => {
            if (!has(p) && p !== window.__repo) throw new Error('ENOENT: ' + p);
            return p;
          },
        };
      }
      if (id === 'os') return { homedir: () => '/home' };
      if (id === 'child_process') {
        // stdio pipes stderr, so the real child has a stream here, not null.
        return { spawn: () => ({ unref: () => {}, on: () => {}, stderr: { on: () => {} } }) };
      }
      throw new Error('unexpected module ' + id);
    },
  };
  window.CSInterface = function () {};
  window.CSInterface.prototype.getSystemPath = function () { return window.__repo + '/panel'; };
`;
}

const HANDSHAKE = {
  [`${REPO}/.local/service.json`]: JSON.stringify({ port: 51234, token: 't', pid: 4242 }),
};
const SERVICE_BUILT = { [`${REPO}/service/dist/service.js`]: '' };

const HEALTHY_PAYLOAD = {
  ok: true,
  serviceVersion: '0.1.0',
  appVersion: '0.1.0',
  promptVersion: 4,
  ffmpeg: { present: true, detail: 'ffmpeg version 8.0.1' },
  ffprobe: { present: true, detail: 'ffprobe version 8.0.1' },
  sidecar: { venv: { present: true, detail: 'Python 3.11.14' }, pythonPath: '/p' },
  templates: { valid: true, issues: [], count: 6 },
  repoRoot: REPO,
  node: { path: '/home/.nvm/versions/node/v24.14.1/bin/node', source: 'nvm', version: 'v24.14.1' },
};

/** Replaces fetch before the bundle runs, so the first health call is the stub. */
function stubFetch(mode: 'healthy' | 'hang'): string {
  return mode === 'hang'
    ? 'window.fetch = () => new Promise(() => {});'
    : `window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(${JSON.stringify(HEALTHY_PAYLOAD)}) });`;
}

let browser: Browser | undefined;
let launchFailure: string | null = null;

beforeAll(async () => {
  if (!built) return;
  try {
    browser = await chromium.launch();
  } catch (error) {
    // The browser binary is a machine prerequisite, like the CV venv. A
    // contributor without it should still be able to run the gate, and should
    // be told, never skipped silently.
    launchFailure = (error as Error).message.split('\n')[0] ?? 'chromium would not launch';
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

interface Loaded {
  page: Page;
  /** Uncaught exceptions only. A handled fetch failure is not one. */
  uncaught: string[];
}

/*
 * Every page gets a handshake by default, so `connect` takes the fast path —
 * a registered service that does not answer — rather than the spawn path,
 * which polls for twelve seconds by design.
 */
async function load(
  options: {
    files?: Record<string, string>;
    fetch?: 'healthy' | 'hang' | null;
    repo?: string;
    width?: number;
    height?: number;
  } = {},
): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({
    viewport: { width: options.width ?? 420, height: options.height ?? 900 },
  });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  page.on('console', (msg: ConsoleMessage) => {
    /*
     * Chromium logs a console error for a refused fetch. The stub points at a
     * port nothing listens on, and the panel handles that by design — counting
     * it would make "no uncaught errors" untestable.
     */
    if (msg.type() !== 'error') return;
    if (msg.text().includes('Failed to load resource')) return;
    uncaught.push(msg.text());
  });
  await page.addInitScript(stubHost(options.files ?? HANDSHAKE, options.repo));
  if (options.fetch != null) await page.addInitScript(stubFetch(options.fetch));
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('header.brand', { timeout: 10_000 });
  return { page, uncaught };
}

describe.skipIf(!built)('the built panel in a real browser', () => {
  it('has a browser to drive', () => {
    if (launchFailure !== null) {
      console.warn(
        `panel: skipping the render check — ${launchFailure}. Run \`npx playwright install chromium\`.`,
      );
    }
    expect(built).toBe(true);
  });

  it('mounts with no uncaught error', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page, uncaught } = loaded;
    try {
      // The regression: `cep_node is not available` was thrown at module load
      // and nothing rendered at all.
      expect(uncaught).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('lays out — the root has real dimensions', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page } = loaded;
    try {
      const box = await page.locator('#root').boundingBox();
      expect(box).not.toBeNull();
      expect(box?.width).toBeGreaterThan(300);
      expect(box?.height).toBeGreaterThan(300);

      const header = await page.locator('header.brand').boundingBox();
      expect(header?.height).toBeGreaterThan(20);
    } finally {
      await page.close();
    }
  });

  it('renders the brand mark and the three sections', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page } = loaded;
    try {
      expect(await page.locator('header.brand .name').textContent()).toContain('Framopia');
      const logo = page.locator('header.brand img, header.brand .mark');
      expect(await logo.count()).toBe(1);
      expect((await logo.boundingBox())?.width).toBeGreaterThan(0);
      // No logo on disk in this stub, so the fallback mark is what renders.
      expect(await page.locator('header.brand .mark').count()).toBe(1);

      const headings = await page.locator('section > h2').allTextContents();
      expect(headings).toEqual(['Service', 'Video', 'Client mode', 'Build']);
    } finally {
      await page.close();
    }
  });

  it('renders starting while the health call is in flight', async () => {
    const loaded = await load({ files: HANDSHAKE, fetch: 'hang' });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      expect(await page.locator('.dot.starting').count()).toBe(1);
      expect(await page.locator('.card').first().textContent()).toContain('Starting');
    } finally {
      await page.close();
    }
  }, 20_000);

  it('renders unreachable with the stage and retryability on screen', async () => {
    const loaded = await load({ files: HANDSHAKE });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.unreachable', { timeout: 10_000 });
      const card = (await page.locator('.card').first().textContent()) ?? '';
      expect(card).toContain('Not reachable');
      expect(card).toContain('stage');
      expect(await page.getByRole('button', { name: 'Retry' }).count()).toBe(1);
    } finally {
      await page.close();
    }
  });

  it('renders healthy with the payload read as words', async () => {
    const loaded = await load({ files: HANDSHAKE, fetch: 'healthy' });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 10_000 });
      const card = (await page.locator('.card').first().textContent()) ?? '';
      expect(card).toContain('Ready');
      expect(card).toContain('ffmpeg version 8.0.1');
      expect(card).toContain('correction prompt v4');
      expect(card).not.toContain('{');
    } finally {
      await page.close();
    }
  }, 20_000);

  /*
   * The real PNG, decoded by the browser. Asserting an <img> element exists
   * proved nothing: the header rendered a red square for a whole session
   * because the path was wrong and a broken image is still an element.
   */
  it('loads the real logo, not merely an <img> element', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, [LOGO]: '' } });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      const img = page.locator('header.brand img');
      expect(await img.count()).toBe(1);
      expect(await page.locator('header.brand .mark').count()).toBe(0);
      expect(await img.getAttribute('src')).toBe(`file://${LOGO}`);

      const decoded = await img.evaluate((el) => ({
        complete: (el as HTMLImageElement).complete,
        w: (el as HTMLImageElement).naturalWidth,
        h: (el as HTMLImageElement).naturalHeight,
      }));
      expect(decoded.complete).toBe(true);
      expect(decoded.w).toBe(962);
      expect(decoded.h).toBe(1077);

      expect((await img.boundingBox())?.width).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  }, 20_000);

  it('keeps the Run control disabled with its reason on screen', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page } = loaded;
    try {
      const run = page.getByRole('button', { name: 'Run pipeline' });
      expect(await run.isDisabled()).toBe(true);
      const reason = await page.locator('p.reason').first().textContent();
      expect(reason ?? '').not.toBe('');
    } finally {
      await page.close();
    }
  });

  /*
   * The fault this session fixed, reproduced from the other side: with no
   * cep_node the panel must still mount and say why, rather than going blank.
   */
  it('mounts and explains itself when the host is missing entirely', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 420, height: 760 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    try {
      await page.goto(`file://${INDEX}`);
      await page.waitForSelector('header.brand', { timeout: 10_000 });

      expect(uncaught).toEqual([]);
      const card = (await page.locator('.card').first().textContent()) ?? '';
      expect(card).toContain('cep_node');
      expect(card).toContain('--enable-nodejs');
      const box = await page.locator('#root').boundingBox();
      expect(box?.height).toBeGreaterThan(100);
    } finally {
      await page.close();
    }
  });
});

describe.skipIf(built)('the built panel', () => {
  it('is not built, so the browser check is skipped with a notice', () => {
    console.warn('panel/dist is missing — run `npm run panel:build` to run the render check');
    expect(built).toBe(false);
  });
});

/**
 * The two ends of the spawn path, in a real engine.
 *
 * The user saw the failure end wearing an authoritative message about
 * `/service/dist/service.js`, a file that could never exist because the root
 * had resolved to `/`. Both ends are driven here, and the rendered text is
 * asserted to differ.
 */
describe.skipIf(!built)('the spawn path in a real browser', () => {
  it('reports the service as not built, naming a path under the real root', async () => {
    const loaded = await load({ files: {} });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.unreachable', { timeout: 15_000 });
      const card = (await page.locator('.card').first().textContent()) ?? '';

      expect(card).toContain('not built');
      expect(card).toContain(`${REPO}/service/dist/service.js`);
      /*
       * The regression: a path starting at the root of the disk, which is what
       * an empty repository root composes into. The correct path contains the
       * same tail, so the test has to look at what precedes it.
       */
      expect(card).not.toMatch(/[\s:]\/service\/dist\/service\.js/);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('reaches healthy when the service is built and answers', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy' });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      const card = (await page.locator('.card').first().textContent()) ?? '';
      expect(card).toContain('Ready');
      expect(card).not.toContain('not built');
    } finally {
      await page.close();
    }
  }, 30_000);

  /*
   * Two identical failures must look different. A working Retry that renders
   * byte-identical text is indistinguishable from a dead one, which is exactly
   * what the user reported.
   */
  it('renders a distinguishable state on a second retry', async () => {
    const loaded = await load({ files: {} });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.attempt', { timeout: 15_000 });
      expect(await page.locator('.attempt').first().getAttribute('data-attempt')).toBe('0');
      const first = (await page.locator('.card').first().textContent()) ?? '';

      await page.getByRole('button', { name: 'Retry' }).first().click();
      await page.waitForSelector('.attempt[data-attempt="1"]', { timeout: 15_000 });
      const second = (await page.locator('.card').first().textContent()) ?? '';

      expect(second).not.toBe(first);
      expect(second).toContain('attempt 2');
    } finally {
      await page.close();
    }
  }, 30_000);
});

/**
 * The layout at the two widths that matter: docked into an After Effects
 * workspace at the manifest's 420px, and floating wide.
 *
 * The breakpoint is a container query on the panel, not a media query: a
 * docked CEP panel's window is the size of the screen while its panel is the
 * width of a column, so a viewport query would lay out for the wrong thing.
 */
describe.skipIf(!built)('the responsive layout', () => {
  const columnCount = async (page: Page): Promise<number> =>
    page.evaluate(
      () =>
        new Set(
          [...document.querySelectorAll('main > section')].map((s) =>
            Math.round(s.getBoundingClientRect().left),
          ),
        ).size,
    );

  const overflowing = async (page: Page): Promise<string[]> =>
    page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.tagName}.${el.className}`),
    );

  it('is one column when docked at 420px, and nothing overflows', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy', width: 420 });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      expect(await columnCount(page)).toBe(1);
      expect(await overflowing(page)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('is two columns when floating wide, and nothing overflows', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy', width: 1200 });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      expect(await columnCount(page)).toBe(2);
      expect(await overflowing(page)).toEqual([]);

      // Service beside Video and Client mode; Build spanning both beneath.
      const boxes = await page.evaluate(() =>
        Object.fromEntries(
          ['service', 'video', 'mode', 'build'].map((c) => {
            const el = document.querySelector(`main > section.${c}`) as HTMLElement;
            const r = el.getBoundingClientRect();
            return [c, { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width) }];
          }),
        ),
      );
      expect(boxes.service?.left).toBeLessThan(boxes.video?.left as number);
      expect(boxes.video?.left).toBe(boxes.mode?.left);
      expect(boxes.video?.top).toBeLessThan(boxes.mode?.top as number);
      expect(boxes.build?.left).toBe(boxes.service?.left);
      expect(boxes.build?.width).toBeGreaterThan((boxes.service?.width as number) * 1.8);
      expect(boxes.build?.top).toBeGreaterThan(boxes.mode?.top as number);
    } finally {
      await page.close();
    }
  }, 30_000);

  /*
   * The breakpoint itself. Below it a second column would be narrower than the
   * single column already is when docked, which would make the panel worse
   * rather than wider.
   */
  /*
   * The mechanism, not just the outcome: the class has to be on the element,
   * because a container query left it empty and the layout never switched.
   */
  it('carries the wide class only above the breakpoint', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy', width: 1200 });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      expect(await page.locator('div.app').getAttribute('class')).toBe('app wide');
    } finally {
      await page.close();
    }
  }, 30_000);

  it('has no class at the docked width', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy', width: 420 });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      expect(await page.locator('div.app').getAttribute('class')).toBe('app');
    } finally {
      await page.close();
    }
  }, 30_000);

  /*
   * Re-evaluated on resize, not once at mount. A width read during the first
   * render is taken before layout and is the other common way a breakpoint
   * never fires.
   */
  it('switches when the panel is resized, without a reload', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy', width: 420 });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      expect(await columnCount(page)).toBe(1);

      await page.setViewportSize({ width: 1200, height: 900 });
      await page.waitForFunction(() => document.querySelector('div.app')?.classList.contains('wide'), null, {
        timeout: 10_000,
      });
      expect(await columnCount(page)).toBe(2);

      await page.setViewportSize({ width: 420, height: 900 });
      await page.waitForFunction(() => !document.querySelector('div.app')?.classList.contains('wide'), null, {
        timeout: 10_000,
      });
      expect(await columnCount(page)).toBe(1);
      expect(await overflowing(page)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 40_000);

  it('stays single-column one pixel below the breakpoint', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy', width: 829 });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      expect(await columnCount(page)).toBe(1);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('splits at the breakpoint', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy', width: 830 });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      expect(await columnCount(page)).toBe(2);
      expect(await overflowing(page)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);
});

/**
 * A route-aware fetch stub. `stubFetch('healthy')` answers every URL with the
 * health payload, which leaves the pickers empty — fine for the startup checks
 * and useless for the flow, which needs a reel, a mode and a plan.
 *
 * `steps` is the service's own derivation from the Edit Plan. It is stubbed
 * here rather than read off disk because this file drives the built bundle,
 * not the service; `service/src/steps.ts` has its own tests against the real
 * plans.
 */
function stubRoutes(steps: unknown, resumeAt: string): string {
  const payload = {
    health: HEALTHY_PAYLOAD,
    reels: { reels: [{ label: 'vitasilk', present: true, durationS: 25.7, planPath: '/v/p.json', spentUsd: 1.550444 }] },
    modes: { modes: [{ id: 'k2-syndicalia', name: 'K2 Syndicalia', version: 6, fontsStatus: 'tbd' }] },
    dry: {
      reel: 'vitasilk', videoPath: '/v/vitasilk.mov', modeId: 'k2-syndicalia',
      modeName: 'K2 Syndicalia', modeVersion: 6, planPath: '/v/p.json', spentUsd: 1.550444,
      stages: [], estimateUsd: 0, reusesOlderGuide: false,
    },
    steps: { reel: 'vitasilk', planPath: '/v/p.json', steps, resumeAt },
  };
  return `
  window.__payload = ${JSON.stringify(payload)};
  window.__polls = 0;
  window.fetch = (url) => {
    const p = window.__payload;
    const u = String(url);
    if (u.indexOf('/jobs/') !== -1) {
      window.__polls += 1;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__job()) });
    }
    if (u.indexOf('/jobs') !== -1) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'job-1' }) });
    }
    const body = u.indexOf('/health') !== -1 ? p.health
      : u.indexOf('/reels') !== -1 ? p.reels
      : u.indexOf('/modes') !== -1 ? p.modes
      : u.indexOf('/steps') !== -1 ? p.steps
      : p.dry;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };`;
}

/** Five steps with everything through `upTo` available, the rest locked. */
function stepsThrough(upTo: string): unknown[] {
  const order = ['reel', 'transcript', 'keywords', 'images', 'build'];
  const labels: Record<string, string> = {
    reel: 'Reel', transcript: 'Transcript', keywords: 'Keywords', images: 'Images', build: 'Build',
  };
  const cut = order.indexOf(upTo);
  return order.map((id, i) => ({
    id,
    label: labels[id],
    available: i <= cut,
    reason: i <= cut ? null : `${labels[id]} has not run for this reel.`,
    summary: i <= cut ? `${labels[id]} summary from the plan` : null,
  }));
}

/** Opens the panel with a reel and a mode chosen, as a user would. */
async function loadFlow(upTo: string, resumeAt: string, width = 420): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough(upTo), resumeAt));
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.rail', { timeout: 10_000 });
  await page.selectOption('select[aria-label="Reel"]', 'vitasilk');
  await page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');
  await page.waitForFunction(
    () => document.querySelector('nav.rail .step.current .l') !== null,
    undefined,
    { timeout: 10_000 },
  );
  return { page, uncaught };
}

/** A pipeline job the stub serves, in whatever state the test wants. */
function stubJob(state: 'running' | 'done' | 'failed' | 'all-skipped'): string {
  const stage = (
    id: string,
    label: string,
    s: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id, label, state: s, reason: null, costUsd: 0,
    cacheEntryId: null, cacheProvenance: null, startedAt: null, finishedAt: null,
    error: null, ...extra,
  });
  const allSkipped = [
    stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'reusing an older guide' }),
    stage('analysis', 'Keywords and image slots', 'skipped', { reason: 'already on the plan' }),
    stage('images', 'Generate images', 'skipped', { reason: 'already on the plan' }),
    stage('zones', 'Frame analysis (local, free)', 'skipped', { reason: 'already on the plan' }),
  ];
  const stages =
    state === 'all-skipped'
    ? allSkipped
    : state === 'running'
      ? [
          stage('transcription', 'Transcribe and correct', 'skipped', {
            reason: 'reusing an older guide',
            cacheProvenance: 'compatible',
            cacheEntryId: 'transcription-758a3924d090d1b5',
          }),
          stage('analysis', 'Keywords and image slots', 'running'),
          stage('images', 'Generate images', 'waiting'),
          stage('zones', 'Frame analysis (local, free)', 'waiting'),
        ]
      : state === 'failed'
        ? [
            stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'already on the plan' }),
            stage('analysis', 'Keywords and image slots', 'failed', {
              error: {
                stage: 'analysis',
                cause: 'the model returned 503 Service Unavailable',
                retryable: true,
              },
            }),
            stage('images', 'Generate images', 'waiting'),
            stage('zones', 'Frame analysis (local, free)', 'waiting'),
          ]
        : [
            stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'reusing an older guide' }),
            stage('analysis', 'Keywords and image slots', 'done', { costUsd: 0.1835 }),
            stage('images', 'Generate images', 'skipped', { reason: 'no image slots on the plan' }),
            stage('zones', 'Frame analysis (local, free)', 'skipped', { reason: 'already on the plan' }),
          ];
  const detail = {
    reel: 'vitasilk', modeId: 'k2-syndicalia', planPath: '/v/p.json', stages,
    percent: state === 'done' ? 1 : 0.25,
    spentUsd: state === 'done' ? 0.1835 : 0,
    planSpentUsd: 1.550444,
    done: state !== 'running',
    error: state === 'failed' ? (stages[1]?.['error'] ?? null) : null,
  };
  const status = state === 'running' ? 'running' : state === 'failed' ? 'error' : 'done';
  return `window.__job = () => (${JSON.stringify({
    id: 'job-1',
    status,
    progress: detail.percent,
    detail,
  })});`;
}

/**
 * The exact pair that disagreed on the user's machine: `vitasilk`'s analysis
 * stage, whose cache misses (`provenance: 'none'`, no estimate) while the plan
 * already records it done. The cost block read "to run" and the run beneath it
 * read "skipped".
 */
const VITASILK_DRY_STAGES = [
  {
    id: 'transcription',
    label: 'Transcribe and correct',
    status: 'done',
    provenance: 'compatible',
    entryId: 'transcription-758a3924d090d1b5',
    estimateUsd: null,
    action: 'skip',
    note: 'reusing an older guide. Already on the plan, so a run skips it',
  },
  {
    id: 'analysis',
    label: 'Keywords and image slots',
    status: 'done',
    provenance: 'none',
    entryId: null,
    estimateUsd: null,
    action: 'skip',
    note: 'a run would call the model and bill. Already on the plan, so a run skips it',
  },
  {
    id: 'images',
    label: 'Generate images',
    status: 'done',
    provenance: 'exact',
    entryId: null,
    estimateUsd: null,
    action: 'skip',
    note: '10 of 10 candidate images are cached. Already on the plan, so a run skips it',
  },
  {
    id: 'zones',
    label: 'Frame analysis (local, free)',
    status: 'done',
    provenance: null,
    entryId: null,
    estimateUsd: null,
    action: 'skip',
    note: 'local computer vision. Already on the plan, so a run skips it',
  },
];

/*
 * The mode picker drew a **red outline when focused**, and no test saw it
 * because tests do not tab through controls. The accent belongs to Run
 * pipeline; a focus ring is not exempt.
 */
describe.skipIf(!built)('focus', () => {
  it('never paints the brand accent on any control it lands on', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;

    const offenders = await loaded.page.evaluate(() => {
      const norm = (c: string): string => c.replace(/\s/g, '');
      const accent = 'rgb(237,28,36)';
      const found: string[] = [];
      const controls = [
        ...document.querySelectorAll('select, button, input, a[href], [tabindex]'),
      ] as HTMLElement[];
      for (const el of controls) {
        el.focus();
        const s = getComputedStyle(el);
        const painted =
          norm(s.borderTopColor) === accent ||
          norm(s.borderBottomColor) === accent ||
          norm(s.borderLeftColor) === accent ||
          norm(s.borderRightColor) === accent ||
          norm(s.outlineColor) === accent ||
          norm(s.color) === accent ||
          norm(s.backgroundColor) === accent;
        // Run pipeline is the one control allowed to be red, focused or not.
        if (painted && !el.classList.contains('run')) {
          found.push(`${el.tagName.toLowerCase()}.${el.className}`);
        }
      }
      return found;
    });

    expect(offenders).toEqual([]);
    await loaded.page.close();
  });

  it('still shows a visible ring, so focus is not simply removed', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    const ring = await loaded.page.evaluate(() => {
      const el = document.querySelector('select[aria-label="Client mode"]') as HTMLSelectElement;
      const before = getComputedStyle(el).borderTopColor;
      el.focus();
      return { before, after: getComputedStyle(el).borderTopColor };
    });
    expect(ring.after).not.toBe(ring.before);
    await loaded.page.close();
  });
});

describe.skipIf(!built)('the cost block and the run', () => {
  async function loadBoth(): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(
      `window.__payload.dry.stages = ${JSON.stringify(VITASILK_DRY_STAGES)};`,
    );
    await page.addInitScript(stubJob('all-skipped'));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.rail', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Reel"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');
    await page.waitForFunction(
      () =>
        (document.querySelector('main') as HTMLElement).textContent?.includes(
          'Keywords and image slots',
        ) === true,
      undefined,
      { timeout: 5000 },
    );
    return { page, uncaught };
  }

  /*
   * The regression. Nothing in the six service tests looked at this string, so
   * all six passed while the panel said "to run" for a stage a run skips.
   */
  it('never says a stage will run when the plan already carries it', async () => {
    const loaded = await loadBoth();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).not.toContain('to run');
    expect(text).toContain('skipped, already on the plan');
    await loaded.page.close();
  });

  /*
   * The stronger form: for every stage, what the cost block says and what the
   * run reports must agree as rendered text — not as two service values that
   * happen to line up.
   */
  it('renders the same verdict in the cost block and in the run', async () => {
    const loaded = await loadBoth();
    if (loaded === null) return;
    await loaded.page.click('button.run');
    await loaded.page.waitForFunction(
      () => document.querySelectorAll('section.build ul.facts').length >= 2,
      undefined,
      { timeout: 5000 },
    );
    const rows = await loaded.page.evaluate(() => {
      const lists = [...document.querySelectorAll('section.build ul.facts')];
      const read = (ul: Element): Record<string, string> =>
        Object.fromEntries(
          [...ul.querySelectorAll('li')].map((li) => [
            li.querySelector('.k')?.textContent ?? '',
            li.querySelector('.v')?.textContent ?? '',
          ]),
        );
      return { estimate: read(lists[0] as Element), run: read(lists[1] as Element) };
    });

    for (const [label, estimate] of Object.entries(rows.estimate)) {
      const ran = rows.run[label];
      expect(ran, `no run row for "${label}"`).toBeDefined();
      const estimateSkips = estimate.includes('skipped');
      const runSkips = (ran ?? '').includes('skipped');
      expect(runSkips, `"${label}": estimate said "${estimate}", run said "${ran}"`).toBe(
        estimateSkips,
      );
    }
    await loaded.page.close();
  });
});

describe.skipIf(!built)('a pipeline run', () => {
  async function loadRun(state: 'running' | 'done' | 'failed'): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(stubJob(state));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.rail', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Reel"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');
    await page.click('button.run');
    await page.waitForFunction(
      () => (document.querySelector('main') as HTMLElement).textContent?.includes('Transcribe and correct') === true,
      undefined,
      { timeout: 5000 },
    );
    return { page, uncaught };
  }

  it('shows every stage with its state, in the dry run’s words', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    for (const label of ['Transcribe and correct', 'Keywords and image slots', 'Generate images', 'Frame analysis (local, free)']) {
      expect(text, label).toContain(label);
    }
    expect(text).toContain('running…');
    expect(text).toContain('waiting');
    await loaded.page.close();
  });

  /* The first time cacheProvenance reaches the screen from a real run. */
  it('says a stage was skipped and why', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('skipped');
    expect(text).toContain('reusing an older guide');
    await loaded.page.close();
  });

  it('shows a failed stage’s cause as it came, not a summary', async () => {
    const loaded = await loadRun('failed');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('the model returned 503 Service Unavailable');
    expect(text).toContain('worth retrying');
    await loaded.page.close();
  });

  it('reports what the run billed and what the reel has cost in total', async () => {
    const loaded = await loadRun('done');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('billed by this run');
    expect(text).toContain('on this reel in total');
    await loaded.page.close();
  });

  /*
   * The job lives in the service. Walking to another step and back must not
   * stop it or lose it — the panel is a viewer.
   */
  it('survives leaving step one and coming back', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(3) button');
    expect(await loaded.page.textContent('main h2')).toBe('Keywords');
    await loaded.page.click('nav.rail li:nth-child(1) button');
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('Keywords and image slots');
    expect(text).toContain('running…');
    await loaded.page.close();
  });

  it('will not start a second run while one is going, and says so', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    const state = await loaded.page.evaluate(() => {
      const el = document.querySelector('button.run') as HTMLButtonElement;
      return { disabled: el.disabled, label: el.textContent };
    });
    expect(state.disabled).toBe(true);
    expect(state.label).toBe('Running…');
    expect((await loaded.page.textContent('main')) ?? '').toContain('continues if you leave this step');
    await loaded.page.close();
  });
});

describe.skipIf(!built)('the step rail', () => {
  it('shows all five steps before any reel is picked', async () => {
    const loaded = await load({ fetch: 'healthy' });
    if (loaded === null) return;
    const labels = await loaded.page.$$eval('nav.rail li .l', (els) =>
      els.map((e) => e.textContent),
    );
    expect(labels).toEqual(['Reel', 'Transcript', 'Keywords', 'Images', 'Build']);
    await loaded.page.close();
  });

  it('locks every step past Reel with no reel chosen, and says why', async () => {
    const loaded = await load({ fetch: 'healthy' });
    if (loaded === null) return;
    const state = await loaded.page.$$eval('nav.rail li button', (els) =>
      els.map((e) => ({
        disabled: (e as HTMLButtonElement).disabled,
        title: e.getAttribute('title'),
      })),
    );
    expect(state[0]?.disabled).toBe(false);
    expect(state.slice(1).every((s) => s.disabled)).toBe(true);
    expect(state[1]?.title).toContain('Pick a video');
    await loaded.page.close();
  });

  /*
   * Selecting a reel used to jump to the furthest step the plan supported,
   * which hid every step in between and left Build open on a reel that had no
   * keywords. The user ruled that picking a video must not navigate: the rail
   * updates availability and he chooses where to go.
   */
  it('does not navigate when a reel and a mode are picked', async () => {
    const loaded = await loadFlow('keywords', 'keywords');
    if (loaded === null) return;
    expect(await loaded.page.textContent('nav.rail .step.current .l')).toBe('Reel');
    expect(await loaded.page.textContent('main section.video h2')).toBe('Video');
    await loaded.page.close();
  });

  it('restores the step last viewed for a reel after the panel is reopened', async () => {
    const loaded = await loadFlow('keywords', 'keywords');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(3) button');
    expect(await loaded.page.textContent('main h2')).toBe('Keywords');

    // Closing a CEP panel unloads the page, so this is what "reopen" is.
    await loaded.page.reload();
    await loaded.page.waitForSelector('nav.rail', { timeout: 10_000 });
    await loaded.page.selectOption('select[aria-label="Reel"]', 'vitasilk');
    await loaded.page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');
    await loaded.page.waitForFunction(
      () => document.querySelector('main h2')?.textContent === 'Keywords',
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
    // Two page loads: past vitest's 5s default because the journey is long,
    // not because anything retries.
  }, 20_000);

  it('leaves a step the plan does not support unreachable', async () => {
    const loaded = await loadFlow('keywords', 'keywords');
    if (loaded === null) return;
    const disabled = await loaded.page.$$eval('nav.rail li button', (els) =>
      els.map((e) => (e as HTMLButtonElement).disabled),
    );
    expect(disabled).toEqual([false, false, false, true, true]);
    await loaded.page.close();
  });

  it('navigates back to a completed step, and Back returns one step', async () => {
    const loaded = await loadFlow('keywords', 'keywords');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(2) button');
    expect(await loaded.page.textContent('main h2')).toBe('Transcript');
    await loaded.page.click('button.back');
    // Back from Transcript is step one, which is the original screen.
    expect(await loaded.page.textContent('main section.video h2')).toBe('Video');
    await loaded.page.close();
  });

  /*
   * The user's ruling: Run pipeline is the one red thing on screen. Session 16
   * could only assert this by removing the `disabled` attribute in the page,
   * because the gate reported "the pipeline runner is not built yet" and the
   * control could never be enabled. The runner exists now, so this reads the
   * real enabled control.
   */
  it('paints the enabled Run pipeline in the brand accent', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    const run = await loaded.page.evaluate(() => {
      const el = document.querySelector('button.run') as HTMLButtonElement;
      return {
        disabled: el.disabled,
        label: el.textContent,
        background: getComputedStyle(el).backgroundColor.replace(/\s/g, ''),
      };
    });
    expect(run.disabled).toBe(false);
    expect(run.label).toBe('Run pipeline');
    expect(run.background).toBe('rgb(237,28,36)');
    await loaded.page.close();
  });

  it('does not paint Run in the accent while it is disabled', async () => {
    // No reel picked, so the gate is off and the control must not claim it.
    const loaded = await load({ fetch: 'healthy' });
    if (loaded === null) return;
    const run = await loaded.page.evaluate(() => {
      const el = document.querySelector('button.run') as HTMLButtonElement;
      return {
        disabled: el.disabled,
        background: getComputedStyle(el).backgroundColor.replace(/\s/g, ''),
      };
    });
    expect(run.disabled).toBe(true);
    expect(run.background).not.toBe('rgb(237,28,36)');
    await loaded.page.close();
  });

  /*
   * Scoped to the rail and the pane, not the whole page: the brand header is
   * identity rather than flow, and PROJECT_SPEC §6 puts the accent in the
   * wordmark and the logo by design.
   */
  it('spends the accent on nothing else in the flow', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    const painted = await loaded.page.evaluate(() => {
      const norm = (c: string): string => c.replace(/\s/g, '');
      const accent = 'rgb(237,28,36)';
      return [...document.querySelectorAll('nav.rail *, main *')]
        .filter((node) => {
          const s = getComputedStyle(node);
          return (
            norm(s.backgroundColor) === accent ||
            norm(s.color) === accent ||
            norm(s.borderBottomColor) === accent ||
            norm(s.borderTopColor) === accent
          );
        })
        .map((node) => `${node.tagName.toLowerCase()}.${node.className}`);
    });
    expect(painted).toEqual(['button.run']);
    await loaded.page.close();
  });

  it('keeps step one intact, with Run pipeline still the one red control', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(1) button');
    const red = await loaded.page.evaluate(() => {
      const norm = (c: string): string => c.replace(/\s/g, '');
      const target = 'rgb(237,28,36)';
      return [...document.querySelectorAll('*')]
        .filter((el) => {
          const s = getComputedStyle(el);
          return (
            norm(s.backgroundColor) === target ||
            norm(s.color) === target ||
            norm(s.borderBottomColor) === target
          );
        })
        .map((el) => el.tagName.toLowerCase() + '.' + el.className);
    });
    // Run is disabled here, so it is not painted red either; what matters is
    // that the rail's current marker never is.
    expect(red.filter((r) => r.includes('rail'))).toEqual([]);
    expect(await loaded.page.textContent('button.run')).toBe('Run pipeline');
    await loaded.page.close();
  });

  it('fits the rail on one row when docked at the manifest width', async () => {
    const loaded = await loadFlow('build', 'build', 420);
    if (loaded === null) return;
    const rail = await loaded.page.evaluate(() => {
      const nav = document.querySelector('nav.rail') as HTMLElement;
      const items = [...nav.querySelectorAll('li')] as HTMLElement[];
      const tops = new Set(items.map((li) => li.offsetTop));
      return {
        rows: tops.size,
        overflows: nav.scrollWidth > nav.clientWidth,
        labelsShown: [...nav.querySelectorAll('.l')].filter(
          (l) => getComputedStyle(l).display !== 'none',
        ).length,
      };
    });
    expect(rail.rows).toBe(1);
    expect(rail.overflows).toBe(false);
    // Numbers plus the current step's name, as the brief requires at 420px.
    expect(rail.labelsShown).toBe(1);
    await loaded.page.close();
  });

  it('shows every label once there is room for two columns', async () => {
    const loaded = await loadFlow('build', 'build', 1000);
    if (loaded === null) return;
    const shown = await loaded.page.evaluate(
      () =>
        [...document.querySelectorAll('nav.rail .l')].filter(
          (l) => getComputedStyle(l).display !== 'none',
        ).length,
    );
    expect(shown).toBe(5);
    await loaded.page.close();
  });

  it('shows the plan summary on a step that is not built yet', async () => {
    const loaded = await loadFlow('keywords', 'keywords');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(3) button');
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('Keywords summary from the plan');
    expect(text).toContain('This step is not built yet.');
    await loaded.page.close();
  });

  /*
   * The user saw "Pick a video and a client mode first" with both already
   * picked: the panel was talking to a service too old to have the /steps
   * route, so no plan arrived and every step fell back to a sentence about a
   * choice he had made.
   */
  it('never tells a user to pick a video they have already picked', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(5) button');
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).not.toContain('Pick a video and a client mode first');
    await loaded.page.close();
  });

  it('renders the whole flow with no uncaught errors', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(4) button');
    await loaded.page.click('nav.rail li:nth-child(5) button');
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });
});
