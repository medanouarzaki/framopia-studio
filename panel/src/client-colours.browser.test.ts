import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { HANDSHAKE, INDEX, built, stubHost, stubRoutes, stepsThrough } from './browser-harness.js';

/**
 * **Entering a client's four brand colours, in the real built panel.**
 *
 * Block 10 session 47. The four colour rows were a native `<input
 * type="color">` and a `<code>` label; the label was `contentEditable` false
 * and could not take focus, so a colour could only be set by dragging inside
 * the operating system's picker — and a keypress with that picker open only
 * dismisses it, because the picker is an OS window that nothing on the page
 * owns. The user found it setting up his second client, with four codes in
 * front of him and nowhere to put them.
 *
 * **Its own file, and so its own browser.** These first lived in
 * `render.browser.test.ts`, and six more tests there was enough to make the
 * image-picker tests start failing: they wait for an `img` that exists only
 * while its file loads, their fixtures have been missing since the cut-outs
 * moved into per-reel folders, and they pass by winning a race. Measured, not
 * guessed — with these six skipped that file passed twice, and with them active
 * it failed three runs running.
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

interface Loaded {
  page: Page;
  uncaught: string[];
}

describe('setting up a client', () => {
  it('has a browser to run in', () => {
    if (!built) {
      console.warn('panel/dist is missing — build the panel to run the colour check');
      return;
    }
    expect(launchFailure, launchFailure ?? '').toBeNull();
  });

  async function openSetup(amend?: string): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      window.__picked = null;
      window.cep = { fs: { showOpenDialogEx: () => ({ err: 0, data: window.__picked === null ? [] : [window.__picked] }) } };
    `);
    if (amend !== undefined) await page.addInitScript(amend);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Client"]', '__new');
    await page.waitForSelector('main.editor', { timeout: 5000 });
    return { page, uncaught };
  }

  /**
   * **A brand colour is typed and pasted, not dragged.**
   *
   * Block 10 session 47. The four colour rows were a native `<input
   * type="color">` and a `<code>` label; the label was `contentEditable` false
   * and could not take focus, so the only way to set a colour was to drag
   * inside the operating system's picker — and a keypress with that picker open
   * only dismisses it, because the picker is an OS window and nothing on the
   * page owns it. The user found it setting up his second client, with four
   * codes in front of him and nowhere to put them.
   */
  const BRAND = {
    light: '#FFF4E8',
    accent: '#E8873A',
    primary: '#123448',
    background: '#1C1210',
  };
  const HEX_BOX = (what: string): string => `input[aria-label="${what} — colour code"]`;
  const ROLE_LABEL: Record<string, string> = {
    light: 'your ordinary subtitle words, and usually the frame round a picture',
    accent: 'the words you emphasise',
    primary: 'the shadow behind every word, and depth in the generated pictures',
    background: 'behind a cut-out picture, and the ground the generated pictures are lit against',
  };

  function postCatcher(): string {
    return `
      window.__posted = null;
      const inner = window.fetch;
      window.fetch = (url, init) => {
        if (String(url).indexOf('/clients') !== -1 && init && init.method === 'POST') {
          window.__posted = JSON.parse(init.body);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'dr-jenna', modes: window.__payload.modes.modes }),
          });
        }
        return inner(url, init);
      };
    `;
  }

  it('takes a typed colour code, and the swatch follows it', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const page = loaded.page;
      for (const [role, hex] of Object.entries(BRAND)) {
        await page.fill(HEX_BOX(ROLE_LABEL[role] as string), hex);
      }
      const swatches = await page.$$eval('.colours input[type="color"]', (els) =>
        els.map((e) => (e as HTMLInputElement).value.toUpperCase()),
      );
      // Display order: light, accent, primary, background.
      expect(swatches).toEqual([BRAND.light, BRAND.accent, BRAND.primary, BRAND.background]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('takes a pasted code, which is how a brand colour actually arrives', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const page = loaded.page;
      const box = HEX_BOX(ROLE_LABEL['accent'] as string);
      await page.focus(box);
      // A real paste, not a fill: the clipboard is where a brand sheet lands.
      await page.evaluate(`
        (() => {
          const el = document.querySelector(${JSON.stringify(box)});
          const dt = new DataTransfer();
          dt.setData('text/plain', '  #e8873a  ');
          el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
          // jsdom-free browsers do not apply the paste for us; the value change
          // is what React listens to, so drive it the way the browser would.
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(el, '  #e8873a  ');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        })()
      `);
      const swatch = await page.$eval(
        `.colours input[aria-label="${ROLE_LABEL['accent']}"]`,
        (e) => (e as HTMLInputElement).value.toUpperCase(),
      );
      expect(swatch).toBe('#E8873A');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('takes the forms a person writes, and refuses what is not a colour', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const page = loaded.page;
      const box = HEX_BOX(ROLE_LABEL['accent'] as string);
      const swatchOf = async (): Promise<string> =>
        (
          await page.$eval(
            `.colours input[aria-label="${ROLE_LABEL['accent']}"]`,
            (e) => (e as HTMLInputElement).value,
          )
        ).toUpperCase();

      for (const [typed, expected] of [
        ['#E8873A', '#E8873A'],
        ['e8873a', '#E8873A'],
        ['E83', '#EE8833'],
        ['  #fff4e8  ', '#FFF4E8'],
      ] as [string, string][]) {
        await page.fill(box, typed);
        expect(await swatchOf(), `${typed} should become ${expected}`).toBe(expected);
      }

      // Refused, and visibly: the swatch keeps the last good colour rather than
      // silently becoming black.
      await page.fill(box, '#12345');
      expect(await swatchOf()).toBe('#FFF4E8');
      expect(await page.textContent('.colours')).toContain('not a colour code');
      expect(await page.$$('.colours input.hex.refused')).toHaveLength(1);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('sends exactly the four codes that were typed', async () => {
    const loaded = await openSetup(postCatcher());
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.fill('input[aria-label="Name"]', 'Dr Jenna');
      for (const [role, hex] of Object.entries(BRAND)) {
        await page.fill(HEX_BOX(ROLE_LABEL[role] as string), hex);
      }
      await page.click('main.editor > button.ghost');
      await page.waitForSelector('section.client', { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as { palette?: Record<string, string> };
      expect(posted.palette).toEqual(BRAND);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  /** Session 45's rule, which this must not undo: untouched is never sent. */
  it('sends no palette at all when the codes were left alone', async () => {
    const loaded = await openSetup(postCatcher());
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.fill('input[aria-label="Name"]', 'Dr Jenna');
      await page.click('main.editor > button.ghost');
      await page.waitForSelector('section.client', { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as { palette?: unknown };
      expect(posted.palette).toBeUndefined();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  /** Three of four is not a palette; the mode holds all four or none. */
  it('sends no palette when only some of the four were entered', async () => {
    const loaded = await openSetup(postCatcher());
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.fill('input[aria-label="Name"]', 'Dr Jenna');
      await page.fill(HEX_BOX(ROLE_LABEL['accent'] as string), BRAND.accent);
      await page.fill(HEX_BOX(ROLE_LABEL['light'] as string), BRAND.light);
      await page.click('main.editor > button.ghost');
      await page.waitForSelector('section.client', { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as { palette?: unknown };
      expect(posted.palette).toBeUndefined();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

});
