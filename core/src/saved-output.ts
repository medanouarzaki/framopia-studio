/**
 * What to say about the project the build saved before replacing it.
 *
 * `build-reel.jsx` refuses to replace a project with unsaved changes, except
 * when the open file is the build's own previous output under `.local/build/`
 * — that is not someone's unsaved morning, so it is saved and the build
 * proceeds. It then reports which file it saved.
 *
 * **The panel described that as a rescue even when the file it saved was the
 * file it was about to overwrite.** Rebuilding `vitasilk` on top of an open
 * `vitasilk-full.aep` printed the same path twice: *"Your composition is here:
 * …/vitasilk-full.aep"* and *"Your previous build was open with unsaved
 * changes, so it was saved first: …/vitasilk-full.aep"*. Two sentences, one
 * file, and the second implies work was preserved when the next line of the
 * build overwrote it.
 *
 * The save is genuinely useful in the other case: a **different** reel's build
 * open with unsaved changes is a real file that keeps its edits. So the rule is
 * about which file it was, not whether to say anything.
 *
 * Whether the same-path save is worth doing at all is a separate question — see
 * the note at {@link SAME_FILE_SAVE_IS_POINTLESS}. This module only makes the
 * sentence true.
 */

/**
 * The same-path save writes to disk a moment before the build overwrites it.
 *
 * It changes nothing about what survives: unsaved edits to the previous build
 * of this reel are lost either way. Removing it would leave the `isDirty` guard
 * refusing that case instead, which would stop a rebuild the user plainly
 * wants, so removing the save means also deciding what the guard should do —
 * a behaviour change to the build's file handling, and a ruling rather than a
 * patch. Left alone deliberately.
 */
export const SAME_FILE_SAVE_IS_POINTLESS = true;

export type SavedOutputNote =
  | { kind: 'none' }
  | { kind: 'same-file' }
  | { kind: 'other-file'; path: string };

function sameFile(a: string, b: string): boolean {
  return a === b;
}

export function savedOutputNote(
  savedOwnOutput: string | null,
  savePath: string | null,
): SavedOutputNote {
  if (savedOwnOutput === null) return { kind: 'none' };
  if (savePath !== null && sameFile(savedOwnOutput, savePath)) return { kind: 'same-file' };
  return { kind: 'other-file', path: savedOwnOutput };
}

/**
 * The sentence, in the words the panel and the terminal both use.
 *
 * Null when there is nothing to say. The same-file case says what happened —
 * the previous build was open and has been replaced — without claiming
 * anything was preserved.
 */
export function savedOutputSentence(note: SavedOutputNote): string | null {
  switch (note.kind) {
    case 'none':
      return null;
    case 'same-file':
      return 'The previous build of this reel was open, and this one has replaced it.';
    case 'other-file':
      return `A build of another reel was open with unsaved changes, so it was saved first: ${note.path}`;
  }
}
