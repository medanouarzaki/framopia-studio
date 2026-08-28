import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import {
  editCard,
  editWord,
  OVERLONG_WORD_CHARS,
  transcriptView,
  TranscriptViewError,
} from './transcript-view.js';
import { readEditPlan } from './editplan/io.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');
const LEDGER = path.join(REPO_ROOT, '.local', 'costs.jsonl');

describe('transcriptView', () => {
  it('returns every word and every card, in reading order', async () => {
    const view = await transcriptView('vitasilk');
    expect(view.words).toHaveLength(73);
    expect(view.cards).toHaveLength(73);
    expect(view.words.map((w) => w.id)).toEqual([...view.words].sort((a, b) => a.id.localeCompare(b.id)).map((w) => w.id));
  });

  it('puts every word in the card it will be built into', async () => {
    const view = await transcriptView('vitasilk');
    for (const word of view.words) {
      if (word.removed) continue;
      expect(word.cardId, word.id).not.toBeNull();
    }
  });

  /*
   * The aligner leaves an interpolated word with no anchor and no confidence.
   * `26` is the one the defect record names, and the user will look for it.
   */
  it('marks an interpolated word, and 26 on vitasilk is one', async () => {
    const view = await transcriptView('vitasilk');
    const word = view.words.find((w) => w.id === 'w0036');
    expect(word?.text).toBe('26');
    expect(word?.interpolated).toBe(true);
    expect(word?.sourceText).toBeNull();
    expect(word?.confidence).toBeNull();
  });

  it('carries the draft token a word took its timing from', async () => {
    const view = await transcriptView('vitasilk');
    const word = view.words.find((w) => w.id === 'w0028');
    expect(word?.text).toBe('mn');
    // The transliteration fix put this word on its own token in session 14.
    expect(word?.sourceText).toBe('من');
  });

  it('carries each word’s own script, so the panel can set direction per token', async () => {
    const view = await transcriptView('test-2');
    expect(view.words.some((w) => w.script === 'arabic')).toBe(true);
    expect(view.words.some((w) => w.script === 'latin')).toBe(true);
  });

  it('refuses a reel with no plan by name, rather than returning nothing', async () => {
    await expect(transcriptView('nope')).rejects.toThrow(TranscriptViewError);
  });
});

/**
 * The three questions the user has to rule on. Each figure is checked against
 * the corpus number recorded in CLAUDE.md, so a change to grouping or timing
 * that moves one of them fails here rather than quietly restating itself.
 */
describe('the open questions', () => {
  async function corpusCount(id: string): Promise<number> {
    let total = 0;
    for (const reel of ['ground-truth', 'test-1', 'test-2', 'test-3', 'vitasilk']) {
      const view = await transcriptView(reel);
      total += view.questions.find((q) => q.id === id)?.count ?? 0;
    }
    return total;
  }

  it('finds the 7 overlong single words', async () => {
    expect(await corpusCount('overlong')).toBe(7);
  });

  it('finds the 23 clipped holds', async () => {
    expect(await corpusCount('clipped')).toBe(23);
  });

  it('finds the 13 split multi-word Arabic runs', async () => {
    expect(await corpusCount('split-term')).toBe(13);
  });

  /*
   * The overlong figure came from After Effects measuring glyph widths; the
   * panel counts characters. They agree on this corpus and the marker says
   * which is which rather than presenting a proxy as the measurement.
   */
  it('says the overlong figure is a proxy for a width measured in After Effects', async () => {
    const view = await transcriptView('vitasilk');
    const question = view.questions.find((q) => q.id === 'overlong');
    expect(question?.basis).toContain('After Effects');
    expect(question?.basis).toContain(String(OVERLONG_WORD_CHARS));
  });

  it('names the words to look at, not just how many', async () => {
    const view = await transcriptView('vitasilk');
    for (const question of view.questions) {
      if (question.count === 0) continue;
      expect(question.wordIds.length, question.id).toBeGreaterThan(0);
    }
  });

  it('asks a question rather than proposing a fix', async () => {
    const view = await transcriptView('vitasilk');
    for (const question of view.questions) {
      expect(question.question, question.id).toContain('?');
    }
  });
});

/**
 * The counts on screen read 1, 5 and 0 for `vitasilk` while the record said 7,
 * 23 and 13. Both were right: one per reel, one over the corpus, and nothing
 * said which. These pin **both scopes for every reel**, so the two can never be
 * read as each other again.
 */
describe('per-reel and corpus counts', () => {
  const RECORDED: Record<string, { overlong: number; clipped: number; splitTerm: number }> = {
    'ground-truth': { overlong: 2, clipped: 8, splitTerm: 2 },
    'test-1': { overlong: 0, clipped: 5, splitTerm: 6 },
    'test-2': { overlong: 1, clipped: 3, splitTerm: 1 },
    'test-3': { overlong: 3, clipped: 2, splitTerm: 4 },
    vitasilk: { overlong: 1, clipped: 5, splitTerm: 0 },
  };

  for (const [reel, expected] of Object.entries(RECORDED)) {
    it(`counts ${reel} as ${expected.overlong}/${expected.clipped}/${expected.splitTerm}`, async () => {
      const view = await transcriptView(reel);
      const by = Object.fromEntries(view.questions.map((q) => [q.id, q.count]));
      expect(by['overlong']).toBe(expected.overlong);
      expect(by['clipped']).toBe(expected.clipped);
      expect(by['split-term']).toBe(expected.splitTerm);
    });
  }

  it('sums the per-reel figures to the corpus figures', async () => {
    const view = await transcriptView('vitasilk');
    const by = Object.fromEntries(view.questions.map((q) => [q.id, q.corpusCount]));
    const sum = (k: 'overlong' | 'clipped' | 'splitTerm'): number =>
      Object.values(RECORDED).reduce((n, r) => n + r[k], 0);
    expect(by['overlong']).toBe(sum('overlong'));
    expect(by['clipped']).toBe(sum('clipped'));
    expect(by['split-term']).toBe(sum('splitTerm'));
  });

  it('reports both scopes, never one alone', async () => {
    const view = await transcriptView('vitasilk');
    for (const question of view.questions) {
      expect(typeof question.count, question.id).toBe('number');
      expect(typeof question.corpusCount, question.id).toBe('number');
    }
  });

  /*
   * The zero the user did not believe. It is real: every displayed word on
   * `vitasilk` is Arabizi, so no Arabic run exists to be split. The Arabic on
   * that reel lives in `sourceText`, which is the draft and never gets built.
   */
  it('finds no split term on a reel whose words are all Latin', async () => {
    const view = await transcriptView('vitasilk');
    expect(view.words.every((w) => w.script === 'latin')).toBe(true);
    expect(view.words.filter((w) => /[\u0600-\u06FF]/.test(w.sourceText ?? '')).length).toBeGreaterThan(0);
    expect(view.questions.find((q) => q.id === 'split-term')?.count).toBe(0);
  });

  it('marks the overlong count as a proxy and the other two as measurements', async () => {
    const view = await transcriptView('vitasilk');
    const by = Object.fromEntries(view.questions.map((q) => [q.id, q.proxy]));
    expect(by['overlong']).toBe(true);
    expect(by['clipped']).toBe(false);
    expect(by['split-term']).toBe(false);
  });
});

/**
 * The user rules by looking, so each instance carries the measurement that put
 * it there rather than a description of the category.
 */
describe('the evidence behind each question', () => {
  it('gives an overlong word its length and the threshold', async () => {
    const view = await transcriptView('vitasilk');
    const instance = view.questions.find((q) => q.id === 'overlong')?.instances[0];
    expect(instance?.text).toBe('matrddadich');
    expect(instance?.detail).toContain('11 characters');
    expect(instance?.detail).toContain('clipped');
  });

  it('gives a clipped card the Build pane’s own sentence', async () => {
    const view = await transcriptView('vitasilk');
    const instance = view.questions.find((q) => q.id === 'clipped')?.instances[0];
    expect(instance?.detail).toMatch(/long but .* needs .*s \(intro/);
    expect(instance?.detail).toContain('short by');
  });

  it('shows a split term whole, then the cards it is broken into', async () => {
    const view = await transcriptView('test-1');
    const instances = view.questions.find((q) => q.id === 'split-term')?.instances ?? [];
    // The term ORTHOGRAPHY_GUIDE §6 names verbatim, broken across three cards.
    const term = instances.find((i) => i.text === 'تحفيز طبيعي للكولاجين');
    expect(term).toBeDefined();
    expect(term?.parts).toHaveLength(3);
    expect(term?.parts?.map((p) => p.text)).toEqual(['تحفيز', 'طبيعي', 'للكولاجين']);
    expect(term?.detail).toContain('3 cards');
  });

  it('has an instance for every counted item', async () => {
    for (const reel of ['ground-truth', 'test-1', 'test-2', 'test-3', 'vitasilk']) {
      const view = await transcriptView(reel);
      for (const question of view.questions) {
        expect(question.instances.length, `${reel}/${question.id}`).toBe(question.count);
      }
    }
  });
});

describe('editing', () => {
  function scratchPlan(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-transcript-'));
    const to = path.join(dir, 'vitasilk.editplan.json');
    copyFileSync(path.join(FOOTAGE, 'vitasilk.editplan.json'), to);
    return to;
  }

  it('sets the edited flag, which is what protects the work on a re-run', async () => {
    const planPath = scratchPlan();
    await editWord({ planPath, wordId: 'w0000', text: 'cinq' });
    const plan = await readEditPlan(planPath);
    const word = plan.transcript.words.find((w) => w.id === 'w0000');
    expect(word?.text).toBe('cinq');
    expect(word?.edited).toBe(true);
  });

  it('never changes word ids or their order', async () => {
    const planPath = scratchPlan();
    const before = (await readEditPlan(planPath)).transcript.words.map((w) => w.id);
    await editWord({ planPath, wordId: 'w0005', text: 'changed' });
    const after = (await readEditPlan(planPath)).transcript.words.map((w) => w.id);
    expect(after).toEqual(before);
  });

  it('refuses to empty a word, and says what to do instead', async () => {
    const planPath = scratchPlan();
    await expect(editWord({ planPath, wordId: 'w0000', text: '  ' })).rejects.toThrow(
      /removed instead/,
    );
  });

  it('restores a removed word and clears its reason', async () => {
    const planPath = scratchPlan();
    const plan = await readEditPlan(planPath);
    const target = plan.transcript.words[3];
    if (target === undefined) throw new Error('fixture has no fourth word');
    target.removed = true;
    target.removedReason = 'filler';
    const { writeEditPlan } = await import('./editplan/io.js');
    await writeEditPlan(planPath, plan);

    await editWord({ planPath, wordId: target.id, restore: true });
    const after = (await readEditPlan(planPath)).transcript.words.find((w) => w.id === target.id);
    expect(after?.removed).toBe(false);
    expect(after?.removedReason).toBeNull();
    expect(after?.edited).toBe(true);
  });

  /*
   * Word timings are what was said and when. A card's display window is a
   * separate decision, and adjusting one must not rewrite the other.
   */
  it('changes a card’s display window and leaves the word timings alone', async () => {
    const planPath = scratchPlan();
    const before = await readEditPlan(planPath);
    const card = before.subtitles.groups[0];
    if (card === undefined) throw new Error('fixture has no cards');
    const wordTimings = before.transcript.words.map((w) => [w.start, w.end]);

    await editCard({ planPath, cardId: card.id, displayStart: 0.1, displayEnd: 0.9 });

    const after = await readEditPlan(planPath);
    const updated = after.subtitles.groups.find((g) => g.id === card.id);
    expect(updated?.displayStart).toBe(0.1);
    expect(updated?.displayEnd).toBe(0.9);
    expect(after.transcript.words.map((w) => [w.start, w.end])).toEqual(wordTimings);
  });

  it('refuses a card that would end before it starts', async () => {
    const planPath = scratchPlan();
    const card = (await readEditPlan(planPath)).subtitles.groups[0];
    await expect(
      editCard({ planPath, cardId: card?.id ?? '', displayStart: 2, displayEnd: 1 }),
    ).rejects.toThrow(/end after it starts/);
  });

  it('refuses an unknown word and an unknown card by name', async () => {
    const planPath = scratchPlan();
    await expect(editWord({ planPath, wordId: 'w9999', text: 'x' })).rejects.toThrow('w9999');
    await expect(
      editCard({ planPath, cardId: 'g9999', displayStart: 0, displayEnd: 1 }),
    ).rejects.toThrow('g9999');
  });

  it('spends nothing: an edit is a local write', async () => {
    const before = readFileSync(LEDGER, 'utf8');
    const planPath = scratchPlan();
    await editWord({ planPath, wordId: 'w0000', text: 'edited' });
    expect(readFileSync(LEDGER, 'utf8')).toBe(before);
  });

  /*
   * An edit that changes text changes `hashTranscript`, which is the analysis
   * cache key — so a later run misses and bills. The panel says this before he
   * types; this pins that the warning is true.
   */
  it('changes the transcript hash when the text changes, and says so up front', async () => {
    const planPath = scratchPlan();
    const { transcriptViewForPlan } = await import('./transcript-view.js');
    const before = await transcriptViewForPlan(planPath);
    expect(before.editCost).toContain('miss');

    const { word, hash } = await editWord({ planPath, wordId: 'w0000', text: 'cinq' });
    expect(word.edited).toBe(true);
    // The warning on screen is only true if this actually moves.
    expect(hash).not.toBe(before.transcriptHash);

    // And a timing edit does not, which is the other half of the sentence.
    const card = before.cards[0];
    if (card === undefined) throw new Error('fixture has no cards');
    await editCard({ planPath, cardId: card.id, displayStart: 0.1, displayEnd: 0.9 });
    expect((await transcriptViewForPlan(planPath)).transcriptHash).toBe(hash);
  });
});
