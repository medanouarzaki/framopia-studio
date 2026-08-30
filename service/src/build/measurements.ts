import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadSfxIndex, loadTemplateManifest, templatesById } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { deriveSfxEvents } from '../analysis/sfx.js';
import { templateImpacts } from '../analysis/template-impacts.js';
import {
  hashFileSync,
  loudnessIsFresh,
  measureLoudness,
  LOUDNESS_VERSION,
  REPO_ROOT,
  type LoudnessRecord,
} from '@framopia/core';

/**
 * The two free local measurements a build refuses without, driven.
 *
 * `handoffs/block-8.md` §9 lists both as terminal-only, and the user does not
 * use a terminal: `npm run watermark:measure` produces the watermark's own
 * facts, and `npm run loudness:measure` produces the dialogue level that
 * `npm run migrate:sfx-placement` then copies onto a plan — **two hops**,
 * neither of which he can make. Without the first a reel that asked for a
 * watermark is built with none; without the second nothing is attenuated and
 * every sound sums past 0 dBFS.
 *
 * They are seconds rather than the half-minute frame analysis takes — 2.4 s for
 * the watermark and about 0.2 s per reel for the loudness — so they run inside
 * an existing stage rather than becoming stages of their own.
 *
 * **Each carries a freshness record and the record is the artifact.** Terminal
 * output scrolls away and is not committed; a file beside the measurement says
 * what was measured, from which input, at which hash, when, and by which code.
 * Frame analysis learned this the same way.
 */

export const WATERMARK_ASSET = path.join(REPO_ROOT, 'assets', 'watermark', 'intro.mov');
export const WATERMARK_FACTS_PATH = path.join(REPO_ROOT, '.local', 'build', 'watermark.json');
export const WATERMARK_CLI = path.join(REPO_ROOT, 'tools', 'measure-watermark', 'cli.ts');

/** Bumped when the fields a build reads out of the facts change. */
export const WATERMARK_FACTS_VERSION = 1;

export interface WatermarkFacts {
  schemaVersion?: number;
  path: string;
  sha256: string;
  width: number;
  height: number;
  frames: number;
  lastBeepEndS: number | null;
  alphaIsPremultiplied: boolean;
  measuredAt?: string;
}

export interface MeasurementNeed {
  what: string;
  consequence: string;
  command: string;
}

/**
 * A missing input refuses by name; it never returns an empty result.
 *
 * An empty result is exactly the shape that put a 2030 px picture across the
 * speaker while every check reported success — session 38's defect, and the
 * reason `placementIsSafe` takes a required face box.
 */
export class MeasurementUnavailableError extends Error {
  constructor(readonly needs: MeasurementNeed[]) {
    super(
      'a build measurement could not be taken: ' +
        needs
          .map((n) => `${n.what}\n    without it: ${n.consequence}\n    run: ${n.command}`)
          .join('\n  '),
    );
    this.name = 'MeasurementUnavailableError';
  }
}

export function readWatermarkFacts(factsPath = WATERMARK_FACTS_PATH): WatermarkFacts | null {
  if (!existsSync(factsPath)) return null;
  try {
    return JSON.parse(readFileSync(factsPath, 'utf8')) as WatermarkFacts;
  } catch {
    // A corrupt record is a re-measurement, never a crash and never a default.
    return null;
  }
}

export function watermarkFactsAreFresh(
  facts: WatermarkFacts | null,
  assetSha256: string,
): { fresh: boolean; why: string } {
  if (facts === null) return { fresh: false, why: 'nothing has measured the watermark' };
  if ((facts.schemaVersion ?? 0) !== WATERMARK_FACTS_VERSION) {
    return { fresh: false, why: `measured by version ${facts.schemaVersion ?? 0}, now ${WATERMARK_FACTS_VERSION}` };
  }
  if (facts.sha256 !== assetSha256) {
    return { fresh: false, why: 'the watermark file has changed since it was measured' };
  }
  return { fresh: true, why: 'already measured from this exact file' };
}

/**
 * Runs the watermark measurement by **spawning the tool a terminal runs**,
 * rather than reimplementing it.
 *
 * The measurement is 680 lines of ffprobe and frame reading — the alpha
 * straight-vs-premultiplied test, the beep envelope, the per-frame bounding box
 * — and it also writes the evidence document those figures are quoted from. Two
 * implementations of that would be two answers to one question; the build job
 * spawns `build-reel-cli.js` for the same reason, so the panel and the terminal
 * run the same file rather than equivalent ones.
 */
export function ensureWatermarkFacts(
  options: { log?: (m: string) => void } = {},
): { measured: boolean; why: string; facts: WatermarkFacts } {
  const { log = (): void => undefined } = options;
  const needs: MeasurementNeed[] = [];
  if (!existsSync(WATERMARK_ASSET)) {
    needs.push({
      what: `the watermark itself, ${path.relative(REPO_ROOT, WATERMARK_ASSET)}`,
      consequence: 'a reel that asks for the mark is built without one, and looks like one that never asked',
      command: 'restore assets/watermark/intro.mov from git',
    });
    throw new MeasurementUnavailableError(needs);
  }

  const assetSha = hashFileSync(WATERMARK_ASSET);
  const existing = readWatermarkFacts();
  const fresh = watermarkFactsAreFresh(existing, assetSha);
  if (fresh.fresh && existing !== null) {
    log(`watermark: ${fresh.why}`);
    return { measured: false, why: fresh.why, facts: existing };
  }

  log(`watermark: measuring — ${fresh.why}`);
  if (!existsSync(WATERMARK_CLI)) {
    throw new MeasurementUnavailableError([{
      what: `the watermark measuring tool, ${path.relative(REPO_ROOT, WATERMARK_CLI)}`,
      consequence: 'the watermark cannot be measured, so a reel that asks for it is built without one',
      command: 'restore tools/measure-watermark/ from git',
    }]);
  }

  /*
   * `process.execPath` rather than core's `resolveNodePath`: that one exists
   * for the panel, which runs inside After Effects where `execPath` is After
   * Effects itself. This is the service, which is a Node process, so the binary
   * running this line is the one to run the tool with.
   */
  const proc = spawnSync(process.execPath, ['--import', 'tsx', WATERMARK_CLI], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  if (proc.status !== 0) {
    throw new MeasurementUnavailableError([{
      what: 'the watermark measurement, which did not complete',
      consequence: 'a reel that asks for the mark is built without one',
      command: `npm run watermark:measure  (it said: ${(proc.stderr ?? '').trim().split('\n').pop() ?? 'nothing'})`,
    }]);
  }

  const written = readWatermarkFacts();
  const after = watermarkFactsAreFresh(written, assetSha);
  if (written === null || !after.fresh) {
    throw new MeasurementUnavailableError([{
      what: 'a usable watermark measurement; the tool ran but left nothing this build can read',
      consequence: 'a reel that asks for the mark is built without one',
      command: 'npm run watermark:measure',
    }]);
  }
  log(`watermark: measured, ${written.width}x${written.height}, ${written.frames} frames`);
  return { measured: true, why: fresh.why, facts: written };
}

export function loudnessRecordPath(videoPath: string): string {
  const stem = path.basename(videoPath).replace(/\.[^.]+$/, '');
  return path.join(REPO_ROOT, '.local', 'build', 'loudness', `${stem}.json`);
}

export function readLoudnessRecord(recordPath: string): LoudnessRecord | null {
  if (!existsSync(recordPath)) return null;
  try {
    return JSON.parse(readFileSync(recordPath, 'utf8')) as LoudnessRecord;
  } catch {
    return null;
  }
}

/**
 * Measures this reel's dialogue level, if the record on disk does not already
 * describe this exact video.
 *
 * The hash is the plan's own `source.sha256`, which transcription computed:
 * hashing a 2.4 GB reel takes seven seconds and the answer is already known.
 */
export function ensureLoudness(options: {
  videoPath: string;
  reel: string;
  sourceSha256: string;
  log?: (m: string) => void;
}): { record: LoudnessRecord; measured: boolean; why: string } {
  const { videoPath, reel, sourceSha256, log = (): void => undefined } = options;
  if (!existsSync(videoPath)) {
    throw new MeasurementUnavailableError([{
      what: `the video itself, ${videoPath}`,
      consequence: 'the speaking cannot be measured, so every sound is mixed against nothing and clips',
      command: 'plug in the drive the footage is on',
    }]);
  }

  const recordPath = loudnessRecordPath(videoPath);
  const existing = readLoudnessRecord(recordPath);
  const fresh = loudnessIsFresh(existing, videoPath, sourceSha256);
  if (fresh.fresh && existing !== null) {
    log(`loudness: ${fresh.why}`);
    return { record: existing, measured: false, why: fresh.why };
  }

  log(`loudness: measuring — ${fresh.why}`);
  const measurement = measureLoudness(videoPath, reel);
  const record: LoudnessRecord = {
    ...measurement,
    schemaVersion: LOUDNESS_VERSION,
    sourcePath: videoPath,
    sourceSha256,
  };
  mkdirSync(path.dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  log(
    `loudness: ${record.integratedLufs.toFixed(1)} LUFS, peak ${record.truePeakDbfs.toFixed(1)} dBFS`,
  );
  return { record, measured: true, why: fresh.why };
}

/**
 * Puts the measured level on the plan, and re-derives what depends on it.
 *
 * **This is the second hop, and it is why measuring was not enough.** The level
 * reached a plan only through `npm run migrate:sfx-placement`, which read the
 * corpus sweep and copied two numbers across; the build then read them off the
 * plan. Measuring without this would leave `dialogueLufs` undefined and the
 * build refusing exactly as before.
 *
 * SFX gains are computed from the level, so a plan that already carries events
 * derived against no level has them re-derived here — free, local and
 * deterministic, the same `deriveSfxEvents` the analysis stage calls. A plan
 * with no events yet is left alone: analysis derives them, and by then the
 * level is on the plan.
 */
export async function applyLoudnessToPlan(options: {
  planPath: string;
  record: LoudnessRecord;
  log?: (m: string) => void;
}): Promise<{ changed: boolean; sfxRederived: boolean }> {
  const { planPath, record, log = (): void => undefined } = options;
  const plan = await readEditPlan(planPath);

  const same =
    plan.source.dialogueLufs === record.integratedLufs &&
    plan.source.dialoguePeakDbfs === record.truePeakDbfs;
  if (same) return { changed: false, sfxRederived: false };

  plan.source.dialogueLufs = record.integratedLufs;
  plan.source.dialoguePeakDbfs = record.truePeakDbfs;

  let sfxRederived = false;
  if (plan.sfx.events.length > 0) {
    const templates = templatesById(loadTemplateManifest());
    plan.sfx = {
      events: deriveSfxEvents(
        plan,
        templates,
        loadSfxIndex(),
        templateImpacts(),
        plan.source.dialogueLufs,
        plan.source.dialoguePeakDbfs,
      ),
    };
    sfxRederived = true;
  }

  await writeEditPlan(planPath, plan);
  log(
    `loudness: written onto the plan (${record.integratedLufs.toFixed(1)} LUFS)` +
      (sfxRederived ? `, ${plan.sfx.events.length} sounds re-levelled` : ''),
  );
  return { changed: true, sfxRederived };
}
