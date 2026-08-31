import path from 'node:path';
import { LOCAL_DIR, REPO_ROOT } from './paths.js';

/**
 * Every hand-made reference in this project, in one declaration.
 *
 * **A hand-made reference is a file a person authored that no process can
 * regenerate.** That is the whole definition, and it is the reason these files
 * are guarded differently from everything else here: a cache entry costs money
 * to rebuild, a mask costs half a minute, and one of these costs a human
 * re-listening to a reel by ear or re-judging 73 pairings one at a time.
 *
 * Two kinds, and they answer different questions:
 *
 * - **transcripts** — `.local/ground-truth/<reel>.txt`, four reels transcribed
 *   by ear. The WER baseline for the project, and gitignored, so this disk and
 *   the backup are the only copies.
 * - **alignment references** — `benchmarks/references/align/<reel>.json` and
 *   `<reel>.rereview.json`, a human's verdict on each pairing the aligner made.
 *   The only non-circular measure of aligner correctness here: every other
 *   figure reads the aligner's own record as ground truth. In git.
 *
 * **A `README.md` in a reference directory is documentation, not a reference.**
 * That is stated here because the count has already meant two things in two
 * reports: Block 10 session 10 measured "3 alignment references" by walking the
 * directory, which counted the README, and session 11 said "6" by excluding it.
 * Both were true of different sets and neither said which. The gate prints
 * {@link REFERENCE_SET_DEFINITION} beside its count so that cannot recur.
 *
 * The derived `.local/ground-truth/<reel>.json` files are deliberately **not**
 * here. `npm run bench:tag` rebuilds them from the `.txt` files, so losing one
 * costs a command; they are read by the scorers, not authored by anyone.
 */
export type ReferenceKind = 'transcript' | 'alignment';

export interface ReferenceFile {
  /** How the gate names it in a failure. */
  readonly id: string;
  readonly kind: ReferenceKind;
  readonly reel: string;
  /** Absolute, resolved against the repository running now. */
  readonly path: string;
  /** What reads it, so a failure says what stops working. */
  readonly readBy: string;
}

const ALIGN_DIR = path.join(REPO_ROOT, 'benchmarks', 'references', 'align');
const TRANSCRIPT_DIR = path.join(LOCAL_DIR, 'ground-truth');

/** The reels a person transcribed by ear. `vitasilk` has none by design. */
export const TRANSCRIPT_REELS = ['ground-truth', 'test-1', 'test-2', 'test-3'] as const;

/**
 * Alignment references, as reel and variant.
 *
 * One reel so far. A second reel's reference is added here and the drift test
 * below then requires it to be on disk — which is the right way round: the
 * declaration is what the gate protects, and a file nobody declared is a file
 * nobody is guarding.
 */
export const ALIGNMENT_REFERENCES = [
  { reel: 'vitasilk', variant: 'review' },
  { reel: 'vitasilk', variant: 'rereview' },
] as const;

export const REFERENCE_FILES: readonly ReferenceFile[] = [
  ...TRANSCRIPT_REELS.map(
    (reel): ReferenceFile => ({
      id: `${reel} transcript`,
      kind: 'transcript',
      reel,
      path: path.join(TRANSCRIPT_DIR, `${reel}.txt`),
      readBy: 'npm run bench:tag, and the WER scorers through the tagged form',
    }),
  ),
  ...ALIGNMENT_REFERENCES.map(
    ({ reel, variant }): ReferenceFile => ({
      id: `${reel} alignment ${variant}`,
      kind: 'alignment',
      reel,
      path: path.join(ALIGN_DIR, variant === 'review' ? `${reel}.json` : `${reel}.${variant}.json`),
      readBy: 'npm run align:score, and the transcription cache eviction guard',
    }),
  ),
];

/** Files in a reference directory that are documentation rather than references. */
export const REFERENCE_DOCUMENTATION = ['README.md'];

/**
 * The gate's own statement of what it counted.
 *
 * Printed with the count, so a number in a report can be traced to a
 * definition without reading this file.
 */
export const REFERENCE_SET_DEFINITION =
  'a hand-made reference is a file a person authored that nothing can regenerate; ' +
  'a README in a reference directory is documentation, not a reference';

export function referenceSetSummary(files: readonly ReferenceFile[] = REFERENCE_FILES): string {
  const transcripts = files.filter((f) => f.kind === 'transcript').length;
  const alignment = files.filter((f) => f.kind === 'alignment').length;
  return `${files.length} hand-made reference file(s): ${transcripts} transcript, ${alignment} alignment`;
}

/**
 * Reference files rooted at a different directory, for exercising the gate.
 *
 * The gate is only worth having if its failures have been watched, and the one
 * thing that must never be done to watch them is move a real reference. This
 * re-roots the declared set onto a scratch directory instead, so an absence is
 * simulated by never creating a file rather than by removing one.
 */
export function referenceFilesRootedAt(root: string): ReferenceFile[] {
  return REFERENCE_FILES.map((file) => ({
    ...file,
    path: path.join(root, path.relative(REPO_ROOT, file.path)),
  }));
}
