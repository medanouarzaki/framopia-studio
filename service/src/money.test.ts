import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COSTS_PATH, REPO_ROOT } from '@framopia/core';
import { isOsTemporary, moneyView, reelCosts } from './money.js';
import { planPathsForMoney } from './money-plans.js';

/**
 * **The money screen's back end reads the ledger and never writes it.**
 *
 * Block 11 session 65 found a *test* writing a fabricated $0.134 charge into the
 * real ledger, on a machine whose ledger did not exist yet, where it stayed for
 * good. So this is asserted structurally rather than remembered.
 */
const SOURCE = readFileSync(path.join(REPO_ROOT, 'service', 'src', 'money.ts'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the money view', () => {
  it('never writes to the ledger', () => {
    // It writes two files of its own — the credit figure and the cap — and
    // neither is the ledger. What it must never do is name COSTS_PATH beside a
    // write, so the check is that every write names one of its own paths.
    for (const line of CODE.split('\n')) {
      if (line.trimStart().startsWith('import ')) continue;
      if (!/(write|append)FileSync\(/.test(line)) continue;
      expect(`${line.trim()}`).toMatch(/CREDIT_PATH|CAP_PATH/);
    }
    expect(CODE).not.toMatch(/(write|append)FileSync\([^)]*COSTS_PATH/);
  });

  it('opens the ledger only to read it', () => {
    expect(CODE).toContain('readFileSync(costsPath');
    // No handle, no flags, no append mode.
    expect(CODE).not.toContain('openSync');
    expect(CODE).not.toContain("'a'");
  });

  it('reads the real ledger and reconciles to the cent', () => {
    const view = moneyView({ costsPath: COSTS_PATH, planPaths: planPathsForMoney() });
    // The figure every report has carried since Block 10 session 46.
    expect(view.totalUsd).toBe(18.832129);
    expect(view.unreadable).toBe(0);
  });

  it('says what it cannot attribute rather than dropping it', () => {
    const view = moneyView({ costsPath: COSTS_PATH, planPaths: [] });
    // Every one of the 165 existing lines predates session 68's fields.
    expect(view.unattributedUsd).toBe(view.totalUsd);
  });

  /*
   * A partial run must not read as a whole one: measured on 2026-09-08, four of
   * the six reels with any spend billed only one or two stages.
   */
  it('says which stages a reel actually paid for', () => {
    const reels = reelCosts(planPathsForMoney());
    expect(reels.length).toBeGreaterThan(0);
    for (const r of reels) expect(Array.isArray(r.stages)).toBe(true);
    const complete = reels.filter((r) => r.stages.length >= 4);
    // Only sora's two runs have ever been complete.
    expect(complete.length).toBeLessThan(reels.length);
  });

  it('has no cap and no credit until they are set', () => {
    const view = moneyView({ costsPath: COSTS_PATH, planPaths: [] });
    expect(view.cap.monthlyUsd).toBeNull();
    expect(view.credit).toBeNull();
  });
});

/**
 * **The test suite's own reels are not Mohamed's work.**
 *
 * He opened the money screen and found nine of them in his books — *"a video
 * this tool has never seen"*, *"a video whose client has no pictures at all"* —
 * because the suites write real Edit Plans into `.local/plans/`, which is also
 * where a client's plans live.
 */
describe('which reels are his', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function planFor(where: string, name: string, spentUsd: number, videoPath: string): string {
    const dir = mkdtempSync(path.join(where, 'framopia-reel-'));
    dirs.push(dir);
    const file = path.join(dir, `${name}.editplan.json`);
    writeFileSync(
      file,
      JSON.stringify({
        source: { videoPath, sha256: 'a'.repeat(64), durationS: 10 },
        costs: { totalUsd: spentUsd, byStage: {}, spentUsd, spentByStage: { images: spentUsd } },
      }),
      'utf8',
    );
    return file;
  }

  /*
   * Decided by what the video is: a file in the directory the operating system
   * owns and deletes. Not by the name — every one of the nine had a descriptive
   * name and no two were alike.
   */
  it('leaves out a reel whose video the operating system owns', () => {
    const inTemp = planFor(tmpdir(), 'a video this tool has never seen', 0.000488, path.join(tmpdir(), 'scratch.mov'));
    expect(reelCosts([inTemp])).toEqual([]);
    expect(isOsTemporary(path.join(tmpdir(), 'scratch.mov'))).toBe(true);
  });

  /*
   * **Money is never hidden.** A reel named exactly like the suite's scratch
   * ones, whose footage is somewhere real, is listed like any other — the name
   * plays no part in the decision.
   */
  it('shows a reel that carries money however scratch its name looks', () => {
    const real = planFor(
      tmpdir(),
      'a video this tool has never seen',
      3.5,
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.mov'),
    );
    const shown = reelCosts([real]);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.spentUsd).toBe(3.5);
    expect(shown[0]?.reel).toBe('a video this tool has never seen');
  });

  /* And spend is not the test: a real reel may legitimately have spent nothing. */
  it('keeps a real reel that has spent nothing yet', () => {
    const idle = planFor(
      tmpdir(),
      'a client reel not started',
      0,
      path.join(REPO_ROOT, 'my files', 'test videos', 'test 1.mov'),
    );
    expect(reelCosts([idle])).toHaveLength(1);
  });

  it('lists only the six reels that were really paid for', () => {
    const reels = reelCosts(planPathsForMoney());
    expect(reels.map((r) => r.reel).sort()).toEqual(
      ['ground truth', 'sora-6a60ced1', 'sora-995f2d27', 'test 1', 'test 2', 'vitasilk'].sort(),
    );
  });
});
