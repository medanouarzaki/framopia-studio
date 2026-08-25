import { describe, expect, it } from 'vitest';
import {
  headerFor,
  parseHeaderVersion,
  referenceWords,
  verifyReference,
} from './verify-references.js';

const clean = `# reference-version: v1.0.7-conformant
# a note the human left for themselves
lyoma ghadi nhdr likom 3la la mésothérapie
Mabin 7essa w7essa 15 yom
Fa hadi li fiha l'acide hyaluronique ومادة الكافيين
`;

describe('referenceWords', () => {
  it('skips every comment line, header included', () => {
    expect(referenceWords(clean)).not.toContain('reference-version:');
    expect(referenceWords(clean)[0]).toBe('lyoma');
  });
});

describe('parseHeaderVersion', () => {
  it('reads the header wherever it sits in the comment block', () => {
    expect(parseHeaderVersion(clean)).toBe('v1.0.7-conformant');
    expect(parseHeaderVersion('# a note\n# reference-version: v1.0.6-conformant\nyom\n')).toBe(
      'v1.0.6-conformant',
    );
  });

  it('is null when there is none', () => {
    expect(parseHeaderVersion('# just a note\nyom\n')).toBeNull();
  });
});

describe('verifyReference', () => {
  it('passes a clean reference whose header matches the guide', () => {
    expect(verifyReference('r', clean, '1.0.7').issues).toEqual([]);
  });

  /**
   * The defect that went undetected for a whole block: the header asserted a
   * version the text violated. Both halves have to fail on their own.
   */
  it('fails when the text violates the version the header claims', () => {
    const bad = clean.replace('w7essa', 'w 7essa');
    const verdict = verifyReference('r', bad, '1.0.7');
    expect(verdict.violations).toHaveLength(1);
    expect(verdict.issues.join(' ')).toMatch(/conjunction attaches/);
  });

  it('fails on a standalone arabic conjunction too', () => {
    const bad = clean.replace('ومادة', 'و مادة');
    expect(verifyReference('r', bad, '1.0.7').violations).toHaveLength(1);
  });

  it('fails on a standalone definite article', () => {
    const bad = clean.replace("l'acide", 'l acide');
    expect(verifyReference('r', bad, '1.0.7').violations).toHaveLength(1);
  });

  it('fails when the header lags the guide', () => {
    const verdict = verifyReference('r', clean, '1.0.8');
    expect(verdict.violations).toEqual([]);
    expect(verdict.issues.join(' ')).toMatch(/header says v1\.0\.7-conformant/);
  });

  it('fails when there is no header at all', () => {
    const verdict = verifyReference('r', clean.split('\n').slice(1).join('\n'), '1.0.7');
    expect(verdict.issues.join(' ')).toMatch(/no "# reference-version:" header/);
  });

  // The freeze-list near-miss check reports 11 known false positives across
  // the real references, so gating on it would gate on noise.
  it('does not fail on a freeze-list near miss', () => {
    const verdict = verifyReference('r', `${clean}Wl'effet dialo l7essass hadi homa\n`, '1.0.7');
    expect(verdict.issues).toEqual([]);
  });
});

describe('headerFor', () => {
  it('renders the stamp the writer applies', () => {
    expect(headerFor('1.0.7')).toBe('# reference-version: v1.0.7-conformant');
  });
});
