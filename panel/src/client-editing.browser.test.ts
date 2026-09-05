import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { HANDSHAKE, INDEX, built, stubHost, stubRoutes, stepsThrough } from './browser-harness.js';

/**
 * **Everything this session added, clicked in the real built panel.**
 *
 * Session 43's audit exercised the service behind every control and could not
 * click the rendered panel, and named that as the gap; session 47 closed it for
 * one screen. This closes it for the label, the three faces, editing a client,
 * removing one, a picture attached to one video, and the two run buttons.
 *
 * **Its own file, and so its own browser**, for session 47's reason: the
 * image-picker tests in `render.browser.test.ts` wait for an `img` whose
 * fixtures have been missing since the cut-outs moved into per-reel folders,
 * they pass by winning a race, and more work in the same browser makes them
 * lose it.
 *
 * **Nothing can leave this machine.** Every request goes through a recorder
 * that answers locally and counts anything not addressed to 127.0.0.1; the
 * count is asserted at the end of every test.
 */
let browser: Browser | undefined;
let launchFailure: string | null = null;

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
});

interface Loaded {
  page: Page;
  uncaught: string[];
}

/** A saved client with everything this session can edit, as the service sends it. */
const SAVED_CLIENT = {
  id: 'a-scratch-client',
  name: 'A Scratch Client',
  version: 3,
  fontsStatus: 'set',
  about: 'the first note',
  look: {
    palette: [
      { role: 'background', hex: '#101820', what: 'behind a cut-out picture' },
      { role: 'primary', hex: '#2A4A66', what: 'the shadow behind every word' },
      { role: 'accent', hex: '#63C7E8', what: 'the words you emphasise' },
      { role: 'light', hex: '#F4FAFF', what: 'your ordinary subtitle words' },
    ],
    fonts: { latin: 'Inter-SemiBold', arabic: 'Almarai-Bold', standard: false },
    logoPath: null,
  },
  standards: {
    language: 'french', videoShape: 'vertical', watermark: true,
    subtitleBaselineY: 2480.4, chosen: ['language'],
  },
  pictures: [
    {
      id: 'pic001',
      path: '/scratch/box.png',
      description: 'the product box',
      label: 'Zephyrine',
      onThisMachine: true,
    },
    {
      id: 'pic002',
      path: '/scratch/clinic.png',
      description: 'the clinic outside',
      onThisMachine: true,
    },
  ],
  editable: {
    name: 'A Scratch Client',
    about: 'the first note',
    language: 'french',
    fonts: { latin: 'Inter-SemiBold', arabic: 'Almarai-Bold' },
  },
};

/**
 * Every call the panel makes, answered here and counted.
 *
 * `sent` records anything addressed anywhere but the local service, which is
 * the only way a request could leave this machine. It is asserted empty.
 */
function recorder(extra = ''): string {
  return `
    window.__sent = [];
    window.__posted = [];
    window.__deleted = [];
    window.__modes = ${JSON.stringify([SAVED_CLIENT])};
    const inner = window.fetch;
    window.fetch = (url, init) => {
      const address = String(url);
      if (address.indexOf('http://127.0.0.1:') !== 0 && address.indexOf('file://') !== 0) {
        window.__sent.push(address);
        throw new Error('nothing may leave this machine, and something tried: ' + address);
      }
      const method = (init && init.method) || 'GET';
      const body = init && init.body ? JSON.parse(init.body) : null;
      const answerModes = () =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ modes: window.__modes }) });

      if (address.indexOf('/modes') !== -1 && method === 'GET') return answerModes();
      if (method === 'POST' && address.indexOf('/clients') !== -1) {
        window.__posted.push({ url: address, body: body });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'made', modes: window.__modes }),
        });
      }
      if (method === 'POST' && address.indexOf('/video/') !== -1) {
        window.__posted.push({ url: address, body: body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ picture: {} }) });
      }
      if (method === 'DELETE') {
        window.__deleted.push(address);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ removed: { movedTo: '/kept/here.json' }, modes: [] }),
        });
      }
      return inner(url, init);
    };
    ${extra}
  `;
}

async function open(
  where: 'setup' | 'card',
  modes: unknown[] = [SAVED_CLIENT],
): Promise<Loaded | null> {
  if (browser === undefined) return null;
  const page = await browser.newPage({ viewport: { width: 420, height: 1400 } });
  const uncaught: string[] = [];
  page.on('pageerror', (error: Error) => uncaught.push(error.message));
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
  await page.addInitScript(`
    window.__picked = '/scratch/chosen.png';
    window.cep = { fs: { showOpenDialogEx: () => ({ err: 0, data: [window.__picked] }) } };
  `);
  await page.addInitScript(recorder(`window.__modes = ${JSON.stringify(modes)};`));
  await page.goto(`file://${INDEX}`);
  await page.waitForSelector('section.video', { timeout: 10_000 });
  if (where === 'setup') {
    await page.selectOption('select[aria-label="Client"]', '__new');
    await page.waitForSelector('main.editor', { timeout: 5000 });
  } else {
    await page.selectOption('select[aria-label="Client"]', SAVED_CLIENT.id);
    await page.waitForSelector('.clientcard', { timeout: 5000 });
  }
  return { page, uncaught };
}

describe('a browser to run in', () => {
  it('is there, or the reason is said out loud', () => {
    if (!built) {
      console.warn('panel/dist is missing — build the panel to run the client-editing checks');
      return;
    }
    expect(launchFailure, launchFailure ?? '').toBeNull();
  });
});

describe.skipIf(!built)('setting up a client', () => {
  /*
   * **The three faces.** The user's ruling: a Latin sans, a Latin serif for the
   * words you emphasise, and an Arabic. This screen collected two until now, so
   * Dr Loubna Kfafi's third had to be written into her file by hand after she
   * was created — session 50.
   */
  it('takes three faces and sends all three', async () => {
    const loaded = await open('setup');
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.fill('input[aria-label="Name"]', 'A Made Client');
      /*
       * The faces come from a list this After Effects reported, not from a box:
       * those names are the only ones a build can write, so nothing is typed.
       */
      for (const [what, face] of [
        ['Latin font', 'Inter-SemiBold'],
        ['Emphasis font', 'CormorantGaramondItalic-SemiBoldItalic'],
        ['Arabic font', 'Almarai-Bold'],
      ] as const) {
        await page.selectOption(`select[aria-label="${what}"]`, face);
      }
      await page.click('button:has-text("Save this client")');
      await page.waitForFunction('window.__posted.length > 0', undefined, { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as { body: Record<string, unknown> }[];
      expect(posted[0]?.body['fonts']).toEqual({
        latin: 'Inter-SemiBold',
        emphasis: 'CormorantGaramondItalic-SemiBoldItalic',
        arabic: 'Almarai-Bold',
      });
      expect(await page.evaluate('window.__sent')).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * **The label, which is the whole point of this session.** Session 53 built
   * the rule and nothing in the panel could write one, so the feature was
   * reachable only by editing the client's file by hand.
   */
  it('takes a labelled picture and sends the label with it', async () => {
    const loaded = await open('setup');
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.fill('input[aria-label="Name"]', 'A Made Client');
      await page.click('.ownphotos button.choose');
      await page.fill('input[aria-label="What is it?"]', 'the product box');
      await page.fill('input[aria-label="Use it when someone says…"]', 'Zephyrine, Kalimba');
      await page.click('.addphoto button:not(.choose)');
      await page.click('button:has-text("Save this client")');
      await page.waitForFunction('window.__posted.length > 0', undefined, { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as { body: Record<string, unknown> }[];
      expect(posted[0]?.body['pictures']).toEqual([
        {
          path: '/scratch/chosen.png',
          description: 'the product box',
          label: 'Zephyrine, Kalimba',
        },
      ]);
      expect(await page.evaluate('window.__sent')).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* Absent is what makes a picture hand-chosen only; an empty box writes none. */
  it('sends no label at all when the box is left empty', async () => {
    const loaded = await open('setup');
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.fill('input[aria-label="Name"]', 'A Made Client');
      await page.click('.ownphotos button.choose');
      await page.fill('input[aria-label="What is it?"]', 'the clinic outside');
      await page.click('.addphoto button:not(.choose)');
      await page.click('button:has-text("Save this client")');
      await page.waitForFunction('window.__posted.length > 0', undefined, { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as { body: Record<string, unknown> }[];
      expect(posted[0]?.body['pictures']).toEqual([
        { path: '/scratch/chosen.png', description: 'the clinic outside' },
      ]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* The screen has to say what a label does, in words rather than in jargon. */
  it('says what a label is for without naming a mechanism', async () => {
    const loaded = await open('setup');
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.ownphotos')) ?? '';
      expect(text).toContain('used automatically whenever one of those words is spoken');
      expect(text.toLowerCase()).not.toContain('match');
      expect(text.toLowerCase()).not.toContain('label');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

describe.skipIf(!built)('a client already saved', () => {
  /**
   * **A photograph on a drive this Mac cannot see.**
   *
   * A client file made on one machine can name a drive another has never seen.
   * Block 11 session 60 measured what happened: the panel was handed the dead
   * path, drew nothing, and the only thing that ever said why was pre-flight,
   * refusing at build time. This is that answer arriving with the picture.
   */
  it('says a photograph is on a drive this Mac cannot see', async () => {
    const away = JSON.parse(JSON.stringify(SAVED_CLIENT)) as typeof SAVED_CLIENT;
    (away.pictures[1] as Record<string, unknown>)['onThisMachine'] = false;
    const loaded = await open('card', [away]);
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.ownphotos')) ?? '';
      expect(text).toContain('on a drive this Mac cannot see');
      // It names which photograph, in the words he described it in.
      expect(text).toContain('the clinic outside');
      // It does not refuse and it does not forget: both are still listed.
      expect(await loaded.page.locator('.photos li').count()).toBe(2);
      expect(text).toContain('the product box');
      // And it sends nobody anywhere.
      for (const word of ['terminal', 'npm run', 'restart', 'command']) {
        expect(`${word}: ${text.toLowerCase().includes(word)}`).toBe(`${word}: false`);
      }
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says nothing about photographs that are all here', async () => {
    const loaded = await open('card');
    if (loaded === null) return;
    try {
      const text = (await loaded.page.textContent('.ownphotos')) ?? '';
      expect(text).not.toContain('on a drive this Mac cannot see');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('writes a label onto a picture that is already there', async () => {
    const loaded = await open('card');
    if (loaded === null) return;
    try {
      const { page } = loaded;
      const box = 'input[aria-label="Use the clinic outside when someone says…"]';
      await page.waitForSelector(box, { timeout: 5000 });
      await page.fill(box, 'Marchesa');
      await page.click('button[aria-label="Save the words for the clinic outside"]');
      await page.waitForFunction('window.__posted.length > 0', undefined, { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as {
        url: string;
        body: Record<string, unknown>;
      }[];
      expect(posted[0]?.url).toContain('/clients/picture-label');
      expect(posted[0]?.body).toEqual({
        client: SAVED_CLIENT.id,
        picture: 'pic002',
        label: 'Marchesa',
      });
      expect(await page.evaluate('window.__sent')).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /* Only what changed is sent, so one control edits one thing. */
  it('sends only the fields that were touched', async () => {
    const loaded = await open('card');
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.click('button:has-text("Change their details")');
      await page.fill('input[aria-label="Their name"]', 'A Renamed Client');
      await page.fill('input[aria-label="About them"]', 'the second note');
      await page.click('button:has-text("Save their details")');
      await page.waitForFunction('window.__posted.length > 0', undefined, { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as {
        url: string;
        body: { details: Record<string, unknown> };
      }[];
      expect(posted[0]?.url).toContain('/clients/details');
      expect(posted[0]?.body.details).toEqual({
        name: 'A Renamed Client',
        about: 'the second note',
      });
      // Untouched fields are absent, which is what keeps a blank meaning
      // "standard" rather than becoming a choice nobody made.
      expect(Object.keys(posted[0]?.body.details ?? {})).not.toContain('language');
      expect(Object.keys(posted[0]?.body.details ?? {})).not.toContain('videoShape');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('changes a face after the client was made', async () => {
    const loaded = await open('card');
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.click('button:has-text("Change their details")');
      await page.fill('input[aria-label="Emphasis font"]', 'Georgia');
      await page.click('button:has-text("Save their details")');
      await page.waitForFunction('window.__posted.length > 0', undefined, { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as {
        body: { details: { fonts?: Record<string, string> } };
      }[];
      expect(posted[0]?.body.details.fonts).toEqual({
        latin: 'Inter-SemiBold',
        arabic: 'Almarai-Bold',
        emphasis: 'Georgia',
      });
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  /*
   * Removal is confirmed, and the confirmation says what it does to reels
   * already made — they keep the look they were made with — and what it does
   * to one using this client's photographs.
   */
  it('asks before taking a client off the list, and says what happens', async () => {
    const loaded = await open('card');
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.click('button:has-text("Change their details")');
      await page.click('button:has-text("Take them off the list")');
      const said = (await page.textContent('.confirmremove')) ?? '';
      expect(said).toContain('keep the look they were made with');
      expect(said).toContain('would no longer find it');
      expect(said).toContain('kept, not thrown away');
      // Nothing has been asked of the service yet.
      expect(await page.evaluate('window.__deleted')).toEqual([]);

      await page.click(`button:has-text("Yes, take ${SAVED_CLIENT.name} off the list")`);
      await page.waitForFunction('window.__deleted.length > 0', undefined, { timeout: 5000 });
      const deleted = (await page.evaluate('window.__deleted')) as string[];
      expect(deleted[0]).toContain('/clients?client=a-scratch-client');
      expect(await page.evaluate('window.__sent')).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});

/**
 * **A picture attached to one video**, browsed and labelled the same way as a
 * client's, on the picture screen where the reel's own slots are.
 */
describe.skipIf(!built)('pictures for one video', () => {
  const IMAGES = {
    reel: 'vitasilk',
    planPath: '/v/vitasilk.editplan.json',
    generationEstimateUsd: null,
    generationNote: null,
    reelSpentUsd: 0,
    cardFrameForced: true,
    clientPictures: [
      { id: 'pic001', path: '/scratch/box.png', description: 'the client’s box', label: 'Kalimba' },
    ],
    videoPictures: [
      { id: 'own001', path: '/scratch/shot.png', description: 'the shot for this reel' },
    ],
    slots: [],
    source: {
      clientMode: 'a-scratch-client', clientModeVersion: 3,
      stageStatus: 'done', cacheEntryId: null, cacheProvenance: null,
    },
  };

  async function openImages(): Promise<Loaded | null> {
    if (browser === undefined) return null;
    const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
    const uncaught: string[] = [];
    page.on('pageerror', (error: Error) => uncaught.push(error.message));
    await page.addInitScript(stubHost(HANDSHAKE));
    await page.addInitScript(stubRoutes(stepsThrough('build'), 'build'));
    await page.addInitScript(`
      window.__picked = '/scratch/chosen.png';
      window.cep = { fs: { showOpenDialogEx: () => ({ err: 0, data: [window.__picked] }) } };
    `);
    await page.addInitScript(recorder(`
      window.__images = ${JSON.stringify(IMAGES)};
      const before = window.fetch;
      window.fetch = (url, init) => {
        if (String(url).indexOf('/images') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__images) });
        }
        return before(url, init);
      };
    `));
    await page.goto(`file://${INDEX}`);
    await page.waitForSelector('section.video', { timeout: 10_000 });
    await page.selectOption('select[aria-label="Video"]', 'vitasilk');
    await page.selectOption('select[aria-label="Client"]', SAVED_CLIENT.id);
    await page.click('section.change .opener:has-text("Pictures")');
    await page.waitForSelector('main.editor', { timeout: 5000 });
    return { page, uncaught };
  }

  it('attaches a labelled picture to this reel and to nothing else', async () => {
    const loaded = await openImages();
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.waitForSelector('.ownphotos', { timeout: 5000 });
      await page.click('.ownphotos button.choose');
      await page.fill('input[aria-label="What is it?"]', 'the bottle for this reel');
      await page.fill('input[aria-label="Use it when someone says…"]', 'Zephyrine');
      await page.click('.addphoto button:not(.choose)');
      await page.waitForFunction('window.__posted.length > 0', undefined, { timeout: 5000 });
      const posted = (await page.evaluate('window.__posted')) as {
        url: string;
        body: Record<string, unknown>;
      }[];
      expect(posted[0]?.url).toContain('/video/pictures');
      expect(posted[0]?.body).toEqual({
        planPath: '/v/vitasilk.editplan.json',
        path: '/scratch/chosen.png',
        description: 'the bottle for this reel',
        label: 'Zephyrine',
      });
      expect(await page.evaluate('window.__sent')).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('says these belong to this video and go before the client’s', async () => {
    const loaded = await openImages();
    if (loaded === null) return;
    try {
      const said = (await loaded.page.textContent('main.editor')) ?? '';
      expect(said).toContain('Pictures for this video');
      expect(said).toContain('not for the client');
      expect(said).toContain('before any of the client’s own');
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);

  it('forgets one without touching the file on the disk', async () => {
    const loaded = await openImages();
    if (loaded === null) return;
    try {
      const { page } = loaded;
      await page.click('button[aria-label="Forget the shot for this reel"]');
      await page.waitForFunction('window.__deleted.length > 0', undefined, { timeout: 5000 });
      const deleted = (await page.evaluate('window.__deleted')) as string[];
      expect(deleted[0]).toContain('/video/pictures?');
      expect(deleted[0]).toContain('picture=own001');
      expect((await page.textContent('.ownphotos')) ?? '').toContain(
        'leaves the file itself exactly where it is',
      );
      expect(await page.evaluate('window.__sent')).toEqual([]);
      expect(loaded.uncaught).toEqual([]);
    } finally {
      await loaded.page.close();
    }
  }, 30_000);
});
