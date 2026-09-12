import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PANEL_IS_BEHIND, REBUILD_COMMAND } from '@framopia/core/build-stamp';

/**
 * No message in the panel tells the user to leave the panel.
 *
 * Session 26 made the panel start, prepare and restart the companion service by
 * itself, and pinned the result with two assertions: no screen contains
 * `npm run`, and none contains the word *terminal*. **Both passed while
 * `Build.tsx` was telling a user to quit After Effects**, because neither word
 * appears in *"The companion service did not say what this build would
 * contain. Quit After Effects and open it again."* The rule was written as two
 * examples of itself rather than as the rule.
 *
 * So this reads the source instead — the way `path-fields.test.ts` pins that no
 * path is typed — and fails on any instruction to quit, restart, reopen or
 * relaunch anything. A new screen carrying one fails here rather than reaching
 * him.
 */
const SRC = path.dirname(fileURLToPath(import.meta.url));

/**
 * `host.ts` is exempt as a file, and it is a real exemption: it names the After
 * Effects restart that a missing `cep_node` needs. CEP reads its extensions
 * folder at launch, so a panel loaded without the Node bridge cannot fix itself
 * by any means — there is no service to repair and no bundle to rebuild.
 * Telling him to restart is the only true sentence available.
 */
const EXEMPT = new Set(['host.ts']);

/**
 * **The second exemption, and it is one sentence rather than one file.**
 *
 * **Mohamed ruled on 2026-09-07** that when the panel is running older code than
 * the rest of the tool it may name the one command that fixes it, and **nowhere
 * else**. Block 11 session 66 put the question to him: the panel cannot repair
 * this case itself, because **the stale artefact is the running code** — the
 * bundle has to be built on disk and loaded, and the thing that would do the
 * loading is the bundle. So every true sentence here names a command or asks
 * for the panel to be reopened, and session 66 shipped a message that said
 * something was wrong without saying what to do. That is the failure this rule
 * exists to prevent, arrived at from the other direction.
 *
 * **It is withdrawn the moment the self-reload route is proved to work.** That
 * route is written up beside the message in `core/src/build-stamp.ts`: the
 * service rebuilds the bundle and the panel reloads itself, so nobody is sent
 * anywhere. Nobody has measured whether a CEP panel survives reloading itself,
 * and it cannot be measured without driving After Effects. When it is, this
 * exemption goes and the sentence goes back to naming nothing.
 *
 * **An allow-list of one string, not a hole.** The sentence is imported, never
 * retyped, and only its exact text is permitted to carry a command. Every other
 * message in every scanned file is still refused, including a second copy of
 * this one that drifts by a word.
 */
const ALLOWED_TO_NAME_A_COMMAND = [PANEL_IS_BEHIND];

/**
 * **Not a message, so not this rule's business.** `REBUILD_COMMAND` is the
 * command the panel *runs* on the user's behalf — it is passed to the service,
 * never rendered — and its whole point is that nobody is told to type it. It
 * only appears here because session 67 widened the scan to the file that
 * defines it. Removing it before matching keeps the rule about sentences on
 * screen, which is what it was written about.
 */
const NOT_SHOWN_TO_ANYONE = [REBUILD_COMMAND];

/**
 * **Scanned as well as `panel/src`, because that is where the sentence lives.**
 *
 * `PANEL_IS_BEHIND` is defined in `core/src/build-stamp.ts` — the panel and the
 * service both read the comparison, so the wording sits with it. Session 67
 * found that this file's scan never reached there: the message was outside the
 * rule, and the rule would not have refused a command in it. Nothing was wrong
 * with the sentence, but it was not being protected either, and an exemption
 * for a case the rule cannot see is not an exemption.
 */
const ALSO_SCANNED = [path.join(SRC, '..', '..', 'core', 'src', 'build-stamp.ts')];

/**
 * **The service is scanned too, because the panel is a view over it.**
 *
 * Block 12 session 91 found a sixth message telling Mohamed to open a terminal —
 * *"press Run pipeline for this video; from a terminal, npm run frames -- --reel
 * <label> then npm run segment -- --reel <label>"* — and it had been in the
 * product, on a real refusal, on a reel he had paid $2.4565 for. This rule did
 * not catch it for two separate reasons, and both are fixed here.
 *
 * The first is that the scan reached `panel/src` and one file of `core`, and the
 * sentence was in `service/src/build/requirements.ts`. Every sentence a build
 * requirement carries is rendered verbatim by the panel; so is every message a
 * stage throws. Being written in the service does not make it less of a thing on
 * his screen, so the whole service is read now, not the one file this message
 * happened to sit in.
 *
 * The second is below, at `naming their own usage`.
 *
 * **`*-cli.ts` is excluded and nothing else is.** A CLI is a terminal program and
 * its `usage:` line is allowed to say what to type — it is not a panel message
 * and never reaches one.
 */
function serviceSources(): string[] {
  const root = path.join(SRC, '..', '..', 'service', 'src');
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.includes('.test.') &&
        !entry.name.endsWith('-cli.ts')
      ) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

/**
 * **Only string literals, because only a string can be shown to anyone.**
 *
 * Reading raw source made `const terminal =` in `pipeline.ts` an offender — a
 * local variable in the retry classifier, which nobody will ever see. A rule
 * that cries wolf on an identifier gets exemptions bolted onto it until it means
 * nothing, so it reads the strings and leaves the code alone.
 */
function stringLiterals(text: string): string {
  const found = text.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g);
  return (found ?? []).join('\n');
}

/**
 * **Two things no panel can do, named as what they are.**
 *
 * `tools/cv/setup.sh` installs Python, its packages and a segmentation model;
 * `npm run service:build` compiles the service's own code, which is missing when
 * that sentence fires. Neither is work a button could be wired to today, so
 * naming them is the only true sentence available — the same shape as `host.ts`,
 * where a panel loaded without the Node bridge cannot repair itself by any
 * means.
 *
 * **Both are worth removing rather than living with.** The service can run
 * `setup.sh`, and a running service can rebuild itself; session 91's report puts
 * both to Mohamed rather than treating an exemption as the end of the question.
 */
const CANNOT_BE_DONE_IN_A_PANEL = [
  'tools/cv/setup.sh',
  'Run npm run service:build, then reopen the panel.',
];

const FORBIDDEN = [
  /quit\s+after\s+effects/i,
  /restart\s+(?:after\s+effects|the\s+service|the\s+panel|the\s+application)/i,
  /relaunch/i,
  /reopen\s+(?:the\s+panel|it)/i,
  /(?:close|open)\s+(?:the\s+panel|it)\s+and\s+open\s+it\s+again/i,
  /\bnpm run\b/i,
  /\bterminal\b/i,
];

/** Comments explain the rule; only what renders is the rule. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Adjacent string literals joined, so a sentence written across several lines
 * reads as the one sentence it becomes. Without this the allow-list compares a
 * joined constant against source that still has `' +\n  '` seams in it, matches
 * nothing, and silently stops exempting anything — which is the failure mode
 * where a rule looks enforced and is not.
 */
function joinLiterals(text: string): string {
  return text.replace(/'\s*\+\s*'/g, '').replace(/"\s*\+\s*"/g, '');
}

/** The allowed sentence removed, so what is left is everything else. */
function withoutAllowed(text: string): string {
  let out = text;
  for (const allowed of [
    ...ALLOWED_TO_NAME_A_COMMAND,
    ...NOT_SHOWN_TO_ANYONE,
    ...CANNOT_BE_DONE_IN_A_PANEL,
  ]) {
    out = out.split(allowed).join('');
  }
  return out;
}

function panelSources(): { file: string; text: string }[] {
  const own = readdirSync(SRC)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('.test.'))
    .filter((f) => !EXEMPT.has(f))
    .map((f) => ({ file: f, full: path.join(SRC, f) }));
  const extra = [...ALSO_SCANNED, ...serviceSources()].map((full) => ({
    file: path.relative(path.join(SRC, '..', '..'), full),
    full,
  }));
  return [...own, ...extra].map(({ file, full }) => ({
    file,
    text: withoutAllowed(stringLiterals(joinLiterals(stripComments(readFileSync(full, 'utf8'))))),
  }));
}

describe('no message sends the user out of the panel', () => {
  it('names no application to quit, restart or reopen, and no command to type', () => {
    const offenders: string[] = [];
    for (const { file, text } of panelSources()) {
      for (const pattern of FORBIDDEN) {
        const found = pattern.exec(text);
        if (found !== null) offenders.push(`${file}: "${found[0]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * **This test used to protect the sentence it should have refused.**
   *
   * It read `requirements.ts` — the only part of the service anything here
   * looked at — and asserted that a `command:` naming `npm run` must *also* say
   * `press Run pipeline` or `from a terminal`. It was written to put the
   * in-panel action first, and what it actually did was make "from a terminal"
   * a way to pass. So the one file that was read was the one file where the
   * forbidden words were blessed, and Block 12 session 91's message sat inside
   * it, conforming.
   *
   * There is nothing left to assert separately: `requirements.ts` is scanned
   * with the rest of the service by the rule above, and a command in it fails
   * like a command anywhere else.
   */
  it('tells every build requirement what to press, not what to type', () => {
    const requirements = readFileSync(
      path.join(SRC, '..', '..', 'service', 'src', 'build', 'requirements.ts'),
      'utf8',
    );
    expect(
      withoutAllowed(stringLiterals(joinLiterals(stripComments(requirements)))),
    ).not.toMatch(/npm run|terminal/i);
  });
});
