import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from './paths.js';

export interface CostEntry {
  stage: string;
  model: string;
  unit: string;
  usd: number;
  // Set only on corrections to an earlier, wrong entry: the ledger is
  // append-only, so a correction is a delta line that names what it fixes.
  note?: string;
}

interface CostRecord extends CostEntry {
  timestamp: string;
}

export const COSTS_PATH = path.join(LOCAL_DIR, 'costs.jsonl');

export function appendCost(entry: CostEntry, costsPath = COSTS_PATH): void {
  const record: CostRecord = { ...entry, timestamp: new Date().toISOString() };
  mkdirSync(path.dirname(costsPath), { recursive: true });
  appendFileSync(costsPath, `${JSON.stringify(record)}\n`, 'utf8');
}

export function readCosts(costsPath = COSTS_PATH): Record<string, number> {
  if (!existsSync(costsPath)) {
    return {};
  }

  const totals: Record<string, number> = {};
  const lines = readFileSync(costsPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const record = JSON.parse(line) as CostRecord;
    totals[record.stage] = (totals[record.stage] ?? 0) + record.usd;
  }
  return totals;
}
