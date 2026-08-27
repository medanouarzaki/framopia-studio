Status: OK

# Block 7 session 7 — image fill, the missing words, and the hold

Spent **$0.00**. No Gemini call, no ElevenLabs call, no image regenerated, no
billable request. Ledger byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` byte-identical: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects: 1 instance at start and end**, PID 44015, no arguments, no
`-r`. Helpers excluded from the count; re-checked before every `DoScript` by
`assertOneInstance` and never changed. Nothing launched, nothing killed. **No
new dependency.**

## Done

### Goal 1 — do the images fill their canvas

`npm run image-fill` → `benchmarks/RESULTS-block7-image-fill.md`. Read-only; no
image regenerated and the cutout sidecar not re-run. All 20 candidate files on
`vitasilk` measured, originals and cutouts.

**Definitions.** Cutout content is non-zero alpha — the matte the Block 4 gate
already accepted. Original content is colour whose largest per-channel
difference from the mode's background `#1A0000` exceeds 24 of 255; the mode's
own style fragment places the subject "lit against #1A0000", so the ground is a
stated colour rather than a guess. 16 and 40 were measured too and are in the
file, because a single threshold on a deliberately dark image should not go
unqualified.

**The hypothesis is confirmed, but not by the route it proposed.**

| set | n | long-edge fraction min / median / max |
|---|---:|---|
| cutouts, as used | 2 | 0.681 / — / 1.000 |
| originals, as used | 8 | 0.740 / 1.000 / 1.000 |
| **subject inside any file**, from its matte | 10 | **0.548 / 0.701 / 1.000** |

The files mostly **do** fill their canvases. Only one slot renders from a
cutout, so the cutout row is two numbers and no median should be read from it.
What is small is **the subject inside the picture**: a median 0.701 of the long
edge, as little as 0.548.

**And the template loses more than either.** Both `img_float` and
`img_slide_left` put `IMG_MAIN` at **1000 inside a 1200 comp** — measured from
the audit, not assumed — so **16.7% of every placed square is gone before a
pixel is drawn**, on the cutout template as well as the card one.
`CARD_EDGE_CLEARANCE` 0.02 insets the square before that and compounds.

**Multiplied out, the worst slot shows its subject at 0.567 of the square it was
given. Every effective image size published before this session was overstated
by roughly that factor.**

**What the builder scaled by: the canvas.** `placeholderScalePercent` takes
`sourceWidth` from `imageSize()`, which reads the PNG IHDR or JPEG frame header.
Session 4's 1000/2048 was a canvas ratio throughout.

**Effective subject size on screen today**, never reported before:

| slot | placed square | template fraction | content fraction | **subject** | of frame width |
|---|---:|---:|---:|---:|---:|
| img001 | 352 px | 0.833 | 0.905 | **266 px** | 0.123 |
| img002 | 742 px | 0.833 | 0.681 | **421 px** | 0.195 |
| img003 | 344 px | 0.833 | 1.000 | **287 px** | 0.133 |
| img004 | 641 px | 0.833 | 1.000 | **534 px** | 0.247 |
| img005 | 537 px | 0.833 | 0.973 | **435 px** | 0.201 |

**Presentation**: 4 of 5 slots render as `card`, 1 as `cutout`. A card's picture
is `IMG_MAIN` at 0.833 of the placed square; the `CARD` layer is 1080 of 1200,
so the visible frame is the ring between them.

**A mismatch found on the way, reported not fixed**: `img004` is presentation
`card` but carries `img_slide_left`, the **cutout** template. Template
assignment is a seeded shuffle over the mode's allowed variants and does not
read `presentation` — the quality gate sets that later. Nothing fails; that card
simply has no frame, and nothing said so until now.

### Goal 2 — make the image fill the space

**Implemented: scale by content** (`service/src/build/content-box.ts`,
`contentAwareScalePercent`). The rule is that the file's **content** occupies
what its canvas used to, so the template's own 1000-in-1200 design is left
alone. A file whose content already fills its canvas returns exactly the
previous number, so nothing that was right changes.

```
img001: canvas 2048, content 1854 -> 48.8281% (canvas) -> 53.9374% (content)
img002: canvas 2048, content 1394 -> 48.8281% (canvas) -> 71.7360% (content)
img003: canvas 2048, content 2048 -> 48.8281%          -> 48.8281%  (unchanged)
img004: canvas 2048, content 2048 -> 48.8281%          -> 48.8281%  (unchanged)
img005: canvas 2048, content 1994 -> 48.8281% (canvas) -> 50.1505% (content)
```

**Implemented: position by content centre**, but by the **anchor point**, not
the position. The first attempt set Position and the build failed with
`Can not call setValue() on a property with keyframes` — `img_slide_left`
keyframes `IMG_MAIN`'s Position. Re-writing someone's animation to shift a
picture would have been the wrong fix anyway. Setting the anchor to the
content's centre (in source pixels) moves the picture inside the layer while the
template's motion plays over it untouched; the audit confirms Anchor Point is
unkeyframed on both templates. Verified by the build reporting the anchors it
set: img001 (927, 925), img002 (1024, 900), img005 (1051, 885), and (1024, 1024)
— the canvas centre — where content is already centred.

**Effective subject size, before and after:**

| slot | before | after | change |
|---|---:|---:|---|
| img001 | 266 px | 294 px | +10.5% |
| img002 | 421 px | 619 px | **+47.0%** |
| img003 | 287 px | 287 px | unchanged |
| img004 | 534 px | 534 px | unchanged |
| img005 | 435 px | 447 px | +2.7% |

**No clearance or fill constant was changed**, as instructed, and the
three-variant parameter still works.

Nine tests in `content-box.test.ts`, including the corpus's worst case
(img002-c1, a 520 × 1394 subject in a 2048 canvas) and the identity case.

### Goal 3 — the missing words

`npm run diagnose:missing` → `benchmarks/RESULTS-block7-missing-cards.md`.

**The interval.** `0:00:08:23`–`0:00:11:27` at 30000/1001 (29.970030 fps),
taking a timecode frame as `frame / fps` past the whole second, is
**8.767 s to 11.901 s**.

**Nothing is skipped.** `buildReel` drops a card only for a missing
`templateId`, missing display timing, or a missing file — never for being short.
Every card in the span is placed in the comp. What makes them unreadable is that
**a card's whole life can be shorter than its own entrance**: `sub_pop` animates
opacity 0→100 and a blur to zero over `introS` 0.13 s, which is 3.9 frames, and
a card on screen for 0.040 s is 1.2 frames. It never reaches full opacity, so it
registers as a faint smear — indistinguishable from absence.

**Every word in the span with nothing readable, and why:**

| word | text | card | on screen | reason |
|---|---|---|---:|---|
| w0027 | Silk | g028 | 0.241 s | superseded by k002; the keyword renders instead |
| w0028 | mn | g029 | 0.040 s | 1.2 frames against a 3.9-frame intro |
| w0029 | ghir | g030 | 0.140 s | 4.2 frames, most of it the intro |
| w0030 | anno | g031 | 0.200 s | 6.0 frames |
| w0032 | nourrit | g033 | 0.040 s | 1.2 frames |
| w0035 | fih | g036 | 0.140 s | 4.2 frames |

**No word is missing for a reason off that list** — none is removed, none is
outside a card, none was dropped by the builder.

**Is the interval unusual? Worse than the reel, but the same defect.**

| reel | cards | below the floor | share |
|---|---:|---:|---:|
| ground-truth | 76 | 33 | 43% |
| test-1 | 67 | 21 | 31% |
| test-2 | 69 | 26 | 38% |
| test-3 | 58 | 18 | 31% |
| vitasilk | 73 | 22 | 30% |
| **all** | **343** | **120** | **35%** |

**Goal 3.5 — there IS an offset, and it is not the gap effect.** This is the
finding of the session and it corrects a claim made earlier in the same session.

Over 8.267–12.401 s, **Scribe reports 10 word tokens and the plan carries 11**.
The correction pass **inserted** `mn` and **merged** Scribe's `ستة` and
`وعشرين` (six-and-twenty) into the single token `26`. Levenshtein anchoring
carried the mismatch forward:

| plan word | opens at | its own Scribe token is at | early by |
|---|---:|---:|---:|
| `ghir` (`غير`) | 8.939 | 9.079 | 0.140 s |
| `anno` (`أنه`) | 9.079 | 9.279 | 0.200 s |
| `il` (`ينغّي`) | 9.279 | 9.819 | **0.540 s** |

**This is `service/src/transcription/align.ts` — a Block 2 question.** Nothing
in grouping, display timing or the builder moved these numbers. One-word cards
did not cause it; they made it visible word by word instead of blurred across a
two-word card.

**And it corrects session 6.** Checking "does this interval exist somewhere in
the Scribe response" passes 7 of 11 here and passed 21 of 21 over 1.5–8.0 s,
which reads as confirmation and is not one: an interval can be real and belong
to a different word. Session 6's span happened to contain no insertion, so its
conclusion held there — but the check was too weak to have established it.

### Goal 4 — a card holds until the next word

**Measured first.** With windows extended to the next card's word:

| reel | cards | unbuildable before | after | median duration before → after | blank screen before → after |
|---|---:|---:|---:|---|---|
| ground-truth | 76 | 33 | 33 | 0.230 → 0.260 | 2.771 s → 0.000 |
| test-1 | 67 | 21 | 21 | 0.261 → 0.320 | 3.470 s → 0.000 |
| test-2 | 69 | 26 | 26 | 0.239 → 0.280 | 3.444 s → 0.500 |
| test-3 | 58 | 18 | 18 | 0.241 → 0.319 | 3.616 s → 0.080 |
| vitasilk | 73 | 22 | 22 | 0.259 → 0.319 | 3.948 s → 0.080 |
| **all** | **343** | **120** | **120** | | **17.25 s → 0.66 s** |

**The hold does not reduce the unbuildable count at all, and that is arithmetic
rather than a disappointment.** The old rule already extended to the next card's
start whenever the floor could not be reached, so a card that was short stays
exactly as short — the room simply is not there. What the hold changes is the
cards that *could* already reach their floor: they now hold to the next word
instead of stopping at the floor. **The screen is essentially never blank
between cards.**

**`MAX_SUBTITLE_HOLD_S = 1.2`**, in `display-timing.ts`, **CHOSEN, NOT
MEASURED**, with the comment saying what would change it. **3 cards in the whole
corpus reach it** — it is a guard against a long silence rather than a rule that
shapes the normal case. It coincides with `MAX_GROUP_DURATION_S`; the comment
says the two are separate numbers that happen to agree.

**The last card of a reel** holds to the reel's end under the same bound. Ending
it at its word would single out the one card whose successor happens not to
exist.

**Second homes searched before changing anything**, per the standing rule:
`display-timing.ts` (computes), `timing-budget.ts` (re-derives, clears the
fields deliberately), `buildability.ts`, `retiming.ts`, `regroup.ts` (carries
through), `reel-plan.ts` (reads), `validate.ts` (`displayEnd < displayStart` and
`displayEnd < end` both still hold — the hold only ever moves `displayEnd`
later), and the two diagnostic CLIs. All are listed in the session log.

**Goal 4.4 — the null-floor check was made explicitly.** A dry run reporting 0
unbuildable everywhere is session 5's null-floor defect. The run reported
**120**, so the order (grouping → assignment → display timing → SFX) held.

**Cards still unbuildable after the change: 120, named per reel in the plans.**
On vitasilk, 22 — `g001` "5" (0.000 s), `g014` "ghayrdd" (0.040), `g029` "mn"
(0.040), `g033` "nourrit" (0.040), `g051` "chno" (0.030), and 17 more between
0.120 and 0.220 s. These are the user's to rule on visually.

Eight tests: a window never starts before its word; never overlaps the next
window; never exceeds the bound; the last card follows the stated rule; a card
is never cut below its own word.

### Goal 5 — `sourceText`

**Before**, `service/src/transcription/plan-builder.ts`:

```ts
sourceText: draftWords[i]?.text ?? word.text,
```

**After**:

```ts
sourceText: word.sourceText ?? word.text,
```

with `alignCorrectedOntoDraft` carrying `sourceText: anchor.text` onto each
anchored word — the aligner already knows `pair.refIndex`, so the information
existed and was thrown away. `TranscriptWord.sourceText` is optional, undefined
on an interpolated word, which is what the field's contract says.

**The repair was got wrong once, and the wrong values were written to all five
plans before it was caught.** Re-running the aligner from the cache produced a
*different* alignment from the one whose timings are on the plan — same code,
but the draft array is rebuilt from cached JSON rather than being the array the
original run used — so `sourceText` briefly described one alignment beside
timings from another. Nothing was lost: the field is provenance and the plans
were rewritten immediately. The second repair matches each word's **stored
interval** against the cached Scribe response, which is exact and
self-consistent by construction. **343 of 343 words now correct**, verified by
re-reading every plan.

An outcome worth stating: the field now shows the alignment shift rather than
hiding it. `ghir` reads `sourceText: من`, which is exactly the wrong token, and
that is the truth about what it anchored to.

Three tests in `align.test.ts`, including the insertion case that caused the
original defect.

### Goal 6 — rebuilt

`.local/build/vitasilk-full.aep`, gitignored. **Five master comps, 85 layers
each** (68 subtitles, 3 keywords, 5 images, 8 audio, 1 footage), 76 elements,
**0 skipped**, pre-flight passed on 15 files, build wall clock **2.5 s**.

| comp | differs by |
|---|---|
| `master_vitasilk_A` | retiming A |
| `master_vitasilk_C` | retiming C. **Active**, playhead at 9.0 s |
| `master_img_a` | retiming C, images as built |
| `master_img_b` | retiming C, images filling their zone |
| `master_img_c` | retiming C, images at the measured maximum |

**A and C are still different.** The hold sets `displayEnd` to the next card's
**word start**, while C's out-point is the next card's **in-point**, which is
`introS` earlier. The two arms differ by 0.13 s at each transition, as before,
and the check that throws if in-point or position differs between them did not
fire.

**71 cards measured in AE, 1 wrapped** (a two-word keyword), **1 overflows** —
`g071` "matrddadich", 2048 px against the 1940 bound, a single word with no
break point. **Nothing failed to build.**

## Deviations

1. **Goal 2's position correction moves the anchor point, not the position.**
   The goal said "position by content centre"; After Effects refuses `setValue`
   on `img_slide_left`'s keyframed Position. The anchor achieves the same
   placement without touching the template's animation.

2. **`buildTranscript` lost its `draftWords` parameter.** With `sourceText`
   coming from the aligner it had no remaining reader, and lint failed on it.
   The signature change is internal; `job.ts` is the only caller.

3. **`tools/cv/content_boxes.py` is a standalone script, not a sidecar task**,
   for the same reason as session 6's `head_boxes.py`: it reads files already on
   disk and runs no model.

## Failures & open problems

- **The alignment shift is diagnosed and not fixed.** `align.ts` mis-anchors
  after an insertion or a merge; on vitasilk one word opens 0.540 s early. It is
  a Block 2 question and touching it invalidates the transcription cache, which
  bills.

- **120 of 343 cards remain unbuildable** and the hold rule does not help them.
  Every one is a word too short for a 4-frame entrance. The ways out — a faster
  intro, a shorter minimum hold, or accepting a snap — are all rulings.

- **`sourceText` was wrong twice in one session**, once inherited and once
  introduced by my own repair. The second was caught by inspection rather than
  by a test; there is still no test that would catch a repair writing a
  self-inconsistent value onto a plan.

- **The image measurement is one reel deep for the effective-size table.**
  `test-1` has candidates but no cutouts measured against its own slots in the
  "everything multiplied out" table.

- **`img004` carries the wrong template for its presentation** and is left that
  way.

- **Nothing verified that a bigger image does not now collide with the speaker.**
  Content-aware scaling enlarges img002 by 47% about a fixed centre; no
  constraint check ran afterwards.

- **`MAX_SUBTITLE_HOLD_S` is a guess** that 3 cards in the corpus exercise.

- **The A/C retiming question is unanswered on its fourth build**, and the image
  size question on its second.

- Carried forward: all 13 multi-word Arabic runs split across cards; the
  pipeline is 4K-only; the built reel uses first candidates regardless of the
  image gate, which passed 2 of 10 on vitasilk.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 7 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit containing it.
- Commits this session, in order: `docs: measure how much of a placed square the
  subject fills`; `feat: scale and centre an image by its content`; `docs:
  explain the words with nothing on screen`; `docs: correct the offset finding
  with a per-token comparison`; `feat: hold a subtitle card until the next word
  begins`; `fix: take sourceText from the anchor, not the index`; `fix: move an
  image by its anchor, not its keyframed position`; `refactor: drop the unused
  draft word list from buildTranscript`; `docs: record block 7 session 7 in the
  operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **1004 passed** across
  70 files (core 151 / 6, service 687 / 48, benchmarks 166 / 16); Python **141
  passed**. `validate-templates: 6 template(s) ok`; all four references
  `v1.0.8-conformant`; both model pins ok.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` —
  identical to start-of-session. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical. Opened only as an import source.
- After Effects: **1 instance at start and end**, PID 44015.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

The alignment shift is now the most valuable thing on the list, because it is
the only defect left that puts a word on screen at the wrong moment rather than
merely too briefly, and because it is upstream of everything this block builds.
Fixing it means changing `align.ts` and re-running transcription, which bills —
so the next session should begin by deciding whether to spend, and if so, on
which reels. Everything else waiting is a look: the image size across three
variants now that the subject actually fills its square, the A-versus-C retiming
question on its fourth build, and the 120 short cards, which are the arithmetic
of one word per card meeting a four-frame entrance and will not resolve until
someone watches them and says whether a snap is tolerable.
