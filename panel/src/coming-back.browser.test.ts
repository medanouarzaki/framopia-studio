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
 * **Coming back to a queue the panel never started.**
 *
 * Block 14 session 109, and session 101's oldest open item. A queue is the
 * service's work, not the panel's, so it keeps running while the panel is shut —
 * but the panel held its job id in React state and there was no route to ask what
 * was running. Closing the panel during a two-hour queue meant coming back to a
 * screen that said nothing had ever happened, while money was still being spent.
 *
 * **This panel has never started a queue.** It is opened fresh, is told by the
 * service that one exists, and has to find it — which is exactly what happens when
 * he shuts the panel and opens it again.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

function aQueueOnTheService(state: 'running' | 'done'): string {
  const detail = {
    items: [
      { reel: 'sora-1', outcome: 'done', spentUsd: 1.2, attempts: 1,
        startedAt: '2026-09-15T10:00:00Z', finishedAt: '2026-09-15T10:26:00Z' },
      { reel: 'sora-2', outcome: state === 'done' ? 'failed' : 'not-reached', spentUsd: 0,
        attempts: state === 'done' ? 2 : 0, startedAt: null, finishedAt: null },
    ],
    runningIndex: state === 'running' ? 1 : null,
    spentUsd: 1.2,
    done: state === 'done',
    stopped: false,
    ...(state === 'done'
      ? {
          summary: {
            headline: '1 ready to build, 1 did not finish.',
            lines: [{ reel: 'sora-2', said: 'Did not finish.', needsHim: true }],
            spentSaid: 'It cost $1.20.',
          },
        }
      : {}),
  };
  return `
    window.__listed = { jobs: [{ id: 'q-earlier', type: 'queue', status: ${JSON.stringify(
      state === 'running' ? 'running' : 'done',
    )}, progress: 0.5, startedAt: '2026-09-15T10:00:00Z', finishedAt: null, detail: null }] };
    window.__job = () => ({ id: 'q-earlier', status: ${JSON.stringify(
      state === 'running' ? 'running' : 'done',
    )}, progress: 0.5, detail: ${JSON.stringify(detail)} });
    const real = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      const isPost = init !== undefined && String(init.method ?? '').toUpperCase() === 'POST';
      if (!isPost && /\\/jobs$/.test(u.split('?')[0])) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__listed) });
      }
      return real(url, init);
    };
  `;
}

async function openFresh(state: 'running' | 'done'): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
  await page.addInitScript(aQueueOnTheService(state));
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await page.waitForTimeout(900);
  return page;
}

describe.skipIf(!built)('a panel opened while a queue is already running', () => {
  it('finds the queue it never started, and says what it is on', async () => {
    const page = await openFresh('running');
    if (page === null) return;
    await onScreen(page, 'run');
    const said = await page.$$eval('section.pane', (els) =>
      els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => e.textContent ?? ''),
    );
    expect(said.join(' ')).toContain('The list');
    expect(said.join(' ')).toContain('keeps going');
    /* And the control that stops it is there, which it was not before. */
    expect(await page.$$eval('section.pane button.run', (e) => e.length)).toBeGreaterThan(0);
    await page.close();
  }, 60_000);

  /**
   * **A finished queue is the thing he came back for.** It is the summary session
   * 98 built and session 101 found he never saw, because the panel that started it
   * was closed by the time it finished.
   */
  it('finds a queue that finished while the panel was shut', async () => {
    const page = await openFresh('done');
    if (page === null) return;
    await onScreen(page, 'run');
    const text = await page.$$eval('section.pane', (els) =>
      els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => e.textContent ?? '').join(' '),
    );
    expect(text).toContain('1 ready to build, 1 did not finish.');
    expect(text).toContain('Did not finish.');
    expect(text).toContain('It cost $1.20.');
    await page.close();
  }, 60_000);

  /** The step carries the news, so he sees it without going to Make. */
  it('carries the news on the step, from a queue it never started', async () => {
    const page = await openFresh('done');
    if (page === null) return;
    await onScreen(page, 'choose');
    const news = await page.$$eval('nav.moments .news', (els) =>
      els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => e.textContent ?? ''),
    );
    expect(news.length).toBe(1);
    expect(news[0] ?? '').toMatch(/failed|ready/);
    await page.close();
  }, 60_000);

  /**
   * **A service that has no such route changes nothing.** It answers 404 and the
   * panel behaves exactly as it did before session 109 — it knows about a queue
   * only if it started one itself.
   */
  it('says nothing at all when the service is too old to be asked', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      const real = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url);
        const isPost = init !== undefined && String(init.method ?? '').toUpperCase() === 'POST';
        if (!isPost && /\\/jobs$/.test(u.split('?')[0])) {
          return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        }
        return real(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.moments', { timeout: 10_000 });
    await page.waitForTimeout(900);
    await onScreen(page, 'run');
    const text = await page.$$eval('section.pane', (els) =>
      els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => e.textContent ?? '').join(' '),
    );
    /* The empty list, exactly as before: an invitation, not a report. */
    expect(text).toContain('Add videos here');
    expect(await page.$$eval('nav.moments .news', (e) => e.length)).toBe(0);
    await page.close();
  }, 60_000);
});
