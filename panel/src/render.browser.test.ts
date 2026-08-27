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
