import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  HANDSHAKE,
  INDEX,
  built,
  realMismatch,
  stepsThrough,
  stubHost,
  stubRoutes,
} from './browser-harness.js';

/**
 * **The notice on the screen, from a real mismatch.**
 *
 * Session 76 proved the rule and the wording, and asserted the panel's source.
 * This is the sentence rendering in a real browser, produced by the same
 * `mismatchedClient` the service calls, over the real client files.
 *
 * **Neither client has declared a video folder**, so the service would produce
 * no mismatch today. Dr Loubna is given the folder her footage sits in **in
 * memory only** — nothing is written to a client file, and both are byte
 * identical at the end of this session.
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

async function open(): Promise<{ page: Page; uncaught: string[] } | null> {
  if (browser === undefined) {
    if (launchFailure !== null) throw new Error(launchFailure);
    return null;
  }
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  const uncaught: string[] = [];
  page.on('pageerror', (e) => uncaught.push(e.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('reel'), 'transcript'));
  /* Every request the page makes, recorded, so "nothing happened" is a fact. */
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
  await page.selectOption('select[aria-label="Video"]', 'vitasilk');
  await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
  await page.waitForSelector('.wrongclient', { timeout: 15_000 });
  return { page, uncaught };
}

const mismatch = realMismatch();

describe.skipIf(!built)('a video whose client does not match, on screen', () => {
  /*
   * **The rule still produces one.** Session 73's rule: a skipped test must
   * never look like a passing one. If `whoseVideo` stopped finding the owner,
   * every assertion below would have nothing to compare and a `skipIf` on the
   * mismatch would have hidden it. This fails instead.
   */
  it('has a mismatch to draw at all', () => {
    expect(mismatch).not.toBeNull();
    expect(mismatch?.['says']).toContain('Dr Loubna Kfafi');
  });

  it('shows the sentence the rule produced, both names in it', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      /*
       * **Visible, not merely present.** Session 69 shipped a screen test that
       * passed over hidden text, because `textContent` returns it either way.
       */
      const said = await loaded.page.$eval('.wrongclient .said', (p) => ({
        text: p.textContent ?? '',
        shown: (p as HTMLElement).checkVisibility(),
      }));
      expect(said.shown).toBe(true);
      expect(said.text).toBe(mismatch?.['says']);
      expect(said.text).toContain('Dr Loubna Kfafi');
      expect(said.text).toContain('K2 Syndicalia');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says what pressing the offer would change', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const offer = await loaded.page.$eval('.wrongclient .offer', (p) => ({
        text: p.textContent ?? '',
        shown: (p as HTMLElement).checkVisibility(),
      }));
      expect(offer.shown).toBe(true);
      expect(offer.text).toBe(mismatch?.['offer']);
      expect(offer.text).toContain('colours');
      expect(offer.text).toContain('Nothing already built changes');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * **The tool notices, it does not decide.** Mohamed may build a reel attached
   * to whoever he likes.
   */
  it('leaves every run button pressable', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const buttons = await loaded.page.$$eval('.do button.run', (bs) =>
        bs.map((b) => ({
          label: (b.textContent ?? '').slice(0, 40),
          disabled: (b as HTMLButtonElement).disabled,
        })),
      );
      expect(buttons.length).toBeGreaterThan(0);
      for (const b of buttons) expect(`${b.label}: ${b.disabled}`).toBe(`${b.label}: false`);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* Nothing changes until he presses: the offer is a button, not an effect. */
  it('changes nothing until the offer is pressed', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const attaches = await loaded.page.evaluate(() =>
        ((window as { __asked?: string[] }).__asked ?? []).filter(
          (u) => u.indexOf('/clients/attach') !== -1,
        ),
      );
      expect(attaches).toEqual([]);
      const offerLabel = await loaded.page.$eval(
        '.wrongclient button.ghost',
        (b) => b.textContent ?? '',
      );
      expect(offerLabel).toContain('Use Dr Loubna Kfafi instead');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* It sits above the buttons that bill, not after a comp exists. */
  it('sits above the buttons that spend', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const order = await loaded.page.evaluate(() => {
        const notice = document.querySelector('.wrongclient');
        const run = document.querySelector('.do button.run');
        if (notice === null || run === null) return null;
        return {
          noticeTop: Math.round(notice.getBoundingClientRect().top),
          runTop: Math.round(run.getBoundingClientRect().top),
        };
      });
      expect(order).not.toBeNull();
      expect((order as { noticeTop: number }).noticeTop).toBeLessThan(
        (order as { runTop: number }).runTop,
      );
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});
