/**
 * `npm run doctor` — what this machine is missing.
 *
 * Block 10's remaining question is whether this works on a machine it was not
 * written on, and the answer starts with a list of what the machine has to
 * provide. `docs/MACHINE_REQUIREMENTS.md` is that list; this is what looks.
 *
 * **It reports and never repairs.** There is no `--fix`: a command that changes
 * a machine while telling you about it is two things, and the second one is the
 * kind that goes wrong quietly.
 *
 * **It runs on a machine with nothing installed.** Every check that shells out
 * catches; the After Effects checks degrade to *could not be determined* when
 * nothing is running rather than failing the process. A doctor that crashes on
 * a cold machine is worse than none.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DOCTOR_SCHEMA_VERSION,
  REPO_ROOT,
  exitCodeFor,
  formatReport,
  summarise,
  type DoctorReport,
} from '@framopia/core';
import { machineFacts, runChecks, type AeState } from './checks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AE_APPLICATION = 'Adobe After Effects 2026';
const AE_EXECUTABLE =
  '/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects';

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function aeInstances(): number | null {
  try {
    const out = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' });
    return out.split('\n').filter((line) => line.trim() === AE_EXECUTABLE).length;
  } catch {
    return null;
  }
}

/**
 * Asks the running After Effects, if there is one.
 *
 * Never launches it and never retries into a wall: a machine with no After
 * Effects is a machine the doctor still has to report on. `DoScript` returning
 * non-zero, or writing no result, both read as unreachable — which is honest,
 * because from here they are indistinguishable from the preference being off.
 */
function askAfterEffects(): AeState {
  const instances = aeInstances();
  if (instances === null) return { reachable: false, reason: 'could not list processes' };
  if (instances === 0) {
    return { reachable: false, reason: 'After Effects is not running', instances: 0 };
  }
  if (instances > 1) {
    return {
      reachable: false,
      reason: `${instances} After Effects instances are running; which one answers is not decidable`,
      instances,
    };
  }

  /*
   * The no-file half, first.
   *
   * `DoScript` returns a status and not the script's value — measured: 0 when a
   * script runs to completion, 1 when it throws. That is one bit, it needs no
   * file, and it is the only thing an After Effects with the scripting
   * preference switched off can still tell us. Only the 0 is evidence: a
   * blocked `DoScript` returns 1 too.
   */
  let answering: boolean | null = null;
  try {
    execFileSync(
      'osascript',
      [
        '-e',
        `tell application "${AE_APPLICATION}" to DoScript "if (!app.version) { throw new Error('no version'); }"`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    answering = true;
  } catch {
    answering = false;
  }

  const runDir = path.join(REPO_ROOT, '.local', 'build');
  mkdirSync(runDir, { recursive: true });
  const resultPath = path.join(runDir, '.doctor-probe.json');
  if (existsSync(resultPath)) unlinkSync(resultPath);

  const script = [
    `$.evalFile("${path.join(REPO_ROOT, 'panel', 'jsx', 'json2.jsx')}");`,
    `$.evalFile("${path.join(REPO_ROOT, 'panel', 'jsx', 'fonts.jsx')}");`,
    `$.evalFile("${path.join(HERE, 'probe.jsx')}");`,
    `framopiaDoctorProbe("${resultPath}");`,
  ]
    .join(' ')
    .replace(/"/gu, '\\"');

  try {
    execFileSync('osascript', ['-e', `tell application "${AE_APPLICATION}" to DoScript "${script}"`], {
      stdio: 'ignore',
    });
  } catch (error) {
    return {
      reachable: false,
      answering,
      wroteResult: false,
      reason: `DoScript failed: ${(error as Error).message}`,
      instances,
    };
  }
  if (!existsSync(resultPath)) {
    return {
      reachable: false,
      answering,
      wroteResult: false,
      instances,
      reason:
        answering === true
          ? 'After Effects ran a script to completion but wrote no result file, which is ' +
            'the scripting preference being off'
          : 'After Effects wrote no result and no script ran to completion',
    };
  }
  const raw = JSON.parse(readFileSync(resultPath, 'utf8')) as {
    ok?: boolean;
    message?: string;
    appVersion?: string;
    scriptingAllowed?: boolean | null;
    fontNames?: string[] | null;
    fontNameCount?: number | null;
  };
  unlinkSync(resultPath);
  if (raw.ok !== true) {
    return {
      reachable: false,
      answering,
      wroteResult: true,
      instances,
      reason: raw.message ?? 'the probe reported no reason',
    };
  }
  return {
    reachable: true,
    answering,
    wroteResult: true,
    instances,
    ...(raw.appVersion === undefined ? {} : { appVersion: raw.appVersion }),
    scriptingAllowed: raw.scriptingAllowed ?? null,
    ...(raw.fontNames == null ? {} : { fontNames: raw.fontNames }),
    ...(raw.fontNameCount == null ? {} : { fontNameCount: raw.fontNameCount }),
  };
}

/*
 * A synthetic After Effects state, so the checks that depend on one can be
 * watched failing without touching the real application — the font check must
 * never write a name to prove itself, and the scripting preference is the
 * user's to set.
 */
const injected = process.env['FRAMOPIA_DOCTOR_AE_STATE'];
const skipAe = process.argv.includes('--no-after-effects');
const ae: AeState =
  injected !== undefined && injected !== ''
    ? (JSON.parse(readFileSync(injected, 'utf8')) as AeState)
    : skipAe
      ? { reachable: false, reason: 'not asked (--no-after-effects)' }
      : askAfterEffects();

const checks = runChecks(ae, {
  modeId: flag('mode') ?? 'k2-syndicalia',
  hashFootage: process.argv.includes('--hash-footage'),
});
const summary = summarise(checks);
const machine = machineFacts();
const report: DoctorReport = {
  schemaVersion: DOCTOR_SCHEMA_VERSION,
  tool: 'tools/doctor/cli.ts',
  measuredAt: new Date().toISOString(),
  machine,
  repoRoot: REPO_ROOT,
  checks,
  summary,
};

console.log(formatReport(report));

const outPath =
  flag('out') ??
  path.join(REPO_ROOT, 'reports', `doctor-${(machine.label ?? machine.hostname).replace(/\W+/gu, '-')}.json`);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nwrote ${path.relative(REPO_ROOT, outPath)}`);

process.exit(exitCodeFor(summary));
