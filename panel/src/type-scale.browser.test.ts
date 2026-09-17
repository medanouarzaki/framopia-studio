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
 * **What the type actually is, measured in the browser that draws it.**
 *
 * Block 13 session 104. Mohamed looked at the panel and said it is not beautiful
 * to see — underlined text at many sizes, reading like a paragraph in Word. Every
 * size in `panel.css` is written in `em`, so it compounds through nesting and no
 * one can tell from the source what any element is actually set in. This walks
 * every rendered element and counts what it finds.
 *
 * A ruler first, then the rules below it.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

export async function hisPanel(b: Browser): Promise<Page> {
  const page = await b.newPage({ viewport: { width: 420, height: 900 } });
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

/** Every visible element that draws its own text, as size/weight/colour/leading. */
async function inventory(page: Page): Promise<{ key: string; count: number; what: string }[]> {
  return await page.evaluate(() => {
    const seen = new Map<string, { count: number; what: Set<string> }>();
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const h = el as HTMLElement;
      if (!h.checkVisibility()) continue;
      /* Only elements that draw text of their own, not wrappers around it. */
      const own = Array.from(h.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
      );
      if (!own) continue;
      const s = getComputedStyle(h);
      const px = Math.round(parseFloat(s.fontSize) * 100) / 100;
      const lh = s.lineHeight === 'normal' ? 'normal' : `${Math.round(parseFloat(s.lineHeight))}px`;
      const key = `${String(px)}px / ${s.fontWeight} / ${s.color} / ${lh}${
        s.textTransform === 'uppercase' ? ' / UPPER' : ''
      }${s.textDecorationLine.includes('underline') ? ' / underline' : ''}`;
      const where = (n: Element | null): string => {
        const parts: string[] = [];
        let at: Element | null = n;
        while (at !== null && at.tagName !== 'BODY' && parts.length < 4) {
          parts.unshift(
            `${at.tagName.toLowerCase()}${at.className ? '.' + String(at.className).split(' ')[0] : ''}`,
          );
          at = at.parentElement;
        }
        return parts.join('>');
      };
      const tag = where(el);
      const at = seen.get(key) ?? { count: 0, what: new Set<string>() };
      at.count += 1;
      at.what.add(tag);
      seen.set(key, at);
    }
    return [...seen.entries()]
      .map(([key, v]) => ({ key, count: v.count, what: [...v.what].slice(0, 5).join(', ') }))
      .sort((a, b) => b.count - a.count);
  });
}

describe.skipIf(!built)('what the type actually is', () => {
  it('counts every size, weight, colour and leading on screen', async () => {
    if (browser === undefined) return;
    const page = await hisPanel(browser);
    const all = new Map<string, { count: number; what: string }>();
    const sweep = async (): Promise<void> => {
      for (const screen of ['choose', 'run', 'build'] as const) {
        await onScreen(page, screen);
        for (const row of await inventory(page)) {
          const at = all.get(row.key) ?? { count: 0, what: row.what };
          at.count += row.count;
          if (!at.what.includes(row.what.split(',')[0] ?? '')) {
            at.what = `${at.what}, ${row.what.split(',')[0] ?? ''}`;
          }
          all.set(row.key, at);
        }
      }
    };
    await sweep();
    /*
     * And again with every disclosure open and three videos in the list: what is
     * behind a press is still type he reads, and the busy states carry rows,
     * hints and reasons the daily ones never render.
     */
    for (const label of [
      'Dr Loubna Kfafi/September Content/Exports/sculptra-explainer.mov',
      'Dr Loubna Kfafi/September Content/Exports/botox-myths.mov',
    ]) {
      await onScreen(page, 'choose');
      await page.selectOption('select[aria-label="Video"]', label);
      await page.waitForTimeout(250);
      await onScreen(page, 'run');
      /*
       * **This clicked a control that no longer exists.** Block 15 session 117.
       *
       * Until session 114 the list was built with *Add X to the list*, which was
       * `section.pane button.run`; that session replaced it with a row per video
       * and the selector went on matching nothing — `page.$` answers null and the
       * sweep carried on. So the second pass stopped reaching the states it was
       * written for, silently, and the count fell from **16 settings to 14**
       * without a test going red.
       *
       * The row is ticked now. The two settings that came back are the ones only
       * a list with items in it renders.
       */
      const row = await page.$(`.pickseveral button.pick:has-text("${label.split('/').pop() ?? ''}")`);
      if (row === null) throw new Error(`no row to tick for ${label}`);
      await row.click({ timeout: 4000 });
      await page.waitForTimeout(160);
    }
    for (const screen of ['choose', 'run', 'build'] as const) {
      await onScreen(page, screen);
      await page.$$eval('details', (els) => {
        els.forEach((d) => ((d as HTMLDetailsElement).open = true));
      });
      await page.waitForTimeout(200);
    }
    await sweep();
    const rows = [...all.entries()].sort((a, b) => b[1].count - a[1].count);
    console.log(`\n  == ${String(rows.length)} distinct type settings across the three screens\n`);
    for (const [key, v] of rows) {
      console.log(`     ${String(v.count).padStart(3)}  ${key.padEnd(52)} ${v.what}`);
    }
    expect(rows.length).toBeGreaterThan(0);
    await page.close();
  }, 120_000);
});

/**
 * **The rules, under the ruler.**
 *
 * Sessions 99 to 102 each had a mutation catch a change nothing was watching, and
 * a visual rule is the easiest kind to leave unpinned — it is true when you look
 * and nobody looks again. Each of these reads a size, a weight, a colour or a
 * measured gap out of the browser.
 */
describe.skipIf(!built)('the type scale holds', () => {
  /** Every element on every screen that draws text of its own. */
  async function everyText(page: Page): Promise<
    { where: string; px: number; weight: string; colour: string; underlined: boolean }[]
  > {
    const out: { where: string; px: number; weight: string; colour: string; underlined: boolean }[] =
      [];
    for (const screen of ['choose', 'run', 'build'] as const) {
      await onScreen(page, screen);
      out.push(
        ...(await page.evaluate(() => {
          const rows: {
            where: string;
            px: number;
            weight: string;
            colour: string;
            underlined: boolean;
          }[] = [];
          for (const el of Array.from(document.querySelectorAll('main *'))) {
            const h = el as HTMLElement;
            if (!h.checkVisibility()) continue;
            const own = Array.from(h.childNodes).some(
              (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
            );
            if (!own) continue;
            const s = getComputedStyle(h);
            rows.push({
              where: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`,
              /*
               * **Not rounded.** Block 13 session 104's own mutation M2 put an `em`
               * back on the disclosure rows; at 0.85em of a 15px parent that is
               * 12.75px, which rounds to 13 and slipped through a test that had
               * just been written to catch exactly that. A step is a pixel value,
               * so the assertion is exact.
               */
              px: parseFloat(s.fontSize),
              weight: s.fontWeight,
              colour: s.color,
              underlined: s.textDecorationLine.includes('underline'),
            });
          }
          return rows;
        })),
      );
    }
    return out;
  }

  /**
   * **Four sizes, and nothing between them.** Measured before this session, the
   * three screens rendered eleven — 8.96, 9.39, 10.4, 10.54, 10.84, 11.05, 11.56,
   * 13.26, 14.45, 15.17 and 17 px — because every size was written in `em` and
   * compounded through nesting. This is the test that fails the moment one is.
   */
  it('draws every word at one of the four steps', async () => {
    if (browser === undefined) return;
    const page = await hisPanel(browser);
    const steps = [11, 13, 15, 17];
    const strays = [
      ...new Set(
        (await everyText(page))
          .filter((r) => !steps.includes(r.px))
          .map((r) => `${r.where} at ${String(r.px)}px`),
      ),
    ];
    expect(strays).toEqual([]);
    await page.close();
  }, 120_000);

  /** Two weights carry the hierarchy; a third would be a fourth size by other means. */
  it('uses two weights and the panel’s own greys, and no other', async () => {
    if (browser === undefined) return;
    const page = await hisPanel(browser);
    const all = await everyText(page);
    const weights = [...new Set(all.map((r) => r.weight))].sort();
    expect(weights).toEqual(['400', '600']);
    const palette = [
      'rgb(232, 234, 237)', // --text
      'rgb(154, 161, 171)', // --muted
      'rgb(107, 114, 128)', // --faint
      'rgb(237, 28, 36)', //   --accent
      'rgb(255, 255, 255)', // on the accent button
      'rgb(210, 153, 34)', //  --warn
      'rgb(63, 185, 80)', //   --ok
    ];
    const odd = [...new Set(all.filter((r) => !palette.includes(r.colour)).map((r) => `${r.where} ${r.colour}`))];
    expect(odd).toEqual([]);
    await page.close();
  }, 120_000);

  /**
   * **Nothing is underlined at rest.** Mohamed's own words about the panel:
   * underlined text at many sizes, reading like a paragraph in Word. There were
   * five underlines — `.linky` in two places, `button.link`, and the browser's own
   * on nothing else — and the affordance they carried is now weight and contrast.
   */
  it('underlines nothing until it is hovered or focused', async () => {
    if (browser === undefined) return;
    const page = await hisPanel(browser);
    const underlined = [...new Set((await everyText(page)).filter((r) => r.underlined).map((r) => r.where))];
    expect(underlined).toEqual([]);

    /* And it comes back on hover, where it confirms rather than decorates. */
    await onScreen(page, 'run');
    await page.hover('section.do p.say button.linky');
    const hovered = await page.$eval(
      'section.do p.say button.linky',
      (el) => getComputedStyle(el).textDecorationLine,
    );
    expect(hovered).toContain('underline');
    await page.close();
  }, 120_000);

  /**
   * **A disclosure row is one control, not four that resemble each other.** They
   * appear on all three screens — the client card, *What these two make*, *What it
   * cost, step by step*, *What else it will use*, *The watermark on this video*.
   */
  it('draws every disclosure row identically, with a caret of its own', async () => {
    if (browser === undefined) return;
    const page = await hisPanel(browser);
    const rows: string[] = [];
    let carets = 0;
    for (const screen of ['choose', 'run', 'build'] as const) {
      await onScreen(page, screen);
      const found = await page.$$eval('details.quibbles > summary', (els) =>
        els
          .filter((e) => (e as HTMLElement).checkVisibility())
          .map((e) => {
            const s = getComputedStyle(e);
            const before = getComputedStyle(e, '::before');
            return {
              key: `${s.fontSize}/${s.fontWeight}/${s.color}/${s.cursor}/${s.borderTopWidth}`,
              caret: before.content !== 'none' && parseFloat(before.width) > 0 ? 1 : 0,
              marker: s.listStyleType,
            };
          }),
      );
      for (const f of found) {
        rows.push(f.key);
        carets += f.caret;
        expect(f.marker).toBe('none');
      }
    }
    /* Every row on every screen drew the same way. */
    expect([...new Set(rows)]).toHaveLength(1);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(carets).toBe(rows.length);
    await page.close();
  }, 120_000);

  /**
   * **Three spacing values, and the grouping readable before the words are.** The
   * space around a section must be larger than the space between the groups inside
   * it, which must be larger than the space inside a group — otherwise a heading is
   * the only thing saying where a group begins.
   */
  it('spaces a section, a group and a pair at three measured distances', async () => {
    if (browser === undefined) return;
    const page = await hisPanel(browser);
    await onScreen(page, 'run');
    const gaps = await page.evaluate(() => {
      const px = (el: Element | null, prop: string): number =>
        el === null ? -1 : Math.round(parseFloat(getComputedStyle(el).getPropertyValue(prop)));
      return {
        section: px(document.querySelector('main'), 'row-gap'),
        group: px(document.querySelector('section.do'), 'row-gap'),
        tight: px(document.querySelector('section.do .partrun'), 'row-gap'),
      };
    });
    console.log(
      `  == spacing: section ${String(gaps.section)}px, group ${String(gaps.group)}px, tight ${String(gaps.tight)}px`,
    );
    expect(gaps).toEqual({ section: 28, group: 16, tight: 8 });
    /* And they are a rhythm, not three numbers that happen to differ. */
    expect(`${String(gaps.section > gaps.group && gaps.group > gaps.tight)}`).toBe('true');
    await page.close();
  }, 120_000);
});
