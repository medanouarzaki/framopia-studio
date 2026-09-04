import path from 'node:path';

/**
 * A video, named the only way two of them cannot collide.
 *
 * **Two of his files are both called `sora.mov`** — one in
 * `Framopia Studio Inputs/Footages/`, one in `September Content/Exports/Work in
 * Progress/` — and everything this tool keeps about a video used to be filed
 * under that name alone. Block 10 session 50 spent $1.01 transcribing the
 * wrong one because `.local/audio/sora.wav` already existed; session 51 named
 * audio from the video's content and found the same fault one directory over,
 * where `.local/cv/sora/` held the other reel's 81 face masks and her 28
 * frames at once. Building on that would have placed her pictures against a
 * different recording's face.
 *
 * So a video is a path **and** its sha256, together, everywhere a directory or
 * a record is named after one. The hash is never computed for this: it is on
 * the plan already, because transcription put it there.
 */
export interface VideoIdentity {
  /** Where the file is. Its basename is what a person reads in `.local/`. */
  path: string;
  /** What the file is. The full 64 hex characters; the name uses a prefix. */
  sha256: string;
}

/**
 * How much of the hash goes in a directory name.
 *
 * Twelve hex characters is 48 bits, the same prefix `extractedAudioPath` and
 * the cutout directories already use, and short enough that
 * `sora-619b8eaecae4/` still reads as *sora* to the person looking in
 * `.local/`.
 */
export const VIDEO_KEY_LENGTH = 12;

/**
 * **The one rule for naming anything after a video**: what he calls it, then
 * what it is.
 *
 * Every directory and record keyed on a video goes through here —
 * `reelFramesDir`, `reelMasksDir`, `loudnessRecordPath` — so there is one
 * declaration rather than three private copies of a `path.basename` call that
 * agreed only while no two videos shared a name. Pinned by
 * `video-identity.test.ts`, which fails if any of them can be made to answer
 * the same for two different files.
 */
export function videoDirName(video: VideoIdentity): string {
  if (!/^[0-9a-f]{64}$/.test(video.sha256)) {
    throw new Error(
      `a video is filed under its content, and ${JSON.stringify(video.sha256)} is not a sha256`,
    );
  }
  const stem = path.basename(video.path, path.extname(video.path));
  return `${stem}-${video.sha256.slice(0, VIDEO_KEY_LENGTH)}`;
}

/**
 * The name back out of a directory `videoDirName` made.
 *
 * `.local/` is filed by content, but a person reading the panel is owed the
 * name he gave the file: the subtitle preview says *a real frame from
 * ground truth*, not *from ground truth-2b3957559a49*.
 */
export function videoNameFromDirName(dirName: string): string {
  const match = new RegExp(`^(.*)-[0-9a-f]{${VIDEO_KEY_LENGTH}}$`).exec(dirName);
  return match?.[1] ?? dirName;
}

/** The plan's own record of which file it describes, in one expression. */
export function videoOf(source: { videoPath: string; sha256: string }): VideoIdentity {
  return { path: source.videoPath, sha256: source.sha256 };
}
