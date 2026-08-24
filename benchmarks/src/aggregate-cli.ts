import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAggregateReport } from './aggregate.js';
import { BENCHMARKS_ROOT } from './paths.js';

const report = buildAggregateReport();
const outPath = path.join(BENCHMARKS_ROOT, 'RESULTS-block1.md');
writeFileSync(outPath, report, 'utf8');
console.log(report);
console.log(`\nWritten to ${outPath}`);
