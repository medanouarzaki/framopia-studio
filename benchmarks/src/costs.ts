import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from './paths.js';

// Duplicated from service/src/costs.ts rather than imported: the two
// packages have independent tsconfig rootDirs (no npm workspace yet), so a
// cross-package relative import would reach outside benchmarks/src. Both
// write the same .local/costs.jsonl shape and can be reconciled once a
// workspace is introduced.
export interface CostEntry {
  stage: string;
  model: string;
  unit: string;
  usd: number;
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
