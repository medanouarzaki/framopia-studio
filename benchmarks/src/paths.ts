import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

export const BENCHMARKS_ROOT = path.join(REPO_ROOT, 'benchmarks');
export const RESULTS_DIR = path.join(BENCHMARKS_ROOT, 'results');
export const FIXTURES_DIR = path.join(BENCHMARKS_ROOT, 'fixtures');
