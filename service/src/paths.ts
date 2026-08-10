import { fileURLToPath } from 'node:url';
import path from 'node:path';

// service/src/paths.ts -> service/src -> service -> repo root
export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const LOCAL_DIR = path.join(REPO_ROOT, '.local');
