import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from '@framopia/core';
import { findReelByLabel, listVideosFor } from './catalogue.js';
import { dryRun } from './dry-run.js';
import { stepsFor } from './steps.js';
import { runPipeline } from './pipeline.js';
import { transcribeVideo } from './transcription/job.js';
import { transcribeHybridCached } from './transcription/cached.js';
import { mapScribeResponse, type ScribeRawResponse } from './transcription/scribe.js';
import { parseCorrectionResponseText } from './transcription/correction.js';
import { alignCorrectedOntoDraft } from './transcription/align.js';
import { planImageSlotsForPlan } from './analysis/job.js';
import { imageSlotCountFor } from './analysis/count.js';
import { planSlotsCached } from './analysis/cached.js';
import { FALLBACK_MIN_PICTURE_LIFE_S } from './analysis/slot-select.js';
import type { SlotCandidate } from './analysis/slot-select.js';
import type { EditPlan } from './editplan/types.js';
import { knownVideos } from './videos.js';
import { loadReels } from './frames/footage.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/**
 * The one thing a model would have said, replayed from a recording.
 *
 * This is the money boundary and the whole of it: `transcribeHybridCached` runs
 * for real above it — the cache, the alignment, the plan written and validated —
 * and only the two API calls underneath are replaced.
 */
function recordedAnswer(): unknown {
  const scribeRaw = JSON.parse(
    readFileSync(path.join(FIXTURES, 'scribe-response.json'), 'utf8'),
  ) as ScribeRawResponse;
  const correctionRaw = JSON.parse(
    readFileSync(path.join(FIXTURES, 'correction-response.json'), 'utf8'),
  ) as { text: string };
  const draftWords = mapScribeResponse(scribeRaw);
  const correctedTexts = parseCorrectionResponseText(correctionRaw.text);
  return {
    words: alignCorrectedOntoDraft(draftWords, correctedTexts),
    draftWords,
    promptVersion: 1,
    model: 'a recording, not a model',
    cost: { scribeUsd: 0, geminiUsd: 0, totalUsd: 0 },
    wallTimeS: 0,
    drift: {
      draftCount: draftWords.length,
      correctedCount: correctedTexts.length,
      absoluteDelta: Math.abs(correctedTexts.length - draftWords.length),
      fraction: Math.abs(correctedTexts.length - draftWords.length) / draftWords.length,
      exceedsThreshold: false,
    },
    warnings: [],
    scribeRaw,
    correctionRaw: { text: correctionRaw.text, usageMetadata: {} },
    cached: false,
  };
}

/**
 * **A video the tool has never seen, through the route the panel uses.**
 *
 * Mohamed has opened four builds and found something wrong in three of them, and
 * the gate was green every time. The cause was the same each time: every suite on
 * the run path is handed one of the seven reels the tool already knows —
 * `vitasilk` alone appears 134 times — and `pipeline.test.ts` hands it stages
 * that **throw if they are called**, so nothing has ever asserted what the panel's
 * own route does with a video it has never seen, or what it hands the stages when
 * it gets there.
 *
 * Four defects went through that gap. Session 84: every stage resolved a label
 * against the benchmark catalogue, so a video picked from a client's folder was
 * refused by name. Session 85: the client's own picture labels were never handed
 * to the transcriber, so a product she plainly named came back as a different
 * word. Session 86: a picture the client's store answered spent from the budget
 * that exists to limit what is *bought*. Session 87: the spacing floor compared
 * word spans while its purpose was about screen time.
 *
 * **What makes this a stranger.** The video is generated here, now, with a
 * nanosecond stamp in its metadata, so its sha256 has never existed before and
 * cannot be in any cache. It is in a scratch folder belonging to a scratch
 * client, it is in no catalogue, and part 4 of this file asserts that rather
 * than assuming it.
 *
 * **Where the money would be, and what stands in its place.** Four calls cost:
 * Scribe, the Gemini correction, the Gemini analysis and the image model. Each
 * is replaced at its own boundary — the *stage*, for transcription, and
 * `runCached`, for slots — so everything this session is about still runs for
 * real: resolution, pricing, the client's labels being gathered and handed over,
 * selection, the budget, and the pacing floor.
 *
 * **What that substitution stops this proving.** It cannot see a real model's
 * answer. It cannot tell whether a transcript is right, whether a keyterm changed
 * what was heard, whether an idea is any good, or whether a picture is usable.
 * Those need money and a person's eye, and this test claims none of them.
 */
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

let scratch: string;
let videoPath: string;
let label: string;
const CLIENT = 'a-client-the-tool-has-never-seen';
const saved = {
  modes: process.env['FRAMOPIA_MODES_DIR'],
  registry: process.env['FRAMOPIA_VIDEO_REGISTRY'],
  plans: process.env['FRAMOPIA_PLANS_DIR'],
};


beforeAll(() => {
  /*
   * **No skip.** Session 73's rule: a test that steps aside when the thing it
   * needs is missing is a silent pass. ffmpeg is in MACHINE_REQUIREMENTS and the
   * gate already refuses a machine without it, so its absence fails here loudly
   * rather than quietly excusing the one test that runs a stranger.
   */
  if (!existsSync(FFMPEG)) {
    throw new Error(
      `ffmpeg is not at ${FFMPEG}, so the stranger cannot be made and nothing here ran`,
    );
  }
  scratch = mkdtempSync(path.join(tmpdir(), 'framopia-stranger-'));
  const modes = path.join(scratch, 'modes');
  const folder = path.join(scratch, 'their footage', 'September', 'Exports');
  mkdirSync(modes, { recursive: true });
  mkdirSync(folder, { recursive: true });
  mkdirSync(path.join(scratch, 'plans'), { recursive: true });
  mkdirSync(path.join(scratch, 'cache'), { recursive: true });
  mkdirSync(path.join(scratch, 'audio'), { recursive: true });

  videoPath = path.join(folder, 'a stranger.mov');
  execFileSync(FFMPEG, [
    '-nostdin', '-loglevel', 'error', '-y',
    // 2160x3840 upright: the only shape this tool builds, and it refuses others.
    '-f', 'lavfi', '-i', 'color=c=0x1C1210:s=2160x3840:d=1.5:r=30',
    '-f', 'lavfi', '-i', 'sine=frequency=333:duration=1.5',
    // Never the same file twice, so its hash cannot be in a cache from any run.
    '-metadata', `comment=stranger-${process.hrtime.bigint().toString()}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    videoPath,
  ]);

  /* A client of this test's own, with one picture labelled for a word she says. */
  const template = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'modes', 'k2-syndicalia.json'), 'utf8'),
  ) as Record<string, unknown>;
  template['id'] = CLIENT;
  template['name'] = 'A Client The Tool Has Never Seen';
  template['videoFolder'] = path.join(scratch, 'their footage');
  template['pictures'] = [
    {
      id: 'pic001',
      path: path.join(REPO_ROOT, 'assets', 'brand', 'logo.png'),
      description: 'the thing she names',
      label: 'minutes',
    },
  ];
  writeFileSync(path.join(modes, `${CLIENT}.json`), JSON.stringify(template, null, 2));

  process.env['FRAMOPIA_MODES_DIR'] = modes;
  process.env['FRAMOPIA_VIDEO_REGISTRY'] = path.join(scratch, 'videos.json');
  process.env['FRAMOPIA_PLANS_DIR'] = path.join(scratch, 'plans');

  label = path.join('September', 'Exports', 'a stranger');
});

afterAll(() => {
  for (const [key, value] of Object.entries(saved)) {
    const name = { modes: 'FRAMOPIA_MODES_DIR', registry: 'FRAMOPIA_VIDEO_REGISTRY', plans: 'FRAMOPIA_PLANS_DIR' }[key] as string;
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
});

/**
 * The transcription stage: the **real** job, with the model replaced underneath
 * and what the stage was handed recorded on the way past.
 *
 * `transcribeVideo` hashes the file, probes it, extracts its audio and writes a
 * validated plan — all of that runs. Only `runHybrid`, the two API calls, is a
 * recording.
 */
function transcribeRecorded(seen: { keyterms?: readonly string[] }[]) {
  return (async (options: { videoPath: string; keyterms?: readonly string[] }) => {
    seen.push({ keyterms: options.keyterms });
    return await transcribeVideo({
      ...options,
      /*
       * Everything this test makes lives in its own directory and dies with it.
       * Without these the cache gained an entry and the audio folder a file on
       * every gate run, which is the sort of drift sessions 70 and 81 spent
       * themselves cleaning up.
       */
      cacheRoot: path.join(scratch, 'cache'),
      audioDir: path.join(scratch, 'audio'),
      runTranscription: (async (opts: Parameters<typeof transcribeHybridCached>[0]) =>
        await transcribeHybridCached({
          ...opts,
          runHybrid: async () => recordedAnswer() as never,
        })) as typeof transcribeHybridCached,
    } as Parameters<typeof transcribeVideo>[0]);
  }) as never;
}

/** Runs the real transcription stage once and returns where the plan really went. */
let transcribedPlan: string | null = null;
async function transcribedPlanPath(): Promise<string> {
  if (transcribedPlan !== null) return transcribedPlan;
  const seen: { keyterms?: readonly string[] }[] = [];
  await runPipeline({
    reel: label,
    modeId: CLIENT,
    only: ['transcription'],
    cacheRoot: path.join(scratch, 'cache'),
    stages: { transcribe: transcribeRecorded(seen) },
    preflight: () => undefined,
    measure: async () => undefined,
  });
  /* Where the rule put it, not where this test guessed: named from content. */
  const written = readdirSync(path.join(scratch, 'plans')).filter((f) => f.endsWith('.json'));
  expect(written).toHaveLength(1);
  transcribedPlan = path.join(scratch, 'plans', written[0] as string);
  return transcribedPlan;
}

/**
 * **The stranger, proved to be one.**
 *
 * The greatest risk in this file is a fixture that looks like a stranger and is
 * not — one that quietly gains an entry somewhere, or resolves because something
 * else created it first. Everything below rests on these three, so they are
 * asserted rather than assumed, and they run before anything touches the reel.
 *
 * They are also the guard: if a future session adds this reel to the corpus
 * catalogue to make something else pass, this file goes red and says so instead
 * of quietly testing a reel the tool knows.
 */
describe('the stranger is really a stranger', () => {
  it('is in no corpus catalogue, by label or by path', () => {
    const corpus = loadReels();
    expect(corpus.map((r) => r.label)).not.toContain(label);
    expect(corpus.map((r) => r.label)).not.toContain(path.basename(videoPath, '.mov'));
    for (const reel of corpus) {
      expect(`${reel.label}: ${reel.path === videoPath}`).toBe(`${reel.label}: false`);
    }
  });

  it('is in no video registry', () => {
    expect(knownVideos().map((v) => v.path)).not.toContain(videoPath);
  });

  /* Its sha256 has never existed, so nothing can have cached an answer for it. */
  it('has a hash nothing has ever seen', () => {
    const sha = createHash('sha256').update(readFileSync(videoPath)).digest('hex');
    for (const root of [path.join(REPO_ROOT, '.local', 'cache'), path.join(scratch, 'cache')]) {
      expect(`${root}: ${existsSync(path.join(root, sha))}`).toBe(`${root}: false`);
    }
  });
});

describe('a video the tool has never seen', () => {
  it('is offered by the picker, from the client’s own folder', () => {
    const offered = listVideosFor(CLIENT).reels;
    expect(offered.map((r) => r.label)).toContain(label);
  });

  /**
   * **Session 84.** Every stage resolved a label with `listReels().find(...)`,
   * which knows the corpus and whatever Browse has opened. A label the picker
   * offers must resolve to the file it names.
   */
  it('resolves to the file the picker offered, not to a catalogue entry', () => {
    const found = findReelByLabel(label);
    expect(found?.videoPath).toBe(videoPath);
    expect(found?.present).toBe(true);
  });

  it('is priced without an edit plan, and reaches the stages that would bill', async () => {
    const dry = await dryRun(label, CLIENT);
    expect(dry.videoPath).toBe(videoPath);
    expect(dry.estimateUsd).toBeGreaterThan(0);
    expect(dry.stages.map((s) => s.id)).toContain('transcription');
  });

  it('offers its first step and refuses the rest, by name', () => {
    const steps = stepsFor(label, CLIENT).steps ?? [];
    expect(steps.find((s) => s.id === 'reel')?.available).toBe(true);
    for (const step of steps.filter((s) => s.id !== 'reel')) {
      expect(`${step.id}: ${step.available}`).toBe(`${step.id}: false`);
      expect(`${step.id}: ${typeof step.reason}`).toBe(`${step.id}: string`);
    }
  });

  /**
   * **Session 85.** The client's own picture labels were never handed to the
   * transcriber, so a product she plainly named came back as a different word.
   * The stage is stubbed; what it was *given* is the assertion.
   */
  it('hands the transcriber the words this client has labelled', async () => {
    const seen: { keyterms?: readonly string[] }[] = [];
    await runPipeline({
      reel: label,
      modeId: CLIENT,
      only: ['transcription'],
      cacheRoot: path.join(scratch, 'cache'),
      stages: { transcribe: transcribeRecorded(seen) },
      preflight: () => undefined,
      measure: async () => undefined,
    });
    expect(seen).toHaveLength(1);
    // `labelWords` normalises, so the list is lowercase however he typed it.
    expect(seen[0]?.keyterms).toContain('minutes');
  });
});

/**
 * **Sessions 86 and 87**, one layer in: the model's answer is a recording, and
 * everything that decides what becomes of it runs for real — `planSlotsCached`,
 * `planSlots`, the budget, the pacing floor and the client-picture match.
 */
describe('what the stranger’s ideas become', () => {
  /**
   * **Two ideas in the shape of Mohamed's sentences**: the word before the one
   * the client has labelled, and the labelled word itself.
   *
   * In the recording those two are **0.08 seconds apart as spans and 0.74
   * seconds apart as starts** — which is the whole of session 87. The floor that
   * compared spans refused the second; the floor that measures how long a
   * picture is on screen accepts both. And the second is answered from the
   * client's own store, which is session 86: it must not spend the budget.
   *
   * Chosen from the recording by that shape rather than by index, so it keeps
   * meaning what it says if the recording is ever replaced.
   */
  function recordedIdeas(
    words: { id: string; text: string; start: number; end: number }[],
    spoilOne = false,
  ): SlotCandidate[] {
    const namedAt = words.findIndex((w) => /minutes/i.test(w.text));
    expect(namedAt).toBeGreaterThan(0);
    const named = words[namedAt]!;
    const before = words[namedAt - 1]!;
    // The pair shape this exists to test: close as spans, apart as starts.
    expect(named.start - before.end).toBeLessThan(0.5);
    expect(named.start - before.start).toBeGreaterThanOrEqual(
      FALLBACK_MIN_PICTURE_LIFE_S,
    );
    return [
      {
        wordIds: [before.id],
        idea: spoilOne ? 'Assortment of vitamin pills' : 'the result she wants',
      },
      { wordIds: [named.id], idea: 'the thing she named' },
    ];
  }

  async function planned(options: { spoilOne?: boolean } = {}): Promise<EditPlan> {
    const planPath = await transcribedPlanPath();
    await planImageSlotsForPlan({
      planPath,
      modeId: CLIENT,
      force: true,
      cacheRoot: path.join(scratch, 'cache'),
      /*
       * The slot cache keys on the reel and the mode, not on the answer, so
       * without this the second case in this file is served the first case's
       * ideas and asserts nothing. Found exactly that way.
       */
      bypassCache: true,
      runCached: (async (opts: Parameters<typeof planSlotsCached>[0]) =>
        await planSlotsCached({
          ...opts,
          /*
           * The re-ask is a model call too, and without this the test reached a
           * live endpoint the moment its recorded answer held a bad idea. It
           * answers with one clear thing, which is what a model would do.
           */
          runReask: async () => ({
            idea: 'one clear thing instead',
            costUsd: 0,
            rawText: '{"idea":"one clear thing instead"}',
          }),
          runAnalysis: async (inner) => ({
            candidates: recordedIdeas(inner.words, options.spoilOne === true),
            rawText: '',
            promptVersion: 4,
            model: 'a recording, not a model',
            costUsd: 0,
            wallTimeS: 0,
            usage: { promptTokens: 0, outputTokens: 0, thoughtsTokens: 0 },
          }),
        })) as typeof planSlotsCached,
    });
    return JSON.parse(readFileSync(planPath, 'utf8')) as EditPlan;
  }

  /**
   * **Session 86.** A picture the client's own store answers cost nothing, and
   * it was spending from the budget that exists to limit what is *bought*. With
   * a budget of one, a reel with one labelled word must still place both.
   */
  it('does not spend the picture budget on a picture the client already answered', async () => {
    const plan = await planned();
    const slots = plan.images.slots;
    const fromHer = slots.filter((s) => s.chosenClientPictureId !== undefined);
    const bought = slots.filter((s) => s.chosenClientPictureId === undefined);
    expect(fromHer.length).toBeGreaterThanOrEqual(1);
    expect(bought.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * **Session 87.** The floor compared word spans while its purpose was about
   * screen time, so two ideas in one breath refused each other. Every picture
   * must be on screen at least as long as its entrance.
   */
  /**
   * **Session 89.** One unusable idea among good ones stopped the whole run:
   * `sora-2`'s model answer held twelve ideas, eleven fine and the seventh
   * naming a group, and nothing was built. The reel must survive it.
   *
   * The model's answer is a recording here, so the bad idea is put in
   * deliberately — which is the only way a gate can rehearse it without waiting
   * for a model to have a bad day.
   */
  it('is not stopped by one idea that names more than one thing', async () => {
    const plan = await planned({ spoilOne: true });
    expect(plan.images.slots.length).toBeGreaterThanOrEqual(1);
    for (const slot of plan.images.slots) {
      expect(`${slot.id}: ${/assortment/i.test(slot.idea)}`).toBe(`${slot.id}: false`);
    }
  });

  it('gives every picture longer than its entrance before the next replaces it', async () => {
    const plan = await planned();
    const slots = [...plan.images.slots].sort((a, b) => a.start - b.start);
    expect(slots.length).toBeGreaterThanOrEqual(2);
    /*
     * Between consecutive pictures, which is what selection decides. The last
     * one runs to the end of the reel and nothing here chooses that.
     */
    for (let i = 0; i + 1 < slots.length; i += 1) {
      const life = slots[i + 1]!.start - slots[i]!.start;
      expect(`${slots[i]!.id}: ${life >= FALLBACK_MIN_PICTURE_LIFE_S}`).toBe(
        `${slots[i]!.id}: true`,
      );
    }
  });

  /**
   * **Mohamed's ruling of 2026-09-11: the pictures a reel can afford are spread
   * across its whole length, not taken front to back.**
   *
   * **This assertion cannot bite on this fixture and it is written down here
   * rather than left to be discovered.** The stranger is 1.5 seconds long, so
   * `imageSlotCountFor` gives it a budget of one, the reel is considered in one
   * stretch, and "no two bought pictures share a stretch" is true of any single
   * picture. It is a real assertion of the rule and it is vacuous at this
   * length.
   *
   * Making it bite needs a longer stranger, and the obstacle is not the video —
   * that is three seconds of ffmpeg — but the transcript: the word timings here
   * are a recording of a real Scribe answer about these 1.5 seconds, and a
   * longer reel needs a longer recording, which is a billable call on footage
   * that does not exist yet. Session 90's report puts that to Mohamed as a
   * decision rather than spending against it.
   */
  it('spreads what it buys across the reel rather than taking it front to back', async () => {
    const plan = await planned();
    const bought = plan.images.slots.filter((s) => s.chosenClientPictureId === undefined);
    const budget = imageSlotCountFor(plan.source.durationS);
    const stretch = (startS: number): number =>
      Math.min(budget - 1, Math.floor((startS / plan.source.durationS) * budget));
    const occupied = bought.map((s) => stretch(s.start));
    expect(occupied).toEqual([...new Set(occupied)]);
  });
});
