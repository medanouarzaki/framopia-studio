import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { LOCAL_DIR, resolveFfmpegPath } from '@framopia/core';
import { probeVideo } from './transcription/media.js';
import { hashFile } from './transcription/fingerprint.js';
import { VIDEO_EXTENSIONS } from './clients/videos.js';

/**
 * The videos this machine has been shown, outside the test corpus.
 *
 * **`benchmarks/footage.json` is the catalogue of the five test reels and was
 * never a list of what the product may open.** Every stage looked a reel up in
 * it by label, so a real client video picked through Browse was refused with
 * `no reel labelled "sora" in benchmarks/footage.json` — a sentence about a
 * benchmark fixture, on the screen of someone trying to caption a client's
 * reel. The panel knew the video; the service did not, because the panel sends
 * a **label** on every later call and nothing on this side remembered what the
 * label meant.
 *
 * So a browsed video is written down here, once, when it is opened. The
 * corpus catalogue keeps its job — it carries the fetch note, the sha256 and
 * the byte count the doctor verifies — and stops being a gate on anything
 * else.
 *
 * `.local/` because this is a fact about **this machine**: which files someone
 * happened to open. It is not a fact about the project and it must not travel.
 */
export const VIDEO_REGISTRY_PATH = path.join(LOCAL_DIR, 'videos.json');

/**
 * `FRAMOPIA_VIDEO_REGISTRY` re-points it, the same device
 * `FRAMOPIA_REFERENCE_ROOT` gives the reference gate. Without it a test's
 * answer depends on which videos this machine happens to have opened, which is
 * exactly what made `clients/videos.test.ts` fail the moment a real client reel
 * was browsed.
 */
export function videoRegistryPath(): string {
  return process.env['FRAMOPIA_VIDEO_REGISTRY'] ?? VIDEO_REGISTRY_PATH;
}

/** Where a browsed video's Edit Plan and build outputs go. */
export const BROWSED_PLANS_DIR = path.join(LOCAL_DIR, 'plans');

const execFileAsync = promisify(execFile);

export class VideoError extends Error {}

/**
 * The one frame size this pipeline can place against, PROJECT_SPEC §4.
 *
 * Every placement constant, the subtitle band and the watermark inset are
 * derived from it, and a video of another shape would come out looking built
 * and be wrong everywhere. Refusing by name is the alternative to that, and it
 * is a product limitation rather than a defect — `docs/PROJECT_SPEC.md` records
 * the 4K-only scope and what it would take to widen.
 */
export const SUPPORTED_WIDTH = 2160;
export const SUPPORTED_HEIGHT = 3840;

export interface KnownVideo {
  label: string;
  path: string;
  durationS: number;
  fps: number;
  width: number;
  height: number;
  /** Addresses the cache. Computed once here rather than on every dry run. */
  sha256: string;
  openedAt: string;
}

interface Registry {
  videos: KnownVideo[];
}

function readRegistry(registryPath = videoRegistryPath()): Registry {
  if (!existsSync(registryPath)) return { videos: [] };
  try {
    const parsed = JSON.parse(readFileSync(registryPath, 'utf8')) as Partial<Registry>;
    return { videos: Array.isArray(parsed.videos) ? parsed.videos : [] };
  } catch {
    // A damaged registry is a list of conveniences, not a record of work. It is
    // rebuilt by opening the videos again, so it is never a reason to refuse.
    return { videos: [] };
  }
}

export function knownVideos(registryPath = videoRegistryPath()): KnownVideo[] {
  return readRegistry(registryPath).videos.filter((v) => existsSync(v.path));
}

/**
 * What a browsed video is called.
 *
 * **The file's own name, without its extension** — `sora.mov` is `sora`. It is
 * what he called it, it is what he will look for in the picker, and any name
 * this tool invented would be one more thing to learn.
 *
 * **A second file wanting the same name gets its folder in front of it** —
 * `Work in Progress/sora` — and a third gets a short hash of its full path.
 * Two different files may not share a label: the label is what every later
 * call sends, so a collision would silently caption the wrong video.
 *
 * The user cannot rename it. A label he can edit is a second identifier to
 * keep in step with the plan, the cache and the build, and nothing here needs
 * one; the picker shows the file's own name and the folder it came from.
 */
export function labelFor(videoPath: string, taken: ReadonlyMap<string, string>): string {
  const base = path.basename(videoPath, path.extname(videoPath));
  const existing = taken.get(base);
  if (existing === undefined || existing === videoPath) return base;

  const withFolder = `${path.basename(path.dirname(videoPath))}/${base}`;
  const alsoTaken = taken.get(withFolder);
  if (alsoTaken === undefined || alsoTaken === videoPath) return withFolder;

  return `${base}-${createHash('sha256').update(videoPath).digest('hex').slice(0, 6)}`;
}

/**
 * Everything the tool needs before it will open a video, each refusal saying
 * which one it is.
 *
 * All of it is read from the file itself — a browsed video has no catalogue
 * entry to take a duration from — and all of it happens before any money can
 * move, because the alternative is discovering it after a transcription.
 */
/** Transcription starts by extracting audio, so a silent file is a dead end. */
async function hasAudio(videoPath: string): Promise<boolean> {
  const { stdout } = await execFileAsync(resolveFfmpegPath('ffprobe').path, [
    '-v', 'error',
    '-select_streams', 'a',
    '-show_entries', 'stream=index',
    '-of', 'csv=p=0',
    videoPath,
  ]);
  return stdout.trim() !== '';
}

async function factsOf(videoPath: string): Promise<Omit<KnownVideo, 'label' | 'openedAt'>> {
  let probe;
  try {
    probe = await probeVideo(videoPath);
  } catch (error) {
    throw new VideoError(
      `this file could not be read as a video: ${(error as Error).message.split('\n')[0]}`,
    );
  }
  if (probe.durationS <= 0) {
    throw new VideoError('this video has no duration, so there is nothing to caption');
  }
  if (probe.width !== SUPPORTED_WIDTH || probe.height !== SUPPORTED_HEIGHT) {
    throw new VideoError(
      `this video is ${probe.width} x ${probe.height}, and this tool only builds ` +
        `${SUPPORTED_WIDTH} x ${SUPPORTED_HEIGHT} upright video. Everything it places — the ` +
        'subtitles, the pictures, the watermark — is measured against that frame.',
    );
  }
  if (!(await hasAudio(videoPath))) {
    throw new VideoError(
      'this video has no audio track, so there is nothing to transcribe. Export it with its ' +
        'sound and try again.',
    );
  }
  return {
    path: videoPath,
    durationS: probe.durationS,
    fps: probe.fps,
    width: probe.width,
    height: probe.height,
    sha256: await hashFile(videoPath),
  };
}

/**
 * Opens one video from anywhere and remembers it, so every later call that
 * sends only its label can find it again.
 *
 * Nothing is copied, moved or written beside the file. What is stored is a
 * path, a size, a duration and a hash.
 */
export async function rememberVideo(
  videoPath: string,
  registryPath = videoRegistryPath(),
): Promise<KnownVideo> {
  if (!path.isAbsolute(videoPath)) {
    throw new VideoError('give the full path to the file');
  }
  if (!existsSync(videoPath)) {
    throw new VideoError(
      `there is nothing at ${videoPath}. If it is on an external disk, plug it in.`,
    );
  }
  const extension = path.extname(videoPath).toLowerCase();
  if (!VIDEO_EXTENSIONS.includes(extension)) {
    throw new VideoError(`this tool does not open ${extension || 'files without an extension'}.`);
  }

  const registry = readRegistry(registryPath);
  const already = registry.videos.find((v) => v.path === videoPath);
  if (already !== undefined && existsSync(already.path)) return already;

  const facts = await factsOf(videoPath);
  const taken = new Map(registry.videos.map((v) => [v.label, v.path]));
  const entry: KnownVideo = {
    ...facts,
    label: labelFor(videoPath, taken),
    openedAt: new Date().toISOString(),
  };

  mkdirSync(path.dirname(registryPath), { recursive: true });
  writeFileSync(
    registryPath,
    `${JSON.stringify({ videos: [...registry.videos, entry] }, null, 2)}\n`,
    'utf8',
  );
  return entry;
}
