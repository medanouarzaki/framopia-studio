import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { estimateGeminiCallCost, estimateScribeCost } from '@framopia/core';
import { probeDurationSeconds } from './transcription/media.js';
import { transcribeVideo } from './transcription/job.js';

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(message)).trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      video: { type: 'string' },
      out: { type: 'string' },
      keyterms: { type: 'string' },
      yes: { type: 'boolean', default: false },
    },
  });

  if (!values.video) {
    console.error(
      'Usage: npm run transcribe -- --video <path> [--out <path.json>] [--keyterms <path>] [--yes]',
    );
    process.exitCode = 1;
    return;
  }
  if (!existsSync(values.video)) {
    console.error(`Video not found: ${values.video}`);
    process.exitCode = 1;
    return;
  }

  const keyterms = values.keyterms
    ? (await readFile(values.keyterms, 'utf8'))
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [];

  // Estimated from the container before any audio is extracted, so the gate
  // comes before the first billable call rather than after the work.
  const durationS = await probeDurationSeconds(values.video);
  const estimate =
    estimateScribeCost(durationS, keyterms.length > 0) + estimateGeminiCallCost(durationS);
  console.log(`Estimated cost for ${durationS.toFixed(1)}s of video: ~$${estimate.toFixed(4)}`);

  if (!values.yes && !(await confirm(`Proceed with billable calls totaling ~$${estimate.toFixed(4)}? [y/N] `))) {
    console.error('aborted: cost confirmation declined');
    process.exitCode = 1;
    return;
  }

  const result = await transcribeVideo({ videoPath: values.video, keyterms, outputPath: values.out });

  console.log(`Transcript written to ${result.outputPath}`);
  console.log(
    `Cost: scribe $${result.transcript.cost.scribeUsd.toFixed(4)} + gemini $${result.transcript.cost.geminiUsd.toFixed(4)} = $${result.transcript.cost.totalUsd.toFixed(4)}`,
  );
  console.log(
    `Prompt version ${result.transcript.promptVersion}, drift ${(result.transcript.drift.fraction * 100).toFixed(1)}% (${result.transcript.drift.draftCount} -> ${result.transcript.drift.correctedCount} tokens), ${result.transcript.wallTimeS.toFixed(1)}s`,
  );
  for (const warning of result.transcript.warnings) {
    console.warn(`warning [${warning.stage}]: ${warning.cause}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
