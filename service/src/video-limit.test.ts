import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@framopia/core';
import { PIPELINE_CEILING_USD as FROM_PIPELINE } from './pipeline.js';
import {
  PIPELINE_CEILING_USD,
  readVideoLimitUsd,
  setVideoLimitUsd,
  VIDEO_LIMIT_PATH,
} from './video-limit.js';
import { assertWithinCeiling, exceedsCeiling } from './images/estimate.js';
import { moneyView } from './money.js';
import { startServer, type RunningService } from './server.js';
import { dryRun } from './dry-run.js';

/**
 * **The limit that refused him is his to set, and still refuses.** Block 15
 * session 119: a 70-second client video priced at $6.87 was refused against a
 * $4.00 constant nothing in the panel could reach. He ruled that it stays a
 * refusal, that he sets it, and that it starts where it was.
 */
const scratch: string[] = [];
function scratchFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-video-limit-'));
  scratch.push(dir);
  return path.join(dir, 'video-limit.json');
}
afterAll(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the most for one video', () => {
  it('starts where it always was, so nobody’s run changes because it exists', () => {
    expect(PIPELINE_CEILING_USD).toBe(4);
    expect(FROM_PIPELINE).toBe(PIPELINE_CEILING_USD);
    expect(readVideoLimitUsd(scratchFile())).toBe(4);
  });

  it('reads back what he saved', () => {
    const file = scratchFile();
    setVideoLimitUsd(8, file);
    expect(readVideoLimitUsd(file)).toBe(8);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ usd: 8 });
  });

  it('refuses a figure that is not an amount above zero, and writes nothing', () => {
    const file = scratchFile();
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => setVideoLimitUsd(bad, file)).toThrow('an amount above zero');
    }
    expect(readdirSync(path.dirname(file))).toEqual([]);
  });

  it('falls back to the start when the file is unreadable, rather than to no limit', () => {
    const file = scratchFile();
    for (const text of ['not json', '{"usd":0}', '{"usd":"8"}', '{}']) {
      writeFileSync(file, text, 'utf8');
      expect(readVideoLimitUsd(file)).toBe(PIPELINE_CEILING_USD);
    }
  });

  /*
   * His video's own figures, from the dry run on 2026-09-30: 38 candidates at
   * the gate's $0.1809 each. The comparison is the one that refused him.
   */
  it('lets his video through above $6.87 and refuses it at $4.00', () => {
    const estimate = {
      modelId: 'gemini-3-pro-image-preview',
      resolution: '2K',
      slots: 19,
      candidatesPerSlot: 2,
      images: 38,
      publishedUsd: 0.134,
      perImageUsd: 0.1809,
      usd: 6.8742,
    } as Parameters<typeof assertWithinCeiling>[0];
    expect(() => assertWithinCeiling(estimate, 4)).toThrow('over the $4.00 ceiling');
    expect(() => assertWithinCeiling(estimate, 6.87)).toThrow('over the $6.87 ceiling');
    expect(() => assertWithinCeiling(estimate, 6.88)).not.toThrow();
    expect(() => assertWithinCeiling(estimate, 7)).not.toThrow();
  });

  it('is on the money screen beside the cap, and is not the cap', () => {
    const view = moneyView({ planPaths: [] });
    expect(view.videoLimitUsd).toBe(readVideoLimitUsd());
    expect(view.cap).not.toHaveProperty('videoLimitUsd');
  });

  it('lives in a file of its own, never inside the monthly cap’s', () => {
    expect(path.basename(VIDEO_LIMIT_PATH)).toBe('video-limit.json');
  });
});

/**
 * **Every run reads his figure.** The pipeline's default is the start, so a
 * caller that forgets to pass it would quietly go back to $4.00 — the defect
 * this session exists to close. Asserted on the source because the two callers
 * are job runners that spend money, and neither can be driven here without it.
 */
describe('every run that can spend reads his figure', () => {
  const code = (file: string): string =>
    readFileSync(path.join(REPO_ROOT, 'service', 'src', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it.each(['pipeline.ts', 'queue.ts'])('%s passes it to every run it starts', (file) => {
    const calls = code(file).split('runPipeline({').slice(1);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const args = call.slice(0, call.indexOf('});'));
      expect(args).toContain('ceilingUsd: readVideoLimitUsd()');
    }
  });

  it('is asked of the same comparison by the dry run and the gate', () => {
    expect(code('dry-run.ts')).toContain('exceedsCeiling(picturesUsd, videoLimitUsd)');
    expect(code('images/estimate.ts')).toMatch(/if \(exceedsCeiling\(estimate\.usd, ceilingUsd\)\)/);
    expect(exceedsCeiling(6.8742, 4)).toBe(true);
    expect(exceedsCeiling(6.8742, 6.88)).toBe(false);
    expect(exceedsCeiling(4, 4)).toBe(false);
  });
});

describe('what the dry run says about the limit', () => {
  it('says a reel that owes pictures is refused below its price and not above it', async () => {
    const at = await dryRun('ground-truth', 'k2-syndicalia');
    expect(at.picturesUsd).toBeGreaterThan(0);
    expect(at.videoLimitUsd).toBe(readVideoLimitUsd());

    const below = await dryRun('ground-truth', 'k2-syndicalia', {
      videoLimitUsd: at.picturesUsd / 2,
    });
    expect(below.picturesOverLimit).toBe(true);
    const above = await dryRun('ground-truth', 'k2-syndicalia', {
      videoLimitUsd: at.picturesUsd + 1,
    });
    expect(above.picturesOverLimit).toBe(false);
    // The limit changes the verdict and nothing else.
    expect({ ...above, videoLimitUsd: 0, picturesOverLimit: null }).toEqual({
      ...below,
      videoLimitUsd: 0,
      picturesOverLimit: null,
    });
  });

  it('never says a reel with nothing to pay is over any limit', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia', { videoLimitUsd: 0.01 });
    expect(plan.picturesUsd).toBe(0);
    expect(plan.picturesOverLimit).toBe(false);
  });
});

describe('POST /money/video-limit', () => {
  let running: RunningService;
  let base: string;
  beforeEach(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-server-'));
    scratch.push(dir);
    running = await startServer({ force: true, lockFile: path.join(dir, 'lock.json') });
    base = `http://127.0.0.1:${running.port}`;
  });
  afterEach(() => {
    running.server.close();
  });

  /*
   * Only the refusals are driven here. A save would write this machine's own
   * figure, and a test has no business changing what refuses his next run —
   * saving is proved above against a scratch file.
   */
  it('refuses anything that is not an amount above zero, and writes nothing', async () => {
    const before = readVideoLimitUsd();
    for (const body of [{}, { usd: 0 }, { usd: -3 }, { usd: '8' }, { usd: null }]) {
      const res = await fetch(`${base}/money/video-limit`, {
        method: 'POST',
        headers: { 'x-service-token': running.token, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toContain('above zero');
    }
    expect(readVideoLimitUsd()).toBe(before);
  });

  it('rejects a request with no token', async () => {
    const res = await fetch(`${base}/money/video-limit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usd: -1 }),
    });
    expect(res.status).toBe(401);
  });
});
