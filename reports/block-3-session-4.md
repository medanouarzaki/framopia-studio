Status: OK

Block 3 session 4. Closed the plan-merge gap before anything else could write
a third block, put a two-word cap and a diversity rule on keyword selection,
built the image slot planner, made the pre-spend estimate honest, and ran both
analysis stages live on two reels.

**Session spend $0.224164 over 4 billable calls.** Both cost gates held.

## Done

**1. Plan merge** (b345d18). `service/src/editplan/merge.ts`, wired into
`transcribeVideo` (`service/src/transcription/job.ts`) and `--force` added to
`npm run transcribe`.

- `transcriptContentHash` covers each word's id, text, timing and removed
  flag. **Schema departure:** stored as `transcript.contentHash`, which
  ARCHITECTURE §3 does not name. Documented in
  `service/src/editplan/types.ts`. The merge recomputes it from the existing
  plan's own words rather than trusting the stored value, so a plan written
  before the field existed is answered exactly instead of assumed stale — that
  is what made the repair below free and non-destructive.
- Transcript unchanged: `keywords`, `images`, `sfx` preserved, `meta.id` and
  `meta.createdAt` preserved, every `byStage` key preserved.
- Transcript changed: those three blocks cleared, their pipeline stages reset
  to `pending`, their `byStage` costs dropped, a `built` plan marked `stale`,
  and the CLI prints what it cleared and why. `zones` deliberately survive —
  they come from computer vision over frames and reference no word id. **No
  stale reference is ever re-resolved onto a neighbour.**
- ARCHITECTURE §3's human-flag rule enforced: a clear that would destroy a
  `keywords.items[].edited` item or an image slot with a `chosenCandidateId`
  throws `PlanMergeBlockedError` naming each item and demanding `--force`.
  **Second schema departure:** `KeywordItem.edited?: boolean`, added because
  keywords had no way to carry the flag §3 requires.
- 14 tests, including all three the goal named.

**The two enriched plans were repaired at $0.0000.** Both lacked
`costs.byStage.transcription` (written before last session's fix). A cached
transcribe re-run on each hit the cache, printed "transcript unchanged,
keeping keywords, images and sfx as they are", added the missing key, and left
all three keywords intact. Ledger: 60 lines before, 60 after.

**2. Span cap and diversity** (ef6b967). `service/src/analysis/span.ts`, both
enforced in the pure selector.

**The narrowing rule I chose, in full:** drop droppable tokens from the front
and then the back while more than one token remains; if two or fewer remain
that is the span; otherwise keep the first token plus the second when the
second is not droppable. Droppable = a function word (Darija freeze-list
connectives, French and English articles and prepositions, Arabic proclitic
words) or a bare number. Head-initial is correct for all three languages in
these reels — Arabic, Darija and French all put the head noun first. A span is
**narrowed, never dropped**.

Worked examples from the tests: `la mésothérapie dial المنطقة العينين` →
`mésothérapie`; `18 7ta l 25 chher` → `chher`; `dial lissage brésilien w` →
`lissage brésilien`.

**This breaks §6 Arabic-script domain terms that the orthography guide treats
as one unit.** `تحفيز طبيعي للكولاجين` narrows to `تحفيز طبيعي`. That is a real
tension between the guide, which mandates the full Arabic term, and
TEMPLATE_LIBRARY_GUIDE §4, which designs the animation for one or two short
words. I resolved it in favour of the template because the text has to fit on
screen, but it is a genuine conflict and the user should see it stated.

Diversity: two candidates collide when their significant tokens share a stem.
`headStem` sees through the Arabic definite article and the single-letter
proclitics — `الكولاجين` and `للكولاجين` resolve to the same stem, which is the
session-3 collision — and through an attached Latin article. It is a
**heuristic used only for comparison**, never rewrites a word, and refuses to
strip a word down to a stub. A collision skips the candidate and the next by
score takes its place; a count the candidates cannot fill is reported as a
`shortfall` and **never padded**.

`ACTIVE_ANALYSIS_PROMPT_VERSION` bumped to **2** (span preference + "do not
return two candidates about the same thing"); the fingerprint invalidates, and
a test pins that. Version 1 stays selectable and unchanged. 20 span tests plus
5 new selector tests at the boundaries the goal named.

**3. Image slot planner** (d375be8). `slots.ts` (prompt, call, parse) and
`slot-select.ts` (pure), mirroring the keyword stage — same count derivation
file, same fingerprint and cache patterns, own cache stage `imageslots`,
`ACTIVE_SLOT_PROMPT_VERSION = 1`. **No image is generated; that is Block 4.**

- `imageSlotCountFor`: 5.5 per 30 s, same rounding and floor. 4 for the Block
  1 reels, 5 for vitasilk. Tested at boundaries.
- **Spread rule:** the reel is divided into `count` equal windows and at most
  one slot is kept per window, chosen by midpoint, plus `MIN_SLOT_GAP_S = 0.5`
  as an absolute floor. The windows need no tuned constant and degrade
  honestly — an unreached window is a shortfall, not a slot crammed next to
  its neighbour. The 0.5 s floor is **chosen, not measured**, and says so.
- Slots cannot overlap; unresolved word ids are dropped and counted, never
  fuzzy-matched. Images are independent of keywords per §5, so the planner is
  never told which spans are keywords.
- Prompt composition is entirely mode data: idea + all of
  `mode.imageStyle.stylePrompt` + this slot's variation draw; negatives are
  mode negatives + the §5.3 globals. **No colour and no composition term is
  written in code.**
- Variation draw is deterministic from `meta.id` and the slot index.
- **Two more schema departures:** `ImageSlot.wordIds` (§3 gives only
  start/end, which leaves a merge unable to tell whether the span still
  exists) and `presentation` made nullable (the quality gate is Block 4 and a
  guessed `cutout` would read as a decision). Both documented in `types.ts`.
- Validation extended to every slot field plus ordered windows and
  no-overlap; 7 tests confirm a malformed slot block cannot reach disk.

**4. Estimator** (f9fbe89). **I chose to make it stage-aware and roughly
right** rather than print a no-estimate notice, because the existing
methodology was sound and only its inputs were wrong — it was being handed a
duration of 0 for a call that sends no audio.
`estimateGeminiTextCallCost` in `core/src/pricing.ts` estimates from the
prompt that will actually be sent plus an expected answer size, at the same
deliberately pessimistic thinking multiplier. Live: **$0.0533 estimated
against $0.0588 actual** for keywords, **$0.0781 against $0.0467** for
vitasilk's slots. The old number was $0.0040 against ~$0.05. The printed line
now says it is a spend gate, not a forecast.

**5. Live run** (0f0af4e). Full detail in
`benchmarks/RESULTS-block3-slots.md`. Ledger all-time before spending:
**$5.712720** (60 entries).

**Keywords — vitasilk, 25.7 s, 3 keywords, $0.0588, 94.7 s, cache miss.** 0
resolution failures, 0 diversity skips, 0 narrowed, 0 text mismatches.

| id | keyword | words | score | reason (verbatim) |
|---|---|---|---|---|
| k001 | `filler glow` | 2 | 0.99 | identifies the specific product being promoted |
| k002 | `Vita Silk` | 2 | 0.98 | names the brand of the treatment |
| k003 | `lissage brésilien` | 2 | 0.97 | specifies the cosmetic procedure |

**Keywords — test-1, 22.0 s, 3 keywords, $0.0693, 91.0 s, cache miss.** 0
resolution failures, 0 diversity skips, 0 narrowed, 0 text mismatches.

| id | keyword | words | score | reason (verbatim) |
|---|---|---|---|---|
| k001 | `محفزات الكولاجين` | 2 | 0.95 | names the core procedure and main topic |
| k002 | `injections` | 1 | 0.92 | identifies the delivery method of the treatment |
| k003 | `شد` | 1 | 0.88 | states the main aesthetic benefit |

test-1 went from **ten emphasized words to four**, and the duplicate pair
`محفزات الكولاجين` / `تحفيز طبيعي للكولاجين` is gone. **No candidate on either
reel needed narrowing**, so no "original span → what it became" row exists to
report from the live run.

**Slots — vitasilk, 5 slots, $0.0467, 27.0 s, cache miss.** 0 resolution
failures, 5 spread/overlap rejections, 0 shortfall.

| id | window | idea (verbatim) | composition / lighting / crop |
|---|---|---|---|
| img001 | 0.10–2.68 s | A sleek digital stopwatch or clock face showing exactly five minutes. | low in frame / hard directional / macro |
| img002 | 6.26–8.86 s | A luxurious, glowing hair care product bottle radiating light on a premium display. | off-centre / flat frontal / wide |
| img003 | 11.48–12.74 s | Multiple glowing vitamin capsules floating and absorbing into a strong strand of hair. | centred / rim / medium |
| img004 | 14.02–16.88 s | A professional hair straightener gliding smoothly through thick hair, leaving a flawless, sleek finish. | edge to edge / soft diffuse / close |
| img005 | 20.00–25.48 s | A woman confidently and eagerly sitting in a salon chair, ready for her treatment. | off-centre / flat frontal / medium |

Gaps: 3.58 s, 2.62 s, 1.28 s, 3.12 s. Uncovered: 10.91 s of 25.7 s.

**Slots — test-1, 4 slots, $0.0492, 27.1 s, cache miss.** 0 resolution
failures, 4 spread/overlap rejections, 0 shortfall.

| id | window | idea (verbatim) | composition / lighting / crop |
|---|---|---|---|
| img001 | 0.10–1.38 s | A smiling woman gently touching her firm, lifted cheeks. | centred / hard directional / wide |
| img002 | 4.60–6.76 s | A sleek glass vial containing a beauty serum. | off-centre / flat frontal / macro |
| img003 | 10.94–12.54 s | A close-up profile of a well-defined, youthful jawline. | low in frame / rim / close |
| img004 | 19.72–21.94 s | A macro shot of flawless, dewy skin with a healthy glow. | edge to edge / soft diffuse / medium |

Gaps: 3.22 s, 4.18 s, 7.18 s. Uncovered: 14.73 s of 22.0 s.

**Full composed prompt, vitasilk img001** — what would go to the image model:

```
A sleek digital stopwatch or clock face showing exactly five minutes.. a single
clear idea, readable at a glance. one subject, centred and unobstructed.
dominant colour palette of #1A0000, #820000 and #C9A96E. lit against #1A0000,
with #F8F6F2 reserved for highlights. subject low in frame with headroom above.
hard directional light with defined shadow. macro, a single detail standing for
the whole
```

**Full composed prompt, test-1 img002:**

```
A sleek glass vial containing a beauty serum.. a single clear idea, readable at
a glance. one subject, centred and unobstructed. dominant colour palette of
#1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for
highlights. subject off-centre with open space to one side. flat frontal light,
no modelling. macro, a single detail standing for the whole
```

Negative prompt, identical on every slot:

```
no extraneous objects, no background clutter, no incidental detail, nothing in
frame that is not carrying the idea, no busy or competing composition, no text,
no watermark, no logo
```

**Cache hits:** both stages re-run on test-1 came back $0.0000 with no new
ledger line (64 before, 64 after) and a plan differing in ten leaves, all
bookkeeping — `costs.byStage.analysis` and `.images` going to **0 rather than
vanishing**.

**Ledger untouched by the test suite:** 64 lines before `npm run check` and 64
after. Both stages append at the point of spend, inside the call, so a stubbed
call cannot bill.

**6. `CLAUDE.md` updated** for the merge, the span and diversity rules, the
slot planner, the estimator, the four schema departures and the live figures.

## Deviations

- **The merge compares recomputed hashes, not the stored `contentHash`.** The
  goal implied "no hash stored → treat as changed". That would have made the
  plan repair destructive: both enriched plans predate the field, so a repair
  run would have cleared the very keywords it was meant to preserve. The words
  are always present and hashing them is exact, so I compare those and keep
  the stored value as the record. Strictly more correct and it removed a
  heuristic rather than adding one.
- **`drawVariation` gained a per-cycle bump after the live run.** vitasilk's
  fifth slot came back an exact copy of its first on all three axes — the
  goal's rule ("consecutive slots never share a value") was satisfied, but two
  of five images would have been composed identically. Fixed and re-verified
  on a **free cache hit**; the vitasilk slots reported above are the corrected
  draw. With four values and five slots some repeat is unavoidable; a
  three-axis duplicate is not.
- **`evictStaleEntries` already took a `stage` parameter** from last session,
  so the new `imageslots` stage gets its own budget without further change.
- **The CLI gained `--stage`** rather than a second command, so both analysis
  stages share one estimate-and-confirm path.
- **Four schema departures**, all listed above and documented in
  `types.ts`: `transcript.contentHash`, `KeywordItem.edited`,
  `ImageSlot.wordIds`, and `ImageSlot.presentation` made nullable.

## Failures & open problems

- **The narrowing rule and the diversity rule are unexercised on real data.**
  Zero narrowed spans and zero diversity skips across both live reels: prompt
  version 2 prevented both upstream. Only unit tests have ever run those code
  paths, so the fallback that is supposed to guarantee the contract has never
  actually had to.
- **Narrowing breaks §6 Arabic domain terms**, as described above. Stated, not
  resolved — it is a conflict between two documents the user owns.
- **`headStem` is a heuristic.** Stripping Arabic proclitics can in principle
  merge two unrelated words into one stem and suppress a legitimate keyword.
  The `MIN_STEM` guard limits it and it never rewrites text, but it is a guess
  about morphology, not a parse.
- **Every composed prompt contains a double full stop** (`...five minutes.. a
  single clear idea`): the model's idea already ends in a period and the
  composer joins with `. `. Cosmetic but it goes to the image model verbatim.
  Not fixed.
- **Slot ideas are the model's, unreviewed.** vitasilk img001 illustrates "five
  minutes" with a stopwatch — plausible, but nobody has checked that any of
  these nine ideas actually match what is said, and the composed prompts have
  never been sent to an image model, so nothing here is validated as
  *generatable*.
- **Uncovered reel time is large** — 10.91 s of 25.7 s and 14.73 s of 22.0 s.
  Whether an image should hold beyond its transcript span is a placement
  question for Block 5's zone solver, but as planned today, more than half of
  test-1 has no image window.
- **`MIN_SLOT_GAP_S = 0.5` is chosen, not measured**, like
  `MAX_ENTRIES_PER_VIDEO`. Nothing has been built yet to say whether it is
  right.
- **The `--force` path has never been run outside tests**, and neither has a
  real transcript change: both live merges took the unchanged branch.
- **`analyse-cli.ts` still has no unit tests**; verified only by live runs.
- **The insertion spotcheck listening pass is still not done**, carried over
  from sessions 2 and 3. test-1's `7ta` insertion no longer appears in a
  keyword — the span cap narrowed it away — but it is still in the transcript.

## Repo state

- Branch: `main`. **Pushed** at the end of the session (see below).
- HEAD: `0f0af4e` `test: run keyword and slot analysis on two reels`, plus the
  CLAUDE.md and report commit that follows it.
- Session commits: b345d18, ef6b967, d375be8, f9fbe89, 0f0af4e.
- `npm run check`: **PASS**, exit 0, `check: PASS` marker present.
  **493 tests** — core 53, service 295, benchmarks 145 (up from 419).
- Session spend: **$0.224164** over 4 billable calls, 4 ledger lines.
- Ledger all-time: **$5.936884** across 64 entries, up from $5.712720 / 60.

## Suggested next step

The plan now carries keywords and image slots but nothing has ever been looked
at by a human, and the cheapest high-value thing available is a review pass
over the nine slot ideas and six keywords already sitting in the two plans —
they cost nothing more to read, and they are the last point where a wrong idea
is free to fix. Everything downstream gets expensive: Block 4 turns each of
those nine prompts into 2–4 generated images at real cost per image, so an
idea that misreads the transcript is paid for four times before anyone notices.
The same pass should settle the two open questions this session raised — whether
narrowing an Arabic §6 term to two words is acceptable on screen, and whether
half a reel with no image window is a gap the zone solver should close or a
sign the slot count is too low — because both change what Block 4 is asked to
produce rather than how it produces it.
