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

/**
 * The stages that produce **the pictures**: the images themselves, and the look
 * at the video that decides where each one may sit.
 *
 * **`zones` is in here because otherwise nothing asks for it.** There used to be
 * a single *Run pipeline* button that ran every stage, and it was the only
 * caller this stage ever had. Session 54 replaced it with the two jobs Mohamed
 * names — make the subtitles, then make the pictures — and `zones` was left in
 * neither. Nothing noticed for five weeks because every reel since was run
 * whole by a session driving `runPipeline` directly.
 *
 * Block 12 session 91 is what it cost: `sora-3`, his third real client video,
 * was made entirely through the panel's own two buttons. Its transcript, its
 * keywords and its seven pictures were bought for **$2.4565**, its `zones`
 * stage stayed `pending`, and the build refused — correctly, because without
 * the masks a 2030 px picture goes across her face on a 2160 px frame. He paid
 * and had nothing.
 *
 * It belongs with the pictures rather than the words for the reason it was left
 * out of the words: it is free but it takes about half a minute, and nothing
 * about reading a transcript needs it. A picture cannot be placed without it,
 * so **a run that buys pictures must end with a reel that can be built.**
 */
export const PICTURES_STAGE_IDS: readonly PipelineStageId[] = ['images', 'zones'];

export function stageSpec(id: PipelineStageId): PipelineStageSpec {
  const spec = PIPELINE_STAGES.find((s) => s.id === id);
  if (spec === undefined) throw new Error(`no pipeline stage "${id}"`);
  return spec;
}
