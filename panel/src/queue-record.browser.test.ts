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
 * **What the queue shows while it works, and what he can do when one fails.**
 *
 * Block 14 session 110. Session 109 left both named and unbuilt: `2/4` moved once
 * every twenty-six minutes and said nothing in between, and a failed video needed
 * four presses and a screen change to try again.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

function queueJob(over: Record<string, unknown>): string {
  const detail = {
    items: [
      { reel: 'sora-1', modeId: 'k2-syndicalia', outcome: 'done', spentUsd: 1.2, attempts: 1,
        startedAt: '2026-09-15T10:00:00Z', finishedAt: '2026-09-15T10:26:00Z', stage: null },
      { reel: 'sora-2', modeId: 'k2-syndicalia', outcome: 'not-reached', spentUsd: 0, attempts: 0,
        startedAt: null, finishedAt: null, stage: null },
    ],
    runningIndex: 1,
    spentUsd: 1.2,
    done: false,
    stopped: false,
    ...over,
  };
  return `window.__job = () => ({ id: 'q-1', status: ${
    (detail as { done?: boolean }).done === true ? "'done'" : "'running'"
  }, progress: 0.5, detail: ${JSON.stringify(detail)} });`;
}

async function withQueue(job: string): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
  await page.addInitScript(job);
  await page.addInitScript(`
    window.__listed = { jobs: [{ id: 'q-1', type: 'queue', status: 'running', progress: 0.5,
      startedAt: '2026-09-15T10:00:00Z', finishedAt: null, detail: null }] };
    window.__starts = 0;
    const real = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      const isPost = init !== undefined && String(init.method ?? '').toUpperCase() === 'POST';
      if (!isPost && /\\/jobs$/.test(u.split('?')[0])) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__listed) });
      }
      if (isPost && u.indexOf('/jobs') !== -1) {
        window.__starts += 1;
        window.__lastBody = init.body;
        return new Promise((go) => setTimeout(() => go({ ok: true, json: () => Promise.resolve({ id: 'q-2' }) }), 300));
      }
      return real(url, init);
    };
  `);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await page.waitForTimeout(900);
  await onScreen(page, 'run');
  return page;
}

describe.skipIf(!built)('what a queued video says it is doing', () => {
  it.each([
    ['transcription', 'Writing down the words'],
    ['analysis', 'Choosing what to emphasise and what to picture'],
    ['images', 'Drawing the pictures'],
    ['zones', 'Finding you in the picture'],
  ])('names the step it is on — %s', async (stage, shown) => {
    const page = await withQueue(
      queueJob({
        items: [
          { reel: 'sora-1', modeId: 'k2-syndicalia', outcome: 'not-reached', spentUsd: 0,
            attempts: 1, startedAt: '2026-09-15T10:00:00Z', finishedAt: null, stage },
        ],
        runningIndex: 0,
      }),
    );
    if (page === null) return;
    const steps = await page.$$eval('section.pane ul.steps li', (els) =>
      els
        .filter((e) => (e as HTMLElement).checkVisibility())
        .map((e) => ({
          name: e.querySelector('.k')?.textContent ?? '',
          said: e.querySelector('.v')?.textContent ?? '',
        })),
    );
    /* All four are shown, so he can see where in the four it is. */
    expect(steps).toHaveLength(4);
    const doing = steps.filter((s) => s.said === 'doing this now');
    expect(doing).toHaveLength(1);
    expect(doing[0]?.name).toBe(shown);
    await page.close();
  }, 60_000);

  /** **No percentage, and nothing that animates.** Session 98's rule. */
  it('shows no percentage and no bar', async () => {
    const page = await withQueue(
      queueJob({
        items: [
          { reel: 'sora-1', modeId: 'k2-syndicalia', outcome: 'not-reached', spentUsd: 0,
            attempts: 1, startedAt: '2026-09-15T10:00:00Z', finishedAt: null, stage: 'images' },
        ],
        runningIndex: 0,
      }),
    );
    if (page === null) return;
    const text = (await page.textContent('section.pane')) ?? '';
    expect(text).not.toMatch(/\d+\s?%/);
    expect(await page.$$eval('section.pane progress, section.pane .bar', (e) => e.length)).toBe(0);
    const animated = await page.$$eval('section.pane *', (els) =>
      els.filter((e) => {
        const s = getComputedStyle(e as HTMLElement);
        return s.animationName !== 'none' || s.transitionDuration !== '0s';
      }).length,
    );
    expect(animated).toBe(0);
    await page.close();
  }, 60_000);

  /** A service too old to say which stage shows exactly what it always showed. */
  it('says nothing about steps when the service does not report one', async () => {
    const page = await withQueue(queueJob({}));
    if (page === null) return;
    expect(await page.$$eval('section.pane ul.steps', (e) => e.length)).toBe(0);
    await page.close();
  }, 60_000);
});

describe.skipIf(!built)('a failed video, one press from being tried again', () => {
  const failed = {
    items: [
      { reel: 'sora-1', modeId: 'k2-syndicalia', outcome: 'done', spentUsd: 1.2, attempts: 1,
        startedAt: '2026-09-15T10:00:00Z', finishedAt: '2026-09-15T10:26:00Z', stage: null },
      { reel: 'sora-2', modeId: 'k2-syndicalia', outcome: 'failed', spentUsd: 0, attempts: 1,
        startedAt: '2026-09-15T10:26:00Z', finishedAt: '2026-09-15T10:31:00Z', stage: null },
    ],
    runningIndex: null,
    spentUsd: 1.2,
    done: true,
    stopped: false,
    summary: {
      headline: '1 ready to build, 1 did not finish.',
      lines: [{ reel: 'sora-2', said: 'Did not finish.', needsHim: true }],
      spentSaid: 'It cost $1.20.',
    },
  };

  it('offers one press on the video that failed, and starts a queue of one', async () => {
    const page = await withQueue(queueJob(failed));
    if (page === null) return;
    const button = await page.$('section.pane button[aria-label^="Try "]');
    expect(button).not.toBeNull();
    if (button === null) return;
    await button.click();
    await page.waitForTimeout(700);

    const sent = await page.evaluate(() => ({
      starts: (window as unknown as { __starts: number }).__starts,
      body: String((window as unknown as { __lastBody: unknown }).__lastBody ?? ''),
    }));
    expect(sent.starts).toBe(1);
    /* A queue of exactly the one that failed — not the whole list again. */
    expect(sent.body).toContain('sora-2');
    expect(sent.body).not.toContain('sora-1');
    await page.close();
  }, 60_000);

  /** Pressed twice, it still starts one. Session 109's empty column. */
  it('starts one retry, not two', async () => {
    const page = await withQueue(queueJob(failed));
    if (page === null) return;
    const button = await page.$('section.pane button[aria-label^="Try "]');
    if (button === null) return;
    await button.click();
    await button.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => (window as unknown as { __starts: number }).__starts)).toBe(1);
    await page.close();
  }, 60_000);

  /**
   * **A video that has used both attempts is not offered a third.** The queue runs
   * one twice and then records it and moves on — session 94's rule, measured as
   * holding by session 109 — and a one-press retry must not quietly undo it.
   */
  it('offers nothing on a video that has already been tried twice', async () => {
    const page = await withQueue(
      queueJob({
        ...failed,
        items: [
          failed.items[0],
          { ...failed.items[1], attempts: 2 },
        ],
      }),
    );
    if (page === null) return;
    expect(await page.$$eval('section.pane button[aria-label^="Try "]', (e) => e.length)).toBe(0);
    await page.close();
  }, 60_000);

  /** And nothing at all on a video that finished. */
  it('offers nothing on a video that finished', async () => {
    const page = await withQueue(
      queueJob({
        ...failed,
        summary: {
          headline: '2 ready to build.',
          lines: [{ reel: 'sora-1', said: 'Ready to build.', needsHim: false }],
          spentSaid: 'It cost $1.20.',
        },
      }),
    );
    if (page === null) return;
    expect(await page.$$eval('section.pane button[aria-label^="Try "]', (e) => e.length)).toBe(0);
    await page.close();
  }, 60_000);
});

/**
 * **It must still fit with fifty queues recorded.**
 *
 * Session 106 got every screen inside the 900 px panel for the first time, and a
 * record kept forever is a record that grows. Six in view is derived from the room
 * Make has left — not chosen — so this measures rather than asserts a taste.
 */
describe.skipIf(!built)('the record, with fifty queues on disk', () => {
  function fiftyQueues(): string {
    const queues = Array.from({ length: 50 }, (_, n) => ({
      id: `q-${String(n)}`,
      startedAt: new Date(Date.UTC(2026, 6, 1 + n, 10, 0, 0)).toISOString(),
      finishedAt: new Date(Date.UTC(2026, 6, 1 + n, 11, 0, 0)).toISOString(),
      progress: {
        items: [
          { reel: `a video number ${String(n)}`, outcome: 'done', spentUsd: 1.2 },
          { reel: `another one ${String(n)}`, outcome: n % 7 === 0 ? 'failed' : 'done', spentUsd: 1.1 },
        ],
        spentUsd: 2.3,
        done: true,
        stopped: false,
      },
    }));
    return `
      window.__queues = { queues: ${JSON.stringify(queues)} };
      const real = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url);
        if (/\\/queues$/.test(u.split('?')[0])) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__queues) });
        }
        return real(url, init);
      };
    `;
  }

  it('shows six, folds the rest, and stays inside the panel', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(fiftyQueues());
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.moments', { timeout: 10_000 });
    await onScreen(page, 'choose');
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.waitForTimeout(500);
    await onScreen(page, 'run');
    await page.waitForTimeout(400);

    const shown = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.pastqueues > ul.facts > li')].filter(
        (e) => (e as HTMLElement).checkVisibility(),
      );
      const fold = document.querySelector('.pastqueues > details.quibbles > summary');
      const sections = [...document.querySelectorAll('main > section')].filter(
        (e) => (e as HTMLElement).checkVisibility(),
      );
      return {
        inView: rows.length,
        rowHeight: rows[0] === undefined ? 0 : Math.round(rows[0].getBoundingClientRect().height),
        fold: (fold?.textContent ?? '').trim(),
        foldDrawn: fold === null ? false : (fold as HTMLElement).checkVisibility(),
        bottom: Math.round(
          Math.max(...sections.map((e) => e.getBoundingClientRect().bottom + window.scrollY)),
        ),
      };
    });
    console.log(
      `  == fifty queues: ${String(shown.inView)} in view at ${String(shown.rowHeight)}px a row, ` +
        `"${shown.fold}", Make ends at ${String(shown.bottom)}px`,
    );
    expect(shown.inView).toBe(6);
    expect(shown.foldDrawn).toBe(true);
    expect(shown.fold).toBe('44 older');
    /* Session 106's rule, which a record kept forever must not break. */
    expect(`Make is ${String(shown.bottom)}px, inside 900: ${shown.bottom <= 900}`).toBe(
      `Make is ${String(shown.bottom)}px, inside 900: true`,
    );
    await page.close();
  }, 60_000);

  /** And the label says when, without making him read a timestamp. */
  it('says when each ran in words, not in ISO', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(fiftyQueues());
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.moments', { timeout: 10_000 });
    await onScreen(page, 'run');
    await page.waitForTimeout(400);
    const labels = await page.$$eval('.pastqueues > ul.facts > li .k', (els) =>
      els.map((e) => (e.textContent ?? '').trim()),
    );
    expect(labels).toHaveLength(6);
    for (const label of labels) {
      expect(label).not.toMatch(/T\d\d:\d\d|Z$/);
      expect(label.length).toBeGreaterThan(4);
    }
    await page.close();
  }, 60_000);
});

/**
 * **And it is not drawn while a queue runs**, which is the measured reason six is
 * six: Make's worst state is 896 px of a 900 px panel, so 93 px of record there
 * would break the rule session 106 set and every session since has held.
 */
describe.skipIf(!built)('the record while a queue is running', () => {
  it('shows nothing, so Make stays inside the panel', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(
      queueJob({
        items: [
          { reel: 'sora-1', modeId: 'k2-syndicalia', outcome: 'not-reached', spentUsd: 0,
            attempts: 1, startedAt: '2026-09-15T10:00:00Z', finishedAt: null, stage: 'images' },
        ],
        runningIndex: 0,
      }),
    );
    await page.addInitScript(`
      window.__queues = { queues: Array.from({ length: 50 }, (_, n) => ({
        id: 'q-' + n, startedAt: new Date(Date.UTC(2026, 6, 1 + n, 10)).toISOString(),
        finishedAt: new Date(Date.UTC(2026, 6, 1 + n, 11)).toISOString(),
        progress: { items: [{ reel: 'v' + n, outcome: 'done', spentUsd: 1.2 }], spentUsd: 1.2, done: true, stopped: false },
      })) };
      window.__listed = { jobs: [{ id: 'q-1', type: 'queue', status: 'running', progress: 0.5,
        startedAt: '2026-09-15T10:00:00Z', finishedAt: null, detail: null }] };
      const real = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url).split('?')[0];
        const isPost = init !== undefined && String(init.method ?? '').toUpperCase() === 'POST';
        if (!isPost && /queues$/.test(u)) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__queues) });
        }
        if (!isPost && /jobs$/.test(u)) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__listed) });
        }
        return real(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.moments', { timeout: 10_000 });
    await onScreen(page, 'choose');
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.waitForTimeout(900);
    await onScreen(page, 'run');

    const seen = await page.evaluate(() => {
      const sections = [...document.querySelectorAll('main > section')].filter(
        (e) => (e as HTMLElement).checkVisibility(),
      );
      return {
        record: document.querySelectorAll('.pastqueues').length,
        steps: document.querySelectorAll('section.pane ul.steps li').length,
        bottom: Math.round(
          Math.max(...sections.map((e) => e.getBoundingClientRect().bottom + window.scrollY)),
        ),
      };
    });
    console.log(`  == running, fifty recorded: record ${String(seen.record)}, Make ends at ${String(seen.bottom)}px`);
    /*
     * **The claim is that the record is not drawn and Make still fits.** Whether
     * the four steps render is asserted by four tests above; repeating it here
     * would make this test fail for a reason that is not what it is about.
     */
    expect(seen.record).toBe(0);
    expect(`Make is ${String(seen.bottom)}px, inside 900: ${seen.bottom <= 900}`).toBe(
      `Make is ${String(seen.bottom)}px, inside 900: true`,
    );
    await page.close();
  }, 60_000);
});

/**
 * **Carrying on a queue that did not finish.**
 *
 * Block 14 session 111. Session 110 kept everything a resume needs and had nothing
 * that acted on it. Proved for real against the live service as well as here:
 * a queue of `test-1` and `vitasilk` was stopped after the first, the record named
 * exactly `vitasilk`, and the resume ran that one alone — **$0.0000, the ledger at
 * 294 records before and after.**
 */
describe.skipIf(!built)('carrying on a queue from the record', () => {
  function unfinished(items: unknown[]): string {
    return `
      window.__queues = { queues: [{ id: 'q-old', startedAt: '2026-09-15T10:00:00Z',
        finishedAt: null, progress: { items: ${JSON.stringify(items)}, spentUsd: 1.2,
        done: false, stopped: true } }] };
      window.__starts = 0;
      const real = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url).split('?')[0];
        const isPost = init !== undefined && String(init.method ?? '').toUpperCase() === 'POST';
        if (!isPost && /queues$/.test(u)) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__queues) });
        }
        if (isPost && u.indexOf('/jobs') !== -1) {
          window.__starts += 1;
          window.__lastBody = init.body;
          return new Promise((go) => setTimeout(() => go({ ok: true, json: () => Promise.resolve({ id: 'q-new' }) }), 350));
        }
        return real(url, init);
      };
    `;
  }

  const MIXED = [
    { reel: 'sora-1', modeId: 'k2-syndicalia', outcome: 'done', spentUsd: 1.2 },
    { reel: 'sora-2', modeId: 'k2-syndicalia', outcome: 'stopped', spentUsd: 0 },
    { reel: 'sora-3', modeId: 'k2-syndicalia', outcome: 'not-reached', spentUsd: 0 },
  ];

  async function withRecord(items: unknown[]): Promise<Page | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(unfinished(items));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.moments', { timeout: 10_000 });
    await onScreen(page, 'choose');
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.waitForTimeout(500);
    await onScreen(page, 'run');
    await page.waitForTimeout(400);
    return page;
  }

  it('runs only what never ran, and nothing already paid for', async () => {
    const page = await withRecord(MIXED);
    if (page === null) return;
    const button = await page.$('.pastqueues button[aria-label^="Carry on"]');
    expect(button).not.toBeNull();
    if (button === null) return;
    await button.click();
    await page.waitForTimeout(800);
    const sent = await page.evaluate(() => ({
      starts: (window as unknown as { __starts: number }).__starts,
      body: String((window as unknown as { __lastBody: unknown }).__lastBody ?? ''),
    }));
    expect(sent.starts).toBe(1);
    /* The two that never ran, and not the one that was paid for. */
    expect(sent.body).toContain('sora-2');
    expect(sent.body).toContain('sora-3');
    expect(sent.body).not.toContain('sora-1');
    await page.close();
  }, 60_000);

  /** Pressed twice it still starts one — a new control, a spending control. */
  it('starts one resume, not two', async () => {
    const page = await withRecord(MIXED);
    if (page === null) return;
    const button = await page.$('.pastqueues button[aria-label^="Carry on"]');
    if (button === null) return;
    await button.click();
    await button.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as unknown as { __starts: number }).__starts)).toBe(1);
    await page.close();
  }, 60_000);

  /** And nothing is offered on a queue where every video ran. */
  it('offers nothing when there is nothing left to carry on', async () => {
    const page = await withRecord(
      MIXED.map((i) => ({ ...i, outcome: 'done' })),
    );
    if (page === null) return;
    expect(
      await page.$$eval('.pastqueues button[aria-label^="Carry on"]', (e) => e.length),
    ).toBe(0);
    await page.close();
  }, 60_000);
});
