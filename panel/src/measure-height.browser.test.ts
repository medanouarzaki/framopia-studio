import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stubHost,
  stubFetch,
  HEALTHY_PAYLOAD,
  HANDSHAKE,
  onScreen,
  realPanelRoutes,
} from './browser-harness.js';

/**
 * **A ruler, not a rule.**
 *
 * Block 13 session 95 needed the panel's real height before rearranging it, and a
 * number measured by hand in a session is a number nobody can check later. This
 * measures it in the same browser the other tests use and prints it; it asserts
 * only that the page rendered at all.
 *
 * What it measured on 2026-09-13: six sections, **1288 px of content in a 900 px
 * panel**, with *Make several videos* — the queue he asked for and could not find
 * — beginning at **990 px**, ninety pixels below the fold. The restructure that
 * measurement was taken for is not in this commit (the session's report says
 * why), so the ruler stays, and the next session starts from a number rather
 * than from an impression.
 */
const SRC = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(SRC, '..', 'dist', 'index.html');
const built = existsSync(INDEX);

let browser: Browser | undefined;
/*
 * **Launching a browser is not a ten-second job on a busy Mac.** Block 13
 * session 99: the fourth of five back-to-back panel runs exited 1 with
 * `Hook timed out in 10000ms` while all 337 tests passed — seven of these files
 * each start their own Chromium, and vitest's default hook bound is ten seconds.
 * The bound is a hang detector, not a measurement of how fast a browser starts,
 * so it is generous on purpose. Session 90 made the same correction to the CV
 * sidecar's for the same reason.
 */
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
}, 120_000);

describe.skipIf(!built)('how tall the panel is', () => {
  it.each([
    ['service answering', true],
    ['service not answering', false],
  ])('measures every section, top to bottom — %s', async (_name, healthy) => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    /*
     * **With the service answering**, which is how he uses it. Block 13 session
     * 99: every height reported from session 95 to 98 was measured with the
     * service unreachable, and that branch of the readiness block is 211 px of
     * error, retry button and attempt count. Healthy it is one line. The figures
     * those sessions reported were true of a panel that was not working.
     */
    if (healthy) await page.addInitScript(stubFetch('healthy', HEALTHY_PAYLOAD));

    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('header.brand', { timeout: 10_000 });
    await page.waitForTimeout(400);

    const rows = await page.evaluate(() => {
      const out: { name: string; top: number; height: number }[] = [];
      const body = document.querySelector('#root');
      out.push({
        name: '(whole page)',
        top: 0,
        height: Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
          body?.scrollHeight ?? 0,
        ),
      });
      for (const s of Array.from(document.querySelectorAll('section'))) {
        const h2 = s.querySelector('h2');
        const r = s.getBoundingClientRect();
        out.push({
          name: h2?.textContent ?? '(no heading)',
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
        });
      }
      return out;
    });
    const show = (label: string, rs: typeof rows): void => {
      const real = rs.filter((r) => r.name !== '(whole page)');
      const bottom = Math.max(...real.map((r) => r.top + r.height));
      console.log(`\n  == ${label} — content ends at ${String(bottom)}px of a 900px panel`);
      for (const r of rs) {
        console.log(
          `     ${r.name.padEnd(26)} top ${String(r.top).padStart(5)}px  height ${String(r.height).padStart(5)}px`,
        );
      }
    };
    const sections = async (): Promise<typeof rows> =>
      await page.evaluate(() => {
        const out: { name: string; top: number; height: number }[] = [];
        for (const s of Array.from(document.querySelectorAll('section'))) {
          const h2 = s.querySelector('h2');
          const r = s.getBoundingClientRect();
          out.push({
            name: h2?.textContent ?? '(no heading)',
            top: Math.round(r.top + window.scrollY),
            height: Math.round(r.height),
          });
        }
        return out;
      });

    const split = (await page.$('nav.moments')) !== null;
    if (!split) {
      show('the one scroll', rows);
    } else {
      for (const screen of ['choose', 'run', 'build'] as const) {
        await onScreen(page, screen);
        show(screen, await sections());
      }
    }

    expect(rows.length).toBeGreaterThan(1);
    await page.close();
  }, 60_000);
});

/**
 * **The same ruler, with his data in the panel.**
 *
 * Block 13 session 102. Every figure the ruler above has reported since session
 * 95 is a figure of an *empty* panel: no client chosen, so no card; no video, so
 * no stages and no cost; no queue. His own Choose screen carries Dr Loubna
 * Kfafi's four colours, three typefaces, a watermark control, twenty-two
 * photographs and *Change their details* — between the two decisions he came to
 * take.
 *
 * **Both measurements are kept, named.** The stub one is the floor: what the
 * panel costs before anyone uses it. This one is what he sees. They answer
 * different questions and neither replaces the other.
 */
describe.skipIf(!built)('how tall the panel is with his own data', () => {
  /**
   * **Only with the service answering, and that is not an omission.**
   *
   * The stub ruler above measures both states because the difference between them
   * — 71 px of readiness against 129 px of retry and attempt count — is the error
   * session 99 found in every height sessions 95 to 98 reported. But his data
   * *comes from the service*: with it unreachable there is no client, no video
   * and no queue, so "his data, service not answering" is the empty panel the
   * ruler above already measures. Measuring it twice under two names would be
   * inventing a second figure for one thing.
   */
  it('measures every screen as he meets it', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(realPanelRoutes());
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('header.brand', { timeout: 10_000 });

    /* Chosen, not stubbed: this is the sequence he performs. */
    await onScreen(page, 'choose');
    await page.selectOption('select[aria-label="Client"]', 'dr-loubna-kfafi');
    await page.waitForTimeout(300);
    await page.selectOption(
      'select[aria-label="Video"]',
      'Dr Loubna Kfafi/September Content/Exports/sora.mov',
    );
    await page.waitForTimeout(600);

    const measure = async (label: string): Promise<number> => {
      const rows = await page.evaluate(() => {
        const out: { name: string; top: number; height: number }[] = [];
        for (const s of Array.from(document.querySelectorAll('section'))) {
          if (!s.checkVisibility()) continue;
          const h2 = s.querySelector('h2');
          const r = s.getBoundingClientRect();
          out.push({
            name: h2?.textContent ?? '(no heading)',
            top: Math.round(r.top + window.scrollY),
            height: Math.round(r.height),
          });
        }
        return out;
      });
      const bottom = Math.max(...rows.map((r) => r.top + r.height));
      console.log(
        `\n  == ${label} — HIS DATA (service answering): ` +
          `content ends at ${String(bottom)}px of a 900px panel`,
      );
      for (const r of rows) {
        console.log(
          `     ${r.name.padEnd(26)} top ${String(r.top).padStart(5)}px  height ${String(r.height).padStart(5)}px`,
        );
      }
      return bottom;
    };

    await onScreen(page, 'choose');
    const choose = await measure('choose');

    await onScreen(page, 'run');
    /* Four videos in the list, which is how he uses it while he is away. */
    for (const label of [
      'Dr Loubna Kfafi/September Content/Exports/sculptra-explainer.mov',
      'Dr Loubna Kfafi/September Content/Exports/botox-myths.mov',
      'Dr Loubna Kfafi/September Content/Exports/skin-booster.mov',
    ]) {
      await onScreen(page, 'choose');
      await page.selectOption('select[aria-label="Video"]', label);
      await page.waitForTimeout(250);
      await onScreen(page, 'run');
      const add = await page.$('section.pane button.run');
      if (add !== null) await add.click();
      await page.waitForTimeout(120);
    }
    await onScreen(page, 'run');
    const run = await measure('run');

    await onScreen(page, 'build');
    const build = await measure('build');

    console.log(
      `\n  == HIS DATA (service answering), past the 900px fold: choose ${String(choose - 900)}px, ` +
        `run ${String(run - 900)}px, build ${String(build - 900)}px`,
    );

    expect(choose).toBeGreaterThan(0);
    await page.close();
  }, 120_000);
});

/**
 * **Make and Build, block by block, in every state he meets.**
 *
 * Block 13 session 103. Session 102 measured whole screens with his data and found
 * Choose at 4000 px; it fixed Choose and left Make at 1242 px and Build at 964 px
 * of a 900 px window. A screen total says a screen is too tall; it does not say
 * which block to look at, and neither does a total taken in one state — the state
 * he meets daily and the worst state a screen can be in are different screens.
 *
 * So this walks the direct children of each visible section and prints what each
 * costs, in five states for Make and three for Build. It asserts only that the
 * page rendered: a ruler, not a rule. What it measured is in the session report.
 */
describe.skipIf(!built)('what each block of Make and Build costs', () => {
  /** Every visible section, and the direct children inside it, with heights. */
  async function blocks(page: Page, label: string): Promise<number> {
    const rows = await page.evaluate(() => {
      const out: { name: string; top: number; height: number; depth: number }[] = [];
      for (const s of Array.from(document.querySelectorAll('section'))) {
        if (!s.checkVisibility()) continue;
        const r = s.getBoundingClientRect();
        const h2 = s.querySelector('h2');
        out.push({
          name: h2?.textContent ?? `section.${s.className}`,
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
          depth: 0,
        });
        for (const child of Array.from(s.children)) {
          if (!(child as HTMLElement).checkVisibility()) continue;
          if (child.tagName === 'H2') continue;
          const cr = child.getBoundingClientRect();
          if (Math.round(cr.height) === 0) continue;
          const what =
            child.tagName === 'DETAILS'
              ? `<details> ${child.querySelector('summary')?.textContent ?? ''}`
              : `${child.tagName.toLowerCase()}.${child.className || '(none)'}`;
          out.push({
            name: what.slice(0, 46),
            top: Math.round(cr.top + window.scrollY),
            height: Math.round(cr.height),
            depth: 1,
          });
        }
      }
      return out;
    });
    const bottom = Math.max(...rows.filter((r) => r.depth === 0).map((r) => r.top + r.height));
    console.log(`\n  == ${label} — ends at ${String(bottom)}px of a 900px panel`);
    for (const r of rows) {
      const pad = r.depth === 0 ? '' : '    ';
      console.log(
        `     ${pad}${r.name.padEnd(46 - pad.length)} ${String(r.height).padStart(5)}px`,
      );
    }
    return bottom;
  }


  /** A pipeline job, in the two states that change Make's shape. */
  function runJob(state: 'running' | 'failed'): string {
    const stage = (
      id: string,
      label: string,
      st: string,
      extra: Record<string, unknown> = {},
    ): Record<string, unknown> => ({ id, label, state: st, reason: null, costUsd: 0, ...extra });
    const stages =
      state === 'running'
        ? [
            stage('transcription', 'Writing down the words', 'done'),
            stage('analysis', 'Choosing the pictures', 'running', { detail: 'asking the model' }),
            stage('images', 'Drawing the pictures', 'waiting'),
            stage('zones', 'Looking at the video', 'waiting'),
          ]
        : [
            stage('transcription', 'Writing down the words', 'done'),
            stage('analysis', 'Choosing the pictures', 'failed', {
              error: {
                stage: 'analysis',
                cause: '1 slot idea(s) depict more than one subject: slot 7',
                retryable: true,
              },
            }),
            stage('images', 'Drawing the pictures', 'waiting'),
            stage('zones', 'Looking at the video', 'waiting'),
          ];
    const detail = {
      reel: 'sora', modeId: 'dr-loubna-kfafi', planPath: '/v/p0.json', stages,
      percent: 0.25, spentUsd: 0, planSpentUsd: 3.4025,
      done: state === 'failed',
      error: state === 'failed' ? stages[1]?.['error'] : null,
    };
    return `window.__job = () => (${JSON.stringify({
      id: 'job-1',
      status: state === 'running' ? 'running' : 'error',
      progress: detail.percent,
      detail,
    })});`;
  }

  /** A finished build, which is what Build looks like after he presses it. */
  function builtJob(): string {
    const detail = {
      reel: 'sora', planPath: '/v/p0.json',
      stages: [
        { id: 'prepare', label: 'Read the plan and resolve everything it names', state: 'done' },
        { id: 'after-effects', label: 'Build the composition in After Effects', state: 'done' },
        { id: 'check', label: 'Check the built comp against the plan', state: 'done' },
      ],
      percent: 1, done: true,
      savePath: '/repo/.local/build/sora-full.aep',
      savedOwnOutput: '/repo/.local/build/sora-full.aep',
      wallS: 1.3, error: null,
    };
    return `window.__job = () => (${JSON.stringify({ id: 'job-1', status: 'done', progress: 1, detail })});`;
  }

  /**
   * **At his width, not at 420 px.** Block 13 session 105: sixteen of this panel's
   * browser viewports say `width: 420`, and every height sessions 95 to 104
   * reported — 589, 849, 750 — is a height of a 420 px panel. His window is
   * roughly 1500 px, where less text wraps and the heights are different figures
   * about a different thing.
   */
  async function hisPanel(extra?: string, width = 1500): Promise<Page | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(realPanelRoutes());
    if (extra !== undefined) await page.addInitScript(extra);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('header.brand', { timeout: 10_000 });
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

  it('measures Make in the states he meets', async () => {
    const page = await hisPanel();
    if (page === null) return;

    /* The state he meets daily: a video already run, nothing in the list. */
    await onScreen(page, 'run');
    await blocks(page, 'MAKE — daily: run video, queue idle');

    /* Four in the list, which is how he uses it while he is away. */
    for (const label of [
      'Dr Loubna Kfafi/September Content/Exports/sculptra-explainer.mov',
      'Dr Loubna Kfafi/September Content/Exports/botox-myths.mov',
      'Dr Loubna Kfafi/September Content/Exports/skin-booster.mov',
    ]) {
      await onScreen(page, 'choose');
      await page.selectOption('select[aria-label="Video"]', label);
      await page.waitForTimeout(250);
      await onScreen(page, 'run');
      const add = await page.$('section.pane button.run');
      if (add !== null) await add.click();
      await page.waitForTimeout(120);
    }
    await onScreen(page, 'run');
    await blocks(page, 'MAKE — four videos in the list');
    await page.close();

    /* A run in progress, and a run that failed: the two states that add a block. */
    for (const [state, label] of [
      ['running', 'MAKE — a run in progress'],
      ['failed', 'MAKE — a stage failed'],
    ] as const) {
      const p2 = await hisPanel(runJob(state));
      if (p2 === null) return;
      await onScreen(p2, 'run');
      await p2.click('section.do .partrun button.run');
      await p2.waitForTimeout(900);
      await blocks(p2, label);
      await p2.close();
    }
  }, 180_000);

  it('measures Build in the states he meets', async () => {
    const page = await hisPanel();
    if (page === null) return;
    await onScreen(page, 'build');
    await blocks(page, 'BUILD — ready to build');
    await page.close();

    /* Nothing chosen: the empty state session 102 grew by 26 px. */
    if (browser === undefined) return;
    const empty = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await empty.addInitScript(stubHost(HANDSHAKE));
    await empty.addInitScript(realPanelRoutes());
    await empty.goto(`file://${INDEX}`);
    await empty.waitForSelector('header.brand', { timeout: 10_000 });
    await onScreen(empty, 'build');
    await blocks(empty, 'BUILD — nothing chosen');
    await empty.close();

    /* Already built once, which is what he looks at after pressing it. */
    const done = await hisPanel(builtJob());
    if (done === null) return;
    await onScreen(done, 'build');
    await done.click('button.build-now');
    await done.waitForTimeout(900);
    await blocks(done, 'BUILD — already built once');
    await done.close();

    /*
     * **The worst state Build can be in**: a client who has not chosen typefaces,
     * so `FontsNote` renders. Neither real client is in it — both have fonts set —
     * which is exactly why the first draft of this ruler measured it by accident
     * and reported Build 205 px taller than it is.
     */
    const noFonts = await hisPanel(
      'window.__payload.modes.modes.forEach(function (m) { delete m.fonts; });',
    );
    if (noFonts === null) return;
    await onScreen(noFonts, 'build');
    await blocks(noFonts, 'BUILD — a client with no typefaces of their own');
    await noFonts.close();
  }, 180_000);
});
