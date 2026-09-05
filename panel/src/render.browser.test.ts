import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright';

/**
 * The check happy-dom cannot be: a real engine, real layout, real module
 * evaluation over the built bundle.
 *
 * happy-dom parses and executes but lays nothing out, which is how a panel that
 * rendered an empty rectangle inside After Effects passed a green suite. Every
 * assertion here is one happy-dom would have answered wrongly or not at all —
 * measured dimensions, and an uncaught-error count from the page itself.
 *
 * The real CEP bridge is stubbed rather than used: `cep_node` is injected
 * before the bundle runs, so this exercises the panel's own startup path
 * without needing After Effects.
 */
import {
  HANDSHAKE,
  HEALTHY_PAYLOAD,
  INDEX,
  LOGO,
  REPO,
  SERVICE_BUILT,
  built,
  stubFetch,
  stubHost,
  stubRoutes,
  stepsThrough,
} from './browser-harness.js';

let browser: Browser | undefined;
let launchFailure: string | null = null;

beforeAll(async () => {
  if (!built) return;
  try {
    browser = await chromium.launch();
  } catch (error) {
    // The browser binary is a machine prerequisite, like the CV venv. A
    // contributor without it should still be able to run the gate, and should
    // be told, never skipped silently.
    launchFailure = (error as Error).message.split('\n')[0] ?? 'chromium would not launch';
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

interface Loaded {
  page: Page;
  /** Uncaught exceptions only. A handled fetch failure is not one. */
  uncaught: string[];
}

/*
 * Every page gets a handshake by default, so `connect` takes the fast path —
 * a registered service that does not answer — rather than the spawn path,
 * which polls for twelve seconds by design.
 */
async function load(
  options: {
    files?: Record<string, string>;
    fetch?: 'healthy' | 'hang' | null;
    repo?: string;
    width?: number;
    height?: number;
    /** Replaces the health payload, for a test about what the service reports. */
    health?: unknown;
  } = {},
): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({
    viewport: { width: options.width ?? 420, height: options.height ?? 900 },
  });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  page.on('console', (msg: ConsoleMessage) => {
    /*
     * Chromium logs a console error for a refused fetch. The stub points at a
     * port nothing listens on, and the panel handles that by design — counting
     * it would make "no uncaught errors" untestable.
     */
    if (msg.type() !== 'error') return;
    if (msg.text().includes('Failed to load resource')) return;
    uncaught.push(msg.text());
  });
  await page.addInitScript(stubHost(options.files ?? HANDSHAKE, options.repo));
  if (options.fetch != null) {
    await page.addInitScript(stubFetch(options.fetch, options.health ?? HEALTHY_PAYLOAD));
  }
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('header.brand', { timeout: 10_000 });
  return { page, uncaught };
}

describe.skipIf(!built)('the built panel in a real browser', () => {
  it('has a browser to drive', () => {
    if (launchFailure !== null) {
      console.warn(
        `panel: skipping the render check — ${launchFailure}. Run \`npx playwright install chromium\`.`,
      );
    }
    expect(built).toBe(true);
  });

  it('mounts with no uncaught error', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page, uncaught } = loaded;
    try {
      // The regression: `cep_node is not available` was thrown at module load
      // and nothing rendered at all.
      expect(uncaught).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('lays out — the root has real dimensions', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page } = loaded;
    try {
      const box = await page.locator('#root').boundingBox();
      expect(box).not.toBeNull();
      expect(box?.width).toBeGreaterThan(300);
      expect(box?.height).toBeGreaterThan(300);

      const header = await page.locator('header.brand').boundingBox();
      expect(header?.height).toBeGreaterThan(20);
    } finally {
      await page.close();
    }
  });

  it('renders the brand mark and one screen, top to bottom', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page } = loaded;
    try {
      expect(await page.locator('header.brand .name').textContent()).toContain('Framopia');
      const logo = page.locator('header.brand img, header.brand .mark');
      expect(await logo.count()).toBe(1);
      expect((await logo.boundingBox())?.width).toBeGreaterThan(0);
      // No logo on disk in this stub, so the fallback mark is what renders.
      expect(await page.locator('header.brand .mark').count()).toBe(1);

      /*
       * One screen in the order he works in. Client comes before Video from
       * session 43: the client is what decides which videos there are, so
       * asking for the video first asked a question out of order.
       */
      const headings = await page.locator('section > h2').allTextContents();
      expect(headings).toEqual(['Client', 'Video', 'Cost', 'Change something first']);
    } finally {
      await page.close();
    }
  });

  it('renders starting while the health call is in flight', async () => {
    const loaded = await load({ files: HANDSHAKE, fetch: 'hang' });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      expect(await page.locator('.dot.starting').count()).toBe(1);
      expect(await page.locator('section.readiness').textContent()).toContain('Starting');
    } finally {
      await page.close();
    }
  }, 20_000);

  it('renders unreachable with the cause and a way forward', async () => {
    const loaded = await load({ files: HANDSHAKE });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.unreachable', { timeout: 10_000 });
      const line = (await page.locator('section.readiness').textContent()) ?? '';
      expect(line).toContain('Not working');
      expect(await page.getByRole('button', { name: 'Try again' }).count()).toBe(1);
    } finally {
      await page.close();
    }
  });

  /*
   * One word while it works. The machine facts moved behind Details in session
   * 42 — none of them changes what he does next, and he is a motion designer,
   * not the person who installed ffmpeg.
   */
  it('renders healthy as one line, with the facts behind Details', async () => {
    const loaded = await load({ files: HANDSHAKE, fetch: 'healthy' });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 10_000 });
      const line = (await page.locator('section.readiness').textContent()) ?? '';
      expect(line).toContain('Ready');
      expect(line).not.toContain('ffmpeg version 8.0.1');

      await page.getByRole('button', { name: 'Details' }).click();
      const card = (await page.locator('section.readiness').textContent()) ?? '';
      expect(card).toContain('ffmpeg version 8.0.1');
      expect(card).toContain('Version 0.1.0');
      expect(card).not.toContain('{');
    } finally {
      await page.close();
    }
  }, 20_000);

  /*
   * The real PNG, decoded by the browser. Asserting an <img> element exists
   * proved nothing: the header rendered a red square for a whole session
   * because the path was wrong and a broken image is still an element.
   */
  it('loads the real logo, not merely an <img> element', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, [LOGO]: '' } });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      const img = page.locator('header.brand img');
      expect(await img.count()).toBe(1);
      expect(await page.locator('header.brand .mark').count()).toBe(0);
      expect(await img.getAttribute('src')).toBe(`file://${LOGO}`);

      const decoded = await img.evaluate((el) => ({
        complete: (el as HTMLImageElement).complete,
        w: (el as HTMLImageElement).naturalWidth,
        h: (el as HTMLImageElement).naturalHeight,
      }));
      expect(decoded.complete).toBe(true);
      expect(decoded.w).toBe(962);
      expect(decoded.h).toBe(1077);

      expect((await img.boundingBox())?.width).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  }, 20_000);

  it('keeps the Run control disabled with its reason on screen', async () => {
    const loaded = await load();
    if (loaded === null) return;
    const { page } = loaded;
    try {
      // The first of the two run buttons, whatever it is called this month.
      const run = page.locator('button.run').first();
      expect(await run.isDisabled()).toBe(true);
      const reason = await page.locator('section.do p.say').first().textContent();
      expect(reason ?? '').not.toBe('');
    } finally {
      await page.close();
    }
  });

  /*
   * The fault this session fixed, reproduced from the other side: with no
   * cep_node the panel must still mount and say why, rather than going blank.
   */
  it('mounts and explains itself when the host is missing entirely', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 420, height: 760 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    try {
      await page.goto(`file://${INDEX}`);
      await page.waitForSelector('header.brand', { timeout: 10_000 });

      expect(uncaught).toEqual([]);
      const card = (await page.locator('.card').first().textContent()) ?? '';
      expect(card).toContain('cep_node');
      expect(card).toContain('--enable-nodejs');
      const box = await page.locator('#root').boundingBox();
      expect(box?.height).toBeGreaterThan(100);
    } finally {
      await page.close();
    }
  });
});

describe.skipIf(built)('the built panel', () => {
  it('is not built, so the browser check is skipped with a notice', () => {
    console.warn('panel/dist is missing — run `npm run panel:build` to run the render check');
    expect(built).toBe(false);
  });
});

/**
 * The two ends of the spawn path, in a real engine.
 *
 * The user saw the failure end wearing an authoritative message about
 * `/service/dist/service.js`, a file that could never exist because the root
 * had resolved to `/`. Both ends are driven here, and the rendered text is
 * asserted to differ.
 */
describe.skipIf(!built)('the spawn path in a real browser', () => {
  it('reports the service as not built, naming a path under the real root', async () => {
    const loaded = await load({ files: {} });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.unreachable', { timeout: 15_000 });
      const card = (await page.locator('section.readiness').textContent()) ?? '';

      expect(card).toContain('has not been prepared yet');
      expect(card).toContain(`${REPO}/service/dist/service.js`);
      // It tries to prepare it rather than naming a command, and says so when
      // it cannot. Nothing here is a thing for a person to type.
      expect(card).toContain('could not be prepared');
      expect(card).not.toContain('npm run');
      /*
       * The regression: a path starting at the root of the disk, which is what
       * an empty repository root composes into. The correct path contains the
       * same tail, so the test has to look at what precedes it.
       */
      expect(card).not.toMatch(/[\s:]\/service\/dist\/service\.js/);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('reaches healthy when the service is built and answers', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy' });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      const card = (await page.locator('section.readiness').textContent()) ?? '';
      expect(card).toContain('Ready');
      expect(card).not.toContain('not built');
    } finally {
      await page.close();
    }
  }, 30_000);

  /*
   * Two identical failures must look different. A working Retry that renders
   * byte-identical text is indistinguishable from a dead one, which is exactly
   * what the user reported.
   */
  it('renders a distinguishable state on a second retry', async () => {
    const loaded = await load({ files: {} });
    if (loaded === null) return;
    const { page } = loaded;
    try {
      await page.waitForSelector('.attempt', { timeout: 15_000 });
      expect(await page.locator('.attempt').first().getAttribute('data-attempt')).toBe('0');
      const first = (await page.locator('section.readiness').textContent()) ?? '';

      await page.getByRole('button', { name: 'Try again' }).first().click();
      await page.waitForSelector('.attempt[data-attempt="1"]', { timeout: 15_000 });
      const second = (await page.locator('section.readiness').textContent()) ?? '';

      expect(second).not.toBe(first);
      expect(second).toContain('attempt 2');
    } finally {
      await page.close();
    }
  }, 30_000);
});


async function loadFlow(
  upTo: string,
  resumeAt: string,
  width = 420,
  /** Runs after the route stub, for a test that needs a different payload. */
  amendPayload?: string,
): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough(upTo), resumeAt));
  if (amendPayload !== undefined) await page.addInitScript(amendPayload);
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('section.video', { timeout: 10_000 });
  await page.selectOption('select[aria-label="Video"]', 'vitasilk');
  await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
  await page.waitForSelector('section.change .opener', { timeout: 10_000 });
  return { page, uncaught };
}

function stubJob(
  state: 'running' | 'done' | 'failed' | 'all-skipped' | 'looking' | 'sidecar-died',
): string {
  const stage = (
    id: string,
    label: string,
    s: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id, label, state: s, reason: null, costUsd: 0,
    cacheEntryId: null, cacheProvenance: null, startedAt: null, finishedAt: null,
    error: null, ...extra,
  });
  const allSkipped = [
    stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'reusing an older guide' }),
    stage('analysis', 'Keywords and image slots', 'skipped', { reason: 'already on the plan' }),
    stage('images', 'Generate images', 'skipped', { reason: 'already on the plan' }),
    stage('zones', 'Looking at the video', 'skipped', { reason: 'already on the plan' }),
  ];
  const looking = [
    stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'already on the plan' }),
    stage('analysis', 'Keywords and image slots', 'skipped', { reason: 'already on the plan' }),
    stage('images', 'Generate images', 'skipped', { reason: 'already on the plan' }),
    stage('zones', 'Looking at the video', 'running', {
      detail: 'Finding you in the picture — frame 24 of 53',
    }),
  ];
  const stages =
    state === 'looking'
    ? looking
    : state === 'all-skipped'
    ? allSkipped
    : state === 'running'
      ? [
          stage('transcription', 'Transcribe and correct', 'skipped', {
            reason: 'reusing an older guide',
            cacheProvenance: 'compatible',
            cacheEntryId: 'transcription-758a3924d090d1b5',
          }),
          stage('analysis', 'Keywords and image slots', 'running'),
          stage('images', 'Generate images', 'waiting'),
          stage('zones', 'Looking at the video', 'waiting'),
        ]
      : state === 'sidecar-died'
        ? [
            stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'already on the plan' }),
            stage('analysis', 'Keywords and image slots', 'skipped', { reason: 'already on the plan' }),
            stage('images', 'Generate images', 'skipped', { reason: 'already on the plan' }),
            stage('zones', 'Looking at the video', 'failed', {
              error: {
                stage: 'zones',
                cause:
                  'the picture tools stopped during segment_person — it was killed by SIGABRT, ' +
                  'and wrote nothing',
                retryable: false,
              },
            }),
          ]
      : state === 'failed'
        ? [
            stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'already on the plan' }),
            stage('analysis', 'Keywords and image slots', 'failed', {
              error: {
                stage: 'analysis',
                cause: 'the model returned 503 Service Unavailable',
                retryable: true,
              },
            }),
            stage('images', 'Generate images', 'waiting'),
            stage('zones', 'Looking at the video', 'waiting'),
          ]
        : [
            stage('transcription', 'Transcribe and correct', 'skipped', { reason: 'reusing an older guide' }),
            stage('analysis', 'Keywords and image slots', 'done', { costUsd: 0.1835 }),
            stage('images', 'Generate images', 'skipped', { reason: 'no image slots on the plan' }),
            stage('zones', 'Looking at the video', 'skipped', { reason: 'already on the plan' }),
          ];
  const detail = {
    reel: 'vitasilk', modeId: 'k2-syndicalia', planPath: '/v/p.json', stages,
    percent: state === 'done' ? 1 : 0.25,
    spentUsd: state === 'done' ? 0.1835 : 0,
    planSpentUsd: 1.550444,
    done: state !== 'running' && state !== 'looking',
    error:
      state === 'failed'
        ? (stages[1]?.['error'] ?? null)
        : state === 'sidecar-died'
          ? (stages[3]?.['error'] ?? null)
          : null,
  };
  const status =
    state === 'running' || state === 'looking'
      ? 'running'
      : state === 'failed' || state === 'sidecar-died'
        ? 'error'
        : 'done';
  return `window.__job = () => (${JSON.stringify({
    id: 'job-1',
    status,
    progress: detail.percent,
    detail,
  })});`;
}

const VITASILK_DRY_STAGES = [
  {
    id: 'transcription',
    label: 'Transcribe and correct',
    status: 'done',
    provenance: 'compatible',
    entryId: 'transcription-758a3924d090d1b5',
    estimateUsd: null,
    action: 'skip',
    note: 'reusing an older guide. Already on the plan, so a run skips it',
  },
  {
    id: 'analysis',
    label: 'Keywords and image slots',
    status: 'done',
    provenance: 'none',
    entryId: null,
    estimateUsd: null,
    action: 'skip',
    note: 'a run would call the model and bill. Already on the plan, so a run skips it',
  },
  {
    id: 'images',
    label: 'Generate images',
    status: 'done',
    provenance: 'exact',
    entryId: null,
    estimateUsd: null,
    action: 'skip',
    note: '10 of 10 candidate images are cached. Already on the plan, so a run skips it',
  },
  {
    id: 'zones',
    label: 'Looking at the video',
    status: 'done',
    provenance: null,
    entryId: null,
    estimateUsd: null,
    action: 'skip',
    note: 'local computer vision. Already on the plan, so a run skips it',
  },
];

/*
 * Real files, and that is load-bearing.
 *
 * `Images.tsx` removes the picture from the DOM when the browser fails to load
 * it — `onError` sets `unreadable` and the "could not display it" sentence
 * replaces the `img`. Fixtures pointing at `/v/…`, which is nowhere, therefore
 * raced that removal: the assertions passed only when they ran before the error
 * arrived, and on an idle machine two runs in three failed. These are files
 * that exist, so the error never fires and the ready branch is what is under
 * test. The path has spaces in it, which is also the real case.
 */
/**
 * The pictures come off `vitasilk`'s own Edit Plan, and are not written down
 * here at all.
 *
 * **Three fixture paths were hard-coded and none of them existed.** They named
 * `cutouts/img001-c1.cutout.png`, and Block 10 session 35 moved every cutout
 * into a per-reel folder — `cutouts/vitasilk/…` — so every one of them had been
 * missing for months. The comment above them said *"These are files that exist,
 * so the error never fires"*, which had stopped being true.
 *
 * Reading the plan removes the whole class: the plan is what the pipeline
 * writes, its candidate paths are what the builder places, and a generated
 * picture lives under the **video's sha256** the way `video-identity.ts`
 * decides. If those move again, this follows them, and if the plan is missing a
 * file the tests say so instead of racing an error handler.
 */
const CORPUS_PLAN = path.join(REPO, 'my files', 'test videos', 'vitasilk.editplan.json');

interface PlanCandidate {
  id: string;
  path: string;
  cutoutPath?: string | null;
}

function planSlots(): { id: string; presentation: string | null; candidates: PlanCandidate[] }[] {
  const plan = JSON.parse(readFileSync(CORPUS_PLAN, 'utf8')) as {
    images: { slots: { id: string; presentation: string | null; candidates: PlanCandidate[] }[] };
  };
  return plan.images.slots;
}

/**
 * A picture the plan names and the disk really holds.
 *
 * A fixture that names a file which is not there is the defect this replaces,
 * so it is refused loudly here rather than discovered as a flake later.
 */
function realFile(what: string, file: string | null | undefined): string {
  if (typeof file !== 'string' || file === '' || !existsSync(file)) {
    throw new Error(`${what}: the corpus plan names ${String(file)}, which is not on disk`);
  }
  return file;
}

const CARD_SLOT = planSlots()[0] as { id: string; candidates: PlanCandidate[] };
const CUTOUT_SLOT = planSlots()[1] as { id: string; candidates: PlanCandidate[] };

/** The generated picture, under the video's own sha256. Not a cutout. */
const REAL_C1 = realFile('img001-c1 generated', CARD_SLOT.candidates[0]?.path);
const REAL_C2 = realFile('img001-c2 generated', CARD_SLOT.candidates[1]?.path);
/** The cut-out of it, in this reel's own cutout folder. A different file. */
const REAL_C1_CUTOUT = realFile('img001-c1 cutout', CARD_SLOT.candidates[0]?.cutoutPath);
const REAL_CUT = realFile('img002-c1 cutout', CUTOUT_SLOT.candidates[0]?.cutoutPath);
const REAL_CUT_SOURCE = realFile('img002-c1 generated', CUTOUT_SLOT.candidates[0]?.path);

const urlOf = (p: string): string =>
  `file://${p.split('/').map(encodeURIComponent).join('/')}`;

/**
 * Every picture on screen has finished trying to load.
 *
 * **This is what removes the race, and it is a condition rather than a wait.**
 * The panel renders `<img class="shot built">` immediately and replaces it with
 * a sentence if the file will not load — so a test that read the DOM before the
 * browser had finished trying saw the image, and one that read after saw the
 * sentence. Both happened: the picker tests failed intermittently through
 * sessions 54 and 55, and the outcome could be flipped either way by pausing
 * before the read.
 *
 * Waiting for `complete` on every picture makes the answer the same whichever
 * side would have won.
 */
async function picturesSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('img.shot')].every((el) => (el as HTMLImageElement).complete),
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * What is on screen, as values.
 *
 * `loaded` is the thing that matters and the thing the old assertions could not
 * see: they compared `src` against a string built from the same constant, so
 * they passed whatever the file did — proved by pointing the fixtures at a
 * folder that does not exist and watching all fifteen stay green.
 *
 * Extracted rather than handed back as handles: session 54 lost a run to
 * vitest serialising a live Playwright `ElementHandle` into a failure diff and
 * exhausting the heap.
 */
async function shotsOnScreen(page: Page): Promise<{ src: string; loaded: boolean }[]> {
  return await page.$$eval('img.shot.built', (els) =>
    els.map((el) => {
      const img = el as HTMLImageElement;
      return {
        src: img.getAttribute('src') ?? '',
        loaded: img.complete && img.naturalWidth > 0,
      };
    }),
  );
}

const IMAGES = {
  reel: 'vitasilk',
  planPath: '/v/vitasilk.editplan.json',
  generationEstimateUsd: 1.45,
  generationNote: 'a run would generate 8, budgeted at most $1.45',
  reelSpentUsd: 1.550444,
  cardFrameForced: true,
  source: {
    clientMode: 'k2-syndicalia',
    clientModeVersion: 5,
    stageStatus: 'done',
    cacheEntryId: 'images-699c0a38a9c512ff',
    cacheProvenance: 'exact',
  },
  slots: [
    {
      id: 'img001',
      start: 0.099,
      end: 1.599,
      idea: 'A single cosmetic bottle on a dark podium',
      presentation: 'card',
      rendersAsCutout: false,
      nothingIsMeasured: true,
      templateId: 'img_float',
      zoneId: 'z_left_4',
      chosenCandidateId: null,
      overriddenFailures: [],
      placedSidePx: 912,
      placementLimit: 'the space above the speaker',
      buildsWith: 'img001-c1',
      buildsWithReason: 'first candidate, nothing chosen',
      candidates: [
        {
          id: 'img001-c1',
          /*
           * Three roles, three different files, which is how the plan really
           * holds them. They were all the same `.cutout.png` before, so the
           * test named "shows the picture the build will place, not the cut-out
           * of it" could not tell the two apart at all.
           */
          imagePath: REAL_C1,
          imageExists: true,
          cutoutPath: REAL_C1_CUTOUT,
          cutoutExists: true,
          renderedPath: REAL_C1,
          renderedExists: true,
          modelId: 'gemini-3-pro-image',
          resolution: '2K',
          generatedAt: '2026-08-25T17:43:32.870Z',
          costUsd: 0,
          metrics: { alphaEdgeNoise: 0, holeRatio: 0, foregroundArea: 0.3178, edgeHalo: 0.1004 },
          cutoutQuality: 0,
          qualityApplies: false,
          backgroundCameAwayCleanly: null,
          problems: [],
          gatePassed: false,
          gateFailures: ['edge_halo 0.1004 > 0.1'],
          unexpectedText: [],
          chosen: false,
        },
        {
          id: 'img001-c2',
          imagePath: REAL_C2,
          imageExists: true,
          cutoutPath: null,
          cutoutExists: false,
          renderedPath: REAL_C2,
          renderedExists: true,
          modelId: 'gemini-3-pro-image',
          resolution: '2K',
          generatedAt: '2026-08-25T17:44:02.870Z',
          costUsd: 0,
          metrics: { alphaEdgeNoise: 0, holeRatio: 0, foregroundArea: 0.31, edgeHalo: 0.1187 },
          cutoutQuality: 0,
          qualityApplies: false,
          backgroundCameAwayCleanly: null,
          problems: [],
          gatePassed: false,
          gateFailures: ['edge_halo 0.1187 > 0.1'],
          unexpectedText: ['SERUM'],
          chosen: false,
        },
      ],
    },
    {
      id: 'img002',
      start: 6.259,
      end: 8.859,
      idea: 'A salon interior',
      presentation: 'cutout',
      rendersAsCutout: true,
      nothingIsMeasured: false,
      templateId: 'img_slide_left',
      zoneId: 'z_left_2',
      chosenCandidateId: null,
      overriddenFailures: [],
      buildsWith: 'img002-c1',
      buildsWithReason: 'first candidate, nothing chosen',
      candidates: [
        {
          id: 'img002-c1',
          // A cutout slot: the build places the cut-out, and the picture it was
          // cut from is offered beside it. Two files, as on the plan.
          imagePath: REAL_CUT_SOURCE,
          imageExists: true,
          cutoutPath: REAL_CUT,
          cutoutExists: true,
          renderedPath: REAL_CUT,
          renderedExists: true,
          modelId: 'gemini-3-pro-image',
          resolution: '2K',
          generatedAt: '2026-08-25T17:45:02.870Z',
          costUsd: 0,
          metrics: { alphaEdgeNoise: 0, holeRatio: 0, foregroundArea: 0.2, edgeHalo: 0.08 },
          cutoutQuality: 0.174,
          qualityApplies: true,
          backgroundCameAwayCleanly: true,
          problems: [],
          gatePassed: true,
          gateFailures: [],
          unexpectedText: [],
          chosen: false,
        },
      ],
    },
    {
      id: 'img003',
      start: 11.6,
      end: 13.9,
      idea: 'A close-up of hair',
      presentation: null,
      rendersAsCutout: false,
      nothingIsMeasured: true,
      templateId: null,
      zoneId: null,
      chosenCandidateId: null,
      overriddenFailures: [],
      buildsWith: null,
      buildsWithReason: 'no candidates',
      candidates: [],
    },
  ],
};

async function loadImages(payload: unknown = IMAGES): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
  await page.addInitScript(`
    window.__images = ${JSON.stringify(payload)};
    const realFetch = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      if (u.indexOf('/images/choose') !== -1) {
        const body = JSON.parse(init.body);
        window.__images = Object.assign({}, window.__images, {
          slots: window.__images.slots.map((s) => {
            if (s.id !== body.slotId) return s;
            const picked = s.candidates.find((c) => c.id === body.candidateId) || null;
            return Object.assign({}, s, {
              chosenCandidateId: body.candidateId,
              buildsWith: body.candidateId || (s.candidates[0] && s.candidates[0].id) || null,
              buildsWithReason: body.candidateId ? 'chosen' : 'first candidate, nothing chosen',
              overriddenFailures:
                picked && picked.gatePassed === false ? picked.gateFailures : [],
              candidates: s.candidates.map((c) =>
                Object.assign({}, c, { chosen: c.id === body.candidateId }),
              ),
            });
          }),
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
  await page.click('section.change .opener:nth-child(3)');
  await page.waitForSelector('main.editor', { timeout: 5000 });
  return { page, uncaught };
}

/** Distinct left edges among the top-level sections: 1 means one column. */
async function columnCount(page: Page): Promise<number> {
  return await page.evaluate(
    () =>
      new Set(
        [...document.querySelectorAll('main > section')].map((sec) =>
          Math.round(sec.getBoundingClientRect().left),
        ),
      ).size,
  );
}

/** Anything scrolling sideways, which a docked panel can least afford. */
async function overflowing(page: Page): Promise<string[]> {
  return await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.tagName}.${el.className}`),
  );
}

/*
 * One column, at every width.
 *
 * The two-column layout above 830px is retired (2026-08-29, user ruling): the
 * screen is short enough now not to need it, and a docked panel is a column —
 * reading down beats reading across two. What still has to hold at every width
 * is that nothing overflows sideways.
 */
describe.skipIf(!built)('the layout', () => {
  it('is one column and never overflows, from docked to full screen', async () => {
    for (const width of [380, 420, 700, 830, 1200, 1920]) {
      const loaded = await load({
        files: { ...HANDSHAKE, ...SERVICE_BUILT },
        fetch: 'healthy',
        width,
      });
      if (loaded === null) return;
      const { page } = loaded;
      try {
        await page.waitForSelector('.dot.healthy', { timeout: 15_000 });
        expect(await columnCount(page), `at ${width}px`).toBe(1);
        expect(await overflowing(page), `at ${width}px`).toEqual([]);
      } finally {
        await page.close();
      }
    }
  }, 120_000);

  it('carries no width class of its own any more', async () => {
    const loaded = await load({ files: HANDSHAKE, fetch: 'healthy', width: 1200 });
    if (loaded === null) return;
    try {
      expect(await loaded.page.locator('.app.wide').count()).toBe(0);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/**
 * A finished run changes what can be edited, and the main screen has to notice
 * without a reload. It used to be a locked step in a rail; it is an opener now.
 */
describe.skipIf(!built)('after a run', () => {
  it('enables an editor the finished run made available', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    try {
      await page.addInitScript(stubHost(HANDSHAKE));
      await page.addInitScript(stubRoutes(stepsThrough('reel'), 'reel'));
      await page.addInitScript(stubJob('done'));
      await page.goto(`file://${INDEX}`);
      await page.waitForSelector('section.video', { timeout: 10_000 });
      await page.selectOption('select[aria-label="Video"]', 'vitasilk');
      await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
      await page.waitForSelector('section.change .opener', { timeout: 10_000 });

      const before = await page.$$eval('section.change .opener', (els) =>
        els.map((e) => (e as HTMLButtonElement).disabled),
      );
      expect(before).toEqual([true, true, true]);


      // The run finishes and the panel re-reads what the video now supports.
      await page.evaluate(`
        window.__payload.steps.steps = window.__payload.steps.steps.map(function (s) {
          return Object.assign({}, s, { available: true, reason: null });
        });
      `);
      await page.click('button.run');
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('section.change .opener')].every(
            (e) => !(e as HTMLButtonElement).disabled,
          ),
        undefined,
        { timeout: 10_000 },
      );
    } finally {
      await page.close();
    }
  }, 30_000);
});

const TRANSCRIPT = {
  reel: 'vitasilk',
  planPath: '/v/p.json',
  transcriptHash: 'abc123',
  editCost: 'Editing a word changes the transcript hash, so the caches will miss.',
  words: [
    {
      id: 'w0000', text: 'filler', sourceText: 'filler', start: 0.1, end: 0.4,
      script: 'latin', lang: 'fr', confidence: 0.95, removed: false, removedReason: null,
      edited: false, cardId: 'g001', interpolated: false,
    },
    {
      id: 'w0001', text: 'ترطيب', sourceText: 'ترطيب', start: 0.5, end: 0.8,
      script: 'arabic', lang: 'msa', confidence: 0.62, removed: false, removedReason: null,
      edited: false, cardId: 'g002', interpolated: false,
    },
    {
      id: 'w0002', text: '26', sourceText: null, start: 1.0, end: 1.0,
      script: 'latin', lang: 'darija', confidence: null, removed: false, removedReason: null,
      edited: false, cardId: 'g003', interpolated: true,
    },
    {
      id: 'w0003', text: 'euh', sourceText: 'euh', start: 1.2, end: 1.3,
      script: 'latin', lang: 'fr', confidence: 0.4, removed: true, removedReason: 'filler',
      edited: false, cardId: null, interpolated: false,
    },
  ],
  cards: [
    { id: 'g001', wordIds: ['w0000'], start: 0.1, end: 0.4, displayStart: 0.1, displayEnd: 0.5, templateId: 'sub_pop', supersededBy: null, holdClipped: false, shortByS: null },
    { id: 'g002', wordIds: ['w0001'], start: 0.5, end: 0.8, displayStart: 0.5, displayEnd: 0.9, templateId: 'sub_pop_ar', supersededBy: null, holdClipped: true, shortByS: 0.07 },
    { id: 'g003', wordIds: ['w0002'], start: 1.0, end: 1.0, displayStart: 1.0, displayEnd: 1.2, templateId: 'sub_pop', supersededBy: null, holdClipped: false, shortByS: null },
  ],
  questions: [
    {
      id: 'overlong', label: 'Words too long for their card',
      question: 'Shrink, break, or overflow?', basis: 'A proxy for a width measured in After Effects.',
      proxy: true, wordIds: ['w0001'], count: 1, corpusCount: 7,
      instances: [{ wordIds: ['w0001'], text: 'ترطيب', detail: '11 characters against a 11-character threshold, in card g002.' }],
    },
    {
      id: 'clipped', label: 'Cards whose hold is clipped',
      question: 'Accept, lengthen, or merge?', basis: "From the plan's timings.",
      proxy: false, wordIds: ['w0001'], count: 1, corpusCount: 23,
      instances: [{ wordIds: ['w0001'], text: 'ترطيب', detail: '0.05s long but sub_pop needs 0.12s (intro 0.13 + hold 0.1 + outro 0) (short by 0.07s)' }],
    },
    {
      id: 'split-term', label: 'Arabic terms split across cards',
      question: 'Group whole, or accept?', basis: 'Consecutive Arabic words.',
      proxy: false, wordIds: [], count: 0, corpusCount: 13, instances: [],
    },
  ],
};

describe.skipIf(!built)('the transcript editor', () => {
  async function loadTranscript(): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      window.__transcript = ${JSON.stringify(TRANSCRIPT)};
      const realFetch = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url);
        if (u.indexOf('/transcript/word') !== -1) {
          const body = JSON.parse(init.body);
          const word = window.__transcript.words.find((w) => w.id === body.wordId);
          const next = Object.assign({}, word, { edited: true },
            body.text === undefined ? {} : { text: body.text },
            body.script === undefined ? {} : { script: body.script },
            body.restore ? { removed: false, removedReason: null } : {});
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ word: next, hash: 'def456' }) });
        }
        if (u.indexOf('/transcript') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__transcript) });
        }
        return realFetch(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await page.click('section.change .opener:nth-child(1)');
    /*
     * The screen opens on Read since session 31 — a word-a-row list is what
     * editing needs and is not reading, and the words are what an orthography
     * is judged on. These tests are about the editor, so they ask for it.
     */
    await page.waitForSelector('.readtoggle', { timeout: 5000 });
    await page.click('.readtoggle button:nth-child(2)');
    await page.waitForSelector('ol.words li', { timeout: 5000 });
    return { page, uncaught };
  }

  /*
   * The words are the only judge of session 29's orthography reversal — the
   * four hand-written references are in the old Latin style and cannot score a
   * run under the new rules — so the screen has to be readable before it is
   * editable.
   */
  it('opens on something a person can read, with the times', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 460, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      window.__transcript = ${JSON.stringify(TRANSCRIPT)};
      // Two Arabic words out of three, so the line itself runs right to left.
      window.__transcript.words[2].text = 'عميق';
      window.__transcript.words[2].script = 'arabic';
      const realFetch = window.fetch;
      window.fetch = (url, init) => {
        if (String(url).indexOf('/transcript') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__transcript) });
        }
        return realFetch(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await page.click('section.change .opener:nth-child(1)');
    try {
      await page.waitForSelector('.readview .readline', { timeout: 5000 });
      // Reading first: the editor's word-a-row list is not on screen yet.
      expect(await page.$('ol.words li')).toBeNull();
      const text = (await page.textContent('.readview')) ?? '';
      expect(text).toContain('filler');
      expect(text).toContain('ترطيب');
      expect(text).toContain('0:00');
      // A filler the build will not draw is not part of what he is reading.
      expect(text).not.toContain('euh');
      expect(await page.$eval('.readline', (e) => e.getAttribute('dir'))).toBe('rtl');
      // Each word still carries its own, so the Latin one reads correctly.
      const dirs = await page.$$eval('.readline span:not(.at)', (els) =>
        els.map((e) => e.getAttribute('dir')),
      );
      expect(dirs).toEqual(['ltr', 'rtl', 'rtl']);
      expect(uncaught).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('shows every word with its interval', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    expect(await loaded.page.$$eval('ol.words li', (els) => els.length)).toBe(4);
    expect((await loaded.page.textContent('ol.words')) ?? '').toContain('0.100–0.400s');
    await loaded.page.close();
  });

  /*
   * The direction is set on the token, never the line. A container `dir` would
   * reorder the Latin words around an Arabic one, which is the failure the
   * per-token rule exists to prevent.
   */
  it('sets direction per token, not on the row or the list', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const dirs = await loaded.page.evaluate(() => {
      const read = (sel: string): string | null =>
        document.querySelector(sel)?.getAttribute('dir') ?? null;
      const words = [...document.querySelectorAll('ol.words li')];
      return {
        list: read('ol.words'),
        row: words[0]?.getAttribute('dir') ?? null,
        latin: words[0]?.querySelector('.wtext')?.getAttribute('dir') ?? null,
        arabic: words[1]?.querySelector('.wtext')?.getAttribute('dir') ?? null,
      };
    });
    expect(dirs.list).toBeNull();
    expect(dirs.row).toBeNull();
    expect(dirs.latin).toBe('ltr');
    expect(dirs.arabic).toBe('rtl');
    await loaded.page.close();
  });

  it('marks an interpolated word and shows the draft token for an anchored one', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('ol.words')) ?? '';
    expect(text).toContain('interpolated');
    expect(text).toContain('ترطيب');
    await loaded.page.close();
  });

  it('bands confidence without using the brand accent', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const bands = await loaded.page.evaluate(() => {
      const norm = (c: string): string => c.replace(/\s/g, '');
      return [...document.querySelectorAll('ol.words .wtext')].map((el) => ({
        cls: [...el.classList].find((c) => c.startsWith('conf-')) ?? null,
        border: norm(getComputedStyle(el).borderBottomColor),
      }));
    });
    expect(bands.map((b) => b.cls)).toEqual(['conf-high', 'conf-low', 'conf-none', 'conf-low']);
    for (const band of bands) expect(band.border).not.toBe('rgb(237,28,36)');
    await loaded.page.close();
  });

  it('shows a removed word struck through with its reason, and restores it', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const struck = await loaded.page.evaluate(() => {
      const li = document.querySelectorAll('ol.words li')[3] as HTMLElement;
      const word = li.querySelector('.wtext') as HTMLElement;
      return { text: li.textContent, decoration: getComputedStyle(word).textDecorationLine };
    });
    expect(struck.decoration).toContain('line-through');
    expect(struck.text).toContain('filler');

    await loaded.page.click('ol.words li:nth-child(4) button.chip');
    await loaded.page.waitForFunction(
      () => (document.querySelectorAll('ol.words li')[3] as HTMLElement).className.includes('removed') === false,
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  it('edits a word and marks it edited', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    await loaded.page.click('ol.words li:nth-child(1) button.wtext');
    await loaded.page.fill('input.wtext', 'remplissage');
    await loaded.page.keyboard.press('Enter');
    await loaded.page.waitForFunction(
      () => (document.querySelector('ol.words') as HTMLElement).textContent?.includes('remplissage') === true,
      undefined,
      { timeout: 5000 },
    );
    expect((await loaded.page.textContent('ol.words')) ?? '').toContain('edited');
    await loaded.page.close();
  });

  /* Said before he types, not discovered on the next bill. */
  it('warns what an edit costs before anything is edited', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    expect((await loaded.page.textContent('main')) ?? '').toContain(
      'changes the transcript hash',
    );
    await loaded.page.close();
  });

  /*
   * The screen read 1, 5 and 0 for vitasilk while the record said 7, 23 and 13.
   * Both were right — one per reel, one over the corpus — and the button said
   * neither. It says both now.
   */
  it('names the scope of every count, and marks a proxy as one', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('ul.questions')) ?? '';
    expect(text).toContain('1 this reel');
    expect(text).toContain('7 corpus');
    expect(text).toContain('23 corpus');
    expect(text).toContain('13 corpus');
    // Only the overlong count stands in for a measurement it cannot take.
    expect((text.match(/proxy/g) ?? []).length).toBe(1);
    await loaded.page.close();
  });

  it('shows the evidence behind an instance, not only its category', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    await loaded.page.click('ul.questions li:nth-child(2) button.chip');
    await loaded.page.waitForSelector('ul.instances li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ul.instances')) ?? '';
    expect(text).toContain('0.05s long but sub_pop needs 0.12s');
    expect(text).toContain('short by 0.07s');
    await loaded.page.close();
  });

  it('says plainly when a question has none on this reel', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    await loaded.page.click('ul.questions li:nth-child(3) button.chip');
    await loaded.page.waitForFunction(
      () => (document.querySelector('ul.questions') as HTMLElement).textContent?.includes('None on this reel') === true,
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  it('shows the three questions with their counts, and filters to the words', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('ul.questions')) ?? '';
    expect(text).toContain('Words too long for their card');
    expect(text).toContain('Cards whose hold is clipped');
    expect(text).toContain('Arabic terms split across cards');

    await loaded.page.click('ul.questions li:nth-child(1) button.chip');
    await loaded.page.waitForFunction(
      () => document.querySelectorAll('ol.words li').length === 1,
      undefined,
      { timeout: 5000 },
    );
    expect((await loaded.page.textContent('ol.words')) ?? '').toContain('ترطيب');
    // The question is asked, not answered.
    expect((await loaded.page.textContent('ul.questions')) ?? '').toContain('?');
    await loaded.page.close();
  });

  /*
   * The script toggle. Neither hash covers `script`, so this edit is free where
   * a text edit costs — and the pane says which is which, because a free edit
   * and a paid one must not look alike.
   */
  it('flips a word’s script and its direction with it', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const before = await loaded.page.getAttribute('ol.words li:nth-child(1) .wtext', 'dir');
    expect(before).toBe('ltr');

    await loaded.page.click('ol.words li:nth-child(1) button[aria-label="Script of w0000"]');
    await loaded.page.waitForFunction(
      () =>
        document.querySelector('ol.words li:nth-child(1) .wtext')?.getAttribute('dir') === 'rtl',
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  it('says what flipping the script does, and that it is free', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('Inter Semi-Bold for Latin');
    expect(text).toContain('Almarai Bold at 1.07');
    expect(text).toContain('costs nothing on a re-run');
    await loaded.page.close();
  });

  it('renders with no uncaught errors', async () => {
    const loaded = await loadTranscript();
    if (loaded === null) return;
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });
});

/**
 * Step 3, over the built bundle. The service half is tested against the real
 * plans in `service/src/keyword-view.test.ts`; this drives the panel.
 */
const KEYWORDS = {
  reel: 'vitasilk',
  planPath: '/v/p.json',
  subtitleFontSize: 343,
  keywordFontSize: 425,
  emptyReason: null,
  source: {
    stageStatus: 'done',
    cacheEntryId: 'analysis-324f3a034ef9c903',
    cacheProvenance: 'exact',
    promptVersion: 4,
    mode: 'auto',
  },
  keywords: [
    {
      id: 'k001', wordIds: ['w0021'], text: 'filler glow', cardId: 'g022',
      start: 6.98, end: 7.579, reason: 'names the specific product being promoted',
      score: 0.95, kind: 'label', script: 'latin', templateId: 'kw_slam',
      fontSize: 425, edited: false,
    },
    {
      id: 'k002', wordIds: ['w0030'], text: 'ترطيب', cardId: 'g031',
      start: 9.1, end: 9.6, reason: '', score: 1, kind: null, script: 'arabic',
      templateId: 'kw_slam_ar', fontSize: 425, edited: true,
    },
  ],
  promotable: [
    { wordId: 'w0000', text: '5', cardId: 'g001', script: 'latin', start: 0.1, end: 0.4 },
    { wordId: 'w0001', text: 'd9ay9', cardId: 'g002', script: 'latin', start: 0.5, end: 0.9 },
  ],
};

describe.skipIf(!built)('the keyword picker', () => {
  async function loadKeywords(payload: unknown = KEYWORDS): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      window.__keywords = ${JSON.stringify(payload)};
      const realFetch = window.fetch;
      window.fetch = (url, init) => {
        const u = String(url);
        if (u.indexOf('/keywords/remove') !== -1) {
          const body = JSON.parse(init.body);
          window.__keywords = Object.assign({}, window.__keywords, {
            keywords: window.__keywords.keywords.filter((k) => k.id !== body.keywordId),
          });
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__keywords) });
        }
        if (u.indexOf('/keywords/add') !== -1) {
          const body = JSON.parse(init.body);
          const word = window.__keywords.promotable.find((w) => w.wordId === body.wordId);
          const added = {
            id: 'k900', wordIds: [word.wordId], text: word.text, cardId: word.cardId,
            start: word.start, end: word.end, reason: '', score: 1, kind: null,
            script: word.script, templateId: 'kw_slam', fontSize: 425, edited: true,
          };
          window.__keywords = Object.assign({}, window.__keywords, {
            keywords: window.__keywords.keywords.concat([added]),
            promotable: window.__keywords.promotable.filter((w) => w.wordId !== body.wordId),
          });
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__keywords) });
        }
        if (u.indexOf('/keywords') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__keywords) });
        }
        return realFetch(url, init);
      };
    `);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await page.click('section.change .opener:nth-child(2)');
    await page.waitForSelector('main h2', { timeout: 5000 });
    return { page, uncaught };
  }

  it('shows each keyword with when it plays and how big it is drawn', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.keywords')) ?? '';
    expect(text).toContain('filler glow');
    expect(text).toContain('425 px');
    expect(text).toContain('names the specific product being promoted');
    // Names from the code: the keyword's id, the card's, and the template's.
    expect(text).not.toContain('k001');
    expect(text).not.toContain('g022');
    expect(text).not.toContain('kw_slam');
    await loaded.page.close();
  });

  /*
   * The user removed the hits in Block 8 session 27. The picker showed the
   * binding and, when there was none, said why — both are gone, because a
   * keyword now has no sound to have or to lack.
   */
  it('says nothing about sound, in either direction', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.keywords')) ?? '';
    expect(text).not.toContain('sfx');
    expect(text).not.toContain('hit_01');
    expect(text).not.toContain('dB');
    expect(await loaded.page.$$('ol.keywords button[aria-label^="Play"]')).toHaveLength(0);
    await loaded.page.close();
  });

  /*
   * Direction follows the script, per token. The template variant follows it
   * too, but `kw_slam_ar` was a name from the library on screen — the script it
   * stands for is what he can see, so that is what the row says now.
   */
  it('sets direction per keyword and names the script in words', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    const dirs = await loaded.page.$$eval('ol.keywords .ktext', (els) =>
      els.map((e) => e.getAttribute('dir')),
    );
    expect(dirs).toEqual(['ltr', 'rtl']);
    const text = (await loaded.page.textContent('ol.keywords')) ?? '';
    expect(text).toContain('Arabic');
    expect(text).toContain('Latin');
    expect(text).not.toContain('kw_slam_ar');
    await loaded.page.close();
  });

  it('says a hand-promoted keyword had no reason from the analysis', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    expect((await loaded.page.textContent('ol.keywords')) ?? '').toContain('promoted by hand');
    await loaded.page.close();
  });

  /*
   * It used to print the cache entry id and `cacheProvenance` beside an
   * analysis prompt version — five facts, four of them names from the code, and
   * the user had to ask what they meant. None of them changes what he can do
   * here; whether these were chosen for him or are waiting on him does.
   */
  it('says whether these were chosen for him, in words and not in ids', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('Chosen for you');
    expect(text).not.toContain('analysis-324f3a034ef9c903');
    expect(text).not.toContain('cacheProvenance');
    expect(text).not.toContain('prompt v');
    await loaded.page.close();
  });

  it('removes a keyword', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    await loaded.page.click('button[aria-label="Remove k001"]');
    await loaded.page.waitForFunction(
      () => document.querySelectorAll('ol.keywords li').length === 1,
      undefined,
      { timeout: 5000 },
    );
    expect((await loaded.page.textContent('ol.keywords')) ?? '').not.toContain('filler glow');
    await loaded.page.close();
  });

  it('promotes a word to a keyword', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    await loaded.page.click('button.chip:text("Emphasise another word")');
    await loaded.page.click('button[aria-label="Emphasise w0000"]');
    await loaded.page.waitForFunction(
      () => document.querySelectorAll('ol.keywords li').length === 3,
      undefined,
      { timeout: 5000 },
    );
    await loaded.page.close();
  });

  /*
   * A reel with no keywords says **why**. "Analysis has not run" and "analysis
   * ran and chose none" are different facts and an empty list states neither.
   */
  it('says why a reel has no keywords', async () => {
    const loaded = await loadKeywords({
      ...KEYWORDS,
      keywords: [],
      emptyReason: 'Keyword analysis has not run for this reel yet (stage is "pending").',
    });
    if (loaded === null) return;
    await loaded.page.waitForFunction(
      () => (document.querySelector('main') as HTMLElement).textContent?.includes('has not run') === true,
      undefined,
      { timeout: 5000 },
    );
    expect(await loaded.page.$$eval('ol.keywords li', (els) => els.length)).toBe(0);
    await loaded.page.close();
  });

  it('renders with no uncaught errors', async () => {
    const loaded = await loadKeywords();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.keywords li', { timeout: 5000 });
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });
});

describe.skipIf(!built)('focus', () => {
  it('never paints the brand accent on any control it lands on', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;

    const offenders = await loaded.page.evaluate(() => {
      const norm = (c: string): string => c.replace(/\s/g, '');
      const accent = 'rgb(237,28,36)';
      const found: string[] = [];
      const controls = [
        ...document.querySelectorAll('select, button, input, a[href], [tabindex]'),
      ] as HTMLElement[];
      for (const el of controls) {
        el.focus();
        const s = getComputedStyle(el);
        const painted =
          norm(s.borderTopColor) === accent ||
          norm(s.borderBottomColor) === accent ||
          norm(s.borderLeftColor) === accent ||
          norm(s.borderRightColor) === accent ||
          norm(s.outlineColor) === accent ||
          norm(s.color) === accent ||
          norm(s.backgroundColor) === accent;
        // Run pipeline is the one control allowed to be red, focused or not.
        if (painted && !el.classList.contains('run')) {
          found.push(`${el.tagName.toLowerCase()}.${el.className}`);
        }
      }
      return found;
    });

    expect(offenders).toEqual([]);
    await loaded.page.close();
  });

  it('still shows a visible ring, so focus is not simply removed', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    const ring = await loaded.page.evaluate(() => {
      const el = document.querySelector('select[aria-label="Client"]') as HTMLSelectElement;
      const before = getComputedStyle(el).borderTopColor;
      el.focus();
      return { before, after: getComputedStyle(el).borderTopColor };
    });
    expect(ring.after).not.toBe(ring.before);
    await loaded.page.close();
  });
});

describe.skipIf(!built)('the cost block and the run', () => {
  async function loadBoth(): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(
      `window.__payload.dry.stages = ${JSON.stringify(VITASILK_DRY_STAGES)};`,
    );
    await page.addInitScript(stubJob('all-skipped'));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await page.waitForFunction(
      () =>
        (document.querySelector('main') as HTMLElement).textContent?.includes(
          'Keywords and image slots',
        ) === true,
      undefined,
      { timeout: 5000 },
    );
    return { page, uncaught };
  }

  /*
   * The regression. Nothing in the six service tests looked at this string, so
   * all six passed while the panel said "to run" for a stage a run skips.
   */
  it('never says a stage will run when the plan already carries it', async () => {
    const loaded = await loadBoth();
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).not.toContain('to run');
    expect(text).toContain('already done');
    await loaded.page.close();
  });

  /*
   * The stronger form: for every stage, what the cost block says and what the
   * run reports must agree as rendered text — not as two service values that
   * happen to line up.
   */
  it('renders the same verdict in the cost block and in the run', async () => {
    const loaded = await loadBoth();
    if (loaded === null) return;
    await loaded.page.click('button.run');
    await loaded.page.waitForFunction(
      () =>
        document.querySelectorAll('section.cost ul.facts').length >= 1 &&
        document.querySelectorAll('section.do ul.facts').length >= 1,
      undefined,
      { timeout: 5000 },
    );
    const rows = await loaded.page.evaluate(() => {
      const lists = [
        document.querySelector('section.cost ul.facts'),
        document.querySelector('section.do ul.facts'),
      ];
      const read = (ul: Element): Record<string, string> =>
        Object.fromEntries(
          [...ul.querySelectorAll('li')].map((li) => [
            li.querySelector('.k')?.textContent ?? '',
            li.querySelector('.v')?.textContent ?? '',
          ]),
        );
      return { estimate: read(lists[0] as Element), run: read(lists[1] as Element) };
    });

    for (const [label, estimate] of Object.entries(rows.estimate)) {
      const ran = rows.run[label];
      expect(ran, `no run row for "${label}"`).toBeDefined();
      // Both sides were reworded in session 41; the pin is that they agree on
      // whether the stage runs, not on the word they happen to use for it.
      const estimateSkips = estimate.includes('already done') || estimate.includes('free,');
      const runSkips = (ran ?? '').includes('skipped');
      expect(runSkips, `"${label}": estimate said "${estimate}", run said "${ran}"`).toBe(
        estimateSkips,
      );
    }
    await loaded.page.close();
  });
});

describe.skipIf(!built)('a pipeline run', () => {
  async function loadRun(
    state: 'running' | 'done' | 'failed' | 'looking' | 'sidecar-died',
  ): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(stubJob(state));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client"]', 'k2-syndicalia');
    await page.click('button.run');
    await page.waitForFunction(
      () => (document.querySelector('main') as HTMLElement).textContent?.includes('Transcribe and correct') === true,
      undefined,
      { timeout: 5000 },
    );
    return { page, uncaught };
  }

  it('shows every stage with its state, in the dry run’s words', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    for (const label of ['Transcribe and correct', 'Keywords and image slots', 'Generate images', 'Looking at the video']) {
      expect(text, label).toContain(label);
    }
    expect(text).toContain('running…');
    expect(text).toContain('waiting');
    await loaded.page.close();
  });

  /* The first time cacheProvenance reaches the screen from a real run. */
  it('says a stage was skipped and why', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('skipped');
    expect(text).toContain('reusing an older guide');
    await loaded.page.close();
  });

  /*
   * Frame analysis is the one stage that takes minutes, so it is the one that
   * has to say where it has got to. A single "running…" for a stage that sits
   * there for a minute is indistinguishable from one that has hung.
   */
  it('shows how far the long stage has got, in his words', async () => {
    const loaded = await loadRun('looking');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('Looking at the video');
    expect(text).toContain('Finding you in the picture — frame 24 of 53');
    // A field name is not a label, and neither is a word from the codebase.
    expect(text).not.toContain('segmentation');
    expect(text).not.toContain('sidecar');
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });

  it('shows a failed stage’s cause as it came, not a summary', async () => {
    const loaded = await loadRun('failed');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('the model returned 503 Service Unavailable');
    expect(text).toContain('worth trying again');
    await loaded.page.close();
  });

  /*
   * The picture tools crash — onnxruntime's bundled telemetry aborts during
   * static destruction — and until session 32 the exit status was never read:
   * `child.on('close', () => …)` took no arguments. A crash that killed the
   * process before it answered said only "stdout was not JSON", which names the
   * symptom and not the cause.
   */
  it('says how the picture tools died, in words, and sends him nowhere', async () => {
    const loaded = await loadRun('sidecar-died');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('the picture tools stopped during segment_person');
    expect(text).toContain('killed by SIGABRT');
    expect(text).toContain('wrote nothing');
    expect(text).not.toContain('worth trying again');
    // A field name is not a label, and no message sends him out of the panel.
    for (const banned of ['sidecar', 'npm run', 'terminal', 'Quit After Effects', 'restart']) {
      expect(`${banned}: ${String(text.includes(banned))}`).toBe(`${banned}: false`);
    }
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  });

  it('reports what the run billed and what the reel has cost in total', async () => {
    const loaded = await loadRun('done');
    if (loaded === null) return;
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('billed by this run');
    expect(text).toContain('on this video in total');
    await loaded.page.close();
  });

  /*
   * The job lives in the service. Walking to another step and back must not
   * stop it or lose it — the panel is a viewer.
   */
  it('survives opening an editor and coming back', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    await loaded.page.click('section.change .opener:nth-child(2)');
    expect(await loaded.page.textContent('main.editor h2')).toBe('Emphasis');
    await loaded.page.click('button.back');
    await loaded.page.waitForSelector('section.do', { timeout: 5000 });
    const text = (await loaded.page.textContent('main')) ?? '';
    expect(text).toContain('Keywords and image slots');
    expect(text).toContain('running…');
    await loaded.page.close();
  });

  it('will not start a second run while one is going, and says so', async () => {
    const loaded = await loadRun('running');
    if (loaded === null) return;
    const state = await loaded.page.evaluate(() => {
      const el = document.querySelector('button.run') as HTMLButtonElement;
      return { disabled: el.disabled, label: el.textContent };
    });
    expect(state.disabled).toBe(true);
    expect(state.label).toBe('Working…');
    expect((await loaded.page.textContent('main')) ?? '').toContain('continues if you leave');
    await loaded.page.close();
  });
});

describe('the image candidate picker', () => {
  it('shows every candidate, including the ones the gate did not like', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('img001-c1');
    expect(text).toContain('img001-c2');
    expect(await loaded.page.$$('ol.slots li.candidate')).toHaveLength(3);
    await loaded.page.close();
  }, 30_000);

  /*
   * The cutout metrics measure how cleanly a background came away, which is a
   * property of a slot that shows a cut-out subject. Four of `vitasilk`'s five
   * do not, and all eight of the corpus's rejections were of that kind.
   */
  it('judges the background only where the background is removed', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    // The cutout slot's candidate is judged, in words.
    expect(text).toContain('background came away cleanly');
    // The card slots' candidates are not, and their thresholds are not on screen.
    expect(text).not.toContain('edge_halo');
    expect(text).not.toContain('gate rejected');
    expect(text).toContain('Nothing is checked automatically about these pictures');
    await loaded.page.close();
  }, 30_000);

  it('says what the builder would use, and that nothing is chosen yet', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('first candidate, nothing chosen');
    await loaded.page.close();
  }, 30_000);

  it('records choosing a rejected candidate as an override', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    await loaded.page.click('button[aria-label="Choose img001-c1"]');
    await loaded.page.waitForSelector('li.candidate.chosen', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('Overrides the gate: edge_halo 0.1004 > 0.1');
    expect(text).toContain('img001-c1 — chosen');
    await loaded.page.close();
  }, 30_000);

  /*
   * The picker showed a cut-out on grey for every candidate, which on four of
   * `vitasilk`'s five slots is a version of the picture that never gets built.
   * What it shows now is the file the build places.
   */
  it('shows the picture the build will place, not the cut-out of it', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await picturesSettled(loaded.page);
    const built = await shotsOnScreen(loaded.page);

    // Every one of them drew. This is what the old assertion could not see.
    expect(built.filter((shot) => !shot.loaded).map((shot) => shot.src)).toEqual([]);
    expect(built).toHaveLength(3);

    const src = built.map((shot) => shot.src);
    // The card slot places the generated picture; the cutout slot the cut-out.
    expect(src).toContain(urlOf(REAL_C1));
    expect(src).toContain(urlOf(REAL_CUT));
    // And not the cut-out of the card slot's picture, which is a different
    // file and is the thing this test exists to tell apart.
    expect(src).not.toContain(urlOf(REAL_C1_CUTOUT));
    expect(src.filter((one) => one === urlOf(REAL_C1))).toHaveLength(1);
    await loaded.page.close();
  }, 30_000);

  it('says in plain words which slots have their background removed', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('shown with its background removed');
    expect(text).toContain('shown whole, inside a frame');
    await loaded.page.close();
  }, 30_000);

  /* The raw picture is evidence, and only where it differs from the build. */
  it('offers the picture before the background was removed, on a cutout slot only', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await picturesSettled(loaded.page);
    /*
     * Counted, and confirmed to have drawn — and the count is read as a number
     * rather than as a list of handles: session 54 lost a run to vitest
     * serialising a live `ElementHandle` into a failure diff.
     */
    const raw = await loaded.page.$$eval('figure.rawshot img.shot', (els) =>
      els.map((el) => {
        const img = el as HTMLImageElement;
        return { src: img.getAttribute('src') ?? '', loaded: img.complete && img.naturalWidth > 0 };
      }),
    );
    expect(raw).toHaveLength(1);
    expect(raw[0]?.loaded).toBe(true);
    // It is the picture the cut-out was made from, not the cut-out.
    expect(raw[0]?.src).toBe(urlOf(REAL_CUT_SOURCE));
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('before the background was removed');
    await loaded.page.close();
  }, 30_000);

  /*
   * **The session 31 defect, reproduced.** The panel is reloaded from
   * `panel/dist` while the service is a long-running process, so the bundle can
   * be newer than the service it talks to. Against one started before
   * `renderedPath` existed, every candidate read "this picture is missing from
   * the disk" — a claim of data loss about ten files that were all present.
   */
  it('still shows the pictures when the service is older than the panel', async () => {
    const older = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    for (const slot of older.slots) {
      delete (slot as Record<string, unknown>)['rendersAsCutout'];
      delete (slot as Record<string, unknown>)['nothingIsMeasured'];
      for (const candidate of slot.candidates) {
        delete (candidate as Record<string, unknown>)['renderedPath'];
        delete (candidate as Record<string, unknown>)['renderedExists'];
        delete (candidate as Record<string, unknown>)['qualityApplies'];
      }
    }
    const loaded = await loadImages(older);
    if (loaded === null) return;
    await picturesSettled(loaded.page);
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).not.toContain('no longer on the disk');
    expect(text).not.toContain('could not work out which picture');
    const shown = await shotsOnScreen(loaded.page);
    // Three candidates, each falling back to the rule the builder uses, and
    // each actually drawing rather than merely being named.
    expect(shown).toHaveLength(3);
    expect(shown.filter((shot) => !shot.loaded).map((shot) => shot.src)).toEqual([]);
    const src = shown.map((shot) => shot.src);
    expect(src).toContain(urlOf(REAL_C1));
    expect(src).toContain(urlOf(REAL_CUT));
    await loaded.page.close();
  }, 30_000);

  /* A path that is gone and a path the panel was never given are not the same
     fact, and only one of them is about the disk. */
  it('says a picture is gone only when the service says it is gone', async () => {
    const gone = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    (gone.slots[0]?.candidates[0] as Record<string, unknown>)['renderedExists'] = false;
    const loaded = await loadImages(gone);
    if (loaded === null) return;
    await picturesSettled(loaded.page);
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('no longer on the disk');
    const shown = await shotsOnScreen(loaded.page);
    // The other two are still there and still draw; only the one the service
    // called gone is replaced by the sentence.
    expect(shown).toHaveLength(2);
    expect(shown.filter((shot) => !shot.loaded).map((shot) => shot.src)).toEqual([]);
    await loaded.page.close();
  }, 30_000);

  it('blames the tool, not the disk, when it was told no path at all', async () => {
    const bare = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    for (const candidate of bare.slots[0]?.candidates ?? []) {
      const c = candidate as Record<string, unknown>;
      delete c['renderedPath'];
      delete c['renderedExists'];
      c['imagePath'] = '';
      c['cutoutPath'] = null;
    }
    const loaded = await loadImages(bare);
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('could not work out which picture');
    expect(text).not.toContain('no longer on the disk');
    await loaded.page.close();
  }, 30_000);

  /*
   * Every cutout in the corpus lives under `my files/test videos/`, so a space
   * in the path is the normal case rather than an edge one. The fixture already
   * points at a real one, and this asserts the encoding on it.
   */
  it('encodes the spaces in a real path', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await picturesSettled(loaded.page);
    const shown = await shotsOnScreen(loaded.page);
    // A space in the path is the normal case here, not an edge one.
    expect(REAL_CUT).toContain(' ');
    // Named first, so a failure says the picture is not on screen rather than
    // that `undefined` does not contain a substring.
    expect(shown.map((shot) => shot.src)).toContain(urlOf(REAL_CUT));
    const spaced = shown.find((shot) => shot.src === urlOf(REAL_CUT));
    expect(spaced?.src).toContain('%20');
    // Encoded *and* loaded — an escaping mistake shows up as a picture that
    // does not draw, which is the failure a string comparison cannot see.
    expect(spaced?.loaded).toBe(true);
    await loaded.page.close();
  }, 30_000);

  /*
   * Images sit in the top-left corner on every reel, so there is no position to
   * choose. What the picker can honestly say is how big the picture is and what
   * limits it — the number behind "make them bigger".
   */
  /**
   * **Mohamed's ruling of 2026-09-05**, made by eye on Block 11 session 58's
   * contact sheets: a picture enlarged past 200% is warned about, and at or
   * under 200% nothing is said. It warns and continues — refusing would throw
   * away a client's only copy of their own logo.
   */
  it('says a small picture will look soft, and still shows it', async () => {
    const small = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    (small.slots[0] as Record<string, unknown>)['enlargement'] = {
      percent: 500,
      tooEnlarged: true,
    };
    const loaded = await loadImages(small);
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('ol.slots')) ?? '';
      expect(text).toContain('small for the space it fills');
      expect(text).toContain('It is still placed');

      // The warning never replaces the slot: its pictures are still there and
      // still drew. Read as values, never as live handles.
      const shown = await shotsOnScreen(loaded.page);
      expect(shown).toHaveLength(3);
      expect(shown.filter((shot) => !shot.loaded)).toEqual([]);

      // And it sends nobody anywhere. `leave-the-panel.test.ts` governs the
      // product; this is the same rule at the one place it was added.
      for (const word of ['terminal', 'npm run', 'restart', 'command']) {
        expect(`${word}: ${text.toLowerCase().includes(word)}`).toBe(`${word}: false`);
      }
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says nothing about a picture that is big enough', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    try {
      await picturesSettled(loaded.page);
      const text = (await loaded.page.textContent('ol.slots')) ?? '';
      // The fixture's pictures are 2048px in a 1000px box — a reduction, which
      // is what every generated picture is and must never be remarked on.
      expect(text).not.toContain('small for the space it fills');
      expect(await loaded.page.locator('p.reason.soft').count()).toBe(0);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says how big the picture is and what limits it', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('Sits in the top-left corner');
    expect(text).toContain('912 px');
    expect(text).toContain('the space above the speaker');
    // No schema in sight, and no control over a choice nobody makes.
    expect(text).not.toContain('z_left');
    expect(await loaded.page.$$('button[aria-label^="Put img001"]')).toHaveLength(0);
    await loaded.page.close();
  }, 30_000);

  /* A service too old to send the size must not make the panel invent one. */
  it('says nothing about size when the service does not offer it', async () => {
    const older = JSON.parse(JSON.stringify(IMAGES)) as typeof IMAGES;
    for (const slot of older.slots) {
      delete (slot as Record<string, unknown>)['placedSidePx'];
      delete (slot as Record<string, unknown>)['placementLimit'];
    }
    const loaded = await loadImages(older);
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).not.toContain('Sits in the top-left corner');
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  }, 30_000);

  it('says what a slot with nothing generated would cost', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    const text = (await loaded.page.textContent('ol.slots')) ?? '';
    expect(text).toContain('Nothing generated for this slot');
    expect(text).toContain('$1.45');
    await loaded.page.close();
  }, 30_000);

  /* PROJECT_SPEC §6 spends the brand red on Run pipeline alone. */
  it('marks the chosen candidate without the brand accent', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
    await loaded.page.click('button[aria-label="Choose img001-c1"]');
    await loaded.page.waitForSelector('li.candidate.chosen', { timeout: 5000 });
    const colour = await loaded.page.$eval(
      'li.candidate.chosen',
      (el) => getComputedStyle(el).borderColor,
    );
    expect(colour).not.toContain('237, 28, 36');
    expect(loaded.uncaught).toEqual([]);
    await loaded.page.close();
  }, 30_000);
});

/*
 * Three watermark sizes, the user's per-reel choice. Driven through the built
 * bundle because that is the only place a CEP-shaped engine sees them, and
 * because the size arrives from the service — a bundle newer than the service
 * it talks to must not invent a choice.
 */
describe.skipIf(!built)('watermark size', () => {
  it('offers three sizes with the reel’s own marked', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.watermark .sizes', { timeout: 5000 });
      const labels = await loaded.page.$$eval('.watermark .sizes button', (els) =>
        els.map((e) => `${e.textContent ?? ''}|${e.getAttribute('aria-pressed') ?? ''}`),
      );
      expect(labels).toEqual([
        'Small · 216 px|false',
        'Medium · 324 px|true',
        'Large · 432 px|false',
      ]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('moves the mark when another size is pressed', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.watermark .sizes', { timeout: 5000 });
      await loaded.page.click('.watermark .sizes button:nth-child(3)');
      await loaded.page.waitForFunction(
        () =>
          document
            .querySelector('.watermark .sizes button:nth-child(3)')
            ?.getAttribute('aria-pressed') === 'true',
        undefined,
        { timeout: 5000 },
      );
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* A service too old to send the size must not have one invented for it. */
  it('shows no sizes when the service does not offer them', async () => {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      'delete window.__payload.dry.watermarkSize;' +
        'delete window.__payload.dry.watermarkWidthsPx;',
    );
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.watermark', { timeout: 5000 });
      expect(await loaded.page.$$('.watermark .sizes button')).toHaveLength(0);
      expect(await loaded.page.$$('.watermark input[type="checkbox"]')).toHaveLength(1);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * Step 5, the Build control. It drives the After Effects the panel is running
 * inside, so nothing here presses it against a real service — these assert what
 * the pane says before, during and after, which is what the user reads.
 */
function stubBuildJob(state: 'running' | 'done' | 'refused'): string {
  const stages = [
    { id: 'prepare', label: 'Read the plan and resolve everything it names', state: 'done' },
    { id: 'after-effects', label: 'Build the composition in After Effects', state: state === 'running' ? 'running' : 'done' },
    { id: 'check', label: 'Check the built comp against the plan', state: state === 'done' ? 'done' : 'waiting' },
  ];
  const detail = {
    reel: 'vitasilk', planPath: '/v/p.json', stages,
    percent: state === 'done' ? 1 : 0.33,
    done: state === 'done',
    savePath: state === 'done' ? '/repo/.local/build/vitasilk-full.aep' : null,
    savedOwnOutput: state === 'done' ? '/repo/.local/build/vitasilk-full.aep' : null,
    wallS: state === 'done' ? 1.3 : null,
    error: null,
  };
  const job = {
    id: 'job-1',
    status: state === 'running' ? 'running' : state === 'done' ? 'done' : 'error',
    progress: detail.percent,
    detail,
    ...(state === 'refused'
      ? {
          error:
            'build refused at start: the open After Effects project has unsaved changes: ' +
            '/Users/x/mine.aep. This will not close it. Save or close it yourself, then run it again.',
        }
      : {}),
  };
  return `window.__job = () => (${JSON.stringify(job)});`;
}

describe.skipIf(!built)('the Build step', () => {
  async function openBuild(jobState?: 'running' | 'done' | 'refused'): Promise<Loaded | null> {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      jobState === undefined ? undefined : stubBuildJob(jobState),
    );
    if (loaded === null) return null;
    // Build and the main screen are one screen now.
    await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
    return loaded;
  }

  /*
   * A video is built with the client's look as it was when the video was set
   * up, not as the client file stands today. That is only safe if the panel
   * says so — and only useful if there is one control that moves it forward.
   */
  it('says the video keeps the client’s look as it was set up', async () => {
    const loaded = await openBuild();
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('K2 Syndicalia’s look as it was when this video was set up');
      expect(text).toContain('Cormorant Garamond SemiBold Italic');
      // No version numbers on screen: "as it was set up" is the state he picks.
      expect(text).not.toContain('v8');
      expect(text).not.toContain('clientSnapshot');
      // Nothing to update to, so no control offering it.
      expect(await loaded.page.$('.buildpane button.ghost')).toBeNull();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('offers one control when the client has changed since, and never presses it', async () => {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      'window.__payload.steps.build.client.behind = true;',
    );
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('K2 Syndicalia has changed since');
      expect(text).toContain('keeps the older look until you say otherwise');
      const button = await loaded.page.$('.buildpane button.ghost');
      expect(button).not.toBeNull();
      expect(await button?.textContent()).toBe('Use the client’s look as it is now');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('says what will be built, where it goes, and that it is free', async () => {
    const loaded = await openBuild();
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('K2 Syndicalia');
      expect(text).toContain('the client recorded on the plan');
      expect(text).toContain('68 subtitle cards');
      expect(text).toContain('3 emphasised keywords');
      expect(text).toContain('5 images');
      expect(text).toContain('4 sounds');
      expect(text).toContain('Watermark medium, 324 × 363 px');
      expect(text).toContain('Inter Semi-Bold');
      expect(text).toContain('/repo/.local/build/vitasilk-full.aep');
      expect(text).toContain('Building is free');
      // A field name is not a label.
      expect(text).not.toContain('planPath');
      expect(text).not.toContain('savePath');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('runs the build and shows the stages going past', async () => {
    const loaded = await openBuild('running');
    if (loaded === null) return;
    try {
      await loaded.page.click('button.build-now');
      await loaded.page.waitForSelector('.buildpane ol.stages li.running', { timeout: 5000 });
      const labels = await loaded.page.$$eval('.buildpane ol.stages li', (els) =>
        els.map((e) => `${e.className}|${e.textContent ?? ''}`),
      );
      expect(labels).toEqual([
        'done|Read the plan and resolve everything it names',
        'running|Build the composition in After Effects',
        'waiting|Check the built comp against the plan',
      ]);
      expect(await loaded.page.textContent('button.build-now')).toContain('Building');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('names the file it wrote, and does not offer to open it', async () => {
    const loaded = await openBuild('done');
    if (loaded === null) return;
    try {
      await loaded.page.click('button.build-now');
      await loaded.page.waitForSelector('.buildpane [role="status"]', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('Built in 1.3s');
      // The file is the deliverable, so the path is its own element rather
      // than a clause: nothing here renders, and a saved project is how a reel
      // leaves this system.
      expect(text).toContain('Your composition is here');
      const shown = await loaded.page.textContent('.buildpane .savepath');
      expect(shown?.trim()).toBe('/repo/.local/build/vitasilk-full.aep');
      expect(text).toContain('It is open in After Effects now, and nothing was rendered');
      /*
       * The user's first panel build printed the same path twice: once as the
       * composition, once as work "saved first" — and the second was the file
       * the first had just overwritten. Rebuilding over itself says what
       * happened without claiming anything was preserved, and names the path once.
       */
      expect(text).toContain('The previous build of this reel was open');
      expect(text).not.toContain('so it was saved first');
        // Scoped to the result card: the pre-build line legitimately names the
        // same path ("Writes …, replacing what is there") and is still on screen.
        const done = (await loaded.page.textContent('.buildpane [role="status"]')) ?? '';
        expect(done.split('/repo/.local/build/vitasilk-full.aep').length - 1).toBe(1);
      // No reveal-in-Finder control: CEP runs Chromium 99 and whether it can
      // reveal a file has never been proven on the host, so nothing claims it.
      expect(await loaded.page.$('.buildpane button.reveal')).toBeNull();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* The guard's refusal is an instruction, and reaches him as one. */
  it('shows the unsaved-changes refusal as a sentence he can act on', async () => {
    const loaded = await openBuild('refused');
    if (loaded === null) return;
    try {
      await loaded.page.click('button.build-now');
      await loaded.page.waitForSelector('.buildpane [role="alert"]', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane [role="alert"]')) ?? '';
      expect(text).toContain('unsaved changes');
      expect(text).toContain('/Users/x/mine.aep');
      expect(text).toContain('Save or close it yourself');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * A service older than the preview must not have one invented for it — and
   * must not be blamed for a video that simply has not been run yet.
   *
   * Rewritten in session 30. It asserted *"did not say what this build would
   * contain. Quit After Effects and open it again"*, which is what a client's
   * own reel produced the first time one was opened: a browsed video has no
   * plan, so there is nothing to preview, and the panel read the service's
   * silence as a fault and told him to quit the application.
   */
  it('says what is actually missing when there is no build preview', async () => {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      `delete window.__payload.steps.build;
       window.__payload.steps.steps = window.__payload.steps.steps.map((s) =>
         s.id === 'build'
           ? { ...s, available: false, reason: 'This reel has no edit plan yet.' }
           : s);`,
    );
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('This reel has no edit plan yet');
      expect(text).toContain('Press Run pipeline above');
      expect(text).not.toContain('Quit After Effects');
      expect(await loaded.page.$eval('button.build-now', (b) => (b as HTMLButtonElement).disabled)).toBe(true);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('blames nobody, and asks for no restart, when the service says nothing at all', async () => {
    const loaded = await loadFlow(
      'build', 'build', 420, 'delete window.__payload.steps.build;',
    );
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
      const text = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(text).toContain('There is nothing to build for this video yet');
      for (const retired of ['Quit After Effects', 'open it again', 'restart', 'npm run']) {
        expect(`${retired}: ${String(text.includes(retired))}`).toBe(`${retired}: false`);
      }
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* PROJECT_SPEC §6 spends the brand red on Run pipeline alone. */
  it('does not paint Build in the brand accent', async () => {
    const loaded = await openBuild();
    if (loaded === null) return;
    try {
      const colours = await loaded.page.$eval('button.build-now', (el) => {
        const s = getComputedStyle(el);
        return `${s.backgroundColor}|${s.borderTopColor}|${s.color}`;
      });
      expect(colours).not.toContain('237, 28, 36');
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * A reel that has never been through the sidecar used to build a picture across
 * the speaker's face and say nothing. It refuses now, and the panel has to show
 * the refusal as something he can act on rather than as a locked button.
 */
describe.skipIf(!built)('a reel that is not ready to build', () => {
  const MISSING = [
    {
      id: 'face-masks',
      what: 'the face masks for this reel (5 images are placed against them)',
      command:
        'press Run pipeline for this video; from a terminal, ' +
        'npm run frames -- --reel <label> then npm run segment -- --reel <label>',
      consequence:
        'every image is placed against the frame instead of your face, which puts a ' +
        '2030 px picture across the speaker on a 2160 px frame',
    },
  ];

  async function openBuild(missing: unknown[]): Promise<Loaded | null> {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      `window.__payload.steps.build.missing = ${JSON.stringify(missing)};`,
    );
    if (loaded === null) return null;
    // Build and the main screen are one screen now.
    await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
    return loaded;
  }

  it('names what is missing, what it would cost, and the command', async () => {
    const loaded = await openBuild(MISSING);
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.buildpane .card.missing')) ?? '';
      expect(text).toContain('not ready to build');
      expect(text).toContain('the face masks for this reel');
      expect(text).toContain('2030 px picture across the speaker');
      expect(text).toContain('npm run segment');
      // A field name is not a label.
      expect(text).not.toContain('face-masks');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('disables Build while anything is missing', async () => {
    const loaded = await openBuild(MISSING);
    if (loaded === null) return;
    try {
      expect(
        await loaded.page.$eval('button.build-now', (b) => (b as HTMLButtonElement).disabled),
      ).toBe(true);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* A service too old to answer must not be read as a clean bill of health. */
  it('says nothing about readiness when the service cannot say', async () => {
    const loaded = await loadFlow(
      'build', 'build', 420, 'delete window.__payload.steps.build.missing;',
    );
    if (loaded === null) return;
    try {
      // Build and the main screen are one screen now.
      await loaded.page.waitForSelector('.buildpane', { timeout: 5000 });
      expect(await loaded.page.$$('.buildpane .card.missing')).toHaveLength(0);
      expect(
        await loaded.page.$eval('button.build-now', (b) => (b as HTMLButtonElement).disabled),
      ).toBe(false);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * The client's own pictures, offered beside the generated ones. He chooses;
 * nothing matches them to a moment, because deciding that "the clinic exterior"
 * belongs here is the judgement the image-prompt defect is about.
 */
describe.skipIf(!built)('the client’s own pictures', () => {
  const withPictures = (): unknown => {
    const payload = JSON.parse(JSON.stringify(IMAGES)) as Record<string, unknown>;
    payload['clientPictures'] = [
      { id: 'pic001', path: '/v/clinic.jpg', description: 'the clinic exterior' },
      { id: 'pic002', path: '/v/bottle.jpg', description: 'the product bottle' },
    ];
    return payload;
  };

  it('offers them with the words he described them in', async () => {
    const loaded = await loadImages(withPictures());
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.ownpics', { timeout: 5000 });
      const text = (await loaded.page.textContent('.ownpics')) ?? '';
      expect(text).toContain('the clinic exterior');
      expect(text).toContain('the product bottle');
      // Both lists are offered here now — this video's own first, then the
      // client's — so the sentence says "your own pictures" rather than naming
      // one of the two.
      expect(text).toContain('your own pictures');
      // A field name is not a label.
      expect(text).not.toContain('pic001');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* A service older than this sends no list, and an absent list is not empty. */
  it('shows nothing at all when the service does not send them', async () => {
    const loaded = await loadImages();
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('ol.slots li', { timeout: 5000 });
      expect(await loaded.page.$$('.ownpics')).toHaveLength(0);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * The message the user saw after restarting the service and reopening the
 * panel, which should have made it impossible.
 *
 * It was not stale: the running service was queried directly and does send
 * `build`. The panel showed it because **nothing had been picked yet** — with
 * no video and no client there is no plan, so `plan.build` is absent, and the
 * pane read that as an old service and told him to do the thing he had just
 * done.
 */
describe.skipIf(!built)('Build before anything is picked', () => {
  it('asks for a video rather than blaming the service', async () => {
    const loaded = await load({ files: { ...HANDSHAKE, ...SERVICE_BUILT }, fetch: 'healthy' });
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.dot.healthy', { timeout: 15_000 });
      const pane = (await loaded.page.textContent('.buildpane')) ?? '';
      expect(pane).not.toContain('older than the Build control');
      expect(pane).toContain('Choose a client and a video');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * The panel used to print the mode file's own `note` under the client picker —
 * "Stub. The palette is locked (PROJECT_SPEC §5); vocabulary is deliberately
 * empty…" — which is developer prose on a motion designer's screen. That note
 * is the maintainer's and stays in the file; what he sees is what the client
 * looks like.
 */
describe.skipIf(!built)('what a client looks like', () => {
  it('shows the colours, the type and his own line — not the file’s note', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.clientcard', { timeout: 5000 });
      const card = (await loaded.page.textContent('section.client')) ?? '';
      expect(card).toContain('Cosmetic clinic, Casablanca');
      expect(card).toContain('the frame around a picture');
      expect(card).toContain('Inter Semi-Bold');
      expect(card).toContain('Almarai Bold');
      expect(card).toContain('no fonts of their own');
      // The maintainer's prose, and every word from the schema.
      expect(card).not.toContain('PROJECT_SPEC');
      expect(card).not.toContain('vocabulary');
      expect(card).not.toContain('allowedTemplates');
      expect(card).not.toContain('imageVariation');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('paints four swatches in the client’s own colours', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.clientcard .chip', { timeout: 5000 });
      const colours = await loaded.page.$$eval('.clientcard .chip', (els) =>
        els.map((e) => getComputedStyle(e).backgroundColor),
      );
      expect(colours).toEqual([
        'rgb(26, 0, 0)',
        'rgb(130, 0, 0)',
        'rgb(201, 169, 110)',
        'rgb(248, 246, 242)',
      ]);
      // PROJECT_SPEC §6 spends the brand red on Run pipeline alone; a client's
      // palette styles the video, never the tool. These are the client's.
      expect(colours).not.toContain('rgb(237, 28, 36)');
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says which values are the standard ones when he set none', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.clientcard', { timeout: 5000 });
      const card = (await loaded.page.textContent('.clientcard')) ?? '';
      expect(card).toContain('a mix of languages');
      expect(card).toContain('upright video');
      expect(card).toContain('all standard, nothing set for this client');
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* An older service sends none of it, and an absent card is not an empty one. */
  it('shows nothing at all when the service does not describe the client', async () => {
    const loaded = await loadFlow(
      'build', 'build', 420,
      'delete window.__payload.modes.modes[0].look;' +
        'delete window.__payload.modes.modes[0].standards;',
    );
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('section.client', { timeout: 5000 });
      expect(await loaded.page.$$('.clientcard')).toHaveLength(0);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * Browse appears only when the host really has a dialog.
 *
 * A browser `<input type="file">` gives a sandboxed file with no path, and
 * every stage here needs an absolute one — so the panel uses CEP's own dialog
 * if it is there. Whether it is there is a claim about After Effects that only
 * his machine can settle; what is asserted here is that the panel looks, and
 * that both answers behave.
 */
describe.skipIf(!built)('Browse, when the host has a dialog', () => {
  /*
   * The path field is gone (session 45). It was the fallback for a host with no
   * dialog, and this host has one — so what a host without one gets is a
   * sentence he can act on, which is what this asserts.
   */
  it('is absent in an engine with no dialog, and says what to do instead', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      expect(await loaded.page.getByRole('button', { name: 'Browse…' }).count()).toBe(0);
      expect(await loaded.page.$$('input.browse')).toHaveLength(0);
      const video = (await loaded.page.textContent('section.video')) ?? '';
      expect(video).toContain('offers no file dialog');
      expect(video).toContain('client’s folder');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('appears when the host has one, and opens what it returns', async () => {
    const loaded = await loadFlow(
      'build', 'build', 420,
      `window.cep = { fs: { showOpenDialogEx: function () {
         return { err: 0, data: ['/Volumes/T7 Shield/clients/jenna/before.mov'] };
       } } };`,
    );
    if (loaded === null) return;
    try {
      expect(await loaded.page.getByRole('button', { name: 'Browse…' }).count()).toBe(1);
      // Nothing to paste into any more: Refresh and Browse, and that is all.
      expect(await loaded.page.$$('input.browse')).toHaveLength(0);
      expect(
        await loaded.page.$$eval('.videoactions button', (els) =>
          els.map((e) => e.textContent),
        ),
      ).toEqual(['Refresh', 'Browse…']);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('reports what the host offered, either way, in the details', async () => {
    const loaded = await loadFlow('build', 'build');
    if (loaded === null) return;
    try {
      await loaded.page.getByRole('button', { name: 'Details' }).click();
      const details = (await loaded.page.textContent('section.readiness')) ?? '';
      expect(details).toContain('file dialog');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/*
 * The banner the user could not clear.
 *
 * It compared the bundle's build time against the moment the service process
 * started, so a service running exactly the right code was accused of being
 * behind, and no amount of restarting anything cleared it — nothing about the
 * code was being measured. Both sides carry a build stamp now, and equal means
 * equal whoever started first.
 *
 * The match case reads the stamp from `scripts/build-stamp.mjs`, the same
 * function the bundle was stamped with a moment ago by the test script. So it
 * asserts the stamp is really compiled into `panel/dist`, not merely that two
 * strings compare.
 */
describe.skipIf(!built)('the build-stamp check', () => {
  async function loadWithStamp(stamp: string | null): Promise<Loaded | null> {
    return await load({
      files: { ...HANDSHAKE, ...SERVICE_BUILT },
      fetch: 'healthy',
      health: stamp === null ? HEALTHY_PAYLOAD : { ...HEALTHY_PAYLOAD, buildStamp: stamp },
    });
  }

  it('says nothing when the service is the build this bundle was made from', async () => {
    const loaded = await loadWithStamp(await realStamp());
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('main')) ?? '';
      expect(text).not.toContain('built from different code');
      expect(text).not.toContain('older code');
      await loaded.page.click('button.link');
      const details = (await loaded.page.textContent('.details')) ?? '';
      expect(details).toContain('same build as this panel');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('names a service built from other code and says it is being put right', async () => {
    const loaded = await loadWithStamp('0000000000+ffffffffffffffff');
    if (loaded === null) return;
    try {
      /*
       * The panel repairs this itself, so what is on screen is the repair and
       * not an instruction. It says it is bringing the service up to date while
       * it works, then says what happened; against a stub host the repair
       * cannot succeed, so the settled sentence is the failure — and neither
       * sentence contains a command.
       */
      const text = (await loaded.page.textContent('main')) ?? '';
      expect(text).toContain('The background service was out of date');
      expect(text).not.toContain('npm run');
      expect(text).not.toContain('terminal');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('does not accuse a service too old to carry a stamp', async () => {
    const loaded = await loadWithStamp(null);
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('main')) ?? '';
      expect(text).not.toContain('built from different code');
      await loaded.page.click('button.link');
      const details = (await loaded.page.textContent('.details')) ?? '';
      expect(details).toContain('cannot be compared');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

async function realStamp(): Promise<string> {
  // The build script is plain ESM with no types of its own; importing it here
  // is the point — the test has to stamp with the same function the bundle was
  // stamped with, not with a copy of the rule.
  const mod: unknown = await import(
    /* @vite-ignore */ path.join(REPO, 'scripts', 'build-stamp.mjs')
  );
  return (mod as { buildStamp: () => string }).buildStamp();
}

/*
 * Setting up a client, which the user opened for the first time on 2026-08-31
 * and which produced four rulings: nothing typed that can be chosen, fonts from
 * a list, subtitle height by eye, and the colours here rather than afterwards.
 */
describe.skipIf(!built)('setting up a client', () => {
  async function openSetup(amend?: string): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    // CEP's own dialog, which the panel looks for rather than assumes. Without
    // it the fields correctly fall back to text, which is a different case with
    // its own test below.
    await page.addInitScript(`
      window.__picked = null;
      window.cep = { fs: { showOpenDialogEx: () => ({ err: 0, data: window.__picked === null ? [] : [window.__picked] }) } };
    `);
    if (amend !== undefined) await page.addInitScript(amend);
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Client"]', '__new');
    await page.waitForSelector('main.editor', { timeout: 5000 });
    return { page, uncaught };
  }

  it('asks for no path to be typed', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      // The old fields asked him to reproduce a path character for character.
      expect(text).not.toContain('The full path');
      expect(await loaded.page.$$('main.editor input[aria-label="Video folder"]')).toHaveLength(0);
      expect(await loaded.page.$$('main.editor input[aria-label="Logo"]')).toHaveLength(0);
      expect(text).toContain('Choose folder…');
      expect(text).toContain('Choose file…');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('shows what he picked, and a cancel leaves it alone', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      await loaded.page.evaluate("window.__picked = '/Users/x/Movies/Dr Jenna';");
      await loaded.page.click('main.editor button.choose');
      await loaded.page.waitForSelector('.chosenpath', { timeout: 5000 });
      expect(await loaded.page.textContent('.chosenpath')).toBe('/Users/x/Movies/Dr Jenna');
      // A cancel answers nothing, and nothing must not clear what he had.
      await loaded.page.evaluate('window.__picked = null;');
      await loaded.page.click('main.editor button.choose');
      expect(await loaded.page.textContent('.chosenpath')).toBe('/Users/x/Movies/Dr Jenna');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('falls back to a typed path only on a host with no chooser', async () => {
    if (browser === undefined) return;
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Client"]', '__new');
    await page.waitForSelector('main.editor', { timeout: 5000 });
    try {
      expect(await page.$('input[aria-label="Video folder"]')).not.toBeNull();
      expect((await page.textContent('main.editor')) ?? '').toContain('offers no file chooser');
      expect(uncaught).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('offers the faces After Effects has, by the names a build can use', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const options = await loaded.page.$$eval(
        'select[aria-label="Latin font"] option',
        (els) => els.map((e) => (e as HTMLOptionElement).value),
      );
      expect(options[0]).toBe('');
      // After Effects' own name, not the system's `Inter-Regular_SemiBold`.
      expect(options).toContain('Inter-SemiBold');
      expect(options).toContain('Almarai-Bold');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  /*
   * The user photographed this: with the italic `AdobeClean-It` chosen, the
   * sample drew upright in a plain sans — a font nobody picked, presented as
   * the sample. A name is honest; a wrong face is not.
   */
  it('says a face cannot be shown rather than drawing a different one', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      await loaded.page.selectOption('select[aria-label="Latin font"]', 'AdobeClean-It');
      await loaded.page.waitForSelector('.fontsample.cannot', { timeout: 5000 });
      const said = (await loaded.page.textContent('.fontsample.cannot')) ?? '';
      expect(said).toContain('cannot be shown here');
      expect(said).toContain('the system offers no file for this font');
      expect(said).toContain('will still be used in the composition');
      // Nothing was drawn in its place.
      expect(await loaded.page.$('p.fontsample:not(.cannot)')).toBeNull();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('loads the real file for a face that resolves, with its axes', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      await loaded.page.selectOption('select[aria-label="Latin font"]', 'Inter-SemiBold');
      await loaded.page.waitForSelector('p.fontsample:not(.cannot)', { timeout: 5000 });
      const family = await loaded.page.$eval(
        'p.fontsample:not(.cannot)',
        (e) => (e as HTMLElement).style.fontFamily,
      );
      // Its own family name, not After Effects' — so nothing can silently match
      // an installed face of the same name.
      expect(family).toContain('framopia-sample-Inter-SemiBold');
      const settings = await loaded.page.$eval(
        'p.fontsample:not(.cannot)',
        (e) => (e as HTMLElement).style.fontVariationSettings,
      );
      expect(settings).toContain('wght');
      expect(settings).toContain('600');
      const rule = (await loaded.page.textContent('main.editor style')) ?? '';
      expect(rule).toContain('@font-face');
      expect(rule).toContain('Inter-VariableFont');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('samples the Arabic field with Arabic', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      await loaded.page.selectOption('select[aria-label="Arabic font"]', 'Almarai-Bold');
      await loaded.page.waitForSelector('p.fontsample[dir="rtl"]', { timeout: 5000 });
      expect(await loaded.page.textContent('p.fontsample[dir="rtl"]')).toBe('شنو كتعرفي');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('narrows the list as he types, and hides nothing', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const all = await loaded.page.$$eval(
        'select[aria-label="Latin font"] option',
        (els) => els.length,
      );
      await loaded.page.fill('input[aria-label="Search latin fonts"]', 'inter');
      const narrowed = await loaded.page.$$eval(
        'select[aria-label="Latin font"] option',
        (els) => els.map((e) => (e as HTMLOptionElement).value),
      );
      expect(narrowed).toEqual(['', 'Inter-SemiBold']);
      const said = (await loaded.page.textContent('main.editor')) ?? '';
      expect(said).toContain('Nothing is hidden');
      // Clearing gives everything back: nothing was removed from the list.
      await loaded.page.fill('input[aria-label="Search latin fonts"]', '');
      const back = await loaded.page.$$eval(
        'select[aria-label="Latin font"] option',
        (els) => els.length,
      );
      expect(back).toBe(all);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('says what a logo may be, and judges the file at once', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      expect(text).toContain('A PNG with a transparent background');
      expect(text).toContain('psd');
      await loaded.page.evaluate("window.__picked = '/x/brand.psd';");
      const buttons = await loaded.page.$$('main.editor button.choose');
      await buttons[1]?.click();
      await loaded.page.waitForSelector('.pathfield .say', { timeout: 5000 });
      const said = (await loaded.page.textContent('.pathfield .say')) ?? '';
      expect(said).toContain('.psd works');
      expect(said).toContain('cannot show you a preview');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('says why the list is missing rather than showing an empty one', async () => {
    const loaded = await openSetup(
      "window.__payload.fonts = { available: false, names: [], families: null, trouble: 'After Effects is not answering' };",
    );
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('main.editor')) ?? '';
      expect(text).toContain('The list of faces could not be built');
      expect(text).toContain('After Effects is not answering');
      // It falls back to a field rather than an empty chooser.
      expect(await loaded.page.$('input[aria-label="Latin font"]')).not.toBeNull();
      expect(await loaded.page.$('select[aria-label="Latin font"]')).toBeNull();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('positions the subtitle line on a real frame, and says which frame', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('.heightpreview .frame', { timeout: 5000 });
      const text = (await loaded.page.textContent('.heightpreview')) ?? '';
      expect(text).toContain('A real frame from vitasilk');
      expect(text).toContain('Shown at about a tenth of 2160 × 3840');
      // The line sits at the default until he moves it: 2480.4 of 3840.
      const top = await loaded.page.$eval('.baseline', (e) => (e as HTMLElement).style.top);
      expect(Number.parseFloat(top)).toBeCloseTo((2480.4 / 3840) * 100, 2);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('never shows a plain frame as though it were footage', async () => {
    const loaded = await openSetup(
      'window.__payload.preview = { framePath: null, fromReel: null, frameWidth: 2160, frameHeight: 3840, sourceWidth: 2160, sourceHeight: 3840, defaultBaselineY: 2480.4 };',
    );
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.heightpreview')) ?? '';
      expect(text).toContain('No footage to show yet');
      expect(text).not.toContain('A real frame from');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('moves the number when the slider moves', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      await loaded.page.fill('input[aria-label="Subtitle height in pixels"]', '3000');
      const top = await loaded.page.$eval('.baseline', (e) => (e as HTMLElement).style.top);
      expect(Number.parseFloat(top)).toBeCloseTo((3000 / 3840) * 100, 2);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('carries the four colours, with the roles in his own words', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.colours')) ?? '';
      /*
       * The old captions described the picture frame and nothing else, and two
       * of the four were wrong: `accent` was called "the frame around a picture"
       * when it can never be one, and neither of the two subtitle colours —
       * which is what 254 words and 8 keywords are actually drawn in — was
       * mentioned at all. Session 18 measured where each colour goes and wrote
       * these from that.
       */
      for (const what of [
        'your ordinary subtitle words',
        'the words you emphasise',
        'behind a cut-out picture',
        // Retired 2026-08-31: this used to read "the shadow behind your words
        // comes from the template, not from here", which stopped being true the
        // moment the shadow started taking the client's deeper colour.
        'the shadow behind every word',
      ]) {
        expect(text).toContain(what);
      }
      expect(text).not.toContain('the deeper of the two frame colours');
      expect(text).not.toContain('the frame around a picture');
      // The colours that touch words come first — the word, the emphasised word
      // and the shadow behind both — and the picture-only one follows.
      const values = await loaded.page.$$eval('.colours input[type="color"]', (els) =>
        els.map((e) => (e as HTMLInputElement).value.toUpperCase()),
      );
      /*
       * **Retired 2026-09-03: these were K2 Syndicalia's four exact hexes.**
       * The screen opened as K2 for every client, and Block 10 session 44 found
       * that `save()` never sent the palette at all, so a client who changed
       * them got K2's anyway. The swatches now start on a grey ramp that reads
       * as unset, and the code box beside each is empty until one is entered.
       */
      expect(values).toEqual(['#FFFFFF', '#B0B0B0', '#585858', '#000000']);
      expect(text).not.toContain('#F8F6F2');
      expect(text).not.toContain('#C9A96E');
      expect(text).not.toContain('#820000');
      expect(text).not.toContain('#1A0000');
      /*
       * "not set" moved from a `<code>` label to the code box's placeholder at
       * session 47, when the label became a real input. It was never typeable
       * before: `contentEditable` false and unable to take focus.
       */
      const unset = await loaded.page.$$eval('.colours input.hex', (els) =>
        els.map((e) => ({
          value: (e as HTMLInputElement).value,
          placeholder: (e as HTMLInputElement).placeholder,
        })),
      );
      expect(unset).toHaveLength(4);
      expect(unset.every((u) => u.value === '')).toBe(true);
      expect(unset.every((u) => u.placeholder === 'not set')).toBe(true);
      expect(text).toContain('Left alone, this client is built in the standard one.');
      // The sentence that made this a two-visit screen is gone.
      const all = (await loaded.page.textContent('main.editor')) ?? '';
      expect(all).not.toContain('Colours and their own pictures are added afterwards');
      /*
       * Retired 2026-08-31: this used to assert "Adding their own photographs
       * is not built yet", which stopped being true the moment the control
       * landed on this screen.
       */
      expect(all).not.toContain('Adding their own photographs is not built yet');
      expect(all).not.toContain('once there are videos to use them in');
      expect(all).toContain('Their own photographs');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  /*
   * A client's own photographs, on the screen where a client is set up.
   *
   * **User ruling, 2026-08-31**: they belong here, not in the picture editor
   * half-way through a video. The client does not exist yet at this point, so
   * the list is held on the form and travels with the client.
   */
  it('takes a photograph, with a description, and shows it back', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.waitForSelector('.ownphotos', { timeout: 5000 });
      expect((await page.textContent('.ownphotos')) ?? '').toContain('None yet.');
      // Nothing can be added until both halves are there.
      const add = await page.$('.addphoto button.ghost:not(.choose)');
      expect(await add?.isDisabled()).toBe(true);

      await page.evaluate(`window.__picked = ${JSON.stringify(LOGO)};`);
      await page.click('.ownphotos button.choose');
      await page.waitForSelector('.ownphotos .chosenpath', { timeout: 5000 });
      expect(await page.textContent('.ownphotos .chosenpath')).toBe(LOGO);
      expect(await (await page.$('.addphoto button.ghost:not(.choose)'))?.isDisabled()).toBe(true);

      await page.fill('.ownphotos input[aria-label="What is it?"]', 'the clinic exterior');
      await page.click('.addphoto button.ghost:not(.choose)');
      await page.waitForSelector('.ownphotos ul.photos li', { timeout: 5000 });
      expect((await page.textContent('.ownphotos ul.photos')) ?? '').toContain(
        'the clinic exterior',
      );
      // Encoded once, in `fileUrl`, because these paths carry spaces.
      expect(await page.$eval('.ownphotos img.shot', (e) => e.getAttribute('src'))).toBe(
        `file://${encodeURI(LOGO)}`,
      );
      // Forgetting says what it does, and does it.
      expect((await page.textContent('.ownphotos')) ?? '').toContain(
        'leaves the file itself exactly where it is',
      );
      await page.click('button[aria-label="Forget the clinic exterior"]');
      expect(await page.$$('.ownphotos ul.photos li')).toHaveLength(0);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('sends the photographs with the new client', async () => {
    const loaded = await openSetup(`
      window.__posted = null;
      const inner = window.fetch;
      window.fetch = (url, init) => {
        if (String(url).indexOf('/clients') !== -1 && init && init.method === 'POST') {
          window.__posted = JSON.parse(init.body);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'dr-jenna', modes: window.__payload.modes.modes }),
          });
        }
        return inner(url, init);
      };
    `);
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.fill('input[aria-label="Name"]', 'Dr Jenna');
      await page.evaluate(`window.__picked = ${JSON.stringify(LOGO)};`);
      await page.click('.ownphotos button.choose');
      await page.fill('.ownphotos input[aria-label="What is it?"]', 'the clinic exterior');
      await page.click('.addphoto button.ghost:not(.choose)');
      await page.waitForSelector('.ownphotos ul.photos li', { timeout: 5000 });
      await page.click('main.editor > button.ghost');
      await page.waitForSelector('section.client', { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as {
        pictures?: { path: string; description: string }[];
      };
      expect(posted.pictures).toEqual([{ path: LOGO, description: 'the clinic exterior' }]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('says a file it cannot use is one it cannot use, before he adds it', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.evaluate("window.__picked = '/x/clinic.mov';");
      await page.click('.ownphotos button.choose');
      await page.waitForSelector('.ownphotos .say', { timeout: 5000 });
      expect((await page.textContent('.ownphotos .say')) ?? '').toContain(
        '.mov cannot be used as a photo',
      );
      await page.fill('.ownphotos input[aria-label="What is it?"]', 'the clinic');
      expect(await (await page.$('.addphoto button.ghost:not(.choose)'))?.isDisabled()).toBe(true);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  it('accepts a format it cannot draw, and says so instead of a broken image', async () => {
    const loaded = await openSetup();
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.evaluate("window.__picked = '/x/clinic.psd';");
      await page.click('.ownphotos button.choose');
      await page.fill('.ownphotos input[aria-label="What is it?"]', 'the clinic');
      await page.click('.addphoto button.ghost:not(.choose)');
      await page.waitForSelector('.ownphotos ul.photos li', { timeout: 5000 });
      expect(await page.$('.ownphotos img.shot')).toBeNull();
      expect((await page.textContent('.ownphotos ul.photos')) ?? '').toContain(
        'cannot show a preview',
      );
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });
});


/*
 * The same photographs on the other client screen — the card for a client who
 * already exists. There is a `/clients/pictures` route here, so every change
 * goes to the service and the client list is re-read from it afterwards.
 */
describe('a saved client’s own photographs', () => {
  const routeStub = `
    const inner = window.fetch;
    window.fetch = (url, init) => {
      const u = String(url);
      // A fresh object each time, so the panel cannot appear to update by
      // holding a reference into the fixture the route just mutated.
      if (u.indexOf('/modes') !== -1) {
        const modes = JSON.parse(JSON.stringify(window.__payload.modes));
        return Promise.resolve({ ok: true, json: () => Promise.resolve(modes) });
      }
      if (u.indexOf('/clients/pictures') !== -1) {
        const pics = window.__payload.modes.modes[0].pictures;
        if (init && init.method === 'DELETE') {
          const id = decodeURIComponent(u.split('picture=')[1]);
          window.__payload.modes.modes[0].pictures = pics.filter((p) => p.id !== id);
        } else {
          const body = JSON.parse(init.body);
          window.__payload.modes.modes[0].pictures = pics.concat([
            { id: 'pic00' + (pics.length + 1), path: body.path, description: body.description },
          ]);
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }
      return inner(url, init);
    };
    window.__picked = null;
    window.cep = { fs: { showOpenDialogEx: () => ({ err: 0, data: window.__picked === null ? [] : [window.__picked] }) } };
  `;

  it('adds one through the service and reads the client back', async () => {
    const loaded = await loadFlow('build', 'build', 420, routeStub);
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.waitForSelector('.clientcard .ownphotos', { timeout: 5000 });
      expect((await page.textContent('.clientcard .ownphotos')) ?? '').toContain('None yet.');
      await page.evaluate(`window.__picked = ${JSON.stringify(LOGO)};`);
      await page.click('.clientcard .ownphotos button.choose');
      await page.fill('.clientcard .ownphotos input[aria-label="What is it?"]', 'the clinic');
      await page.click('.clientcard .addphoto button.ghost:not(.choose)');
      await page.waitForSelector('.clientcard .ownphotos ul.photos li', { timeout: 5000 });
      expect((await page.textContent('.clientcard .ownphotos ul.photos')) ?? '').toContain(
        'the clinic',
      );
      await page.click('.clientcard button[aria-label="Forget the clinic"]');
      await page.waitForSelector('.clientcard .ownphotos ul.photos li', {
        state: 'detached',
        timeout: 5000,
      });
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });

  /*
   * A service older than this panel sends no `pictures` at all, which is not
   * the same as a client with none. Offering an editor there would report a
   * failure the moment he pressed it — session 32's rule.
   */
  it('offers no editor against a service that does not carry them', async () => {
    const loaded = await loadFlow(
      'build',
      'build',
      420,
      'delete window.__payload.modes.modes[0].pictures;',
    );
    if (loaded === null) return;
    try {
      expect(await loaded.page.$('.clientcard .ownphotos')).toBeNull();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  });
});

/*
 * Reading a transcript used to cost the price of the pictures: on a 41-second
 * reel the words are about $0.35 and the pictures about $3.98, and Run did
 * both. Session 29 reversed the orthography rules and nothing has ever been
 * transcribed under them, so the words are exactly what has to be read first.
 */
describe('running the words without the pictures', () => {
  const priced = (words: number, pictures: number): string => `
    window.__payload.dry.wordsUsd = ${String(words)};
    window.__payload.dry.picturesUsd = ${String(pictures)};
    window.__payload.dry.estimateUsd = ${String(words + pictures)};
    window.__posted = [];
    const inner = window.fetch;
    window.fetch = (url, init) => {
      if (String(url).indexOf('/jobs') !== -1 && init && init.method === 'POST') {
        window.__posted.push(JSON.parse(init.body));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'job-1' }) });
      }
      return inner(url, init);
    };
  `;

  it('offers the words at their own price, and asks for only those stages', async () => {
    const loaded = await loadFlow('build', 'build', 420, priced(0.35, 3.98));
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.waitForSelector('.partrun button', { timeout: 5000 });
      const label = (await page.textContent('.partrun button')) ?? '';
      expect(label).toContain('Make the subtitles');
      expect(label).toContain('$0.35');
      // Both halves are on screen at once, each with its own price.
      expect((await page.textContent('.partrun')) ?? '').toContain('$3.98');
      expect(await page.locator('.partrun button').count()).toBe(2);
      // The pictures are made from the subtitles, so they are refused until
      // those exist — and the reason is on screen without a stage name in it.
      expect(await page.locator('.partrun button').nth(1).isDisabled()).toBe(true);
      expect((await page.textContent('.partrun')) ?? '').toContain(
        'drawn from the subtitles',
      );
      await page.click('.partrun button');
      const posted = (await page.evaluate('window.__posted')) as {
        params: { only?: string[]; redo?: string[] };
      }[];
      expect(posted[0]?.params.only).toEqual(['transcription', 'analysis']);
      expect(posted[0]?.params.redo).toBeUndefined();
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * `redo` is not optional. The slot stage writes `pipeline.images.status =
   * 'done'` when it plans the slots, so a plan that has never held a picture
   * records the image stage as done and `only: ['images']` alone skips it —
   * Block 10 session 8 found that and it is still open.
   */
  it('offers the pictures once the words are paid for, and redoes the stage', async () => {
    const loaded = await loadFlow('build', 'build', 420, priced(0, 3.98));
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.waitForSelector('.partrun button', { timeout: 5000 });
      const pictures = page.locator('.partrun button').nth(1);
      expect((await pictures.textContent()) ?? '').toContain('Make the pictures');
      expect(await pictures.isDisabled()).toBe(false);
      expect((await page.textContent('.partrun')) ?? '').toContain('not charged for again');
      await pictures.click();
      const posted = (await page.evaluate('window.__posted')) as {
        params: { only?: string[]; redo?: string[] };
      }[];
      expect(posted[0]?.params.only).toEqual(['images']);
      expect(posted[0]?.params.redo).toEqual(['images']);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * Both halves stay on screen when there is nothing left to pay for, priced at
   * nothing. Session 31 showed one control at a time and only when it would
   * bill; session 54 shows both always, because two controls that appear and
   * disappear teach nothing about the order they go in — and re-running either
   * half is a thing he does.
   */
  it('still offers both halves, at nothing, when everything is paid for', async () => {
    const loaded = await loadFlow('build', 'build', 420, priced(0, 0));
    if (loaded === null) return;
    try {
      const page = loaded.page;
      await page.waitForSelector('button.run', { timeout: 5000 });
      expect(await page.locator('.partrun button').count()).toBe(2);
      const said = (await page.textContent('.partrun')) ?? '';
      expect(said).toContain('Make the subtitles again — about $0.00');
      expect(said).toContain('Make the pictures — about $0.00');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* A service older than this panel sends neither figure, and a guessed one
     would be a claim about money. */
  it('offers nothing against a service that does not split the cost', async () => {
    const loaded = await loadFlow(
      'build', 'build', 420,
      'delete window.__payload.dry.wordsUsd; delete window.__payload.dry.picturesUsd;',
    );
    if (loaded === null) return;
    try {
      await loaded.page.waitForSelector('button.run', { timeout: 5000 });
      // One control that does everything, rather than two guessed ones.
      expect(await loaded.page.locator('.partrun').count()).toBe(0);
      expect((await loaded.page.textContent('button.run')) ?? '').toContain('Make this video');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

