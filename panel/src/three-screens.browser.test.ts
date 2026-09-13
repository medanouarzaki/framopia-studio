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
 * **The three screens, and what is on each of them.**
 *
 * Block 13 session 97 landed Choose, Make and Build. The panel was six sections
 * in one 1288 px scroll inside a 900 px window, and *Make several videos* — the
 * queue Mohamed asked for — began at 990 px, ninety pixels below the fold, where
 * he could not find it.
 *
 * **The queue is the one this file exists for.** Session 96 tried the screens and
 * the queue rendered on all three, because its block sat *between* two gates
 * rather than inside one. That is invisible in a diff and obvious here.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
});

async function open(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  return page;
}

/**
 * Which sections are actually being rendered, by their heading.
 *
 * **Headed sections only.** One section has no heading and is outside all three
 * gates on purpose: the service status at the top of the panel, which says
 * whether the companion service is answering. That belongs on every screen —
 * it is the answer to "is anything working at all" — and it is not part of any
 * one step.
 */
async function headings(page: Page): Promise<string[]> {
  return await page.$$eval('section', (els) =>
    els
      .filter((el) => (el as HTMLElement).checkVisibility())
      .filter((el) => el.querySelector('h2') !== null)
      .map((el) => el.querySelector('h2')?.textContent ?? ''),
  );
}

describe.skipIf(!built)('the three screens', () => {
  it('opens on Choose, with the client and the video and nothing else', async () => {
    const page = await open();
    if (page === null) return;
    expect(await headings(page)).toEqual(['Client', 'Video']);
    await page.close();
  }, 30_000);

  it('names all three steps, and marks the one he is on', async () => {
    const page = await open();
    if (page === null) return;
    expect(await page.locator('nav.moments button.moment').allTextContents()).toEqual([
      '1. Choose',
      '2. Make',
      '3. Build',
    ]);
    expect(await page.locator('nav.moments button.moment.here').textContent()).toBe('1. Choose');
    await onScreen(page, 'build');
    expect(await page.locator('nav.moments button.moment.here').textContent()).toBe('3. Build');
    await page.close();
  }, 30_000);

  /**
   * **The queue is on Make, and on neither of the others.**
   *
   * Session 96's trial had it outside the gates, so it rendered on every screen.
   * `checkVisibility()` rather than a selector count, because a section that is
   * in the page but not rendered still answers `querySelector` — Block 11 session
   * 69 shipped a test that passed over exactly that.
   */
  it('puts the queue on Make and nowhere else', async () => {
    const page = await open();
    if (page === null) return;

    await onScreen(page, 'choose');
    expect(await headings(page)).not.toContain('Make several videos');

    await onScreen(page, 'run');
    expect(await headings(page)).toContain('Make several videos');

    await onScreen(page, 'build');
    expect(await headings(page)).not.toContain('Make several videos');
    await page.close();
  }, 30_000);

  it('shows each screen’s own sections and no others', async () => {
    const page = await open();
    if (page === null) return;
    await onScreen(page, 'run');
    /* Session 98: the two this-video controls got the heading the queue had. */
    /*
     * Session 98: the work first, the accounting after it. He opened Make and
     * read three money figures and four stage rows before reaching a button.
     */
    expect(await headings(page)).toEqual(['This video', 'Make several videos', 'Cost']);
    await onScreen(page, 'build');
    expect(await headings(page)).toEqual(['Build', 'Change something first']);
    await onScreen(page, 'choose');
    expect(await headings(page)).toEqual(['Client', 'Video']);
    await page.close();
  }, 30_000);

  /**
   * **Nothing he needs is below the fold**, which is the whole reason for the
   * split. Measured against the 900 px the panel actually gets.
   */
  it('fits every screen inside the panel', async () => {
    const page = await open();
    if (page === null) return;
    for (const screen of ['choose', 'run', 'build'] as const) {
      await onScreen(page, screen);
      const bottom = await page.$$eval('section', (els) =>
        Math.max(
          ...els
            .filter((el) => (el as HTMLElement).checkVisibility())
            .map((el) => el.getBoundingClientRect().bottom + window.scrollY),
        ),
      );
      expect(`${screen}: ${Math.round(bottom) <= 900}`).toBe(`${screen}: true`);
    }
    await page.close();
  }, 30_000);

  /**
   * **Every step stays pressable.** Going back to change the client after a run
   * is something he does, and a step that refuses to open cannot explain itself
   * — Build says what is missing, which is more use than a dead tab.
   */
  it('leaves every step reachable, even one he cannot use yet', async () => {
    const page = await open();
    if (page === null) return;
    const disabled = await page.$$eval('nav.moments button.moment', (els) =>
      els.map((e) => (e as HTMLButtonElement).disabled),
    );
    expect(disabled).toEqual([false, false, false]);
    /* And Build, with nothing picked, says what is missing rather than nothing. */
    await onScreen(page, 'build');
    const said = (await page.textContent('.buildpane')) ?? '';
    expect(said.trim()).not.toBe('');
    await page.close();
  }, 30_000);
});

/**
 * **The news on the step, on screen.**
 *
 * `words.test.ts` pins what it says; this pins that it reaches him, on the right
 * step, in the right colour, and that reading it is what clears it. Block 13
 * session 98.
 *
 * The queue is driven through the panel's own job route — the same `POST /jobs`
 * and poll a real queue uses — with the job's `detail` stubbed, so nothing here
 * runs a stage or spends anything.
 */
describe.skipIf(!built)('the news a step carries', () => {
  /** A queue job the panel will poll, in whatever state the test wants. */
  const queueing = (detail: unknown): string => `
    window.__queue = ${JSON.stringify(detail)};
    const realFetch = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      if (u.indexOf('/jobs') !== -1 && init && init.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'q1' }) });
      }
      if (u.indexOf('/jobs/q1') !== -1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'q1', type: 'queue',
            status: window.__queue.done ? 'done' : 'running',
            progress: 0.5, detail: window.__queue,
          }),
        });
      }
      return realFetch(url, init);
    };
  `;

  async function withQueue(detail: unknown): Promise<Page | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    /*
     * The real routes first, so the pickers have a client and a video in them;
     * the queue stub wraps that fetch and answers only the job calls.
     */
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(queueing(detail));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.moments', { timeout: 10_000 });
    return page;
  }

  /** Starts a queue the way he does: pick a video, add it, press the button. */
  async function startQueueOf(page: Page, video = 'vitasilk'): Promise<void> {
    await onScreen(page, 'choose');
    await page.selectOption('select[aria-label="Video"]', video);
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await onScreen(page, 'run');
    await page.click(`button.run:has-text("Add ${video} to the list")`);
    await page.click('button.run:has-text("Make these")');
    await page.waitForSelector('nav.moments .news', { timeout: 10_000 });
  }

  /**
   * Finishes the queue while he is somewhere else, which is the case this
   * exists for: he starts five videos and goes to read a transcript.
   */
  async function finishesWhileAway(page: Page, detail: unknown): Promise<void> {
    await page.evaluate((next) => {
      (window as unknown as { __queue: unknown }).__queue = next;
    }, detail);
    /*
     * Waits for the poll to bring the new state, not merely for the badge to
     * exist — it already does, saying how far the running queue had got. Waiting
     * on the wrong thing is how this test first passed while measuring nothing.
     */
    await page.waitForFunction(
      () => {
        const el = document.querySelector('nav.moments .news');
        return el !== null && !/^\d+\/\d+$/.test(el.textContent ?? '');
      },
      undefined,
      { timeout: 5000 },
    );
  }

  /** What the second step says, and in which tone. */
  async function newsOn(page: Page): Promise<{ text: string; tone: string } | null> {
    const found = await page.$$eval('nav.moments button.moment', (els) =>
      els.map((el) => {
        const span = el.querySelector('.news');
        return span === null || !(span as HTMLElement).checkVisibility()
          ? null
          : { text: span.textContent ?? '', tone: span.className.replace('news', '').trim() };
      }),
    );
    return found[1] ?? null;
  }

  it('says nothing at all when no queue has been started', async () => {
    const page = await withQueue({ items: [], done: false, stopped: false });
    if (page === null) return;
    expect(await page.$$eval('nav.moments .news', (e) => e.length)).toBe(0);
    await page.close();
  }, 30_000);

  it('shows how far a running queue has got, on the Make step', async () => {
    const page = await withQueue({
      items: [
        { reel: 'a', outcome: 'done', spentUsd: 0, attempts: 1, startedAt: null, finishedAt: null },
        { reel: 'b', outcome: 'not-reached', spentUsd: 0, attempts: 0, startedAt: null, finishedAt: null },
      ],
      runningIndex: 1,
      spentUsd: 0,
      done: false,
      stopped: false,
    });
    if (page === null) return;
    await startQueueOf(page);
    expect(await newsOn(page)).toEqual({ text: '1/2', tone: 'working' });
    await page.close();
  }, 40_000);

  it('says how many are ready when it ends clean, in the good tone', async () => {
    const page = await withQueue({
      items: [
        { reel: 'a', outcome: 'not-reached', spentUsd: 0, attempts: 0, startedAt: null, finishedAt: null },
        { reel: 'b', outcome: 'not-reached', spentUsd: 0, attempts: 0, startedAt: null, finishedAt: null },
      ],
      runningIndex: 0,
      spentUsd: 0,
      done: false,
      stopped: false,
    });
    if (page === null) return;
    await startQueueOf(page);
    await onScreen(page, 'choose');
    await finishesWhileAway(page, {
      items: [
        { reel: 'a', outcome: 'done', spentUsd: 0, attempts: 1, startedAt: null, finishedAt: null },
        { reel: 'b', outcome: 'done', spentUsd: 0, attempts: 1, startedAt: null, finishedAt: null },
      ],
      runningIndex: null, spentUsd: 0, done: true, stopped: false,
    });
    expect(await newsOn(page)).toEqual({ text: '2 ready', tone: 'good' });
    await page.close();
  }, 40_000);

  it('leads with the failures, and never in the colour that means money', async () => {
    const page = await withQueue({
      items: [
        { reel: 'a', outcome: 'not-reached', spentUsd: 0, attempts: 0, startedAt: null, finishedAt: null },
        { reel: 'b', outcome: 'not-reached', spentUsd: 0, attempts: 0, startedAt: null, finishedAt: null },
      ],
      runningIndex: 0,
      spentUsd: 0,
      done: false,
      stopped: false,
    });
    if (page === null) return;
    await startQueueOf(page);
    await onScreen(page, 'choose');
    await finishesWhileAway(page, {
      items: [
        { reel: 'a', outcome: 'done', spentUsd: 0, attempts: 1, startedAt: null, finishedAt: null },
        { reel: 'b', outcome: 'failed', spentUsd: 0, attempts: 1, startedAt: null, finishedAt: null },
      ],
      runningIndex: null, spentUsd: 0, done: true, stopped: false,
    });
    const said = await newsOn(page);
    expect(said).toEqual({ text: '1 failed', tone: 'warn' });

    /* Red is reserved for spending. The news must not be wearing it. */
    const colour = await page.$eval('nav.moments .news', (el) =>
      window.getComputedStyle(el as HTMLElement).color,
    );
    const accent = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
    expect(`${colour} vs ${accent}`).not.toMatch(/rgb\(237, 28, 36\).*ed1c24/);
    await page.close();
  }, 40_000);

  /**
   * **Reading it is what clears it**, and nothing else. Block 12 session 94's
   * queue vanished without a summary; a badge that cleared on a timer would be
   * the same mistake in a different place.
   */
  it('clears the news once he has stood on Make with it finished, and not before', async () => {
    const page = await withQueue({
      items: [
        { reel: 'a', outcome: 'not-reached', spentUsd: 0, attempts: 0, startedAt: null, finishedAt: null },
        { reel: 'b', outcome: 'not-reached', spentUsd: 0, attempts: 0, startedAt: null, finishedAt: null },
      ],
      runningIndex: 0,
      spentUsd: 0,
      done: false,
      stopped: false,
    });
    if (page === null) return;
    await startQueueOf(page);

    /* It finishes while he is on Choose, and it is still news there. */
    await onScreen(page, 'choose');
    await finishesWhileAway(page, {
      items: [
        { reel: 'a', outcome: 'done', spentUsd: 0, attempts: 1, startedAt: null, finishedAt: null },
        { reel: 'b', outcome: 'done', spentUsd: 0, attempts: 1, startedAt: null, finishedAt: null },
      ],
      runningIndex: null, spentUsd: 0, done: true, stopped: false,
    });
    expect(await newsOn(page)).not.toBeNull();

    /* He goes and looks. */
    await onScreen(page, 'run');
    await page.waitForFunction(
      () => document.querySelectorAll('nav.moments .news').length === 0,
      undefined,
      { timeout: 5000 },
    );

    /* And it stays cleared when he wanders off again. */
    await onScreen(page, 'choose');
    expect(await newsOn(page)).toBeNull();
    await page.close();
  }, 40_000);
});
