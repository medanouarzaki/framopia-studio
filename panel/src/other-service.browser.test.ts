import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  HANDSHAKE,
  HEALTHY_PAYLOAD,
  INDEX,
  built,
  stepsThrough,
  stubHost,
  stubRoutes,
} from './browser-harness.js';

/**
 * **A second background service, said on the screen.**
 *
 * Block 12 session 78 found one that had been listening since 2026-09-03 — six
 * days — with the handshake naming a different process. Session 79 proved the
 * service reports it, against a real second process; this is the sentence
 * reaching him, and the offer that stops nothing until it is pressed.
 *
 * Every assertion reads an extracted value. **No live Playwright handle is
 * held** — session 54 lost a run to vitest serialising one into a diff.
 */
let browser: Browser | undefined;
let launchFailure: string | null = null;

beforeAll(async () => {
  if (!built) return;
  try {
    browser = await chromium.launch();
  } catch (error) {
    launchFailure = (error as Error).message.split('\n')[0] ?? 'chromium would not launch';
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

const OTHER = { pid: 62058, startedAt: 'Thu Sep  3 23:07:41 2026' };

async function open(other: { pid: number; startedAt: string } | null): Promise<{
  page: Page;
  uncaught: string[];
} | null> {
  if (browser === undefined) {
    if (launchFailure !== null) throw new Error(launchFailure);
    return null;
  }
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  const uncaught: string[] = [];
  page.on('pageerror', (e) => uncaught.push(e.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(
    stubRoutes(stepsThrough('reel'), 'transcript', {
      health: { ...HEALTHY_PAYLOAD, otherService: other },
    }),
  );
  await page.addInitScript(`
    window.__asked = [];
    const realFetch = window.fetch;
    window.fetch = (url, init) => {
      window.__asked.push(String(url));
      return realFetch(url, init);
    };
  `);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('section.video', { timeout: 15_000 });
  return { page, uncaught };
}

describe.skipIf(!built)('a second background service', () => {
  it('says one is running, visibly, without naming a command', async () => {
    const loaded = await open(OTHER);
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.otherservice', { timeout: 15_000 });
      const said = await loaded.page.$eval('.otherservice .said', (p) => ({
        text: p.textContent ?? '',
        shown: (p as HTMLElement).checkVisibility(),
      }));
      expect(said.shown).toBe(true);
      expect(said.text).toContain('A second background service is running');
      expect(said.text).not.toMatch(/npm |terminal|quit|restart/i);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* Nothing is stopped until he presses: the offer is a button, not an effect. */
  it('stops nothing until the offer is pressed', async () => {
    const loaded = await open(OTHER);
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.otherservice', { timeout: 15_000 });
      const asked = await loaded.page.evaluate(() =>
        ((window as { __asked?: string[] }).__asked ?? []).filter(
          (u) => u.indexOf('/service/stop-other') !== -1,
        ),
      );
      expect(asked).toEqual([]);
      const label = await loaded.page.$eval('.otherservice button.ghost', (b) => b.textContent ?? '');
      expect(label).toContain('Stop the other one');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says nothing at all when there is only one service', async () => {
    const loaded = await open(null);
    if (loaded === null) return;
    try {
      const present = await loaded.page.$$eval('.otherservice', (els) => els.length);
      expect(present).toBe(0);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});
