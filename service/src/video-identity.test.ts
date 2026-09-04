import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@framopia/core';
import {
  videoDirName,
  videoNameFromDirName,
  videoOf,
  type VideoIdentity,
} from './video-identity.js';
import { reelFramesDir, framesManifestPath } from './frames/sample.js';
import { reelMasksDir } from './frames/segment.js';
import { frameAnalysisManifestPath } from './frames/analyse.js';
import { loudnessRecordPath } from './build/measurements.js';
import { extractedAudioPath } from './transcription/media.js';
import { editPlanPathFor } from './editplan/io.js';
import { cutoutDirFor } from './images/job.js';
import { buildOutputPath } from './steps.js';

/**
 * The two files that cost this project $1.01 and very nearly a wrong comp.
 * Both are called `sora.mov`; they are different recordings in different
 * folders of the same client's drive.
 */
const HERS: VideoIdentity = {
  path: '/Clients/Dr Loubna Kfafi/Framopia Studio Inputs/Footages/sora.mov',
  sha256: '619b8eaecae46b0da6f3c8cc9f9b08636a348a1d2ecef40bcdaa7e8cac2c4b67',
};
const THE_OTHER: VideoIdentity = {
  path: '/Clients/Dr Loubna Kfafi/September Content/Exports/Work in Progress/sora.mov',
  sha256: '344265a032513979f101133e68622adf95f001844def480cbeaf3bd9b297bd85',
};

describe('videoDirName', () => {
  it('keeps the name he gave the file, so .local stays readable', () => {
    expect(videoDirName(HERS)).toBe('sora-619b8eaecae4');
  });

  it('separates two files of the same name', () => {
    expect(videoDirName(HERS)).not.toBe(videoDirName(THE_OTHER));
  });

  it('is the same for the same file whatever else has happened', () => {
    expect(videoDirName(HERS)).toBe(videoDirName({ ...HERS }));
  });

  it('refuses a hash that is not one, rather than filing under a guess', () => {
    expect(() => videoDirName({ path: '/a/sora.mov', sha256: 'unknown' })).toThrow(/sha256/);
  });

  it('gives the name back for what a person reads on screen', () => {
    expect(videoNameFromDirName(videoDirName(HERS))).toBe('sora');
    expect(videoNameFromDirName('ground truth-2b3957559a49')).toBe('ground truth');
  });

  it('leaves a name that was never hashed alone', () => {
    expect(videoNameFromDirName('vitasilk')).toBe('vitasilk');
  });

  it('reads a plan source without either end spelling the fields twice', () => {
    expect(videoOf({ videoPath: HERS.path, sha256: HERS.sha256 })).toEqual(HERS);
  });
});

describe('two videos called sora.mov', () => {
  /**
   * Every place the product files something under a video. Each entry is a
   * live call, so a site that goes back to keying on the filename fails here
   * rather than being found by a wrong comp.
   */
  const places: [string, (v: VideoIdentity) => string][] = [
    ['sampled frames', (v) => reelFramesDir(v)],
    ['the frames manifest', (v) => framesManifestPath(v)],
    ['face masks', (v) => reelMasksDir(v)],
    ['the frame-analysis manifest', (v) => frameAnalysisManifestPath(v)],
    ['the loudness record', (v) => loudnessRecordPath(v)],
    ['extracted audio', (v) => extractedAudioPath(v.path, '/audio', v.sha256)],
    ['the Edit Plan', (v) => editPlanPathFor(v.path)],
    ['generated cutouts', (v) => cutoutDirFor(editPlanPathFor(v.path))],
    ['the built comp', (v) => buildOutputPath(editPlanPathFor(v.path))],
  ];

  for (const [what, where] of places) {
    it(`do not share ${what}`, () => {
      expect(where(HERS)).not.toBe(where(THE_OTHER));
    });
  }

  it('each still reads as sora to a person looking in .local', () => {
    for (const [, where] of places) {
      expect(where(HERS)).toContain('sora');
      expect(where(THE_OTHER)).toContain('sora');
    }
  });
});

/**
 * The behavioural tests above catch a site that regresses. This catches a site
 * that is *added* — a new directory under `.local/cv/` or a new record beside
 * the loudness ones, named the old way, which the tests above would not know
 * to call.
 */
describe('nothing files a video by its name alone', () => {
  const KEYED_DIRS = [/LOCAL_DIR,\s*'cv'/, /'\.local',\s*'build',\s*'loudness'/];

  function sources(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        sources(full, found);
        continue;
      }
      if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) found.push(full);
    }
    return found;
  }

  it('every module that names a per-video directory goes through videoDirName', () => {
    const offenders: string[] = [];
    for (const file of sources(path.join(REPO_ROOT, 'service', 'src'))) {
      const text = readFileSync(file, 'utf8');
      if (!KEYED_DIRS.some((pattern) => pattern.test(text))) continue;
      // subtitle-preview lists what is already there; it names nothing.
      if (file.endsWith(path.join('src', 'subtitle-preview.ts'))) continue;
      if (!text.includes('videoDirName')) offenders.push(path.relative(REPO_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
