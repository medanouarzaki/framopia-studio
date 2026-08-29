import { describe, expect, it } from 'vitest';
import { resolveTextColours } from './text-colours.js';

const palette = {
  background: '#1A0000',
  primary: '#820000',
  accent: '#C9A96E',
  light: '#F8F6F2',
};

describe('resolveTextColours', () => {
  it('draws ordinary words in the light and emphasis in the accent by default', () => {
    const colours = resolveTextColours({ palette });

    expect(colours.ordinary).toEqual({ role: 'light', hex: '#F8F6F2', source: 'standard' });
    expect(colours.emphasis).toEqual({ role: 'accent', hex: '#C9A96E', source: 'standard' });
  });

  it('takes a role the client names, and says it came from them', () => {
    const colours = resolveTextColours({ palette, textColours: { emphasis: 'primary' } });

    expect(colours.emphasis).toEqual({ role: 'primary', hex: '#820000', source: 'client' });
    expect(colours.ordinary.source).toBe('standard');
  });
});
