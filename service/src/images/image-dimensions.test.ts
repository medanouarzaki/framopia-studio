import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@framopia/core';
import { expectedDimensions, readImageDimensions } from './image-dimensions.js';

/** A minimal but real PNG: signature plus an IHDR carrying w/h. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** SOI, an APP0 segment to skip over, then an SOF0 carrying h/w. */
function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 8);
  bytes.set([0xff, 0xc0], 12);
  view.setUint16(14, 11);
  bytes[16] = 8;
  view.setUint16(17, height);
  view.setUint16(19, width);
  return bytes;
}

describe('readImageDimensions', () => {
  it('reads a png', () => {
    expect(readImageDimensions(png(2048, 2048), 'image/png')).toEqual({
      width: 2048, height: 2048,
    });
  });

  it('reads a jpeg, skipping the segments before the frame', () => {
    expect(readImageDimensions(jpeg(2752, 1536), 'image/jpeg')).toEqual({
      width: 2752, height: 1536,
    });
  });

  it('sniffs the format when no mime type is given', () => {
    expect(readImageDimensions(png(1024, 1024))).toEqual({ width: 1024, height: 1024 });
    expect(readImageDimensions(jpeg(800, 600))).toEqual({ width: 800, height: 600 });
  });

  // Null means unknown. A caller must never read it as "correct" — guessing
  // here would recreate the defect this module exists for.
  it('is null on bytes it cannot read, never a guess', () => {
    expect(readImageDimensions(Uint8Array.from([1, 2, 3]), 'image/png')).toBeNull();
    expect(readImageDimensions(new Uint8Array(0))).toBeNull();
    expect(readImageDimensions(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg')).toBeNull();
  });

  /**
   * The real file session 2 generated, if it is still on disk. It is the
   * case the whole module exists for, and reading it here means the parser
   * is tested against an actual API response and not only against fixtures
   * written to match the parser.
   */
  const real = path.join(
    REPO_ROOT, 'benchmarks', 'results', 'latest-imagebakeoff',
    'gemini-3.1-flash-image-1.jpg',
  );
  it.runIf(existsSync(real))('agrees with the system decoder on a real response', () => {
    const bytes = readFileSync(real);
    const ours = readImageDimensions(bytes, 'image/jpeg');
    const sips = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', real], {
      encoding: 'utf8',
    });
    const width = Number(/pixelWidth:\s*(\d+)/.exec(sips)?.[1]);
    const height = Number(/pixelHeight:\s*(\d+)/.exec(sips)?.[1]);
    expect(ours).toEqual({ width, height });
  });
});

describe('expectedDimensions', () => {
  it('squares the tier side for a 1:1 request', () => {
    expect(expectedDimensions('1K', '1:1')).toEqual({ width: 1024, height: 1024 });
    expect(expectedDimensions('2K', '1:1')).toEqual({ width: 2048, height: 2048 });
  });

  it('is null for an unknown tier', () => {
    expect(expectedDimensions('8K', '1:1')).toBeNull();
  });

  // Session 2 established that a non-square served shape matches no published
  // pair, so its dimensions are not derivable. Refusing beats guessing.
  it('is null for a non-square ratio rather than deriving one', () => {
    expect(expectedDimensions('2K', '16:9')).toBeNull();
    expect(expectedDimensions('2K', 'square')).toBeNull();
  });
});
