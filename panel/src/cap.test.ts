import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **A cap warns and never refuses.** Mohamed's ruling, the same standing as the
 * soft-picture warning: the tool says what it thinks and the person decides.
 *
 * The assertion is on the source rather than on a rendered screen because what
 * must never happen is a *disabled attribute wired to the cap*. A rendering test
 * can only show that today's numbers leave the button alive; this shows that no
 * arrangement of numbers could kill it.
 */
const SRC = path.dirname(fileURLToPath(import.meta.url));
const CAP = readFileSync(path.join(SRC, 'CapWarning.tsx'), 'utf8');
const CODE = CAP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const APP = readFileSync(path.join(SRC, 'App.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('the monthly cap', () => {
  it('disables nothing and refuses nothing', () => {
    for (const forbidden of ['disabled', 'preventDefault', 'return null;\n  }\n\n  return null']) {
      expect(`${forbidden}: ${CODE.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  /*
   * The button's own `disabled` must not mention the cap. It has reasons of its
   * own — nothing chosen, already running, subtitles not made — and none of them
   * is money.
   */
  it('is not among the reasons a run button is disabled', () => {
    for (const line of APP.split('\n')) {
      if (!line.includes('disabled=')) continue;
      for (const money of ['cap', 'monthSoFar', 'capUsd', 'money']) {
        expect(`${money} in "${line.trim()}": ${line.includes(money)}`).toBe(
          `${money} in "${line.trim()}": false`,
        );
      }
    }
  });

  it('says what the spend takes the month to, and that the button still works', () => {
    expect(CAP).toContain('takes the month to');
    expect(CAP).toContain('The button still works');
  });

  /*
   * No second threshold was built. Session 69 measured what the history could
   * support: six reels carry a spend and only two have ever had a complete run,
   * both the same client's footage. A rule about a video costing "far more than
   * anything before" cannot be derived from two points.
   */
  it('has no second rule invented from too little history', () => {
    for (const invented of ['far more', 'unusually', 'typical', 'average', 'median']) {
      expect(`${invented}: ${CODE.includes(invented)}`).toBe(`${invented}: false`);
    }
  });
});
