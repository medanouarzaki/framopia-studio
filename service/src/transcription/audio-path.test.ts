import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveFfmpegPath } from '@framopia/core';
import { extractAudio, extractedAudioPath, probeDurationSeconds } from './media.js';

/**
 * **Two videos with the same filename must not share one extraction.**
 *
 * Block 10 session 50. The extracted wav was named `<basename>.wav`, and a
 * client's folder of exports normally holds several files called the same
 * thing — here two `sora.mov`, one 40.5 s and one 13.5 s. The second reel was
 * handed the first one's audio and $1.01 was spent transcribing the wrong
 * recording: 94 words ending at 38.579 s filed against a 13.514 s video, with
 * 63 of 94 cards past the end of it.
 *
 * These make two real files of different lengths with the same name and run the
 * real ffmpeg, because the defect was in what the filesystem did, not in what
 * the code believed.
 */
const FFMPEG = (() => {
  try {
    return resolveFfmpegPath('ffmpeg').path;
  } catch {
    return null;
  }
})();

function makeVideo(at: string, seconds: number): void {
  execFileSync(
    FFMPEG as string,
    ['-y', '-f', 'lavfi', '-i', `color=c=black:s=64x64:d=${seconds}`,
     '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
     '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', at],
    { stdio: 'ignore' },
  );
}

describe.skipIf(FFMPEG === null)('the audio for a video', () => {
  it('is named from the video’s content, not its filename', () => {
    const a = extractedAudioPath('/somewhere/sora.mov', '/audio', 'a'.repeat(64));
    const b = extractedAudioPath('/elsewhere/sora.mov', '/audio', 'b'.repeat(64));
    expect(a).not.toBe(b);
    // Still readable: a person opening .local/audio can tell what it is.
    expect(path.basename(a).startsWith('sora-')).toBe(true);
    expect(path.basename(a).endsWith('.wav')).toBe(true);
  });

  it('is the same path for the same video, so an extraction is reused', () => {
    const sha = 'c'.repeat(64);
    expect(extractedAudioPath('/one/sora.mov', '/audio', sha)).toBe(
      extractedAudioPath('/one/sora.mov', '/audio', sha),
    );
  });

  it('leaves a .wav input alone whatever its hash', () => {
    expect(extractedAudioPath('/one/already.wav', '/audio', 'd'.repeat(64))).toBe(
      '/one/already.wav',
    );
  });

  /** The defect itself, end to end, against the real filesystem and ffmpeg. */
  it('gives two same-named videos of different lengths their own audio', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-audio-'));
    try {
      const longDir = path.join(dir, 'work-in-progress');
      const shortDir = path.join(dir, 'inputs');
      const out = path.join(dir, 'audio');
      execFileSync('mkdir', ['-p', longDir, shortDir]);
      const longVideo = path.join(longDir, 'sora.mov');
      const shortVideo = path.join(shortDir, 'sora.mov');
      makeVideo(longVideo, 4);
      makeVideo(shortVideo, 1);

      const longAudio = await extractAudio(longVideo, out, 'a'.repeat(64));
      const shortAudio = await extractAudio(shortVideo, out, 'b'.repeat(64));

      expect(longAudio).not.toBe(shortAudio);
      expect(await probeDurationSeconds(longAudio)).toBeCloseTo(4, 0);
      // Before the fix this was 4 seconds: the first extraction, reused.
      expect(await probeDurationSeconds(shortAudio)).toBeCloseTo(1, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  /**
   * The second check. The name now carries the hash so this should be
   * unreachable, but the thing it guards is a paid call.
   */
  it('re-extracts an existing file that is not the length of the video', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-audio-'));
    try {
      const out = path.join(dir, 'audio');
      const fourDir = path.join(dir, 'a');
      const oneDir = path.join(dir, 'b');
      execFileSync('mkdir', ['-p', fourDir, oneDir]);
      // Same filename and the same hash, so both resolve to one wav — the only
      // way to reach the mismatch now that the name carries the content.
      const four = path.join(fourDir, 'clip.mov');
      const one = path.join(oneDir, 'clip.mov');
      makeVideo(four, 4);
      makeVideo(one, 1);
      const sha = 'e'.repeat(64);
      const first = await extractAudio(four, out, sha);
      expect(await probeDurationSeconds(first)).toBeCloseTo(4, 0);

      const said: string[] = [];
      const second = await extractAudio(one, out, sha, (m) => said.push(m));
      expect(second).toBe(first);
      expect(await probeDurationSeconds(second)).toBeCloseTo(1, 0);
      expect(said.join(' ')).toContain('not this recording');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('reuses an extraction that does match, rather than running ffmpeg again', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-audio-'));
    try {
      const out = path.join(dir, 'audio');
      const video = path.join(dir, 'clip.mov');
      makeVideo(video, 2);
      const sha = 'f'.repeat(64);
      const first = await extractAudio(video, out, sha);
      const before = statSync(first).mtimeMs;
      const said: string[] = [];
      const again = await extractAudio(video, out, sha, (m) => said.push(m));
      expect(again).toBe(first);
      expect(statSync(again).mtimeMs).toBe(before);
      expect(said).toEqual([]);
      expect(existsSync(again)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
