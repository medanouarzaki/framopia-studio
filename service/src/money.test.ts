import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COSTS_PATH, REPO_ROOT } from '@framopia/core';
import { moneyView, reelCosts } from './money.js';
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
