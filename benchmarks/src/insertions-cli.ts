import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from '@framopia/core';
import freezeListData from './freeze-list.json' with { type: 'json' };
import { analyseEdits, type AnalysisWord, type EditAnalysis } from './insertions.js';
import { loadGroundTruth } from './ground-truth.js';
import { mapNumeral } from './normalize.js';
import { BENCHMARKS_ROOT, RESULTS_DIR } from './paths.js';
import { generateSpotcheckHtml, type SpotcheckWord } from './spotcheck.js';

const REELS: [reel: string, videoBasename: string][] = [
  ['ground-truth', 'ground truth'],
  ['test-1', 'test 1'],
  ['test-2', 'test 2'],
  ['test-3', 'test 3'],
];

const VIDEO_DIR = path.join(BENCHMARKS_ROOT, '..', 'my files', 'test videos');
const FREEZE_LIST = new Set(freezeListData.words);

interface PlanWord {
  text: string;
  start: number | null;
  end: number | null;
  lang: string | null;
  script: string;
  confidence: number | null;
  removed?: boolean;
}

function planWords(planPath: string): AnalysisWord[] {
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as {
    transcript: { words: PlanWord[] };
  };
  return plan.transcript.words
    .filter((w) => w.removed !== true)
    .map((w) => ({
      text: w.text,
      startS: w.start,
      endS: w.end,
      lang: w.lang,
      script: w.script,
      confidence: w.confidence,
    }));
}

const ctx = (before: string[], after: string[], text: string): string =>
  `${before.join(' ')} [${text}] ${after.join(' ')}`.trim();

function spotcheckPage(reel: string, analysis: EditAnalysis): string {
  const words: SpotcheckWord[] = analysis.inserted.map((t) => ({
    text: t.text,
    startS: t.startS,
    endS: t.endS,
    confidence: null,
    context: `${ctx(t.before, t.after, t.text)}${t.interpolatedTiming ? '  (timing interpolated)' : ''}`,
  }));
  return generateSpotcheckHtml({
    engine: `${reel} — inserted tokens`,
    audioPath: path.join(LOCAL_DIR, 'bench-audio', `${reel}.wav`),
    words,
    sampleSize: words.length,
    leadInS: 1,
    playMs: 2600,
    choices: ['recovery', 'hallucination'],
    contextHeader: 'context',
    intro:
      `${words.length} tokens the production transcript has and the reference does not. ` +
      'Play starts 1s before the token. Mark it a recovery if you hear the word in the ' +
      'audio, a hallucination if you do not.',
  });
}

function row(cells: (string | number)[]): string {
  return `| ${cells.join(' | ')} |`;
}

const analyses = new Map<string, EditAnalysis>();
const latestDir = path.join(RESULTS_DIR, 'latest-spotcheck');
mkdirSync(latestDir, { recursive: true });

for (const [reel, video] of REELS) {
  const hypothesis = planWords(path.join(VIDEO_DIR, `${video}.editplan.json`));
  const groundTruth = loadGroundTruth(path.join(LOCAL_DIR, 'ground-truth', `${reel}.json`));
  const analysis = analyseEdits({
    hypothesis,
    reference: groundTruth.words.map((w) => w.text),
    freezeList: FREEZE_LIST,
    numeralMap: mapNumeral,
  });
  analyses.set(reel, analysis);
  writeFileSync(
    path.join(latestDir, `${reel}-insertions.html`),
    spotcheckPage(reel, analysis),
    'utf8',
  );
}

const LANGS = ['darija', 'msa', 'fr', 'en', 'mixed'];
const lines: string[] = [];

lines.push('| reel | inserted | deleted | substitutions | matches |', '|---|---|---|---|---|');
for (const [reel] of REELS) {
  const a = analyses.get(reel) as EditAnalysis;
  lines.push(row([reel, a.inserted.length, a.deleted.length, a.substitutions, a.matches]));
}

lines.push('', `| reel | ${LANGS.join(' | ')} | on freeze list |`, `|---|${'---|'.repeat(6)}`);
for (const [reel] of REELS) {
  const a = analyses.get(reel) as EditAnalysis;
  const counts = LANGS.map((l) => a.inserted.filter((t) => t.lang === l).length);
  lines.push(row([reel, ...counts, a.inserted.filter((t) => t.onFreezeList).length]));
}

for (const [reel] of REELS) {
  const a = analyses.get(reel) as EditAnalysis;
  lines.push('', `### ${reel} — ${a.inserted.length} inserted`, '');
  lines.push(
    '| token | start | end | timing | lang | script | freeze | context |',
    `|---|${'---|'.repeat(7)}`,
  );
  for (const t of a.inserted) {
    lines.push(
      row([
        `\`${t.text}\``,
        t.startS === null ? '—' : `${t.startS.toFixed(2)}s`,
        t.endS === null ? '—' : `${t.endS.toFixed(2)}s`,
        t.interpolatedTiming ? 'interpolated' : 'scribe',
        t.lang ?? 'null',
        t.script,
        t.onFreezeList ? 'yes' : 'no',
        ctx(t.before, t.after, t.text),
      ]),
    );
  }
  lines.push('', `### ${reel} — ${a.deleted.length} deleted`, '');
  if (a.deleted.length === 0) {
    lines.push('None.');
  } else {
    lines.push('| token | context |', '|---|---|');
    for (const t of a.deleted) lines.push(row([`\`${t.text}\``, ctx(t.before, t.after, t.text)]));
  }
}

console.log(lines.join('\n'));
console.error(`\nSpotcheck pages written to ${latestDir}`);
