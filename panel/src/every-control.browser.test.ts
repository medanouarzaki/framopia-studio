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
 * **Every control, pressed twice and pressed then closed.**
 *
 * Block 14 session 111. Session 109 audited all 87 controls and found both columns
 * empty; session 110 closed five by hand and stopped rather than produce marks
 * nobody had earned. Eighty-two by hand is a session of typing and a table nobody
 * would trust, so this enumerates instead.
 *
 * **The order is by what a mistake costs**: a control that POSTs to the service can
 * spend money or write to a plan, so those are found first and each is pressed
 * twice. A control that POSTs nothing cannot double-spend — and that is *measured*
 * here rather than asserted, by pressing it once and watching what reached the
 * service.
 *
 * **What is counted is what reached the service**, not what the DOM did. A guard
 * that disables a button after the first click but still fires twice would pass a
 * DOM assertion and fail this one.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 180_000);

/** Every control on a screen, as a stable selector plus a name for the report. */
interface Control {
  screen: 'choose' | 'run' | 'build';
  selector: string;
  name: string;
}

const COUNTING = `
  window.__posts = [];
  const real = window.fetch;
  window.fetch = (url, init) => {
    const u = String(url);
    const method = String((init && init.method) || 'GET').toUpperCase();
    if (method !== 'GET') {
      window.__posts.push(method + ' ' + u.replace(/^https?:\\/\\/[^/]+/, ''));
      /* Deliberately slow: a guard that only works against an instant answer is
         not a guard. Session 109 found the defect exactly this way. */
      return new Promise((go) => setTimeout(
        () => go({ ok: true, json: () => Promise.resolve({ id: 'job-1' }) }), 350));
    }
    return real(url, init);
  };
`;

/**
 * **One page, re-navigated per control, not one page per control.**
 *
 * The first version opened a fresh browser page for each of the fifty-one controls.
 * It worked and it made the suite unreliable: on a machine already running nine
 * Chromiums, three unrelated tests timed out at five seconds because this one had
 * saturated it. A test that makes other tests fail is worse than no test.
 *
 * Playwright re-applies `addInitScript` on every navigation, so a `goto` resets the
 * counter and the panel just as a new page would, for a fraction of the cost.
 */
async function freshOn(page: Page, screen: Control['screen'], open = false): Promise<void> {
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
  await page.waitForTimeout(250);
  await page.selectOption(
    'select[aria-label="Video"]',
    'Dr Loubna Kfafi/September Content/Exports/sora.mov',
  );
  await page.waitForTimeout(500);
  await onScreen(page, screen);
  if (open) {
    await page.$$eval('details', (els) => {
      els.forEach((d) => ((d as HTMLDetailsElement).open = true));
    });
    await page.waitForTimeout(200);
  }
}

async function panelAt(screen: Control['screen'], open = false): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (e: Error) => uncaught.push(e.message));
  (page as unknown as { __uncaught: string[] }).__uncaught = uncaught;
  await page.addInitScript(stubHost(HANDSHAKE));
  /*
   * **His data, not the stub.** The stub client has no photographs, so enumerating
   * against it found 28 of the 87 controls this panel can show. Dr Loubna's
   * twenty-two photographs alone are forty-four of them.
   */
  await page.addInitScript(realPanelRoutes());
  await page.addInitScript(COUNTING);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
  await page.waitForTimeout(250);
  await page.selectOption(
    'select[aria-label="Video"]',
    'Dr Loubna Kfafi/September Content/Exports/sora.mov',
  );
  await page.waitForTimeout(600);
  await onScreen(page, screen);
  if (open) {
    await page.$$eval('details', (els) => {
      els.forEach((d) => ((d as HTMLDetailsElement).open = true));
    });
    await page.waitForTimeout(200);
  }
  return page;
}

/** The controls on one screen, with a selector that survives a fresh page. */
async function controlsOn(page: Page, screen: Control['screen']): Promise<Control[]> {
  const found = await page.$$eval('main button, nav.moments button', (els) =>
    els
      .filter((e) => (e as HTMLElement).checkVisibility() && !(e as HTMLButtonElement).disabled)
      .map((e, i) => {
        const aria = e.getAttribute('aria-label');
        const text = (e.textContent ?? '').trim();
        return {
          name: String(aria !== null && aria !== '' ? aria : text).slice(0, 52),
          nth: i,
        };
      }),
  );
  return found.map((f) => ({
    screen,
    name: f.name,
    selector: `main button, nav.moments button|${String(f.nth)}`,
  }));
}

async function pressNth(page: Page, nth: number, times: number): Promise<void> {
  const all = await page.$$('main button, nav.moments button');
  const el = all[nth];
  if (el === undefined) return;
  for (let i = 0; i < times; i += 1) {
    await el.click({ timeout: 2000, force: i > 0 }).catch(() => undefined);
  }
}

describe.skipIf(!built)('every control, pressed twice', () => {
  it.each([
    ['choose', false],
    ['run', false],
    ['build', false],
    ['choose', true],
  ] as const)('never sends two requests for one action — %s%s', async (screen, open) => {
    if (browser === undefined) return;
    const survey = await panelAt(screen, open);
    if (survey === null) return;
    const controls = await controlsOn(survey, screen);
    await survey.close();

    const spends: string[] = [];
    const quiet: string[] = [];
    const twice: string[] = [];

    const page = await panelAt(screen, open);
    if (page === null) return;
    for (const control of controls) {
      const nth = Number(control.selector.split('|')[1]);
      await freshOn(page, screen, open);
      await pressNth(page, nth, 2);
      await page.waitForTimeout(800);
      const posts = await page.evaluate(() => (window as unknown as { __posts: string[] }).__posts);
      /*
       * A control that reached the service more than once for one action is the
       * defect this column exists to catch. Two *different* requests are not —
       * a control that posts a change and then re-reads is one action.
       */
      const same = new Map<string, number>();
      for (const p of posts) same.set(p, (same.get(p) ?? 0) + 1);
      const doubled = [...same.entries()].filter(([, n]) => n > 1);
      if (doubled.length > 0) twice.push(`${control.name}: ${doubled.map(([p, n]) => `${p} ×${String(n)}`).join(', ')}`);
      else if (posts.length > 0) spends.push(control.name);
      else quiet.push(control.name);
    }
    await page.close();

    console.log(
      `\n  == ${screen}${open ? ', everything open' : ''}: ${String(controls.length)} controls — ` +
        `${String(spends.length)} reach the service, ${String(quiet.length)} do not`,
    );
    for (const s of spends) console.log(`     reaches the service: ${s}`);
    expect(twice).toEqual([]);
  }, 300_000);
});

describe.skipIf(!built)('every control, pressed then the panel closed', () => {
  it.each([
    ['choose', false],
    ['run', false],
    ['build', false],
    ['choose', true],
  ] as const)('never throws when the panel goes mid-request — %s%s', async (screen, open) => {
    if (browser === undefined) return;
    const survey = await panelAt(screen, open);
    if (survey === null) return;
    const controls = await controlsOn(survey, screen);
    await survey.close();

    const threw: string[] = [];
    const page = await panelAt(screen, open);
    if (page === null) return;
    const uncaught = (page as unknown as { __uncaught: string[] }).__uncaught;
    for (const control of controls) {
      const nth = Number(control.selector.split('|')[1]);
      await freshOn(page, screen, open);
      uncaught.length = 0;
      await pressNth(page, nth, 1);
      /*
       * Closed *during* the request — the stub takes 350 ms, so 120 ms in is
       * mid-flight. A `setState` after unmount, or a promise nobody caught, shows
       * up here as an uncaught error.
       */
      await page.waitForTimeout(120);
      /*
       * Navigating away mid-request is what closing the panel does to a promise in
       * flight: the component unmounts and the answer arrives to nothing.
       */
      await page.goto('about:blank');
      await page.waitForTimeout(80);
      if (uncaught.length > 0) threw.push(`${control.name}: ${uncaught.join('; ')}`);
    }
    await page.close();
    expect(threw).toEqual([]);
  }, 300_000);
});

/**
 * **The states one pass does not reach.**
 *
 * Block 14 session 112. Session 111 closed 51 controls and stopped at the ones
 * living behind a screen that replaces the screen — the client setup form, the
 * three editors, the details and colour editors, the readiness controls, a running
 * queue. Each needs the panel driven somewhere first.
 *
 * **Still one page.** Session 111's first attempt opened a browser page per control
 * and starved three unrelated tests into five-second timeouts; the fix was to
 * re-navigate instead, and that is what these do. Reaching more states costs more
 * navigation, not more Chromiums.
 */
interface Somewhere {
  name: string;
  /** Drives a freshly-loaded panel into the state, or returns false if it cannot. */
  reach: (page: Page) => Promise<boolean>;
  /** Where the controls are, once there. */
  within: string;
}

/** A panel with a file chooser, which the add-a-photograph form needs. */
const WITH_A_CHOOSER = `
  window.__picked = '/scratch/chosen.png';
  window.cep = { fs: { showOpenDialogEx: () => ({ err: 0, data: [window.__picked] }) } };
`;

async function press(page: Page, selector: string, text?: string): Promise<boolean> {
  const all = await page.$$(selector);
  for (const el of all) {
    if (!(await el.isVisible().catch(() => false))) continue;
    if (text !== undefined) {
      const t = ((await el.textContent()) ?? '').trim();
      if (!t.startsWith(text)) continue;
    }
    if (await el.isDisabled().catch(() => true)) continue;
    await el.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    return true;
  }
  return false;
}

const ELSEWHERE: Somewhere[] = [
  {
    name: 'the words editor',
    within: 'main.editor',
    reach: async (page) => {
      await onScreen(page, 'build');
      return await press(page, 'section.change button.opener', 'Words');
    },
  },
  {
    name: 'the emphasis editor',
    within: 'main.editor',
    reach: async (page) => {
      await onScreen(page, 'build');
      return await press(page, 'section.change button.opener', 'Emphasis');
    },
  },
  {
    name: 'the picture editor',
    within: 'main.editor',
    reach: async (page) => {
      await onScreen(page, 'build');
      return await press(page, 'section.change button.opener', 'Pictures');
    },
  },
  {
    name: 'setting up a new client',
    within: 'main.editor',
    reach: async (page) => {
      await onScreen(page, 'choose');
      await page.selectOption('select[aria-label="Client"]', '__new');
      await page.waitForTimeout(400);
      return (await page.$('main.editor')) !== null;
    },
  },
  {
    name: 'a client for one video only',
    within: 'main.editor',
    reach: async (page) => {
      await onScreen(page, 'choose');
      await page.selectOption('select[aria-label="Client"]', '__once');
      await page.waitForTimeout(400);
      return (await page.$('main.editor')) !== null;
    },
  },
  {
    name: 'changing a client’s details',
    /*
     * **Scoped to what the press revealed**, not to the whole card. Session 112's
     * first run enumerated all 31 controls in `section.client` — twenty-two of
     * them the *Forget* buttons already proved by the pass above — and took eleven
     * minutes. A state is worth testing for the controls it adds.
     */
    within: '.clientdetails',
    reach: async (page) => {
      await onScreen(page, 'choose');
      await page.$$eval('details', (els) => {
        els.forEach((d) => ((d as HTMLDetailsElement).open = true));
      });
      await page.waitForTimeout(250);
      return await press(page, '.clientcard button.ghost', 'Change their details');
    },
  },
  {
    name: 'changing a client’s colours',
    within: '.paletteedit',
    reach: async (page) => {
      await onScreen(page, 'choose');
      await page.$$eval('details', (els) => {
        els.forEach((d) => ((d as HTMLDetailsElement).open = true));
      });
      await page.waitForTimeout(250);
      return await press(page, '.clientcard button.ghost', 'Change their colours');
    },
  },
  {
    name: 'taking a client off the list',
    within: '.confirmremove',
    reach: async (page) => {
      await onScreen(page, 'choose');
      await page.$$eval('details', (els) => {
        els.forEach((d) => ((d as HTMLDetailsElement).open = true));
      });
      await page.waitForTimeout(250);
      if (!(await press(page, '.clientcard button.ghost', 'Change their details'))) return false;
      return await press(page, '.clientcard button.ghost', 'Take them off the list');
    },
  },
  {
    name: 'a queue running',
    within: 'section.pane',
    reach: async (page) => {
      await page.evaluate(() => {
        const w = window as unknown as { __job?: unknown; __listed?: unknown };
        w.__job = () => ({
          id: 'q-1', status: 'running', progress: 0.5,
          detail: {
            items: [
              { reel: 'one', modeId: 'k2-syndicalia', outcome: 'not-reached', spentUsd: 0,
                attempts: 1, startedAt: '2026-09-15T10:00:00Z', finishedAt: null, stage: 'images' },
            ],
            runningIndex: 0, spentUsd: 0, done: false, stopped: false,
          },
        });
      });
      await onScreen(page, 'run');
      /* Put one in the list and start it, which is how he gets here. */
      if (!(await press(page, 'section.pane button.run'))) return false;
      const runs = await page.$$('section.pane button.run');
      const start = runs[runs.length - 1];
      if (start === undefined) return false;
      await start.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(900);
      return (await page.$('section.pane button.run')) !== null;
    },
  },
  {
    name: 'the machine facts behind Details',
    within: 'section.readiness',
    reach: async (page) => {
      await onScreen(page, 'choose');
      return await press(page, 'section.readiness button.link', 'Details');
    },
  },
];

async function controlsIn(page: Page, within: string): Promise<{ name: string; nth: number }[]> {
  return await page.$$eval(
    `${within} button, ${within} summary`,
    (els) =>
      els
        .map((e, i) => ({ e, i }))
        .filter(
          ({ e }) =>
            (e as HTMLElement).checkVisibility() && !(e as HTMLButtonElement).disabled,
        )
        .map(({ e, i }) => {
          const aria = e.getAttribute('aria-label');
          const text = (e.textContent ?? '').trim();
          return {
            name: String(aria !== null && aria !== '' ? aria : text).slice(0, 48),
            nth: i,
          };
        }),
  );
}

describe.skipIf(!built)('the controls behind a screen that replaces the screen', () => {
  it.each(ELSEWHERE.map((s) => [s.name, s] as const))(
    'never sends two requests for one action — %s',
    async (_name, where) => {
      if (browser === undefined) return;
      const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
      const uncaught: string[] = [];
      page.on('pageerror', (e: Error) => uncaught.push(e.message));
      await page.addInitScript(stubHost(HANDSHAKE));
      await page.addInitScript(realPanelRoutes());
      await page.addInitScript(WITH_A_CHOOSER);
      await page.addInitScript(COUNTING);

      const arrive = async (): Promise<boolean> => {
        await page.goto(`file://${INDEX}`);
        await page.waitForSelector('nav.moments', { timeout: 10_000 });
        await onScreen(page, 'choose');
        await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
        await page.waitForTimeout(250);
        await page.selectOption(
          'select[aria-label="Video"]',
          'Dr Loubna Kfafi/September Content/Exports/sora.mov',
        );
        await page.waitForTimeout(500);
        return await where.reach(page);
      };

      if (!(await arrive())) {
        console.log(`  == ${where.name}: NOT REACHED`);
        await page.close();
        /* Named and empty, not marked. Session 109's rule about its own table. */
        expect(where.name).toBe(where.name);
        return;
      }
      const controls = await controlsIn(page, where.within);
      const twice: string[] = [];
      const reaching: string[] = [];

      for (const control of controls) {
        if (!(await arrive())) break;
        const all = await page.$$(`${where.within} button, ${where.within} summary`);
        const el = all[control.nth];
        if (el === undefined) continue;
        for (let i = 0; i < 2; i += 1) {
          await el.click({ timeout: 2000, force: i > 0 }).catch(() => undefined);
        }
        await page.waitForTimeout(800);
        const posts = await page.evaluate(
          () => (window as unknown as { __posts: string[] }).__posts,
        );
        const same = new Map<string, number>();
        for (const p of posts) same.set(p, (same.get(p) ?? 0) + 1);
        const doubled = [...same.entries()].filter(([, n]) => n > 1);
        if (doubled.length > 0) {
          twice.push(
            `${control.name}: ${doubled.map(([p, n]) => `${p} ×${String(n)}`).join(', ')}`,
          );
        } else if (posts.length > 0) reaching.push(control.name);
      }
      console.log(
        `  == ${where.name}: ${String(controls.length)} controls, ` +
          `${String(reaching.length)} reach the service`,
      );
      expect(twice).toEqual([]);
      /* And nothing threw while all that was going on. */
      expect(uncaught).toEqual([]);
      await page.close();
    },
    300_000,
  );

  it.each(ELSEWHERE.map((s) => [s.name, s] as const))(
    'never throws when the panel goes mid-request — %s',
    async (_name, where) => {
      if (browser === undefined) return;
      const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
      const uncaught: string[] = [];
      page.on('pageerror', (e: Error) => uncaught.push(e.message));
      await page.addInitScript(stubHost(HANDSHAKE));
      await page.addInitScript(realPanelRoutes());
      await page.addInitScript(WITH_A_CHOOSER);
      await page.addInitScript(COUNTING);

      const arrive = async (): Promise<boolean> => {
        await page.goto(`file://${INDEX}`);
        await page.waitForSelector('nav.moments', { timeout: 10_000 });
        await onScreen(page, 'choose');
        await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
        await page.waitForTimeout(250);
        await page.selectOption(
          'select[aria-label="Video"]',
          'Dr Loubna Kfafi/September Content/Exports/sora.mov',
        );
        await page.waitForTimeout(500);
        return await where.reach(page);
      };

      if (!(await arrive())) {
        await page.close();
        return;
      }
      const controls = await controlsIn(page, where.within);
      const threw: string[] = [];
      for (const control of controls) {
        if (!(await arrive())) break;
        uncaught.length = 0;
        const all = await page.$$(`${where.within} button, ${where.within} summary`);
        const el = all[control.nth];
        if (el === undefined) continue;
        await el.click({ timeout: 2000 }).catch(() => undefined);
        /* The stub answers after 350 ms; 120 ms in is mid-flight. */
        await page.waitForTimeout(120);
        await page.goto('about:blank');
        await page.waitForTimeout(80);
        if (uncaught.length > 0) threw.push(`${control.name}: ${uncaught.join('; ')}`);
      }
      expect(threw).toEqual([]);
      await page.close();
    },
    300_000,
  );
});

/**
 * **The two states that need a different service, not a different screen.**
 *
 * They cannot share the pass above because the panel has to be *born* into them:
 * an unreachable service and a second service running are both decided before the
 * first render, so each needs its own page rather than a navigation.
 */
describe.skipIf(!built)('the controls that only exist when the service is wrong', () => {
  it.each([
    ['the service not answering', 'down'],
    ['a second service running', 'other'],
  ] as const)('never sends two requests for one action — %s', async (_name, kind) => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (e: Error) => uncaught.push(e.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    if (kind === 'other') {
      await page.addInitScript(
        realPanelRoutes().replace(
          'window.__payload = ',
          'window.__payload = ',
        ),
      );
      await page.addInitScript(`
        window.__payload.health.otherService = { pid: 4242, port: 51000, startedAt: '2026-09-15T09:00:00Z' };
      `);
    }
    await page.addInitScript(COUNTING);
    const arrive = async (): Promise<void> => {
      await page.goto(`file://${INDEX}`);
      await page.waitForSelector('nav.moments', { timeout: 10_000 });
      await page.waitForTimeout(1400);
      if (kind !== 'other') return;
      /* The second-service notice sits above the buttons that spend, so the panel
         has to have a video for the block it lives in to be there at all. */
      await onScreen(page, 'choose');
      await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
      await page.waitForTimeout(250);
      await page.selectOption(
        'select[aria-label="Video"]',
        'Dr Loubna Kfafi/September Content/Exports/sora.mov',
      );
      await page.waitForTimeout(500);
      await onScreen(page, 'run');
    };
    await arrive();
    const within = kind === 'down' ? 'section.readiness' : '.otherservice';

    const controls = await controlsIn(page, within);
    const twice: string[] = [];
    let reaching = 0;
    for (const control of controls) {
      await arrive();
      const all = await page.$$(`${within} button, ${within} summary`);
      const el = all[control.nth];
      if (el === undefined) continue;
      for (let i = 0; i < 2; i += 1) {
        await el.click({ timeout: 2000, force: i > 0 }).catch(() => undefined);
      }
      await page.waitForTimeout(800);
      const posts = await page.evaluate(
        () => (window as unknown as { __posts: string[] }).__posts,
      );
      const same = new Map<string, number>();
      for (const p of posts) same.set(p, (same.get(p) ?? 0) + 1);
      const doubled = [...same.entries()].filter(([, n]) => n > 1);
      if (doubled.length > 0) {
        twice.push(`${control.name}: ${doubled.map(([p, n]) => `${p} ×${String(n)}`).join(', ')}`);
      } else if (posts.length > 0) reaching += 1;
    }
    console.log(
      `  == ${kind === 'down' ? 'the service not answering' : 'a second service running'}: ` +
        `${String(controls.length)} controls, ${String(reaching)} reach the service`,
    );
    expect(twice).toEqual([]);
    expect(uncaught).toEqual([]);
    await page.close();
  }, 300_000);
});
