import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loudnessIsFresh, LOUDNESS_VERSION, type LoudnessRecord } from '@framopia/core';
import {
  MeasurementUnavailableError,
  WATERMARK_FACTS_VERSION,
  ensureLoudness,
  loudnessRecordPath,
  readLoudnessRecord,
  readWatermarkFacts,
  watermarkFactsAreFresh,
  type WatermarkFacts,
} from './measurements.js';

function facts(over: Partial<WatermarkFacts> = {}): WatermarkFacts {
  return {
    schemaVersion: WATERMARK_FACTS_VERSION,
    path: 'assets/watermark/intro.mov',
    sha256: 'abc',
    width: 1924,
    height: 2154,
    frames: 61,
    lastBeepEndS: 0.4,
    alphaIsPremultiplied: true,
    ...over,
  };
}

function record(over: Partial<LoudnessRecord> = {}): LoudnessRecord {
  return {
    schemaVersion: LOUDNESS_VERSION,
    sourcePath: '/videos/reel.mov',
    sourceSha256: 'abc',
    reel: 'reel',
    integratedLufs: -14,
    lraLu: 2,
    truePeakDbfs: 0.1,
    measuredAt: 'then',
    measuredWith: 'ffmpeg (homebrew)',
    ...over,
  };
}

describe('the watermark freshness record', () => {
  it('is fresh only for the exact file it was measured from', () => {
    expect(watermarkFactsAreFresh(facts(), 'abc').fresh).toBe(true);
    expect(watermarkFactsAreFresh(facts(), 'different').fresh).toBe(false);
  });

  it('names why it is stale rather than only saying it is', () => {
    expect(watermarkFactsAreFresh(facts(), 'different').why).toContain('has changed');
    expect(watermarkFactsAreFresh(null, 'abc').why).toContain('nothing has measured');
  });

  /*
   * A record written before the version existed reads as version 0, which is
   * a re-measurement rather than a silent pass — the same rule frame analysis
   * follows, and the reason an audit predating a field is noticed.
   */
  it('treats a record with no version as stale', () => {
    const old = facts();
    delete old.schemaVersion;
    expect(watermarkFactsAreFresh(old, 'abc').fresh).toBe(false);
  });

  it('reads a corrupt record as absent rather than throwing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-wm-'));
    const file = path.join(dir, 'watermark.json');
    writeFileSync(file, 'not json at all');
    expect(readWatermarkFacts(file)).toBeNull();
  });
});

describe('the loudness freshness record', () => {
  it('is fresh only for the exact video it was measured from', () => {
    expect(loudnessIsFresh(record(), '/videos/reel.mov', 'abc').fresh).toBe(true);
    expect(loudnessIsFresh(record(), '/videos/reel.mov', 'recut').fresh).toBe(false);
  });

  it('is stale when the code that measured it has moved', () => {
    const old = record({ schemaVersion: LOUDNESS_VERSION - 1 });
    expect(loudnessIsFresh(old, '/videos/reel.mov', 'abc').fresh).toBe(false);
  });

  it('says nothing has measured this reel when there is no record', () => {
    expect(loudnessIsFresh(null, '/videos/reel.mov', 'abc').why).toContain('nothing has measured');
  });

  it('keeps each reel’s record under its own name', () => {
    expect(loudnessRecordPath('/videos/test 1.mov')).not.toBe(loudnessRecordPath('/videos/vitasilk.mov'));
    expect(path.basename(loudnessRecordPath('/videos/test 1.mov'))).toBe('test 1.json');
  });

  it('reads a corrupt record as absent rather than throwing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-loud-'));
    const file = path.join(dir, 'x.json');
    writeFileSync(file, '{{{');
    expect(readLoudnessRecord(file)).toBeNull();
  });
});

describe('a missing input refuses by name', () => {
  /*
   * Never an empty result: an empty result is the shape that put a 2030 px
   * picture across the speaker while every check reported success.
   */
  it('refuses when the video is not on this machine, naming it and the consequence', () => {
    let thrown: unknown = null;
    try {
      ensureLoudness({ videoPath: '/nowhere/missing.mov', reel: 'missing', sourceSha256: 'abc' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MeasurementUnavailableError);
    const message = (thrown as Error).message;
    expect(message).toContain('/nowhere/missing.mov');
    expect(message).toContain('clips');
    expect(message).toContain('plug in the drive');
  });
});
