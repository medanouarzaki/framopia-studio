import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  built,
  INDEX,
  HANDSHAKE,
  stubHost,
  stubRoutes,
  stepsThrough,
  onScreen,
} from './browser-harness.js';

/**
 * **Pressed twice, fast.**
 *
 * Block 14 session 109 audited every control in the panel against seven
 * scenarios. The double-press column was **empty for all eighty-seven of them**:
 * no test anywhere in this project had ever pressed a control twice.
 *
 * It matters most on the three controls that spend. `Build.tsx` has always had
 * this right — `setStarting(true)` runs before the `await`, so the second press
 * meets a disabled button. `onRun` and the queue's start did the opposite: they
 * set the job to `null` and then started asynchronously, so between the press and
 * the first poll the button was **enabled and the money not yet spent**. On a
 * service taking a second to answer, a double-press bought the pictures twice.
 *
 * The counter below is the only honest assertion here: what reached the service.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

/**
 * A panel whose service answers slowly, and which counts what it is asked to
 * start. **The delay is the whole point**: a service that answers instantly hides
 * this defect, which is why it survived fourteen blocks.
 */
async function slowPanel(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
  await page.addInitScript(`
    window.__started = { starts: 0 };
    window.__job = () => ({ id: 'job-1', status: 'running', progress: 0.1, detail: null });
    const real = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      const isPost = init !== undefined && String(init.method ?? '').toUpperCase() === 'POST';
      /*
       * A run, a queue and a build all POST to /jobs — what is being counted is
       * how many starts two presses produce, which is the claim itself.
       */
      if (isPost && u.indexOf('/jobs') !== -1) {
        window.__started.starts += 1;
        return new Promise((go) => setTimeout(() => go({ ok: true, json: () => Promise.resolve({ id: 'job-1' }) }), 400));
      }
      return real(url, init);
    };
  `);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
  await page.waitForTimeout(250);
  await page.selectOption('select[aria-label="Video"]', 'vitasilk');
  await page.waitForTimeout(600);
  return page;
}

interface Counted { starts: number }
async function startedOn(page: Page): Promise<Counted> {
  return await page.evaluate(
    () => (window as unknown as { __started: Counted }).__started,
  );
}
/** Zeroed after navigating, so only the presses under test are counted. */
async function resetCount(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __started: Counted }).__started = { starts: 0 };
  });
}

describe.skipIf(!built)('a control that spends, pressed twice before it answers', () => {
  it.each([
    ['Make the subtitles', 0],
    ['Make the pictures', 1],
  ])('starts one run, not two — %s', async (_name, which) => {
    const page = await slowPanel();
    if (page === null) return;
    await onScreen(page, 'run');
    await resetCount(page);
    const buttons = await page.$$('section.do .partrun button.run');
    const button = buttons[which];
    expect(button).toBeDefined();
    if (button === undefined) return;

    /* Two presses inside the window the service takes to answer. */
    await button.click();
    await button.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(900);

    expect(await startedOn(page)).toEqual({ starts: 1 });
    await page.close();
  }, 60_000);

  it('starts one queue, not two', async () => {
    const page = await slowPanel();
    if (page === null) return;
    await onScreen(page, 'run');
    const add = await page.$('section.pane button.run');
    if (add !== null) await add.click();
    await page.waitForTimeout(200);

    await resetCount(page);
    const runs = await page.$$('section.pane button.run');
    /* The last one is "Make these N videos"; the first adds to the list. */
    const start = runs[runs.length - 1];
    expect(start).toBeDefined();
    if (start === undefined) return;

    await start.click();
    await start.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(900);

    expect(await startedOn(page)).toEqual({ starts: 1 });
    await page.close();
  }, 60_000);

  /**
   * **Build has always been right**, and this is here so it stays that way: it is
   * the shape the other two are being brought to.
   */
  it('starts one build, not two', async () => {
    const page = await slowPanel();
    if (page === null) return;
    await onScreen(page, 'build');
    await resetCount(page);
    const build = await page.$('button.build-now');
    if (build === null || (await build.isDisabled())) {
      await page.close();
      return;
    }
    await build.click();
    await build.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(900);
    expect(await startedOn(page)).toEqual({ starts: 1 });
    await page.close();
  }, 60_000);
});
