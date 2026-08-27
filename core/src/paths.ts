import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveRepoRoot } from './repo-root.js';

/**
 * The repository root, through the one resolver in `repo-root.ts`.
 *
 * It used to be a bare `path.resolve(dirname, '..', '..')`, which is correct
 * from `core/dist/paths.js` and was never wrong — but it was a second
 * implementation of the same rule, and the panel's copy resolved to `/` and
 * told the user about a file at `/service/dist/service.js`. Both go through the
 * same verified resolver now, so neither can be right while the other is
 * silently wrong.
 *
 * This throws if the repository is not where this module sits. That is loud on
 * purpose: everything downstream reads paths off it, and a wrong root is worse
 * than no root.
 */
export const REPO_ROOT = resolveRepoRoot({
  fs: { existsSync, readFileSync: (p, enc) => readFileSync(p, enc as BufferEncoding) as string, realpathSync },
  candidates: [
    {
      source: 'core module location',
      path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
    },
  ],
}).root;

export const LOCAL_DIR = path.join(REPO_ROOT, '.local');
export const DOCS_DIR = path.join(REPO_ROOT, 'docs');

export const ROOT_PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
