import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCorrectionPrompt,
  parseCorrectionResponseText,
  PROMPT_VERSION,
} from './correction.js';
import { TranscriptionError } from './types.js';

describe('buildCorrectionPrompt', () => {
  let dir: string;
  let guidePath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-guide-'));
    guidePath = path.join(dir, 'ORTHOGRAPHY_GUIDE.md');
    writeFileSync(guidePath, '# Guide v9.9.9 marker\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads the guide from disk rather than an inlined copy', async () => {
    const prompt = await buildCorrectionPrompt([], [], guidePath);
    expect(prompt).toContain('Guide v9.9.9 marker');
  });

  it('carries the conjunction rule that version 1 added to the frozen prompt', async () => {
    const prompt = await buildCorrectionPrompt([], [], guidePath);
    expect(prompt).toContain('The Arabic conjunction و is written w, never the French ou.');
    expect(PROMPT_VERSION).toBe(1);
  });

  it('includes the draft word sequence and any keyterms', async () => {
    const prompt = await buildCorrectionPrompt(
      [{ text: 'شعرك', start: 0, end: 1, confidence: null }],
      ['Vitasilk'],
      guidePath,
    );
    expect(prompt).toContain('شعرك');
    expect(prompt).toContain('Keyterms to recognize accurately if spoken: Vitasilk.');
  });

  it('omits the keyterms block entirely when there are none', async () => {
    const prompt = await buildCorrectionPrompt([], [], guidePath);
    expect(prompt).not.toContain('Keyterms');
  });
});

describe('parseCorrectionResponseText', () => {
  it('parses a fenced JSON response', () => {
    expect(parseCorrectionResponseText('```json\n{"words":[{"text":"bzaf"}]}\n```')).toEqual([
      'bzaf',
    ]);
  });

  it('parses a bare JSON response', () => {
    expect(parseCorrectionResponseText('{"words":[{"text":"dial"}]}')).toEqual(['dial']);
  });

  it('throws a structured, retryable error on unparseable output', () => {
    try {
      parseCorrectionResponseText('sorry, I cannot do that');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TranscriptionError);
      expect((error as TranscriptionError).stage).toBe('correction');
      expect((error as TranscriptionError).retryable).toBe(true);
    }
  });

  it('throws when the words array is missing', () => {
    expect(() => parseCorrectionResponseText('{"text":"bzaf"}')).toThrow(TranscriptionError);
  });
});
