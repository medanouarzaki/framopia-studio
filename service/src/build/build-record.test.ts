import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildRecordAfterFailure, buildRecordFor } from './build-record.js';
import type { Build } from '../editplan/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function anAep(bytes = 'x'): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-build-record-'));
  const p = path.join(dir, 'reel-full.aep');
  writeFileSync(p, bytes);
  return p;
}

/** Comments stripped, so a note about a rule is never mistaken for the rule. */
function sourceOf(file: string): string {
  return readFileSync(path.join(HERE, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('buildRecordFor', () => {
  it('records the path and the moment when the file is really there', () => {
    const aepPath = anAep();
    const at = '2026-08-31T10:00:00.000Z';
    expect(buildRecordFor({ aepPath, builtAt: at })).toEqual({
      status: 'built',
      aepPath,
      builtAt: at,
    });
  });

  it('refuses when the build reported no save path', () => {
    expect(() => buildRecordFor({ aepPath: null, builtAt: 'x' })).toThrow(/nothing to record/);
  });

  it('refuses when the file the build named is not on disk', () => {
    expect(() =>
      buildRecordFor({ aepPath: '/nowhere/reel-full.aep', builtAt: 'x' }),
    ).toThrow(/no file there/);
  });

  it('refuses an empty file, which is the failure it is guarding', () => {
    expect(() => buildRecordFor({ aepPath: anAep(''), builtAt: 'x' })).toThrow(/no file there/);
  });

  it('never invents a status other than built', () => {
    expect(buildRecordFor({ aepPath: anAep(), builtAt: 'x' }).status).toBe('built');
  });
});

describe('a failed build', () => {
  const built: Build = {
    status: 'built',
    aepPath: '/repo/.local/build/vitasilk-full.aep',
    builtAt: '2026-08-30T09:00:00.000Z',
  };

  it('leaves an earlier true record alone', () => {
    expect(buildRecordAfterFailure(built)).toEqual(built);
  });

  it('does not mark it stale — that word is mergeIntoExistingPlan’s', () => {
    expect(buildRecordAfterFailure(built).status).not.toBe('stale');
  });

  it('leaves a plan that was never built saying nothing', () => {
    const none: Build = { status: 'none', aepPath: null, builtAt: null };
    expect(buildRecordAfterFailure(none)).toEqual(none);
  });
});

describe('the record is written where the build happens, not in a wrapper', () => {
  /*
   * The same rule `appendCost` follows: a wrapper cannot know whether the thing
   * it wraps really happened, so it fabricates. `job.ts` spawns the CLI and
   * parses its stdout; if it ever wrote the record itself it would be writing
   * `built` from a string it read rather than from a file it checked.
   */
  it('the CLI writes it', () => {
    const cli = sourceOf('build-reel-cli.ts');
    expect(cli).toContain('buildRecordFor');
    expect(cli).toContain('writeEditPlan');
  });

  it('the job that spawns the CLI does not', () => {
    const job = sourceOf('job.ts');
    expect(job).not.toContain('buildRecordFor');
    expect(job).not.toContain('writeEditPlan');
    expect(job).not.toContain('build-record');
  });

  it('the write is guarded by the build having succeeded', () => {
    const cli = sourceOf('build-reel-cli.ts');
    // The call site, not the import line at the top of the file.
    const write = cli.lastIndexOf('buildRecordFor(');
    const guard = cli.lastIndexOf('if (result.ok)', write);
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(guard);
  });

  it('the write comes after every check that can still refuse the build', () => {
    // assertEveryCardFits and the audio-start comparison both exit non-zero on a
    // build whose .aep is already saved; recording before them would put `built`
    // on a plan the same run rejects.
    const cli = sourceOf('build-reel-cli.ts');
    const write = cli.lastIndexOf('buildRecordFor(');
    expect(write).toBeGreaterThan(cli.indexOf('assertEveryCardFits('));
    expect(write).toBeGreaterThan(cli.indexOf('does not match the plan'));
  });
});
