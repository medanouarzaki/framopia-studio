import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveFfmpegPath } from './ffmpeg-path.js';

/**
 * A reel's dialogue loudness, measured with ffmpeg's EBU R128 meter.
 *
 * **Why it lives in core.** It was `tools/measure-loudness/cli.ts` and nothing
 * but a terminal could reach it, so `plan.source.dialogueLufs` arrived only
 * through `npm run migrate:sfx-placement` — a hop the user has no way to make,
 * and the build refuses without it. The pipeline drives it now, and the CLI and
 * the pipeline call this same function so the driven path and the terminal path
 * cannot measure differently.
 *
 * Integrated loudness rather than peak: it is what the ear averages over a reel
 * and what a quiet reel and a loud one actually differ by. Peak is reported
 * beside it because a reel already at 0.0 dBFS has no headroom, which is a
 * different fact and the one that made every added sound clip.
 */

/**
 * Bumped when anything that changes a measurement changes — the filter, what
 * is parsed out of it, or which stream is measured. A record written at a
 * different version is stale whatever else it says.
 */
export const LOUDNESS_VERSION = 1;

export interface LoudnessMeasurement {
  reel: string;
  /** EBU R128 integrated loudness over the whole reel. */
  integratedLufs: number;
  /** Loudness range, so a reel with wide dynamics is visible as one. */
  lraLu: number;
  truePeakDbfs: number;
  measuredAt: string;
  measuredWith: string;
}

/**
 * The freshness record, and it is the artifact — stdout is not.
 *
 * It names the file measured and its sha256, so a re-cut of the same reel is a
 * re-measurement rather than a stale number nobody can see is stale. Frame
 * analysis learned this the same way.
 */
export interface LoudnessRecord extends LoudnessMeasurement {
  schemaVersion: number;
  sourcePath: string;
  sourceSha256: string;
}

/** Parses ffmpeg's ebur128 summary, which it writes to stderr. */
export function parseEbur128(stderr: string): {
  integratedLufs: number | null;
  lraLu: number | null;
  truePeakDbfs: number | null;
} {
  const number = (re: RegExp): number | null => {
    const m = re.exec(stderr);
    return m?.[1] === undefined ? null : Number(m[1]);
  };
  return {
    integratedLufs: number(/Integrated loudness:[\s\S]*?I:\s*(-?[\d.]+)\s*LUFS/),
    lraLu: number(/Loudness range:[\s\S]*?LRA:\s*(-?[\d.]+)\s*LU/),
    truePeakDbfs: number(/True peak:[\s\S]*?Peak:\s*(-?[\d.]+)\s*dBFS/),
  };
}

export class LoudnessUnavailableError extends Error {
  constructor(
    readonly what: string,
    readonly consequence: string,
    readonly command: string,
  ) {
    super(`${what}\n    without it: ${consequence}\n    run: ${command}`);
    this.name = 'LoudnessUnavailableError';
  }
}

export function measureLoudness(videoPath: string, reel: string): LoudnessMeasurement {
  let ffmpeg: { path: string; source: string };
  try {
    ffmpeg = resolveFfmpegPath('ffmpeg');
  } catch {
    throw new LoudnessUnavailableError(
      'ffmpeg, which measures how loud the speaking is',
      'sounds are mixed against nothing and every one of them clips the dialogue',
      'brew install ffmpeg, or set ffmpegPath in .local/config.json',
    );
  }
  const proc = spawnSync(
    ffmpeg.path,
    ['-hide_banner', '-nostats', '-i', videoPath, '-map', '0:a:0',
     '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 26 },
  );
  const parsed = parseEbur128(proc.stderr ?? '');
  /*
   * An unreadable summary is a refusal, never a default. A reel measured as
   * "no attenuation" sums every sound past 0 dBFS, which is exactly the
   * failure this measurement exists to prevent.
   */
  if (parsed.integratedLufs === null || parsed.truePeakDbfs === null) {
    throw new Error(`${reel}: ffmpeg reported no ebur128 summary`);
  }
  return {
    reel,
    integratedLufs: parsed.integratedLufs,
    lraLu: parsed.lraLu ?? 0,
    truePeakDbfs: parsed.truePeakDbfs,
    measuredAt: new Date().toISOString(),
    measuredWith: `${path.basename(ffmpeg.path)} (${ffmpeg.source})`,
  };
}

export function hashFileSync(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * Whether a stored record still describes the file on disk.
 *
 * Any mismatch is a re-measurement, and re-measuring is always safe: it is a
 * couple of hundred milliseconds of ffmpeg and it produces the same numbers
 * from the same bytes. Being wrong in the other direction mixes a reel against
 * another cut's loudness.
 */
export function loudnessIsFresh(
  record: LoudnessRecord | null,
  sourcePath: string,
  sourceSha256: string,
): { fresh: boolean; why: string } {
  if (record === null) return { fresh: false, why: 'nothing has measured this reel' };
  if (record.schemaVersion !== LOUDNESS_VERSION) {
    return { fresh: false, why: `measured by version ${record.schemaVersion}, now ${LOUDNESS_VERSION}` };
  }
  if (record.sourceSha256 !== sourceSha256) {
    return { fresh: false, why: 'the video has changed since it was measured' };
  }
  if (record.sourcePath !== sourcePath) {
    return { fresh: false, why: `measured from ${record.sourcePath}` };
  }
  return { fresh: true, why: 'already measured from this exact video' };
}
