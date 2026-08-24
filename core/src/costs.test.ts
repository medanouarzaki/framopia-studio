import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendCost, readCosts } from './costs.js';

describe('cost ledger', () => {
  let dir: string;
  let costsPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-costs-'));
    costsPath = path.join(dir, 'costs.jsonl');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty totals when no ledger exists', () => {
    expect(readCosts(costsPath)).toEqual({});
  });

  it('appends entries and totals them by stage', () => {
    appendCost({ stage: 'transcribe', model: 'elevenlabs', unit: 'minute', usd: 0.1 }, costsPath);
    appendCost({ stage: 'transcribe', model: 'elevenlabs', unit: 'minute', usd: 0.2 }, costsPath);
    appendCost({ stage: 'images', model: 'nano-banana', unit: 'image', usd: 0.5 }, costsPath);

    const totals = readCosts(costsPath);
    expect(totals.transcribe).toBeCloseTo(0.3);
    expect(totals.images).toBeCloseTo(0.5);
  });

  // The ledger is append-only and read back by hand and by scripts, so its
  // serialized shape is a contract. This pins the exact line written for a
  // known entry against a sample taken from .local/costs.jsonl before the
  // move into @framopia/core; key order and number formatting included.
  it('writes a byte-identical ledger line for a known entry', () => {
    appendCost(
      {
        stage: 'benchmark-scribe',
        model: 'scribe',
        unit: 'run',
        usd: 0.0014212344055555555,
      },
      costsPath,
    );
    const line = readFileSync(costsPath, 'utf8').split('\n')[0] ?? '';
    const stamped = line.replace(
      /"timestamp":"[^"]+"/,
      '"timestamp":"2026-08-24T18:30:24.255Z"',
    );
    expect(stamped).toBe(
      '{"stage":"benchmark-scribe","model":"scribe","unit":"run","usd":0.0014212344055555555,"timestamp":"2026-08-24T18:30:24.255Z"}',
    );
  });

  it('carries the correction note field through verbatim', () => {
    appendCost(
      {
        stage: 'benchmark-gemini-correction',
        model: 'gemini',
        unit: 'run',
        usd: 0.12354,
        note: 'delta-only correction',
      },
      costsPath,
    );
    const line = readFileSync(costsPath, 'utf8').split('\n')[0] ?? '';
    expect(line).toContain('"usd":0.12354,"note":"delta-only correction"');
  });
});
