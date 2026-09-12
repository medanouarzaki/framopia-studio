import { describe, expect, it } from 'vitest';
import type { ClientMode } from '@framopia/core';
import {
  composeNegativePrompt,
  composePrompt,
  drawVariation,
  FALLBACK_MIN_PICTURE_LIFE_S,
  planSlots,
} from './slot-select.js';
import { imageSlotCountFor } from './count.js';
import type { AnalysisWord } from './types.js';

const mode = (): ClientMode =>
  ({
    id: 'k2-syndicalia',
    name: 'K2 Syndicalia',
    version: 2,
    palette: { background: '#1A0000', primary: '#820000', accent: '#C9A96E', light: '#F8F6F2' },
    fonts: { status: 'tbd', note: 'n' },
    imageStyle: {
      stylePrompt: ['a single clear idea', 'dominant palette of {{palette.primary}}'],
      negativePrompt: ['no background clutter', 'nothing in frame that is not carrying the idea'],
    },
    imageVariation: {
      note: 'n',
      axes: {
        composition: ['centred', 'off-centre', 'low in frame', 'edge to edge'],
        lighting: ['hard', 'soft', 'rim', 'flat'],
        crop: ['wide', 'medium', 'close', 'macro'],
      },
    },
    allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
    vocabulary: [],
  }) satisfies ClientMode;

// A 20s reel, one word per second.
const words: AnalysisWord[] = Array.from({ length: 20 }, (_, i) => ({
  id: `w${i}`,
  text: `t${i}`,
  start: i,
  end: i + 0.5,
  removed: false,
}));

describe('imageSlotCountFor', () => {
  /* 8 per 30 s since 2026-08-29, amending §5's band of 5–6. */
  it('gives the declared density at exactly 30 s', () => {
    expect(imageSlotCountFor(30)).toBe(8);
  });

  it('scales pro-rata and floors at one', () => {
    expect(imageSlotCountFor(60)).toBe(16);
    expect(imageSlotCountFor(0)).toBe(1);
    expect(imageSlotCountFor(1)).toBe(1);
  });

  it('gives the five real reels the counts they will run with', () => {
    expect(imageSlotCountFor(21.187833)).toBe(6);
    expect(imageSlotCountFor(21.988646)).toBe(6);
    expect(imageSlotCountFor(22.322313)).toBe(6);
    expect(imageSlotCountFor(23.256567)).toBe(6);
    expect(imageSlotCountFor(25.692333)).toBe(7);
  });

  it('rejects a duration that cannot be scaled', () => {
    expect(() => imageSlotCountFor(-1)).toThrow(RangeError);
    expect(() => imageSlotCountFor(Number.NaN)).toThrow(RangeError);
  });
});

describe('drawVariation', () => {
  it('is deterministic for the same plan and slot', () => {
    expect(drawVariation(mode(), 'plan-a', 0)).toEqual(drawVariation(mode(), 'plan-a', 0));
  });

  it('never gives consecutive slots the same value on an axis', () => {
    for (let i = 0; i < 12; i += 1) {
      const a = drawVariation(mode(), 'plan-a', i);
      const b = drawVariation(mode(), 'plan-a', i + 1);
      for (const axis of Object.keys(a)) expect(a[axis]).not.toBe(b[axis]);
    }
  });

  it('walks the whole axis rather than alternating between two values', () => {
    const seen = new Set(
      Array.from({ length: 4 }, (_, i) => drawVariation(mode(), 'plan-a', i).crop),
    );
    expect(seen.size).toBe(4);
  });

  it('does not repeat the first draw when the slots outrun the axis', () => {
    // vitasilk has five slots against four values per axis. Without the
    // per-cycle bump slot 4 came out identical to slot 0 on every axis.
    const first = drawVariation(mode(), 'plan-a', 0);
    const wrapped = drawVariation(mode(), 'plan-a', 4);
    expect(JSON.stringify(wrapped)).not.toBe(JSON.stringify(first));
  });

  it('keeps consecutive slots distinct across the wrap, for many slots', () => {
    for (let i = 0; i < 30; i += 1) {
      const a = drawVariation(mode(), 'plan-a', i);
      const b = drawVariation(mode(), 'plan-a', i + 1);
      for (const axis of Object.keys(a)) expect(a[axis]).not.toBe(b[axis]);
    }
  });

  it('draws differently for a different plan', () => {
    const a = Array.from({ length: 4 }, (_, i) => JSON.stringify(drawVariation(mode(), 'plan-a', i)));
    const b = Array.from({ length: 4 }, (_, i) => JSON.stringify(drawVariation(mode(), 'plan-b', i)));
    expect(a).not.toEqual(b);
  });
});

describe('composePrompt', () => {
  it('puts the idea first, then the invariant style, then the variation', () => {
    const prompt = composePrompt(mode(), 'a bottle on a plinth', { crop: 'close' });
    expect(prompt).toBe(
      'a bottle on a plinth. a single clear idea. dominant palette of #820000. close.',
    );
  });

  it('never doubles terminal punctuation or whitespace', () => {
    const prompt = composePrompt(mode(), 'A stopwatch showing five minutes.', {
      crop: 'close, filling the frame ',
      lighting: '  hard directional light,',
    });
    expect(prompt).not.toMatch(/[.,;:]{2}/);
    expect(prompt).not.toMatch(/\s{2}/);
    expect(prompt).not.toMatch(/\s[.,;:]/);
    expect(prompt.endsWith('.')).toBe(true);
    expect(prompt).toContain('A stopwatch showing five minutes. a single clear idea');
  });

  it('drops a fragment that is only punctuation or whitespace', () => {
    expect(composePrompt(mode(), '.', { crop: '   ' })).toBe(
      'a single clear idea. dominant palette of #820000.',
    );
  });

  it('resolves the palette from mode data, never from a literal', () => {
    expect(composePrompt(mode(), 'x', {})).toContain('#820000');
  });

  // `no text` left the globals at Block 4 session 5: it never worked as a
  // control and text is now checked after the fact instead.
  it('adds the global negatives to the mode ones', () => {
    expect(composeNegativePrompt(mode())).toBe(
      'no background clutter, nothing in frame that is not carrying the idea, no watermark, no logo',
    );
  });
});

describe('planSlots', () => {
  const plan = (candidates: { wordIds: string[]; idea: string }[], requestedCount = 4) =>
    planSlots({ candidates, words, mode: mode(), planId: 'plan-a', requestedCount, durationS: 20 });

  /**
   * **Spread was a grid and is now the pictures' own lives.**
   *
   * The reel was divided into `requestedCount` equal windows with at most one
   * slot in each. Block 12 session 87 measured that grid refusing legitimate
   * placements on `sora-1`: ترطيب and Profhilo fell in the same 1.28-second cell
   * while other cells stood empty, and the second was dropped for the arithmetic
   * of the grid rather than for anything a viewer would see. This asserted the
   * grid, so it asserts what replaced it.
   */
  it('keeps every picture that lives long enough, wherever it falls', () => {
    const result = plan(
      [
        { wordIds: ['w0'], idea: 'first' },
        { wordIds: ['w1'], idea: 'a second later' },
        { wordIds: ['w6'], idea: 'second' },
        { wordIds: ['w11'], idea: 'third' },
        { wordIds: ['w16'], idea: 'fourth' },
      ],
      5,
    );
    /*
     * The words are a second apart, comfortably above the 0.4s floor, so none is
     * refused for pacing, and the reel can afford all five. Two of them share the
     * opening stretch and **both are still bought** — that is the session 87
     * property, and what killed the old grid was refusing one of a close pair
     * while money went unspent, not the closeness itself.
     */
    expect(result.slots.map((s) => s.idea)).toEqual([
      'first',
      'a second later',
      'second',
      'third',
      'fourth',
    ]);
    expect(result.failures).toEqual([]);
  });

  /**
   * The same five ideas, with the money for only four of them.
   *
   * This used to keep the first four and go dark for the last nine seconds of a
   * twenty-second reel. Since Mohamed's ruling of 2026-09-11 the four are spread
   * instead, and the one dropped is the weaker of the pair that share a stretch
   * — 'a second later', not 'fourth'. The count is identical either way.
   */
  it('drops the weaker of a crowded pair rather than the whole second half', () => {
    const result = plan([
      { wordIds: ['w0'], idea: 'first' },
      { wordIds: ['w1'], idea: 'a second later' },
      { wordIds: ['w6'], idea: 'second' },
      { wordIds: ['w11'], idea: 'third' },
      { wordIds: ['w16'], idea: 'fourth' },
    ]);
    expect(result.slots.map((s) => s.idea)).toEqual(['first', 'second', 'third', 'fourth']);
    expect(result.failures.map((f) => f.reason)).toEqual(['budget-spent']);
  });

  it('rejects a slot that overlaps one already taken', () => {
    const result = plan([
      { wordIds: ['w0', 'w1', 'w2'], idea: 'wide' },
      { wordIds: ['w1'], idea: 'inside it' },
      { wordIds: ['w10'], idea: 'later' },
    ]);
    expect(result.failures.some((f) => f.reason === 'overlaps-a-selected-slot')).toBe(true);
    expect(result.slots.map((s) => s.idea)).toEqual(['wide', 'later']);
  });

  /**
   * **A picture may not leave before its entrance has finished playing.**
   *
   * The floor used to be 0.5s between the end of one word span and the start of
   * the next, "chosen, not measured". It is now the templates' authored
   * entrance, measured between two picture *starts* — which is what a viewer
   * experiences, because a picture holds until the next arrives.
   */
  it('refuses a picture that would replace one before its entrance has played', () => {
    /* Short spans, so the two do not overlap and only the life floor decides. */
    const tight: AnalysisWord[] = [
      { id: 'a', text: 'a', start: 0, end: 0.1, removed: false },
      { id: 'b', text: 'b', start: FALLBACK_MIN_PICTURE_LIFE_S / 2, end: 0.3, removed: false },
    ];
    const result = planSlots({
      candidates: [
        { wordIds: ['a'], idea: 'one' },
        { wordIds: ['b'], idea: 'two' },
      ],
      words: tight,
      mode: mode(),
      planId: 'p',
      requestedCount: 2,
      durationS: 20,
    });
    expect(result.slots).toHaveLength(1);
    expect(result.failures[0]?.reason).toBe('too-close');
  });

  /* Exactly the entrance is enough: the picture is fully arrived when it goes. */
  it('keeps a picture that lives exactly as long as its entrance', () => {
    const tight: AnalysisWord[] = [
      { id: 'a', text: 'a', start: 0, end: 0.2, removed: false },
      { id: 'b', text: 'b', start: FALLBACK_MIN_PICTURE_LIFE_S, end: 0.8, removed: false },
    ];
    const result = planSlots({
      candidates: [
        { wordIds: ['a'], idea: 'one' },
        { wordIds: ['b'], idea: 'two' },
      ],
      words: tight,
      mode: mode(),
      planId: 'p',
      requestedCount: 2,
      durationS: 20,
    });
    expect(result.slots).toHaveLength(2);
  });

  /* The floor is the templates', not a constant here: a caller may state it. */
  it('takes the minimum life from the caller', () => {
    const tight: AnalysisWord[] = [
      { id: 'a', text: 'a', start: 0, end: 0.2, removed: false },
      { id: 'b', text: 'b', start: 0.6, end: 0.8, removed: false },
    ];
    const args = {
      candidates: [
        { wordIds: ['a'], idea: 'one' },
        { wordIds: ['b'], idea: 'two' },
      ],
      words: tight,
      mode: mode(),
      planId: 'p',
      requestedCount: 2,
      durationS: 20,
    };
    expect(planSlots({ ...args, minPictureLifeS: 0.5 }).slots).toHaveLength(2);
    expect(planSlots({ ...args, minPictureLifeS: 1.0 }).slots).toHaveLength(1);
  });

  it('drops an unresolvable slot and counts it, never fuzzy-matching', () => {
    const result = plan([
      { wordIds: ['w99'], idea: 'ghost' },
      { wordIds: ['w5'], idea: 'real' },
    ]);
    expect(result.slots.map((s) => s.idea)).toEqual(['real']);
    expect(result.failures[0]?.reason).toBe('unknown-word-id');
  });

  it('rejects an empty id list', () => {
    expect(plan([{ wordIds: [], idea: 'nothing' }]).failures[0]?.reason).toBe('empty-word-ids');
  });

  /* Fewer pictures than asked for is still reported, so it cannot go silent. */
  it('reports a shortfall when fewer candidates arrive than were asked for', () => {
    const result = plan([{ wordIds: ['w0'], idea: 'the only one' }]);
    expect(result.slots).toHaveLength(1);
    expect(result.shortfall).toBe(3);
  });

  it('reports gaps and uncovered time', () => {
    const result = plan([
      { wordIds: ['w0'], idea: 'a' },
      { wordIds: ['w6'], idea: 'b' },
    ]);
    expect(result.gaps).toEqual([5.5]);
    expect(result.uncoveredS).toBeCloseTo(19, 10);
  });

  /**
   * **The order candidates arrive in stopped being noise on 2026-09-11.**
   *
   * This used to reverse the array and assert nothing moved. The array is now
   * the model's own ranking — the slot prompt asks it for the strongest first —
   * so reversing it is not a no-op any more: it hands a contested stretch to the
   * other candidate on purpose. What is still guaranteed, and what a rerun of a
   * plan depends on, is that the same input gives the same output every time.
   */
  it('is deterministic: same candidates, same plan, same slots and prompts', () => {
    const candidates = [
      { wordIds: ['w0'], idea: 'a' },
      { wordIds: ['w6'], idea: 'b' },
      { wordIds: ['w11'], idea: 'c' },
    ];
    expect(JSON.stringify(plan(candidates))).toBe(JSON.stringify(plan(candidates)));
  });

  it('does not care whether a span is also a keyword', () => {
    // Images are independent of keywords per PROJECT_SPEC §5, so the planner
    // is never told about them: nothing here can prefer or exclude one.
    const result = plan([{ wordIds: ['w0'], idea: 'a' }]);
    expect(result.slots[0]?.wordIds).toEqual(['w0']);
  });
});

/**
 * **The density is a budget in money, and free pictures do not spend from it.**
 *
 * `imageSlotCountFor` is Mohamed's ruling of 2026-08-29 at eight per thirty
 * seconds, and what it limits is generated images: about $0.17 each, and a reel
 * that flashes one every second is unwatchable. Block 12 session 86: `sora-1` is
 * 10.2 seconds so the budget was three, the model proposed eight good slots, and
 * three were kept — **two of them answered from the client's own store**, so the
 * reel spent one of its three paid pictures and dropped five candidates. A
 * picture that costs nothing was crowding out one that would have been bought.
 */
describe('what the picture budget actually limits', () => {
  const word = (id: string, text: string, start: number): AnalysisWord =>
    ({ id, text, start, end: start + 0.3 }) as AnalysisWord;

  const modeWith = (labels: [string, string][]): ClientMode =>
    ({
      ...mode(),
      pictures: labels.map(([id, label]) => ({
        id,
        path: `/p/${id}.jpg`,
        description: '',
        label,
      })),
    }) as ClientMode;

  /* Six candidates two seconds apart, so spacing never decides anything here. */
  const words: AnalysisWord[] = [];
  const candidates: SlotCandidate[] = [];
  for (let i = 0; i < 6; i += 1) {
    const id = `w${i}`;
    words.push(word(id, i % 2 === 0 ? 'Profhilo' : `thing${i}`, i * 2));
    candidates.push({ wordIds: [id], idea: `a picture of ${i}` });
  }

  it('spends the budget only on the pictures it has to buy', () => {
    const out = planSlots({
      candidates,
      words,
      mode: modeWith([['pic1', 'profhilo']]),
      planId: 'p',
      requestedCount: 2,
      durationS: 12,
    });
    const bought = out.slots.filter(
      (s) => !s.wordIds.some((id) => words.find((w) => w.id === id)?.text === 'Profhilo'),
    );
    expect(bought).toHaveLength(2);
    // And the free ones are extra, not instead.
    expect(out.slots.length).toBeGreaterThan(2);
  });

  /**
   * **However many candidates arrive, the reel never buys more than its budget.**
   *
   * `budget-spent` is the last of the four refusals and it is hard to reach on
   * purpose: the windows are sized over everything placeable, the free slots
   * take their own windows, and a paid candidate competing for one of those is
   * refused as `window-taken` before the money is ever consulted. It is kept as
   * the belt to those braces, and what is asserted here is the property it
   * exists for, which no arrangement of candidates may break.
   */
  it('never buys more pictures than the budget, whatever arrives', () => {
    for (const requestedCount of [1, 2, 3]) {
      const out = planSlots({
        candidates,
        words,
        mode: modeWith([['pic1', 'profhilo']]),
        planId: 'p',
        requestedCount,
        durationS: 12,
      });
      const bought = out.slots.filter(
        (s) => !s.wordIds.some((id) => words.find((w) => w.id === id)?.text === 'Profhilo'),
      );
      expect(`${requestedCount}: ${bought.length <= requestedCount}`).toBe(
        `${requestedCount}: true`,
      );
    }
  });

  /*
   * **What the client already decided outranks an idea a model proposed**, and
   * costs nothing, so it is placed first and the budget fills what is left.
   * Without this, whichever moment came earlier in the reel simply won.
   */
  it('places the client’s own picture ahead of a paid idea competing for the seconds', () => {
    /* Closer than the 0.4s floor, so only one of the two can be placed. */
    const near: AnalysisWord[] = [word('a', 'thing', 0), word('b', 'Profhilo', 0.2)];
    const out = planSlots({
      candidates: [
        { wordIds: ['a'], idea: 'the model’s idea' },
        { wordIds: ['b'], idea: 'the product' },
      ],
      words: near,
      mode: modeWith([['pic1', 'profhilo']]),
      planId: 'p',
      requestedCount: 3,
      durationS: 4,
    });
    expect(out.slots.map((s) => s.wordIds[0])).toEqual(['b']);
  });

  /**
   * **Money already spent is not spent again.** Re-planning dropped the slot
   * holding the two candidates session 84 paid for and Mohamed approved,
   * because a new idea landed within the spacing floor of it.
   */
  it('keeps a span this reel has already bought a picture for', () => {
    /* Closer than the 0.4s floor, so only one of the two can be placed. */
    const near: AnalysisWord[] = [word('a', 'thing', 0), word('b', 'other', 0.2)];
    const out = planSlots({
      candidates: [
        { wordIds: ['a'], idea: 'a new idea' },
        { wordIds: ['b'], idea: 'the one already paid for' },
      ],
      words: near,
      mode: modeWith([]),
      planId: 'p',
      requestedCount: 3,
      durationS: 4,
      alreadyBought: ['b'],
    });
    expect(out.slots.map((s) => s.wordIds[0])).toEqual(['b']);
  });

  /**
   * **A span already bought is never bought again, and never enlarges the reel.**
   *
   * This asserted only the first half, and read `toBeGreaterThan(1)` — a reel
   * with a budget of one ending up with more than one picture. Block 12 session
   * 90 measured where that leads: re-planning `sora-2`, every one of whose seven
   * pictures was already bought, produced **twelve slots against a budget of
   * six**, and a second re-plan would have gone further. Mohamed's ruling of
   * 2026-08-29 caps the count and his ruling of 2026-09-11 says the count is
   * exactly what does not change.
   *
   * The two rulings this reconciles are both his and they pull opposite ways —
   * the report of session 90 puts the choice back to him. What is asserted here
   * is the cap: the bought span wins the place, so no money is spent, and the
   * reel does not grow.
   */
  it('never buys a span twice, and never lets it enlarge the reel', () => {
    const out = planSlots({
      candidates,
      words,
      mode: modeWith([]),
      planId: 'p',
      requestedCount: 1,
      durationS: 12,
      alreadyBought: ['w0', 'w2'],
    });
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]?.wordIds).toEqual(['w0']);
  });
});

/**
 * **A picture already bought is found by the words it was bought for, not by an
 * identical span.**
 *
 * Block 12 session 87 asked the model for more ideas and it returned `["w0011"]`
 * where it had returned `["w0010","w0011"]` — the same product, one word shorter.
 * The exact-span match missed it, two pictures already paid for were bought a
 * second time, and the session went over its ceiling. The same moment described
 * by a shorter span is the same moment.
 */
describe('a bought picture whose span the model re-described', () => {
  const words: AnalysisWord[] = [
    { id: 'w0', text: 'khaskek', start: 0, end: 0.3, removed: false },
    { id: 'w1', text: 'Pluryal', start: 0.4, end: 0.9, removed: false },
    { id: 'w2', text: 'other', start: 4, end: 4.5, removed: false },
  ];

  it('is still free when the new span is shorter than the bought one', () => {
    const out = planSlots({
      candidates: [
        { wordIds: ['w1'], idea: 'the product, re-spanned' },
        { wordIds: ['w2'], idea: 'something else' },
      ],
      words,
      mode: mode(),
      planId: 'p',
      requestedCount: 1,
      durationS: 10,
      alreadyBought: ['w0 w1'],
    });
    /*
     * The re-spanned one is recognised as the same moment and keeps the reel's
     * one place, so nothing is bought. It used to be placed *as well*, which is
     * how a re-plan doubled `sora-2` past its cap (session 90).
     */
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]?.wordIds).toEqual(['w1']);
  });

  it('is still free when the new span is longer than the bought one', () => {
    const out = planSlots({
      candidates: [
        { wordIds: ['w0', 'w1'], idea: 'the product, widened' },
        { wordIds: ['w2'], idea: 'something else' },
      ],
      words,
      mode: mode(),
      planId: 'p',
      requestedCount: 1,
      durationS: 10,
      alreadyBought: ['w1'],
    });
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]?.wordIds).toEqual(['w0', 'w1']);
  });

  it('does not make an unrelated span free', () => {
    const out = planSlots({
      candidates: [{ wordIds: ['w2'], idea: 'unrelated' }],
      words,
      mode: mode(),
      planId: 'p',
      requestedCount: 0,
      durationS: 10,
      alreadyBought: ['w0 w1'],
    });
    expect(out.slots).toEqual([]);
  });
});

/**
 * **One weak idea must not kill the reel.**
 *
 * Block 12 session 89: Mohamed ran `sora-2`, the model returned twelve ideas,
 * **eleven were fine** and the seventh was "Assortment of vitamin pills". The run
 * stopped, nothing was built, and the transcription he had just paid $0.1479 for
 * led nowhere.
 *
 * The rule is unchanged — that idea does not become a picture. What changed is
 * that `planSlots` drops it and names it instead of throwing, so a caller that
 * cannot ask the model again still gets a reel with one picture fewer.
 */
describe('an idea that names more than one thing', () => {
  const words: AnalysisWord[] = Array.from({ length: 6 }, (_, i) => ({
    id: `w${i}`,
    text: `t${i}`,
    start: i * 2,
    end: i * 2 + 0.5,
    removed: false,
  }));

  /*
   * `checkSlotIdea` only applies when the mode actually asks for one subject —
   * a mode that never says so has not made the claim. Dr Loubna Kfafi's does,
   * which is why `sora-2` was refused, so this fixture says it too.
   */
  const asksForOneSubject = (): ClientMode =>
    ({
      ...mode(),
      imageStyle: {
        ...mode().imageStyle,
        stylePrompt: ['one subject, centred and unobstructed', 'a single clear idea'],
      },
    }) as ClientMode;

  const plan = (candidates: { wordIds: string[]; idea: string }[]) =>
    planSlots({
      candidates,
      words,
      mode: asksForOneSubject(),
      planId: 'p',
      requestedCount: 4,
      durationS: 12,
    });

  it('does not stop the other ideas becoming pictures', () => {
    const result = plan([
      { wordIds: ['w0'], idea: 'a single clear thing' },
      { wordIds: ['w2'], idea: 'Assortment of vitamin pills' },
      { wordIds: ['w4'], idea: 'another single thing' },
    ]);
    expect(result.slots.map((s) => s.idea)).toEqual(['a single clear thing', 'another single thing']);
  });

  it('names the idea and the word that broke it', () => {
    const result = plan([{ wordIds: ['w0'], idea: 'Assortment of vitamin pills' }]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.idea).toBe('Assortment of vitamin pills');
    expect(result.rejected[0]?.marker).toBe('assortment');
  });

  it('reports it as a refusal like every other, not as a silence', () => {
    const result = plan([{ wordIds: ['w0'], idea: 'Assortment of vitamin pills' }]);
    expect(result.failures.map((f) => f.reason)).toContain('more-than-one-subject');
  });

  /* Every idea unusable is a reel with no pictures, not a reel that never built. */
  it('returns a usable result even when every idea is refused', () => {
    const result = plan([
      { wordIds: ['w0'], idea: 'Assortment of pills' },
      { wordIds: ['w2'], idea: 'A selection of things' },
    ]);
    expect(result.slots).toEqual([]);
    expect(result.rejected).toHaveLength(2);
  });

  it('says nothing was rejected when every idea is one thing', () => {
    expect(plan([{ wordIds: ['w0'], idea: 'a single clear thing' }]).rejected).toEqual([]);
  });
});

/**
 * **Mohamed, 2026-09-11, having watched `sora-2`: spread the pictures across
 * the whole video, and choose the most important ones.**
 *
 * He liked the reel and named one fault — every picture was in the first half,
 * and the last one sat on screen for 13.30 s, 57% of it. The budget was being
 * spent front to back, so a reel with more good candidates than it can afford
 * ran out of money before it reached its own second half. The count is not what
 * he changed and it is not what these assert: `IMAGE_SLOTS_PER_30S` is still his
 * ruling of 2026-08-29. Only where the pictures land.
 */
describe('where a reel spends its picture budget', () => {
  const at = (id: string, start: number): AnalysisWord =>
    ({ id, text: id, start, end: start + 0.3, removed: false }) as AnalysisWord;

  /*
   * Four candidates crowded into the opening four seconds and three spread over
   * the rest. In the order the model returned them the crowded four come first,
   * which is exactly the shape that used to eat the whole budget.
   */
  const spread = {
    words: [0, 1, 2, 3, 6, 11, 16].map((s, i) => at(`w${i}`, s)),
    candidates: [0, 1, 2, 3, 6, 11, 16].map((_, i) => ({
      wordIds: [`w${i}`],
      idea: `idea ${i}`,
    })),
  };

  it('puts a picture in each quarter of the reel rather than four in the first', () => {
    const out = planSlots({
      ...spread,
      mode: mode(),
      planId: 'p',
      requestedCount: 4,
      durationS: 20,
    });
    const quarters = out.slots.map((s) => Math.floor(s.start / 5)).sort();
    expect(quarters).toEqual([0, 1, 2, 3]);
  });

  /*
   * Two moments inside one stretch, and the measure that separates them is the
   * model's own: the slot prompt asks for the strongest first, so the order it
   * replied in is the ranking. Nothing here is scored by us.
   */
  it('keeps the model’s strongest candidate when two share a stretch', () => {
    const out = planSlots({
      ...spread,
      mode: mode(),
      planId: 'p',
      requestedCount: 4,
      durationS: 20,
    });
    expect(out.slots.map((s) => s.idea)).toContain('idea 0');
    expect(out.slots.map((s) => s.idea)).not.toContain('idea 1');
  });

  /*
   * A stretch with nothing in it must not take its money to the grave. Here
   * every candidate is in the opening quarter, and the reel still buys four.
   */
  it('spends a stretch’s unused money elsewhere rather than losing it', () => {
    const out = planSlots({
      words: spread.words.slice(0, 4),
      candidates: spread.candidates.slice(0, 4),
      mode: mode(),
      planId: 'p',
      requestedCount: 4,
      durationS: 20,
    });
    expect(out.slots).toHaveLength(4);
  });
});

/**
 * **Mohamed, 2026-09-12: a picture bought for a client is that client's, and is
 * used again automatically when the same thing is named in another of their
 * videos.**
 *
 * The budget exists to limit what is **bought**. A picture already paid for is
 * not bought, so it is counted with the client's own photographs — session 86's
 * reasoning, applied to the same kind of thing.
 */
describe('an idea this client has already paid for', () => {
  const words: AnalysisWord[] = [0, 2, 4, 6].map((s, i) => ({
    id: `w${i}`,
    text: `t${i}`,
    start: s,
    end: s + 0.3,
    removed: false,
  }));
  const candidates = words.map((w, i) => ({ wordIds: [w.id], idea: `idea ${i}` }));

  const plan = (ownedIdeas?: ReadonlySet<string>) =>
    planSlots({
      candidates,
      words,
      mode: mode(),
      planId: 'p',
      requestedCount: 2,
      durationS: 8,
      ...(ownedIdeas === undefined ? {} : { ownedIdeas }),
    });

  it('does not spend the budget, so the reel buys its full count as well', () => {
    const withoutStore = plan();
    const withStore = plan(new Set(['idea 0']));
    expect(withoutStore.slots).toHaveLength(2);
    expect(withStore.slots.length).toBeGreaterThan(withoutStore.slots.length);
  });

  it('is placed as well as the pictures the budget buys, not instead of one', () => {
    const out = plan(new Set(['idea 0']));
    expect(out.slots.map((s) => s.idea)).toContain('idea 0');
    /* Two bought on top of the free one. */
    expect(out.slots).toHaveLength(3);
  });

  it('is matched on the whole idea, not on a word inside it', () => {
    const out = plan(new Set(['idea']));
    expect(out.slots).toHaveLength(2);
  });

  it('changes nothing when the client owns nothing', () => {
    expect(JSON.stringify(plan(new Set()))).toBe(JSON.stringify(plan()));
  });
});
