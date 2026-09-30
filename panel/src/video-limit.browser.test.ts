import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  built,
  HANDSHAKE,
  INDEX,
  onScreen,
  overTheLimit,
  realPanelRoutes,
  refusedAtTheLimit,
  stubHost,
} from './browser-harness.js';

/**
 * **The limit that refused him, in the panel, where it refused him.**
 *
 * Block 15 session 119. *Make the pictures — about $6.87* was refused with
 * *"Raise the limit"*, and nothing on his screen was that limit. These drive the
 * built panel with his data and his refused video laid over it.
 *
 * **Every assertion reads an extracted value**, never a live handle — Block 10
 * session 54 lost a run to a Playwright handle serialised into a diff.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

/** Every non-GET the panel sends, with its body, answered slowly. */
const RECORDING = `
  window.__sent = [];
  const answered = window.fetch;
  window.fetch = (url, init) => {
    const method = String((init && init.method) || 'GET').toUpperCase();
    if (method !== 'GET' && String(url).indexOf('/money/video-limit') !== -1) {
      window.__sent.push(method + ' ' + String(url).replace(/^https?:\\/\\/[^/]+/, '') + ' ' +
        String((init && init.body) || ''));
      return new Promise((go) => setTimeout(() => go({ ok: true, json: () => Promise.resolve({}) }), 1500));
    }
    return answered(url, init);
  };
`;

async function his(...extra: string[]): Promise<{ page: Page; uncaught: string[] } | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (e) => uncaught.push(e.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
  for (const script of extra) await page.addInitScript(script);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('header.brand', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
  await page.waitForTimeout(250);
  await page.selectOption(
    'select[aria-label="Video"]',
    'Dr Loubna Kfafi/September Content/Exports/sora.mov',
  );
  await page.waitForTimeout(600);
  await onScreen(page, 'run');
  return { page, uncaught };
}

/** Where the lowest visible section ends — the ruler `measure-height` prints. */
async function endsAt(page: Page): Promise<number> {
  return await page.evaluate(() =>
    Math.max(
      ...Array.from(document.querySelectorAll('section'))
        .filter((s) => s.checkVisibility())
        .map((s) => Math.round(s.getBoundingClientRect().bottom + window.scrollY)),
    ),
  );
}

describe.skipIf(!built)('the most for one video', () => {
  it('is not on an ordinary day’s Make, which is unchanged', async () => {
    const at = await his();
    if (at === null) return;
    expect(await at.page.$$eval('.videolimit', (els) => els.length)).toBe(0);
    await at.page.close();
  });

  it('is beside Make the pictures when the video is over it, and says what it needs', async () => {
    const at = await his(overTheLimit());
    if (at === null) return;
    const { page } = at;
    const read = await page.evaluate(() => {
      const box = document.querySelector('.partrun .withlimit .videolimit');
      const buttons = Array.from(document.querySelectorAll('.partrun button.run'));
      const pictures = buttons.find((b) => (b.textContent ?? '').startsWith('Make the pictures'));
      const a = pictures?.getBoundingClientRect();
      const b = box?.getBoundingClientRect();
      const note = document.querySelector('.partrun > p.hint[role="status"]');
      return {
        said: note?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        label: box?.querySelector('.capentry span')?.textContent ?? null,
        placeholder: box?.querySelector('input')?.getAttribute('placeholder') ?? null,
        pictures: pictures?.textContent ?? null,
        stillPressable: pictures !== undefined && !(pictures as HTMLButtonElement).disabled,
        besideIt:
          a !== undefined &&
          b !== undefined &&
          b.left >= a.right &&
          b.top < a.bottom &&
          b.bottom > a.top,
      };
    });
    expect(read).toEqual({
      said:
        'About $6.87 is more than the $4.00 you allow for one video, so Make the pictures ' +
        'would be refused and nothing spent. It needs $6.88 or more.',
      label: 'Most for one video',
      placeholder: '$4.00',
      pictures: 'Make the pictures — about $6.87',
      stillPressable: true,
      besideIt: true,
    });
    expect(at.uncaught).toEqual([]);
    expect(await endsAt(page)).toBeLessThanOrEqual(900);
    await page.close();
  });

  it('sends his figure once, however fast Save is pressed', async () => {
    const at = await his(overTheLimit(), RECORDING);
    if (at === null) return;
    const { page } = at;
    await page.fill('.videolimit input', '8');
    const save = await page.$('.videolimit button');
    await save?.click();
    await save?.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(2200);
    const sent = await page.evaluate(() => (window as unknown as { __sent: string[] }).__sent);
    expect(sent).toEqual(['POST /money/video-limit {"usd":8}']);
    expect(at.uncaught).toEqual([]);
    await page.close();
  });

  it('sends nothing that is not an amount, and says so', async () => {
    const at = await his(overTheLimit(), RECORDING);
    if (at === null) return;
    const { page } = at;
    await page.fill('.videolimit input', 'lots');
    await page.click('.videolimit button');
    await page.waitForTimeout(300);
    const read = await page.evaluate(() => ({
      sent: (window as unknown as { __sent: string[] }).__sent,
      said: Array.from(document.querySelectorAll('.videolimit p[role="status"]')).map(
        (p) => p.textContent,
      ),
    }));
    expect(read.sent).toEqual([]);
    expect(read.said).toContain('Type an amount in dollars, like 8.');
    await page.close();
  });

  it('is there after a run it refused, and the refusal names it', async () => {
    const at = await his(overTheLimit(), refusedAtTheLimit());
    if (at === null) return;
    const { page } = at;
    await page.click('section.do .partrun button.run');
    await page.waitForTimeout(900);
    const read = await page.evaluate(() => ({
      said: Array.from(document.querySelectorAll('p.reason')).map((p) =>
        (p.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
      control: document.querySelector('.videolimit .capentry span')?.textContent ?? null,
    }));
    expect(read.said).toContain(
      'This would cost about $6.87, more than the $4.00 you allow for one video, so nothing ' +
        'was spent. Set “Most for one video”, beside Make the pictures, to $6.88 or more.',
    );
    expect(read.control).toBe('Most for one video');
    expect(at.uncaught).toEqual([]);
    expect(await endsAt(page)).toBeLessThanOrEqual(900);
    await page.close();
  });

  it('is on the money screen beside the cap, saying it refuses where the cap warns', async () => {
    const at = await his();
    if (at === null) return;
    const { page } = at;
    await page.click('button.seemoney');
    await page.waitForSelector('.moneybanner', { timeout: 15_000 });
    const read = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.moneycap'));
      return blocks.map((b) => ({
        heading: b.querySelector('h3')?.textContent ?? null,
        says: (b.querySelector('p')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        label: b.querySelector('.capentry span')?.textContent ?? null,
      }));
    });
    expect(read).toEqual([
      {
        heading: 'A monthly cap',
        says: expect.stringContaining('A cap only warns.') as unknown as string,
        label: 'Warn me past',
      },
      {
        heading: 'The most for one video',
        says:
          'Making one video that would cost more than this is refused before anything is ' +
          'spent. It is $4.00 now.',
        label: 'Most for one video',
      },
    ]);
    expect(at.uncaught).toEqual([]);
    await page.close();
  });
});
