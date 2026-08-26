import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { assertPathsPresent, findMissingPaths, MissingBuildInputsError } from './preflight.js';

const real = path.join(REPO_ROOT, 'templates', 'library.aep');
const gone = '/Volumes/T7 Shield/nope/images-8f66615d9f03fbe9/image.jpg';

describe('the pre-build path check', () => {
  it('passes when every path is on disk', () => {
    expect(() =>
      assertPathsPresent([{ elementId: 'templates', kind: 'aep', path: real }]),
    ).not.toThrow();
  });

  /*
   * The wording is asserted, not just the throw: the failure this guards
   * against is a build that produced a comp with holes in it, and a message
   * that stops naming the element and the path stops being actionable.
   */
  it('names the count, the element and the path', () => {
    const refs = [
      { elementId: 'templates', kind: 'aep', path: real },
      { elementId: 'img001', kind: 'image', path: gone },
    ];
    expect(() => assertPathsPresent(refs)).toThrow(MissingBuildInputsError);
    try {
      assertPathsPresent(refs);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe(
        '1 file(s) the plan references are not on disk; refusing to build a comp with gaps:\n' +
          `  image img001: ${gone}`,
      );
    }
  });

  it('reports every missing path together, not just the first', () => {
    const refs = [
      { elementId: 'img001', kind: 'image', path: gone },
      { elementId: 'img002', kind: 'image', path: `${gone}.2` },
      { elementId: 'sfx001', kind: 'audio', path: '/nope/hit_01.mp3' },
    ];
    expect(findMissingPaths(refs)).toHaveLength(3);
    expect(() => assertPathsPresent(refs)).toThrow(/^3 file\(s\)/);
  });

  it('is empty-safe', () => {
    expect(findMissingPaths([])).toEqual([]);
    expect(() => assertPathsPresent([])).not.toThrow();
  });
});
