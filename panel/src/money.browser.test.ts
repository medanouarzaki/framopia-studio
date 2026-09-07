import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { HANDSHAKE, INDEX, built, realMoney, stubHost, stubRoutes } from './browser-harness.js';

/**
 * **The money screen, in the real panel, on the real ledger.**
 *
 * Mohamed rules by eye, so the numbers here are the ones he will see: the actual
 * lines from `.local/costs.jsonl`, read by `readLedger`, never a fixture and
 * never demonstration data.
 *
 * **Every assertion reads an extracted value.** Block 10 session 54 lost a run
 * to `expect(await page.$('.x')).toBeNull()` — vitest serialised a live
 * Playwright handle into the diff and exhausted the heap. Nothing here holds one.
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
  const page = await browser.newPage();
  const uncaught: string[] = [];
  page.on('pageerror', (e) => uncaught.push(e.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes([], 'transcription'));
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('button.seemoney', { timeout: 15_000 });
  await page.click('button.seemoney');
  await page.waitForSelector('.moneybanner', { timeout: 15_000 });
  return { page, uncaught };
}

const money = realMoney();
const dollars = (n: number): string => `$${n.toFixed(2)}`;

describe.skipIf(!built)('the money screen', () => {
  it('shows what has been spent, to the same figure the ledger holds', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const banner = (await loaded.page.textContent('.moneybanner')) ?? '';
      expect(banner).toContain(dollars(money['totalUsd'] as number));
      expect(banner).toContain('Spent since the beginning');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * Never a reading of his account. Session 46 carried a balance forward and got
   * $2.91 where a later report said $2.71 — a $0.20 gap nothing could explain.
   */
  it('says the credit is not known until he enters it', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const banner = (await loaded.page.textContent('.moneybanner')) ?? '';
      expect(banner).toContain('not entered');
      expect(banner).toContain('Framopia cannot see your account');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('groups the spending, and every group adds to the whole', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const rows = await loaded.page.$$eval('.moneygroups tr', (trs) =>
        trs.map((tr) => tr.textContent ?? ''),
      );
      expect(rows.length).toBeGreaterThan(0);
      const months = money['byMonth'] as { key: string; usd: number }[];
      for (const m of months) {
        expect(rows.join(' | ')).toContain(m.key);
      }
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * The old lines are shown under one honest label and the amount is named, so
   * what cannot be attributed is visible rather than quietly missing.
   */
  it('names what it cannot attribute rather than leaving it out', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      await loaded.page.click('.moneyfilters button:nth-child(3)');

      /*
       * **Read out of the table, not out of the page's text.** The first version
       * of this asserted `textContent` of the whole screen, which passed with the
       * row deleted *and* the hint hidden — `textContent` returns hidden text,
       * and the hint alone carries the label and the figure. That is the vacuous
       * shape session 57 spent a session removing, and it was caught by mutating
       * the screen and watching this stay green.
       */
      const rows = await loaded.page.$$eval('.moneygroups tr', (trs) =>
        trs.map((tr) => ({
          key: tr.querySelector('th')?.textContent ?? '',
          amount: tr.querySelector('.amount')?.textContent ?? '',
          marked: tr.className.includes('unattributed'),
        })),
      );
      const before = rows.find((r) => r.key === 'before this was recorded');
      expect(before?.amount).toBe(dollars(money['unattributedUsd'] as number));
      expect(before?.marked).toBe(true);

      // And the sentence explaining it is really on screen, not merely present.
      const hintShown = await loaded.page.$$eval('.money .partial', (ps) =>
        ps.map((p) => ({ text: p.textContent ?? '', visible: !(p as HTMLElement).hidden })),
      );
      expect(hintShown.length).toBe(1);
      expect(hintShown[0]?.visible).toBe(true);
      expect(hintShown[0]?.text).toContain('not guessed at');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('offers a cap and says it only warns', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.moneycap')) ?? '';
      expect(text).toContain('No cap set');
      expect(text).toContain('It never stops you making anything');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});
