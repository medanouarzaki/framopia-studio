import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COSTS_PATH, REPO_ROOT, readLedger } from '@framopia/core';
import {
  addPayment,
  correctPayment,
  isOsTemporary,
  moneyView,
  reconcile,
  reelCosts,
  removePayment,
  type ReelCost,
} from './money.js';
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
    /*
     * It writes three files of its own — the credit figure, the cap, and the
     * payments session 71 added — and none of them is the ledger. What it must
     * never do is name COSTS_PATH beside a write, so the check is that every
     * write names one of its own paths. Adding a path here widens the list of
     * its own files; it does not weaken the rule, which is about COSTS_PATH.
     */
    for (const line of CODE.split('\n')) {
      if (line.trimStart().startsWith('import ')) continue;
      if (!/(write|append)FileSync\(/.test(line)) continue;
      expect(`${line.trim()}`).toMatch(/CREDIT_PATH|CAP_PATH|PAYMENTS_PATH/);
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

/**
 * **Money going in, which the ledger never sees.**
 *
 * The ledger records what the tool spent through the APIs. Mohamed also pays
 * into those accounts — roughly $23.40 to ElevenLabs and $20 elsewhere — and
 * none of it was anywhere in this repository.
 */
describe('money paid in', () => {
  it('is not a ledger line, and does not live in the ledger', () => {
    const source = readFileSync(path.join(REPO_ROOT, 'service', 'src', 'money.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // Payments have their own file, and nothing writes them near COSTS_PATH.
    expect(source).toContain("'payments.json'");
    for (const line of source.split('\n')) {
      if (line.trimStart().startsWith('import ')) continue;
      if (!/(write|append)FileSync\(/.test(line)) continue;
      expect(line.trim()).toMatch(/CREDIT_PATH|CAP_PATH|PAYMENTS_PATH/);
    }
  });

  /*
   * A payment is an amount, a day and an account. Anything less is not one, and
   * a figure typed wrong is worse than a figure absent.
   */
  it('refuses what is not a payment', () => {
    expect(() => addPayment(0, '2026-09-08', 'ElevenLabs')).toThrow(/above zero/);
    expect(() => addPayment(-5, '2026-09-08', 'ElevenLabs')).toThrow(/above zero/);
    expect(() => addPayment(10, 'yesterday', 'ElevenLabs')).toThrow(/the day it went in/);
    expect(() => addPayment(10, '2026-09-08', '  ')).toThrow(/the account it went to/);
  });

  it('names a payment that could not be found rather than doing nothing', () => {
    expect(() => correctPayment('nope', 10, '2026-09-08', 'ElevenLabs')).toThrow(/no payment/);
    expect(() => removePayment('nope')).toThrow(/no payment/);
  });
});

/**
 * **Two sources on one screen, now checked against each other.**
 *
 * The grand total is read from the ledger; the per-video figures come from each
 * plan's own `spentUsd`. Session 71 measured the difference at $10.098150 — of
 * which $4.502282 is benchmarks and prompt experiments belonging to no video,
 * leaving $5.594404 of production spend no plan claims.
 */
describe('the two sources', () => {
  const ledgerLine = (stage: string, usd: number): string =>
    JSON.stringify({ stage, model: 'm', unit: 'run', usd, timestamp: '2026-01-01T00:00:00.000Z' });

  const reel = (name: string, spentUsd: number): ReelCost => ({
    reel: name,
    spentUsd,
    durationS: 10,
    usdPerSecond: spentUsd / 10,
    stages: ['images'],
  });

  it('separates what belongs to no video from what no plan claims', () => {
    const lines = readLedger(
      [ledgerLine('images-generate', 10), ledgerLine('benchmark-gemini', 4)].join('\n'),
    ).lines;
    const r = reconcile(lines, [reel('a', 6)]);
    expect(r.ledgerTotalUsd).toBe(14);
    expect(r.outsideAnyVideoUsd).toBe(4);
    expect(r.ledgerProductionUsd).toBe(10);
    expect(r.videosAccountForUsd).toBe(6);
    expect(r.unaccountedUsd).toBe(4);
    expect(r.overclaimedUsd).toBe(0);
    expect(r.agrees).toBe(true);
  });

  /*
   * **The direction that is a defect.** The ledger is written at the point of
   * spend, so it cannot hold less than was really spent on a reel. A plan
   * claiming more is a plan asserting money nothing ever billed.
   */
  it('says so when a plan claims a spend the ledger never recorded', () => {
    const lines = readLedger(ledgerLine('images-generate', 5)).lines;
    const r = reconcile(lines, [reel('a', 9)]);
    expect(r.agrees).toBe(false);
    expect(r.overclaimedUsd).toBe(4);
    expect(r.unaccountedUsd).toBe(0);
  });

  it('agrees on the real ledger and the real plans', () => {
    const view = moneyView({ costsPath: COSTS_PATH, planPaths: planPathsForMoney() });
    const r = view.reconciliation;
    expect(r.agrees).toBe(true);
    expect(r.overclaimedUsd).toBe(0);
    // Measured on 2026-09-08 and unchanged by this session.
    expect(r.ledgerTotalUsd).toBe(18.832129);
    expect(r.outsideAnyVideoUsd).toBe(4.502282);
  });
});

/**
 * **What a reel really cost, where the ledger knows.**
 *
 * A plan's `spentByStage` accumulates, and does so correctly — but it only ever
 * accumulated what it saw. Spend billed before the field existed, or onto a plan
 * later replaced, is in the ledger and in no plan: session 71 measured
 * $5.595868 of it. The ledger is written at the point of spend and cannot hold
 * less than was charged, so where it knows a reel it is the floor.
 */
describe('a reel’s real cost', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  const SHA = 'b'.repeat(64);

  function planClaiming(spentUsd: number): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-realcost-'));
    dirs.push(dir);
    const file = path.join(dir, 'a client reel.editplan.json');
    writeFileSync(
      file,
      JSON.stringify({
        source: {
          videoPath: path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.mov'),
          sha256: SHA,
          durationS: 10,
        },
        costs: { totalUsd: spentUsd, byStage: {}, spentUsd, spentByStage: { images: spentUsd } },
      }),
      'utf8',
    );
    return file;
  }

  const charged = (usd: number): string =>
    JSON.stringify({
      stage: 'images-generate',
      model: 'm',
      unit: 'image',
      usd,
      timestamp: '2026-09-09T00:00:00.000Z',
      video: SHA,
    });

  it('shows what was charged when the plan claims less', () => {
    const lines = readLedger([charged(6), charged(3)].join('\n')).lines;
    const [reel] = reelCosts([planClaiming(4)], lines);
    expect(reel?.spentUsd).toBe(9);
    expect(reel?.planUsd).toBe(4);
    expect(reel?.ledgerUsd).toBe(9);
    expect(reel?.basis).toBe('ledger');
  });

  /* And the per-second figure, which is the number he quotes from, moves too. */
  it('moves the cost per second with it', () => {
    const lines = readLedger(charged(9)).lines;
    const [reel] = reelCosts([planClaiming(4)], lines);
    // 10 seconds of footage.
    expect(reel?.usdPerSecond).toBe(0.9);
  });

  it('keeps the plan’s figure when it is the larger', () => {
    const lines = readLedger(charged(2)).lines;
    const [reel] = reelCosts([planClaiming(5)], lines);
    expect(reel?.spentUsd).toBe(5);
    expect(reel?.basis).toBe('both');
  });

  /*
   * The 165 lines written before session 68 carry no video, and are never
   * attributed to one — not by the cache, not by their timestamp, not by what
   * else was running.
   */
  it('falls back to the plan when the ledger knows no video', () => {
    const lines = readLedger(
      '{"stage":"images-generate","model":"m","unit":"image","usd":50,"timestamp":"2026-01-01T00:00:00.000Z"}',
    ).lines;
    const [reel] = reelCosts([planClaiming(4)], lines);
    expect(reel?.spentUsd).toBe(4);
    expect(reel?.ledgerUsd).toBe(0);
    expect(reel?.basis).toBe('plan');
  });

  it('reads the real ledger, which knows no video yet', () => {
    const view = moneyView({ costsPath: COSTS_PATH, planPaths: planPathsForMoney() });
    for (const r of view.perReel) {
      expect(`${r.reel}: ${r.basis}`).toBe(`${r.reel}: plan`);
      expect(`${r.reel}: ${r.ledgerUsd}`).toBe(`${r.reel}: 0`);
    }
  });
});
