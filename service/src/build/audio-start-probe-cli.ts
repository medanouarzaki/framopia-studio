import path from 'node:path';
import { loadSfxIndex, placeSfx, REPO_ROOT } from '@framopia/core';
import { countAeInstances, runAudioStartProbe } from './drive.js';
import { readEditPlan } from '../editplan/io.js';
import { templateImpacts } from '../analysis/template-impacts.js';

/**
 * Free, local. Drives the **already running** After Effects to answer one
 * question: does a layer whose `startTime` is before the composition keep it?
 *
 * The whole of the first image's sound rests on the answer. `whoosh_01` peaks
 * 0.6913 s into the file and `img001` sits 0.0990 s into the reel, so the layer
 * must begin 0.4568 s before frame zero. If AE clamps that to zero the peak
 * lands 14 frames behind the picture, and leaving the image silent is the only
 * honest option.
 */
const FPS = 30000 / 1001;
const WHOOSH = loadSfxIndex().sfx.find((s) => s.id === 'whoosh_01');
if (WHOOSH?.measured === undefined) {
  console.error('whoosh_01 is not measured; run npm run sfx:measure first');
  process.exit(1);
}
const peakOffsetS = WHOOSH.measured.anchorOffsetS;

/*
 * The real case, read from the plan and the audit rather than typed: the probe
 * has to ask After Effects about the number the placement rule would actually
 * produce, or its answer is about a different question.
 *
 * `placeSfx` with the composition start far below zero gives the unclamped
 * ideal, snapped to the frame grid exactly as a real placement would be — one
 * implementation of the rule rather than a second copy of its arithmetic.
 */
const plan = await readEditPlan(
  path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
);
const slot = plan.images.slots[0];
if (slot?.templateId == null) {
  console.error('vitasilk has no first image slot with a template');
  process.exit(1);
}
const impactS = templateImpacts().get(slot.templateId);
if (impactS === undefined) {
  console.error(`no measured impact for ${slot.templateId}; run npm run audit:templates`);
  process.exit(1);
}
const ideal = placeSfx({
  elementStartS: slot.start,
  impactS,
  peakOffsetS,
  fps: FPS,
  compStartS: Number.NEGATIVE_INFINITY,
});
const NEEDED_START_S = ideal.inPointS;
const IMPACT_AT_S = slot.start + impactS;

console.log(`After Effects instances before: ${countAeInstances()}`);
console.log(
  `whoosh_01 anchor ${peakOffsetS.toFixed(4)}s; ${slot.id} starts ${slot.start.toFixed(4)}s ` +
    `with impact at ${IMPACT_AT_S.toFixed(4)}s, so it needs startTime ` +
    `${NEEDED_START_S.toFixed(4)}s (${(NEEDED_START_S * FPS).toFixed(2)} frames)\n`,
);

const result = runAudioStartProbe({
  savePath: path.join(REPO_ROOT, '.local', 'build', 'audio-start-probe.aep'),
  audioPath: path.join(REPO_ROOT, 'assets', 'sfx', WHOOSH.file),
  peakOffsetS,
  compDurationS: 5,
  frameRate: FPS,
  cases: [
    // The control: an ordinary positive start, so a wrong read path is visible
    // as a wrong control rather than mistaken for a clamp.
    { name: 'control_positive', startTimeS: 1, setInPointS: null },
    { name: 'needed_negative', startTimeS: NEEDED_START_S, setInPointS: null },
    // The same start with the in-point pinned to zero. A layer may legally
    // begin before the comp while the portion that plays starts at zero, and
    // that distinction is the mechanism.
    { name: 'negative_inpoint_zero', startTimeS: NEEDED_START_S, setInPointS: 0 },
    { name: 'deep_negative', startTimeS: -1.5, setInPointS: null },
  ],
});

if (!result.ok) {
  console.error(`\nAfter Effects refused at ${result.stage}: ${result.message}`);
  console.log(`After Effects instances after: ${countAeInstances()}`);
  process.exit(1);
}

const cases = result['cases'] as {
  name: string;
  askedStartTimeS: number;
  askedInPointS: number | null;
  startTimeS: number;
  inPointS: number;
  outPointS: number;
  peakAtS: number;
  hasAudio: boolean;
  audioActive: boolean;
}[];

console.log(`AE ${String(result['aeVersion'])}, source ${String(result['sourceDurationS'])}s`);
console.log(`closed the project that was open: ${String(result['closedProject'] ?? 'none')}\n`);
console.log(
  `${'case'.padEnd(22)}${'asked start'.padStart(12)}${'got start'.padStart(11)}` +
    `${'in-point'.padStart(10)}${'out'.padStart(8)}${'peak at'.padStart(10)}  audio`,
);
for (const c of cases) {
  console.log(
    `${c.name.padEnd(22)}${c.askedStartTimeS.toFixed(4).padStart(12)}` +
      `${c.startTimeS.toFixed(4).padStart(11)}${c.inPointS.toFixed(4).padStart(10)}` +
      `${c.outPointS.toFixed(2).padStart(8)}${c.peakAtS.toFixed(4).padStart(10)}` +
      `  ${c.hasAudio ? 'yes' : 'no'}/${c.audioActive ? 'active' : 'inactive'}`,
  );
}

const negative = cases.find((c) => c.name === 'needed_negative');
const honoured =
  negative !== undefined && Math.abs(negative.startTimeS - negative.askedStartTimeS) < 1e-6;
console.log(
  `\nnegative startTime is ${honoured ? 'HONOURED' : 'CLAMPED'}: asked ` +
    `${negative?.askedStartTimeS.toFixed(4)}, After Effects reports ` +
    `${negative?.startTimeS.toFixed(4)}`,
);
if (honoured) {
  console.log(
    `the peak would land at ${negative?.peakAtS.toFixed(4)}s against an impact at ` +
      `${IMPACT_AT_S.toFixed(4)}s — ` +
      `${(((negative?.peakAtS ?? 0) - IMPACT_AT_S) * FPS).toFixed(2)} frames`,
  );
}
console.log(`\nAfter Effects instances after: ${countAeInstances()}`);
