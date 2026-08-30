import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KEYWORD_FONT_SIZE, REPO_ROOT, SUBTITLE_FONT_SIZE } from '@framopia/core';
import {
  addKeyword,
  keywordsView,
  keywordsViewForPlan,
  KeywordViewError,
  removeKeyword,
} from './keyword-view.js';
import { readEditPlan } from './editplan/io.js';
import { humanFlaggedItems } from './editplan/merge.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');
const LEDGER = path.join(REPO_ROOT, '.local', 'costs.jsonl');

function scratch(reel = 'vitasilk'): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-keywords-'));
  const to = path.join(dir, `${reel}.editplan.json`);
  copyFileSync(path.join(FOOTAGE, `${reel}.editplan.json`), to);
  return to;
}

describe('keywordsView', () => {
  it('returns the keywords the analysis chose', async () => {
    const view = await keywordsView('vitasilk');
    expect(view.keywords.map((k) => k.text)).toEqual(['7rir', 'filler glow', 'Vita Silk']);
  });

  it('gives each keyword its card, interval and reason', async () => {
    const view = await keywordsView('vitasilk');
    const keyword = view.keywords.find((k) => k.text === 'filler glow');
    expect(keyword?.cardId).toBe('g022');
    expect(keyword?.reason).toBe('names the specific product being promoted');
    expect(keyword?.kind).toBe('label');
  });

  /* The variant follows the script, which is what decides the font. */
  it('takes the Arabic keyword template for an Arabic keyword', async () => {
    const view = await keywordsView('test-1');
    expect(view.keywords.map((k) => k.script)).toEqual(['arabic', 'arabic']);
    expect(view.keywords.map((k) => k.templateId)).toEqual(['kw_slam_ar', 'kw_slam_ar']);
  });

  it('reports the frozen type sizes rather than the panel inventing them', async () => {
    const view = await keywordsView('vitasilk');
    expect(view.subtitleFontSize).toBe(SUBTITLE_FONT_SIZE);
    expect(view.keywordFontSize).toBe(KEYWORD_FONT_SIZE);
    expect(view.keywords.every((k) => k.fontSize === KEYWORD_FONT_SIZE)).toBe(true);
  });

  /*
   * Rewritten in session 22. The flat −20 dB and the +0.13 s offset are both
   * retired: gain is derived per file from its measured peak, and the layer
   * now starts **before** the keyword so `hit_01`'s anchor — 2.05 s into the
   * file — lands on the template's impact.
   */
  /*
   * The user removed the hits in Block 8 session 27 — he heard them on a built
   * reel and ruled that the sound fought the animation rather than supporting
   * it. No keyword template binds a sound, so the picker has none to show and
   * nothing to explain: there is no absence where there was never a binding.
   */
  it('shows no sound on any keyword, and no explanation for its absence', async () => {
    const view = await keywordsView('vitasilk');
    expect(view.keywords.length).toBeGreaterThan(0);
    for (const keyword of view.keywords) {
      expect(Object.keys(keyword), keyword.id).not.toContain('sfx');
      expect(Object.keys(keyword), keyword.id).not.toContain('sfxDroppedSinceS');
    }
  });

  it('leaves no sfx event pointing at a keyword', async () => {
    const plan = await readEditPlan(
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
    );
    const keywordIds = new Set(plan.keywords.items.map((k) => k.id));
    expect(plan.sfx.events.filter((e) => keywordIds.has(e.sourceElementId))).toEqual([]);
  });

  it('offers every unclaimed word for promotion, and no claimed one', async () => {
    const view = await keywordsView('vitasilk');
    const claimed = new Set(view.keywords.flatMap((k) => k.wordIds));
    expect(view.promotable).toHaveLength(73 - claimed.size);
    expect(view.promotable.some((w) => claimed.has(w.wordId))).toBe(false);
  });

  it('refuses a reel with no plan by name', async () => {
    await expect(keywordsView('nope')).rejects.toThrow(KeywordViewError);
  });
});

/**
 * A reel with no keywords must say **why**. "Analysis has not run" and "analysis
 * ran and chose none" are different facts, and an empty list states neither.
 */
describe('a reel with no keywords', () => {
  it('says the analysis has not run, and names the stage', async () => {
    // `ground-truth` was here until Block 10 session 6 planned its keywords.
    for (const reel of ['test-3']) {
      const view = await keywordsView(reel);
      expect(view.keywords, reel).toHaveLength(0);
      expect(view.emptyReason, reel).toContain('has not run');
      expect(view.emptyReason, reel).toContain('pending');
    }
  });

  it('says nothing at all when there are keywords', async () => {
    expect((await keywordsView('vitasilk')).emptyReason).toBeNull();
    // Planned fresh in Block 10 session 6, the first reel analysed under v12.
    expect((await keywordsView('ground-truth')).emptyReason).toBeNull();
    expect((await keywordsView('ground-truth')).keywords).toHaveLength(3);
  });

  it('names where the choice came from, whether or not there is one', async () => {
    for (const reel of ['vitasilk', 'test-3']) {
      const view = await keywordsView(reel);
      expect(view.source.promptVersion, reel).toBe(4);
      expect(view.source.mode, reel).toBe('auto');
      expect(typeof view.source.stageStatus, reel).toBe('string');
    }
  });
});

describe('removing a keyword', () => {
  it('drops it and clears the card’s supersession', async () => {
    const planPath = scratch();
    const before = await readEditPlan(planPath);
    const keyword = before.keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');
    const superseded = before.subtitles.groups.filter((g) => g.supersededBy === keyword.id);
    expect(superseded.length).toBeGreaterThan(0);

    const view = await removeKeyword({ planPath, keywordId: keyword.id });
    expect(view.keywords.some((k) => k.id === keyword.id)).toBe(false);

    const after = await readEditPlan(planPath);
    expect(after.subtitles.groups.some((g) => g.supersededBy === keyword.id)).toBe(false);
  });

  /* SFX is generated, never hand-authored: it is re-derived, not patched. */
  it('drops the hit that was bound to it', async () => {
    const planPath = scratch();
    const keyword = (await readEditPlan(planPath)).keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');

    await removeKeyword({ planPath, keywordId: keyword.id });
    const after = await readEditPlan(planPath);
    expect(after.sfx.events.some((e) => e.sourceElementId === keyword.id)).toBe(false);
  });

  it('refuses an unknown keyword by name', async () => {
    await expect(removeKeyword({ planPath: scratch(), keywordId: 'k999' })).rejects.toThrow(
      'k999',
    );
  });
});

describe('adding a keyword', () => {
  it('promotes a word and gives it the matching template', async () => {
    const planPath = scratch();
    const view = await addKeyword({ planPath, wordId: 'w0000' });
    const added = view.keywords.find((k) => k.wordIds.includes('w0000'));
    expect(added?.templateId).toBe('kw_slam');
    expect(added?.fontSize).toBe(KEYWORD_FONT_SIZE);
  });

  /*
   * SFX are still re-derived on an edit rather than patched, which is what
   * keeps them from drifting when the manifest moves — the keyword templates
   * bind nothing now, so what a promotion must produce is no event at all.
   */
  it('adds no sound with the keyword, the hits having been removed', async () => {
    const planPath = scratch();
    await addKeyword({ planPath, wordId: 'w0000' });
    const plan = await readEditPlan(planPath);
    const added = plan.keywords.items.find((k) => k.wordIds.includes('w0000'));
    expect(added).toBeDefined();
    expect(plan.sfx.events.some((e) => e.sourceElementId === added?.id)).toBe(false);
  });

  /*
   * `edited` is what `mergeIntoExistingPlan` refuses to discard: a transcript
   * change clears the keyword block, and `PlanMergeBlockedError` stops that when
   * a human has touched an item. The choice cannot be lost silently.
   */
  it('marks it edited, so a re-run cannot discard it silently', async () => {
    const planPath = scratch();
    await addKeyword({ planPath, wordId: 'w0000' });
    const plan = await readEditPlan(planPath);
    const added = plan.keywords.items.find((k) => k.wordIds.includes('w0000'));
    expect(added?.edited).toBe(true);
    expect(humanFlaggedItems(plan).some((f) => f.itemId === added?.id)).toBe(true);
  });

  it('records no reason, rather than inventing one the analysis never gave', async () => {
    const planPath = scratch();
    const view = await addKeyword({ planPath, wordId: 'w0000' });
    expect(view.keywords.find((k) => k.wordIds.includes('w0000'))?.reason).toBe('');
  });

  it('supersedes the card the word renders in', async () => {
    const planPath = scratch();
    const view = await addKeyword({ planPath, wordId: 'w0000' });
    const added = view.keywords.find((k) => k.wordIds.includes('w0000'));
    const plan = await readEditPlan(planPath);
    expect(plan.subtitles.groups.some((g) => g.supersededBy === added?.id)).toBe(true);
  });

  it('refuses a word that is already a keyword, and one that is removed', async () => {
    const planPath = scratch();
    const existing = (await readEditPlan(planPath)).keywords.items[0]?.wordIds[0] as string;
    await expect(addKeyword({ planPath, wordId: existing })).rejects.toThrow('already a keyword');

    const plan = await readEditPlan(planPath);
    const word = plan.transcript.words[2];
    if (word === undefined) throw new Error('fixture has no third word');
    word.removed = true;
    word.removedReason = 'filler';
    const { writeEditPlan } = await import('./editplan/io.js');
    await writeEditPlan(planPath, plan);
    await expect(addKeyword({ planPath, wordId: word.id })).rejects.toThrow('marked removed');
  });

  it('refuses an unknown word by name', async () => {
    await expect(addKeyword({ planPath: scratch(), wordId: 'w9999' })).rejects.toThrow('w9999');
  });

  it('round-trips: promote then remove leaves the plan as it was', async () => {
    const planPath = scratch();
    const before = await keywordsViewForPlan(planPath);
    const added = (await addKeyword({ planPath, wordId: 'w0000' })).keywords.find((k) =>
      k.wordIds.includes('w0000'),
    );
    const after = await removeKeyword({ planPath, keywordId: added?.id ?? '' });
    expect(after.keywords.map((k) => k.id)).toEqual(before.keywords.map((k) => k.id));
    expect(after.keywords.map((k) => k.sfx?.timeS)).toEqual(
      before.keywords.map((k) => k.sfx?.timeS),
    );
  });

  it('spends nothing: both edits are local writes', async () => {
    const ledger = readFileSync(LEDGER, 'utf8');
    const planPath = scratch();
    const view = await addKeyword({ planPath, wordId: 'w0000' });
    await removeKeyword({
      planPath,
      keywordId: view.keywords.find((k) => k.wordIds.includes('w0000'))?.id ?? '',
    });
    expect(readFileSync(LEDGER, 'utf8')).toBe(ledger);
  });
});

/**
 * Session 20 found removal unprotected: `edited: true` guards a keyword a human
 * added because there is an item to flag, and a deletion leaves nothing — so a
 * transcript change cleared the block and the analysis put the keyword straight
 * back. `keywords.removedWordIds` is the durable trace of that decision.
 */
describe('a removed keyword stays removed', () => {
  it('records the words it took off the list', async () => {
    const planPath = scratch();
    const keyword = (await readEditPlan(planPath)).keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');

    await removeKeyword({ planPath, keywordId: keyword.id });
    const plan = await readEditPlan(planPath);
    for (const wordId of keyword.wordIds) {
      expect(plan.keywords.removedWordIds).toContain(wordId);
    }
  });

  it('is named by humanFlaggedItems, so the merge refuses to discard it', async () => {
    const planPath = scratch();
    const keyword = (await readEditPlan(planPath)).keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');

    await removeKeyword({ planPath, keywordId: keyword.id });
    const flags = humanFlaggedItems(await readEditPlan(planPath));
    expect(flags.some((f) => f.detail === 'removed by a human')).toBe(true);
    expect(flags.map((f) => f.itemId)).toEqual(expect.arrayContaining(keyword.wordIds));
  });

  /*
   * The clear takes the machine's items and leaves the human's decisions. This
   * is the case that was silently losing work.
   */
  it('survives a transcript change clearing the keyword block', async () => {
    const planPath = scratch();
    const keyword = (await readEditPlan(planPath)).keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');
    await removeKeyword({ planPath, keywordId: keyword.id });

    const { mergeIntoExistingPlan } = await import('./editplan/merge.js');
    const existing = await readEditPlan(planPath);
    const fresh = await readEditPlan(planPath);
    // A transcript that has moved: enough to clear the dependent blocks.
    const firstWord = fresh.transcript.words[0];
    if (firstWord === undefined) throw new Error('fixture has no words');
    firstWord.start += 0.5;

    const merged = mergeIntoExistingPlan({ existing, fresh, force: true });
    expect(merged.cleared).toContain('keywords');
    expect(merged.plan.keywords.items).toHaveLength(0);
    for (const wordId of keyword.wordIds) {
      expect(merged.plan.keywords.removedWordIds).toContain(wordId);
    }
  });

  /*
   * The stage that would put it back is the one that has to honour it. Asserted
   * on the source rather than by running a billable analysis: the filter is one
   * line and a test that cannot run it should say which it is checking.
   */
  it('is filtered out by the analysis stage before it can be proposed again', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      fileURLToPath(new URL('./analysis/job.ts', import.meta.url)),
      'utf8',
    );
    expect(source).toContain('removedWordIds');
    expect(source).toContain('removed by hand and is not proposed again');
  });

  /* Promoting it back is the user changing their mind; the marker goes too. */
  it('clears the marker when the word is emphasised again', async () => {
    const planPath = scratch();
    const keyword = (await readEditPlan(planPath)).keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');
    const wordId = keyword.wordIds[0] as string;

    await removeKeyword({ planPath, keywordId: keyword.id });
    expect((await readEditPlan(planPath)).keywords.removedWordIds).toContain(wordId);

    await addKeyword({ planPath, wordId });
    expect((await readEditPlan(planPath)).keywords.removedWordIds ?? []).not.toContain(wordId);
  });

  it('opens a plan that has never had a removal, with the field absent', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'test 2.editplan.json'));
    expect(plan.keywords.removedWordIds).toBeUndefined();
  });
});
