import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { built, INDEX, HANDSHAKE, stubHost, realPanelRoutes, onScreen } from './browser-harness.js';

/**
 * **What the money screen costs to read.**
 *
 * Block 15 session 116. Session 70 built it to his eye and every session since
 * was told not to touch it, so it has never been measured the way every other
 * screen has been since session 104. This is the ruler: how tall it is, how many
 * things are on it, and whether the type scale and the caps were ever applied to
 * it at all.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

async function theMoneyScreen(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'run');
  await page.click('button.seemoney', { timeout: 15_000 });
  await page.waitForSelector('.moneybanner', { timeout: 15_000 });
  await page.waitForTimeout(500);
  return page;
}

describe.skipIf(!built)('the money screen, measured', () => {
  it('says how tall it is and how much is on it', async () => {
    const page = await theMoneyScreen();
    if (page === null) return;
    const m = await page.evaluate(() => {
      const money = document.querySelector('.money') as HTMLElement | null;
      if (money === null) return null;
      const all = [...money.querySelectorAll('*')] as HTMLElement[];
      const visible = all.filter((e) => e.checkVisibility());
      const bottom = visible.reduce(
        (low, e) => Math.max(low, e.getBoundingClientRect().bottom + window.scrollY),
        0,
      );
      const blocks = [...money.children].map((c) => {
        const el = c as HTMLElement;
        const head = el.querySelector('h3, .colourhead, .what');
        return `${el.className || el.tagName.toLowerCase()} — ${(head?.textContent ?? '').trim().slice(0, 34)} — ${String(Math.round(el.getBoundingClientRect().height))}px`;
      });
      return {
        height: Math.round(bottom),
        elements: visible.length,
        blocks,
        banner: [...(document.querySelectorAll('.moneybanner .figure') ?? [])].map(
          (f) => ((f.querySelector('.what')?.textContent ?? '') + ' = ' + (f.querySelector('.total')?.textContent ?? '')).trim(),
        ),
      };
    });
    console.log(`\n  == the money screen: ${String(m?.height ?? 0)}px tall, ${String(m?.elements ?? 0)} visible elements`);
    for (const b of m?.blocks ?? []) console.log(`     ${b}`);
    console.log(`     banner: ${(m?.banner ?? []).join('  |  ')}`);
    expect(m).not.toBeNull();
    await page.close();
  }, 60_000);

  /**
   * **The three things he comes to this screen for, at the top.**
   *
   * Block 15 session 116. He asked how much he had paid in and had to be told by
   * hand: the figure was two blocks down, behind a heading, under a table. And
   * what the money went on — building the tool against making his videos — was
   * computed by session 68 and shown nowhere.
   */
  it('puts what he paid, what he spent and what it went on at the top', async () => {
    const page = await theMoneyScreen();
    if (page === null) return;
    const figures = await page.$$eval('.moneybanner .figure', (els) =>
      els.map((e) => ({
        what: (e.querySelector('.what')?.textContent ?? '').trim(),
        total: (e.querySelector('.total')?.textContent ?? '').trim(),
        caveat: (e.querySelector('.caveat')?.textContent ?? '').trim(),
      })),
    );
    console.log('  == the top of the screen:');
    for (const f of figures) console.log(`     ${f.what} = ${f.total}   ${f.caveat}`);
    const named = figures.map((f) => f.what);
    expect(named).toContain('Spent since the beginning');
    expect(named).toContain('Paid in');
    expect(named).toContain('Making his videos');
    /* Each of the three says what it is not, because none is a reading. */
    const said = figures.map((f) => f.caveat).join(' ');
    expect(said).toContain('not your invoice');
    expect(said).toContain('not a reading of any account');
    expect(said).toContain('before this was recorded');
    await page.close();
  }, 60_000);

  /**
   * **Paid in is not one number.** Session 115 measured $0.0559 of ElevenLabs
   * against $12 paid in — two months of subscription against six cents of use —
   * and said a single total misleads. This is that, per account.
   */
  it('shows what each account was paid and what it has used', async () => {
    const page = await theMoneyScreen();
    if (page === null) return;
    const rows = await page.$$eval('.moneyproviders tbody tr', (els) =>
      els.map((tr) => [...tr.children].map((c) => (c.textContent ?? '').trim()).join(' · ')),
    );
    console.log('  == each account:');
    for (const r of rows) console.log(`     ${r}`);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.join(' ')).toContain('ElevenLabs');
    expect(rows.join(' ')).toContain('Google');
    /* Never netted into one figure: in and used are both there, side by side. */
    expect(rows.join(' ')).toMatch(/in/);
    expect(rows.join(' ')).toMatch(/used/);
    await page.close();
  }, 60_000);

  /**
   * **Was the type scale ever applied here?** Session 104 built six steps on 4 px
   * sizes and every screen since has been held to them. This screen predates that
   * and was exempted from every session that followed, so the answer is measured
   * rather than assumed.
   */
  it('counts the type settings on it, against the six the panel has', async () => {
    const page = await theMoneyScreen();
    if (page === null) return;
    const settings = await page.evaluate(() => {
      const money = document.querySelector('.money') as HTMLElement | null;
      if (money === null) return [];
      const seen = new Map<string, number>();
      for (const e of [...money.querySelectorAll('*')] as HTMLElement[]) {
        if (!e.checkVisibility()) continue;
        if ((e.textContent ?? '').trim() === '') continue;
        const s = getComputedStyle(e);
        const key = `${s.fontSize}/${s.fontWeight}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${String(n)}`);
    });
    console.log(`  == ${String(settings.length)} distinct size/weight settings: ${settings.join(', ')}`);
    expect(settings.length).toBeGreaterThan(0);
    await page.close();
  }, 60_000);
});
