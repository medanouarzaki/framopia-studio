import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';


/**
 * The ExtendScript syntax gate, pinned.
 *
 * `tools/ae/measure-fonts.jsx` was handed to the user with `short` and `long`
 * as object keys — both reserved in ExtendScript, whose word list is Java's —
 * so it died at the parse and measured nothing. **A syntax error needs no After
 * Effects to catch**, and nothing here was looking: `.jsx` is not TypeScript,
 * eslint is pointed at `src`, and no test opened these files.
 *
 * The gate lives in `scripts/` because `npm run check` runs it over the whole
 * repository rather than one workspace, and it is tested here for the same
 * reason `audit-safety.test.ts` reads `panel/jsx/` from core: this is where
 * repo-wide rules are pinned.
 */
const GATE = path.join(REPO_ROOT, 'scripts', 'check-extendscript.mjs');

async function gate(): Promise<{
  findProblems: (source: string) => { line: number | null; what: string; detail: string }[];
  checkAll: () => { files: string[]; failures: { file: string; problems: unknown[] }[] };
  stripCommentsAndStrings: (source: string) => string;
}> {
  return (await import(GATE)) as never;
}

describe('the ExtendScript gate', () => {
  it('catches the two words that broke the font script', async () => {
    const { findProblems } = await gate();
    const problems = findProblems("var s = { short: 'a', long: 'b' };\n");

    expect(problems).toHaveLength(2);
    expect(problems[0]?.what).toBe('reserved word');
    expect(problems.map((p) => p.detail).join(' ')).toContain('"short"');
    expect(problems.map((p) => p.detail).join(' ')).toContain('"long"');
  });

  it('catches a reserved word after a dot, which is where the second half hid', async () => {
    const { findProblems } = await gate();
    expect(findProblems('var w = sample.short;\n')).toHaveLength(1);
  });

  it('reports the line the parser would stop at', async () => {
    const { findProblems } = await gate();
    const problems = findProblems('var a = 1;\nvar b = 2;\nvar c = { int: 3 };\n');

    expect(problems).toHaveLength(1);
    expect(problems[0]?.line).toBe(3);
  });

  /*
   * A quoted key is legal ExtendScript and must not be flagged, which is the
   * whole reason strings are stripped before the scan rather than after.
   */
  it('allows a reserved word as a quoted key, and inside a string or a comment', async () => {
    const { findProblems } = await gate();

    expect(findProblems("var s = { 'short': 1 };\n")).toEqual([]);
    expect(findProblems("var msg = 'the short and long of it';\n")).toEqual([]);
    expect(findProblems('/* short and long */\n// long\nvar a = 1;\n')).toEqual([]);
  });

  it('catches syntax that is not ES3', async () => {
    const { findProblems } = await gate();

    expect(findProblems('const a = 1;\n')[0]?.detail).toContain('const');
    expect(findProblems('var f = function () {};\nvar g = () => 1;\n')[0]?.detail).toContain(
      'arrow',
    );
    expect(findProblems('var s = `x`;\n')[0]?.detail).toContain('template literal');
  });

  it('catches a structural error the reserved-word scan would miss', async () => {
    const { findProblems } = await gate();
    const problems = findProblems('function f( {\n');

    expect(problems.some((p) => p.what === 'syntax')).toBe(true);
  });

  /*
   * A regex literal contains characters that look like a string opening, so a
   * stripper that got this wrong would blind the scan for the rest of the file.
   */
  it('does not lose its place in a regex literal', async () => {
    const { findProblems, stripCommentsAndStrings } = await gate();

    expect(stripCommentsAndStrings("var r = /['\"]/g;\nvar a = 1;\n")).toContain('var a = 1;');
    expect(findProblems("var r = /[ \\-]/g;\nvar b = { int: 1 };\n")).toHaveLength(1);
  });

  it('passes every .jsx in the repository', async () => {
    const { checkAll } = await gate();
    const { files, failures } = checkAll();

    expect(files.length).toBeGreaterThanOrEqual(9);
    expect(failures).toEqual([]);
  });

  it('exits non-zero from the command line, which is what npm run check reads', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-jsx-'));
    const file = path.join(dir, 'broken.jsx');
    writeFileSync(file, "var s = { short: 'a' };\n", 'utf8');
    try {
      expect(() =>
        execFileSync(process.execPath, [GATE, file], { stdio: ['ignore', 'pipe', 'pipe'] }),
      ).toThrow();

      writeFileSync(file, "var s = { oneWord: 'a' };\n", 'utf8');
      expect(() =>
        execFileSync(process.execPath, [GATE, file], { stdio: ['ignore', 'pipe', 'pipe'] }),
      ).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
