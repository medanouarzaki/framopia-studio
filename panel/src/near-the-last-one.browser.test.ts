import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  built,
  INDEX,
  HANDSHAKE,
  stubHost,
  realPanelRoutes,
  onScreen,
  openReference,
  stubRoutes,
  stepsThrough,
} from './browser-harness.js';

/**
 * **The next thing to press is where the last one was.**
 *
 * Block 13 session 102, from Mohamed's own words: *"when I click a button, the
 * next button I'm going to click on should be near to it."* Fitts's law, said by
 * the person who has to live with the panel.
 *
 * Six sentences named a place and left him to find it. The wording is settled and
 * unchanged; what this proves is that the phrase inside each one is now a control
 * that actually arrives, and that the sentence still reads as it did.
 *
 * **Run against his own data** — the real clients, a video run all the way
 * through — because a sentence about a finished video does not appear at all in
 * the empty panel the other browser tests render.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

async function hisPanel(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'choose');
  await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
  await page.waitForTimeout(300);
  await page.selectOption(
    'select[aria-label="Video"]',
    'Dr Loubna Kfafi/September Content/Exports/sora.mov',
  );
  await page.waitForTimeout(600);
  return page;
}

/** Which screen the switcher says he is on, read from the panel, not assumed. */
async function whereHeIs(page: Page): Promise<string> {
  return await page.$eval('nav.moments button.moment.here', (el) => el.textContent ?? '');
}

/**
 * How many of a selector the page has, and how many are actually drawn.
 *
 * **Extracted values, never a live handle.** `expect(await page.$(…)).toBeNull()`
 * looked fine and was a trap: when it failed, vitest tried to pretty-print a
 * Playwright element handle and died with `RangeError: Invalid string length` —
 * a real red that says nothing about what went wrong. Session 102 found that with
 * its own mutation M3.
 */
async function count(page: Page, selector: string): Promise<{ there: number; drawn: number }> {
  return await page.$$eval(selector, (els) => ({
    there: els.length,
    drawn: els.filter((e) => (e as HTMLElement).checkVisibility()).length,
  }));
}

describe.skipIf(!built)('a sentence that names a place takes him there', () => {
  it('turns “Go to Build” into the control that goes to Build', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'run');

    /*
     * Extracted, never a live handle, and never the whole screen's textContent —
     * session 99's lesson about a closed `<details>` still carrying its text.
     */
    const line = await page.$$eval('section.do p.say', (els) =>
      els
        .filter((e) => (e as HTMLElement).checkVisibility())
        .map((e) => ({ text: e.textContent ?? '', control: e.querySelector('button')?.textContent ?? null })),
    );
    const finished = line.find((l) => l.text.startsWith('Everything for this video is made'));
    expect(finished).toBeDefined();

    /* The sentence is unchanged, character for character. */
    expect(finished?.text).toBe(
      'Everything for this video is made. Go to Build to put the composition together.',
    );
    /* And the phrase inside it is the control. */
    expect(finished?.control).toBe('Go to Build');

    expect(await whereHeIs(page)).toContain('2. Make');
    await page.click('section.do p.say button.linky');
    await page.waitForSelector('section.buildpane-section', { timeout: 4_000, state: 'visible' });
    expect(await whereHeIs(page)).toContain('3. Build');
    await page.close();
  }, 60_000);

  /**
   * **Colour still means one thing: this spends money.** The way there costs
   * nothing, so it carries no colour of its own — it is the panel's text colour,
   * underlined. Session 95's rule, and a control that looked like a spend would
   * break it.
   */
  it('gives the way there no colour of its own', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'run');
    const drawn = await page.$eval('section.do p.say button.linky', (el) => {
      const s = getComputedStyle(el);
      return { colour: s.color, background: s.backgroundColor, decoration: s.textDecorationLine };
    });
    /* The accent is #ed1c24; nothing free may be drawn in it. */
    expect(drawn.colour).not.toBe('rgb(237, 28, 36)');
    expect(drawn.background).toBe('rgba(0, 0, 0, 0)');
    expect(drawn.decoration).toContain('underline');
    await page.close();
  }, 60_000);

  /**
   * **Adding a way forward must not remove a way around.** The brief's words. He
   * re-runs, he re-reads, he goes back; a panel that only moves him forward is a
   * wizard, and session 97 settled that all three steps stay pressable.
   */
  it('leaves all three steps pressable after it has taken him somewhere', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'run');
    await page.click('section.do p.say button.linky');
    await page.waitForSelector('section.buildpane-section', { timeout: 4_000, state: 'visible' });

    const steps = await page.$$eval('nav.moments button.moment', (els) =>
      els.map((e) => ({ label: e.textContent ?? '', disabled: (e as HTMLButtonElement).disabled })),
    );
    expect(steps).toHaveLength(3);
    expect(steps.filter((s) => s.disabled)).toEqual([]);

    /* And back is still back. */
    await onScreen(page, 'choose');
    expect(await whereHeIs(page)).toContain('1. Choose');
    await page.close();
  }, 60_000);
});

/**
 * **Reference is not decision.**
 *
 * Progressive disclosure: what the task at hand needs stays in view; the rest
 * goes behind one press. Measured with his own data at the start of Block 13
 * session 102, Choose was **4000 px of a 900 px panel** — the client card alone
 * 3500 px of it, sitting between picking a client and picking a video.
 *
 * These are the tests that go red if a later session un-collapses one of them.
 * Before this session nothing pinned any of it, which is how sessions 99, 100 and
 * 101 each had a mutation find a layout change no test was watching.
 */
describe.skipIf(!built)('what is behind one press, and what is not', () => {
  it('keeps the two decisions on Choose next to each other', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'choose');

    /* The card is there, and it is not drawn. */
    expect(await count(page, '.clientcard')).toEqual({ there: 1, drawn: 0 });

    /*
     * And the distance he actually travels: the foot of the client picker to the
     * top of the video picker. A card in between made this the height of a card.
     */
    const gap = await page.evaluate(() => {
      const client = document.querySelector('section.client select');
      const video = document.querySelector('section.video select');
      if (client === null || video === null) return 99_999;
      return Math.round(
        video.getBoundingClientRect().top - client.getBoundingClientRect().bottom,
      );
    });
    console.log(`  == the two decisions on Choose are ${String(gap)}px apart`);
    expect(`the two decisions are ${String(gap)}px apart, under 200: ${gap < 200}`).toBe(
      `the two decisions are ${String(gap)}px apart, under 200: true`,
    );
    await page.close();
  }, 60_000);

  it('says what is behind the press rather than “more”', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'choose');
    const summary = await page.$eval('details.clientref > summary', (el) => el.textContent ?? '');
    /* Her name, and all three of the things he opens it for. */
    expect(summary).toContain('Dr Loubna Kfafi');
    expect(summary).toContain('colours');
    expect(summary).toContain('photographs');
    expect(summary).toContain('details');
    await page.close();
  }, 60_000);

  it('opens the card in one press, and everything in it still works', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'choose');
    await openReference(page, '.clientcard');
    const inside = await page.$eval('.clientcard', (el) => ({
      drawn: (el as HTMLElement).checkVisibility(),
      /* The palette's four, not the twenty-two a photograph's clear button adds. */
      swatches: el.querySelectorAll('.palette .chip').length,
      photographs: el.querySelectorAll('.ownphotos').length,
    }));
    expect(inside.drawn).toBe(true);
    expect(inside.swatches).toBe(4);
    expect(inside.photographs).toBe(1);
    await page.close();
  }, 60_000);

  /**
   * **A setting was standing in the path between two actions.** The watermark
   * control sat between the buttons that spend and the queue — the two things he
   * presses one after the other.
   */
  /**
   * **Rewritten by Block 13 session 103, which finished the move.** Session 102
   * put this setting behind a press on Make and said in its own report that its
   * home is Build, beside *What else it will use* — the sentence that already
   * states the watermark the composition gets. It is there now.
   *
   * What the test holds is the same thing it always held, and one more: the
   * setting is not in the path between the two actions, **and the distance
   * session 102 measured has not grown**.
   */
  it('keeps the watermark setting out of the path, and on the screen it affects', async () => {
    const page = await hisPanel();
    if (page === null) return;

    /* Not on Make at all any more. */
    await onScreen(page, 'run');
    expect(await count(page, '.watermark')).toEqual({ there: 0, drawn: 0 });

    /* The distance session 102 measured at 220 px, which must not grow. */
    const gap = await page.evaluate(() => {
      const spend = [...document.querySelectorAll('section.do .partrun button.run')].filter((b) =>
        (b as HTMLElement).checkVisibility(),
      );
      const last = spend[spend.length - 1];
      const queue = document.querySelector('section.pane button');
      if (last === undefined || queue === null) return 99_999;
      return Math.round(queue.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
    });
    console.log(`  == run button to queue: ${String(gap)}px`);
    expect(`run button to queue ${String(gap)}px, no more than session 102's 220: ${gap <= 220}`).toBe(
      `run button to queue ${String(gap)}px, no more than session 102's 220: true`,
    );

    /* On Build, behind one press, and every size still there and pressable. */
    await onScreen(page, 'build');
    expect(await count(page, '.watermark')).toEqual({ there: 1, drawn: 0 });
    await openReference(page, '.watermark');
    expect(await page.$$eval('.watermark .sizes button', (els) => els.length)).toBe(3);
    await page.close();
  }, 60_000);

  /**
   * **A stage list is four rows of the same thing — once it is done.** The brief's
   * own question. While anything is still to run they are the decision: which
   * stages cost money and what each will do. That is the difference these two
   * tests hold apart.
   */
  it('folds the four rows away once every one of them says the same thing', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'run');
    const rows = await page.$$eval('section.cost ul.facts li', (els) =>
      els.map((e) => ({ text: e.textContent ?? '', drawn: (e as HTMLElement).checkVisibility() })),
    );
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.drawn)).toEqual([]);

    /*
     * **Rewritten by Block 13 session 103.** The summary used to count the rows —
     * *What was done — all 4 steps* — and now it names both halves of what is
     * behind it, because the spend record folded in with them: `section.cost` was
     * 231 px of a 1086 px Make and is 129 px. The count moved out because at
     * 420 px the longer sentence wrapped to two lines and cost 21 px to say the
     * same thing; the rows themselves are asserted above and below.
     */
    const summary = await page.$eval('details.stagesref > summary', (el) => el.textContent ?? '');
    expect(summary).toContain('cost');
    expect(summary).toContain('step by step');

    /* And the spend record is behind the same one press, not a second one. */
    expect(await count(page, 'details.stagesref .spend')).toEqual({ there: 3, drawn: 0 });

    await openReference(page, 'section.cost ul.facts');
    const opened = await page.$$eval('section.cost ul.facts li', (els) =>
      els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => e.textContent ?? ''),
    );
    expect(opened).toHaveLength(4);
    await page.close();
  }, 60_000);

  it('keeps the rows in full view while anything is still to run', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    /*
     * The ordinary stub: its dry run has no stages at all, so this adds the one
     * fact under test — four stages with work left in them.
     */
    await page.addInitScript(
      stubRoutes(stepsThrough('build'), 'build', {
        dry: {
          reel: 'vitasilk', videoPath: '/v/vitasilk.mov', modeId: 'k2-syndicalia',
          modeName: 'K2 Syndicalia', modeVersion: 6, planPath: '/v/p.json', spentUsd: 0,
          estimateUsd: 2.17, reusesOlderGuide: false, wordsUsd: 0.4, picturesUsd: 1.77,
          wordsStages: ['transcription', 'analysis'], picturesStages: ['images', 'zones'],
          watermark: true, watermarkSize: 'medium',
          watermarkWidthsPx: { small: 216, medium: 324, large: 432 },
          mismatch: null,
          stages: [
            { id: 'transcription', label: 'Writing down the words', status: 'done', provenance: 'cache', entryId: 'a', estimateUsd: 0, action: 'skip', note: 'done' },
            { id: 'analysis', label: 'Choosing the pictures', status: 'pending', provenance: null, entryId: null, estimateUsd: 0.4, action: 'run', note: 'will run' },
            { id: 'images', label: 'Drawing the pictures', status: 'pending', provenance: null, entryId: null, estimateUsd: 1.77, action: 'run', note: 'will run' },
            { id: 'zones', label: 'Looking at the video', status: 'pending', provenance: null, entryId: null, estimateUsd: 0, action: 'run', note: 'will run' },
          ],
        },
      }),
    );
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('nav.moments', { timeout: 10_000 });
    await onScreen(page, 'choose');
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await page.waitForTimeout(300);
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.waitForTimeout(600);
    await onScreen(page, 'run');

    /* No disclosure at all, and every row drawn. */
    expect(await count(page, 'details.stagesref')).toEqual({ there: 0, drawn: 0 });
    expect(await count(page, 'section.cost ul.facts li')).toEqual({ there: 4, drawn: 4 });
    await page.close();
  }, 60_000);
});
