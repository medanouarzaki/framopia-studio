import { describe, expect, it } from 'vitest';
import {
  FATAL_BLOCKING,
  exitCodeFor,
  formatCheck,
  formatReport,
  redact,
  summarise,
  type CheckResult,
  type DoctorReport,
} from './doctor.js';

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'ffmpeg',
    what: 'ffmpeg',
    state: 'present',
    detail: 'ffmpeg 8.0.1 at /opt/homebrew/bin/ffmpeg',
    blocking: 'run',
    ...over,
  };
}

describe('summarise', () => {
  it('counts the three states apart', () => {
    const s = summarise([
      check(),
      check({ id: 'a', state: 'absent', blocking: 'money' }),
      check({ id: 'b', state: 'unknown' }),
    ]);
    expect(s).toMatchObject({ total: 3, present: 1, absent: 1, unknown: 1 });
  });

  /*
   * The whole point of the third state. Folding "cannot tell" into "fine" is
   * this project's dominant defect class, so an unknown is never a pass and
   * never a failure — it is a thing to go and find out.
   */
  it('never counts an unknown as a blocker', () => {
    const s = summarise([check({ state: 'unknown', blocking: 'run' })]);
    expect(s.blockers).toEqual([]);
    expect(s.undetermined).toEqual(['ffmpeg']);
    expect(s.ok).toBe(true);
  });

  it('blocks on an absent run or build item, and not on the rest', () => {
    for (const blocking of FATAL_BLOCKING) {
      expect(summarise([check({ state: 'absent', blocking })]).blockers).toEqual(['ffmpeg']);
    }
    for (const blocking of ['money', 'dev', 'panel'] as const) {
      expect(summarise([check({ state: 'absent', blocking })]).blockers).toEqual([]);
    }
  });

  it('names every remedy nobody has run', () => {
    const s = summarise([
      check({ id: 'a', state: 'absent', remedy: 'do this', remedyVerified: true }),
      check({ id: 'b', state: 'absent', remedy: 'do that', remedyVerified: false }),
      check({ id: 'c', state: 'absent', remedy: 'do the other' }),
    ]);
    expect(s.unverifiedRemedies).toEqual(['b', 'c']);
  });

  it('is ok on an empty set rather than throwing', () => {
    expect(summarise([])).toMatchObject({ total: 0, ok: true });
  });
});

describe('exitCodeFor', () => {
  it('is zero when nothing required is absent', () => {
    expect(exitCodeFor(summarise([check(), check({ id: 'x', state: 'unknown' })]))).toBe(0);
  });

  it('is non-zero when something required is absent', () => {
    expect(exitCodeFor(summarise([check({ state: 'absent' })]))).toBe(1);
  });
});

describe('formatCheck', () => {
  it('puts the measured value beside the verdict, never a bare ok', () => {
    const text = formatCheck(check());
    expect(text).toContain('ffmpeg 8.0.1 at /opt/homebrew/bin/ffmpeg');
  });

  it('marks a remedy nobody has run', () => {
    expect(formatCheck(check({ state: 'absent', remedy: 'brew install ffmpeg' }))).toContain(
      '(unverified remedy)',
    );
    expect(
      formatCheck(check({ state: 'absent', remedy: 'brew install ffmpeg', remedyVerified: true })),
    ).not.toContain('(unverified remedy)');
  });

  it('shows a caveat when there is one', () => {
    expect(formatCheck(check({ caveat: 'reported, not certified' }))).toContain(
      'reported, not certified',
    );
  });
});

describe('formatReport', () => {
  const report = (checks: CheckResult[]): DoctorReport => ({
    schemaVersion: 1,
    tool: 'tools/doctor/cli.ts',
    measuredAt: '2026-08-30T00:00:00.000Z',
    machine: { platform: 'darwin', release: '26', arch: 'arm64', hostname: 'h', label: 'a-mbp' },
    repoRoot: '/repo',
    checks,
    summary: summarise(checks),
  });

  it('names every blocker with what to do about it', () => {
    const text = formatReport(
      report([check({ state: 'absent', remedy: 'brew install ffmpeg' })]),
    );
    expect(text).toContain('cannot run the pipeline until these are fixed');
    expect(text).toContain('brew install ffmpeg');
  });

  it('says plainly that an unknown is not the same as fine', () => {
    const text = formatReport(report([check({ state: 'unknown' })]));
    expect(text).toContain('could not be determined, which is not the same as fine');
  });

  it('says nothing about blockers when there are none', () => {
    expect(formatReport(report([check()]))).not.toContain('cannot run the pipeline');
  });
});

/* Presence is reportable; the value never is — not even its length. */
describe('redact', () => {
  it('carries no part of the value', () => {
    expect(redact()).toBe('present (value not shown)');
  });
});
