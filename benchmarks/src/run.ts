import { createInterface } from 'node:readline/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { appendCost } from './costs.js';
import { ensureWavAudio, getAudioDurationSeconds } from './audio.js';
import { estimateCosts } from './estimate.js';
import { loadGroundTruth } from './ground-truth.js';
import { alignCorrectedOntoScribeTimings, parseCorrectionResponseText, runHybrid } from './engines/hybrid.js';
import { mapScribeResponse, transcribeWithScribe, type ScribeRawResponse } from './engines/scribe.js';
import { parseGeminiResponseText, transcribeWithGemini } from './engines/gemini.js';
import { mapWhisperResponse, transcribeWithWhisper, type WhisperRawResponse } from './engines/whisper.js';
import { LOCAL_DIR, RESULTS_DIR, FIXTURES_DIR } from './paths.js';
import { generateSpotcheckHtml } from './spotcheck.js';
import { buildReport } from './report.js';
import type { TranscriptionResult } from './types.js';

const ALL_ENGINES = ['scribe', 'gemini', 'whisper', 'hybrid'];
const SPOTCHECK_ENGINES = new Set(['scribe', 'whisper', 'hybrid']);
const DRY_RUN_AUDIO_LABEL = 'fixtures/ (dry run — no real audio file)';

export interface RunBenchmarkOptions {
  audioPath: string;
  groundTruthPath: string;
  engines: string[];
  keyterms: string[];
  yes: boolean;
  dryRun: boolean;
  elevenLabsApiKey?: string;
  googleApiKey?: string;
  resultsRoot?: string;
  confirm?: (message: string) => Promise<boolean>;
}

export function requiresConfirmation(dryRun: boolean, totalUsd: number, yes: boolean): boolean {
  return !dryRun && totalUsd > 0 && !yes;
}

async function defaultConfirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(message);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function loadKeytermsFile(keytermsPath: string | undefined): Promise<string[]> {
  if (!keytermsPath) return [];
  const raw = await readFile(keytermsPath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function runEngineDryRun(engine: string, rawDir: string): Promise<TranscriptionResult> {
  await mkdir(rawDir, { recursive: true });

  if (engine === 'scribe') {
    const raw = JSON.parse(
      await readFile(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
    ) as ScribeRawResponse;
    const rawResponsePath = path.join(rawDir, 'scribe.json');
    await writeFile(rawResponsePath, JSON.stringify(raw, null, 2), 'utf8');
    return { engine, words: mapScribeResponse(raw), rawResponsePath, costUsd: 0, wallTimeS: 0 };
  }

  if (engine === 'gemini') {
    const raw = JSON.parse(
      await readFile(path.join(FIXTURES_DIR, 'gemini-response.json'), 'utf8'),
    ) as { text: string };
    const rawResponsePath = path.join(rawDir, 'gemini.json');
    await writeFile(rawResponsePath, JSON.stringify(raw, null, 2), 'utf8');
    return {
      engine,
      words: parseGeminiResponseText(raw.text),
      rawResponsePath,
      costUsd: 0,
      wallTimeS: 0,
    };
  }

  if (engine === 'whisper') {
    const raw = JSON.parse(
      await readFile(path.join(FIXTURES_DIR, 'whisper-response.json'), 'utf8'),
    ) as WhisperRawResponse;
    const rawResponsePath = path.join(rawDir, 'whisper.json');
    await writeFile(rawResponsePath, JSON.stringify(raw, null, 2), 'utf8');
    return { engine, words: mapWhisperResponse(raw), rawResponsePath, costUsd: 0, wallTimeS: 0 };
  }

  if (engine === 'hybrid') {
    const scribeRaw = JSON.parse(
      await readFile(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
    ) as ScribeRawResponse;
    const scribeWords = mapScribeResponse(scribeRaw);
    const geminiRaw = JSON.parse(
      await readFile(path.join(FIXTURES_DIR, 'gemini-response.json'), 'utf8'),
    ) as { text: string };
    const correctedTexts = parseCorrectionResponseText(geminiRaw.text);
    const words = alignCorrectedOntoScribeTimings(scribeWords, correctedTexts);
    const rawResponsePath = path.join(rawDir, 'hybrid.json');
    await writeFile(
      rawResponsePath,
      JSON.stringify({ scribeRaw, geminiRaw, correctedTexts }, null, 2),
      'utf8',
    );
    return { engine, words, rawResponsePath, costUsd: 0, wallTimeS: 0 };
  }

  throw new Error(`unknown engine: ${engine}`);
}

async function runEngineLive(
  engine: string,
  ctx: {
    audioPath: string;
    durationS: number;
    keyterms: string[];
    rawDir: string;
    elevenLabsApiKey: string;
    googleApiKey: string;
  },
): Promise<TranscriptionResult> {
  if (engine === 'scribe') {
    return transcribeWithScribe({
      apiKey: ctx.elevenLabsApiKey,
      audioPath: ctx.audioPath,
      durationS: ctx.durationS,
      keyterms: ctx.keyterms,
      rawDir: ctx.rawDir,
    });
  }
  if (engine === 'gemini') {
    return transcribeWithGemini({
      apiKey: ctx.googleApiKey,
      audioPath: ctx.audioPath,
      keyterms: ctx.keyterms,
      rawDir: ctx.rawDir,
    });
  }
  if (engine === 'whisper') {
    return transcribeWithWhisper({ audioPath: ctx.audioPath, rawDir: ctx.rawDir });
  }
  if (engine === 'hybrid') {
    return runHybrid({
      elevenLabsApiKey: ctx.elevenLabsApiKey,
      googleApiKey: ctx.googleApiKey,
      audioPath: ctx.audioPath,
      durationS: ctx.durationS,
      keyterms: ctx.keyterms,
      rawDir: ctx.rawDir,
    });
  }
  throw new Error(`unknown engine: ${engine}`);
}

export async function runBenchmark(options: RunBenchmarkOptions): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = path.join(options.resultsRoot ?? RESULTS_DIR, timestamp);
  const rawDir = path.join(resultsDir, 'raw');
  await mkdir(rawDir, { recursive: true });

  const groundTruth = loadGroundTruth(options.groundTruthPath);

  let audioPath: string;
  let durationS: number;
  if (options.dryRun) {
    audioPath = DRY_RUN_AUDIO_LABEL;
    durationS = 1.1; // matches the synthetic fixtures' word span
  } else {
    audioPath = await ensureWavAudio(options.audioPath, path.join(LOCAL_DIR, 'bench-audio'));
    durationS = await getAudioDurationSeconds(audioPath);
  }

  const estimates = estimateCosts(durationS, options.engines, options.keyterms.length > 0);
  const totalUsd = estimates.reduce((sum, e) => sum + e.usd, 0);

  console.log(`Estimated cost for ${durationS.toFixed(1)}s of audio:`);
  for (const estimate of estimates) {
    console.log(`  ${estimate.engine}: $${estimate.usd.toFixed(4)} (${estimate.note})`);
  }
  console.log(`  total: $${totalUsd.toFixed(4)}`);

  if (requiresConfirmation(options.dryRun, totalUsd, options.yes)) {
    const confirm = options.confirm ?? defaultConfirm;
    const proceed = await confirm(`Proceed with billable calls totaling ~$${totalUsd.toFixed(4)}? [y/N] `);
    if (!proceed) {
      throw new Error('aborted: cost confirmation declined');
    }
  }

  const results: TranscriptionResult[] = [];
  for (const engine of options.engines) {
    const result = options.dryRun
      ? await runEngineDryRun(engine, rawDir)
      : await runEngineLive(engine, {
          audioPath,
          durationS,
          keyterms: options.keyterms,
          rawDir,
          elevenLabsApiKey: options.elevenLabsApiKey ?? '',
          googleApiKey: options.googleApiKey ?? '',
        });

    results.push(result);
    await writeFile(path.join(resultsDir, `${engine}.json`), JSON.stringify(result, null, 2), 'utf8');

    if (result.costUsd > 0) {
      appendCost({ stage: `benchmark-${engine}`, model: engine, unit: 'run', usd: result.costUsd });
    }

    if (SPOTCHECK_ENGINES.has(engine)) {
      const html = generateSpotcheckHtml({ engine, audioPath, words: result.words });
      await writeFile(path.join(resultsDir, `spotcheck-${engine}.html`), html, 'utf8');
    }
  }

  const report = buildReport(results, groundTruth, {
    title: `Transcription benchmark — ${timestamp}`,
    audioPath: options.dryRun ? audioPath : options.audioPath,
    groundTruthPath: options.groundTruthPath,
  });
  await writeFile(path.join(resultsDir, 'report.md'), report, 'utf8');

  return resultsDir;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      audio: { type: 'string' },
      'ground-truth': { type: 'string' },
      engines: { type: 'string' },
      keyterms: { type: 'string' },
      yes: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const dryRun = values['dry-run'] ?? false;
  const audioPath = values.audio ?? (dryRun ? DRY_RUN_AUDIO_LABEL : undefined);
  const groundTruthPath = values['ground-truth'] ?? (dryRun ? path.join(FIXTURES_DIR, 'ground-truth.json') : undefined);

  if (!audioPath || !groundTruthPath) {
    console.error('Usage: npm run bench -- --audio <path> --ground-truth <path.json> [--engines ...] [--keyterms <path>] [--yes] [--dry-run]');
    process.exitCode = 1;
    return;
  }

  if (!dryRun && !existsSync(audioPath)) {
    console.error(`Audio file not found: ${audioPath}`);
    process.exitCode = 1;
    return;
  }

  const engines = (values.engines ?? ALL_ENGINES.join(',')).split(',').map((e) => e.trim());
  const unknown = engines.filter((e) => !ALL_ENGINES.includes(e));
  if (unknown.length > 0) {
    console.error(`Unknown engine(s): ${unknown.join(', ')}. Known: ${ALL_ENGINES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const keyterms = await loadKeytermsFile(values.keyterms);

  let elevenLabsApiKey: string | undefined;
  let googleApiKey: string | undefined;
  if (!dryRun) {
    const { loadConfig } = await import('./config.js');
    const config = loadConfig();
    elevenLabsApiKey = config.elevenLabsApiKey;
    googleApiKey = config.googleApiKey;
  }

  const resultsDir = await runBenchmark({
    audioPath,
    groundTruthPath,
    engines,
    keyterms,
    yes: values.yes ?? false,
    dryRun,
    elevenLabsApiKey,
    googleApiKey,
  });

  console.log(`Results written to ${resultsDir}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
