import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCorrectionPrompt,
  parseCorrectionResponseText,
  ACTIVE_PROMPT_VERSION,
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
    const prompt = await buildCorrectionPrompt([], { guidePath });
    expect(prompt).toContain('Guide v9.9.9 marker');
  });

  it('includes the draft word sequence and any keyterms', async () => {
    const prompt = await buildCorrectionPrompt(
      [{ text: 'شعرك', start: 0, end: 1, confidence: null }],
      { keyterms: ['Vitasilk'], guidePath },
    );
    expect(prompt).toContain('شعرك');
    expect(prompt).toContain('Keyterms to recognize accurately if spoken: Vitasilk.');
  });

  it('omits the keyterms block entirely when there are none', async () => {
    const prompt = await buildCorrectionPrompt([], { guidePath });
    expect(prompt).not.toContain('Keyterms');
  });
});

const CONJUNCTION_MARKER = 'The Arabic conjunction و is written w, never the French ou.';

describe('correction prompt versions', () => {
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

  const build = (version: 1 | 2): Promise<string> =>
    buildCorrectionPrompt([{ text: 'chno', start: 0, end: 1, confidence: null }], {
      keyterms: ['Vitasilk'],
      guidePath,
      version,
    });

  it('omits the conjunction rule from version 1 and includes it in version 2', async () => {
    expect(await build(1)).not.toContain(CONJUNCTION_MARKER);
    expect(await build(2)).toContain(CONJUNCTION_MARKER);
  });

  it('puts keyterms after the JSON shape in v1 and before it in v2', async () => {
    const v1 = await build(1);
    const v2 = await build(2);
    expect(v1.indexOf('Keyterms')).toBeGreaterThan(v1.indexOf('Respond with strict JSON'));
    expect(v2.indexOf('Keyterms')).toBeLessThan(v2.indexOf('Respond with strict JSON'));
  });

  it('differs only in the conjunction rule and the keyterms position', async () => {
    // Structural check: strip both variable parts out of each version and the
    // remainder must match exactly, so nothing else drifted between them.
    const strip = (prompt: string): string =>
      prompt
        .replace(/The Arabic conjunction[\s\S]*?\(ynourri, nour\)\./, '')
        .replace(/Keyterms to recognize accurately if spoken:[^\n]*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    expect(strip(await build(2))).toBe(strip(await build(1)));
  });

  it('defaults to the active version', async () => {
    const active = await buildCorrectionPrompt([], { guidePath });
    const explicit = await buildCorrectionPrompt([], {
      guidePath,
      version: ACTIVE_PROMPT_VERSION,
    });
    expect(active).toBe(explicit);
    expect(ACTIVE_PROMPT_VERSION).toBe(1);
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

describe('correction prompt version 3', () => {
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

  const build = (version: 1 | 2 | 3): Promise<string> =>
    buildCorrectionPrompt([{ text: 'chno', start: 0, end: 1, confidence: null }], {
      keyterms: ['Vitasilk'],
      guidePath,
      version,
    });

  it('asks for a per-word lang', async () => {
    const v3 = await build(3);
    expect(v3).toContain('{"words":[{"text":"...","lang":"..."}]}');
    expect(v3).toContain('Every word carries a lang');
  });

  it('defines exactly the five values ARCHITECTURE §3 allows', async () => {
    const v3 = await build(3);
    for (const lang of ['darija:', 'msa:', 'fr:', 'en:', 'mixed:']) {
      expect(v3).toContain(`- ${lang}`);
    }
  });

  it('does not take anything from version 2', async () => {
    const v3 = await build(3);
    expect(v3).not.toContain('The Arabic conjunction و is written w');
    // Keyterms stay after the response shape, as in version 1.
    expect(v3.indexOf('Keyterms')).toBeGreaterThan(v3.indexOf('Respond with strict JSON'));
  });

  it('differs from version 1 only in the response shape', async () => {
    const strip = (prompt: string): string =>
      prompt
        .replace(/Respond with strict JSON[\s\S]*?(?=Keyterms|$)/, '')
        .replace(/\s+/g, ' ')
        .trim();
    expect(strip(await build(3))).toBe(strip(await build(1)));
  });

  it('is not the active version', async () => {
    expect(ACTIVE_PROMPT_VERSION).toBe(1);
  });
});
