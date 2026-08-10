import { crossEngineDeviation, sanityCheck } from './timestamps.js';
import { scoreOrthography } from './orthography.js';
import { computeSubsetWer, computeWer } from './wer.js';
import type { GroundTruth, TranscriptionResult } from './types.js';

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtWer(n: number, referenceCount: number): string {
  return referenceCount === 0 ? 'n/a (no matching GT words)' : fmtPct(n);
}

export interface ReportOptions {
  title: string;
  audioPath: string;
  groundTruthPath: string;
}

export function buildReport(
  results: TranscriptionResult[],
  groundTruth: GroundTruth,
  options: ReportOptions,
): string {
  const referenceTexts = groundTruth.words.map((w) => w.text);
  const scribeResult = results.find((r) => r.engine === 'scribe');

  const rows = results.map((result) => {
    const hypothesisTexts = result.words.map((w) => w.text);

    const overall = computeWer(referenceTexts, hypothesisTexts);
    const darija = computeSubsetWer(groundTruth.words, hypothesisTexts, ['darija']);
    const codeSwitched = computeSubsetWer(groundTruth.words, hypothesisTexts, ['fr', 'en']);
    const orthography = scoreOrthography(hypothesisTexts);
    const sanity = sanityCheck(result.words);

    const deviation =
      scribeResult && scribeResult.engine !== result.engine
        ? crossEngineDeviation(result.words, scribeResult.words)
        : null;

    return {
      engine: result.engine,
      overallWer: fmtWer(overall.wer, overall.referenceCount),
      darijaWer: fmtWer(darija.wer, darija.referenceCount),
      codeSwitchedWer: fmtWer(codeSwitched.wer, codeSwitched.referenceCount),
      orthography: fmtPct(orthography.score),
      deviation: deviation ? `${(deviation.medianAbsDeltaS * 1000).toFixed(0)}ms / ${(deviation.p90AbsDeltaS * 1000).toFixed(0)}ms` : '—',
      nullTimestamps: sanity.nullStartCount,
      costUsd: `$${result.costUsd.toFixed(4)}`,
      wallTimeS: `${result.wallTimeS.toFixed(1)}s`,
    };
  });

  const header =
    '| engine | overall WER | darija WER | code-switched WER | orthography | ts deviation vs scribe (median/p90) | null timestamps | cost | wall time |';
  const separator = '|---|---|---|---|---|---|---|---|---|';
  const body = rows
    .map(
      (r) =>
        `| ${r.engine} | ${r.overallWer} | ${r.darijaWer} | ${r.codeSwitchedWer} | ${r.orthography} | ${r.deviation} | ${r.nullTimestamps} | ${r.costUsd} | ${r.wallTimeS} |`,
    )
    .join('\n');

  return `# ${options.title}

Audio: \`${options.audioPath}\`
Ground truth: \`${options.groundTruthPath}\`

There is no ground-truth timestamp source; timestamp quality is assessed
via cross-engine agreement against scribe and internal monotonicity only.

${header}
${separator}
${body}
`;
}
