import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  groupWordsIntoSubtitles,
  MAX_GROUP_DURATION_S,
  MAX_INTRA_GROUP_GAP_S,
} from './grouping.js';
import { mapScribeResponse, type ScribeRawResponse } from './scribe.js';
import type { PlanWord } from '../editplan/types.js';

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
);

function word(id: string, start: number, end: number, removed = false): PlanWord {
  return {
    id,
    start,
    end,
    text: id,
    sourceText: id,
    lang: null,
    script: 'latin',
    confidence: 0.9,
    removed,
    removedReason: removed ? 'filler' : null,
    edited: false,
  };
}

/** The real vitasilk opening, as Scribe timed it. */
function fixtureWords(): PlanWord[] {
  const raw = JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
  ) as ScribeRawResponse;
  return mapScribeResponse(raw).map((w, i) => ({
    ...word(`w${String(i).padStart(4, '0')}`, w.start ?? 0, w.end ?? 0),
    text: w.text,
    sourceText: w.text,
    confidence: w.confidence,
  }));
}

describe('groupWordsIntoSubtitles', () => {
  it('pairs two words separated by a short gap', () => {
    const groups = groupWordsIntoSubtitles([word('w1', 0, 0.3), word('w2', 0.4, 0.7)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ wordIds: ['w1', 'w2'], start: 0, end: 0.7 });
  });

  it('splits two words separated by a long gap', () => {
    const groups = groupWordsIntoSubtitles([word('w1', 0, 0.3), word('w2', 2.0, 2.3)]);
    expect(groups.map((g) => g.wordIds)).toEqual([['w1'], ['w2']]);
  });

  it('splits a pair that would linger past the duration cap', () => {
    const groups = groupWordsIntoSubtitles([word('w1', 0, 0.8), word('w2', 0.9, 2.0)]);
    expect(groups.map((g) => g.wordIds)).toEqual([['w1'], ['w2']]);
  });

  it('pairs exactly at the gap and duration limits', () => {
    const groups = groupWordsIntoSubtitles([
      word('w1', 0, 0.3),
      word('w2', 0.3 + MAX_INTRA_GROUP_GAP_S, MAX_GROUP_DURATION_S),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('never puts more than two words in a group', () => {
    const groups = groupWordsIntoSubtitles([
      word('w1', 0, 0.1),
      word('w2', 0.15, 0.25),
      word('w3', 0.3, 0.4),
      word('w4', 0.45, 0.55),
    ]);
    expect(groups.map((g) => g.wordIds)).toEqual([
      ['w1', 'w2'],
      ['w3', 'w4'],
    ]);
  });

  it('leaves a trailing odd word in a group of one', () => {
    const groups = groupWordsIntoSubtitles([
      word('w1', 0, 0.1),
      word('w2', 0.15, 0.25),
      word('w3', 0.3, 0.4),
    ]);
    expect(groups.map((g) => g.wordIds)).toEqual([['w1', 'w2'], ['w3']]);
  });

  it('never puts a removed word in a group', () => {
    const groups = groupWordsIntoSubtitles([
      word('w1', 0, 0.1),
      word('w2', 0.15, 0.25, true),
      word('w3', 0.3, 0.4),
    ]);
    expect(groups.flatMap((g) => g.wordIds)).not.toContain('w2');
  });

  it('still counts the audio a removed word occupies when measuring the gap', () => {
    // w1 and w3 are 0.2s apart, past the gap limit, and the filler between
    // them was still spoken — so they stay separate cards.
    const spread = groupWordsIntoSubtitles([
      word('w1', 0, 0.1),
      word('w2', 0.15, 0.25, true),
      word('w3', 0.3, 0.4),
    ]);
    expect(spread.map((g) => g.wordIds)).toEqual([['w1'], ['w3']]);

    // With a shorter filler the neighbours fall inside the limit and pair.
    const tight = groupWordsIntoSubtitles([
      word('w1', 0, 0.1),
      word('w2', 0.11, 0.15, true),
      word('w3', 0.2, 0.3),
    ]);
    expect(tight.map((g) => g.wordIds)).toEqual([['w1', 'w3']]);
  });

  it('returns nothing for an empty or fully removed transcript', () => {
    expect(groupWordsIntoSubtitles([])).toEqual([]);
    expect(groupWordsIntoSubtitles([word('w1', 0, 0.1, true)])).toEqual([]);
  });
});

describe('groupWordsIntoSubtitles on the recorded vitasilk opening', () => {
  const words = fixtureWords();

  it('covers every displayable word exactly once, in order', () => {
    const groups = groupWordsIntoSubtitles(words);
    expect(groups.flatMap((g) => g.wordIds)).toEqual(words.map((w) => w.id));
  });

  it('holds each group to one or two words and to the duration cap', () => {
    for (const group of groupWordsIntoSubtitles(words)) {
      expect(group.wordIds.length).toBeGreaterThanOrEqual(1);
      expect(group.wordIds.length).toBeLessThanOrEqual(2);
      expect(group.end - group.start).toBeLessThanOrEqual(MAX_GROUP_DURATION_S);
    }
  });

  it('derives group timings from the words they contain', () => {
    const byId = new Map(words.map((w) => [w.id, w]));
    for (const group of groupWordsIntoSubtitles(words)) {
      const first = byId.get(group.wordIds[0]!)!;
      const last = byId.get(group.wordIds[group.wordIds.length - 1]!)!;
      expect(group.start).toBe(first.start);
      expect(group.end).toBe(last.end);
    }
  });

  it('is re-derivable: the same words always give the same groups', () => {
    expect(groupWordsIntoSubtitles(words)).toEqual(groupWordsIntoSubtitles(fixtureWords()));
  });

  it('regroups around an edit without reading the previous groups', () => {
    const edited = words.map((w, i) => (i === 2 ? { ...w, removed: true, removedReason: 'filler' as const } : w));
    const groups = groupWordsIntoSubtitles(edited);
    expect(groups.flatMap((g) => g.wordIds)).not.toContain(words[2]!.id);
    expect(groups.flatMap((g) => g.wordIds)).toHaveLength(words.length - 1);
  });
});
