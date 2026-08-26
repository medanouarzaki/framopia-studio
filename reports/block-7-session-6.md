Status: OK

# Block 7 session 6 — one word per card, and what was actually wrong at 4 s

Spent **$0.00**. No Gemini call, no ElevenLabs call, no billable request. Ledger
byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` byte-identical: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects: 1 instance at start and end**, PID 44015, command line
`/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects`,
no arguments, no `-r`. Helpers excluded. Re-checked before every `DoScript` by
`assertOneInstance`; never changed. Nothing launched, nothing killed. **No new
dependency.**

## Done

### Goal 1 — the 4 s report, diagnosed read-only

`npm run diagnose:timing` → `benchmarks/RESULTS-block7-timing-defect.md`.
Nothing was written, no constant changed.

**The timings are correct.** Checked against the raw Scribe response held in the
transcription cache — the only independent record of what was said when. **All
21 words in 1.5–8.0 s sit on an interval Scribe reports, for the same word**:
`minutes`/`minutes.` 2.339–2.679, `ymkn`/`يمكن` 2.720–3.119, `un`/`un`
3.799–3.939, `soin`/`soin` 4.000–4.159. Alignment did not slip.

**Corpus integrity, all five reels:**

| reel | words | zero-duration | negative | non-monotonic | interpolated | groups out of order | display starts early |
|---|---:|---:|---:|---:|---:|---:|---:|
| ground-truth | 76 | 4 | 0 | 0 | 4 | 0 | 0 |
| test-1 | 67 | 3 | 0 | 0 | 3 | 0 | 0 |
| test-2 | 69 | 1 | 0 | 0 | 1 | 0 | 0 |
| test-3 | 58 | 2 | 0 | 0 | 2 | 0 | 0 |
| vitasilk | 73 | 3 | 0 | 0 | 3 | 0 | 0 |

**13 zero-duration words, 13 interpolated words, and they are the same set** —
no word with a real Scribe anchor has zero duration. Named: ground-truth
`w0003` "pigmentés", `w0012` "3ndi", `w0053` "li", `w0054` "houa"; test-1
`w0008` "tb3i", `w0009` "m3aya", `w0010` "tal"; test-2 `w0020` "fa"; test-3
`w0016` "fa", `w0038` "pigmentés"; vitasilk `w0000` "5", `w0028` "mn", `w0050`
"chno". **None is near 4 s on vitasilk.**

**Anchored versus interpolated is recoverable**, which was in doubt: `confidence`
carries Scribe's per-slot value on an anchored word and is `null` on an
interpolated one. **Alignment quality is auditable after the fact** on any plan,
without re-running anything.

**`sourceText` is off by one on every word of every reel — 343 of 343 — and it
is cosmetic.** Each word's `sourceText` names the *next* word's draft token:
`w0006` is `text: minutes` / `sourceText: يمكن`, and `يمكن` is `ymkn`, which is
`w0007`. The cause is in `service/src/transcription/plan-builder.ts:43`: the
field is documented as "the draft word the corrected word anchored to" but is
assigned `draftWords[i]?.text`, **a positional index into a different array**.
The correction pass inserts words, so from the first insertion the two lists no
longer share an index. **Nothing reads it** — not grouping, not display timing,
not the builder. A real defect, and not this one. **Not fixed this session**;
goal 1 was read-only.

**Diagnosis: two candidates, and the data does not separate them.**

*Best supported* — the second word of a two-word card is on screen before it is
spoken. Pooled across the corpus over **153 two-word cards: min 0.130 s, median
0.410 s, max 0.870 s**. In the flagged span: `g004` "minutes ymkn" 0.511 s
early, `g005` "lik diri" 0.451 s, `g006` "un soin" 0.331 s, `g008` "ghayrdd
lik" 0.170 s — against cards only 0.36–0.78 s long, so the eye is ahead of the
ear for most of each card's life.

*Against it, stated because it is real* — this is not specific to 4 s. It
happens on every two-word card on every reel, and vitasilk has worse cases later
(`g023` at 0.830 s). If something particular was seen at 4 s, anticipation alone
does not explain why there.

*The other candidate* — `w0012` "li" is 0.080 s of speech and `w0013` "ghayrdd"
is 0.020 s. Two cards flash through in under a fifth of a second between 4.259
and 4.699, with a 0.34 s hole in the speech before the second. A card that
flashes reads as mistimed even when its timing is exact.

**Both are in the same half-second and both would produce what was reported.
Naming one would be a guess.** Neither is a defect of this block: the durations
come from Scribe and the alignment that carries them, and `findShortWords` has
been reporting them since Block 3.

### Goal 2 — one word per card

**Measured first, changing nothing.**

| reel | cards now | at one word | unbuildable now | at one word | shortest | median | longest |
|---|---:|---:|---:|---:|---:|---:|---:|
| ground-truth | 39 | 76 | 2 | 33 | 0.000 | 0.201 | 0.859 |
| test-1 | 42 | 67 | 3 | 21 | 0.000 | 0.261 | 0.639 |
| test-2 | 37 | 69 | 1 | 26 | 0.000 | 0.239 | 0.640 |
| test-3 | 31 | 58 | 0 | 18 | 0.000 | 0.241 | 0.660 |
| vitasilk | 41 | 73 | 1 | 22 | 0.000 | 0.259 | 1.260 |
| **all** | **190** | **343** | **7 (3.7%)** | **120 (35%)** | | | |

**The cost of the ruling is that 35% of cards are shorter than a template's
intro + minimum hold**, against 3.7% today. Those cards still build; they have
no room for a distinguishable intro and hold. 153 two-word cards split.

**Conflicts, reported before resolving.**

*ORTHOGRAPHY_GUIDE §6c.* Measured as maximal Arabic-script runs of 2+ words, an
upper bound on multi-word §6 terms: **13 across the corpus** (ground-truth 2,
test-1 6, test-2 1, test-3 4, vitasilk 0). **10 already split across cards under
two-word grouping; all 13 split under one word.** One-word grouping makes §6c
**strictly worse**. Term-aware grouping was not implemented — Block 6
established the model cannot supply term boundaries reliably and that stands.

*Keyword spans.* **5 of 8 keywords are two words**: test-1 `k002`
"محفزات الكولاجين", test-2 `k002` "ترطيب عميق" and `k003` "شد خفيف", vitasilk
`k001` "filler glow" and `k002` "Vita Silk". Previously a span was collapsed
into one card and that card marked superseded. That is impossible at one word
per card, so **a span now supersedes the run of cards it covers** and the
keyword renders in their place. All five are flagged in the migration output for
the user's eye.

**Implemented.** `MAX_WORDS_PER_CARD = 1` in
`service/src/transcription/grouping.ts`. The two-word machinery is kept behind a
`maxWords` option rather than deleted — the gap and duration rules are what a
two-word card would need if the ruling is revisited — and every test that
exercised it now passes `maxWords: 2` explicitly, so it is still covered and
visibly labelled as the alternative.

**Three homes of one invariant, and the third was found by the validator
refusing to write.** "A keyword supersedes exactly one card" lived in
`regroup.ts`, in `buildability.ts`, and in `validate.ts`'s `checkSupersession`.
The migration failed mid-run on the third with
`keyword k002 already supersedes g021`. **Nothing was written half-migrated**:
`writeEditPlan` validates before writing, so `ground truth` (which has no
keywords) had been written and the other four were untouched. All three now
accept a span covering consecutive cards, and require the covered cards' words
to be exactly the span's, in order.

**The merge rescue is off, deliberately.** At one word per card every adjacent
pair is mergeable, so `applyDisplayTiming` would have merged the cards straight
back into pairs — reaching the template floor by doing exactly what the ruling
forbids. `MAX_GROUP_WORDS` follows the card rule, so merging disables itself,
and a card that cannot reach its floor is reported as before.

**The stage order inverts, and getting it wrong reproduced session 5's defect.**
Session 5 established display timing before assignment, because a merge created
a card with no template. With merging off nothing changes identity, and display
timing needs each card's template floor — so **assignment must come first**. The
first dry run had it the old way and reported **0 unbuildable on every reel**,
which is the null-floor symptom session 5 found on three reels. Corrected, it
reports 120.

**After the migration**, all five plans: 343 cards, **0 with more than one
word**, 0 without a template, 0 without display timing, 0 merges, all keywords
kept, none dropped.

| reel | cards | superseded cards | keywords | sfx events |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 0 | 0 | 0 |
| test-1 | 67 | 3 | 2 | 6 |
| test-2 | 69 | 5 | 3 | 3 |
| test-3 | 58 | 0 | 0 | 0 |
| vitasilk | 73 | 5 | 3 | 8 |

**No group lost a template id.** Every card is assigned by script, as session 4
established.

**Tests**: no card holds more than one word (on a real reel fixture), a two-word
keyword span still resolves and marks both cards, grouping is deterministic
across two runs, cards never pair however short the gap, every displayable word
is covered exactly once in order. `PROJECT_SPEC.md` §5 is amended with the
ruling and its cost.

### Goal 3 — how big the images could be

`npm run image-size` → `benchmarks/RESULTS-block7-image-size.md`. **No constant
was changed.**

| reel | slot | (a) built | (b) fill zone | (c) max allowed | (c)/(a) | binds (c) |
|---|---|---:|---:|---:|---:|---|
| vitasilk | img001 | 352 px | 378 | **699** | 1.99x | head |
| vitasilk | img002 | 742 px | 800 | 523 | 0.70x | head |
| vitasilk | img003 | 344 px | 378 | **651** | 1.89x | head |
| vitasilk | img004 | 641 px | 730 | 671 | 1.05x | head |
| vitasilk | img005 | 537 px | 634 | 675 | 1.26x | head |
| test-1 | img001 | 793 px | 857 | 771 | 0.97x | head |
| test-1 | img002 | 759 px | 873 | 759 | 1.00x | head |
| test-1 | img003 | 488 px | 538 | **759** | 1.56x | head |
| test-1 | img004 | 717 px | 857 | 771 | 1.08x | head |

**The head is the binding constraint on all nine slots** — named per slot for
the first time. (b) beats (a) on every slot, by 7–14%.

**(c) is not uniformly the largest, and that is a property of the measurement,
not the geometry.** It unions a head *bounding box* over the frames a slot is on
screen; zone derivation intersects per-frame maximal free rectangles from the
full person mask. On vitasilk `img002` that gives (c) 523 px against (b)'s 800.
**(c) is a floor on the true ceiling, not the ceiling**, and the results file
says so rather than presenting it otherwise.

**(b) cannot keep the jitter**, which the goal asked for: at `FILL_FRACTION` 1.0
the square already fills the region, and the solver draws the side before the
position precisely so jitter cannot leave it. (b) is the zone-filling ceiling
with no jitter — a property of the two settings together.

`HEAD_CLEARANCE` had no TypeScript home and is now mirrored into
`service/src/placement/constants.ts`, **pinned equal to `zones.py` by a test**,
as the repo rule requires. `tools/cv/head_boxes.py` reads head-mask bounding
boxes from masks already on disk; it runs no model.

### Goal 4 — rebuilt for review

`.local/build/vitasilk-full.aep`, gitignored. **Five master comps, 85 layers
each** (68 subtitles, 3 keywords, 5 images, 8 audio, 1 footage), 76 elements,
**0 skipped**, build wall clock 3.3 s.

| comp | differs by |
|---|---|
| `master_vitasilk_A` | retiming A — cards overlap 0.13 s at each transition |
| `master_vitasilk_C` | retiming C — the previous card yields. **Active**, playhead at 4.0 s |
| `master_img_a` | retiming C, images as built today |
| `master_img_b` | retiming C, images filling their zone |
| `master_img_c` | retiming C, images at the measured maximum |

**Two changes are never bundled.** A and C differ in subtitle out-points alone
and the check that throws otherwise is still in place and did not fire. The
three `master_img_*` comps hold retiming at C and differ in image size alone,
on the same centre.

**Wrapping almost disappears at one word per card**: 71 cards measured, **1
wrapped** (a two-word keyword) against 9 at two words. **1 still overflows** —
`g071` "matrddadich", 2048 px against the 1940 bound, a single word with no
break point.

**Nothing failed to build.** 73 cards less the 5 superseded by keywords is the
68 placed, with the 3 keywords in their place.

## Deviations

1. **`sourceText` was not fixed.** Goal 1 was read-only and said so. It is a
   real defect and it is reported rather than repaired.

2. **`master_img_a` duplicates `master_vitasilk_C`.** The goal asked for three
   comps named `master_img_a/b/c`; `a` is by definition what C already holds.
   It is built anyway so the three sit side by side and can be flipped between
   without the reader having to know that one of them lives under another name.

3. **A fourth invariant home was discovered mid-migration**, not before. The
   pre-migration conflict analysis found `regroup.ts` and `buildability.ts` but
   missed `validate.ts`. The validator caught it and nothing was corrupted, but
   the search for second homes was incomplete when it was made.

4. **`tools/cv/head_boxes.py` is a standalone script, not a sidecar task.** It
   reads masks already on disk and runs no model, so it needs none of the
   sidecar's protocol, and adding a task would have meant extending the pytest
   suite for something that does no inference.

## Failures & open problems

- **35% of cards are now unbuildable** — 120 of 343, against 7 of 190. They
  build, but with no room for a distinguishable intro and hold. This is the
  direct cost of the ruling and the largest open number in the project.

- **§6c is strictly worse**: all 13 multi-word Arabic runs now split across
  cards, against 10 before. Nothing was done about it and Block 6's finding —
  the model cannot supply term boundaries reliably — still blocks the only fix.

- **The 4 s diagnosis is two candidates, not one.** Anticipation and
  flash-through cards are both present in the same half-second. One-word cards
  remove the first entirely, so if the user still sees something wrong at 4 s
  on this build, the answer is the second.

- **`sourceText` is wrong on all 343 words** of all five plans.

- **(c) in the image measurement is a floor, not the ceiling**, because it uses
  a head bounding box over a span. A silhouette-based measurement would give a
  larger and truer number.

- **Nothing was measured about whether bigger images collide with anything.**
  The three variants scale about a fixed centre, so a larger image can extend
  where the solver would not have put it. They are for the eye, not for
  shipping.

- **The A/C retiming question is still unanswered**, now on its third build. One
  word per card changes every transition, so the question is genuinely re-asked
  rather than merely repeated.

- **The SFX have still never been heard**; gains are unjudged.

- **ground-truth, test-2 and test-3 still have no keywords** — that stage has
  never run on them and running it bills.

- Carried forward: the pipeline is 4K-only; the frame-rate float mismatch
  between library comps and a master built from 30000/1001; the built reel uses
  first candidates regardless of the image gate, which passed 2 of 10 on
  vitasilk.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: amend the spec to one word per card`.
  **This report's own commit follows it** — a report cannot name the commit
  containing it.
- Commits this session, in order: `docs: diagnose the reported timing offset on
  vitasilk`; `feat: put one word on a subtitle card`; `feat: add a free
  migration to one-word cards`; `feat: measure the image size ceiling and build
  three variants`; `docs: amend the spec to one word per card`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **987 passed** across
  69 files (core 151 / 6, service 670 / 47, benchmarks 166 / 16); Python **141
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

Three rulings are now waiting on the same sitting in front of this build, and
none of them is a code question. The image size is the easy one — flip between
the three `master_img_*` comps and say which reads. The retiming A versus C
question is on its third build and one-word cards have changed every transition,
so it is genuinely a new comparison rather than an old one repeated. The hard
one is the number this session produced: a third of all cards are now shorter
than a template's intro plus minimum hold, which is the arithmetic consequence
of one word per card meeting a 4-frame entrance, and the ways out are all
product decisions — a faster intro, a shorter minimum hold, holding a card into
the silence after its word, or accepting that a third of cards snap on without a
readable entrance. Watching the built reel is what will say which of those is
tolerable.
