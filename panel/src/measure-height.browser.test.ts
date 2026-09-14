import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stubHost, stubFetch, HEALTHY_PAYLOAD, HANDSHAKE, onScreen } from './browser-harness.js';

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
beforeAll(async () => {
  if (built) browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
});

describe.skipIf(!built)('how tall the panel is', () => {
  it('measures every section, top to bottom', async () => {
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
    await page.addInitScript(stubFetch('healthy', HEALTHY_PAYLOAD));

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
