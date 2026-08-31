/**
 * `npm run golden` — build every reel in the golden set, census it, and compare
 * against the committed reference.
 *
 * Free and local. Every reel here is fully cached, so the run asserts $0.00
 * before it starts rather than discovering it afterwards, and reports the
 * ledger at both ends.
 *
 * Recording is `--record`, a separate and explicit action. A command that
 * quietly rewrites what it checks against is a check that cannot fail.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  GOLDEN_EXCLUDED_FIELDS,
  GOLDEN_REELS,
  GOLDEN_REELS_EXCLUDED,
  GOLDEN_SCHEMA_VERSION,
  REPO_ROOT,
  compareCensus,
  countFields,
  excludedFieldsSummary,
  normaliseCensus,
  parseGoldenReference,
  type FieldDifference,
} from '@framopia/core';

const REFERENCE_PATH = path.join(REPO_ROOT, 'benchmarks', 'references', 'golden', 'census.json');
const LEDGER = path.join(REPO_ROOT, '.local', 'costs.jsonl');

/** Reel to the basename of its Edit Plan and its video. */
const PLAN_STEM: Record<string, string> = {
  'test-1': 'test 1',
  'test-2': 'test 2',
  'test-3': 'test 3',
  vitasilk: 'vitasilk',
};

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function ledgerState(): { lines: number; sha256: string } {
  if (!existsSync(LEDGER)) return { lines: 0, sha256: 'absent' };
  const text = readFileSync(LEDGER, 'utf8');
  return {
    lines: text.split('\n').filter((l) => l.trim() !== '').length,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

function gitCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function aeVersionFrom(census: Record<string, unknown>): string {
  const v = census['aeVersion'];
  return typeof v === 'string' ? v : 'unknown';
}

/**
 * How many faces this machine has, recorded rather than compared.
 *
 * It says nothing about the comp — the face set on each text layer is what the
 * comparison checks — but it is worth printing beside a difference, because a
 * font library that does not match is one of the few things that could change
 * how a card was set.
 */
function fontNamesFrom(census: Record<string, unknown>): number | null {
  const n = census['fontNameCount'];
  return typeof n === 'number' ? n : null;
}

/**
 * Nothing here can spend, and the pre-flight says why rather than sampling it.
 *
 * The golden run **builds**; it never runs the pipeline. `runBuildJob` places
 * cached candidates, reads measurements already on disk and saves a project —
 * there is no path from it to a paid API, which `golden.cli.test.ts` pins by
 * reading this file's own imports. So the guarantee is structural, and the
 * ledger comparison at both ends is what would catch it being wrong.
 *
 * The pipeline figure is reported beside it because it is genuinely useful —
 * `test-3` would cost $2.3508 if anyone ran its analysis and images — and
 * because a reader must not mistake one for the other. It is not a refusal:
 * refusing on it would refuse `test-3`, which builds perfectly well from what
 * is already on disk.
 */
async function pipelineCostNotes(reels: readonly string[]): Promise<string[]> {
  const { dryRun } = await import(path.join(REPO_ROOT, 'service', 'dist', 'dry-run.js'));
  const notes: string[] = [];
  for (const reel of reels) {
    const plan = await dryRun(reel, 'k2-syndicalia');
    notes.push(
      `${reel.padEnd(9)} building costs nothing; a full pipeline run would cost ` +
        `$${plan.estimateUsd.toFixed(4)}`,
    );
  }
  return notes;
}

async function censusOf(reel: string, outDir: string): Promise<Record<string, unknown>> {
  const planPath = path.join(REPO_ROOT, 'my files', 'test videos', `${PLAN_STEM[reel]}.editplan.json`);
  if (!existsSync(planPath)) {
    throw new Error(`${reel} has no Edit Plan at ${planPath}, so there is nothing to build.`);
  }
  const { runBuildJob } = await import(path.join(REPO_ROOT, 'service', 'dist', 'build', 'job.js'));
  // The builder has its own pre-flight and refuses rather than producing a comp
  // with holes; that refusal is the right one and is not duplicated here. What
  // this adds is the reel's name, which the builder does not know it needs.
  let progress: { savePath?: string | null };
  try {
    progress = await runBuildJob({ reel, planPath });
  } catch (error) {
    throw new Error(`${reel} did not build: ${(error as Error).message}`);
  }
  if (progress.savePath === null || progress.savePath === undefined) {
    throw new Error(`${reel} built but reported no save path, so there is nothing to census.`);
  }
  const out = path.join(outDir, `${reel}.json`);
  execFileSync(
    'npx',
    ['tsx', 'tools/ae/census-cli.ts', '--aep', progress.savePath, '--plan', planPath, '--mode', 'k2-syndicalia', '--out', out],
    { cwd: REPO_ROOT, stdio: 'pipe' },
  );
  return JSON.parse(readFileSync(out, 'utf8')) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const record = has('record');
  const referencePath = flag('reference') ?? REFERENCE_PATH;
  const reels = GOLDEN_REELS as readonly string[];

  const ledgerBefore = ledgerState();
  const started = new Date().toISOString();

  console.log(`framopia golden — ${hostname()}`);
  console.log(`repo:      ${REPO_ROOT}`);
  console.log(`commit:    ${gitCommit()}`);
  console.log(`reels:     ${reels.join(', ')}`);
  for (const [reel, why] of Object.entries(GOLDEN_REELS_EXCLUDED)) {
    console.log(`           not included: ${reel} — ${why}`);
  }
  console.log(`ledger:    ${ledgerBefore.lines} lines, ${ledgerBefore.sha256.slice(0, 16)}`);
  console.log('excluded fields, each measured to vary and for no other reason:');
  for (const line of excludedFieldsSummary()) console.log(`           ${line}`);
  console.log('           absolute paths are made repo-relative, not excluded');
  console.log('');

  for (const note of await pipelineCostNotes(reels)) console.log(`  free   ${note}`);
  console.log('');

  const workDir = mkdtempSync(path.join(tmpdir(), 'framopia-golden-'));
  const measured: Record<string, unknown> = {};
  let aeVersion = 'unknown';
  let fontNames: number | null = null;
  try {
    for (const reel of reels) {
      const census = await censusOf(reel, workDir);
      aeVersion = aeVersionFrom(census);
      fontNames = fontNamesFrom(census);
      measured[reel] = normaliseCensus(census, REPO_ROOT);
      console.log(`  built  ${reel.padEnd(9)} ${countFields(measured[reel])} fields censused`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
  console.log('');

  if (record) {
    const reference = {
      schemaVersion: GOLDEN_SCHEMA_VERSION,
      recordedBy: 'npm run golden -- --record',
      recordedAt: started,
      recordedOn: { machine: hostname(), aeVersion, fontNames, commit: gitCommit() },
      excluded: GOLDEN_EXCLUDED_FIELDS,
      reels: measured,
    };
    writeFileSync(referencePath, `${JSON.stringify(reference, null, 2)}\n`, 'utf8');
    console.log(`recorded ${referencePath}`);
    console.log(`         ${readFileSync(referencePath).length} bytes, sha256 ${createHash('sha256').update(readFileSync(referencePath)).digest('hex').slice(0, 16)}`);
    for (const reel of reels) console.log(`         ${reel.padEnd(9)} ${countFields(measured[reel])} fields`);
  } else {
    if (!existsSync(referencePath)) {
      throw new Error(
        `there is no golden reference at ${referencePath}. Record one with ` +
          '`npm run golden -- --record`; a comparison against nothing passes trivially.',
      );
    }
    const raw = readFileSync(referencePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${referencePath} is not readable JSON: ${(error as Error).message}`);
    }
    const reference = parseGoldenReference(parsed, referencePath);
    console.log(`reference ${referencePath}`);
    console.log(
      `          sha256 ${createHash('sha256').update(raw).digest('hex').slice(0, 16)}, recorded ` +
        `${reference.recordedAt} on ${reference.recordedOn.machine} ` +
        `(After Effects ${reference.recordedOn.aeVersion}, ${reference.recordedOn.fontNames ?? '?'} font names)`,
    );
    console.log(`this run  After Effects ${aeVersion}, ${fontNames ?? '?'} font names installed`);
    if (aeVersion !== reference.recordedOn.aeVersion) {
      console.log(
        '          the two were measured on different After Effects builds. That is not a ' +
          'difference in what was built: if every field below matches, this is a pass.',
      );
    }
    console.log('');

    let matched = 0;
    const differences: { reel: string; diffs: FieldDifference[] }[] = [];
    for (const reel of reels) {
      const expected = reference.reels[reel];
      const diffs = compareCensus(expected, measured[reel], reel);
      if (diffs.length === 0) {
        matched += 1;
        console.log(`  ok    ${reel.padEnd(9)} ${countFields(measured[reel])} fields identical`);
      } else {
        differences.push({ reel, diffs });
        console.log(`  FAIL  ${reel.padEnd(9)} ${diffs.length} field(s) differ`);
      }
    }
    console.log('');
    if (differences.length > 0) {
      for (const { reel, diffs } of differences) {
        console.error(`${reel}:`);
        for (const d of diffs.slice(0, 40)) {
          console.error(`  ${d.path}`);
          console.error(`      expected ${JSON.stringify(d.expected)}`);
          console.error(`      actual   ${JSON.stringify(d.actual)}`);
        }
        if (diffs.length > 40) console.error(`  … and ${diffs.length - 40} more on this reel`);
      }
      const total = differences.reduce((n, d) => n + d.diffs.length, 0);
      console.error('');
      console.error(
        `golden: ${matched} of ${reels.length} reels matched; ${total} field(s) differ across ` +
          `${differences.map((d) => d.reel).join(', ')}. A difference is a finding, not a fault: ` +
          'send this output rather than changing anything.',
      );
      failLedger(ledgerBefore);
      process.exit(1);
    }
    console.log(`golden: ${matched} of ${reels.length} reels matched, field for field`);
  }

  failLedger(ledgerBefore);
  console.log('golden: PASS');
}

function failLedger(before: { lines: number; sha256: string }): void {
  const after = ledgerState();
  console.log(`ledger:    ${after.lines} lines, ${after.sha256.slice(0, 16)}`);
  if (after.lines !== before.lines || after.sha256 !== before.sha256) {
    console.error(
      `\nthe cost ledger moved during a run that must spend nothing: ` +
        `${before.lines} lines ${before.sha256.slice(0, 16)} -> ${after.lines} lines ${after.sha256.slice(0, 16)}`,
    );
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(`\ngolden: ${(error as Error).message}`);
  process.exit(1);
});
