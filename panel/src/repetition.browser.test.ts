import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { built, DIST, onScreen, openReference, hisPanelAt } from './browser-harness.js';

/**
 * **What the panel says twice, and what it should say once.**
 *
 * Block 13 session 106. His client has twenty-two photographs, and every card
 * printed *Use it when someone says…* and *Used whenever one of these is spoken.*
 * — the same two sentences forty-four times, in the largest block in the tool.
 *
 * A label belongs to the group, not to every member. These are the tests that go
 * red when one creeps back.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

/** Every sentence drawn, and how many times, with every disclosure open. */
async function saidTwice(page: Page): Promise<string[]> {
  const all = new Map<string, number>();
  for (const screen of ['choose', 'run', 'build'] as const) {
    await onScreen(page, screen);
    await page.$$eval('details', (els) => {
      els.forEach((d) => ((d as HTMLDetailsElement).open = true));
    });
    await page.waitForTimeout(250);
    const rows = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('main *'))) {
        const h = el as HTMLElement;
        if (!h.checkVisibility()) continue;
        /* A control's own label is not boilerplate: each one acts on its own item. */
        if (el.tagName === 'BUTTON' || el.closest('button') !== null) continue;
        for (const n of Array.from(h.childNodes)) {
          if (n.nodeType !== 3) continue;
          const t = (n.textContent ?? '').trim();
          if (t.length > 10 && /[a-z]{3}/.test(t)) out.push(t);
        }
      }
      return out;
    });
    for (const t of rows) all.set(t, (all.get(t) ?? 0) + 1);
  }
  return [...all.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${String(n)}× ${t}`);
}

describe.skipIf(!built)('nothing that belongs to a group is said per member', () => {
  it('says each sentence once, with all twenty-two photographs showing', async () => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, 1500);
    await onScreen(page, 'choose');
    await openReference(page, '.clientcard');
    expect(await page.$$eval('.ownphotos ul.photos > li', (e) => e.length)).toBe(22);

    /*
     * What is left is data, not boilerplate: four stage rows that happen to have
     * reached the same state, two typeface names the card shows and the build
     * names, and a client's name in two places. Each is a fact about its own row.
     */
    expect(await saidTwice(page)).toEqual([
      '4× Already done — nothing to pay',
      '2× Inter Semi-Bold',
      '2× Almarai Bold',
      '2× K2 Syndicalia',
    ]);
    await page.close();
  }, 180_000);

  /**
   * **And the label is still said — once, over the grid it names.** Nothing he can
   * learn was deleted: the paragraph at the head of the section still explains what
   * the words do, and every field still carries its own name for a screen reader.
   */
  it('keeps the label over the grid, and every field named', async () => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, 1500);
    await onScreen(page, 'choose');
    await openReference(page, '.clientcard');
    const said = await page.evaluate(() => {
      const head = document.querySelector('.ownphotos .photoshead');
      const inputs = [...document.querySelectorAll('.ownphotos ul.photos input')];
      return {
        head: head === null ? null : (head.textContent ?? '').trim(),
        headDrawn: head === null ? false : (head as HTMLElement).checkVisibility(),
        named: inputs.every((i) => (i.getAttribute('aria-label') ?? '').startsWith('Use ')),
        distinct: new Set(inputs.map((i) => i.getAttribute('aria-label'))).size,
        /* The explanation the per-card line restated is still on the screen. */
        explained: [...document.querySelectorAll('.ownphotos > p.hint')]
          .map((p) => (p.textContent ?? '').trim())
          .some((t) => t.includes('used automatically') && t.includes('pick it by hand')),
      };
    });
    expect(said).toEqual({
      head: 'Use it when someone says…',
      headDrawn: true,
      named: true,
      distinct: 22,
      explained: true,
    });
    await page.close();
  }, 180_000);

  /**
   * **The grid fits the room it is given.** Twenty-two cards were 2851 px of a
   * 900 px panel, in a column 460 px wide with a thousand pixels empty beside it.
   */
  it('lays the photographs across the panel rather than down it', async () => {
    if (browser === undefined) return;
    const page = await hisPanelAt(browser, 1500);
    await onScreen(page, 'choose');
    await openReference(page, '.clientcard');
    await page.waitForTimeout(300);
    const grid = await page.evaluate(() => {
      const li = [...document.querySelectorAll('.ownphotos ul.photos > li')];
      const across = new Set(li.map((e) => Math.round(e.getBoundingClientRect().left))).size;
      const widths = new Set(li.map((e) => Math.round(e.getBoundingClientRect().width)));
      return {
        across,
        /*
         * **Every card the same width**, which is what the flex wrap did not do:
         * `flex: 0 1 120px` let the last row stretch its cards to fill the line, so
         * two photographs on their own were drawn twice the size of the twenty
         * above them. Heights still differ by a line where a description wraps —
         * that is the photograph's own name, not the layout.
         */
        oneWidth: widths.size === 1,
        section: Math.round(document.querySelector('.ownphotos')?.getBoundingClientRect().height ?? 0),
      };
    });
    expect(grid.oneWidth).toBe(true);
    expect(`${String(grid.across)} across, more than six: ${grid.across > 6}`).toBe(
      `${String(grid.across)} across, more than six: true`,
    );
    expect(`${String(grid.section)}px, under 900: ${grid.section < 900}`).toBe(
      `${String(grid.section)}px, under 900: true`,
    );
    await page.close();
  }, 180_000);
});

/**
 * **The panel measures itself, and the built stylesheet proves it.**
 *
 * `docs/ARCHITECTURE.md`: *"A docked CEP panel's window is the size of the screen
 * while its panel is a column wide, so a media query lays out for the wrong thing.
 * Any future responsive rule has to measure the panel, not the viewport."*
 *
 * A browser test cannot catch this, because a test's viewport and its panel are
 * the same thing — which is exactly how session 105's width query passed every
 * test while being wrong on his machine. So this reads the built CSS.
 */
describe.skipIf(!built)('no layout rule asks the window how wide the panel is', () => {
  it('ships no width media query in the built stylesheet', async () => {
    const css = readFileSync(path.join(DIST, 'panel.css'), 'utf8');
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const queries = [...withoutComments.matchAll(/@media[^{]*\((?:min|max)-(?:width|device-width)[^)]*\)/g)].map(
      (m) => m[0].trim(),
    );
    expect(queries).toEqual([]);
  });
});
