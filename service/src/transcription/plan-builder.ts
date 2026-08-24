import { findCleaningMarks } from './cleaning.js';
import { groupWordsIntoSubtitles } from './grouping.js';
import { tagWord, type CorrectedWord } from './tagging.js';
import type { PlanWord, SubtitleGroup } from '../editplan/types.js';
import type { TranscriptWord } from './types.js';

export interface BuiltTranscript {
  words: PlanWord[];
  groups: SubtitleGroup[];
  /** Words a semantic pass would still need to judge; see cleaning.ts. */
  unjudged: { index: number; text: string }[];
}

function wordId(index: number): string {
  return `w${String(index).padStart(4, '0')}`;
}

/**
 * Turns aligned words into the plan's transcript and subtitle groups:
 * tagging, then cleaning flags, then grouping over what survives.
 *
 * `sourceText` is the draft word the corrected word anchored to where one
 * exists, and the corrected text itself where the correction pass inserted a
 * word with no anchor — an inserted word has no raw ASR form to keep.
 */
export function buildTranscript(
  words: TranscriptWord[],
  draftWords: TranscriptWord[] = [],
  correctedWords: CorrectedWord[] = [],
): BuiltTranscript {
  const texts = words.map((w) => w.text);
  const { marks, unjudged } = findCleaningMarks(texts);
  const reasonByIndex = new Map(marks.map((m) => [m.index, m.reason]));

  const planWords: PlanWord[] = words.map((word, i) => {
    const tags = tagWord(correctedWords[i] ?? { text: word.text });
    const reason = reasonByIndex.get(i) ?? null;
    return {
      id: wordId(i),
      start: word.start ?? 0,
      end: word.end ?? word.start ?? 0,
      text: word.text,
      sourceText: draftWords[i]?.text ?? word.text,
      lang: tags.lang,
      script: tags.script,
      confidence: word.confidence,
      removed: reason !== null,
      removedReason: reason,
      edited: false,
      ...(tags.langDisagreement ? { langDisagreement: true } : {}),
    };
  });

  return { words: planWords, groups: groupWordsIntoSubtitles(planWords), unjudged };
}
