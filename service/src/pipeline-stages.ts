/**
 * The pipeline's stages, declared once.
 *
 * The dry run and the runner are two views of the same work — one says what a
 * run would do, the other does it — and a user who reads "about $0.18" and then
 * watches four differently-named stages go past has been told two stories. So
 * the ids, the order, the labels and **which stages can bill** live here, and
 * both import them.
 *
 * Guidelines §3: a rule shared by more than one tool is pinned by a test, not
 * by a comment. `pipeline-stages.test.ts` asserts the dry run and the runner
 * agree on every one of these.
 *
 * `zones` is called "Looking at the video" on screen. It samples the reel,
 * finds the speaker in every frame and works out where a picture can sit — and
 * the name has to say what it is for rather than what it does, because "frame
 * analysis", "segmentation" and "masks" are all words from this codebase and
 * none of them is his.
 *
 * Audio extraction is not a stage of its own. It is ffmpeg work that
 * `transcribeVideo` does on the way to transcribing, it cannot bill, and it
 * cannot be skipped independently of the thing it feeds — so it is reported as
 * progress inside `transcription` rather than as a fifth row the dry run has
 * never had.
 */
export const PIPELINE_STAGE_IDS = ['transcription', 'analysis', 'images', 'zones'] as const;
export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];

export interface PipelineStageSpec {
  id: PipelineStageId;
  /** The words the panel shows, in the dry run and in the run alike. */
  label: string;
  /** Whether this stage can ever call a paid API. */
  billable: boolean;
}

export const PIPELINE_STAGES: readonly PipelineStageSpec[] = [
  { id: 'transcription', label: 'Transcribe and correct', billable: true },
  { id: 'analysis', label: 'Keywords and image slots', billable: true },
  { id: 'images', label: 'Generate images', billable: true },
  { id: 'zones', label: 'Looking at the video', billable: false },
];

/**
 * The stages that produce **the words**: the transcript, the keywords and the
 * ideas behind the pictures.
 *
 * They are worth naming as a set because the money is not evenly spread. On a
 * 41-second reel the words are about $0.35 and the pictures about $3.98, so
 * running everything is the only way to read a transcript — and reading it is
 * the only way to judge whether it is any good. Block 3 session 6's orthography
 * ruling and session 29's reversal of it were both settled by a person reading
 * words, and there is no other judge: the four hand-written reference
 * transcripts are in the old Latin style and cannot score a new-orthography run.
 *
 * The picture **ideas** are in here rather than with the pictures. They are
 * text, they cost about a fiftieth of the images, and Block 3 session 6 proved
 * their worth at that price: eighteen cents showed two faults that would
 * otherwise have cost $2.35 to find.
 *
 * `zones` is deliberately out. It is free but it takes half a minute a reel,
 * and nothing about the words needs it — it is where a picture can sit.
 */
export const WORDS_STAGE_IDS: readonly PipelineStageId[] = ['transcription', 'analysis'];

export function stageSpec(id: PipelineStageId): PipelineStageSpec {
  const spec = PIPELINE_STAGES.find((s) => s.id === id);
  if (spec === undefined) throw new Error(`no pipeline stage "${id}"`);
  return spec;
}
