/**
 * The pieces every panel browser test needs: where the built bundle is, the
 * CEP bridge the panel expects before its own scripts run, and the stubbed
 * service routes behind it.
 *
 * **Extracted at Block 10 session 47.** It lived inside
 * `render.browser.test.ts`, so a new browser test had to be added to that file
 * — and adding six there made the image-picker tests start failing. Those
 * tests wait for an `img` that only exists while its file loads, and their
 * fixtures have been missing since the cut-outs moved into per-reel folders
 * (Block 10 session 35, still open as session 43's finding 6); they pass by
 * winning a race, and more work in the same file and the same browser makes
 * them lose it. A test that needs this harness now gets its own file and its
 * own browser rather than crowding theirs.
 */
import type { Browser, Page } from 'playwright';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PALETTE_MEANING,
  STANDARD_FONTS,
  clientDefaults,
  loadMode,
  mismatchSentence,
  mismatchedClient,
  paletteRolesInDisplayOrder,
  reattachSentence,
  type ClientFolder,
  byClient,
  byDay,
  byMonth,
  byPurpose,
  byStage,
  byVideo,
  readLedger,
  unattributed,
} from '@framopia/core';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DIST = path.resolve(HERE, '..', 'dist');
export const INDEX = path.join(DIST, 'index.html');
export const REPO = path.resolve(HERE, '..', '..');
export const LOGO = path.join(REPO, 'assets', 'brand', 'Framopia_LOGO.png');

export const built = existsSync(path.join(DIST, 'panel.js')) && existsSync(INDEX);

/**
 * Injected into the page before any script runs. `path` and `fs` are the only
 * modules the panel asks for at startup; `fs` reports nothing on disk, so the
 * pickers render their empty wording and no fixture is needed.
 */
export function stubHost(files: Record<string, string>, repo = REPO): string {
  return `
  window.__repo = ${JSON.stringify(repo)};
  window.__files = ${JSON.stringify(files)};
  // The resolver verifies a candidate against package.json and the marker
  // directories, so a stub that answers false to everything cannot produce a
  // root — which is the behaviour being relied on.
  window.__repoFiles = {};
  window.__repoFiles[window.__repo + '/package.json'] = JSON.stringify({ name: 'framopia-studio' });
  ['service', 'modes', 'core', 'panel', 'panel/dist'].forEach(function (d) {
    window.__repoFiles[window.__repo + '/' + d] = '';
  });
  // A node binary, so resolution gets past node-missing to the build check.
  window.__repoFiles['/home/.nvm/versions/node'] = '';
  window.__repoFiles['/home/.nvm/versions/node/v24.14.1/bin/node'] = '';
  // CEP's mixed context puts Node's process global on the page; host.ts reads
  // it for processAlive, so a stub without it is not a faithful stub.
  window.process = window.process || { kill: function () { return true; } };
  window.cep_node = {
    global: {},
    require: (id) => {
      // The panel calls path.join and nothing else; a stub offering more would
      // suggest it models more than it does.
      if (id === 'path') return { join: (...p) => p.join('/') };
      if (id === 'fs') {
        const has = (p) =>
          Object.prototype.hasOwnProperty.call(window.__files, p) ||
          Object.prototype.hasOwnProperty.call(window.__repoFiles, p);
        return {
          existsSync: has,
          readFileSync: (p) =>
            Object.prototype.hasOwnProperty.call(window.__files, p)
              ? window.__files[p]
              : window.__repoFiles[p],
          readdirSync: (p) => (p === '/home/.nvm/versions/node' ? ['v24.14.1'] : []),
          realpathSync: (p) => {
            if (!has(p) && p !== window.__repo) throw new Error('ENOENT: ' + p);
            return p;
          },
        };
      }
      if (id === 'os') return { homedir: () => '/home' };
      if (id === 'child_process') {
        // stdio pipes stderr, so the real child has a stream here, not null.
        return { spawn: () => ({ unref: () => {}, on: () => {}, stderr: { on: () => {} } }) };
      }
      throw new Error('unexpected module ' + id);
    },
  };
  window.CSInterface = function () {};
  window.CSInterface.prototype.getSystemPath = function () { return window.__repo + '/panel'; };
`;
}

export const HANDSHAKE = {
  [`${REPO}/.local/service.json`]: JSON.stringify({ port: 51234, token: 't', pid: 4242 }),
};
export const SERVICE_BUILT = { [`${REPO}/service/dist/service.js`]: '' };

export const HEALTHY_PAYLOAD = {
  ok: true,
  serviceVersion: '0.1.0',
  appVersion: '0.1.0',
  promptVersion: 4,
  ffmpeg: { present: true, detail: 'ffmpeg version 8.0.1' },
  ffprobe: { present: true, detail: 'ffprobe version 8.0.1' },
  sidecar: { venv: { present: true, detail: 'Python 3.11.14' }, pythonPath: '/p' },
  templates: { valid: true, issues: [], count: 6 },
  repoRoot: REPO,
  node: { path: '/home/.nvm/versions/node/v24.14.1/bin/node', source: 'nvm', version: 'v24.14.1' },
};

/** Replaces fetch before the bundle runs, so the first health call is the stub. */
export function stubFetch(mode: 'healthy' | 'hang', health: unknown = HEALTHY_PAYLOAD): string {
  return mode === 'hang'
    ? 'window.fetch = () => new Promise(() => {});'
    : `window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(${JSON.stringify(health)}) });`;
}

/**
 * **The money screen is shown the real ledger, never a fixture.**
 *
 * Mohamed rules by eye, so what the test renders has to be what he will see.
 * These are the actual 165 lines read from `.local/costs.jsonl` — read-only, by
 * `readLedger`, which cannot open a file and is handed the text.
 *
 * A machine without a ledger yet — the partner's — gets an empty one, which is
 * what it will genuinely have.
 */
function realReels(): Record<string, unknown>[] {
  const dir = path.join(REPO, 'my files', 'test videos');
  if (!existsSync(dir)) return [];
  const out: Record<string, unknown>[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.editplan.json'))) {
    const plan = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as {
      costs?: { spentUsd?: number; spentByStage?: Record<string, number> };
      source?: { durationS?: number };
    };
    const spent = plan.costs?.spentUsd;
    if (typeof spent !== 'number') continue;
    const durationS = plan.source?.durationS ?? null;
    out.push({
      reel: f.replace(/\.editplan\.json$/, ''),
      spentUsd: spent,
      durationS,
      usdPerSecond: durationS !== null && durationS > 0 ? spent / durationS : null,
      stages: Object.entries(plan.costs?.spentByStage ?? {})
        .filter(([, v]) => v > 0)
        .map(([k]) => k)
        .sort(),
      planUsd: spent,
      ledgerUsd: 0,
      basis: 'plan',
    });
  }
  return out;
}

export function realMoney(): Record<string, unknown> {
  const at = path.join(REPO, '.local', 'costs.jsonl');
  const read = readLedger(existsSync(at) ? readFileSync(at, 'utf8') : '');
  return {
    totalUsd: read.totalUsd,
    lines: read.lines.length,
    unreadable: read.unreadable.length,
    firstAt: read.firstAt,
    lastAt: read.lastAt,
    byDay: byDay(read.lines),
    byMonth: byMonth(read.lines),
    byStage: byStage(read.lines),
    byClient: byClient(read.lines),
    byVideo: byVideo(read.lines),
    byPurpose: byPurpose(read.lines),
    unattributedUsd: unattributed(byClient(read.lines))?.usd ?? 0,
    credit: null,
    /*
     * One reel, from the real plans on this disk, so the screen shows what it
     * will really show. Its basis is whatever the real data gives.
     */
    perReel: realReels(),
    cap: { monthlyUsd: null, monthSoFarUsd: 0 },
    /*
     * No payments: none are recorded on this machine, which is what a real
     * reading gives. Seeding one would make the screen show a figure nobody
     * entered.
     */
    paidIn: { payments: [], totalInUsd: 0, impliedLeftUsd: -read.totalUsd },
    reconciliation: {
      ledgerTotalUsd: read.totalUsd,
      ledgerProductionUsd: read.totalUsd,
      videosAccountForUsd: 0,
      outsideAnyVideoUsd: 0,
      unaccountedUsd: read.totalUsd,
      overclaimedUsd: 0,
      agrees: true,
    },
  };
}

/**
 * **A real mismatch, from the real clients, with nothing added.**
 *
 * Session 76 proved the rule and the wording; session 77 proved the sentence
 * reaches the screen. It is computed by the same `mismatchedClient` the service
 * calls, over the clients exactly as they are on disk.
 *
 * **Session 77 had to lend Dr Loubna a folder in memory**, because neither
 * client had declared one and the rule could therefore find no owner for any
 * video. Mohamed set both folders on 2026-09-09, so the loan is gone: every
 * value below — both names, the folder, the ownership — is read from the two
 * real client files. Nothing is written to them.
 *
 * The video is the one `sora-995f2d27` is built from, which really does sit in
 * Dr Loubna's folder while being attached to K2 Syndicalia.
 */
export function realMismatch(): Record<string, unknown> | null {
  const clients: ClientFolder[] = [];
  for (const id of ['k2-syndicalia', 'dr-loubna-kfafi']) {
    try {
      const m = loadMode(id);
      clients.push({
        id: m.id,
        name: m.name,
        videoFolder: (m as { videoFolder?: string }).videoFolder,
      });
    } catch {
      return null;
    }
  }
  const attached = clients.find((c) => c.id === 'k2-syndicalia');
  if (attached === undefined) return null;
  const m = mismatchedClient({
    videoPath:
      '/Volumes/T7 Shield/Framopia/Clients/Dr Loubna Kfafi/September Content/Exports/Work in Progress/sora.mov',
    attachedTo: { id: attached.id, name: attached.name },
    clients,
  });
  if (m === null) return null;
  return {
    attachedTo: m.attachedTo,
    looksLike: m.looksLike,
    says: mismatchSentence(m),
    offer: reattachSentence(m),
  };
}

/**
 * **The clients exactly as they are on this disk**, shaped the way the service's
 * `/modes` route shapes them.
 *
 * Block 13 session 102 needed the panel's real height, and the stub's client is
 * one line of nothing: no palette, no photographs, no *Change their details*.
 * Dr Loubna Kfafi has four colours, three typefaces and twenty-two photographs,
 * and the card that draws them is what sits between the two decisions on Choose.
 * A height measured without her is a height of a panel nobody uses.
 *
 * Nothing here is invented: `loadMode` reads her file, and the four derivations
 * below are `listModes`' own, kept in the same order so the shapes cannot drift
 * apart without one of them being obviously wrong. Nothing is written.
 */
export function realClients(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const id of ['k2-syndicalia', 'dr-loubna-kfafi']) {
    let mode;
    try {
      mode = loadMode(id);
    } catch {
      continue;
    }
    const d = clientDefaults(mode);
    const entry: Record<string, unknown> = {
      id: mode.id,
      name: mode.name,
      version: mode.version,
      /* `listModes` sends `fontsResolved` and no `fontsStatus`; nothing reads the
         latter, and a harness that sends a field the route does not is a harness
         that can drift. Block 13 session 104 checked the two key by key. */
      fontsResolved: mode.fonts.status === 'set',
      hasFolder: mode.videoFolder !== undefined,
      look: {
        palette: paletteRolesInDisplayOrder().map((role) => ({
          role,
          hex: mode.palette[role],
          what: PALETTE_MEANING[role],
        })),
        fonts:
          mode.fonts.status === 'set'
            ? { latin: mode.fonts.latin, arabic: mode.fonts.arabic, standard: false }
            : { ...STANDARD_FONTS, standard: true },
        logoPath: mode.logoPath ?? null,
      },
      standards: {
        language: d.language,
        videoShape: d.videoShape,
        watermark: d.watermark,
        subtitleBaselineY: d.subtitleBaselineY,
        chosen: Object.entries(d.source)
          .filter(([, from]) => from === 'client')
          .map(([field]) => field),
      },
      /*
       * `onThisMachine` is answered without touching the file: the measurement
       * must not depend on whether his external drive happens to be mounted, and
       * a photograph is never read by anything in a test.
       */
      pictures: (mode.pictures ?? []).map((p) => ({ ...p, onThisMachine: true })),
      editable: {
        name: mode.name,
        ...(mode.about === undefined ? {} : { about: mode.about }),
        ...(mode.videoFolder === undefined ? {} : { videoFolder: mode.videoFolder }),
        ...(mode.logoPath === undefined ? {} : { logoPath: mode.logoPath }),
        ...(mode.language === undefined ? {} : { language: mode.language }),
        ...(mode.videoShape === undefined ? {} : { videoShape: mode.videoShape }),
        ...(mode.subtitleBaselineY === undefined
          ? {}
          : { subtitleBaselineY: mode.subtitleBaselineY }),
        ...(mode.watermarkByDefault === undefined
          ? {}
          : { watermarkByDefault: mode.watermarkByDefault }),
        ...(mode.fonts.status === 'set'
          ? {
              fonts: {
                latin: mode.fonts.latin,
                arabic: mode.fonts.arabic,
                ...(mode.fonts.emphasis === undefined ? {} : { emphasis: mode.fonts.emphasis }),
              },
            }
          : {}),
      },
      folderLeavesOut: null,
    };
    /*
     * **`listModes` sets this and the first draft of this helper did not**, which
     * is not a detail: `FontsNote` reads `mode.fonts`, and without it a client who
     * has chosen her typefaces renders the *no fonts of its own* warning. Block 13
     * session 103 measured Build at 964 px with 193 px of a warning that is not on
     * his screen, and nearly rearranged Build around it.
     */
    if (mode.fonts.status === 'set') {
      entry.fonts = { latin: mode.fonts.latin, arabic: mode.fonts.arabic };
    }
    if (mode.about !== undefined) entry.about = mode.about;
    out.push(entry);
  }
  return out;
}

/** The four stages of a video that has been run all the way through. */
export function stagesAllDone(): Record<string, unknown>[] {
  return [
    ['transcription', 'Writing down the words'],
    ['analysis', 'Choosing the pictures'],
    ['images', 'Drawing the pictures'],
    ['zones', 'Looking at the video'],
  ].map(([id, label]) => ({
    id,
    label,
    status: 'done',
    provenance: 'cache',
    entryId: `${id}-1`,
    estimateUsd: 0,
    action: 'skip',
    note: 'Already done, nothing to pay',
  }));
}

/**
 * **His panel, with his data**: the real clients, a video that has been run all
 * the way through, and the real ledger. What a height measured here reports is a
 * height he could point at on his own screen.
 */
export function realPanelRoutes(): string {
  const clients = realClients();
  const her = clients.find((c) => c.id === 'dr-loubna-kfafi') ?? clients[0];
  const name = (her?.name as string | undefined) ?? 'K2 Syndicalia';
  const id = (her?.id as string | undefined) ?? 'k2-syndicalia';
  return stubRoutes(stepsThrough('build'), 'build', {
    modes: { modes: clients },
    reels: {
      reels: [
        'Dr Loubna Kfafi/September Content/Exports/sora.mov',
        'Dr Loubna Kfafi/September Content/Exports/sculptra-explainer.mov',
        'Dr Loubna Kfafi/September Content/Exports/botox-myths.mov',
        'Dr Loubna Kfafi/September Content/Exports/skin-booster.mov',
      ].map((label, i) => ({
        label,
        present: true,
        durationS: 25.7 + i,
        planPath: `/v/p${String(i)}.json`,
        spentUsd: 3.4025,
      })),
    },
    dry: {
      reel: 'Dr Loubna Kfafi/September Content/Exports/sora.mov',
      videoPath: '/v/sora.mov',
      modeId: id,
      modeName: name,
      modeVersion: 1,
      planPath: '/v/p0.json',
      spentUsd: 3.4025,
      stages: stagesAllDone(),
      estimateUsd: 0,
      reusesOlderGuide: false,
      wordsUsd: 0,
      picturesUsd: 0,
      wordsStages: ['transcription', 'analysis'],
      picturesStages: ['images', 'zones'],
      watermark: true,
      watermarkSize: 'medium',
      watermarkWidthsPx: { small: 216, medium: 324, large: 432 },
      planClientMode: { id, version: 1 },
      mismatch: null,
    },
  });
}

export function stubRoutes(
  steps: unknown,
  resumeAt: string,
  /** Overrides for one route's payload, so a test can vary a single fact. */
  over: Record<string, unknown> = {},
): string {
  const payload = {
    money: realMoney(),
    health: HEALTHY_PAYLOAD,
    reels: { reels: [{ label: 'vitasilk', present: true, durationS: 25.7, planPath: '/v/p.json', spentUsd: 1.550444 }] },
    modes: {
      modes: [
        {
          id: 'k2-syndicalia', name: 'K2 Syndicalia', version: 8, fontsStatus: 'set',
          about: 'Cosmetic clinic, Casablanca',
          look: {
            palette: [
              { role: 'background', hex: '#1A0000', what: 'behind a cut-out picture' },
              { role: 'primary', hex: '#820000', what: 'the deeper of the two frame colours' },
              { role: 'accent', hex: '#C9A96E', what: 'the frame around a picture' },
              { role: 'light', hex: '#F8F6F2', what: 'the lighter of the two frame colours' },
            ],
            fonts: { latin: 'Inter Semi-Bold', arabic: 'Almarai Bold', standard: true },
            logoPath: null,
          },
          standards: {
            language: 'mixed', videoShape: 'vertical', watermark: true,
            subtitleBaselineY: 2480.4, chosen: [],
          },
          pictures: [],
        },
      ],
    },
    dry: {
      reel: 'vitasilk', videoPath: '/v/vitasilk.mov', modeId: 'k2-syndicalia',
      modeName: 'K2 Syndicalia', modeVersion: 6, planPath: '/v/p.json', spentUsd: 1.550444,
      stages: [], estimateUsd: 0, reusesOlderGuide: false,
      wordsUsd: 0, picturesUsd: 0, wordsStages: ['transcription', 'analysis'],
      picturesStages: ['images', 'zones'],
      watermark: true, watermarkSize: 'medium',
      watermarkWidthsPx: { small: 216, medium: 324, large: 432 },
      mismatch: realMismatch(),
    },
    ...over,
    steps: {
      reel: 'vitasilk', planPath: '/v/p.json', steps, resumeAt,
      build: {
        reel: 'vitasilk', planPath: '/v/p.json',
        modeId: 'k2-syndicalia', modeName: 'K2 Syndicalia', modeSource: 'the plan',
        outputPath: '/repo/.local/build/vitasilk-full.aep',
        subtitleCards: 68, keywords: 3, images: 5, sfxEvents: 4,
        watermark: { size: 'medium', widthPx: 324, heightPx: 363 },
        fonts: {
          latin: 'Inter Semi-Bold', arabic: 'Almarai Bold',
          emphasis: 'Cormorant Garamond SemiBold Italic', globalFallback: false,
        },
        client: {
          name: 'K2 Syndicalia', source: 'plan', behind: false,
          note: 'using K2 Syndicalia as it was saved for this video',
        },
        free: true, missing: [],
      },
    },
    keywords: {
      reel: 'vitasilk', planPath: '/v/p.json', keywords: [], promotable: [],
      emptyReason: 'Keyword analysis has not run for this reel yet.',
      source: { stageStatus: 'pending', cacheEntryId: null, cacheProvenance: null, promptVersion: 4, mode: 'auto' },
      subtitleFontSize: 343, keywordFontSize: 425,
    },
    transcript: {
      reel: 'vitasilk', planPath: '/v/p.json', transcriptHash: 'h',
      editCost: 'Editing a word changes the transcript hash.',
      words: [], cards: [], questions: [],
    },
    fonts: {
      available: true,
      names: [
        'AdobeClean-It',
        'Almarai-Bold',
        'CormorantGaramondItalic-SemiBoldItalic',
        'Inter-SemiBold',
      ],
      families: 445,
      trouble: null,
      faces: {
        // What the resolver really answers for these four, measured this session.
        'AdobeClean-It': { file: null, axes: {}, why: 'the system offers no file for this font' },
        'Almarai-Bold': { file: '/Users/x/Library/Fonts/Almarai-Bold.ttf', axes: {}, why: null },
        'CormorantGaramondItalic-SemiBoldItalic': {
          file: '/Users/x/Library/Fonts/CormorantGaramond-Italic-VariableFont_wght.ttf',
          axes: { wght: 600 },
          why: null,
        },
        'Inter-SemiBold': {
          file: '/Users/x/Library/Fonts/Inter-VariableFont_opsz,wght.ttf',
          axes: { wght: 600 },
          why: null,
        },
      },
    },
    preview: {
      framePath: '/repo/.local/cv/vitasilk/frames-2fps/frame-0020.png',
      fromReel: 'vitasilk',
      frameWidth: 2160, frameHeight: 3840,
      sourceWidth: 2160, sourceHeight: 3840,
      defaultBaselineY: 2480.4,
    },
  };
  return `
  window.__payload = ${JSON.stringify(payload)};
  window.__polls = 0;
  window.fetch = (url) => {
    const p = window.__payload;
    const u = String(url);
    if (u.indexOf('/jobs/') !== -1) {
      window.__polls += 1;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(window.__job()) });
    }
    if (u.indexOf('/jobs') !== -1) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'job-1' }) });
    }
    const body = u.indexOf('/health') !== -1 ? p.health
      : u.indexOf('/subtitle-preview') !== -1 ? p.preview
      : u.indexOf('/fonts') !== -1 ? p.fonts
      : u.indexOf('/reels') !== -1 ? p.reels
      : u.indexOf('/modes') !== -1 ? p.modes
      : u.indexOf('/keywords') !== -1 ? p.keywords
      : u.indexOf('/transcript') !== -1 ? p.transcript
      : u.indexOf('/money') !== -1 ? p.money
      : u.indexOf('/steps') !== -1 ? p.steps
      : p.dry;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };`;
}

export function stepsThrough(upTo: string): unknown[] {
  const order = ['reel', 'transcript', 'keywords', 'images', 'build'];
  const labels: Record<string, string> = {
    reel: 'Reel', transcript: 'Transcript', keywords: 'Keywords', images: 'Images', build: 'Build',
  };
  const cut = order.indexOf(upTo);
  return order.map((id, i) => ({
    id,
    label: labels[id],
    available: i <= cut,
    reason: i <= cut ? null : `${labels[id]} has not run for this reel.`,
    summary: i <= cut ? `${labels[id]} summary from the plan` : null,
  }));
}

/**
 * **Which of the panel's screens a test is asserting on.**
 *
 * Block 13 session 95 built Choose, Make and Build — three screens instead of
 * one 1288 px scroll — measured them at 705, 781 and 656 px, and **reverted
 * them**, because the browser tests encode *everything is on one page* in their
 * loaders. Four rounds of teaching each loader to navigate went 24 → 20 → 58 →
 * 51 failures and did not converge.
 *
 * This is the one way to say it, and it is deliberately **correct under both
 * panels**:
 *
 * - While the panel is one page there is no switcher, so there is nothing to
 *   press — and the anchor below is on screen already.
 * - Once the screens land there is a switcher, it is pressed, and the anchor is
 *   on screen because pressing it put it there.
 *
 * So a test converted today does not move again in session 97, which is the
 * whole point of doing this separately.
 */
export type Screen = 'choose' | 'run' | 'build';

/**
 * **The section that proves you are on a screen**, chosen so that each exists in
 * both panels: `section.video` is the video picker, `section.cost` is the money
 * and the run buttons, `section.change` is the editors. None of them moves
 * between the one-page panel and the three-screen one — only which of them is
 * rendered at a time does.
 */
const ANCHOR: Record<Screen, string> = {
  choose: 'section.video',
  run: 'section.cost',
  build: 'section.change',
};

const ORDER: Record<Screen, number> = { choose: 1, run: 2, build: 3 };

interface DrivablePage {
  $: (selector: string) => Promise<unknown>;
  click: (selector: string, options?: { timeout?: number }) => Promise<void>;
  waitForSelector: (
    selector: string,
    options?: { timeout?: number; state?: 'visible' },
  ) => Promise<unknown>;
  $eval: <T>(selector: string, fn: (el: Element) => T) => Promise<T>;
}

/**
 * Puts the panel on `screen` and **proves it got there**.
 *
 * The proof is the point. Block 11 session 69 shipped a test that passed over
 * hidden text, because `textContent` returns what is display:none — so this does
 * not merely wait for the anchor to exist, it asks the browser whether the
 * element is actually being rendered. A test that declares the wrong screen
 * fails here, loudly, rather than asserting against something nobody can see.
 */
/**
 * **Opens the reference a screen keeps behind one press, and proves it opened.**
 *
 * Block 13 session 102 put the client card and the watermark control behind
 * `<details class="quibbles">`: reference, not decision. Measured with his own
 * data the client card alone is 3500 px of a 900 px panel, sitting between the
 * two decisions Choose exists for.
 *
 * This is the companion to `onScreen`, and it is written the same way — **correct
 * whether or not the thing is behind a disclosure**. A test that needs to see the
 * card asks for it; if there is no disclosure it is already open, and if there is
 * one it gets pressed. So a test converted today does not move again when the
 * next session collapses something else.
 *
 * The proof matters as much as the press: `checkVisibility()` rather than a
 * selector match, because a closed `<details>` still has every word of its
 * contents in the page — Block 11 session 69's lesson, and the reason these
 * thirteen tests failed loudly this session instead of passing over hidden text.
 */
export async function openReference(page: DrivablePage, inside: string): Promise<void> {
  /*
   * **Pressed, not forced open.** One of these is a controlled `<details>` whose
   * open state React owns, so setting the DOM property would be undone on the
   * next render — and a test that reaches past the control is not testing what he
   * does. This marks the summary, presses it, and takes the mark off again.
   */
  const needsPressing = await page.$eval(inside, (el) => {
    const box = el.closest('details');
    if (box === null) return false;
    if (box.open) return false;
    box.querySelector('summary')?.setAttribute('data-openme', '');
    return true;
  });
  if (needsPressing) {
    await page.click('summary[data-openme]', { timeout: 4_000 });
    await page.$eval(inside, (el) =>
      el.closest('details')?.querySelector('summary')?.removeAttribute('data-openme'),
    );
  }
  await page.waitForSelector(inside, { timeout: 4_000, state: 'visible' });
}

/**
 * **His panel, at a width you choose.**
 *
 * Block 13 session 106 moved this out of `width.browser.test.ts`. It lived there
 * and two test files imported it — and importing a test module makes vitest
 * register that module's `describe` blocks a second time, so nine width tests ran
 * twice and the suite's own count was inflated by nine. A shared helper belongs in
 * the harness; a test file exports nothing.
 *
 * The width is a parameter because every ruler this project wrote before session
 * 105 rendered at 420 px while his window is roughly 1500.
 */
export async function hisPanelAt(browser: Browser, width: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript(stubHost(HANDSHAKE));
  await page.addInitScript(realPanelRoutes());
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

/** The three widths this panel is measured at: his, a middle one, and docked. */
export const WIDTHS = [
  ['his window', 1500],
  ['a middle width', 900],
  ['narrow', 380],
] as const;

export async function onScreen(page: DrivablePage, screen: Screen): Promise<void> {
  const switcher = await page.$('nav.moments');
  if (switcher !== null && switcher !== undefined) {
    await page.click(`nav.moments button.moment:nth-of-type(${String(ORDER[screen])})`, {
      timeout: 10_000,
    });
  }
  const anchor = ANCHOR[screen];
  /*
   * **Shorter than a test's own bound on purpose.** At 10 s this outlived the
   * 5 s default and a test that was looking at the wrong screen reported only
   * "Test timed out", which says nothing about why. At 4 s the helper fails
   * first and says which screen and which anchor — the panel is already loaded
   * by the time anything calls this, so the wait is for a press to take effect,
   * not for a page to arrive.
   */
  try {
    await page.waitForSelector(anchor, { timeout: 4_000, state: 'visible' });
  } catch {
    throw new Error(
      `the panel is not showing the ${screen} screen: ${anchor} never became visible`,
    );
  }
  const shown = await page.$eval(anchor, (el) =>
    typeof (el as HTMLElement).checkVisibility === 'function'
      ? (el as HTMLElement).checkVisibility()
      : (el as HTMLElement).offsetParent !== null,
  );
  if (!shown) {
    throw new Error(
      `the panel is not showing the ${screen} screen: ${anchor} is in the page but not visible`,
    );
  }
}
