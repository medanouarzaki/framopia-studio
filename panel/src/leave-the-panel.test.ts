import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * `host.ts` is the one exemption, and it is a real one: it names the After
 * Effects restart that a missing `cep_node` needs. CEP reads its extensions
 * folder at launch, so a panel loaded without the Node bridge cannot fix
 * itself by any means — there is no service to repair and no bundle to
 * rebuild. Telling him to restart is the only true sentence available.
 */
const EXEMPT = new Set(['host.ts']);

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

function panelSources(): { file: string; text: string }[] {
  return readdirSync(SRC)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('.test.'))
    .filter((f) => !EXEMPT.has(f))
    .map((f) => ({ file: f, text: stripComments(readFileSync(path.join(SRC, f), 'utf8')) }));
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

  /*
   * The panel is a view over the service, and the service's own sentences reach
   * the screen verbatim. A build requirement may still name a terminal command
   * — `tools/cv/setup.sh` installs the picture tools and no panel can do that —
   * but where the panel *can* do the work, the in-panel action comes first.
   */
  it('puts the in-panel action first in every build requirement that has one', () => {
    const requirements = readFileSync(
      path.join(SRC, '..', '..', 'service', 'src', 'build', 'requirements.ts'),
      'utf8',
    );
    for (const line of stripComments(requirements).split('\n')) {
      const isCommand = /command:/.test(line) || /^\s*'press Run pipeline/.test(line);
      if (!isCommand) continue;
      if (!/npm run/.test(line)) continue;
      expect(`${line.trim()}`).toMatch(/press Run pipeline|from a terminal|migrate:templates-sfx/);
    }
  });
});
