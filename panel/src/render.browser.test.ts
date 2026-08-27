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
function stubHost(files: Record<string, string>, repo = '/repo'): string {
  return `
  window.__repo = ${JSON.stringify(repo)};
  window.__files = ${JSON.stringify(files)};
  // CEP's mixed context puts Node's process global on the page; host.ts reads
  // it for processAlive, so a stub without it is not a faithful stub.
  window.process = window.process || { kill: function () { return true; } };
  window.cep_node = {
    global: {},
    require: (id) => {
      if (id === 'path') {
        return {
          // Faithful enough for the one call the panel makes:
          // resolve('<extension>', '..') is the repo root.
          resolve: (base, rel) =>
            rel === '..' ? base.split('/').slice(0, -1).join('/') : base,
          join: (...p) => p.join('/'),
        };
      }
      if (id === 'fs') {
        return {
          existsSync: (p) => Object.prototype.hasOwnProperty.call(window.__files, p),
          readFileSync: (p) => window.__files[p],
          readdirSync: () => [],
          realpathSync: (p) => p,
        };
      }
      if (id === 'os') return { homedir: () => '/home' };
      if (id === 'child_process') {
        return { spawn: () => ({ unref: () => {}, on: () => {}, stderr: null }) };
      }
      throw new Error('unexpected module ' + id);
    },
  };
  window.CSInterface = function () {};
  window.CSInterface.prototype.getSystemPath = function () { return window.__repo + '/panel'; };
`;
}

const HANDSHAKE = { '/repo/.local/service.json': JSON.stringify({ port: 51234, token: 't', pid: 4242 }) };

const HEALTHY_PAYLOAD = {
  ok: true,
  serviceVersion: '0.1.0',
  appVersion: '0.1.0',
  promptVersion: 4,
  ffmpeg: { present: true, detail: 'ffmpeg version 8.0.1' },
  ffprobe: { present: true, detail: 'ffprobe version 8.0.1' },
  sidecar: { venv: { present: true, detail: 'Python 3.11.14' }, pythonPath: '/p' },
  templates: { valid: true, issues: [], count: 6 },
  repoRoot: '/repo',
  node: { path: '/n/node', source: 'nvm' },
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
  } = {},
): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 420, height: 760 } });
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
    const loaded = await load({
      files: { ...HANDSHAKE, [LOGO]: '' },
      repo: REPO,
    });
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
