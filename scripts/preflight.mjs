/*
 * What has to be true before anything else in this project can run at all.
 *
 * **The doctor cannot report its own missing dependencies.** `npm run doctor`
 * is `npm run build:core && tsx tools/doctor/cli.ts`, and both halves live in
 * `node_modules` — so on the one machine that has the problem, the check that
 * describes it never executes. Block 11 session 55 measured what a partner sees
 * instead:
 *
 *   npm error command failed
 *   npm error command sh -c tsc
 *
 * which says nothing about what is wrong or what to do. This runs first, on
 * plain node, and says it in words.
 *
 * **It imports nothing and compiles nothing.** No TypeScript, no package, only
 * node's own built-in modules — because everything else is exactly what it is
 * checking for. It must keep working when the project is a bare clone.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const problems = [];

/*
 * The version node is pinned to. Reported rather than refused: a mismatch is
 * worth saying out loud, and the doctor's own `node` check is the place that
 * decides whether it blocks.
 */
const nvmrc = path.join(repo, '.nvmrc');
if (existsSync(nvmrc)) {
  const wanted = readFileSync(nvmrc, 'utf8').trim();
  if (wanted !== '' && !process.version.startsWith(`v${wanted}`)) {
    problems.push({
      what: `Node is ${process.version}, and this project is pinned to ${wanted}.`,
      fix: `nvm install    (from inside this folder — it reads .nvmrc)`,
    });
  }
}

if (!existsSync(path.join(repo, 'node_modules'))) {
  problems.push({
    what: 'The project’s packages have not been installed yet.',
    fix: 'npm install',
  });
}

if (problems.length === 0) process.exit(0);

const say = (line) => process.stdout.write(`${line}\n`);
say('');
say('This project is not set up yet, so nothing else will run.');
say('');
for (const problem of problems) {
  say(`  ${problem.what}`);
  say(`  Run this, from this folder:`);
  say('');
  say(`      ${problem.fix}`);
  say('');
}
say('Then try again. docs/SECOND_MACHINE.md has the whole setup in order.');
say('');
process.exit(1);
