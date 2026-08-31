import { describe, expect, it } from 'vitest';
import { stalenessOf } from './staleness.js';

/**
 * The panel's side of the build-stamp rule. The rule itself is pinned in
 * `@framopia/core`; this asserts the panel reads it and that the shape the
 * screen consumes is the shape it gets.
 *
 * The clock comparison this replaced is gone, not flagged off: it stamped the
 * bundle's build time and compared it against the service's start time, which
 * accused a service running exactly the right code and could not be cleared by
 * restarting anything.
 */
describe('stalenessOf', () => {
  const stamp = 'abc1234567+0011223344556677';

  it('says nothing when the service is the same build', () => {
    expect(stalenessOf(stamp, stamp)).toEqual({ verdict: 'match', detail: null });
  });

  it('says so, and that it is being put right, when the build differs', () => {
    const stale = stalenessOf(stamp, 'abc1234567+ffff');

    expect(stale.verdict).toBe('different');
    expect(stale.detail).toContain('Restarting it now');
  });

  it('gives no command to type — the panel repairs this itself', () => {
    const stale = stalenessOf(stamp, 'abc1234567+ffff');
    expect(stale.detail).not.toContain('npm run');
    expect(stale.detail).not.toContain('terminal');
  });

  it('is quiet, and not an accusation, when either side cannot say', () => {
    expect(stalenessOf(stamp, undefined)).toEqual({ verdict: 'unknown', detail: null });
    expect(stalenessOf(null, stamp)).toEqual({ verdict: 'unknown', detail: null });
  });
});
