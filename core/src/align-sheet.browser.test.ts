import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { buildAlignmentRows, parseAlignReference, type AlignmentRow } from './align-review.js';
import { renderSheet } from './align-sheet.js';

/**
 * The sheet in a real browser, against the artifact a human actually opens.
 *
 * happy-dom would not do here. Guidelines §3: a test environment more capable
 * than the host proves nothing about the host, and the host for this file is
 * Chrome or Safari on the user's Mac. The defect it exists for cost seventeen
 * hand-made judgements — the sheet showed all seventeen marked and the
 * downloaded file carried three, because the rows were keyed by the
 * corrected-word index and the download walked positions.
 */
const HEAD = 'ff9d06c706fe2656713da3f0ec26ac1e357f26e5';
const ALIGNER = 'e9e63aebb60d6d84d1a1c0c9ad4a3d0e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1';

/**
 * The shape that broke: a re-review sheet holds only the rows a change moved,
 * so the corrected-word indices are sparse — 0,1,2 then 28,29,… — while the
 * positions are 0..16. Anything that confuses the two loses every row whose
 * index is not its own position.
 */
const draft = Array.from({ length: 60 }, (_, i) => ({ text: `د${i}`, start: i, end: i + 0.5 }));
const corrected = Array.from({ length: 60 }, (_, i) => `w${i}`);
const allRows: AlignmentRow[] = buildAlignmentRows(draft, corrected);
const SPARSE = [0, 1, 2, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54];
const rows: AlignmentRow[] = SPARSE.map((i) => allRows[i] as AlignmentRow);

const VERDICTS = ['correct', 'wrong', 'misheard', 'two-tokens', 'no-token'] as const;

let browser: Browser | undefined;
let launchFailure: string | null = null;
const dirs: string[] = [];

beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch (error) {
    launchFailure = (error as Error).message.split('\n')[0] ?? 'chromium would not launch';
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes the real artifact to disk and opens it, exactly as a human would. */
async function openSheet(restored?: Record<string, string>): Promise<Page | null> {
  if (browser === undefined) return null;
  const html = renderSheet({
    reel: 'vitasilk',
    headSha: HEAD,
    generatedAt: '2026-08-27T00:00:00.000Z',
    cacheEntry: 'transcription-758a3924d090d1b5',
    promptVersion: 4,
    rows,
    variant: 'rereview',
    previousSha: '0'.repeat(40),
    schemaVersion: 3,
    alignerHash: ALIGNER,
    ...(restored === undefined ? {} : { restored }),
  });
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-sheet-'));
  dirs.push(dir);
  const file = path.join(dir, 'vitasilk.rereview.html');
  writeFileSync(file, html);

  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { __blobs: Blob[] }).__blobs = [];
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob | MediaSource): string => {
      (window as unknown as { __blobs: Blob[] }).__blobs.push(blob as Blob);
      return real(blob);
    };
    HTMLAnchorElement.prototype.click = function (): void {};
  });
  await page.goto(`file://${file}`);
  await page.waitForSelector('tr.row');
  expect(errors, errors.join('\n')).toEqual([]);
  return page;
}

async function mark(page: Page, index: number, verdict: string): Promise<void> {
  await page.locator(`tr.row >> nth=${index}`).locator(`button.v[data-v="${verdict}"]`).click();
}

async function download(page: Page): Promise<Record<string, unknown>> {
  await page.locator('#download').click();
  const text = await page.evaluate(
    async () => await (window as unknown as { __blobs: Blob[] }).__blobs[0]!.text(),
  );
  return JSON.parse(text) as Record<string, unknown>;
}

describe.skipIf(!!launchFailure)('the sheet a human opens', () => {
  it('has a browser to drive', () => {
    if (launchFailure !== null) console.warn(`skipping: ${launchFailure}`);
    expect(rows).toHaveLength(17);
  });

  /*
   * The regression, exactly: seventeen rows, every one marked, and the file
   * used to carry three.
   */
  it('writes all 17 rows, in display order, with the verdicts given', async () => {
    const page = await openSheet();
    if (page === null) return;
    try {
      const given: string[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        const verdict = VERDICTS[i % VERDICTS.length] as string;
        given.push(verdict);
        await mark(page, i, verdict);
      }
      expect(await page.locator('button.v.sel').count()).toBe(17);

      const doc = await download(page);
      const reference = parseAlignReference(doc);

      expect(reference.entries).toHaveLength(17);
      expect(reference.entries.map((e) => e.wordId)).toEqual(rows.map((r) => r.wordId));
      expect(reference.entries.map((e) => e.verdict)).toEqual(given);
      expect(reference.rowCount).toBe(17);
      expect(reference.markedCount).toBe(17);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('keeps an unmarked row with a null verdict and counts only the marked', async () => {
    const page = await openSheet();
    if (page === null) return;
    try {
      await mark(page, 3, 'wrong');
      await mark(page, 12, 'correct');
      await mark(page, 16, 'misheard');

      const reference = parseAlignReference(await download(page));

      expect(reference.entries).toHaveLength(17);
      expect(reference.rowCount).toBe(17);
      expect(reference.markedCount).toBe(3);
      expect(reference.entries.filter((e) => e.verdict === null)).toHaveLength(14);
      expect(reference.entries[3]?.verdict).toBe('wrong');
      expect(reference.entries[12]?.verdict).toBe('correct');
      expect(reference.entries[16]?.verdict).toBe('misheard');
      expect(reference.entries[0]?.verdict).toBeNull();
    } finally {
      await page.close();
    }
  }, 60_000);

  it('restores marks after a reload, and says how many', async () => {
    const page = await openSheet();
    if (page === null) return;
    try {
      for (let i = 0; i < 5; i += 1) await mark(page, i, 'wrong');
      expect(await page.locator('#progress').textContent()).toBe('marked 5 of 17');

      await page.reload();
      await page.waitForSelector('tr.row');

      expect(await page.locator('button.v.sel').count()).toBe(5);
      expect(await page.locator('#progress').textContent()).toBe('marked 5 of 17');

      const reference = parseAlignReference(await download(page));
      expect(reference.markedCount).toBe(5);
      expect(reference.entries).toHaveLength(17);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('shows a live marked count beside the download control', async () => {
    const page = await openSheet();
    if (page === null) return;
    try {
      expect(await page.locator('#progress').textContent()).toBe('marked 0 of 17');
      await mark(page, 0, 'correct');
      expect(await page.locator('#progress').textContent()).toBe('marked 1 of 17');
      await mark(page, 0, 'correct');
      expect(await page.locator('#progress').textContent()).toBe('marked 0 of 17');
    } finally {
      await page.close();
    }
  }, 60_000);

  it('pre-fills restored verdicts, marks them as restored, and lets them change', async () => {
    const first = rows[0] as AlignmentRow;
    const page = await openSheet({ [first.wordId]: 'correct' });
    if (page === null) return;
    try {
      expect(await page.locator('#restored-note').textContent()).toContain('1 of 17');
      expect(await page.locator('tr.row.restored').count()).toBe(1);
      expect(await page.locator('#progress').textContent()).toBe('marked 1 of 17');

      await mark(page, 0, 'wrong');
      expect(await page.locator('tr.row.restored').count()).toBe(0);

      const reference = parseAlignReference(await download(page));
      expect(reference.entries[0]?.verdict).toBe('wrong');
      expect(reference.markedCount).toBe(1);
    } finally {
      await page.close();
    }
  }, 60_000);

  /*
   * The rule the generator and the download path now share: the file contains
   * every displayed row. Pinned here, where both are exercised at once — the
   * sheet is rendered by the generator and read back through the download.
   */
  it('never writes fewer entries than the rows on screen, however they are marked', async () => {
    const page = await openSheet();
    if (page === null) return;
    try {
      for (const pattern of [[], [0], [16], [0, 8, 16], SPARSE.map((_, i) => i)]) {
        await page.reload();
        await page.waitForSelector('tr.row');
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();
        await page.waitForSelector('tr.row');

        for (const i of pattern) await mark(page, i, 'correct');
        const reference = parseAlignReference(await download(page));

        expect(reference.entries).toHaveLength(await page.locator('tr.row').count());
        expect(reference.rowCount).toBe(reference.entries.length);
        expect(reference.markedCount).toBe(pattern.length);
      }
    } finally {
      await page.close();
    }
  }, 90_000);
});

/**
 * Marks saved before the download bug was fixed are still in the reviewer's
 * browser, under the key the sheet used then and keyed by the corrected-word
 * index. They are worth more than a tidy migration: seventeen of them were
 * lost once already.
 */
describe.skipIf(!!launchFailure)('marks saved under the old key', () => {
  it('are migrated onto the right rows and shown as restored', async () => {
    const page = await openSheet();
    if (page === null) return;
    try {
      // What the old sheet wrote: keyed by data-i, the corrected-word index.
      await page.evaluate(
        ([key, legacy]) => {
          window.localStorage.clear();
          window.localStorage.setItem(key as string, JSON.stringify(legacy));
        },
        [
          `framopia.align-review.rereview.vitasilk.${HEAD}`,
          {
            '0': { verdict: 'correct' },
            '28': { verdict: 'wrong' },
            '54': { verdict: 'misheard', note: 'kept' },
          },
        ],
      );
      await page.reload();
      await page.waitForSelector('tr.row');

      expect(await page.locator('#progress').textContent()).toBe('marked 3 of 17');
      expect(await page.locator('tr.row.restored').count()).toBe(3);
      expect(await page.locator('#restored-note').textContent()).toContain('saved before the download bug');

      const reference = parseAlignReference(await download(page));
      expect(reference.entries).toHaveLength(17);
      expect(reference.markedCount).toBe(3);
      // Index 0, 28 and 54 are display positions 0, 3 and 16 in this row set.
      expect(reference.entries[0]?.verdict).toBe('correct');
      expect(reference.entries[3]?.verdict).toBe('wrong');
      expect(reference.entries[16]?.verdict).toBe('misheard');
      expect(reference.entries[16]?.note).toBe('kept');
    } finally {
      await page.close();
    }
  }, 60_000);

  it('does not overwrite marks already made under the current key', async () => {
    const page = await openSheet();
    if (page === null) return;
    try {
      await mark(page, 0, 'no-token');
      await page.evaluate(
        ([key]) => window.localStorage.setItem(key as string, JSON.stringify({ '0': { verdict: 'correct' } })),
        [`framopia.align-review.rereview.vitasilk.${HEAD}`],
      );
      await page.reload();
      await page.waitForSelector('tr.row');

      const reference = parseAlignReference(await download(page));
      expect(reference.entries[0]?.verdict).toBe('no-token');
      expect(reference.markedCount).toBe(1);
    } finally {
      await page.close();
    }
  }, 60_000);
});
