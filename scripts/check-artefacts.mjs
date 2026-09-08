/*
 * **Every compiled artefact the gate goes on to execute, present before it runs.**
 *
 * Block 12 session 72 made the gate build `service/dist`, which closed the case
 * where the artefact was *stale*. It did not close the case where it is
 * **absent**: `spawn.integration.test.ts` and `job.integration.test.ts` are
 * `skipIf(!existsSync(...))`, so a missing artefact makes them skip and the gate
 * goes green having tested nothing. That is the shape that hid a broken
 * compiled service for seventy sessions — green when absent, green when
 * current, red only in the narrow window between.
 *
 * **Placed after the builds and before the tests, so it catches both causes.**
 * A build nobody ran leaves the artefact missing; a build that ran and wrote
 * nothing, or wrote somewhere else, leaves it missing too. Checking the artefact
 * rather than the build's exit status cannot tell those apart and does not need
 * to: either way the gate is about to execute something that is not there.
 *
 * **This does not remove a single skip condition.** A test that genuinely cannot
 * run without something still says so. What changes is that the gate no longer
 * reaches those tests with the thing missing.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Each one, and the test that would silently skip without it. */
const REQUIRED = [
  {
    file: 'core/dist/index.js',
    why: 'every workspace imports @framopia/core from here',
    built: 'npm run build:core',
  },
  {
    file: 'service/dist/service.js',
    why: 'spawn.integration.test.ts spawns it with a bare node binary, and skips without it',
    built: 'npm run build --prefix service',
  },
  {
    file: 'service/dist/build/build-reel-cli.js',
    why: 'job.integration.test.ts spawns it, and skips without it',
    built: 'npm run build --prefix service',
  },
  {
    file: 'panel/dist/panel.js',
    why: 'every browser test loads the bundle, and skips without it',
    built: 'npm run panel:build',
  },
  {
    file: 'panel/dist/index.html',
    why: 'the browser tests open this page',
    built: 'npm run panel:build',
  },
];

const missing = REQUIRED.filter((a) => !existsSync(path.join(root, a.file)));

if (missing.length > 0) {
  console.error(
    'check: FAIL — the gate is about to run tests against artefacts that are not there.\n' +
      'Each of these is executed by a test that SKIPS when it is missing, so leaving\n' +
      'them absent would give a green run that tested nothing.\n',
  );
  for (const a of missing) {
    console.error(`  ${a.file}`);
    console.error(`      ${a.why}`);
    console.error(`      built by: ${a.built}`);
  }
  console.error('\nThe build steps above run earlier in this script. One of them produced nothing.');
  process.exit(1);
}

console.log(`check: ${REQUIRED.length} compiled artefacts present before the tests run`);
