import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LOCAL_DIR, loadConfig } from '@framopia/core';
import { registerJobRunner } from '../jobs.js';
import { extractAudio, probeDurationSeconds } from './media.js';
import { transcribeHybrid, type HybridTranscript } from './index.js';

export const TRANSCRIBE_JOB_TYPE = 'transcribe';

export interface TranscribeVideoOptions {
  videoPath: string;
  outputPath?: string;
  keyterms?: string[];
  log?: (message: string) => void;
}

export interface TranscribeVideoResult {
  videoPath: string;
  audioPath: string;
  durationS: number;
  outputPath: string;
  transcript: HybridTranscript;
}

/**
 * Video in, transcript artifact out. Deliberately not an Edit Plan — that
 * schema lands separately; this writes the transcript alone.
 */
export async function transcribeVideo(
  options: TranscribeVideoOptions,
): Promise<TranscribeVideoResult> {
  const { videoPath, keyterms = [], log = console.log } = options;
  const config = loadConfig();

  const audioPath = await extractAudio(videoPath, path.join(LOCAL_DIR, 'audio'));
  const durationS = await probeDurationSeconds(audioPath);

  const transcript = await transcribeHybrid({
    elevenLabsApiKey: config.elevenLabsApiKey,
    googleApiKey: config.googleApiKey,
    audioPath,
    durationS,
    keyterms,
    log,
  });

  const outputPath =
    options.outputPath ??
    path.join(
      LOCAL_DIR,
      'transcripts',
      `${path.basename(videoPath, path.extname(videoPath))}.json`,
    );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ videoPath, audioPath, durationS, ...transcript }, null, 2)}\n`,
    'utf8',
  );

  return { videoPath, audioPath, durationS, outputPath, transcript };
}

registerJobRunner(TRANSCRIBE_JOB_TYPE, async (params) => {
  const videoPath = params?.videoPath;
  if (typeof videoPath !== 'string' || videoPath.length === 0) {
    throw new Error('transcribe job requires a videoPath');
  }
  const keyterms = Array.isArray(params?.keyterms)
    ? params.keyterms.filter((k): k is string => typeof k === 'string')
    : [];
  const outputPath = typeof params?.outputPath === 'string' ? params.outputPath : undefined;
  return transcribeVideo({ videoPath, keyterms, outputPath });
});
