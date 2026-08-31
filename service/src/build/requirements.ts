import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import type { EditPlan } from '../editplan/types.js';
import type { ClientIdentitySource } from './client-identity.js';
import { watermarkEnabled } from '../placement/watermark.js';

/**
 * Measurements a build needs, and what it used to do without them.
 *
 * Session 38 found the sharpest one: image placement reads the **face masks**,
 * and with none on disk `faceBoxesFor` returns an empty map, placement falls
 * back to the frame alone, and a slot lands at **2030 px on a 2160 px frame** —
 * across the speaker's face. `placementIsSafe` passed it, because with no face
 * box there is no face to clear. **A check that cannot fail is not a check**, so
 * the face box is required input now and its absence is a refusal.
 *
 * Every requirement here is conditional on what the comp actually contains: a
 * subtitles-only reel needs no masks, a reel with no sounds needs no loudness,
 * and a plan that asks for no watermark needs no watermark measurement. A check
 * that always fires would be as wrong as one that never can.
 *
 * The list is one declaration, read by `build-reel-cli.ts` before it builds and
 * by `steps.ts` so the panel can say the same sentence and disable the control.
 */
export interface BuildRequirement {
  id: string;
  /** Whether this build needs it at all. */
  needed: boolean;
  /** Whether it is there. */
  present: boolean;
  /** What is missing, in the words the user reads. */
  what: string;
  /** The command that produces it. */
  command: string;
  /** What the build would do without it. */
  consequence: string;
}

export class MissingBuildMeasurementsError extends Error {
  constructor(readonly missing: BuildRequirement[]) {
    super(
      `this reel is missing ${missing.length} thing(s) a correct build needs:\n` +
        missing
          .map((m) => `  ${m.what}\n    without it: ${m.consequence}\n    run: ${m.command}`)
          .join('\n'),
    );
    this.name = 'MissingBuildMeasurementsError';
  }
}

export function missingRequirements(needs: BuildRequirement[]): BuildRequirement[] {
  return needs.filter((n) => n.needed && !n.present);
}

export function assertRequirementsMet(needs: BuildRequirement[]): void {
  const missing = missingRequirements(needs);
  if (missing.length > 0) throw new MissingBuildMeasurementsError(missing);
}

/** What is on disk, separated out so the rule can be tested without one. */
export interface BuildDisk {
  faceMasks: boolean;
  cvPython: boolean;
  watermarkFacts: boolean;
}

export function maskDirFor(planPath: string): string {
  const stem = path.basename(planPath).replace('.editplan.json', '');
  return path.join(REPO_ROOT, '.local', 'cv', stem, 'masks-2fps');
}

export function readBuildDisk(planPath: string): BuildDisk {
  const masks = maskDirFor(planPath);
  return {
    faceMasks: existsSync(masks) && readdirSync(masks).some((f) => f.endsWith('.png')),
    cvPython: existsSync(path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python')),
    watermarkFacts: existsSync(path.join(REPO_ROOT, '.local', 'build', 'watermark.json')),
  };
}

export function buildRequirements(
  plan: EditPlan,
  disk: BuildDisk,
  options: {
    modeId?: string;
    knownTemplateIds?: Set<string>;
    /**
     * What `resolveClientIdentity` answered for this plan.
     *
     * Passed in rather than resolved here so there is one declaration of which
     * look a build uses, and so this stays testable without a mode file on
     * disk. Absent means the caller did not ask, and the requirement is then
     * reported as met — a caller that never resolves an identity cannot be told
     * it has the wrong one.
     */
    clientSource?: ClientIdentitySource;
  } = {},
): BuildRequirement[] {
  const slots = plan.images.slots.length;
  const sounds = plan.sfx.events.length;
  const needsMode = options.modeId !== undefined || plan.clientMode !== null;

  const unknownTemplates =
    options.knownTemplateIds === undefined
      ? []
      : [
          ...plan.subtitles.groups.map((g) => g.templateId),
          ...plan.keywords.items.map((k) => k.templateId),
          ...plan.images.slots.map((s) => s.templateId),
        ].filter(
          (id): id is string => id !== null && !(options.knownTemplateIds as Set<string>).has(id),
        );

  return [
    /*
     * A client mode is what decides the type and the colour, so a build that
     * cannot resolve one has no basis for what it is about to place. It used to
     * fall through: `textStyleFor` returned nothing and every card silently
     * took the template's own #F4F4F4 instead of the client's #F8F6F2. Two of
     * the five corpus reels built that way for the whole of Block 10 and
     * nothing anywhere said a word — and a second client with different faces
     * would have had its reels set in K2's type just as quietly.
     *
     * Unconditional, unlike every other requirement here: a reel with no
     * subtitles has nothing to build at all, and every reel that does has type
     * to set.
     */
    {
      id: 'client-identity',
      needed: true,
      present: options.clientSource === undefined || options.clientSource !== 'none',
      what: 'a client for this video — no client mode and no saved client look is on its plan',
      command: 'choose the client for this video in the panel',
      consequence:
        'every card keeps whatever type and colour the template happens to carry rather ' +
        'than the client’s, which on this corpus is #F4F4F4 where it should be #F8F6F2',
    },
    {
      id: 'face-masks',
      needed: slots > 0,
      present: disk.faceMasks,
      what: `the face masks for this reel (${slots} images are placed against them)`,
      // Run pipeline does this now — "Looking at the video" is a stage of it —
      // so that is named first, because the panel is where this sentence is
      // read. The two commands stay because they are still what a terminal
      // runs and they still work.
      command:
        'press Run pipeline for this video; from a terminal, ' +
        'npm run frames -- --reel <label> then npm run segment -- --reel <label>',
      consequence:
        'every image is placed against the frame instead of your face, which puts a ' +
        '2030 px picture across the speaker on a 2160 px frame',
    },
    {
      id: 'cv-sidecar',
      needed: slots > 0,
      present: disk.cvPython,
      what: 'the Python sidecar, which reads the masks and measures each picture’s edge',
      command: 'tools/cv/setup.sh',
      consequence:
        'the masks cannot be read, so images are placed against the frame and the card ' +
        'frame colour is chosen from nothing',
    },
    {
      id: 'watermark-facts',
      needed: watermarkEnabled(plan.watermark),
      present: disk.watermarkFacts,
      what: 'the watermark measurement (this reel is set to carry the mark)',
      // Block 9 session 13 made the pipeline measure the watermark itself, and
      // this sentence was never brought forward. Same shape as `face-masks`:
      // the in-panel action first, the terminal command after it.
      command: 'press Run pipeline for this video; from a terminal, npm run watermark:measure',
      consequence: 'no watermark is placed at all, and the comp looks like one that has none',
    },
    {
      id: 'dialogue-loudness',
      needed: sounds > 0,
      present:
        plan.source.dialogueLufs !== undefined &&
        plan.source.dialogueLufs !== null &&
        plan.source.dialoguePeakDbfs !== undefined &&
        plan.source.dialoguePeakDbfs !== null,
      what: `this reel’s dialogue loudness (${sounds} sounds are mixed against it)`,
      // The pipeline measures loudness itself since Block 9 session 13, on the
      // skip path too, so a run puts this on the plan without a terminal.
      command:
        'press Run pipeline for this video; from a terminal, npm run loudness:measure ' +
        'then npm run migrate:sfx-placement -- --apply',
      consequence:
        'the voice is not brought down, and every sound sums past 0 dBFS and clips — ' +
        'the reels run at 0.0 to 0.2 dBFS true peak, so there is no headroom at all',
    },
    {
      id: 'client-mode',
      needed: slots > 0,
      present: needsMode,
      what: 'the client this reel was built for, which decides the card frame colour',
      command: 'run the pipeline for this reel, or pass --mode <id>',
      consequence:
        'each card keeps the template’s own frame colour, which measures 1.03:1 against ' +
        'the pictures and disappears',
    },
    {
      id: 'known-templates',
      needed: unknownTemplates.length > 0,
      present: false,
      what: `template ids the manifest does not define: ${[...new Set(unknownTemplates)].join(', ')}`,
      command: 'npm run migrate:templates-sfx -- --apply',
      consequence:
        'those cards are given an entrance budget of zero, so the short-card rule ' +
        'compresses against nothing',
    },
  ];
}
