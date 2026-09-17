import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  built,
  INDEX,
  HANDSHAKE,
  HEALTHY_PAYLOAD,
  stubHost,
  onScreen,
} from './browser-harness.js';

/**
 * **What his partner meets, with nothing set up.**
 *
 * Block 15 session 118. Session 100 designed the empty states and said his
 * partner's first screen would say what to do first; nobody has ever confirmed
 * that is what he actually meets. A fresh machine has **no videos, no Edit
 * Plans, no client and no spending** — and 102 of the gate's tests fail on it,
 * which is expected and says nothing about whether the panel works.
 *
 * So this is the panel answering a service that is up and has nothing in it.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

/**
 * **A service that answers, and has nothing.**
 *
 * Not the same as a service that is down — session 100's empty states are for a
 * working machine on its first day, and a panel that cannot reach its service
 * shows something else entirely.
 */
/**
 * **A service that answers, and has nothing.**
 *
 * Not the same as a service that is down — session 100's empty states are for a
 * working machine on its first day, and a panel that cannot reach its service
 * shows something else entirely.
 *
 * **The health payload is the harness's own.** The first version of this fixture
 * invented one, the panel never got past its loading screen, and three tests
 * failed on a selector that was never going to appear — which reads as a broken
 * empty state and was a broken instrument. Everything below empties a real shape
 * rather than inventing one.
 */
function nothingYet(): string {
  return `
  window.__payload = ${JSON.stringify({
    health: HEALTHY_PAYLOAD,
    reels: { reels: [] },
    modes: { modes: [] },
    money: {
      totalUsd: 0, lines: 0, unreadable: 0, firstAt: null, lastAt: null,
      byDay: [], byMonth: [], byStage: [], byClient: [], byVideo: [], byPurpose: [],
      unattributedUsd: 0, credit: null, perReel: [],
      cap: { monthlyUsd: null, monthSoFarUsd: 0 },
      paidIn: { payments: [], totalInUsd: 0, impliedLeftUsd: 0 },
      byProviderPaid: [], unmatchedPaidInUsd: 0,
      reconciliation: {
        ledgerTotalUsd: 0, ledgerProductionUsd: 0, videosAccountForUsd: 0,
        outsideAnyVideoUsd: 0, unaccountedUsd: 0, overclaimedUsd: 0, agrees: true,
      },
    },
    steps: { steps: [], build: null },
    queues: { queues: [] },
    jobs: { jobs: [] },
  })};
  window.fetch = (url) => {
    const p = window.__payload;
    const u = String(url).split('?')[0];
    const body = u.indexOf('/health') !== -1 ? p.health
      : u.indexOf('/reels') !== -1 ? p.reels
      : u.indexOf('/modes') !== -1 ? p.modes
      : u.indexOf('/money') !== -1 ? p.money
      : u.indexOf('/queues') !== -1 ? p.queues
      : u.indexOf('/jobs') !== -1 ? p.jobs
      : u.indexOf('/steps') !== -1 ? p.steps
      : null;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
`;
}

async function aFreshMachine(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (e: Error) => uncaught.push(e.message));
  (page as unknown as { __uncaught: string[] }).__uncaught = uncaught;
  await page.addInitScript(stubHost(HANDSHAKE));
  /*
   * **Inside After Effects there is a file chooser**, and without one the panel
   * correctly says videos can only come from a client's folder. That sentence is
   * true of a host with no dialog and is not what his partner meets, so stubbing
   * it is what makes this measure his first day rather than the harness's.
   */
  await page.addInitScript(`window.cep = { fs: { showOpenDialogEx: () => ({ err: 0, data: [] }) } };`);
  await page.addInitScript(nothingYet());
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await page.waitForTimeout(700);
  return page;
}

describe.skipIf(!built)('a machine with nothing on it yet', () => {
  it('says what to do first, on all three screens, and never crashes', async () => {
    const page = await aFreshMachine();
    if (page === null) return;
    const uncaught = (page as unknown as { __uncaught: string[] }).__uncaught;

    for (const screen of ['choose', 'run', 'build'] as const) {
      await onScreen(page, screen);
      await page.waitForTimeout(300);
      const said = await page.$eval('main', (el) =>
        (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
      console.log(`\n  == ${screen}, on a machine with nothing on it:\n     ${said.slice(0, 400)}`);
      /* Something is on every screen: an empty panel that says nothing is the defect. */
      expect(said.length).toBeGreaterThan(20);
      /* Session 91's rule holds on the first day too. */
      expect(said).not.toMatch(/npm run|terminal|undefined|NaN|\[object/i);
    }
    expect(uncaught).toEqual([]);
    await page.close();
  }, 90_000);

  it('offers him a way to make a client with none on the list', async () => {
    const page = await aFreshMachine();
    if (page === null) return;
    await onScreen(page, 'choose');
    await page.waitForTimeout(300);
    const options = await page.$$eval('select[aria-label="Client"] option', (els) =>
      els.map((e) => ({ value: (e as HTMLOptionElement).value, text: (e.textContent ?? '').trim() })),
    );
    console.log(`  == the client picker offers: ${options.map((o) => `"${o.text}"`).join(', ')}`);
    /* `__new` is the route to setting one up, and it must be there with none saved. */
    expect(options.some((o) => o.value === '__new')).toBe(true);
    await page.close();
  }, 90_000);

  it('says the video list is empty rather than looking broken', async () => {
    const page = await aFreshMachine();
    if (page === null) return;
    await onScreen(page, 'choose');
    await page.waitForTimeout(300);
    const video = await page.$eval('select[aria-label="Video"]', (el) => ({
      disabled: (el as HTMLSelectElement).disabled,
      first: ((el as HTMLSelectElement).options[0]?.textContent ?? '').trim(),
    }));
    console.log(`  == the video picker says: "${video.first}" (disabled: ${String(video.disabled)})`);
    expect(video.first.length).toBeGreaterThan(0);
    expect(video.first).not.toContain('undefined');
    await page.close();
  }, 90_000);
});
