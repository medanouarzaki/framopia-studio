import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { built, INDEX, HANDSHAKE, stubHost, realPanelRoutes, onScreen } from './browser-harness.js';

/**
 * **How far he walks to make his videos.**
 *
 * Block 14 session 114. Mohamed says the queue is not smooth and not logical,
 * and that he works principally in queues. The diagnosis to check is structural:
 * the panel is one client, one video, one build, and the queue is a box on the
 * right of step 2 — so five videos means crossing between Choose and Make five
 * times, and building them means five more crossings.
 *
 * **This counts, it does not argue.** A press is a click on a control or a
 * change of a picker; a crossing is a move between the three screens. If the
 * numbers do not show what he describes, that is the finding.
 */
let browser: Browser | undefined;
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 180_000);

/** Ten of her videos rather than the harness's four, so ten can be queued. */
function tenVideos(): string {
  const labels = [
    'sora', 'sculptra-explainer', 'botox-myths', 'skin-booster', 'profhilo-day',
    'hifu-explained', 'prp-basics', 'lip-filler-qa', 'peel-aftercare', 'clinic-tour',
  ].map((n) => `Dr Loubna Kfafi/September Content/Exports/${n}.mov`);
  return `
    window.__payload.reels = { reels: ${JSON.stringify(labels)}.map((label, i) => ({
      label, present: true, durationS: 25.7 + i,
      planPath: '/v/p' + i + '.json', spentUsd: 3.4025,
    })) };
  `;
}

/** A recorder: every press and every crossing, named, in order. */
class Walk {
  readonly steps: string[] = [];
  private screen = 'choose';
  constructor(private readonly page: Page) {}
  async press(what: string, selector: string, text?: string): Promise<boolean> {
    for (const el of await this.page.$$(selector)) {
      if (!(await el.isVisible().catch(() => false))) continue;
      if (text !== undefined && !((await el.textContent()) ?? '').trim().startsWith(text)) continue;
      if (await el.isDisabled().catch(() => true)) continue;
      await el.click({ timeout: 4000 }).catch(() => undefined);
      await this.page.waitForTimeout(160);
      this.steps.push(`press: ${what}`);
      return true;
    }
    return false;
  }
  async pick(which: 'Client' | 'Video', value: string): Promise<void> {
    await this.page.selectOption(`select[aria-label="${which}"]`, value);
    await this.page.waitForTimeout(320);
    this.steps.push(`pick: ${which}`);
  }
  async cross(to: 'choose' | 'run' | 'build'): Promise<void> {
    if (this.screen === to) return;
    await onScreen(this.page, to);
    this.screen = to;
    this.steps.push(`CROSS to ${to}`);
  }
  get presses(): number {
    return this.steps.filter((s) => !s.startsWith('CROSS')).length;
  }
  get crossings(): number {
    return this.steps.filter((s) => s.startsWith('CROSS')).length;
  }
}

async function panel(): Promise<Page | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
  await page.addInitScript(tenVideos());
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('nav.moments', { timeout: 10_000 });
  await onScreen(page, 'choose');
  return page;
}

const VIDEOS = [
  'sora', 'sculptra-explainer', 'botox-myths', 'skin-booster', 'profhilo-day',
  'hifu-explained', 'prp-basics', 'lip-filler-qa', 'peel-aftercare', 'clinic-tour',
].map((n) => `Dr Loubna Kfafi/September Content/Exports/${n}.mov`);

/** The name a row shows: the file, without its folders. */
function shortOf(label: string): string {
  return (label.split('/').pop() ?? label).replace(/\.mov$/, '');
}

function report(what: string, walk: Walk): void {
  console.log(
    `\n  == ${what}: ${String(walk.presses)} presses, ${String(walk.crossings)} crossings ` +
      `(${String(walk.steps.length)} actions)`,
  );
  for (const s of walk.steps) console.log(`     ${s}`);
}

describe.skipIf(!built)('the journey, counted on the panel he has', () => {
  it('makes one video, start to finished composition', async () => {
    const page = await panel();
    if (page === null) return;
    const walk = new Walk(page);
    await walk.pick('Client', 'dr-loubna-kfafi');
    await walk.pick('Video', VIDEOS[0] as string);
    await walk.cross('run');
    await walk.press('Make the subtitles', 'section.do button.run', 'Make the subtitles');
    await walk.press('Make the pictures', 'section.do button.run', 'Make the pictures');
    await walk.cross('build');
    await walk.press('Build the composition', 'button.build-now');
    report('one video, made and built', walk);
    await page.close();
    expect(walk.steps.length).toBeGreaterThan(0);
  }, 120_000);

  /**
   * **The walk as it is now**, after session 114.
   *
   * The client is picked once, the videos are ticked where the list is being
   * made, and every finished composition is built in one press. What used to be a
   * crossing per video is no crossing at all.
   *
   * The before-figures this is set against were measured on the same harness at
   * the start of the session, against the panel as `80dcba8` left it:
   * **5 videos, 41 actions (19 crossings); 10 videos, 81 actions (39
   * crossings)** — 21 and 41 of those to put them in the list, 20 and 40 to
   * build them.
   */
  it.each([[5], [10]])('queues %i videos and builds them all', async (many) => {
    const page = await panel();
    if (page === null) return;
    const walk = new Walk(page);
    await walk.pick('Client', 'dr-loubna-kfafi');

    /* Putting them in the list: one crossing, then a tick each. */
    await walk.cross('run');
    for (let i = 0; i < many; i += 1) {
      const ticked = await walk.press(
        `tick video ${String(i + 1)}`,
        '.pickseveral button.pick',
        shortOf(VIDEOS[i] as string),
      );
      expect(`video ${String(i + 1)} tickable: ${String(ticked)}`).toBe(
        `video ${String(i + 1)} tickable: true`,
      );
    }
    await walk.press('Make these videos', 'section.pane button.run', 'Make these');
    const toQueue = walk.steps.length;

    /*
     * And building every one of them, in one press.
     *
     * The queue has to have finished for anything to be offered, which the stub
     * does by answering the poll with every video done. **The press is asserted
     * rather than counted**: session 114's first version of this walk recorded a
     * press that never happened, because the control it named had been replaced
     * and `press` answers false rather than throwing. A walk that silently skips
     * a step reports a shorter journey than the one he takes.
     */
    await page.evaluate(() => {
      const w = window as unknown as { __job: () => unknown };
      w.__job = () => ({
        id: 'job-1', status: 'done', progress: 1,
        detail: {
          items: (window as unknown as { __payload: { reels: { reels: { label: string }[] } } })
            .__payload.reels.reels.map((r) => ({
              reel: r.label, modeId: 'dr-loubna-kfafi', outcome: 'done',
              spentUsd: 0, attempts: 1, stage: null,
              startedAt: null, finishedAt: null,
            })),
          runningIndex: null, spentUsd: 0, done: true, stopped: false,
        },
      });
    });
    await page.waitForTimeout(1200);
    await walk.cross('build');
    const builtAll = await walk.press('Build them all', '.buildall button', 'Build');
    expect(`the build-all press happened: ${String(builtAll)}`).toBe(
      'the build-all press happened: true',
    );

    report(`${String(many)} videos, queued and built`, walk);
    console.log(
      `     -- putting them in the list: ${String(toQueue)} actions; ` +
        `building them: ${String(walk.steps.length - toQueue)} actions`,
    );
    await page.close();
    expect(walk.steps.length).toBeGreaterThan(0);
  }, 300_000);
});
