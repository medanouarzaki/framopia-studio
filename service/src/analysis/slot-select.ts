import { createHash } from 'node:crypto';
import {
  checkSlotIdea,
  clientPictures,
  matchClientPicture,
  renderNegativePrompt,
  renderStylePrompt,
  type ClientMode,
  type IdeaIssue,
} from '@framopia/core';
import type { AnalysisWord } from './types.js';

/**
 * A slot every model call must clear before it reaches the plan. Nothing here
 * is asked of the model, because a model that forgets one produces a plan
 * that validates and builds wrong.
 */
export interface SlotCandidate {
  wordIds: string[];
  idea: string;
  /**
   * The one word in the span the picture is about, from prompt v3.
   *
   * Optional: absent means the model had nothing to point at, or the plan
   * predates v3, and the picture starts where its sentence starts.
   */
  nameWordId?: string;
}

export interface SlotFailure {
  candidate: SlotCandidate;
  reason:
    /** The idea named a group rather than a thing; the mode asks for one. */
    | 'more-than-one-subject'
    | 'unknown-word-id'
    | 'empty-word-ids'
    | 'overlaps-a-selected-slot'
    | 'too-close'
    | 'window-taken'
    /** The reel has spent every generated picture its density allows. */
    | 'budget-spent';
}

export interface PlannedSlot {
  wordIds: string[];
  start: number;
  end: number;
  contextText: string;
  idea: string;
  variation: Record<string, string>;
  prompt: string;
  negativePrompt: string;
  /** The word in the span the picture is about; absent means the span's start. */
  nameWordId?: string;
}

export interface SlotSelectionResult {
  slots: PlannedSlot[];
  failures: SlotFailure[];
  /**
   * Ideas refused for naming more than one subject, with the word that broke
   * each. Their slots are not in `slots`; a caller that can ask the model again
   * uses these to say what was wrong.
   */
  rejected: IdeaIssue[];
  requestedCount: number;
  /** Windows the candidates left empty. Reported, never padded. */
  shortfall: number;
  /** Seconds between the end of each slot and the start of the next. */
  gaps: number[];
  /** Reel time no slot covers. */
  uncoveredS: number;
}

/**
 * **How long a picture must be on screen before the next one replaces it.**
 *
 * This was `MIN_SLOT_GAP_S = 0.5`, "chosen, not measured", and it compared the
 * *end of one word span to the start of the next*. Its stated purpose was about
 * what the eye sees — two images butting together reading as one long dissolve —
 * and those are different quantities. A picture starts on its word and holds
 * until the next arrives (session 27), so what a viewer experiences is the
 * distance between two *starts*, not the space between two spans.
 *
 * Block 12 session 87 measured the difference on `sora-1`. Its pairs — *if you
 * want <this>, you need <this product>* — have word spans 0.00 to 0.24 s apart,
 * which the old rule refused. The pictures those spans would produce live **0.52
 * to 1.06 seconds each, a mean of 0.88**. Nothing was butting together; the rule
 * was measuring the wrong thing and refusing a second of screen time as though
 * it were a frame. `img006` proves it from the other side: session 86 added it
 * outside selection, its span gap is **0.00 s**, and it is on screen for 1.56 s.
 *
 * **The floor is measured, not chosen.** A picture may not leave before its own
 * entrance animation has finished playing, or the viewer never sees it arrive —
 * which is precisely the "one long dissolve" the old comment was reaching for.
 * The number is read from `templates/library.aep`'s audit: both image templates
 * authored by Mohamed animate `IMG_MAIN`'s opacity over **0.400 s**. It is a
 * fact about the template library, so it holds for any video on any machine, and
 * it moves if he re-authors the templates.
 */
export const FALLBACK_MIN_PICTURE_LIFE_S = 0.4;

/**
 * Deterministic per-axis draw. The user ruled that the palette stays dominant
 * across every slot while composition, lighting and crop vary, so the set
 * reads as designed rather than batched.
 *
 * The offset, the stride and the per-cycle bump all come from a hash of the
 * plan id and the axis name, so the same plan always draws the same values
 * and two different reels do not march through the axes in lockstep.
 *
 * The stride is chosen from the values coprime to the axis length, which
 * guarantees consecutive slots never land on the same value and that the draw
 * walks the whole axis rather than ping-ponging between two of its values.
 *
 * The bump advances the walk by an extra step each time it completes a cycle.
 * Without it a reel with more slots than an axis has values repeats exactly:
 * vitasilk's fifth slot came out identical to its first on all three axes,
 * which is two of five images composed the same way. The bump is picked so
 * that it cannot collide at the wrap either. An axis with only two values
 * cannot satisfy both conditions, so it takes no bump and repeats — with two
 * values and three slots something has to.
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function drawVariation(
  mode: ClientMode,
  planId: string,
  slotIndex: number,
): Record<string, string> {
  const drawn: Record<string, string> = {};
  for (const [axis, values] of Object.entries(mode.imageVariation.axes)) {
    if (values.length === 0) continue;
    const digest = createHash('sha256').update(`${planId}:${axis}`).digest();
    const offset = digest.readUInt32BE(0) % values.length;
    const strides =
      values.length === 1
        ? [0]
        : Array.from({ length: values.length - 1 }, (_, i) => i + 1).filter(
            (s) => gcd(s, values.length) === 1,
          );
    const stride = strides[digest.readUInt32BE(4) % strides.length] as number;
    const bumps = Array.from({ length: values.length - 1 }, (_, i) => i + 1).filter(
      (b) => (stride + b) % values.length !== 0,
    );
    const bump = bumps.length === 0 ? 0 : (bumps[digest.readUInt32BE(8) % bumps.length] as number);
    const cycle = Math.floor(slotIndex / values.length);
    drawn[axis] = values[(offset + stride * slotIndex + bump * cycle) % values.length] as string;
  }
  return drawn;
}

/**
 * The §5.3 composition, entirely from mode data. `stylePrompt` is the
 * invariant half and every slot gets all of it — that is what keeps the mode
 * palette dominant across the set — followed by this slot's variation draw.
 * No colour and no composition term is written here.
 */
/**
 * Joins fragments into one sentence-per-clause prompt. Each fragment is
 * stripped of its own terminal punctuation and surrounding whitespace before
 * the separator is added, because the fragments come from three places that
 * cannot agree on it: the model's idea usually ends in a full stop, the mode's
 * style fragments never do, and the variation values never do. Session 4 sent
 * every prompt to disk reading "...five minutes.. a single clear idea".
 */
const TERMINAL_PUNCTUATION_RE = /[.,;:\s]+$/;

function joinFragments(fragments: string[]): string {
  const cleaned = fragments
    .map((f) => f.replace(/\s+/g, ' ').trim().replace(TERMINAL_PUNCTUATION_RE, ''))
    .filter((f) => f.length > 0);
  return cleaned.length === 0 ? '' : `${cleaned.join('. ')}.`;
}

/**
 * Raised when a planned slot's idea contradicts the mode's single-subject
 * invariant. A hard failure at plan time, naming the slot and the phrase:
 * the planner is what needs to change, and a rewrite would hide that behind
 * an idea nobody wrote.
 */
export class MultiSubjectIdeaError extends Error {
  constructor(readonly issues: IdeaIssue[]) {
    super(
      `${issues.length} slot idea(s) depict more than one subject: ` +
        issues.map((i) => `${i.slotId} ("${i.idea}") — ${i.marker}`).join('; ') +
        '. The mode asks for one subject, centred and unobstructed.',
    );
    this.name = 'MultiSubjectIdeaError';
  }
}

export function composePrompt(
  mode: ClientMode,
  idea: string,
  variation: Record<string, string>,
): string {
  return joinFragments([idea, ...renderStylePrompt(mode), ...Object.values(variation)]);
}

export function composeNegativePrompt(mode: ClientMode): string {
  return renderNegativePrompt(mode).join(', ');
}

export interface PlanSlotsOptions {
  candidates: SlotCandidate[];
  words: AnalysisWord[];
  mode: ClientMode;
  planId: string;
  requestedCount: number;
  durationS: number;
  /**
   * How long a picture must be on screen before the next replaces it.
   *
   * Defaults to the templates' authored entrance. Passed in rather than read
   * here so this stays pure and a test can state the number it is asserting.
   */
  minPictureLifeS?: number;
  /**
   * Spans this reel has already bought a picture for, as `wordIds.join(' ')`.
   *
   * **Money already spent is not spent again, and a picture already made is not
   * thrown away.** Block 12 session 86: re-planning `sora-1` dropped the Pluryal
   * slot as too close to a new one, and that slot holds the two candidates
   * session 84 paid for and Mohamed approved. The budget governs *new*
   * spending, so a span already paid for is never bought a second time — but it
   * still occupies one of the reel's places. Block 12 session 90 separated those
   * two: counting it against nothing turned a re-plan of `sora-2` into twelve
   * slots against a budget of six.
   */
  alreadyBought?: readonly string[];
}

/**
 * Turns slot candidates into planned slots. Pure, and the only place the
 * count, the no-overlap rule and the spread rule are decided.
 *
 * **Spread used to be a grid and is now the pictures' own lives.** The reel was
 * divided into equal windows with at most one slot in each, which guaranteed
 * coverage without a tuned constant — but a uniform grid over unevenly spaced
 * speech refuses legitimate placements: Block 12 session 87 measured `sora-1`
 * putting ترطيب and Profhilo in the same 1.28-second cell while other cells
 * stood empty, and the second was dropped for the arithmetic of the grid rather
 * than for anything a viewer would see.
 *
 * The minimum-life floor is a strictly better version of the same intent. It is
 * local, it is measured off the templates rather than chosen, and it refuses
 * exactly the thing the grid existed to prevent — a second picture crammed
 * against the first — without also refusing a picture a second later. `shortfall`
 * and `uncoveredS` still report what was not covered, so the degradation stays
 * visible rather than becoming silent.
 *
 * Images are independent of keywords per PROJECT_SPEC §5, so a span that is
 * also a keyword is neither preferred nor excluded.
 *
 * **`requestedCount` is a budget in money, not in pictures.** It comes from
 * `imageSlotCountFor`, Mohamed's ruling of 2026-08-29 at eight per thirty
 * seconds, and what that ruling limits is generated images: they cost about
 * $0.17 each and a reel that flashes one every second is unwatchable. A slot the
 * client's own store answers costs nothing and was chosen by them, so it does
 * not spend from that budget — session 85 established exactly this for the slots
 * it added after selection, and this is the same principle applied inside it.
 *
 * Block 12 session 86: `sora-1` is 10.2 seconds, so the budget is three. The
 * model proposed eight good slots — five products and three of the results she
 * names in the same breath — and three were kept. Two of those three were
 * answered from her own pictures, so **the reel spent one of its three paid
 * pictures and dropped five candidates**, which is the opposite of what the
 * ruling is for.
 *
 * The windows are sized over everything that may be placed rather than over the
 * money, or one free picture per window would cap the reel at the budget again.
 */
export function planSlots(options: PlanSlotsOptions): SlotSelectionResult {
  const { candidates, words, mode, planId, requestedCount, durationS } = options;
  const alreadyBought = new Set(options.alreadyBought ?? []);
  const minPictureLifeS = options.minPictureLifeS ?? FALLBACK_MIN_PICTURE_LIFE_S;
  const byId = new Map(words.map((w) => [w.id, w]));
  const failures: SlotFailure[] = [];

  const resolved: {
    wordIds: string[];
    start: number;
    end: number;
    contextText: string;
    idea: string;
    nameWordId?: string;
    /**
     * Where the model put this idea in its own answer.
     *
     * The slot prompt asks it to *"return the N strongest slots, best first"*, so
     * the order it replies in is its ranking. When two moments compete for the
     * last picture a reel can afford, that is the measure used — the model's,
     * not one invented here from Mohamed's videos.
     */
    rank: number;
  }[] = [];
  for (const [rank, candidate] of candidates.entries()) {
    if (!Array.isArray(candidate.wordIds) || candidate.wordIds.length === 0) {
      failures.push({ candidate, reason: 'empty-word-ids' });
      continue;
    }
    const hit = candidate.wordIds.map((id) => byId.get(id));
    // Never fuzzy-matched onto a nearby word: a slot illustrating the wrong
    // sentence is worse than a reel with one fewer image.
    if (hit.some((w) => w === undefined)) {
      failures.push({ candidate, reason: 'unknown-word-id' });
      continue;
    }
    const ordered = (hit as AnalysisWord[]).slice().sort((a, b) => a.start - b.start);
    const ids = ordered.map((w) => w.id);
    // Checked again here rather than trusted from the parser: `planSlots` is
    // also reached by a migration and by the tests, and a picture may start
    // later inside its own span and nowhere else.
    const named = candidate.nameWordId;
    resolved.push({
      wordIds: ids,
      start: ordered[0]?.start ?? 0,
      end: ordered[ordered.length - 1]?.end ?? 0,
      contextText: ordered.map((w) => w.text).join(' '),
      idea: candidate.idea,
      ...(named !== undefined && ids.includes(named) ? { nameWordId: named } : {}),
      rank,
    });
  }

  resolved.sort((a, b) => a.start - b.start || a.end - b.end);

  /*
   * Which candidates the client's own pictures already answer. Asked of the same
   * `matchClientPicture` the planner uses later, so the two cannot disagree
   * about what counts as free.
   */
  const answeredFree = new Set<string>();
  for (const slot of resolved) {
    const spoken = slot.wordIds
      .map((id) => byId.get(id))
      .filter((w): w is AnalysisWord => w !== undefined)
      .map((w) => ({ id: w.id, text: w.text }));
    const named = 'nameWordId' in slot ? (slot as { nameWordId?: string }).nameWordId : undefined;
    if (matchClientPicture(clientPictures(mode), spoken, named) !== null) {
      answeredFree.add(slot.wordIds.join(' '));
    }
  }

  /**
   * **The client's own pictures are extra; a picture already bought is not.**
   *
   * These two used to be one set, and both raised the number of slots the reel
   * could hold. That is right for the first — Mohamed ruled on 2026-08-26 that a
   * picture he has already chosen is placed *as well as* the ones the budget
   * buys, not instead of one. It is wrong for the second, and Block 12 session
   * 90 measured what it cost: re-planning `sora-2`, whose seven pictures were
   * already bought, produced **twelve slots against a budget of six**, because
   * every span the reel had paid for was counted as free and the budget then
   * bought six more on top. A second re-plan would have gone further. The cap is
   * his ruling of 2026-08-29 and a re-plan was quietly doubling it.
   *
   * So an already-bought span is a **discount, not a free pass**: it competes
   * for one of the reel's places like any other candidate, and costs nothing
   * when it wins one.
   */
  const placeable = requestedCount + answeredFree.size;
  const accepted: typeof resolved = [];
  let placesSpent = 0;

  /*
   * **What she has already decided is placed first; the budget then fills what
   * is left.**
   *
   * Selection used to walk the reel once in time order, so whichever candidate
   * came first took the space and the next one within `MIN_SLOT_GAP_S` was
   * dropped. That is a coin toss between two moments, decided by which happens
   * earlier — and one of the two is not a guess: a label is the client saying
   * what to show when this word is said.
   *
   * Two clauses, and neither is about products or subject matter. A labelled
   * match is a decision the client has already made about a specific word, which
   * outranks an idea a model proposed for the same seconds. And it costs
   * nothing, so placing it first leaves the paid budget for the moments they
   * have *not* pre-decided, which is the only place money can buy anything.
   */
  /*
   * Free to place: the client answered it from her own pictures. Already bought
   * is handled below, where it wins a place rather than adding one.
   *
   * **A bought span is matched by the words it holds, not by an identical
   * list.** Block 12 session 87 asked the model for more ideas, it returned
   * `["w0011"]` where it had returned `["w0010","w0011"]`, and two pictures
   * already paid for stopped matching and were bought a second time. The same
   * moment described by a shorter span is the same moment.
   */
  const boughtWords = new Set([...alreadyBought].flatMap((span) => span.split(' ')));
  const isBought = (slot: (typeof resolved)[number]): boolean =>
    alreadyBought.has(slot.wordIds.join(' ')) || slot.wordIds.some((id) => boughtWords.has(id));
  const isFree = (slot: (typeof resolved)[number]): boolean =>
    answeredFree.has(slot.wordIds.join(' '));

  const fits = (slot: (typeof resolved)[number], asCandidate: SlotCandidate): boolean => {
    for (const already of accepted) {
      if (slot.start < already.end && already.start < slot.end) {
        failures.push({ candidate: asCandidate, reason: 'overlaps-a-selected-slot' });
        return false;
      }
      /*
       * Start to start: the earlier picture is on screen from its own word until
       * this one takes over, so that distance is its life.
       */
      const apart = Math.abs(slot.start - already.start);
      if (apart < minPictureLifeS) {
        failures.push({ candidate: asCandidate, reason: 'too-close' });
        return false;
      }
    }
    return true;
  };

  /* What the client answered from her own pictures: in time order, and extra. */
  for (const slot of resolved) {
    if (!isFree(slot)) continue;
    const asCandidate: SlotCandidate = { wordIds: slot.wordIds, idea: slot.idea };
    if (accepted.length >= placeable) {
      failures.push({ candidate: asCandidate, reason: 'budget-spent' });
      continue;
    }
    if (!fits(slot, asCandidate)) continue;
    accepted.push(slot);
  }

  /**
   * **The budget is spread across the reel, not spent front to back.**
   *
   * It used to walk the reel once in time order and take what it met, so a reel
   * with more good candidates than it can afford spent everything early and went
   * dark. Block 12 session 89 measured `sora-2`: seven pictures, **all in the
   * first half**, the last held for 13.30 s — 57% of the reel — and the five
   * refused candidates all sat between 12.58 s and 18.58 s. It is not a
   * long-reel problem: `test 1` is 40% dark and `vitasilk` opens with 6.16 s of
   * nothing.
   *
   * Mohamed ruled on 2026-09-11: spread them across the whole video and choose
   * the most important ones. **The count is untouched** — `IMAGE_SLOTS_PER_30S`
   * is still his ruling of 2026-08-29 and `requestedCount` still says how many
   * are bought. Only where they land changes.
   *
   * The reel is cut into as many equal stretches as there are pictures to buy,
   * and each stretch buys at most one. That number is not chosen here: it is the
   * budget, so a reel that can afford six pictures is considered in sixths. When
   * two moments in a stretch compete, **the model's own ranking decides** — the
   * slot prompt asks it to return its strongest first, so the order it replied
   * in is the measure, and nothing is invented from anyone's videos.
   *
   * A stretch whose candidates do not fit leaves its money unspent rather than
   * losing it, and the pass below spends what is left on the best remaining
   * moments anywhere. So a reel never buys fewer pictures than it used to; they
   * are only in different places.
   */
  const stretches = Math.max(1, requestedCount);
  const stretchOf = (slot: (typeof resolved)[number]): number =>
    Math.min(stretches - 1, Math.floor((slot.start / Math.max(durationS, 1e-9)) * stretches));

  const paidCandidates = resolved.filter((slot) => !isFree(slot));
  const takenStretch = new Set<number>();
  const placed = new Set<(typeof resolved)[number]>();

  /*
   * Rank orders them, except that a moment this reel has already paid for wins
   * its stretch outright. That is not a judgement about the picture: it is the
   * standing rule that a picture Mohamed has already approved is never bought
   * again, and keeping its moment is the only way to honour it. Nothing is
   * scored here — the rest is the model's own order.
   */
  const strongestFirst = [...paidCandidates].sort(
    (a, b) => Number(isBought(b)) - Number(isBought(a)) || a.rank - b.rank,
  );
  for (const slot of strongestFirst) {
    if (placesSpent >= requestedCount || accepted.length >= placeable) break;
    const stretch = stretchOf(slot);
    if (takenStretch.has(stretch)) continue;
    const asCandidate: SlotCandidate = { wordIds: slot.wordIds, idea: slot.idea };
    if (!fits(slot, asCandidate)) continue;
    takenStretch.add(stretch);
    placed.add(slot);
    accepted.push(slot);
    placesSpent += 1;
  }

  /* Money a stretch could not use is spent on the best moment left anywhere. */
  for (const slot of strongestFirst) {
    if (placed.has(slot)) continue;
    const asCandidate: SlotCandidate = { wordIds: slot.wordIds, idea: slot.idea };
    if (placesSpent >= requestedCount || accepted.length >= placeable) {
      failures.push({ candidate: asCandidate, reason: 'budget-spent' });
      continue;
    }
    if (!fits(slot, asCandidate)) continue;
    placed.add(slot);
    accepted.push(slot);
    placesSpent += 1;
  }

  accepted.sort((a, b) => a.start - b.start || a.end - b.end);

  const slots: PlannedSlot[] = accepted.map((slot, i) => {
    const variation = drawVariation(mode, planId, i);
    /* `rank` decides which candidate wins a stretch; it is not part of a slot. */
    const placed: Omit<typeof slot, 'rank'> & { rank?: number } = { ...slot };
    delete placed.rank;
    return {
      ...placed,
      variation,
      prompt: composePrompt(mode, slot.idea, variation),
      negativePrompt: composeNegativePrompt(mode),
    };
  });

  /*
   * Checked after selection and before anything downstream reads a prompt: a
   * multi-subject idea contradicts the mode's own invariant and produced three
   * separate problems on img005 — a gate failure reported as a matte defect,
   * 47 invented label words, and an unusable matte.
   *
   * **It used to throw, and one weak idea among good ones killed the reel.**
   * Block 12 session 89: Mohamed ran `sora-2`, the model returned twelve ideas,
   * **eleven were fine** and the seventh was "Assortment of vitamin pills". The
   * run stopped, nothing was built, and the transcription he had just paid
   * $0.1479 for led nowhere. A model returning one weak idea among good ones is
   * ordinary, not exceptional.
   *
   * The rule is unchanged — that idea does not become a picture. What changed is
   * that it is **dropped and named** rather than thrown, so the reel keeps its
   * other eleven. `rejected` carries the issues out so a caller that can ask the
   * model again does, and a caller that cannot still gets a usable reel with one
   * picture fewer.
   */
  const rejected = slots.flatMap((slot, i) => checkSlotIdea(`slot ${i + 1}`, slot.idea, mode));
  const rejectedIdeas = new Set(rejected.map((issue) => issue.idea));
  const usable = slots.filter((slot) => !rejectedIdeas.has(slot.idea));
  for (const issue of rejected) {
    const dropped = slots.find((slot) => slot.idea === issue.idea);
    if (dropped !== undefined) {
      failures.push({
        candidate: { wordIds: dropped.wordIds, idea: dropped.idea },
        reason: 'more-than-one-subject',
      });
    }
  }

  const gaps: number[] = [];
  for (let i = 1; i < usable.length; i += 1) {
    gaps.push((usable[i]?.start ?? 0) - (usable[i - 1]?.end ?? 0));
  }
  const covered = usable.reduce((n, s) => n + (s.end - s.start), 0);

  return {
    slots: usable,
    failures,
    rejected,
    requestedCount,
    shortfall: Math.max(0, requestedCount - usable.length),
    gaps,
    uncoveredS: Math.max(0, durationS - covered),
  };
}
