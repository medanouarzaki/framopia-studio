import { describe, it, expect } from 'vitest';
import { DEFAULT_TEXT_COLOUR_ROLES, resolveTextColours } from './text-colours.js';

const palette = {
  background: '#1A0000',
  primary: '#820000',
  accent: '#C9A96E',
  light: '#F8F6F2',
};

describe('which colour each kind of word is drawn in', () => {
  /**
   * User ruling, 2026-08-31, by the person who authored the templates. Before
   * it, a client naming no shadow role got the templates' own `#820000` — K2's
   * red — with nothing saying so.
   */
  it('draws the shadow in the client’s deeper colour when they name none', () => {
    const resolved = resolveTextColours({ palette });
    expect(resolved.shadow.role).toBe('primary');
    expect(resolved.shadow.hex).toBe('#820000');
    expect(resolved.shadow.source).toBe('standard');
    expect(DEFAULT_TEXT_COLOUR_ROLES.shadow).toBe('primary');
  });

  it('lets a client name a different role for it', () => {
    const resolved = resolveTextColours({ palette, textColours: { shadow: 'background' } });
    expect(resolved.shadow.role).toBe('background');
    expect(resolved.shadow.hex).toBe('#1A0000');
    expect(resolved.shadow.source).toBe('client');
  });

  /**
   * The whole point of the ruling is that K2 does not move: its `primary` is
   * `#820000`, which is exactly what the four templates already carry.
   */
  it('gives K2 the colour the templates already had', () => {
    const resolved = resolveTextColours({
      palette,
      textColours: { ordinary: 'light', emphasis: 'accent', shadow: 'primary' },
    });
    expect(resolved.shadow.hex).toBe('#820000');
    expect(resolved.ordinary.hex).toBe('#F8F6F2');
    expect(resolved.emphasis.hex).toBe('#C9A96E');
  });

  it('follows a client’s palette when their deeper colour is not red', () => {
    const theirs = { ...palette, primary: '#00A0FF' };
    expect(resolveTextColours({ palette: theirs }).shadow.hex).toBe('#00A0FF');
  });

  it('is never null, so no caller has to decide what a missing shadow means', () => {
    const resolved = resolveTextColours({ palette });
    expect(resolved.shadow).not.toBeNull();
  });
});
