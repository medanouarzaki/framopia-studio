/**
 * Writes the service's build stamp beside its compiled output.
 *
 * `tsc` has no hook for this, so it runs after it. The file lives in `dist/`
 * rather than being compiled in because the stamp is not known until the build
 * runs, and generating a `.ts` file to compile would put a generated source in
 * the tree that the stamp itself would then hash.
 *
 * The service reads it **once, at startup**, and reports what it read. Reading
 * it per request would defeat the whole point: a rebuild while the service is
 * running would change the file while the process still ran the old code, and
 * the panel would be told they match.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildStamp, commitSha, sourceHash, REPO_ROOT } from './build-stamp.mjs';

const out = path.join(REPO_ROOT, 'service', 'dist', 'build-stamp.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify(
    { stamp: buildStamp(), commit: commitSha(), sourceHash: sourceHash() },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(`service: stamped ${buildStamp()}`);
