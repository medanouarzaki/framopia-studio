import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import { PALETTE_ROLES } from './mode.js';
import {
  PALETTE_DISPLAY_ORDER,
  PALETTE_MEANING,
  paletteRolesInDisplayOrder,
} from './palette-meaning.js';

describe('what each colour does', () => {
  it('says something about every role, and only about roles that exist', () => {
    expect(Object.keys(PALETTE_MEANING).sort()).toEqual([...PALETTE_ROLES].sort());
    for (const role of PALETTE_ROLES) expect(PALETTE_MEANING[role]).not.toBe('');
  });

  /**
   * Measured in session 18 from four real builds: `light` is 254 ordinary
   * subtitle words and `accent` is 8 emphasised keywords. Those are the two most
   * visible uses of any colour in the product and no caption mentioned either.
   */
  it('names the subtitle colours, which the old captions left out', () => {
    expect(PALETTE_MEANING.light).toContain('subtitle words');
    expect(PALETTE_MEANING.accent).toContain('emphasise');
  });

  /**
   * `cardFrameColour` takes whichever role separates best from the picture's own
   * edge. Over every edge luminance only `light` and `background` ever win, so
   * calling `accent` "the frame around a picture" was wrong twice: the frame is
   * not fixed to a role, and that role can never be it.
   */
  it('does not call a mid-tone the picture frame', () => {
    expect(PALETTE_MEANING.accent).not.toContain('frame');
    expect(PALETTE_MEANING.primary).not.toContain('frame around');
  });

  /**
   * The 262 shadow layers all read `#820000`, but that colour is baked into the
   * four template comps and the build never sets it — it equals K2's `primary`
   * by coincidence of the brand. A different client's `primary` would not move
   * it, so the caption must not promise that it would.
   */
  it('does not claim the shadow comes from the palette', () => {
    expect(PALETTE_MEANING.primary).toContain('template');
  });

  it('a colour with more than one job says so rather than picking one', () => {
    expect(PALETTE_MEANING.light).toContain(' and ');
    expect(PALETTE_MEANING.background).toContain(' and ');
  });

  it('shows the two subtitle colours first', () => {
    expect(paletteRolesInDisplayOrder()).toEqual(['light', 'accent', 'background', 'primary']);
    expect(PALETTE_DISPLAY_ORDER.slice(0, 2)).toEqual(['light', 'accent']);
  });

  it('survives a role being added without dropping it off the screen', () => {
    // The order is a preference, not a filter: anything unlisted still shows.
    const listed = new Set(PALETTE_DISPLAY_ORDER);
    for (const role of PALETTE_ROLES) expect(listed.has(role)).toBe(true);
    expect(paletteRolesInDisplayOrder()).toHaveLength(PALETTE_ROLES.length);
  });

  /**
   * They were two copies — `service/src/catalogue.ts` for the client card and
   * `panel/src/NewClient.tsx` for the setup screen — and had already drifted
   * from what the builds do. One declaration, or they drift again.
   */
  it('is the only place these captions are written', () => {
    const strip = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const file of ['service/src/catalogue.ts', 'panel/src/NewClient.tsx']) {
      const source = strip(readFileSync(path.join(REPO_ROOT, file), 'utf8'));
      expect(source).toContain('PALETTE_MEANING');
      for (const caption of Object.values(PALETTE_MEANING)) {
        expect(source).not.toContain(caption);
      }
    }
  });
});
