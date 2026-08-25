import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadGroundTruth } from './ground-truth.js';
import { scoreOrthography } from './orthography.js';
import { crossEngineDeviation, sanityCheck } from './timestamps.js';
import { align, computeSubsetWer, scoreAlignment, type WerResult } from './wer.js';
import { normalizeForWer } from './normalize.js';
import { LOCAL_DIR } from '@framopia/core';
import { RESULTS_DIR } from './paths.js';
import type { GroundTruth, TranscriptionResult } from './types.js';

export const REELS = ['ground-truth', 'test-1', 'test-2', 'test-3'];
export const ENGINES = ['scribe', 'gemini', 'whisper', 'hybrid'];

/**
 * Each `npm run bench` invocation writes its own timestamped directory, and a
 * sweep may cover only some engines — the v1.0.3 sweep re-ran gemini and
 * hybrid only, since Scribe's raw output does not depend on the prompt and
 * Whisper is a dead baseline. So resolve per reel *and per engine*: the newest
 * directory that actually holds that engine's result wins, which lets a
 * partial sweep sit on top of an older full one.
 */
export function findLatestRunPerReel(resultsRoot = RESULTS_DIR): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();
  const dirs = readdirSync(resultsRoot)
    .filter((d) => !d.startsWith('.') && d !== 'latest-spotcheck')
    .sort();

  for (const dir of dirs) {
    const runDir = path.join(resultsRoot, dir);
    const reportPath = path.join(runDir, 'report.md');
    if (!existsSync(reportPath)) continue;
    const report = readFileSync(reportPath, 'utf8');

    for (const reel of REELS) {
      if (!report.includes(`${reel}.wav`)) continue;
      const perEngine = found.get(reel) ?? new Map<string, string>();
      for (const engine of ENGINES) {
        if (existsSync(path.join(runDir, `${engine}.json`))) perEngine.set(engine, runDir);
      }
      found.set(reel, perEngine);
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
  const overall = scoreAlignment(align(normalizeForWer(reference), normalizeForWer(hypothesis)));
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

export function loadReel(
  runDirs: Map<string, string>,
  reel: string,
): { groundTruth: GroundTruth; results: Map<string, TranscriptionResult> } {
  const groundTruth = loadGroundTruth(path.join(LOCAL_DIR, 'ground-truth', `${reel}.json`));
  const results = new Map<string, TranscriptionResult>();
  for (const engine of ENGINES) {
    const runDir = runDirs.get(engine);
    if (runDir === undefined) continue;
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
    const runDirs = runs.get(reel);
    if (runDirs === undefined) {
      perReel.push(`### ${reel}\n\nNo run found.\n`);
      continue;
    }
    totalDurationS += durations[reel] ?? 0;
    const { groundTruth, results } = loadReel(runDirs, reel);
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

  return `# Block 1 transcription benchmark — run C (guide v1.0.3)

**Every WER column here is scored against the \`v1.0.6-conformant\`
references.** The engine outputs are unchanged — they are the same recorded
run-C responses — but the references they are measured against have been
corrected three times since run C was first written: the ground-truth reel in
Block 2 session 6, test-1 and test-2 in Block 3 session 1 (\`dla vidéo\` →
\`dial lvidéo\`, \`joj dl 7essass\` → \`joj dial l7essass\`), and all four in
Block 3 session 2, which straightened the curly apostrophes §4 forbids.
**Any run-C WER figure quoted elsewhere from before those corrections is
superseded by this table.** Nothing but the WER columns moved; cost, wall time
and timestamp deviation are untouched.

The run of record for the Block 1 freeze decision. Earlier runs are kept
beside it: run A (guide v1.0.1) in \`RESULTS-block1-runA.md\`, run B (a free
rescore of run A's outputs under v1.0.2) in \`RESULTS-block1-runB.md\`.

**Run C re-ran gemini and hybrid only**, under prompts carrying guide
v1.0.3 — the term-level script rule, the numeral rule, and the widened
medical/aesthetic domain. The scribe and whisper rows are the stored
session-4 results, reused deliberately: Scribe takes no prompt, so its
output cannot depend on the guide, and Whisper is a local baseline that
translates Darija into MSA and was never a candidate. The ground truth also
changed for v1.0.3: Arabic-script function words were converted to Arabizi,
and two transcription defects the engines had gotten right (\`kids cabin\` for
\`kidom mabin\`, \`7sessa\` for \`7essa\`) were corrected.

## Timestamp spotcheck — by ear, on the ground-truth reel

Checked by the user against the audio, 15 sampled words per engine:

- **hybrid: 14/15 hits.**
- **gemini: 9/15**, with accumulating drift through the reel — by the last
  rows the next row's audio was playing under the current row.

This is the evidence the WER table cannot carry. Hybrid inherits Scribe's
word timings; Gemini self-reports them, and self-reported timings drift.

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

Cost column total: $${totalCost.toFixed(4)}. Note this mixes runs — the
gemini and hybrid figures were billed by this run, the scribe and whisper
figures are the session-4 charges for the outputs being reused, not a
fresh spend.

## How to read these numbers

**Scribe's darija WER is not an accuracy measurement.** Scribe returns
Darija in Arabic script and the ground truth is written in Latin Arabizi,
so essentially every Darija word counts as a substitution. Its fr/en WER
is the honest signal for raw Scribe, and it is the best of any engine.

**Hybrid's 0ms median deviation is structural, not earned.** Hybrid takes
Scribe's word timings by construction, so it can only agree with Scribe at
the median; the p90 is where its realignment of inserted words shows up.

**The numeral artifact is gone.** Guide v1.0.2 §3a settles numbers as digits
and the WER normalizer maps the spelled-out Darija forms onto them, so
\`khmstach\` and \`15\` now compare equal. Together with the Arabic punctuation
fix, this is what moved the rows between run A and run B.

**The timestamp deviation columns moved too, and for the same reason.**
Cross-engine deviation pairs words by their normalized text, so every Arabic
word carrying a question mark used to fail to pair and drop out of the
comparison. With punctuation stripped, hybrid's p90 against Scribe falls
from 1794ms to single digits — which is what hybrid inheriting Scribe's
timings should have looked like all along.

**The Arabic-script scope artifact is still live in these numbers.** Guide
v1.0.2 §6 now covers anatomical regions and substance names, matching what
the ground truth does, but the engines that produced these outputs were
prompted under v1.0.1 and still transliterate them (\`lmnti9a 7awl l3inin\`
for \`المنطقة حول العينين\`, \`wmaddat lcaféine\` for \`مادة الكافيين\`). Those
remain real errors against the ground truth. Unlike the numeral case this
one cannot be fixed by rescoring — it needs a re-run under the v1.0.2
prompt, which would cost another sweep.

## Per reel

${perReel.join('\n')}

## Ledger note — one understated cost entry from session 4

The \`.local/costs.jsonl\` entry

\`\`\`
{"stage":"benchmark-gemini","model":"gemini","unit":"run","usd":0.031668,"timestamp":"2026-08-24T19:50:06.011Z"}
\`\`\`

is **known-low and must never be quoted as an actual cost**. It was written
before \`computeGeminiCost\` billed \`thoughtsTokenCount\` at the output rate, so
it counts only the 2084 visible output tokens and omits 10295 thinking tokens.

The raw response survives at
\`benchmarks/results/2026-08-24T19-48-01-202Z/raw/gemini.json\`
(\`promptTokensDetails\` 2748 TEXT + 582 AUDIO, \`candidatesTokenCount\` 2084,
\`thoughtsTokenCount\` 10295). Re-costed with the current constants
($2.00/M input, $12.00/M output) the call was **$0.155208**, not $0.031668 —
4.9x. Reconstructing the old formula from the same usage reproduces
$0.031668 exactly, which is what identifies this raw response as that call.

The ledger is append-only, so the original line stands. A delta-only entry of
$0.123540 (\`stage: benchmark-gemini-correction\`) was appended with a \`note\`
naming the corrected timestamp. Ledger totals are therefore correct in sum;
the single 19:50:06 line is not correct on its own.

No other entry needed correcting. 19:50:06 is the first Gemini line in the
ledger, and the next one (19:54:06, $0.156060) reproduces exactly from its own
raw \`usageMetadata\` **with** thinking tokens included, so the fix was already
in place from that call onward.
`;
}
