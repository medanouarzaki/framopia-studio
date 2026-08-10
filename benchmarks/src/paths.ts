import { fileURLToPath } from 'node:url';
import path from 'node:path';

// benchmarks/src/paths.ts -> benchmarks/src -> benchmarks -> repo root
export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const LOCAL_DIR = path.join(REPO_ROOT, '.local');
export const BENCHMARKS_ROOT = path.join(REPO_ROOT, 'benchmarks');
export const RESULTS_DIR = path.join(BENCHMARKS_ROOT, 'results');
export const FIXTURES_DIR = path.join(BENCHMARKS_ROOT, 'fixtures');
