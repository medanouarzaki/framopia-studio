import { describe, expect, it } from 'vitest';
import { planWords } from './score-editplan.js';

describe('planWords', () => {
  it('reads the word texts in order', () => {
    expect(
      planWords({ transcript: { words: [{ text: 'bghiti' }, { text: 'chd' }] } }),
    ).toEqual(['bghiti', 'chd']);
  });

  it('skips words the cleaning stage marked removed', () => {
    expect(
      planWords({
        transcript: {
          words: [{ text: 'euh', removed: true }, { text: 'bghiti', removed: false }],
        },
      }),
    ).toEqual(['bghiti']);
  });
});
