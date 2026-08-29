import { describe, expect, it } from 'vitest';
import { snapshotOfMode, loadMode, type ClientSnapshot } from '@framopia/core';
import { requiredFonts } from './required-fonts.js';

function snapshot(fonts: ClientSnapshot['fonts']): ClientSnapshot {
  return { ...snapshotOfMode(loadMode('k2-syndicalia'), 'now'), fonts };
}

/**
 * After Effects accepts a font name it cannot resolve, reads it back unchanged
 * and renders a substitute — measured on 26.0x67. So the build checks the
 * faces it will write before it places a card, and this is the list it checks.
 */
describe('requiredFonts', () => {
  it('is empty with no client, so a build with none is unaffected', () => {
    expect(requiredFonts(null)).toEqual([]);
  });

  it('is empty for a client whose faces have never been measured on a host', () => {
    expect(
      requiredFonts(snapshot({ status: 'set', latin: 'Inter Semi-Bold', arabic: 'Almarai Bold' })),
    ).toEqual([]);
  });

  it('is empty for a client with no fonts of its own', () => {
    expect(requiredFonts(snapshot({ status: 'tbd', note: 'later' }))).toEqual([]);
  });

  /*
   * The family-and-style strings are never returned: a name with a space
   * cannot be written to a text layer at all, so checking for one would check
   * something that provably does not work.
   */
  it('returns the PostScript names, and never a name with a space', () => {
    const wanted = requiredFonts(snapshot(loadMode('k2-syndicalia').fonts));

    expect(wanted).toEqual([
      'Almarai-Bold',
      'CormorantGaramondItalic-SemiBoldItalic',
      'Inter-SemiBold',
    ]);
    for (const name of wanted) expect(name).not.toMatch(/\s/);
  });

  it('does not ask twice for a client whose emphasis face is its Latin one', () => {
    expect(
      requiredFonts(
        snapshot({
          status: 'set',
          latin: 'A',
          arabic: 'B',
          postScriptNames: { latin: 'A-Reg', arabic: 'B-Bold', emphasis: 'A-Reg' },
        }),
      ),
    ).toEqual(['A-Reg', 'B-Bold']);
  });
});
