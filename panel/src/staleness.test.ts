import { describe, expect, it } from 'vitest';
import { stalenessOf } from './staleness.js';

/*
 * A rebuilt panel talking to a service started before the rebuild is the normal
 * way things break here, and until session 44 nothing could see it: both
 * versions on the health payload come **from the service**, so they agree with
 * each other by construction and say nothing about the bundle.
 */
describe('a service running older code than the panel', () => {
  const started = '2026-08-29T17:24:45.000Z';

  it('is noticed when the bundle was built after the service started', () => {
    const stale = stalenessOf('2026-08-29T17:31:00.000Z', started);
    expect(stale.stale).toBe(true);
    expect(stale.detail).toContain('running older code');
    expect(stale.detail).toContain('open it again');
  });

  it('is not claimed when the service started after the build', () => {
    expect(stalenessOf('2026-08-29T17:00:00.000Z', started).stale).toBe(false);
  });

  /* Building the service and starting it are two commands, in that order. */
  it('allows a minute of slack, so a normal restart is not called stale', () => {
    expect(stalenessOf('2026-08-29T17:25:30.000Z', started).stale).toBe(false);
    expect(stalenessOf('2026-08-29T17:26:30.000Z', started).stale).toBe(true);
  });

  /* It says nothing rather than guessing — the rule about a field that may not arrive. */
  it('says nothing when either time is missing or unreadable', () => {
    expect(stalenessOf(null, started)).toEqual({ stale: false, detail: null });
    expect(stalenessOf('2026-08-29T17:31:00.000Z', undefined)).toEqual({
      stale: false,
      detail: null,
    });
    expect(stalenessOf('not a date', started).stale).toBe(false);
  });
});
