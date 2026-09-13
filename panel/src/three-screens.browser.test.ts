import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { built, INDEX, HANDSHAKE, stubHost, onScreen } from './browser-harness.js';

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
    expect(await headings(page)).toEqual(['Cost', 'Make several videos']);
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
