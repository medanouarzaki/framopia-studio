import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_DIR, modelConfig } from '@framopia/core';
import { DEFAULT_IMAGE_CONFIG } from './images/config.js';
import { SCRIBE_MODEL_ID } from './transcription/scribe.js';
import { ACTIVE_PROMPT_VERSION } from './transcription/correction.js';

/**
 * A decision doc freezes a config; the code holds it. Nothing connected the
 * two until now, and Block 4 session 5 nearly paid for it:
 * `DECISION-image-config.md` froze `gemini-3-pro-image` at 2K while
 * `DEFAULT_IMAGE_CONFIG` still said flash at 1K. Ten wrong images would have
 * passed every check — inside budget, correct dimensions for the config the
 * code actually held, no error anywhere. A pre-flight print caught it by eye.
 *
 * Same shape as `quality.test.ts` reading the Python gate's source so the
 * thresholds cannot drift: the doc is the source of truth and the test reads
 * it rather than restating it.
 */
function readDoc(name: string): string {
  return readFileSync(path.join(DOCS_DIR, name), 'utf8');
}

/**
 * Pulls a value out of a two-column markdown row. Throws rather than
 * returning undefined when the row is gone: a parser that quietly finds
 * nothing is a test that quietly stops testing, which is the failure mode
 * this whole file exists to prevent.
 */
function tableValue(doc: string, label: string): string {
  const row = new RegExp(`^\\|\\s*${label}\\s*\\|(.+?)\\|\\s*$`, 'm').exec(doc);
  if (row?.[1] === undefined) {
    throw new Error(
      `no "${label}" row in the frozen-config table. If the table was ` +
        'restructured, update this test — do not delete the assertion.',
    );
  }
  return row[1].trim();
}

describe('DECISION-image-config.md matches the code', () => {
  const doc = readDoc('DECISION-image-config.md');

  it('freezes the model the code defaults to', () => {
    expect(tableValue(doc, 'model')).toContain(DEFAULT_IMAGE_CONFIG.modelId);
  });

  it('freezes the resolution the code defaults to', () => {
    expect(tableValue(doc, 'resolution')).toContain(DEFAULT_IMAGE_CONFIG.resolution);
  });

  it('freezes the aspect ratio the code defaults to', () => {
    expect(tableValue(doc, 'aspect ratio')).toContain(DEFAULT_IMAGE_CONFIG.aspectRatio);
  });

  it('freezes the candidate count the code defaults to', () => {
    expect(tableValue(doc, 'candidates per slot')).toContain(
      String(DEFAULT_IMAGE_CONFIG.candidatesPerSlot),
    );
  });

  // The exact regression: the doc said pro-at-2K, the code said flash-at-1K,
  // and every other check passed.
  it('would have caught the session 5 divergence', () => {
    expect(tableValue(doc, 'model')).not.toContain('gemini-3.1-flash-image');
    expect(tableValue(doc, 'resolution')).not.toContain('1K');
  });

  it('throws rather than silently passing when the table is restructured', () => {
    expect(() => tableValue(doc, 'a row that does not exist')).toThrow(/do not delete/);
  });
});

describe('DECISION-transcription-config.md matches the code', () => {
  const doc = readDoc('DECISION-transcription-config.md');

  it('names the pinned gemini model', () => {
    expect(doc).toContain(modelConfig.geminiModel);
  });

  it('names the scribe model the client sends', () => {
    // Written as "Scribe v2, batch" in prose; the id is what the client uses.
    expect(SCRIBE_MODEL_ID).toBe('scribe_v2');
    expect(doc.toLowerCase()).toContain('scribe v2');
  });

  /**
   * The doc records prompt versions by amendment. The most recent amendment
   * must name the version the code actually runs, or the freeze record
   * describes a configuration nobody uses.
   */
  it('records the active prompt version in its amendments', () => {
    const versions = [...doc.matchAll(/ACTIVE_PROMPT_VERSION = (\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(versions.length).toBeGreaterThan(0);
    expect(Math.max(...versions)).toBe(ACTIVE_PROMPT_VERSION);
  });
});
