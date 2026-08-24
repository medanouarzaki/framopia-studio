import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadGroundTruth } from './ground-truth.js';
import { scoreOrthography } from './orthography.js';
import { crossEngineDeviation, sanityCheck } from './timestamps.js';
import { align, computeSubsetWer, scoreAlignment, type WerResult } from './wer.js';
import { normalizeWords } from './normalize.js';
import { LOCAL_DIR, RESULTS_DIR } from './paths.js';
import type { GroundTruth, TranscriptionResult } from './types.js';

export const REELS = ['ground-truth', 'test-1', 'test-2', 'test-3'];
export const ENGINES = ['scribe', 'gemini', 'whisper', 'hybrid'];

/**
 * Each `npm run bench` invocation writes its own timestamped directory, so a
 * four-reel sweep leaves four of them. Pair each reel with its newest run by
 * reading the audio filename back out of that run's report.
 */
export function findLatestRunPerReel(resultsRoot = RESULTS_DIR): Map<string, string> {
  const found = new Map<string, string>();
  const dirs = readdirSync(resultsRoot).filter((d) => !d.startsWith('.')).sort();

  for (const dir of dirs) {
    const reportPath = path.join(resultsRoot, dir, 'report.md');
    if (!existsSync(reportPath)) continue;
    const report = readFileSync(reportPath, 'utf8');
    for (const reel of REELS) {
      if (report.includes(`${reel}.wav`)) found.set(reel, path.join(resultsRoot, dir));
    }
  }

  return found;
}

export interface EngineScores {
  overall: WerResult;
  darija: WerResult;
  codeSwitched: WerResult;
  orthographyScore: number;
  arabicScriptWords: number;
  nullTimestamps: number;
  deviationMedianMs: number | null;
  deviationP90Ms: number | null;
  costUsd: number;
  wallTimeS: number;
  wordCount: number;
}

function pool(results: WerResult[]): WerResult {
  const summed = results.reduce(
    (acc, r) => ({
      substitutions: acc.substitutions + r.substitutions,
      insertions: acc.insertions + r.insertions,
      deletions: acc.deletions + r.deletions,
      matches: acc.matches + r.matches,
    }),
    { substitutions: 0, insertions: 0, deletions: 0, matches: 0 },
  );
  const referenceCount = summed.matches + summed.substitutions + summed.deletions;
  return {
    ...summed,
    referenceCount,
    wer:
      referenceCount === 0
        ? 0
        : (summed.substitutions + summed.insertions + summed.deletions) / referenceCount,
  };
}

export function scoreEngine(
  result: TranscriptionResult,
  groundTruth: GroundTruth,
  scribe: TranscriptionResult | undefined,
): EngineScores {
  const hypothesis = result.words.map((w) => w.text);
  const reference = groundTruth.words.map((w) => w.text);
  const overall = scoreAlignment(align(normalizeWords(reference), normalizeWords(hypothesis)));
  const orthography = scoreOrthography(hypothesis);
  const sanity = sanityCheck(result.words);
  const deviation =
    scribe && scribe.engine !== result.engine
      ? crossEngineDeviation(result.words, scribe.words)
      : null;

  return {
    overall,
    darija: computeSubsetWer(groundTruth.words, hypothesis, ['darija']),
    codeSwitched: computeSubsetWer(groundTruth.words, hypothesis, ['fr', 'en']),
    orthographyScore: orthography.score,
    arabicScriptWords: orthography.arabicScriptWords,
    nullTimestamps: sanity.nullStartCount,
    deviationMedianMs: deviation ? deviation.medianAbsDeltaS * 1000 : null,
    deviationP90Ms: deviation ? deviation.p90AbsDeltaS * 1000 : null,
    costUsd: result.costUsd,
    wallTimeS: result.wallTimeS,
    wordCount: result.words.length,
  };
}

export function loadReel(runDir: string, reel: string): {
  groundTruth: GroundTruth;
  results: Map<string, TranscriptionResult>;
} {
  const groundTruth = loadGroundTruth(path.join(LOCAL_DIR, 'ground-truth', `${reel}.json`));
  const results = new Map<string, TranscriptionResult>();
  for (const engine of ENGINES) {
    const file = path.join(runDir, `${engine}.json`);
    if (!existsSync(file)) continue;
    results.set(engine, JSON.parse(readFileSync(file, 'utf8')) as TranscriptionResult);
  }
  return { groundTruth, results };
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const wer = (r: WerResult): string => (r.referenceCount === 0 ? 'n/a' : pct(r.wer));
const ms = (n: number | null): string => (n === null ? '—' : `${n.toFixed(0)}ms`);

function table(rows: [string, EngineScores][]): string {
  const header =
    '| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |';
  const sep = '|---|---|---|---|---|---|---|---|---|';
  const body = rows
    .map(
      ([engine, s]) =>
        `| ${engine} | ${wer(s.overall)} | ${wer(s.darija)} | ${wer(s.codeSwitched)} | ` +
        `${pct(s.orthographyScore)}${s.arabicScriptWords > 0 ? ` (${s.arabicScriptWords} ar unscored)` : ''} | ` +
        `${ms(s.deviationMedianMs)} / ${ms(s.deviationP90Ms)} | ${s.nullTimestamps} | ` +
        `$${s.costUsd.toFixed(4)} | ${s.wallTimeS.toFixed(1)}s |`,
    )
    .join('\n');
  return `${header}\n${sep}\n${body}`;
}

export function buildAggregateReport(resultsRoot = RESULTS_DIR): string {
  const runs = findLatestRunPerReel(resultsRoot);
  const perReel: string[] = [];
  const byEngine = new Map<string, EngineScores[]>();
  let totalDurationS = 0;
  const durations: Record<string, number> = {};
  for (const reel of JSON.parse(
    readFileSync(path.join(path.dirname(RESULTS_DIR), 'footage.json'), 'utf8'),
  ).reels as { label: string; durationS: number }[]) {
    durations[reel.label] = reel.durationS;
  }

  for (const reel of REELS) {
    const runDir = runs.get(reel);
    if (runDir === undefined) {
      perReel.push(`### ${reel}\n\nNo run found.\n`);
      continue;
    }
    totalDurationS += durations[reel] ?? 0;
    const { groundTruth, results } = loadReel(runDir, reel);
    const scribe = results.get('scribe');
    const rows: [string, EngineScores][] = [];
    for (const engine of ENGINES) {
      const result = results.get(engine);
      if (result === undefined) continue;
      const scores = scoreEngine(result, groundTruth, scribe);
      rows.push([engine, scores]);
      byEngine.set(engine, [...(byEngine.get(engine) ?? []), scores]);
    }
    perReel.push(
      `### ${reel} — ${(durations[reel] ?? 0).toFixed(1)}s, ${groundTruth.words.length} reference words\n\n${table(rows)}\n`,
    );
  }

  const aggregateRows: [string, EngineScores][] = ENGINES.filter((e) => byEngine.has(e)).map(
    (engine) => {
      const all = byEngine.get(engine) as EngineScores[];
      const totalWords = all.reduce((n, s) => n + s.wordCount, 0);
      const weighted = (pick: (s: EngineScores) => number): number =>
        all.reduce((n, s) => n + pick(s) * s.wordCount, 0) / (totalWords || 1);
      const deviations = all.filter((s) => s.deviationMedianMs !== null);
      return [
        engine,
        {
          overall: pool(all.map((s) => s.overall)),
          darija: pool(all.map((s) => s.darija)),
          codeSwitched: pool(all.map((s) => s.codeSwitched)),
          orthographyScore: weighted((s) => s.orthographyScore),
          arabicScriptWords: all.reduce((n, s) => n + s.arabicScriptWords, 0),
          nullTimestamps: all.reduce((n, s) => n + s.nullTimestamps, 0),
          deviationMedianMs:
            deviations.length === 0
              ? null
              : deviations.reduce((n, s) => n + (s.deviationMedianMs as number), 0) /
                deviations.length,
          deviationP90Ms:
            deviations.length === 0
              ? null
              : deviations.reduce((n, s) => n + (s.deviationP90Ms as number), 0) /
                deviations.length,
          costUsd: all.reduce((n, s) => n + s.costUsd, 0),
          wallTimeS: all.reduce((n, s) => n + s.wallTimeS, 0),
          wordCount: totalWords,
        },
      ];
    },
  );

  const totalCost = aggregateRows.reduce((n, [, s]) => n + s.costUsd, 0);

  return `# Block 1 transcription benchmark — results

Four reels, ${totalDurationS.toFixed(1)}s of code-switched Darija/French
talking-head audio, scored against hand-written ground truth. Ground truth
carries no timestamps by design, so timestamp quality is measured as
agreement with Scribe plus internal monotonicity, never as accuracy.

WER is pooled across reels (total errors over total reference words), not
averaged over per-reel rates. Orthography conformance only judges
Latin-script words; the parenthetical counts Arabic-script words the rule
set cannot speak to, which is the whole story for raw Scribe.

## Aggregate — all four reels

${table(aggregateRows)}

Total billed: $${totalCost.toFixed(4)}.

## How to read these numbers

**Scribe's darija WER is not an accuracy measurement.** Scribe returns
Darija in Arabic script and the ground truth is written in Latin Arabizi,
so essentially every Darija word counts as a substitution. Its fr/en WER
is the honest signal for raw Scribe, and it is the best of any engine.

**Hybrid's 0ms median deviation is structural, not earned.** Hybrid takes
Scribe's word timings by construction, so it can only agree with Scribe at
the median; the p90 is where its realignment of inserted words shows up.

**Two known scoring artifacts inflate the Darija WER of both Gemini rows**,
and neither is a transcription error:

- *Numerals.* The ground truth writes digits (\`4\`, \`15\`, \`18\`) where Gemini
  spells the number out (\`rb3a\`, \`khmstachr\`, \`tmntach\`). The orthography
  guide has no numeral rule, so neither form is wrong yet.
- *Arabic-script scope.* The v1.0.1 §6 rule covers procedure and treatment
  terms. The ground truth also puts anatomical regions and substance names
  in Arabic script (\`المنطقة حول العينين\`, \`ومادة الكافيين\`) where Gemini
  transliterated them (\`lmnti9a 7awl l3inin\`, \`wmaddat lcaféine\`).

On the ground-truth reel these two account for roughly a tenth of the
reference words. Closing both in the guide would move the Gemini and
hybrid Darija numbers down without either engine changing.

## Per reel

${perReel.join('\n')}`;
}
