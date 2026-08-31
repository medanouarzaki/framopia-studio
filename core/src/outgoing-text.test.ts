import { describe, expect, it } from 'vitest';
import { OutgoingPathError, assertSendsNoLocalPath, localPathIn } from './outgoing-text.js';

/*
 * The guard on the rule in `client-pictures.ts`: nothing on this disk is sent
 * to a model. It looks for a path rather than for a photograph, because knowing
 * which paths were photographs would mean reading the client's pictures — the
 * one thing the image graph must not do.
 */
describe('nothing that names a file on this machine is sent', () => {
  it('finds the path a client’s photograph would leave as', () => {
    const path = '/Volumes/T7 Shield/clients/jenna/clinic exterior.png';
    expect(localPathIn(`a warm portrait, like ${path}`)).toBe('/Volumes/T7');
    expect(() => assertSendsNoLocalPath('the prompt', `see ${path}`)).toThrow(OutgoingPathError);
  });

  it('names which string it was, so a failure says where to look', () => {
    try {
      assertSendsNoLocalPath('img003: the prompt', 'use /Users/x/photos/clinic.png');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('img003: the prompt');
      expect((error as Error).message).toContain('/Users/x/photos/clinic.png');
    }
  });

  it('catches a home-relative and a Windows path too', () => {
    expect(localPathIn('~/Pictures/clinic.png')).toBe('~/Pictures/clinic.png');
    expect(localPathIn('C:\\Users\\x\\clinic.png')).toBe('C:\\Users\\x\\clinic.png');
  });

  /*
   * A guard that fires on ordinary prose is a guard someone switches off. All
   * 30 prompt and negative-prompt strings stored across the five corpus plans
   * pass it, checked this session.
   */
  it('lets an ordinary prompt through', () => {
    for (const text of [
      'A single subject, centred and unobstructed, lit against #1A0000',
      'no text, no watermark, no logo',
      'three quarters of the frame, 3/4 view, and/or a soft rim light',
      'shot at f/2.8 on 2026-08-31',
      'a close crop — head and shoulders',
    ]) {
      expect(`${text}: ${String(localPathIn(text))}`).toBe(`${text}: null`);
    }
  });
});
