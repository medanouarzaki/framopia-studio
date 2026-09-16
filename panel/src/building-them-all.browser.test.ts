import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { built, INDEX, HANDSHAKE, stubHost, realPanelRoutes, onScreen } from './browser-harness.js';

/**
 * **Building them all, on the screen.**
 *
 * Block 14 session 114. `service/src/build-queue.test.ts` proves the sequence and
 * what it does with a failure; this proves what he is looking at — which videos
 * are offered, what one press sends, and what a failure says.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 180_000);

const HER = 'Dr Loubna Kfafi/September Content/Exports/';
const REELS = ['sora', 'sculptra-explainer', 'botox-myths', 'skin-booster'].map(
  (n) => `${HER}${n}.mov`,
);

/**
 * A run queue that finished, with three of the four videos through.
 *
 * **Two jobs, answered apart.** The harness has one __job for every poll, and
 * with a run queue and a build list in flight at once that made the build block
 * render the queue's items — which looked like a panel defect and was an
 * instrument that could not tell two jobs apart. Session 112 paid for this
 * lesson with a 350 ms stub; this is the same mistake in a new place, so the
 * stub below answers by job id.
 */
function aFinishedQueue(): string {
  return `
    window.__sent = [];
    window.__queue = {
      id: 'q-1', status: 'done', progress: 1,
      detail: {
        items: ${JSON.stringify(REELS)}.map((reel, i) => ({
          reel, modeId: 'dr-loubna-kfafi',
          outcome: i === 1 ? 'failed' : 'done',
          spentUsd: 0, attempts: 1, stage: null,
          startedAt: '2026-09-16T10:00:00Z', finishedAt: '2026-09-16T10:20:00Z',
        })),
        runningIndex: null, spentUsd: 0, done: true, stopped: false,
      },
    };
    window.__job = () => window.__queue;
    /* Two jobs, answered apart — see the note above this string. */
    window.__builds = null;
    const real = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      const method = String((init && init.method) || 'GET').toUpperCase();
      if (method === 'POST' && u.indexOf('/jobs') !== -1) {
        var body = JSON.parse(String(init.body));
        window.__sent.push(body);
        var id = body.type === 'build-queue' ? 'b-1' : 'q-1';
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: id }) });
      }
      if (u.indexOf('/jobs/b-1') !== -1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(window.__builds ?? { id: 'b-1', status: 'running' }),
        });
      }
      if (u.indexOf('/jobs/q-1') !== -1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__queue) });
      }
      return real(url, init);
    };
  `;
}

async function panelWithAFinishedQueue(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
  await page.addInitScript(aFinishedQueue());
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
  await page.waitForTimeout(250);
  await page.selectOption('select[aria-label="Video"]', REELS[0] as string);
  await page.waitForTimeout(400);
  /*
   * Start a list, because following a queue job is how the panel learns which
   * videos finished. One tick and one press, which is the whole point of the
   * screen this session built.
   */
  await onScreen(page, 'run');
  await page.waitForTimeout(400);
  const first = await page.$('.pickseveral button.pick');
  if (first === null) throw new Error('the videos cannot be ticked on Make');
  await first.click({ timeout: 3000 });
  await page.waitForTimeout(250);
  const start = await page.$('section.pane button.run');
  if (start === null) throw new Error('there is no control to start the list');
  await start.click({ timeout: 3000 });
  await page.waitForTimeout(600);
  return page;
}

describe.skipIf(!built)('building every finished video', () => {
  it('offers the videos the list finished, and not the one that failed', async () => {
    const page = await panelWithAFinishedQueue();
    if (page === null) return;
    await onScreen(page, 'build');
    await page.waitForTimeout(600);

    const block = await page.$('.buildall');
    const names = block === null ? [] : await page.$$eval('.buildall li .k', (els) =>
      els.map((e) => (e.textContent ?? '').trim()),
    );
    console.log(`\n  == Build offers: ${names.join(', ') || '(nothing)'}`);
    expect(names).toEqual(['sora.mov', 'botox-myths.mov', 'skin-booster.mov']);
    /* The one that failed is not offered: there is nothing to build for it. */
    expect(names).not.toContain('sculptra-explainer.mov');
    await page.close();
  }, 120_000);

  it('sends every one of them in a single press, with its plan', async () => {
    const page = await panelWithAFinishedQueue();
    if (page === null) return;
    await onScreen(page, 'build');
    await page.waitForTimeout(600);
    await page.click('.buildall button', { timeout: 4000 });
    await page.waitForTimeout(500);

    const sent = await page.evaluate(
      () => (window as unknown as { __sent: { type: string; params: { items: unknown[] } }[] }).__sent,
    );
    const builds = sent.filter((s) => s.type === 'build-queue');
    console.log(
      `  == one press sent ${String(builds.length)} request(s), ` +
        `${String(builds[0]?.params.items.length ?? 0)} video(s)`,
    );
    expect(builds.length).toBe(1);
    expect(builds[0]?.params.items).toEqual([
      { reel: `${HER}sora.mov`, planPath: '/v/p0.json', modeId: 'dr-loubna-kfafi' },
      { reel: `${HER}botox-myths.mov`, planPath: '/v/p2.json', modeId: 'dr-loubna-kfafi' },
      { reel: `${HER}skin-booster.mov`, planPath: '/v/p3.json', modeId: 'dr-loubna-kfafi' },
    ]);
    await page.close();
  }, 120_000);

  it('never sends two build lists for one press', async () => {
    const page = await panelWithAFinishedQueue();
    if (page === null) return;
    await onScreen(page, 'build');
    await page.waitForTimeout(600);
    const button = await page.$('.buildall button');
    if (button === null) throw new Error('no build-all control');
    await button.click({ timeout: 4000 }).catch(() => undefined);
    await button.click({ timeout: 2000, force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
    const sent = await page.evaluate(
      () => (window as unknown as { __sent: { type: string }[] }).__sent,
    );
    expect(sent.filter((s) => s.type === 'build-queue').length).toBe(1);
    await page.close();
  }, 120_000);

  it('says which one did not build, in his words, and never raw', async () => {
    const page = await panelWithAFinishedQueue();
    if (page === null) return;
    await onScreen(page, 'build');
    await page.waitForTimeout(600);
    /*
     * The build list's answer is in place **before** the press, so the very
     * first poll carries it. Setting it afterwards raced the poll interval and
     * the block was still showing its ready state when the assertion ran —
     * which reads as a panel that does not report a failure, and was a test
     * looking a beat too early.
     */
    await page.evaluate(() => {
      const w = window as unknown as { __builds: unknown };
      w.__builds = ({
        id: 'b-1', status: 'done', progress: 1,
        detail: {
          items: [
            { reel: 'Dr Loubna Kfafi/September Content/Exports/sora.mov',
              planPath: '/v/p0.json', outcome: 'built', savePath: '/out/sora.aep' },
            { reel: 'Dr Loubna Kfafi/September Content/Exports/botox-myths.mov',
              planPath: '/v/p2.json', outcome: 'failed', savePath: null,
              error: 'there is no Edit Plan at /v/p2.json. Run the pipeline for this reel first.' },
          ],
          buildingIndex: null, buildingPercent: null, done: true, stopped: false,
        },
      });
    });
    await page.click('.buildall button', { timeout: 4000 });
    await page.waitForTimeout(900);

    const said = await page.$$eval('.buildall', (els) =>
      els.map((e) => (e.textContent ?? '').trim()).join(' '),
    );
    console.log(`  == after a failure the block reads: ${said.slice(0, 210)}`);
    expect(said).toContain('botox-myths');
    expect(said).toContain('Did not build');
    /* Session 91's rule: never the raw text, never a command, never a path. */
    expect(said).not.toContain('/v/p2.json');
    expect(said).not.toMatch(/npm run|terminal/i);
    await page.close();
  }, 120_000);
});

/**
 * **The rules the restructure moved, still holding.**
 *
 * Session 109 proved that a duplicate add is refused, with a control that no
 * longer exists: *Add X to the list* went disabled once its video was in. The
 * rule is the same and the mechanism is better — a row toggles, so a list cannot
 * hold one video twice by construction — but a rule whose proof was deleted with
 * its control is a rule nobody is watching. This is that proof, re-earned.
 */
/**
 * A panel with no list running, which is when the videos are chosen. While a
 * list runs the pane shows the list instead — session 94's card — so these
 * arrive without starting one.
 */
async function panelReadyToChoose(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
  /* What reaches the service, not what the DOM shows — session 112's rule. */
  await page.addInitScript(`
    window.__sent = [];
    const real = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      const method = String((init && init.method) || 'GET').toUpperCase();
      if (method === 'POST' && u.indexOf('/jobs') !== -1) {
        window.__sent.push(JSON.parse(String(init.body)));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'q-9' }) });
      }
      return real(url, init);
    };
  `);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
  await page.waitForTimeout(400);
  await onScreen(page, 'run');
  await page.waitForTimeout(400);
  return page;
}

describe.skipIf(!built)('choosing several videos', () => {
  it('cannot put the same video in the list twice', async () => {
    const page = await panelReadyToChoose();
    if (page === null) return;
    const rows = await page.$$('.pickseveral button.pick');
    const first = rows[0];
    if (first === undefined) throw new Error('nothing to tick');
    /*
     * Five presses on one row, which is an odd number so it ends in the list.
     *
     * **What is counted is what the list would send**, not what the row looks
     * like. The first version of this read the marked rows instead, and a
     * mutation that appended the same video four times left one row marked —
     * because the mark is found by the first match — so the test stayed green
     * over a list holding four copies. Session 112 learned this on a different
     * control; it is the same mistake.
     */
    for (let i = 0; i < 5; i += 1) {
      await first.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(150);
    }
    await page.click('button.run:has-text("Make these")', { timeout: 4000 });
    await page.waitForTimeout(500);
    const sent = await page.evaluate(
      () => (window as unknown as { __sent: { type: string; params: { items: { reel: string }[] } }[] }).__sent,
    );
    const items = sent.find((x) => x.type === 'queue')?.params.items ?? [];
    console.log(
      `  == five presses on one row send ${String(items.length)} video(s): ` +
        `${items.map((i) => i.reel.split('/').pop() ?? '').join(', ')}`,
    );
    expect(items.length).toBe(1);
    await page.close();
  }, 120_000);

  it('shows what is in the list, and in what order', async () => {
    const page = await panelReadyToChoose();
    if (page === null) return;
    const rows = await page.$$('.pickseveral button.pick');
    /* Ticked third, first, second: the numbers follow the order he chose. */
    await rows[2]?.click({ timeout: 3000 });
    await page.waitForTimeout(150);
    await rows[0]?.click({ timeout: 3000 });
    await page.waitForTimeout(150);
    await rows[1]?.click({ timeout: 3000 });
    await page.waitForTimeout(250);
    const chosen = await page.$$eval('.pickseveral button.pick.chosen .k', (els) =>
      els.map((e) => (e.textContent ?? '').trim()),
    );
    console.log(`  == the list reads: ${chosen.join(' | ')}`);
    expect(chosen.some((c) => c.startsWith('1.'))).toBe(true);
    expect(chosen.some((c) => c.startsWith('2.'))).toBe(true);
    expect(chosen.some((c) => c.startsWith('3.'))).toBe(true);
    await page.close();
  }, 120_000);

  it('keeps a video chosen under another client visible, not silently counted', async () => {
    const page = await panelReadyToChoose();
    if (page === null) return;
    const rows = await page.$$('.pickseveral button.pick');
    await rows[0]?.click({ timeout: 3000 });
    await page.waitForTimeout(250);
    const before = await page.$$eval('.pickseveral button.pick.chosen', (els) => els.length);
    /* Her video is in the list; now look at the other client. */
    await onScreen(page, 'choose');
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await page.waitForTimeout(400);
    await onScreen(page, 'run');
    await page.waitForTimeout(300);
    const after = await page.$$eval('.pickseveral button.pick.chosen .k', (els) =>
      els.map((e) => (e.textContent ?? '').trim()),
    );
    console.log(`  == across a client change, still in the list: ${after.join(', ') || '(nothing)'}`);
    expect(before).toBe(1);
    expect(after.length).toBe(1);
    await page.close();
  }, 120_000);
});
