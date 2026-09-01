import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  REPO_ROOT,
  loadTemplateManifest,
  resolveFfmpegPath,
  templatesById,
  type AuditComp,
} from '@framopia/core';
import { rememberVideo } from './videos.js';
import { runPipeline } from './pipeline.js';
import { editPlanPathFor, readEditPlan } from './editplan/io.js';
import { reelMasksDir } from './frames/segment.js';
import { reelFramesDir } from './frames/sample.js';
import { buildReel } from './build/reel-plan.js';
import { buildChoiceFor } from './build/choose-candidate.js';
import { buildRequirements, missingRequirements, readBuildDisk } from './build/requirements.js';
import { resolveClientIdentity } from './build/client-identity.js';
import { faceBoxesFor } from './placement/face-boxes.js';
import { placementIsSafe, reelPlacements } from './placement/top-left.js';
import type { Rect } from './placement/geometry.js';
import { transcribeVideo } from './transcription/job.js';
import { analyseKeywordsForPlan, planImageSlotsForPlan } from './analysis/job.js';
import { analyseKeywordsCached, planSlotsCached } from './analysis/cached.js';
import { cutoutDirFor, generateImagesForPlan } from './images/job.js';
import { SIDECAR_PYTHON } from './images/sidecar.js';

/**
 * **A video the tool has never seen, from nothing to a plan a build can use.**
 *
 * The five corpus reels accumulated their state over months: a stage wrote some
 * of it, a one-off `npm run` command wrote the rest, and a hand edit in an old
 * session wrote what was left. A new video gets only what the pipeline
 * produces, and nothing had ever measured the difference — so the user found it
 * four times in a row on his own client reel, one failure at a time.
 *
 * This runs the real pipeline on a file that has never existed, with the three
 * billable stages' network calls replaced and nothing else, and then asks the
 * builder to plan the reel. It stops short of driving After Effects, because
 * `npm run check` has to pass on a machine that has none — what it pins is that
 * everything a build reads is on the plan when the pipeline finishes.
 *
 * **No request can leave this machine**, and that is by construction rather
 * than by intent: `transcribeVideo`, `analyseKeywordsForPlan`,
 * `planImageSlotsForPlan` and `generateImagesForPlan` each take the thing that
 * would make the call as an argument, and every one of them is given a local
 * substitute here. No API key is read and no client is constructed. The ledger
 * is pointed at a temporary file, so a fabricated cost could not reach the real
 * one either.
 */
const FFMPEG = (() => {
  try {
    return resolveFfmpegPath('ffmpeg').path;
  } catch {
    return null;
  }
})();
const SOURCE = path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.mov');
const ready = FFMPEG !== null && existsSync(SOURCE) && existsSync(SIDECAR_PYTHON);

let dir: string;
let videoPath: string;
const saved = process.env['FRAMOPIA_VIDEO_REGISTRY'];

beforeAll(() => {
  if (!ready) return;
  dir = mkdtempSync(path.join(tmpdir(), 'framopia-new-video-'));
  videoPath = path.join(dir, 'a video this tool has never seen.mov');
  // Six seconds of a corpus reel, re-encoded: a new file with a new hash that
  // nothing in this repository has ever been run against. The source is read
  // only.
  execFileSync(
    FFMPEG as string,
    ['-y', '-ss', '2', '-t', '6', '-i', SOURCE, '-c:v', 'prores_ks', '-profile:v', '3',
     '-c:a', 'pcm_s16le', videoPath],
    { stdio: 'ignore' },
  );
  process.env['FRAMOPIA_VIDEO_REGISTRY'] = path.join(dir, 'videos.json');
});

afterAll(() => {
  if (saved === undefined) delete process.env['FRAMOPIA_VIDEO_REGISTRY'];
  else process.env['FRAMOPIA_VIDEO_REGISTRY'] = saved;
  /*
   * The video is outside the repository, so its plan, its frames and its
   * cutouts are not inside `dir`: they follow the rules that decide where each
   * of those lives. A test cleans up what it wrote, wherever the rules sent it
   * — session 30's `job.test.ts` left 65 stray plans behind by not doing this.
   */
  if (videoPath !== undefined) {
    rmSync(cutoutDirFor(editPlanPathFor(videoPath)), { recursive: true, force: true });
    rmSync(editPlanPathFor(videoPath), { force: true });
    rmSync(reelMasksDir(videoPath), { recursive: true, force: true });
    rmSync(reelFramesDir(videoPath), { recursive: true, force: true });
    rmSync(path.dirname(reelMasksDir(videoPath)), { recursive: true, force: true });
  }
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** What the model would have answered, replayed from here instead. */
const KEYWORD_JSON = "{\"candidates\": [{\"wordIds\": [\"w0004\", \"w0005\"], \"score\": 0.95, \"reason\": \"the claim\", \"kind\": \"promise\"}]}";
const SLOT_JSON = "{\"candidates\": [{\"wordIds\": [\"w0002\", \"w0003\"], \"idea\": \"a single silk ribbon\", \"score\": 0.9}]}";

/** Two Arabic words and two Latin ones, with timings a 6s clip can hold. */
const DRAFT = [
  { text: 'السلام', start: 0.4, end: 0.9 },
  { text: 'عليكم', start: 0.95, end: 1.4 },
  { text: 'Vita', start: 2.0, end: 2.4 },
  { text: 'Silk', start: 2.45, end: 2.9 },
  { text: 'البشرة', start: 3.4, end: 3.9 },
  { text: 'ونضارة', start: 3.95, end: 4.5 },
];

describe.skipIf(!ready)('a video the tool has never seen', () => {
  it('reaches a plan the builder can place, every element of it', async () => {
    const known = await rememberVideo(videoPath);
    expect(known.label).toBe('a video this tool has never seen');

    const cacheRoot = path.join(dir, 'cache');
    const costsPath = path.join(dir, 'costs.jsonl');
    const realLedger = path.join(REPO_ROOT, '.local', 'costs.jsonl');
    const ledgerBefore = existsSync(realLedger) ? statSync(realLedger).size : 0;

    const result = await runPipeline({
      reel: known.label,
      modeId: 'k2-syndicalia',
      costsPath,
      cacheRoot,
      log: () => undefined,
      onProgress: () => undefined,
      stages: {
        /*
         * The real stage, with the one call that would reach ElevenLabs and
         * Gemini replaced. Everything after it — tagging, cleaning, grouping,
         * the plan, the merge, the loudness and watermark measurements — is the
         * production path.
         */
        transcribe: (options) =>
          transcribeVideo({
            ...options,
            runTranscription: () =>
              Promise.resolve({
                fingerprint: 'offline',
                fingerprintInputs: {} as never,
                cacheDir: cacheRoot,
                entry: { provenance: 'none', id: null, dir: null } as never,
                transcript: {
                  words: DRAFT.map((w, i) => ({
                    id: `w${String(i).padStart(4, '0')}`,
                    text: w.text,
                    start: w.start,
                    end: w.end,
                    confidence: 0.99,
                  })),
                  draftWords: [],
                  correctedWords: DRAFT.map((w) => ({ text: w.text })),
                  promptVersion: 4,
                  model: 'offline',
                  cost: { scribeUsd: 0, geminiUsd: 0, totalUsd: 0 },
                  wallTimeS: 0,
                  drift: { draft: DRAFT.length, corrected: DRAFT.length, delta: 0, fraction: 0 },
                  warnings: [],
                  scribeRaw: {},
                  correctionRaw: {},
                  cached: false,
                } as never,
              } as never),
          }),
        /*
         * Stubbed one level deeper than the stage: `runAnalysis` is the single
         * function that talks to Gemini, so the cache layer, the selector and
         * everything that writes the plan stay the production path.
         */
        keywords: (options) =>
          analyseKeywordsForPlan({
            ...options,
            runCached: (cachedOptions) =>
              analyseKeywordsCached({
                ...cachedOptions,
                cacheRoot,
                runAnalysis: () =>
                  Promise.resolve({
                    candidates: [
                      { wordIds: ['w0004', 'w0005'], score: 0.95, reason: 'the claim', kind: 'promise' },
                    ],
                    rawText: KEYWORD_JSON,
                    promptVersion: 4,
                    model: 'offline',
                    costUsd: 0,
                    wallTimeS: 0,
                    usage: { promptTokenCount: 1, candidatesTokenCount: 1 },
                  } as never),
              }),
          }),
        slots: (options) =>
          planImageSlotsForPlan({
            ...options,
            runCached: (cachedOptions) =>
              planSlotsCached({
                ...cachedOptions,
                cacheRoot,
                runAnalysis: () =>
                  Promise.resolve({
                    candidates: [
                      { wordIds: ['w0002', 'w0003'], idea: 'a single silk ribbon', score: 0.9 },
                    ],
                    rawText: SLOT_JSON,
                    promptVersion: 2,
                    model: 'offline',
                    costUsd: 0,
                    wallTimeS: 0,
                    usage: { promptTokenCount: 1, candidatesTokenCount: 1 },
                  } as never),
              }),
          }),
        images: (options) =>
          generateImagesForPlan({
            ...options,
            costsPath,
            cacheRoot,
            client: {
              generate: () =>
                Promise.resolve({
                  bytes: pngBytes(),
                  mimeType: 'image/png',
                  usage: { promptTokenCount: 1, candidatesTokenCount: 1 },
                  text: null,
                  width: 2048,
                  height: 2048,
                }),
            } as never,
          }),
      },
    });

    expect(result.error, JSON.stringify(result.error)).toBeNull();
    for (const stage of result.stages) {
      expect(`${stage.id}: ${stage.error === null ? 'ok' : stage.error.cause}`).toBe(
        `${stage.id}: ok`,
      );
    }

    // Nothing reached the real ledger.
    expect(existsSync(realLedger) ? statSync(realLedger).size : 0).toBe(ledgerBefore);

    const planPath = result.planPath as string;
    const plan = await readEditPlan(planPath);

    // What a build reads, all of it, produced by the pipeline alone.
    expect(plan.transcript.words.length).toBeGreaterThan(0);
    expect(plan.subtitles.groups.every((g) => g.templateId !== null)).toBe(true);
    expect(plan.subtitles.groups.every((g) => g.displayStart !== undefined)).toBe(true);
    expect(plan.clientMode?.id).toBe('k2-syndicalia');
    expect(plan.clientSnapshot?.id).toBe('k2-syndicalia');
    expect(plan.source.dialogueLufs).not.toBeNull();
    expect(plan.zones.zones.length).toBeGreaterThan(0);

    const missing = missingRequirements(
      buildRequirements(plan, readBuildDisk(plan), {
        knownTemplateIds: new Set(templatesById(loadTemplateManifest()).keys()),
        clientSource: resolveClientIdentity(plan, {}).source,
      }),
    );
    expect(missing.map((m) => m.id)).toEqual([]);

    /*
     * The gate that refused the user's reel. Every image slot must be placeable
     * from what the pipeline produced — a placement the builder derives from
     * this reel's own face masks, not one a terminal command wrote onto the
     * plan months ago.
     */
    const boxes = faceBoxesFor(plan);
    const placed = reelPlacements(
      plan.images.slots.map((slot) => ({
        id: slot.id,
        faceBox: boxes.get(slot.id) ?? null,
        seed: `${plan.meta.id}:${slot.id}`,
      })),
    );
    const rects = new Map(placed.slots.map((s) => [s.id, s.rect]));
    const audit = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'templates', 'library.audit.json'), 'utf8'),
    ) as { comps: AuditComp[] };
    const entries = templatesById(loadTemplateManifest());
    const built = buildReel({
      plan,
      audit: audit.comps,
      cardTemplateId: 'img_float',
      topLeftFor: (id) => rects.get(id),
      introFor: (id) => entries.get(id)?.introS ?? 0,
      minHoldFor: (id) => entries.get(id)?.minHoldS ?? 0,
      sfxFileFor: (id) => path.join(REPO_ROOT, 'assets', 'sfx', `${id}.wav`),
      candidateFileFor: (slotId) => {
        const slot = plan.images.slots.find((s) => s.id === slotId);
        if (slot === undefined) return null;
        const choice = buildChoiceFor(slot);
        const c = slot.candidates.find((x) => x.id === choice.candidateId);
        return c === undefined ? null : { path: c.path, id: c.id };
      },
    });

    expect(built.skipped.map((s) => `${s.kind} ${s.id}: ${s.reason}`)).toEqual([]);
    expect(built.elements.length).toBe(
      plan.subtitles.groups.filter((g) => g.supersededBy == null).length +
        plan.keywords.items.length +
        plan.images.slots.length,
    );

    /*
     * **A comp was built is not the same as the pictures being right**, and
     * until Block 10 session 36 this test asserted only the first. The user
     * watched his own reel and reported the pictures too small and mistimed;
     * both were true, both were measurable here, and nothing measured them.
     *
     * Neither figure below is a taste: each is derived from what the reel and
     * the templates *are*. What size a picture should be within its corner, and
     * how it should sit against its words, are the user's eye and are not
     * asserted.
     */
    for (const slot of plan.images.slots) {
      const box = boxes.get(slot.id);
      expect(box, `${slot.id} has no face box`).toBeDefined();
      const rect = rects.get(slot.id);
      expect(rect, `${slot.id} was not placed`).toBeDefined();
      const safe = placementIsSafe(rect as Rect, box as Rect);
      expect(
        `${slot.id} inFrame=${safe.insideFrame} clearsFace=${safe.clearsFace}`,
      ).toBe(`${slot.id} inFrame=true clearsFace=true`);
    }

    /*
     * **Every picture as large as its own corner allows** — the user's ruling of
     * 2026-09-01, replacing the one-size-per-reel rule. What is asserted is that
     * no slot was drawn smaller than its own corner holds, which is the whole of
     * the rule and depends on nothing but this reel's geometry. Under the rule
     * it replaced, one tight slot took every other picture down with it and this
     * would have failed on every slot but that one.
     */
    for (const slot of placed.slots) {
      expect(`${slot.id} gives up ${slot.givesUpPx.toFixed(3)}px`).toBe(
        `${slot.id} gives up 0.000px`,
      );
      expect(slot.rect.w * plan.source.width).toBeCloseTo(slot.ownMaxPx, 6);
      expect(slot.ownMaxPx).toBeGreaterThan(0);
    }

    /*
     * **A picture may not vanish while its own words are still being said.**
     * The template comps are 2.002 s long, and until Block 10 session 37 a slot
     * longer than that simply ran out of source: on `sora` the second picture
     * disappeared 24.5 frames before its sentence ended, on `vitasilk` 18
     * frames, on `test-1` 6.6. Nothing compared the window to the template.
     *
     * The user's ruling is that a picture holds its last frame until its words
     * finish, so what is asserted is the whole window — every slot longer than
     * its template must carry the hold, and none may be shorter than the
     * entrance. Both bounds are the template's own figures, read from the audit
     * and the manifest, never numbers chosen against a reel.
     */
    const imageComp = audit.comps.find((c) => c.name === 'img_float');
    expect(imageComp, 'img_float missing from the audit').toBeDefined();
    const templateDurationS = (imageComp as AuditComp).duration;
    const entranceS = entries.get('img_float')?.introS ?? 0;
    expect(entranceS).toBeGreaterThan(0);
    const holds = new Map(
      built.placementsA
        .filter((p) => p.kind === 'image')
        .map((p) => [p.elementId, p] as const),
    );
    const cutShort: string[] = [];
    const endsEarly: string[] = [];
    for (const slot of plan.images.slots) {
      const windowS = slot.end - slot.start;
      if (windowS < entranceS - 1e-6) cutShort.push(`${slot.id} ${windowS.toFixed(3)}s`);
      const placement = holds.get(slot.id);
      expect(placement, `${slot.id} was not placed`).toBeDefined();
      // The out point is the words' own end, whatever the template's length.
      expect(`${slot.id} ${(placement as { outPointS: number }).outPointS.toFixed(3)}`).toBe(
        `${slot.id} ${slot.end.toFixed(3)}`,
      );
      const needsHold = windowS > templateDurationS + 1e-9;
      const hasHold =
        (placement as { holdLastFrameFromS?: number }).holdLastFrameFromS !== undefined;
      if (needsHold !== hasHold) {
        endsEarly.push(
          `${slot.id} runs ${windowS.toFixed(3)}s against a ${templateDurationS.toFixed(3)}s ` +
            `template and ${hasHold ? 'holds' : 'does not hold'}`,
        );
      }
    }
    expect(cutShort, 'a picture shorter than its own entrance').toEqual([]);
    expect(endsEarly, 'a picture that vanishes before its words end').toEqual([]);
  }, 300_000);
});

/** The smallest valid PNG the dimension check will accept as 2048x2048. */
function pngBytes(): Uint8Array {
  const png = execFileSync(
    FFMPEG as string,
    ['-y', '-f', 'lavfi', '-i', 'color=c=teal:s=2048x2048:d=1', '-frames:v', '1',
     '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return new Uint8Array(png);
}
