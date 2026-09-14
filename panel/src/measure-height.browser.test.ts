import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
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
