/**
 * `npm run align:score -- --reel vitasilk [--compare <path>] [--allow-sha-drift]`
 *
 * Scores the current aligner against a hand-made reference under
 * `benchmarks/references/align/`. **It never reads the aligner's own output as
 * ground truth** — every figure comes from a human's verdicts, which is the
 * only measure of this defect that is not circular.
 *
 * Read-only: it opens the cache and the reference and writes only into
 * `benchmarks/results/latest-align-review/`. It cannot spend money — the
 * import graph is `@framopia/core/align-review`, `/align-score` and
 * `/cache-select`, deliberately not the `@framopia/core` barrel, which
 * re-exports `appendCost`. A test in core pins that.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ALIGN_REFERENCE_SCHEMA_VERSION,
  buildAlignmentRows,
  DEFAULT_ALIGN_COSTS,
  EXPENSIVE_INSERT_COSTS,
  parseAlignReference,
  renderSheet,
  AlignReferenceError,
  type AlignmentRow,
  type AlignReference,
  type SheetRow,
} from '@framopia/core/align-review';
import {
  AlignScoreError,
  compareAgainstReference,
  movedRows,
  scoreAlignment,
  type AlignComparison,
  type MovedRow,
} from '@framopia/core/align-score';
import { CacheEntrySelectionError } from '@framopia/core/cache-select';
import { ALIGNER_SOURCE_FILES, alignerHash } from '@framopia/core/aligner-hash';
import {
  argFlag,
  argValue,
  describeEntry,
  headSha,
  loadEntry,
  OUT_DIR,
  reelLabels,
  REFERENCE_DIR,
  ReviewError,
  videoShaFor,
} from './load.js';

const entryFlag = argValue('--entry');
const compareFlag = argValue('--compare');
const allowShaDrift = argFlag('--allow-sha-drift');

/**
 * Experiment 1, opt-in. The default is what every production path uses and
 * what every recorded figure was measured with; naming it here is the whole
 * point of a flag rather than a constant edit.
 */
const COST_MODELS = { default: DEFAULT_ALIGN_COSTS, 'expensive-insert': EXPENSIVE_INSERT_COSTS };
const costModelName = (argValue('--cost-model') ?? 'default') as keyof typeof COST_MODELS;
if (!(costModelName in COST_MODELS)) {
  console.error(`align:score: unknown --cost-model "${costModelName}"; one of ${Object.keys(COST_MODELS).join(', ')}`);
  process.exit(1);
}
const costs = COST_MODELS[costModelName];

function readReference(file: string, what: string): AlignReference {
  if (!existsSync(file)) {
    throw new ReviewError(
      `${what} not found at ${file}. A reference is a hand-made human judgment — ` +
        'generate the sheet with `npm run align:review`, mark the rows, press Download, ' +
        'and save the file there. Nothing synthesises one.',
    );
  }
  return parseAlignReference(JSON.parse(readFileSync(file, 'utf8')));
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function reportSingle(reel: string, reference: AlignReference, rows: readonly AlignmentRow[]): void {
  const score = scoreAlignment(rows, reference);
  console.log(`  ${score.rowsJudged} of ${score.rowsTotal} rows judged`);
  console.log('  verdict       total   cross-script   same-script');
  for (const [verdict, tally] of Object.entries(score.byVerdict)) {
    console.log(
      `  ${verdict.padEnd(12)} ${String(tally.total).padStart(5)} ` +
        `${String(tally.cross).padStart(14)} ${String(tally.same).padStart(13)}`,
    );
  }
  /*
   * Stated as a split, never as one number. `correct` measures the aligner and
   * `misheard` measures Scribe; a headline that folded them together would
   * hide a transcription problem inside an alignment score.
   */
  console.log(
    `\n  ${pct(score.confirmedShare)} of judged pairings have a human-confirmed alignment ` +
      `(${score.byVerdict.correct.total} correct + ${score.mishearCount} misheard of ${score.rowsJudged}).`,
  );
  if (score.mishearCount > 0) {
    console.log(
      `  Of those, ${score.mishearCount} are misheard: the pairing is right and the draft token is a\n` +
        '  different word from the one spoken, which is Scribe rather than the aligner.',
    );
  }
}

function reportComparison(comparison: AlignComparison): void {
  const line = (label: string, rows: MovedRow[]): void =>
    console.log(`  ${label.padEnd(38)} ${String(rows.length).padStart(4)}`);

  console.log('\n  what the change moved, by the human verdict on each row:');
  line('wrong, now pairs differently', comparison.repairCandidates);
  line('correct or misheard, now pairs differently', comparison.regressions);
  line('two tokens, still inexpressible', comparison.stillInexpressible);
  line('wrong, unmoved', comparison.unrepaired);
  line('correct, held', comparison.held);
  line('no token', comparison.noToken);

  if (comparison.regressions.length > 0) {
    console.log(
      `\n  ${comparison.regressions.length} REGRESSION(S): a human confirmed these pairings and they have changed.`,
    );
    for (const r of comparison.regressions.slice(0, 10)) {
      console.log(`    ${r.wordId} "${r.wordText}": ${r.previousDraftText} -> ${r.currentDraftText}`);
    }
  } else {
    console.log('\n  0 regressions: no pairing a human confirmed has moved.');
  }

  console.log(
    `\n  ${comparison.repairCandidates.length} candidate repair(s). This is a CANDIDATE figure, not an` +
      '\n  improvement: the reference says the old pairing was wrong and says nothing about' +
      '\n  whether the new one is right. It becomes a result only after a human pass over the' +
      '\n  re-review sheet below.',
  );
}

function main(): void {
  const reel = argValue('--reel');
  if (reel === null) throw new ReviewError(`--reel is required; one of ${reelLabels()}`);

  const entry = loadEntry(videoShaFor(reel), reel, entryFlag);
  const rows: AlignmentRow[] = buildAlignmentRows(entry.draft, entry.correctedTexts, costs);
  const sha = headSha();
  const generatedAt = new Date().toISOString();

  const referencePath = compareFlag ?? path.join(REFERENCE_DIR, `${reel}.json`);
  const reference = readReference(referencePath, compareFlag === null ? 'reference' : '--compare reference');

  if (reference.reel !== reel) {
    throw new ReviewError(
      `${referencePath} is a reference for "${reference.reel}", not "${reel}"`,
    );
  }

  console.log(
    `${reel}: scoring ${describeEntry(entry)} at ${sha.slice(0, 12)}` +
      (costModelName === 'default' ? '' : ` [cost model: ${costModelName}]`),
  );
  console.log(`  reference ${referencePath} (judged at ${reference.headSha.slice(0, 12)})`);

  /*
   * A reference judges one aligner, and `alignerHash` is what says which:
   * a hash of the modules that produce a pairing, so a commit touching a
   * report or a stylesheet no longer looks like an aligner change.
   *
   * A reference written before the hash existed carries only `headSha`, which
   * changes on every commit to anything. Refusing on that would reject a
   * reference the aligner has never stopped agreeing with, so it is a notice
   * rather than a refusal — the check is genuinely weaker for those files and
   * saying so is better than a false confidence in either direction.
   */
  const currentAligner = alignerHash();
  if (compareFlag === null) {
    if (reference.alignerHash === undefined) {
      console.log(
        `  note: this reference predates alignerHash, so drift can only be judged from headSha` +
          `${reference.headSha === sha ? ' (which matches).' : `, which has moved (${reference.headSha.slice(0, 12)} -> ${sha.slice(0, 12)}). Whether the aligner itself changed is not recorded in the file.`}`,
      );
    } else if (reference.alignerHash !== currentAligner && !allowShaDrift) {
      throw new ReviewError(
        `the reference judges aligner ${reference.alignerHash.slice(0, 12)} and this build is ` +
          `${currentAligner.slice(0, 12)}. A reference judges one aligner; scoring it against ` +
          `another says nothing. The hashed modules are ${ALIGNER_SOURCE_FILES.join(', ')}. ` +
          'Re-review at this build, use --compare to measure the change, or pass ' +
          '--allow-sha-drift if you have established the pairing is unaffected.',
      );
    } else if (reference.alignerHash !== currentAligner) {
      console.log('  --allow-sha-drift: the reference judges a different aligner and is scored anyway');
    }
  }

  reportSingle(reel, reference, rows);

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = {
    reel,
    generatedAt,
    cacheEntry: entry.name,
    promptVersion: entry.promptVersion,
    currentSha: sha,
    currentAlignerHash: currentAligner,
    costModel: costModelName,
    referencePath: path.relative(path.join(OUT_DIR, '..', '..', '..'), referencePath),
    referenceSha: reference.headSha,
    referenceAlignerHash: reference.alignerHash ?? null,
    referenceSchemaVersion: reference.schemaVersion,
  };

  let comparison: AlignComparison | null = null;
  let rereviewPath: string | null = null;
  if (compareFlag !== null) {
    comparison = compareAgainstReference(rows, reference);
    reportComparison(comparison);

    const moved = movedRows(comparison);
    const byId = new Map(rows.map((r) => [r.wordId, r]));
    const sheetRows: SheetRow[] = moved.map((m) => ({
      ...(byId.get(m.wordId) as AlignmentRow),
      previousDraftText: m.previousDraftText,
    }));
    rereviewPath = path.join(OUT_DIR, `${reel}.rereview.html`);
    writeFileSync(
      rereviewPath,
      renderSheet({
        reel,
        headSha: sha,
        generatedAt,
        cacheEntry: entry.name,
        promptVersion: entry.promptVersion,
        rows: sheetRows,
        variant: 'rereview',
        previousSha: reference.headSha,
        schemaVersion: ALIGN_REFERENCE_SCHEMA_VERSION,
        alignerHash: currentAligner,
      }),
    );
  }

  const scorePath = path.join(OUT_DIR, `${reel}.score.json`);
  writeFileSync(
    scorePath,
    `${JSON.stringify(
      {
        ...stamp,
        comparedSha: comparison === null ? null : reference.headSha,
        score: scoreAlignment(rows, reference),
        comparison:
          comparison === null
            ? null
            : {
                repairCandidates: comparison.repairCandidates,
                regressions: comparison.regressions,
                stillInexpressible: comparison.stillInexpressible,
                unrepaired: comparison.unrepaired,
                held: comparison.held,
                noToken: comparison.noToken,
              },
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\n  ${scorePath}`);
  if (rereviewPath !== null) console.log(`  ${rereviewPath}`);
}

try {
  main();
} catch (error) {
  if (
    error instanceof ReviewError ||
    error instanceof AlignScoreError ||
    error instanceof AlignReferenceError ||
    error instanceof CacheEntrySelectionError
  ) {
    console.error(`align:score: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
