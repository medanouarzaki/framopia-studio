import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  built,
  INDEX,
  HANDSHAKE,
  stubHost,
  realPanelRoutes,
  onScreen,
} from './browser-harness.js';

/**
 * **How wide the panel is, and how much of that it uses.**
 *
 * Block 13 session 105. Mohamed's window is roughly 1500 px and every control in
 * it is full width — *Build the composition*, *Refresh*, a picker, a sentence —
 * so a three-word button is drawn as a banner a metre long.
 *
 * **Every ruler this project has ever written renders at 420 px.** Sixteen of the
 * panel's browser viewports say `width: 420`, and the heights sessions 95 to 104
 * reported — 589, 849, 750 — are heights of a 420 px panel. This one renders at
 * the width he actually has, and at two narrower ones, because a CEP panel can be
 * dragged to a third of his window and his partner's will be whatever it is.
 */
export const WIDTHS = [
  ['his window', 1500],
  ['a middle width', 900],
  ['narrow', 380],
] as const;

let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

export async function hisPanelAt(b: Browser, width: number): Promise<Page> {
  const page = await b.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('header.brand', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
  await page.waitForTimeout(300);
  await page.selectOption(
    'select[aria-label="Video"]',
    'Dr Loubna Kfafi/September Content/Exports/sora.mov',
  );
  await page.waitForTimeout(600);
  return page;
}

describe.skipIf(!built)('how much of its width the panel uses', () => {
  it('measures every control and block against the space it is given', async () => {
    if (browser === undefined) return;
    for (const [name, width] of WIDTHS) {
      const page = await hisPanelAt(browser, width);
      console.log(`\n  ======== ${name} — viewport ${String(width)}px ========`);
      for (const screen of ['choose', 'run', 'build'] as const) {
        await onScreen(page, screen);
        const rows = await page.evaluate(() => {
          const out: { what: string; drawn: number; natural: number; waste: number }[] = [];
          const main = document.querySelector('main');
          if (main === null) return { mainWidth: 0, rows: out };
          /* Controls and text blocks, not the wrappers that hold them. */
          const of = 'main button, main select, main summary, main p, main > section > h2';
          for (const el of Array.from(document.querySelectorAll(of))) {
            const h = el as HTMLElement;
            if (!h.checkVisibility()) continue;
            const r = h.getBoundingClientRect();
            if (r.width === 0) continue;
            /*
             * The natural width: what the content needs. `fit-content` on a clone
             * would reflow the page, so this measures a range over the element's
             * own text instead, which is what the browser would shrink to.
             */
            let natural = 0;
            const range = document.createRange();
            range.selectNodeContents(h);
            for (const box of Array.from(range.getClientRects())) {
              natural = Math.max(natural, box.width);
            }
            range.detach();
            const pad =
              parseFloat(getComputedStyle(h).paddingLeft) +
              parseFloat(getComputedStyle(h).paddingRight);
            natural = Math.round(natural + pad);
            out.push({
              what: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || '-'}`,
              drawn: Math.round(r.width),
              natural,
              waste: Math.round(r.width) - natural,
            });
          }
          return { mainWidth: Math.round(main.getBoundingClientRect().width), rows: out };
        });
        console.log(`\n  == ${screen} — main is ${String(rows.mainWidth)}px wide`);
        for (const r of rows.rows) {
          console.log(
            `     ${r.what.padEnd(26)} drawn ${String(r.drawn).padStart(5)}  needs ${String(r.natural).padStart(5)}  wasted ${String(r.waste).padStart(5)}`,
          );
        }
      }
      await page.close();
    }
    expect(true).toBe(true);
  }, 180_000);
});

/**
 * **It must survive being narrow.**
 *
 * His window is wide; it will not always be, a CEP panel can be dragged to a third
 * of it, and his partner's will be whatever it is. Everything this session added is
 * a cap or lives above one breakpoint, so the narrow panel is not a second layout —
 * it is the absence of this one. These are the tests that say so.
 */
describe.skipIf(!built)('the panel survives every width', () => {
  /** Anything scrolling sideways, and anything drawn outside its parent. */
  async function trouble(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
      const bad: string[] = [];
      const root = document.documentElement;
      if (root.scrollWidth > root.clientWidth + 1) bad.push('the page scrolls sideways');
      for (const el of Array.from(document.querySelectorAll('main *'))) {
        const h = el as HTMLElement;
        if (!h.checkVisibility()) continue;
        const name = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || '-'}`;
        /*
         * Scrolled content it cannot reach — except a text field, which scrolls
         * its own value by design and does so at every width, including 380 px
         * before this session touched anything.
         */
        const scrollsItself = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
        if (!scrollsItself && h.scrollWidth > h.clientWidth + 1) bad.push(`${name} is cut off`);
        /* Drawn outside the panel. */
        const r = h.getBoundingClientRect();
        if (r.left < -1 || r.right > root.clientWidth + 1) bad.push(`${name} is off the edge`);
        /* Collapsed to nothing while still carrying words. */
        if ((h.textContent ?? '').trim() !== '' && r.width < 1) bad.push(`${name} has no width`);
      }
      return [...new Set(bad)];
    });
  }

  it.each(WIDTHS)('draws every screen without cutting anything off — %s', async (_name, width) => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, width);
    for (const screen of ['choose', 'run', 'build'] as const) {
      await onScreen(page, screen);
      expect(await trouble(page), `${screen} at ${String(width)}px`).toEqual([]);
      /* And with everything behind a press opened, which is more text in the same room. */
      await page.$$eval('details', (els) => {
        els.forEach((d) => ((d as HTMLDetailsElement).open = true));
      });
      await page.waitForTimeout(150);
      expect(await trouble(page), `${screen} at ${String(width)}px, opened`).toEqual([]);
    }
    await page.close();
  }, 180_000);

  /**
   * **Below the breakpoint nothing this session added applies**, which is the claim
   * the narrow case rests on. A cap that a 380 px panel could reach would be a
   * second layout in disguise.
   */
  it('reaches none of its own caps when the panel is narrow', async () => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, 380);
    await onScreen(page, 'run');
    const widths = await page.evaluate(() => {
      const main = document.querySelector('main');
      const cs = main === null ? null : getComputedStyle(main);
      const inner =
        main === null || cs === null
          ? 0
          : main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const of = (sel: string): number[] =>
        [...document.querySelectorAll(sel)]
          .filter((e) => (e as HTMLElement).checkVisibility())
          .map((e) => Math.round(e.getBoundingClientRect().width));
      return {
        inner: Math.round(inner),
        runs: of('main button.run'),
        says: of('main p.say'),
        /*
         * **The field was missing here**, and session 105's own mutation M3 found
         * it: a `max-width` of 300 px on a picker is a cap a 380 px panel reaches,
         * which is a second layout in disguise — and this test, written to catch
         * exactly that, looked only at buttons and prose.
         */
        fields: of('main select'),
      };
    });
    /* Every control still fills the panel, exactly as it did before this session. */
    expect(widths.runs.length).toBeGreaterThan(0);
    expect([...new Set(widths.runs)]).toEqual([widths.inner]);
    expect([...new Set(widths.says)]).toEqual([widths.inner]);
    await onScreen(page, 'choose');
    const fields = await page.$$eval('main select', (els) =>
      els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => Math.round(e.getBoundingClientRect().width)),
    );
    expect(fields.length).toBeGreaterThan(0);
    expect([...new Set(fields)]).toEqual([widths.inner]);
    await page.close();
  }, 120_000);

  /**
   * **And above it, a control is as wide as its text and no wider.** The exact
   * figures, because a cap that has drifted still looks plausible: session 104's
   * own mutation passed once because a browser rounded 12.75 px to 13.
   */
  it('caps a control, a field and a line of prose at his width', async () => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, 1500);
    await onScreen(page, 'choose');
    const field = await page.$eval('main select', (e) => e.getBoundingClientRect().width);
    await onScreen(page, 'run');
    const control = await page.$eval('main button.run', (e) => e.getBoundingClientRect().width);
    const prose = await page.$eval('main p.say', (e) => e.getBoundingClientRect().width);
    expect(field).toBe(460);
    expect(control).toBe(420);
    /* 76ch at the 15px body step, whatever the browser makes that. */
    expect(`prose ${String(Math.round(prose))}px, between 480 and 760: ${prose > 480 && prose < 760}`).toBe(
      `prose ${String(Math.round(prose))}px, between 480 and 760: true`,
    );
    await page.close();
  }, 120_000);
});

/**
 * **Pairing two decisions has to bring them closer, or it is only rearrangement.**
 *
 * Block 13 session 105. Stacked at 420 px the two pickers are 88 px apart. Put side
 * by side in two equal halves of a 1460 px window they were **284 px apart** —
 * further than before — because each sat at the left of its own half. The first
 * column is a field wide instead, so they are one column-gap apart.
 */
describe.skipIf(!built)('pairing brings the two decisions closer, not further', () => {
  it.each([
    ['his window', 1500],
    ['a middle width', 900],
  ] as const)('puts the pickers one gap apart — %s', async (_name, width) => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, width);
    await onScreen(page, 'choose');
    const apart = await page.evaluate(() => {
      const c = document.querySelector('section.client select');
      const v = document.querySelector('section.video select');
      if (c === null || v === null) return null;
      const a = c.getBoundingClientRect();
      const z = v.getBoundingClientRect();
      return { dx: Math.round(z.left - a.right), sameRow: Math.abs(z.top - a.top) < 2 };
    });
    /* Exactly the section gap, not a rounded approximation of it. */
    expect(apart).toEqual({ dx: 28, sameRow: true });
    await page.close();
  }, 120_000);

  /** And below the breakpoint they are stacked, exactly as they always were. */
  it('leaves them stacked when the panel is narrow', async () => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, 380);
    await onScreen(page, 'choose');
    const stacked = await page.evaluate(() => {
      const c = document.querySelector('section.client select');
      const v = document.querySelector('section.video select');
      if (c === null || v === null) return null;
      const a = c.getBoundingClientRect();
      const z = v.getBoundingClientRect();
      return { sameColumn: Math.abs(z.left - a.left) < 2, below: z.top > a.bottom };
    });
    expect(stacked).toEqual({ sameColumn: true, below: true });
    await page.close();
  }, 120_000);
});
