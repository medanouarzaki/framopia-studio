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
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function stubRoutes(steps: unknown, resumeAt: string): string {
  const payload = {
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
      watermark: true, watermarkSize: 'medium',
      watermarkWidthsPx: { small: 216, medium: 324, large: 432 },
    },
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
