import { fileURLToPath } from 'node:url';
import path from 'node:path';

// core/src/paths.ts -> core/src -> core -> repo root. The built copy sits at
// core/dist/paths.js, which is the same depth, so both resolve identically.
export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const LOCAL_DIR = path.join(REPO_ROOT, '.local');
export const DOCS_DIR = path.join(REPO_ROOT, 'docs');
