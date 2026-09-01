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

/**
 * **Three videos of different shapes**, so the rules are proved over more than
 * one arrangement of pictures. Block 10 session 39 added the second and third:
 * the first has a single slot, and a rule about what happens *between* two
 * pictures cannot be tested on a reel that has one.
 *
 * The word timings are what give each shape its shape — a reel whose pictures
 * are seconds apart, and one whose pictures run into each other with the last
 * ending on the last word.
 */
interface Shape {
  label: string;
  seconds: number;
  draft: { text: string; start: number; end: number }[];
  /** What the keyword model would have answered, replayed from here instead. */
  keywordCandidates: { wordIds: string[]; score: number; reason: string; kind: string }[];
  /** What the slot model would have answered, including the word each picture is about. */
  slotCandidates: { wordIds: string[]; idea: string; score: number; nameWordId?: string }[];
  /**
   * How many pictures this shape must actually reach the builder with.
   *
   * Asserted rather than assumed: a rule about what happens between two
   * pictures passes vacuously on a reel that ends up with one, and the density
   * and spread rules decide how many of the candidates survive.
   */
  minPictures: number;
  /** How many pictures must end up arriving at a named word, and how many not. */
  namedPictures: number;
  unnamedPictures: number;
}

/** Two Arabic words and two Latin ones, with timings a 6s clip can hold. */
const DRAFT = [
  { text: 'السلام', start: 0.4, end: 0.9 },
  { text: 'عليكم', start: 0.95, end: 1.4 },
  { text: 'Vita', start: 2.0, end: 2.4 },
  { text: 'Silk', start: 2.45, end: 2.9 },
  { text: 'البشرة', start: 3.4, end: 3.9 },
  { text: 'ونضارة', start: 3.95, end: 4.5 },
];

const SHAPES: Shape[] = [
  {
    label: 'a video this tool has never seen',
    seconds: 6,
    draft: DRAFT,
    keywordCandidates: [{ wordIds: ['w0004', 'w0005'], score: 0.95, reason: 'the claim', kind: 'promise' }],
    // The naming word is the last word of the span: the picture arrives late
    // inside it, and it is also the reel's last picture, so the entrance floor
    // is the thing being exercised.
    slotCandidates: [
      { wordIds: ['w0002', 'w0003'], idea: 'a single silk ribbon', score: 0.9, nameWordId: 'w0003' },
    ],
    minPictures: 1,
    namedPictures: 1,
    unnamedPictures: 0,
  },
  {
    label: 'another video with its pictures far apart',
    seconds: 10,
    draft: [
      { text: 'السلام', start: 0.4, end: 0.9 },
      { text: 'عليكم', start: 0.95, end: 1.4 },
      { text: 'Vita', start: 4.2, end: 4.6 },
      { text: 'Silk', start: 4.65, end: 5.1 },
      { text: 'البشرة', start: 7.8, end: 8.3 },
      { text: 'ونضارة', start: 8.35, end: 8.9 },
    ],
    keywordCandidates: [{ wordIds: ['w0000', 'w0001'], score: 0.9, reason: 'the greeting', kind: 'promise' }],
    // One picture named, one not: the hand-over has to hold across both.
    slotCandidates: [
      { wordIds: ['w0000', 'w0001'], idea: 'a calm open horizon', score: 0.9, nameWordId: 'w0001' },
      { wordIds: ['w0004', 'w0005'], idea: 'a drop of water on skin', score: 0.7 },
    ],
    minPictures: 2,
    namedPictures: 1,
    unnamedPictures: 1,
  },
  {
    label: 'a third video whose pictures run into each other',
    // Its own length and its own words: the slot cache keys on the video's
    // sha256 and on the word **text**, not on the timings, so a shape that
    // reuses another's words silently reuses its answer too. This test found
    // that by asserting which name reached the plan.
    seconds: 11,
    draft: [
      { text: 'مرحبا', start: 0.4, end: 1.6 },
      { text: 'بيكم', start: 2.2, end: 3.4 },
      { text: 'Aqua', start: 4.0, end: 5.2 },
      { text: 'Derm', start: 5.8, end: 7.0 },
      { text: 'الشعر', start: 7.4, end: 8.2 },
      { text: 'وقوة', start: 8.4, end: 9.2 },
    ],
    keywordCandidates: [{ wordIds: ['w0002', 'w0003'], score: 0.9, reason: 'the brand', kind: 'promise' }],
    // A word the transcript does not contain, and a word from the wrong slot:
    // neither may reach the plan, and neither may move a picture.
    slotCandidates: [
      { wordIds: ['w0000', 'w0001'], idea: 'a calm open horizon', score: 0.9, nameWordId: 'w9999' },
      { wordIds: ['w0002', 'w0003'], idea: 'a single silk ribbon', score: 0.8, nameWordId: 'w0005' },
    ],
    minPictures: 2,
    namedPictures: 0,
    unnamedPictures: 2,
  },
];

let dir: string;
const videoPaths = new Map<string, string>();
const saved = process.env['FRAMOPIA_VIDEO_REGISTRY'];

beforeAll(() => {
  if (!ready) return;
  dir = mkdtempSync(path.join(tmpdir(), 'framopia-new-video-'));
  for (const shape of SHAPES) {
    const videoPath = path.join(dir, `${shape.label}.mov`);
    // A few seconds of a corpus reel, re-encoded: a new file with a new hash
    // that nothing in this repository has ever been run against. The source is
    // read only.
    execFileSync(
      FFMPEG as string,
      ['-y', '-ss', '2', '-t', String(shape.seconds), '-i', SOURCE, '-c:v', 'prores_ks',
       '-profile:v', '3', '-c:a', 'pcm_s16le', videoPath],
      { stdio: 'ignore' },
    );
    videoPaths.set(shape.label, videoPath);
  }
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
  for (const videoPath of videoPaths.values()) {
    rmSync(cutoutDirFor(editPlanPathFor(videoPath)), { recursive: true, force: true });
    rmSync(editPlanPathFor(videoPath), { force: true });
    rmSync(reelMasksDir(videoPath), { recursive: true, force: true });
    rmSync(reelFramesDir(videoPath), { recursive: true, force: true });
    rmSync(path.dirname(reelMasksDir(videoPath)), { recursive: true, force: true });
  }
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe.skipIf(!ready)('a video the tool has never seen', () => {
  it.each(SHAPES)('$label reaches a plan the builder can place, every element of it', async (shape) => {
    const DRAFT = shape.draft;
    const KEYWORD_JSON = JSON.stringify({ candidates: shape.keywordCandidates });
    const SLOT_JSON = JSON.stringify({ candidates: shape.slotCandidates });
    const videoPath = videoPaths.get(shape.label) as string;
    const known = await rememberVideo(videoPath);
    expect(known.label).toBe(shape.label);

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
                    candidates: shape.keywordCandidates,
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
                    candidates: shape.slotCandidates,
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
    /*
     * **No picture over the speaker at any frame of its life**, checked frame by
     * frame rather than against their union. The union is the wrong box for
     * both jobs: it sizes a picture for a position the speaker is never in, and
     * a picture that clears the union tells you nothing you did not already
     * know. What has to be true is that the picture is clear in every frame it
     * is actually on screen, and that is what is asserted.
     */
    let framesChecked = 0;
    for (const slot of plan.images.slots) {
      const frames = boxes.get(slot.id);
      expect(frames, `${slot.id} has no face box`).toBeDefined();
      expect((frames as Rect[]).length, `${slot.id} has no frames of its own life`)
        .toBeGreaterThan(0);
      const rect = rects.get(slot.id);
      expect(rect, `${slot.id} was not placed`).toBeDefined();
      const bad = (frames as Rect[])
        .map((box, i) => ({ i, safe: placementIsSafe(rect as Rect, box) }))
        .filter((r) => !r.safe.insideFrame || !r.safe.clearsFace);
      framesChecked += (frames as Rect[]).length;
      expect(
        `${slot.id} unsafe in ${bad.length} of ${(frames as Rect[]).length} frames`,
      ).toBe(`${slot.id} unsafe in 0 of ${(frames as Rect[]).length} frames`);
    }
    // A guarantee asserted over no frames is not a guarantee.
    expect(framesChecked, 'no frame of any picture was actually checked')
      .toBeGreaterThanOrEqual(plan.images.slots.length);

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
     * A picture now outlives its words by construction — it holds until the
     * next one arrives — so what is asserted is that no picture is *shorter*
     * than its own words, and that none is shorter than its entrance. Both
     * bounds are the template's own figures, read from the audit and the
     * manifest, never numbers chosen against a reel.
     */
    const imageComp = audit.comps.find((c) => c.name === 'img_float');
    expect(imageComp, 'img_float missing from the audit').toBeDefined();
    const templateDurationS = (imageComp as AuditComp).duration;
    const entranceS = entries.get('img_float')?.introS ?? 0;
    expect(entranceS).toBeGreaterThan(0);
    const placedImages = new Map(
      built.placementsC
        .filter((p) => p.kind === 'image')
        .map((p) => [p.elementId, p] as const),
    );
    const cutShort: string[] = [];
    const endsEarly: string[] = [];
    for (const slot of plan.images.slots) {
      const windowS = slot.end - slot.start;
      if (windowS < entranceS - 1e-6) cutShort.push(`${slot.id} ${windowS.toFixed(3)}s`);
      const placement = placedImages.get(slot.id);
      expect(placement, `${slot.id} was not placed`).toBeDefined();
      const outPointS = (placement as { outPointS: number }).outPointS;
      if (outPointS < slot.end - 1e-6) {
        endsEarly.push(
          `${slot.id} leaves at ${outPointS.toFixed(3)}s with words running to ${slot.end.toFixed(3)}s`,
        );
      }
    }
    expect(cutShort, 'a picture shorter than its own entrance').toEqual([]);
    expect(endsEarly, 'a picture that vanishes before its words end').toEqual([]);

    /*
     * **No void between two pictures**, on a video the tool has never seen.
     *
     * The user's ruling of 1 September, and the rule since he chose the cut
     * over the dissolve. Asserted over this video's real slot times: every
     * picture but the last leaves exactly when the next one arrives, and the
     * last still ends with its own words.
     */
    const pictures = built.placementsC
      .filter((p) => p.kind === 'image')
      .sort((a, b) => a.inPointS - b.inPointS);
    expect(pictures.length, 'too few pictures for this shape to prove anything')
      .toBeGreaterThanOrEqual(shape.minPictures);
    const voids = pictures
      .slice(0, -1)
      .map((p, i) => ({
        id: p.elementId,
        gap: (pictures[i + 1] as { inPointS: number }).inPointS - p.outPointS,
      }))
      .filter((g) => Math.abs(g.gap) > 1e-9)
      .map((g) => `${g.id} leaves ${g.gap.toFixed(3)}s from the next arriving`);
    expect(voids, 'a picture that does not hand straight over to the next').toEqual([]);
    const last = pictures[pictures.length - 1] as { elementId: string; outPointS: number };
    const lastSlot = plan.images.slots.find((s) => s.id === last.elementId);
    expect(last.outPointS).toBeCloseTo(lastSlot?.end as number, 9);
    // Held longer than the template means held, and the entrance is never stretched.
    for (const p of pictures) {
      const runsS = p.outPointS - p.inPointS;
      const holds = (p as { holdLastFrameFromS?: number }).holdLastFrameFromS !== undefined;
      expect(`${p.elementId} ${holds ? 'holds' : 'plain'}`).toBe(
        `${p.elementId} ${runsS > templateDurationS + 1e-9 ? 'holds' : 'plain'}`,
      );
      expect((p as { stretchPercent?: number }).stretchPercent).toBeUndefined();
    }
    /*
     * **A picture arrives at the word the model said it is about.**
     *
     * The user's ruling of 1 September, and the reason slot prompt v3 asks the
     * question at all. What is asserted is the whole of it on a video the tool
     * has never seen: a named word inside the span moves the picture to it, a
     * word the transcript does not contain never reaches the plan, a word
     * belonging to another slot never reaches it either, and a picture whose
     * span the model named nothing in still arrives with its sentence.
     */
    const wordStart = new Map(plan.transcript.words.map((w) => [w.id, w.start]));
    const asked = new Map(shape.slotCandidates.map((c) => [c.wordIds.join(' '), c.nameWordId]));
    let checkedNamed = 0;
    let checkedUnnamed = 0;
    for (const slot of plan.images.slots) {
      const wanted = asked.get(slot.wordIds.join(' '));
      const legitimate = wanted !== undefined && slot.wordIds.includes(wanted);
      // A word outside the span, or one the transcript never had, is dropped
      // rather than absorbed: the plan must not carry it at all.
      expect(
        `${slot.id} nameWordId ${String(slot.nameWordId)}`,
        'a name the model gave that does not belong to this slot reached the plan',
      ).toBe(`${slot.id} nameWordId ${legitimate ? wanted : 'undefined'}`);

      const placement = placedImages.get(slot.id) as { inPointS: number };
      if (legitimate) {
        checkedNamed += 1;
        const at = wordStart.get(wanted) as number;
        const latest = Math.max(slot.start, slot.end - entranceS);
        expect(placement.inPointS).toBeCloseTo(Math.min(at, latest), 6);
      } else {
        checkedUnnamed += 1;
        expect(placement.inPointS).toBeCloseTo(slot.start, 6);
      }
      // Never outside its own span, whatever the model said.
      expect(placement.inPointS).toBeGreaterThanOrEqual(slot.start - 1e-9);
      expect(placement.inPointS).toBeLessThanOrEqual(slot.end - entranceS + 1e-9);
    }
    // Both branches have to have been reached across the three shapes, or the
    // assertion above is a shape of test this project has already been bitten by.
    expect(
      `${shape.label}: ${checkedNamed} named, ${checkedUnnamed} unnamed`,
    ).toBe(`${shape.label}: ${shape.namedPictures} named, ${shape.unnamedPictures} unnamed`);

    // A and C say the same thing about a picture; only cards differ between them.
    const picturesA = built.placementsA
      .filter((p) => p.kind === 'image')
      .sort((a, b) => a.inPointS - b.inPointS);
    expect(picturesA.map((p) => `${p.elementId} ${p.outPointS.toFixed(6)}`)).toEqual(
      pictures.map((p) => `${p.elementId} ${p.outPointS.toFixed(6)}`),
    );
  }, 900_000);
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
