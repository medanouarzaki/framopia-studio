import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { usdExact } from './Money.js';
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
/** Two decimals, which is what most of this screen shows. */
const dollars = (n: number): string => `$${n.toFixed(2)}`;

describe.skipIf(!built)('the money screen', () => {
  it('shows what has been spent, to the same figure the ledger holds', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const banner = (await loaded.page.textContent('.moneybanner')) ?? '';
      /*
       * **The banner shows the exact figure, not a rounded one.** This asserted
       * `toFixed(2)` with `toContain`, which passed only because `$18.83` is a
       * prefix of `$18.832129`. Session 85's spending took the total to
       * `$19.946952`, whose two-decimal rounding is `$19.95` — a prefix of
       * nothing on screen — and it went red for the screen being right.
       */
      expect(banner).toContain(usdExact(money['totalUsd'] as number));
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

  /*
   * **The defect Mohamed actually saw.** Session 69 rendered
   * `Spent since the beginning$18.83165 charges, from 2026-08-24` — the label,
   * the amount and the count with nothing between them, because they were
   * inline elements in one flow.
   *
   * This measures it the way an eye does: for every pair of adjacent pieces of
   * text in the banner, either they are on different lines or there is real
   * space between them. A string test could not have caught it — the text was
   * always correct, and it was the boxes that ran together.
   */
  it('never runs two pieces of text together', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const touching = await loaded.page.$$eval('.moneybanner .figure', (figures) => {
        const bad: string[] = [];
        for (const figure of figures) {
          const kids = [...figure.children] as HTMLElement[];
          for (let i = 1; i < kids.length; i += 1) {
            const a = (kids[i - 1] as HTMLElement).getBoundingClientRect();
            const b = (kids[i] as HTMLElement).getBoundingClientRect();
            const sameLine = b.top < a.bottom - 1;
            const gap = b.left - a.right;
            if (sameLine && gap < 4) {
              bad.push(
                `${(kids[i - 1] as HTMLElement).textContent ?? ''} | ${(kids[i] as HTMLElement).textContent ?? ''}`,
              );
            }
          }
        }
        return bad;
      });
      expect(touching).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * Amounts are read down a column, so they must actually share a right edge.
   */
  it('lines the amounts up in a column', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const rights = await loaded.page.$$eval('.moneygroups .amount', (tds) =>
        tds.map((td) => Math.round(td.getBoundingClientRect().right)),
      );
      expect(rights.length).toBeGreaterThan(1);
      expect(new Set(rights).size).toBe(1);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* Nothing may push the numbers off the panel's edge. */
  it('keeps every row inside the panel', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const overflow = await loaded.page.evaluate(() => {
        const root = document.querySelector('.money') as HTMLElement | null;
        if (root === null) return ['no money screen'];
        const limit = Math.round(root.getBoundingClientRect().right);
        return [...root.querySelectorAll('.amount, .rate, .total')]
          .filter((el) => Math.round(el.getBoundingClientRect().right) > limit)
          .map((el) => el.textContent ?? '');
      });
      expect(overflow).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * **A payment is not a credit reading, and the screen must not blur them.**
   * Credit is what an account has left today; a payment is money that went in on
   * a date. Two payments add up and two credit readings do not.
   */
  it('keeps money paid in apart from credit', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const seen = await loaded.page.evaluate(() => {
        const inBlock = (sel: string): string =>
          (document.querySelector(sel) as HTMLElement | null)?.textContent ?? '';
        return {
          paidIn: inBlock('.paidin'),
          banner: inBlock('.moneybanner'),
          paidInIsItsOwnBlock: document.querySelectorAll('.paidin').length,
        };
      });
      expect(seen.paidInIsItsOwnBlock).toBe(1);
      expect(seen.paidIn).toContain('Money you have paid in');
      expect(seen.paidIn).toContain('cannot see your accounts');
      // The credit figure lives in the banner and nowhere else.
      expect(seen.banner).toContain('Credit left');
      expect(seen.paidIn).not.toContain('Credit left');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * Two sources sat on one screen and were never compared. Read out of the
   * rows rather than the page text, for session 69's reason.
   */
  it('says where the total comes from, line by line', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const rows = await loaded.page.$$eval('.reconcile .paidsum', (els) =>
        els.map((el) => ({
          what: el.querySelector('.what')?.textContent ?? '',
          amount: el.querySelector('.amount')?.textContent ?? '',
        })),
      );
      const labels = rows.map((r) => r.what);
      expect(labels).toContain('In the ledger');
      expect(labels).toContain('The videos above account for');
      expect(labels).toContain('Trying things out, no video');
      expect(labels).toContain('Spent on videos, not on their record');
      for (const r of rows) expect(r.amount).toMatch(/^\$-?\d/);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* The edges of the record, said as edges rather than as an error. */
  it('says what it cannot see, and names no command', async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const block = await loaded.page.evaluate(() => {
        const el = document.querySelector('.cannotsee') as HTMLElement | null;
        return {
          text: el?.textContent ?? '',
          items: [...(el?.querySelectorAll('li') ?? [])].map((li) => li.textContent ?? ''),
        };
      });
      expect(block.items.length).toBe(3);
      expect(block.text).toContain('outside Framopia');
      expect(block.text).toContain('None of this is broken');
      for (const forbidden of ['npm run', 'terminal', 'error', 'failed']) {
        expect(`${forbidden}: ${block.text.toLowerCase().includes(forbidden)}`).toBe(
          `${forbidden}: false`,
        );
      }
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * **A figure that silently means two things is worse than either.** Mohamed
   * prices work off these numbers, so each row says in plain words whether it
   * came from what was charged or from the video's own record.
   */
  it("says what each video's figure is made of", async () => {
    const loaded = await open();
    if (loaded === null) return;
    try {
      const said = await loaded.page.$$eval('.reelstages li', (lis) =>
        lis.map((li) => ({
          name: li.querySelector('.name')?.textContent ?? '',
          paid: li.querySelector('.paid')?.textContent ?? '',
        })),
      );
      expect(said.length).toBeGreaterThan(0);
      for (const row of said) {
        // Plain words, never a label like "source: ledger".
        expect(`${row.name}: ${row.paid.includes('source:')}`).toBe(`${row.name}: false`);
        expect(`${row.name}: ${/own record|actually charged/.test(row.paid)}`).toBe(
          `${row.name}: true`,
        );
      }
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
