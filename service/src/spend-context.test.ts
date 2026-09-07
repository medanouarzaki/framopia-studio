import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

/**
 * **Every point of spend says where the money went.**
 *
 * Block 12 session 68 measured what the 165 existing ledger lines can answer:
 * how much, when, which stage, which model — and nothing else. **No line says
 * which client or which video.** Session 46 rebuilt a per-reel table from
 * `.local/cache/`; session 68 measured that the same reconstruction now recovers
 * only 54.9% of the total, because the caches keep a fixed number of entries per
 * video and evict the oldest. That share falls with every run.
 *
 * `appendCost` fires at the point of spend and nowhere else, so the context has
 * to reach the point of spend. It is handed down as an ordinary option on calls
 * that already take one — no wrapper records a line on another function's
 * behalf, which would put the ledger a layer away from the money.
 */
const SPEND_SITES = [
  'service/src/analysis/keywords.ts',
  'service/src/analysis/slots.ts',
  'service/src/images/generate.ts',
  'service/src/transcription/hybrid.ts',
];

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Each `appendCost(…)` call, by bracket balance rather than by regex. */
function appendCostCalls(text: string): string[] {
  const calls: string[] = [];
  const opener = 'appendCost' + '(';
  let from = text.indexOf(opener);
  while (from !== -1) {
    let depth = 0;
    let i = from + opener.length - 1;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (c === '(' || c === '{') depth += 1;
      else if (c === ')' || c === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(text.slice(from, i + 1));
    from = text.indexOf(opener, i);
  }
  return calls;
}

describe('every point of spend', () => {
  it('records which video it was for, and what the spend was for', () => {
    const missing: string[] = [];
    for (const rel of SPEND_SITES) {
      const code = stripComments(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      const calls = appendCostCalls(code);
      expect(`${rel}: ${calls.length > 0}`).toBe(`${rel}: true`);
      for (const call of calls) {
        if (!call.includes('video')) missing.push(`${rel}: no video`);
        if (!call.includes('purpose')) missing.push(`${rel}: no purpose`);
      }
    }
    expect(missing).toEqual([]);
  });

  /*
   * **Derived, never typed.** `purpose` must come from `spendPurposeFor`, which
   * reads the corpus catalogue. A literal 'building' or 'client-work' at a spend
   * site would be a person's guess written into an append-only record.
   */
  it('derives what the spend was for rather than asserting it', () => {
    const offenders: string[] = [];
    for (const rel of SPEND_SITES) {
      const code = stripComments(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      for (const call of appendCostCalls(code)) {
        if (/purpose:\s*'(building|client-work)'/.test(call)) offenders.push(rel);
        if (call.includes('purpose') && !call.includes('spendPurposeFor')) offenders.push(rel);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  /*
   * The rule this must not become the exception to: a line is written where the
   * money is spent, so a caller that stubs a stage out cannot fabricate one.
   */
  it('is the only place in the service that writes a ledger line', () => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
        const code = stripComments(readFileSync(full, 'utf8'));
        if (appendCostCalls(code).length > 0) found.push(path.relative(REPO_ROOT, full));
      }
    };
    walk(path.join(REPO_ROOT, 'service', 'src'));
    expect(found.sort()).toEqual([...SPEND_SITES].sort());
  });
});
