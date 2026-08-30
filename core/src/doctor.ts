/**
 * What a machine has to provide, and what this one actually does.
 *
 * Block 10's remaining question is whether this works on a machine it was not
 * written on, and the list of things it needs from outside the repo existed
 * nowhere — it was scattered across every place the code reaches out.
 * `docs/MACHINE_REQUIREMENTS.md` is that list written down; this is the part
 * that decides, and `tools/doctor/` is the part that looks.
 *
 * **Three states, never two.** `present`, `absent`, and `unknown` — a check that
 * could not tell. Folding "cannot tell" into "fine" is this project's dominant
 * defect class: a font check that certified a face After Effects had never been
 * asked about, a layout that passed four assertions in a browser the host is
 * three years newer than, a gate that tested a different quantity than the one
 * beside it. So a check that cannot reach its subject says so and the run says
 * so with it.
 *
 * **A remedy is verified by running it, or it is a guess**, and the guesses are
 * marked as such in the output rather than left to read like instructions.
 */

export const DOCTOR_SCHEMA_VERSION = 1;

export type CheckState = 'present' | 'absent' | 'unknown';

/**
 * What an absence stops. The doctor exits non-zero for `run` and `build`; a
 * `money` item costs a re-purchase and blocks nothing, and `dev` blocks the
 * checks rather than the product.
 */
export type Blocking = 'run' | 'build' | 'panel' | 'money' | 'dev';

export interface CheckResult {
  id: string;
  /** What is being looked for, in the words a person reads. */
  what: string;
  state: CheckState;
  /**
   * What was actually measured — a version, a path, a hash, a count. Present on
   * every state: an absent check reports where it looked, and an unknown one
   * reports what it could not reach.
   */
  detail: string;
  blocking: Blocking;
  /** The sentence to act on. Absent when the check passed. */
  remedy?: string;
  /**
   * Whether that remedy has been run and seen to work. A remedy nobody has
   * executed is a guess, and the output says which it is.
   */
  remedyVerified?: boolean;
  /** Anything true that the verdict alone does not carry. */
  caveat?: string;
}

export interface DoctorReport {
  schemaVersion: number;
  tool: string;
  measuredAt: string;
  machine: { platform: string; release: string; arch: string; hostname: string; label: string | null };
  repoRoot: string;
  checks: CheckResult[];
  summary: DoctorSummary;
}

export interface DoctorSummary {
  total: number;
  present: number;
  absent: number;
  unknown: number;
  /** Absent items whose `blocking` stops a run or a build. */
  blockers: string[];
  /** Everything that could not be determined, by id. */
  undetermined: string[];
  /** Remedies offered that nobody has executed, by id. */
  unverifiedRemedies: string[];
  ok: boolean;
}

/** `run` and `build` stop the product; the rest are worth knowing, not fatal. */
export const FATAL_BLOCKING: readonly Blocking[] = ['run', 'build'];

export function summarise(checks: CheckResult[]): DoctorSummary {
  const absent = checks.filter((c) => c.state === 'absent');
  const unknown = checks.filter((c) => c.state === 'unknown');
  const blockers = absent.filter((c) => FATAL_BLOCKING.includes(c.blocking)).map((c) => c.id);
  return {
    total: checks.length,
    present: checks.filter((c) => c.state === 'present').length,
    absent: absent.length,
    unknown: unknown.length,
    blockers,
    undetermined: unknown.map((c) => c.id),
    unverifiedRemedies: checks
      .filter((c) => c.remedy !== undefined && c.remedyVerified !== true)
      .map((c) => c.id),
    ok: blockers.length === 0,
  };
}

/**
 * The exit code. Non-zero when something required is absent — never for an
 * `unknown`, which is a thing to go and find out rather than a verdict.
 */
export function exitCodeFor(summary: DoctorSummary): number {
  return summary.ok ? 0 : 1;
}

const MARK: Record<CheckState, string> = { present: 'ok  ', absent: 'MISS', unknown: '????' };

export function formatCheck(check: CheckResult): string {
  const lines = [`  ${MARK[check.state]}  ${check.what}`, `        ${check.detail}`];
  if (check.caveat !== undefined) lines.push(`        note: ${check.caveat}`);
  if (check.remedy !== undefined) {
    const mark = check.remedyVerified === true ? '' : '  (unverified remedy)';
    lines.push(`        fix: ${check.remedy}${mark}`);
  }
  return lines.join('\n');
}

export function formatReport(report: DoctorReport): string {
  const s = report.summary;
  const out: string[] = [
    `framopia doctor — ${report.machine.label ?? report.machine.hostname}` +
      ` (${report.machine.platform} ${report.machine.release}, ${report.machine.arch})`,
    `repo: ${report.repoRoot}`,
    '',
  ];
  for (const check of report.checks) out.push(formatCheck(check), '');
  out.push(
    `${s.present} present, ${s.absent} absent, ${s.unknown} could not be determined,` +
      ` of ${s.total}`,
  );
  if (s.blockers.length > 0) {
    out.push('', 'this machine cannot run the pipeline until these are fixed:');
    for (const id of s.blockers) {
      const check = report.checks.find((c) => c.id === id) as CheckResult;
      out.push(`  ${check.what} — ${check.remedy ?? 'no remedy recorded'}`);
    }
  }
  if (s.undetermined.length > 0) {
    out.push(
      '',
      `could not be determined, which is not the same as fine: ${s.undetermined.join(', ')}`,
    );
  }
  return out.join('\n');
}

/**
 * A value that must never reach the output.
 *
 * Presence of a key is reportable; the value never is — not the first
 * characters, not the length, not a hash. This exists so the rule is a function
 * a test can call rather than a habit.
 */
export function redact(): string {
  return 'present (value not shown)';
}

/**
 * What the two After Effects probes between them establish.
 *
 * Session 9 could not tell *the scripting preference is off* from *nothing is
 * running*, because the only probe wrote its answer to a file and both cases
 * produce the same silence. Block 10 session 10 measured what `DoScript`
 * actually returns: **0 when a script runs to completion and 1 when it throws**,
 * which is a channel that needs no file. So a script that merely completes
 * proves After Effects is answering, and the two cases come apart.
 */
export interface AeProbeResult {
  /**
   * A script ran to completion — `DoScript` returned 0. Null when it was not
   * asked. **False is deliberately not "not running"**: a blocked `DoScript`
   * also returns 1, so only the true case is evidence.
   */
  answering: boolean | null;
  /** The file-writing probe produced its result file. */
  wroteResult: boolean;
  /** The preference as the probe read it, when it got far enough to read it. */
  preference: boolean | null;
}

export const SCRIPTING_PREFERENCE_PATH =
  'Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network';

export interface ScriptingVerdict {
  state: CheckState;
  detail: string;
  remedy?: string;
}

/**
 * Whether After Effects will let a driven build return its result.
 *
 * The case this exists for is the middle one: **answering, but no file
 * arrived.** Every driven script in this repo writes its result for the caller
 * to read back, so that combination is the preference being off and nothing
 * else — and it is off by default on a fresh install, which makes it the most
 * likely cold-machine failure there is.
 */
export function scriptingVerdict(probe: AeProbeResult): ScriptingVerdict {
  if (probe.wroteResult) {
    if (probe.preference === true) {
      return {
        state: 'present',
        detail: 'the preference is on, which is what lets a driven build return its result',
      };
    }
    if (probe.preference === false) {
      return {
        state: 'absent',
        detail:
          'After Effects reports the preference as off, though a script still wrote its result',
        remedy: SCRIPTING_PREFERENCE_PATH,
      };
    }
    return {
      state: 'unknown',
      detail:
        'a script wrote its result, so writing works, but this After Effects would not ' +
        'report the preference itself',
    };
  }
  if (probe.answering === true) {
    return {
      state: 'absent',
      detail:
        'After Effects ran a script to completion but no result file appeared, which is ' +
        'the preference being off: every driven build returns its result through a file',
      remedy: SCRIPTING_PREFERENCE_PATH,
    };
  }
  return {
    state: 'unknown',
    detail:
      'no script ran to completion, so nothing could be established — either After Effects ' +
      'is not running, or a DoScript was refused. Check it is open first.',
    remedy: 'open After Effects and run this again',
  };
}
