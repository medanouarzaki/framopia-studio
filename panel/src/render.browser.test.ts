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
      watermark: true, watermarkSize: 'medium',
      watermarkWidthsPx: { small: 216, medium: 324, large: 432 },
    },
    steps: {
      reel: 'vitasilk', planPath: '/v/p.json', steps, resumeAt,
      build: {
        reel: 'vitasilk', planPath: '/v/p.json',
        modeId: 'k2-syndicalia', modeName: 'K2 Syndicalia', modeSource: 'the plan',
        outputPath: '/repo/.local/build/vitasilk-full.aep',
        subtitleCards: 68, keywords: 3, images: 5, sfxEvents: 4,
        watermark: { size: 'medium', widthPx: 324, heightPx: 363 },
        fonts: { latin: 'Inter Semi-Bold', arabic: 'Almarai Bold', globalFallback: true },
        free: true,
      },
    },
    keywords: {
      reel: 'vitasilk', planPath: '/v/p.json', keywords: [], promotable: [],
      emptyReason: 'Keyword analysis has not run for this reel yet.',
      source: { stageStatus: 'pending', cacheEntryId: null, cacheProvenance: null, promptVersion: 4, mode: 'auto' },
      subtitleFontSize: 343, keywordFontSize: 425,
    },
    transcript: {
      reel: 'vitasilk', planPath: '/v/p.json', transcriptHash: 'h',
      editCost: 'Editing a word changes the transcript hash.',
      words: [], cards: [], questions: [],
    },
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
      : u.indexOf('/keywords') !== -1 ? p.keywords
      : u.indexOf('/transcript') !== -1 ? p.transcript
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
async function loadFlow(
  upTo: string,
  resumeAt: string,
  width = 420,
  /** Runs after the route stub, for a test that needs a different payload. */
  amendPayload?: string,
): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough(upTo), resumeAt));
  if (amendPayload !== undefined) await page.addInitScript(amendPayload);
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
/*
 * Session 17 claimed a completed run unlocks the steps the new plan supports.
 * The user's run skipped every stage, so nothing changed and nothing was
 * proven. This drives a run that **completes a stage that was pending** and
 * asserts the rail follows the plan, with no manual reload.
 */
describe.skipIf(!built)('the rail after a run', () => {
  it('unlocks a step the finished run made available', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    // Before: transcribed and nothing else, so Keywords is locked.
    await page.addInitScript(stubRoutes(stepsThrough('transcript'), 'transcript'));
    await page.addInitScript(stubJob('done'));
    /*
     * The service answers /steps differently once the run has finished, which
     * is what a real run does to the plan. The panel must re-ask rather than
     * keep the answer it had when the reel was picked.
     */
    await page.addInitScript(`
      window.__stepsAfterRun = ${JSON.stringify(
        ['reel', 'transcript', 'keywords', 'images', 'build'].map((id, i) => ({
          id,
          label: `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
          available: i <= 2,
          reason: i <= 2 ? null : 'not yet',
          summary: i <= 2 ? `${id} summary from the plan` : null,
          issues: [],
        })),
      )};
      window.__runFinished = false;
      const realFetch = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url);
        if (u.indexOf('/jobs/') !== -1) window.__runFinished = true;
        if (u.indexOf('/steps') !== -1 && window.__runFinished) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                reel: 'vitasilk',
                planPath: '/v/p.json',
                steps: window.__stepsAfterRun,
              }),
          });
        }
        return realFetch(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.rail', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Reel"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');

    const lockedBefore = await page.$$eval('nav.rail li button', (els) =>
      els.map((e) => (e as HTMLButtonElement).disabled),
    );
    expect(lockedBefore).toEqual([false, false, true, true, true]);

    await page.click('button.run');
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('nav.rail li button')].map(
          (e) => (e as HTMLButtonElement).disabled,
        )[2] === false,
      undefined,
      { timeout: 8000 },
    );

    const lockedAfter = await page.$$eval('nav.rail li button', (els) =>
      els.map((e) => (e as HTMLButtonElement).disabled),
    );
    expect(lockedAfter).toEqual([false, false, false, true, true]);
    expect(uncaught).toEqual([]);
    await page.close();
  }, 20_000);
});

/**
 * Step 2, driven in a real engine over the built bundle. The transcript is
 * stubbed rather than read from disk — this file drives the panel, and
 * `service/src/transcript-view.test.ts` covers the derivation against the real
 * plans.
 */
const TRANSCRIPT = {
  reel: 'vitasilk',
  planPath: '/v/p.json',
  transcriptHash: 'abc123',
  editCost: 'Editing a word changes the transcript hash, so the caches will miss.',
  words: [
    {
      id: 'w0000', text: 'filler', sourceText: 'filler', start: 0.1, end: 0.4,
      script: 'latin', lang: 'fr', confidence: 0.95, removed: false, removedReason: null,
      edited: false, cardId: 'g001', interpolated: false,
    },
    {
      id: 'w0001', text: 'ترطيب', sourceText: 'ترطيب', start: 0.5, end: 0.8,
      script: 'arabic', lang: 'msa', confidence: 0.62, removed: false, removedReason: null,
      edited: false, cardId: 'g002', interpolated: false,
    },
    {
      id: 'w0002', text: '26', sourceText: null, start: 1.0, end: 1.0,
      script: 'latin', lang: 'darija', confidence: null, removed: false, removedReason: null,
      edited: false, cardId: 'g003', interpolated: true,
    },
    {
      id: 'w0003', text: 'euh', sourceText: 'euh', start: 1.2, end: 1.3,
      script: 'latin', lang: 'fr', confidence: 0.4, removed: true, removedReason: 'filler',
      edited: false, cardId: null, interpolated: false,
    },
  ],
  cards: [
    { id: 'g001', wordIds: ['w0000'], start: 0.1, end: 0.4, displayStart: 0.1, displayEnd: 0.5, templateId: 'sub_pop', supersededBy: null, holdClipped: false, shortByS: null },
    { id: 'g002', wordIds: ['w0001'], start: 0.5, end: 0.8, displayStart: 0.5, displayEnd: 0.9, templateId: 'sub_pop_ar', supersededBy: null, holdClipped: true, shortByS: 0.07 },
    { id: 'g003', wordIds: ['w0002'], start: 1.0, end: 1.0, displayStart: 1.0, displayEnd: 1.2, templateId: 'sub_pop', supersededBy: null, holdClipped: false, shortByS: null },
  ],
  questions: [
    {
      id: 'overlong', label: 'Words too long for their card',
      question: 'Shrink, break, or overflow?', basis: 'A proxy for a width measured in After Effects.',
      proxy: true, wordIds: ['w0001'], count: 1, corpusCount: 7,
      instances: [{ wordIds: ['w0001'], text: 'ترطيب', detail: '11 characters against a 11-character threshold, in card g002.' }],
    },
    {
      id: 'clipped', label: 'Cards whose hold is clipped',
      question: 'Accept, lengthen, or merge?', basis: "From the plan's timings.",
      proxy: false, wordIds: ['w0001'], count: 1, corpusCount: 23,
      instances: [{ wordIds: ['w0001'], text: 'ترطيب', detail: '0.05s long but sub_pop needs 0.12s (intro 0.13 + hold 0.1 + outro 0) (short by 0.07s)' }],
    },
    {
      id: 'split-term', label: 'Arabic terms split across cards',
      question: 'Group whole, or accept?', basis: 'Consecutive Arabic words.',
      proxy: false, wordIds: [], count: 0, corpusCount: 13, instances: [],
    },
  ],
};

describe.skipIf(!built)('the transcript editor', () => {
  async function loadTranscript(): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      window.__transcript = ${JSON.stringify(TRANSCRIPT)};
      const realFetch = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url);
        if (u.indexOf('/transcript/word') !== -1) {
          const body = JSON.parse(init.body);
          const word = window.__transcript.words.find((w) => w.id === body.wordId);
          const next = Object.assign({}, word, { edited: true },
            body.text === undefined ? {} : { text: body.text },
            body.script === undefined ? {} : { script: body.script },
            body.restore ? { removed: false, removedReason: null } : {});
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ word: next, hash: 'def456' }) });
        }
        if (u.indexOf('/transcript') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__transcript) });
        }
        return realFetch(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.rail', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Reel"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');
    await page.click('nav.rail li:nth-child(2) button');
    await page.waitForSelector('ol.words li', { timeout: 5000 });
    return { page, uncaught };
  }

  it('shows every word with its interval', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    expect(await loaded.page.$$eval('ol.words li', (els) => els.length)).toBe(4);
    expect((await loaded.page.textContent('ol.words')) ?? '').toContain('0.100–0.400s');
    await loaded.page.close();
  });

  /*
   * The direction is set on the token, never the line. A container `dir` would
   * reorder the Latin words around an Arabic one, which is the failure the
   * per-token rule exists to prevent.
   */
  it('sets direction per token, not on the row or the list', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const dirs = await loaded.page.evaluate(() => {
      const read = (sel: string): string | null =>
        document.querySelector(sel)?.getAttribute('dir') ?? null;
      const words = [...document.querySelectorAll('ol.words li')];
      return {
        list: read('ol.words'),
        row: words[0]?.getAttribute('dir') ?? null,
        latin: words[0]?.querySelector('.wtext')?.getAttribute('dir') ?? null,
        arabic: words[1]?.querySelector('.wtext')?.getAttribute('dir') ?? null,
      };
    });
    expect(dirs.list).toBeNull();
    expect(dirs.row).toBeNull();
    expect(dirs.latin).toBe('ltr');
    expect(dirs.arabic).toBe('rtl');
    await loaded.page.close();
  });

  it('marks an interpolated word and shows the draft token for an anchored one', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('ol.words')) ?? '';
    expect(text).toContain('interpolated');
    expect(text).toContain('ترطيب');
    await loaded.page.close();
  });

  it('bands confidence without using the brand accent', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const bands = await loaded.page.evaluate(() => {
      const norm = (c: string): string => c.replace(/\s/g, '');
      return [...document.querySelectorAll('ol.words .wtext')].map((el) => ({
        cls: [...el.classList].find((c) => c.startsWith('conf-')) ?? null,
        border: norm(getComputedStyle(el).borderBottomColor),
      }));
    });
    expect(bands.map((b) => b.cls)).toEqual(['conf-high', 'conf-low', 'conf-none', 'conf-low']);
    for (const band of bands) expect(band.border).not.toBe('rgb(237,28,36)');
    await loaded.page.close();
  });

  it('shows a removed word struck through with its reason, and restores it', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const struck = await loaded.page.evaluate(() => {
      const li = document.querySelectorAll('ol.words li')[3] as HTMLElement;
      const word = li.querySelector('.wtext') as HTMLElement;
      return { text: li.textContent, decoration: getComputedStyle(word).textDecorationLine };
    });
    expect(struck.decoration).toContain('line-through');
    expect(struck.text).toContain('filler');

    await loaded.page.click('ol.words li:nth-child(4) button.chip');
    await loaded.page.waitForFunction(
      () => (document.querySelectorAll('ol.words li')[3] as HTMLElement).className.includes('removed') === false,
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  it('edits a word and marks it edited', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    await loaded.page.click('ol.words li:nth-child(1) button.wtext');
    await loaded.page.fill('input.wtext', 'remplissage');
    await loaded.page.keyboard.press('Enter');
    await loaded.page.waitForFunction(
      () => (document.querySelector('ol.words') as HTMLElement).textContent?.includes('remplissage') === true,
      undefined,
      { timeout: 5000 },
    );
    expect((await loaded.page.textContent('ol.words')) ?? '').toContain('edited');
    await loaded.page.close();
  });

  /* Said before he types, not discovered on the next bill. */
  it('warns what an edit costs before anything is edited', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    expect((await loaded.page.textContent('main')) ?? '').toContain(
      'changes the transcript hash',
    );
    await loaded.page.close();
  });

  /*
   * The screen read 1, 5 and 0 for vitasilk while the record said 7, 23 and 13.
   * Both were right — one per reel, one over the corpus — and the button said
   * neither. It says both now.
   */
  it('names the scope of every count, and marks a proxy as one', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('ul.questions')) ?? '';
    expect(text).toContain('1 this reel');
    expect(text).toContain('7 corpus');
    expect(text).toContain('23 corpus');
    expect(text).toContain('13 corpus');
    // Only the overlong count stands in for a measurement it cannot take.
    expect((text.match(/proxy/g) ?? []).length).toBe(1);
    await loaded.page.close();
  });

  it('shows the evidence behind an instance, not only its category', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    await loaded.page.click('ul.questions li:nth-child(2) button.chip');
    await loaded.page.waitForSelector('ul.instances li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ul.instances')) ?? '';
    expect(text).toContain('0.05s long but sub_pop needs 0.12s');
    expect(text).toContain('short by 0.07s');
    await loaded.page.close();
  });

  it('says plainly when a question has none on this reel', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    await loaded.page.click('ul.questions li:nth-child(3) button.chip');
    await loaded.page.waitForFunction(
      () => (document.querySelector('ul.questions') as HTMLElement).textContent?.includes('None on this reel') === true,
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  it('shows the three questions with their counts, and filters to the words', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('ul.questions')) ?? '';
    expect(text).toContain('Words too long for their card');
    expect(text).toContain('Cards whose hold is clipped');
    expect(text).toContain('Arabic terms split across cards');

    await loaded.page.click('ul.questions li:nth-child(1) button.chip');
    await loaded.page.waitForFunction(
      () => document.querySelectorAll('ol.words li').length === 1,
      undefined,
      { timeout: 5000 },
    );
    expect((await loaded.page.textContent('ol.words')) ?? '').toContain('ترطيب');
    // The question is asked, not answered.
    expect((await loaded.page.textContent('ul.questions')) ?? '').toContain('?');
    await loaded.page.close();
  });

  /*
   * The script toggle. Neither hash covers `script`, so this edit is free where
   * a text edit costs — and the pane says which is which, because a free edit
   * and a paid one must not look alike.
   */
  it('flips a word’s script and its direction with it', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const before = await loaded.page.getAttribute('ol.words li:nth-child(1) .wtext', 'dir');
    expect(before).toBe('ltr');

    await loaded.page.click('ol.words li:nth-child(1) button[aria-label="Script of w0000"]');
    await loaded.page.waitForFunction(
      () =>
        document.querySelector('ol.words li:nth-child(1) .wtext')?.getAttribute('dir') === 'rtl',
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  it('says what flipping the script does, and that it is free', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('Inter Semi-Bold for Latin');
    expect(text).toContain('Almarai Bold at 1.07');
    expect(text).toContain('costs nothing on a re-run');
    await loaded.page.close();
  });

  it('renders with no uncaught errors', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });
});

/**
 * Step 3, over the built bundle. The service half is tested against the real
 * plans in `service/src/keyword-view.test.ts`; this drives the panel.
 */
const KEYWORDS = {
  reel: 'vitasilk',
  planPath: '/v/p.json',
  subtitleFontSize: 343,
  keywordFontSize: 425,
  emptyReason: null,
  source: {
    stageStatus: 'done',
    cacheEntryId: 'analysis-324f3a034ef9c903',
    cacheProvenance: 'exact',
    promptVersion: 4,
    mode: 'auto',
  },
  keywords: [
    {
      id: 'k001', wordIds: ['w0021'], text: 'filler glow', cardId: 'g022',
      start: 6.98, end: 7.579, reason: 'names the specific product being promoted',
      score: 0.95, kind: 'label', script: 'latin', templateId: 'kw_slam',
      fontSize: 425, edited: false,
    },
    {
      id: 'k002', wordIds: ['w0030'], text: 'ترطيب', cardId: 'g031',
      start: 9.1, end: 9.6, reason: '', score: 1, kind: null, script: 'arabic',
      templateId: 'kw_slam_ar', fontSize: 425, edited: true,
    },
  ],
  promotable: [
    { wordId: 'w0000', text: '5', cardId: 'g001', script: 'latin', start: 0.1, end: 0.4 },
    { wordId: 'w0001', text: 'd9ay9', cardId: 'g002', script: 'latin', start: 0.5, end: 0.9 },
  ],
};

describe.skipIf(!built)('the keyword picker', () => {
  async function loadKeywords(payload: unknown = KEYWORDS): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      window.__keywords = ${JSON.stringify(payload)};
      const realFetch = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url);
        if (u.indexOf('/keywords/remove') !== -1) {
          const body = JSON.parse(init.body);
          window.__keywords = Object.assign({}, window.__keywords, {
            keywords: window.__keywords.keywords.filter((k) => k.id !== body.keywordId),
          });
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__keywords) });
        }
        if (u.indexOf('/keywords/add') !== -1) {
          const body = JSON.parse(init.body);
          const word = window.__keywords.promotable.find((w) => w.wordId === body.wordId);
          const added = {
            id: 'k900', wordIds: [word.wordId], text: word.text, cardId: word.cardId,
            start: word.start, end: word.end, reason: '', score: 1, kind: null,
            script: word.script, templateId: 'kw_slam', fontSize: 425, edited: true,
          };
          window.__keywords = Object.assign({}, window.__keywords, {
            keywords: window.__keywords.keywords.concat([added]),
            promotable: window.__keywords.promotable.filter((w) => w.wordId !== body.wordId),
          });
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__keywords) });
        }
        if (u.indexOf('/keywords') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__keywords) });
        }
        return realFetch(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.rail', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Reel"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');
    await page.click('nav.rail li:nth-child(3) button');
    await page.waitForSelector('main h2', { timeout: 5000 });
    return { page, uncaught };
  }

  it('shows each keyword with its card, template and size', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.keywords')) ?? '';
    expect(text).toContain('filler glow');
    expect(text).toContain('g022');
    expect(text).toContain('kw_slam');
    expect(text).toContain('425');
    expect(text).toContain('names the specific product being promoted');
    await loaded.page.close();
  });

  /*
   * The user removed the hits in Block 8 session 27. The picker showed the
   * binding and, when there was none, said why — both are gone, because a
   * keyword now has no sound to have or to lack.
   */
  it('says nothing about sound, in either direction', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.keywords')) ?? '';
    expect(text).not.toContain('sfx');
    expect(text).not.toContain('hit_01');
    expect(text).not.toContain('dB');
    expect(await loaded.page.$$('ol.keywords button[aria-label^="Play"]')).toHaveLength(0);
    await loaded.page.close();
  });

  /* The variant follows the script, and so does the direction. */
  it('sets direction per keyword and shows the Arabic variant', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    const dirs = await loaded.page.$$eval('ol.keywords .ktext', (els) =>
      els.map((e) => e.getAttribute('dir')),
    );
    expect(dirs).toEqual(['ltr', 'rtl']);
    expect((await loaded.page.textContent('ol.keywords')) ?? '').toContain('kw_slam_ar');
    await loaded.page.close();
  });

  it('says a hand-promoted keyword had no reason from the analysis', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    expect((await loaded.page.textContent('ol.keywords')) ?? '').toContain('promoted by hand');
    await loaded.page.close();
  });

  it('names where the choice came from', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('analysis prompt v4');
    expect(text).toContain('analysis-324f3a034ef9c903');
    await loaded.page.close();
  });

  it('removes a keyword', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    await loaded.page.click('button[aria-label="Remove k001"]');
    await loaded.page.waitForFunction(
      () => document.querySelectorAll('ol.keywords li').length === 1,
      undefined,
      { timeout: 5000 },
    );
    expect((await loaded.page.textContent('ol.keywords')) ?? '').not.toContain('filler glow');
    await loaded.page.close();
  });

  it('promotes a word to a keyword', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    await loaded.page.click('button.chip:text("Emphasise another word")');
    await loaded.page.click('button[aria-label="Emphasise w0000"]');
    await loaded.page.waitForFunction(
      () => document.querySelectorAll('ol.keywords li').length === 3,
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  /*
   * A reel with no keywords says **why**. "Analysis has not run" and "analysis
   * ran and chose none" are different facts and an empty list states neither.
   */
  it('says why a reel has no keywords', async () => {
    const loaded = await loadKeywords({
      ...KEYWORDS,
      keywords: [],
      emptyReason: 'Keyword analysis has not run for this reel yet (stage is "pending").',
    });
    if (loaded === null) return;
    await loaded.page.waitForFunction(
      () => (document.querySelector('main') as HTMLElement).textContent?.includes('has not run') === true,
      undefined,
      { timeout: 5000 },
    );
    expect(await loaded.page.$$eval('ol.keywords li', (els) => els.length)).toBe(0);
    await loaded.page.close();
  });

  it('renders with no uncaught errors', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });
});

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

  /*
   * Keywords was the example until session 20 built it, then Images until
   * session 30. **Every step is built now**, so the empty state has no step
   * left to demonstrate — what is asserted instead is that a step which is
   * built renders its own content rather than the placeholder, which is the
   * property the old test was really protecting.
   */
  it('renders a built step rather than the not-built-yet placeholder', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    await loaded.page.click('nav.rail li:nth-child(4) button');
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).not.toContain('This step is not built yet.');
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

/*
 * Step 4, the image candidate picker. The fixture mirrors `vitasilk` as the
 * service reports it: one slot whose two candidates the gate rejected, one it
 * passed, and one with nothing generated. The rejections are the point — the
 * gate's yield on the real reel is 2 of 10.
 */
const IMAGES = {
  reel: 'vitasilk',
  planPath: '/v/vitasilk.editplan.json',
  generationEstimateUsd: 1.45,
  generationNote: 'a run would generate 8, budgeted at most $1.45',
  reelSpentUsd: 1.550444,
  cardFrameForced: true,
  source: {
    clientMode: 'k2-syndicalia',
    clientModeVersion: 5,
    stageStatus: 'done',
    cacheEntryId: 'images-699c0a38a9c512ff',
    cacheProvenance: 'exact',
  },
  slots: [
    {
      id: 'img001',
      start: 0.099,
      end: 1.599,
      idea: 'A single cosmetic bottle on a dark podium',
      presentation: 'card',
      rendersAsCutout: false,
      nothingIsMeasured: true,
      templateId: 'img_float',
      zoneId: 'z_left_4',
      chosenCandidateId: null,
      overriddenFailures: [],
      placedSidePx: 912,
      placementLimit: 'the space above the speaker',
      buildsWith: 'img001-c1',
      buildsWithReason: 'first candidate, nothing chosen',
      candidates: [
        {
          id: 'img001-c1',
          imagePath: '/v/img001-c1.jpg',
          imageExists: true,
          cutoutPath: '/v/img001-c1.cutout.png',
          cutoutExists: true,
          renderedPath: '/v/img001-c1.jpg',
          renderedExists: true,
          modelId: 'gemini-3-pro-image',
          resolution: '2K',
          generatedAt: '2026-08-25T17:43:32.870Z',
          costUsd: 0,
          metrics: { alphaEdgeNoise: 0, holeRatio: 0, foregroundArea: 0.3178, edgeHalo: 0.1004 },
          cutoutQuality: 0,
          qualityApplies: false,
          backgroundCameAwayCleanly: null,
          problems: [],
          gatePassed: false,
          gateFailures: ['edge_halo 0.1004 > 0.1'],
          unexpectedText: [],
          chosen: false,
        },
        {
          id: 'img001-c2',
          imagePath: '/v/img001-c2.jpg',
          imageExists: true,
          cutoutPath: null,
          cutoutExists: false,
          renderedPath: '/v/img001-c2.jpg',
          renderedExists: true,
          modelId: 'gemini-3-pro-image',
          resolution: '2K',
          generatedAt: '2026-08-25T17:44:02.870Z',
          costUsd: 0,
          metrics: { alphaEdgeNoise: 0, holeRatio: 0, foregroundArea: 0.31, edgeHalo: 0.1187 },
          cutoutQuality: 0,
          qualityApplies: false,
          backgroundCameAwayCleanly: null,
          problems: [],
          gatePassed: false,
          gateFailures: ['edge_halo 0.1187 > 0.1'],
          unexpectedText: ['SERUM'],
          chosen: false,
        },
      ],
    },
    {
      id: 'img002',
      start: 6.259,
      end: 8.859,
      idea: 'A salon interior',
      presentation: 'cutout',
      rendersAsCutout: true,
      nothingIsMeasured: false,
      templateId: 'img_slide_left',
      zoneId: 'z_left_2',
      chosenCandidateId: null,
      overriddenFailures: [],
      buildsWith: 'img002-c1',
      buildsWithReason: 'first candidate, nothing chosen',
      candidates: [
        {
          id: 'img002-c1',
          imagePath: '/v/img002-c1.jpg',
          imageExists: true,
          cutoutPath: '/v/img002-c1.cutout.png',
          cutoutExists: true,
          renderedPath: '/v/img002-c1.cutout.png',
          renderedExists: true,
          modelId: 'gemini-3-pro-image',
          resolution: '2K',
          generatedAt: '2026-08-25T17:45:02.870Z',
          costUsd: 0,
          metrics: { alphaEdgeNoise: 0, holeRatio: 0, foregroundArea: 0.2, edgeHalo: 0.08 },
          cutoutQuality: 0.174,
          qualityApplies: true,
          backgroundCameAwayCleanly: true,
          problems: [],
          gatePassed: true,
          gateFailures: [],
          unexpectedText: [],
          chosen: false,
        },
      ],
    },
    {
      id: 'img003',
      start: 11.6,
      end: 13.9,
      idea: 'A close-up of hair',
      presentation: null,
      rendersAsCutout: false,
      nothingIsMeasured: true,
      templateId: null,
      zoneId: null,
      chosenCandidateId: null,
      overriddenFailures: [],
      buildsWith: null,
      buildsWithReason: 'no candidates',
      candidates: [],
    },
  ],
};

async function loadImages(payload: unknown = IMAGES): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
  await page.addInitScript(`
    window.__images = ${JSON.stringify(payload)};
    const realFetch = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      if (u.indexOf('/images/choose') !== -1) {
        const body = JSON.parse(init.body);
        window.__images = Object.assign({}, window.__images, {
          slots: window.__images.slots.map((s) => {
            if (s.id !== body.slotId) return s;
            const picked = s.candidates.find((c) => c.id === body.candidateId) || null;
            return Object.assign({}, s, {
              chosenCandidateId: body.candidateId,
              buildsWith: body.candidateId || (s.candidates[0] && s.candidates[0].id) || null,
              buildsWithReason: body.candidateId ? 'chosen' : 'first candidate, nothing chosen',
              overriddenFailures:
                picked && picked.gatePassed === false ? picked.gateFailures : [],
              candidates: s.candidates.map((c) =>
                Object.assign({}, c, { chosen: c.id === body.candidateId }),
              ),
            });
          }),
        });
        return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__images) });
      }
      if (u.indexOf('/images') !== -1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__images) });
      }
      return realFetch(url, init);
    };
  `);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.rail', { timeout: 10_000 });
  await page.selectOption('select[aria-label="Reel"]', 'vitasilk');
  await page.selectOption('select[aria-label="Client mode"]', 'k2-syndicalia');
  await page.click('nav.rail li:nth-child(4) button');
  await page.waitForSelector('main h2', { timeout: 5000 });
  return { page, uncaught };
}

describe('the image candidate picker', () => {
  it('shows every candidate, including the ones the gate did not like', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('img001-c1');
    expect(text).toContain('img001-c2');
    expect(await loaded.page.$$('ol.slots li.candidate')).toHaveLength(3);
    await loaded.page.close();
  });

  /*
   * The cutout metrics measure how cleanly a background came away, which is a
   * property of a slot that shows a cut-out subject. Four of `vitasilk`'s five
   * do not, and all eight of the corpus's rejections were of that kind.
   */
  it('judges the background only where the background is removed', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    // The cutout slot's candidate is judged, in words.
    expect(text).toContain('background came away cleanly');
    // The card slots' candidates are not, and their thresholds are not on screen.
    expect(text).not.toContain('edge_halo');
    expect(text).not.toContain('gate rejected');
    expect(text).toContain('Nothing is checked automatically about these pictures');
    await loaded.page.close();
  });

  it('says what the builder would use, and that nothing is chosen yet', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('first candidate, nothing chosen');
    await loaded.page.close();
  });

  it('records choosing a rejected candidate as an override', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    await loaded.page.click('button[aria-label="Choose img001-c1"]');
    await loaded.page.waitForSelector('li.candidate.chosen', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('Overrides the gate: edge_halo 0.1004 > 0.1');
    expect(text).toContain('img001-c1 — chosen');
    await loaded.page.close();
  });

  /*
   * The picker showed a cut-out on grey for every candidate, which on four of
   * `vitasilk`'s five slots is a version of the picture that never gets built.
   * What it shows now is the file the build places.
   */
  it('shows the picture the build will place, not the cut-out of it', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const built = await loaded.page.$$eval('img.shot.built', (els) =>
      els.map((e) => (e as HTMLImageElement).getAttribute('src')),
    );
    // The card slot's own picture, and the cutout slot's cut-out.
    expect(built).toContain('file:///v/img001-c1.jpg');
    expect(built).toContain('file:///v/img002-c1.cutout.png');
    // A card slot shows one picture, not the same file twice.
    expect(built.filter((s) => s === 'file:///v/img001-c1.jpg')).toHaveLength(1);
    await loaded.page.close();
  });

  it('says in plain words which slots have their background removed', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('shown with its background removed');
    expect(text).toContain('shown whole, inside a frame');
    await loaded.page.close();
  });

  /* The raw picture is evidence, and only where it differs from the build. */
  it('offers the picture before the background was removed, on a cutout slot only', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const raws = await loaded.page.$$('figure.rawshot');
    expect(raws).toHaveLength(1);
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('before the background was removed');
    await loaded.page.close();
  });

  /*
   * **The session 31 defect, reproduced.** The panel is reloaded from
   * `panel/dist` while the service is a long-running process, so the bundle can
   * be newer than the service it talks to. Against one started before
   * `renderedPath` existed, every candidate read "this picture is missing from
   * the disk" — a claim of data loss about ten files that were all present.
   */
  it('still shows the pictures when the service is older than the panel', async () => {
    const older = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    for (const slot of older.slots) {
      delete (slot as Record<string, unknown>)['rendersAsCutout'];
      delete (slot as Record<string, unknown>)['nothingIsMeasured'];
      for (const candidate of slot.candidates) {
        delete (candidate as Record<string, unknown>)['renderedPath'];
        delete (candidate as Record<string, unknown>)['renderedExists'];
        delete (candidate as Record<string, unknown>)['qualityApplies'];
      }
    }
    const loaded = await loadImages(older);
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).not.toContain('no longer on the disk');
    expect(text).not.toContain('could not work out which picture');
    const shown = await loaded.page.$$eval('img.shot.built', (els) =>
      els.map((e) => (e as HTMLImageElement).getAttribute('src')),
    );
    // Three candidates, each falling back to the rule the builder uses.
    expect(shown).toHaveLength(3);
    expect(shown).toContain('file:///v/img001-c1.jpg');
    expect(shown).toContain('file:///v/img002-c1.cutout.png');
    await loaded.page.close();
  });

  /* A path that is gone and a path the panel was never given are not the same
     fact, and only one of them is about the disk. */
  it('says a picture is gone only when the service says it is gone', async () => {
    const gone = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    (gone.slots[0]?.candidates[0] as Record<string, unknown>)['renderedExists'] = false;
    const loaded = await loadImages(gone);
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('no longer on the disk');
    expect(await loaded.page.$$('img.shot.built')).toHaveLength(2);
    await loaded.page.close();
  });

  it('blames the tool, not the disk, when it was told no path at all', async () => {
    const bare = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    for (const candidate of bare.slots[0]?.candidates ?? []) {
      const c = candidate as Record<string, unknown>;
      delete c['renderedPath'];
      delete c['renderedExists'];
      c['imagePath'] = '';
      c['cutoutPath'] = null;
    }
    const loaded = await loadImages(bare);
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('could not work out which picture');
    expect(text).not.toContain('no longer on the disk');
    await loaded.page.close();
  });

  /* Every cutout in the corpus lives under `my files/test videos/`. */
  it('encodes the spaces in a real path', async () => {
    const spaced = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    (spaced.slots[0]?.candidates[0] as Record<string, unknown>)['renderedPath'] =
      '/Volumes/T7 Shield/my files/test videos/cutouts/a.png';
    const loaded = await loadImages(spaced);
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const shown = await loaded.page.$$eval('img.shot.built', (els) =>
      els.map((e) => (e as HTMLImageElement).getAttribute('src')),
    );
    expect(shown).toContain('file:///Volumes/T7%20Shield/my%20files/test%20videos/cutouts/a.png');
    await loaded.page.close();
  });

  /*
   * Images sit in the top-left corner on every reel, so there is no position to
   * choose. What the picker can honestly say is how big the picture is and what
   * limits it — the number behind "make them bigger".
   */
  it('says how big the picture is and what limits it', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('Sits in the top-left corner');
    expect(text).toContain('912 px');
    expect(text).toContain('the space above the speaker');
    // No schema in sight, and no control over a choice nobody makes.
    expect(text).not.toContain('z_left');
    expect(await loaded.page.$$('button[aria-label^="Put img001"]')).toHaveLength(0);
    await loaded.page.close();
  });

  /* A service too old to send the size must not make the panel invent one. */
  it('says nothing about size when the service does not offer it', async () => {
    const older = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    for (const slot of older.slots) {
      delete (slot as Record<string, unknown>)['placedSidePx'];
      delete (slot as Record<string, unknown>)['placementLimit'];
    }
    const loaded = await loadImages(older);
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).not.toContain('Sits in the top-left corner');
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });

  it('says what a slot with nothing generated would cost', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('Nothing generated for this slot');
    expect(text).toContain('$1.45');
    await loaded.page.close();
  });

  /* PROJECT_SPEC §6 spends the brand red on Run pipeline alone. */
  it('marks the chosen candidate without the brand accent', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    await loaded.page.click('button[aria-label="Choose img001-c1"]');
    await loaded.page.waitForSelector('li.candidate.chosen', { timeout: 5000 });
    const colour = await loaded.page.$eval(
      'li.candidate.chosen',
      (el) => getComputedStyle(el).borderColor,
    );
    expect(colour).not.toContain('237, 28, 36');
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });
});

/*
 * Three watermark sizes, the user's per-reel choice. Driven through the built
 * bundle because that is the only place a CEP-shaped engine sees them, and
 * because the size arrives from the service — a bundle newer than the service
 * it talks to must not invent a choice.
 */
describe.skipIf(!built)('watermark size', () => {
  it('offers three sizes with the reel’s own marked', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.watermark .sizes', { timeout: 5000 });
      const labels = await loaded.page.$$eval('.watermark .sizes button', (els) =>
        els.map((e) => `${e.textContent ?? ''}|${e.getAttribute('aria-pressed') ?? ''}`),
      );
      expect(labels).toEqual([
        'Small · 216 px|false',
        'Medium · 324 px|true',
        'Large · 432 px|false',
      ]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('moves the mark when another size is pressed', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.watermark .sizes', { timeout: 5000 });
      await loaded.page.click('.watermark .sizes button:nth-child(3)');
      await loaded.page.waitForFunction(
        () =>
          document
            .querySelector('.watermark .sizes button:nth-child(3)')
            ?.getAttribute('aria-pressed') === 'true',
        undefined,
        { timeout: 5000 },
      );
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* A service too old to send the size must not have one invented for it. */
  it('shows no sizes when the service does not offer them', async () => {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      'delete window.__payload.dry.watermarkSize;' +
        'delete window.__payload.dry.watermarkWidthsPx;',
    );
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.watermark', { timeout: 5000 });
      expect(await loaded.page.$$('.watermark .sizes button')).toHaveLength(0);
      expect(await loaded.page.$$('.watermark input[type="checkbox"]')).toHaveLength(1);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * Step 5, the Build control. It drives the After Effects the panel is running
 * inside, so nothing here presses it against a real service — these assert what
 * the pane says before, during and after, which is what the user reads.
 */
function stubBuildJob(state: 'running' | 'done' | 'refused'): string {
  const stages = [
    { id: 'prepare', label: 'Read the plan and resolve everything it names', state: 'done' },
    { id: 'after-effects', label: 'Build the composition in After Effects', state: state === 'running' ? 'running' : 'done' },
    { id: 'check', label: 'Check the built comp against the plan', state: state === 'done' ? 'done' : 'waiting' },
  ];
  const detail = {
    reel: 'vitasilk', planPath: '/v/p.json', stages,
    percent: state === 'done' ? 1 : 0.33,
    done: state === 'done',
    savePath: state === 'done' ? '/repo/.local/build/vitasilk-full.aep' : null,
    savedOwnOutput: state === 'done' ? '/repo/.local/build/vitasilk-full.aep' : null,
    wallS: state === 'done' ? 1.3 : null,
    error: null,
  };
  const job = {
    id: 'job-1',
    status: state === 'running' ? 'running' : state === 'done' ? 'done' : 'error',
    progress: detail.percent,
    detail,
    ...(state === 'refused'
      ? {
          error:
            'build refused at start: the open After Effects project has unsaved changes: ' +
            '/Users/x/mine.aep. This will not close it. Save or close it yourself, then run it again.',
        }
      : {}),
  };
  return `window.__job = () => (${JSON.stringify(job)});`;
}

describe.skipIf(!built)('the Build step', () => {
  async function openBuild(jobState?: 'running' | 'done' | 'refused'): Promise<Loaded | null> {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      jobState === undefined ? undefined : stubBuildJob(jobState),
    );
    if (loaded === null) return null;
    await loaded.page.click('nav.rail li:nth-child(5) button');
    await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
    return loaded;
  }

  it('says what will be built, where it goes, and that it is free', async () => {
    const loaded = await openBuild();
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('K2 Syndicalia');
      expect(text).toContain('the client recorded on the plan');
      expect(text).toContain('68 subtitle cards');
      expect(text).toContain('3 emphasised keywords');
      expect(text).toContain('5 images');
      expect(text).toContain('4 sounds');
      expect(text).toContain('Watermark medium, 324 × 363 px');
      expect(text).toContain('Inter Semi-Bold');
      expect(text).toContain('/repo/.local/build/vitasilk-full.aep');
      expect(text).toContain('Building is free');
      // A field name is not a label.
      expect(text).not.toContain('planPath');
      expect(text).not.toContain('savePath');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('runs the build and shows the stages going past', async () => {
    const loaded = await openBuild('running');
    if (loaded === null) return;
    try {
      await loaded.page.click('button.build-now');
      await loaded.page.waitForSelector('.buildpane ol.stages li.running', { timeout: 5000 });
      const labels = await loaded.page.$$eval('.buildpane ol.stages li', (els) =>
        els.map((e) => `${e.className}|${e.textContent ?? ''}`),
      );
      expect(labels).toEqual([
        'done|Read the plan and resolve everything it names',
        'running|Build the composition in After Effects',
        'waiting|Check the built comp against the plan',
      ]);
      expect(await loaded.page.textContent('button.build-now')).toContain('Building');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('names the file it wrote, and does not offer to open it', async () => {
    const loaded = await openBuild('done');
    if (loaded === null) return;
    try {
      await loaded.page.click('button.build-now');
      await loaded.page.waitForSelector('.buildpane [role="status"]', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('Built in 1.3s');
      expect(text).toContain('Saved to /repo/.local/build/vitasilk-full.aep');
      expect(text).toContain('Nothing was rendered');
      expect(text).toContain('your previous build was open'.replace('your', 'Your'));
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* The guard's refusal is an instruction, and reaches him as one. */
  it('shows the unsaved-changes refusal as a sentence he can act on', async () => {
    const loaded = await openBuild('refused');
    if (loaded === null) return;
    try {
      await loaded.page.click('button.build-now');
      await loaded.page.waitForSelector('.buildpane [role="alert"]', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane [role="alert"]')) ?? '';
      expect(text).toContain('unsaved changes');
      expect(text).toContain('/Users/x/mine.aep');
      expect(text).toContain('Save or close it yourself');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* A service older than the preview must not have one invented for it. */
  it('says so when the service is too old to describe the build', async () => {
    const loaded = await loadFlow(
      'build', 'build', 420, 'delete window.__payload.steps.build;',
    );
    if (loaded === null) return;
    try {
      await loaded.page.click('nav.rail li:nth-child(5) button');
      await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('older than the Build control');
      expect(await loaded.page.$eval('button.build-now', (b) => (b as HTMLButtonElement).disabled)).toBe(true);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* PROJECT_SPEC §6 spends the brand red on Run pipeline alone. */
  it('does not paint Build in the brand accent', async () => {
    const loaded = await openBuild();
    if (loaded === null) return;
    try {
      const colours = await loaded.page.$eval('button.build-now', (el) => {
        const s = getComputedStyle(el);
        return `${s.backgroundColor}|${s.borderTopColor}|${s.color}`;
      });
      expect(colours).not.toContain('237, 28, 36');
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});
