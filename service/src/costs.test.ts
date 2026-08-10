import { mkdtempSync, rmSync } from 'node:fs';
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
});
