import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import {
  onScreen, HANDSHAKE, INDEX, REPO, built, stubHost, stubRoutes, stepsThrough } from './browser-harness.js';

/**
 * **A client's own photograph, too small for the space, in the real panel.**
 *
 * Block 11 session 58 proved a generated picture can never be enlarged, so the
 * only route the warning exists for is a photograph. Session 59 proved the
 * sentence renders — but its tests set `enlargement` on the fixture by hand, so
 * what they showed was the panel drawing a value, not a photograph producing
 * one. `service/src/clients/photograph-warning.test.ts` closes that on the
 * service side; this closes it on the panel side, on both ways a photograph can
 * reach a slot.
 *
 * **Its own file, and so its own browser**, for session 47's reason: the picker
 * tests in `render.browser.test.ts` are the ones that used to flake, and work
 * added beside them is what used to make them lose.
 *
 * The two photographs are real files in `panel/fixtures/`, shrunk from a picture
 * this project already paid for. They are what the `<img>` actually loads, so
 * "it still drew" is a fact about a file and not about a string.
 */
let browser: Browser | undefined;
let launchFailure: string | null = null;

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
  if (!built) return;
  try {
    browser = await chromium.launch();
  } catch (error) {
    launchFailure = (error as Error).message.split('\n')[0] ?? 'chromium would not launch';
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
}, 120_000);

const SMALL = path.join(REPO, 'panel', 'fixtures', 'client-photo-small.png');
const LARGE = path.join(REPO, 'panel', 'fixtures', 'client-photo-large.png');
const urlOf = (p: string): string => `file://${p.split('/').map(encodeURIComponent).join('/')}`;

/** 320 px and 600 px into the audited 1000 px box, as the service works them out. */
const TOO_SMALL = { percent: 312.5, tooEnlarged: true };
const BIG_ENOUGH = { percent: 1000 / 6, tooEnlarged: false };

function slot(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    start: 1,
    end: 3,
    idea: 'the client’s own thing',
    presentation: null,
    rendersAsCutout: false,
    nothingIsMeasured: true,
    templateId: null,
    zoneId: null,
    chosenCandidateId: null,
    overriddenFailures: [],
    placedSidePx: 925,
    placementLimit: 'the space above the speaker',
    buildsWith: null,
    buildsWithReason: 'no candidates',
    candidates: [],
    enlargement: null,
    shape: null,
    ...over,
  };
}

/**
 * The view as the service really produces it for a reel whose slots a client's
 * photographs fill: no generated candidates at all, the photograph named by id,
 * and the enlargement worked out from the file.
 */
function viewWith(slots: Record<string, unknown>[]): Record<string, unknown> {
  return {
    reel: 'a reel with photographs',
    planPath: '/v/photographs.editplan.json',
    generationEstimateUsd: null,
    generationNote: null,
    reelSpentUsd: 0,
    cardFrameForced: true,
    slots,
    clientPictures: [
      { id: 'pic001', path: SMALL, description: 'the small one', label: 'Zephyrine' },
      { id: 'pic002', path: LARGE, description: 'the big one', label: 'Kalimba' },
    ],
    videoPictures: [],
    source: {
      clientMode: 'a-client-with-photographs',
      clientModeVersion: 1,
      stageStatus: 'done',
      cacheEntryId: null,
      cacheProvenance: null,
    },
  };
}

interface Loaded {
  page: Page;
  uncaught: string[];
}

async function open(view: Record<string, unknown>): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
  await page.addInitScript(`
    window.__images = ${JSON.stringify(view)};
    window.__chose = [];
    const realFetch = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      if (u.indexOf('/images/choose') !== -1) {
        const body = JSON.parse(init.body);
        window.__chose.push(body);
        window.__images = Object.assign({}, window.__images, {
          slots: window.__images.slots.map((s) =>
            s.id === body.slotId
              ? Object.assign({}, s, { chosenClientPictureId: body.clientPictureId })
              : s),
        });
        return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__images) });
      }
      if (u.indexOf('/images') !== -1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__images) });
      }
      return realFetch(url, init);
    };
  `);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('section.video', { timeout: 10_000 });
  await page.selectOption('select[aria-label="Video"]', 'vitasilk');
  await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
  await onScreen(page, 'build');
  await page.click('section.change .opener:has-text("Pictures")');
  await page.waitForSelector('main.editor', { timeout: 5000 });
  return { page, uncaught };
}

/** Every picture has finished trying to load, so nothing races the error branch. */
async function picturesSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('img.shot')].every((el) => (el as HTMLImageElement).complete),
    undefined,
    { timeout: 15_000 },
  );
}

/** What is on screen, as values — never a live handle. */
async function picturesOnScreen(page: Page): Promise<{ src: string; loaded: boolean }[]> {
  return await page.$$eval('img.shot', (els) =>
    els.map((el) => {
      const img = el as HTMLImageElement;
      return { src: img.getAttribute('src') ?? '', loaded: img.complete && img.naturalWidth > 0 };
    }),
  );
}

describe('a browser to run in', () => {
  it('is there, or the reason is said out loud', () => {
    if (!built) {
      console.warn('panel/dist is missing — build the panel to run the photograph checks');
      return;
    }
    expect(launchFailure, launchFailure ?? '').toBeNull();
  });
});

describe.skipIf(!built)('a photograph a spoken word chose', () => {
  /*
   * The label route: Block 10 session 53 fills the slot when a word on the
   * label is spoken, so the photograph is on the plan before anyone opens the
   * picker. Session 57 listed this as uncovered.
   */
  const chosenByLabel = viewWith([
    slot('img001', {
      chosenClientPictureId: 'pic001',
      chosenClientPictureWord: 'Zephyrine',
      enlargement: TOO_SMALL,
    }),
  ]);

  it('says it will look soft, and still shows the photograph', async () => {
    const loaded = await open(chosenByLabel);
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      expect(text).toContain('small for the space it fills');
      expect(text).toContain('It is still placed');

      // The photograph is on screen and really drew — the whole point of a
      // warning that does not refuse.
      const shown = await picturesOnScreen(loaded.page);
      const photo = shown.filter((p) => p.src === urlOf(SMALL));
      expect(photo.length).toBeGreaterThan(0);
      expect(photo.every((p) => p.loaded)).toBe(true);

      // And it sends nobody anywhere.
      for (const word of ['terminal', 'npm run', 'restart']) {
        expect(`${word}: ${text.toLowerCase().includes(word)}`).toBe(`${word}: false`);
      }
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says nothing about a photograph that is big enough', async () => {
    const loaded = await open(
      viewWith([slot('img001', { chosenClientPictureId: 'pic002', enlargement: BIG_ENOUGH })]),
    );
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      expect(text).not.toContain('small for the space it fills');
      expect(await loaded.page.locator('p.reason.soft').count()).toBe(0);
      const shown = await picturesOnScreen(loaded.page);
      expect(shown.filter((p) => p.src === urlOf(LARGE)).every((p) => p.loaded)).toBe(true);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

describe.skipIf(!built)('a photograph chosen by hand from the picker', () => {
  /*
   * The other route, and the one session 57 named: he presses *Use this* on one
   * of the client's own pictures. Nothing has chosen it before he does.
   */
  it('is offered, chosen, and asked for by id', async () => {
    const loaded = await open(viewWith([slot('img001')]));
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      // Offered, with the words he described it in.
      const offered = (await loaded.page.textContent('.ownpics')) ?? '';
      expect(offered).toContain('the small one');
      expect(offered).toContain('the big one');
      // A field name is not a description.
      expect(offered).not.toContain('pic001');

      await loaded.page.click('button[aria-label="Use the small one"]');
      await loaded.page.waitForFunction('window.__chose.length > 0', undefined, { timeout: 5000 });
      const chose = (await loaded.page.evaluate('window.__chose')) as {
        slotId: string;
        clientPictureId: string;
      }[];
      expect(chose[0]?.slotId).toBe('img001');
      expect(chose[0]?.clientPictureId).toBe('pic001');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* Once chosen, the slot says so rather than leaving him to guess. */
  it('says the chosen photograph goes in the comp instead of a made one', async () => {
    const loaded = await open(
      viewWith([slot('img001', { chosenClientPictureId: 'pic001', enlargement: TOO_SMALL })]),
    );
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('.ownpics')) ?? '';
      expect(text).toContain('This picture goes in the comp instead of a made one');
      expect(text).toContain('Using this');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/**
 * **A photograph that is not the shape of its frame.**
 *
 * Block 13 session 107. Mohamed reported that one he adds which is not square is
 * used as it is and looks bad. Six of his twenty-two are not square, and not one
 * of them is enlarged past 200% — so the warning session 59 built never fired on
 * a single one and the panel said nothing before he spent.
 */
describe.skipIf(!built)('a photograph that is not square', () => {
  const WIDE = { shape: 'wider than it is tall' as const, leavesABand: true };
  const TALL = { shape: 'taller than it is wide' as const, leavesABand: true };
  const SQUARE = { shape: 'square' as const, leavesABand: false };

  it('says there will be bare frame beside it, and still shows the photograph', async () => {
    const loaded = await open(
      viewWith([slot('img001', { chosenClientPictureId: 'pic001', shape: WIDE })]),
    );
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      expect(text).toContain('wider than it is tall');
      expect(text).toContain('bare frame beside it');
      /* It warns; it does not refuse. */
      expect(text).toContain('It is still placed and nothing is cut off');

      /* The photograph is on screen and really drew, as with the soft warning. */
      const shown = await picturesOnScreen(loaded.page);
      expect(shown.length).toBeGreaterThan(0);

      /*
       * **No numbers in the sentence itself** — session 59's reason: a figure
       * would invite him to tune it, and what he can act on is whether to crop.
       * Read off the warning, not off the whole editor, which legitimately shows
       * the slot's own size in pixels a line below.
       */
      const warning = (await loaded.page.textContent('p.reason.soft')) ?? '';
      expect(warning).not.toMatch(/\d/);
      for (const word of ['terminal', 'npm run', 'restart']) {
        expect(`${word}: ${text.toLowerCase().includes(word)}`).toBe(`${word}: false`);
      }
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says which way it is long, so the sentence matches the picture', async () => {
    const loaded = await open(
      viewWith([slot('img001', { chosenClientPictureId: 'pic001', shape: TALL })]),
    );
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      expect(text).toContain('taller than it is wide');
      expect(text).not.toContain('wider than it is tall');
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /**
   * **The half that is not in doubt.** Every picture the tool makes is 2048 x
   * 2048, and this must say nothing about any of them — nor about a service too
   * old to have measured the shape at all.
   */
  it.each([
    ['a square photograph', SQUARE],
    ['a service that cannot say', null],
  ])('says nothing about %s', async (_name, shape) => {
    const loaded = await open(
      viewWith([slot('img001', { chosenClientPictureId: 'pic002', shape })]),
    );
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      expect(text).not.toContain('bare frame beside it');
      expect(await loaded.page.locator('p.reason.soft').count()).toBe(0);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});
