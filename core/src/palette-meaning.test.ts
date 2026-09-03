import { describe, expect, it } from 'vitest';
import { normaliseHexColour, PALETTE_ROLES, paletteRolesInDisplayOrder } from './palette-meaning.js';

/**
 * **What a person actually pastes into a colour field.**
 *
 * Block 10 session 47: the four colour fields could only be set by dragging
 * inside the operating system's colour picker — the hex beside each was a
 * `<code>` element, not an input, and could not even take focus. A brand
 * colour is a code that arrives in a document, so the control had never been
 * usable for the one way it would ever be used.
 */
describe('normaliseHexColour', () => {
  it('takes the form the mode files already hold', () => {
    expect(normaliseHexColour('#E8873A')).toBe('#E8873A');
  });

  it('takes it without the hash, which is how a hex is usually written down', () => {
    expect(normaliseHexColour('E8873A')).toBe('#E8873A');
  });

  it('takes lower case and returns the upper case the validator demands', () => {
    // `mode.ts` validates a stored palette against /^#[0-9A-F]{6}$/.
    expect(normaliseHexColour('#e8873a')).toBe('#E8873A');
    expect(normaliseHexColour('fff4e8')).toBe('#FFF4E8');
  });

  it('takes the three-digit short form, as a brand sheet writes it', () => {
    expect(normaliseHexColour('#E83')).toBe('#EE8833');
    expect(normaliseHexColour('abc')).toBe('#AABBCC');
    expect(normaliseHexColour('#fff')).toBe('#FFFFFF');
  });

  it('takes whitespace around any of it, which is what a paste carries', () => {
    expect(normaliseHexColour('  #FFF4E8  ')).toBe('#FFF4E8');
    expect(normaliseHexColour('\t123448\n')).toBe('#123448');
  });

  /**
   * Refused rather than repaired. A field that turns `#12345` into black is
   * worse than one that says no: the wrong colour is silent, a refusal is not.
   */
  it('refuses anything that is not a colour, and never guesses', () => {
    for (const bad of [
      '',
      '#',
      '   ',
      '#12345',
      '#E8873A7',
      'zzzzzz',
      '#GGGGGG',
      'rgb(232, 135, 58)',
      'orange',
      '# E8873A',
      '#E8 873A',
      '0xE8873A',
    ]) {
      expect(normaliseHexColour(bad), `${JSON.stringify(bad)} should be refused`).toBeNull();
    }
  });

  it('is idempotent, so a value read back and re-entered does not drift', () => {
    for (const v of ['#E8873A', '#FFF4E8', '#123448', '#1C1210']) {
      expect(normaliseHexColour(normaliseHexColour(v) as string)).toBe(v);
    }
  });

  /** The four the user is entering for his second client, exactly as given. */
  it('takes the four codes of a real brand', () => {
    expect(normaliseHexColour('#FFF4E8')).toBe('#FFF4E8');
    expect(normaliseHexColour('#E8873A')).toBe('#E8873A');
    expect(normaliseHexColour('#123448')).toBe('#123448');
    expect(normaliseHexColour('#1C1210')).toBe('#1C1210');
  });

  it('covers every role the palette defines', () => {
    expect(paletteRolesInDisplayOrder().slice().sort()).toEqual([...PALETTE_ROLES].sort());
  });
});
