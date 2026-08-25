# The complete analysis stage on two reels

Block 3 session 5, the last feature session of the block. Both reels through
transcription-derived groups, keyword selection with keyword-aware re-grouping,
image slot planning, deterministic template assignment, and derived SFX — then
checked for buildability. **No image is generated; that is Block 4.**

Mode `k2-syndicalia` v2, keyword prompt version 2, slot prompt version 1,
`gemini-3.1-pro-preview`, stub template manifest.

## Keyword / subtitle-group alignment

The measurement the rule was decided from, taken **before** anything changed.
Every word belongs to a subtitle group, grouping ran with no knowledge of
keywords, and nothing said what renders when both claim a word.

| reel | keyword | span | groups it touched | verdict |
|---|---|---|---|---|
| vitasilk | k001 `filler glow` | w0021–w0022 | g012 | exact |
| vitasilk | k002 `Vita Silk` | w0026–w0027 | g014 `marque Vita`, g015 `Silk mn` | **straddles two** |
| vitasilk | k003 `lissage brésilien` | w0048–w0049 | g026 `dial lissage`, g027 `brésilien chno` | **straddles two** |
| test-1 | k001 `محفزات الكولاجين` | w0020–w0021 | g011 | exact |
| test-1 | k002 `injections` | w0025 | g013 `des injections` | inside a 2-word group |
| test-1 | k003 `شد` | w0001 | g001 `bghiti شد` | inside a 2-word group |

**Across both reels: 2 exact, 2 inside a larger group, 2 straddling two
groups.** Four of six keywords could not have been rendered as a replacement
for their group, because there was no single group to replace.

**After the re-grouping pass, all six align exactly**, every group is still
1–2 words, and no keyword was dropped. vitasilk went 40 → 42 groups and test-1
36 → 38, which is the two straddles and the two inside-splits each adding one
cut.

The rule now recorded in the plan: a keyword **replaces** its group's
rendering, and the group carries `supersededBy: "<keyword id>"`. The builder is
told rather than left to infer it from overlapping time ranges.

## Final state — vitasilk, 25.7 s

**Keywords** (all 2 words, all `kw_slam`):

| id | text | score | supersedes | reason (verbatim) |
|---|---|---|---|---|
| k001 | `filler glow` | 0.99 | g012 | identifies the specific product being promoted |
| k002 | `Vita Silk` | 0.98 | g015 | names the brand behind the treatment |
| k003 | `lissage brésilien` | 0.95 | g028 | specifies the cosmetic procedure category |

**Image slots:**

| id | window | template | idea (verbatim) |
|---|---|---|---|
| img001 | 1.60–2.68 s | img_slide_left | A timer display showing five minutes. |
| img002 | 4.26–6.22 s | img_float | Smooth, straight, and silky hair flowing. |
| img003 | 10.56–11.28 s | img_slide_left | Water droplets splashing onto hair strands. |
| img004 | 14.28–16.88 s | img_float | A woman with perfectly straightened hair. |
| img005 | 24.60–25.48 s | img_slide_left | A woman looking at a wristwatch. |

**SFX events** (8, all derived — nothing hand-authored):

```
sfx001 img001 whoosh_01  @1.60s  -9dB     sfx005 img003 whoosh_01 @10.56s  -9dB
sfx002 img002 whoosh_01  @4.31s -12dB     sfx006 img004 whoosh_01 @14.33s -12dB
sfx003 k001   hit_01     @7.08s  -6dB     sfx007 k003   hit_01    @15.86s  -6dB
sfx004 k002   hit_01     @8.34s  -6dB     sfx008 img005 whoosh_01 @24.60s  -9dB
```

No subtitle group produces an event, which is TEMPLATE_LIBRARY_GUIDE §10's
rule that subtitles carry no SFX because they are too frequent — 42 groups
would have meant 42 sounds.

**Buildability: NO — 31 issues.** 26 of 42 subtitle groups, 2 of 3 keywords
and 3 of 5 image slots are shorter than their template needs.

## Final state — test-1, 22.0 s

**Keywords** (all 2 words, all `kw_slam`):

| id | text | score | supersedes | reason (verbatim) |
|---|---|---|---|---|
| k001 | `محفزات الكولاجين` | 0.95 | g012 | names the specific aesthetic procedure being promoted |
| k002 | `شد طبيعي` | 0.92 | g002 | asserts the primary physical benefit of the treatment |
| k003 | `jawdat البشرة` | 0.88 | g038 | states the ultimate quality outcome for the patient |

**Image slots:**

| id | window | template | idea (verbatim) |
|---|---|---|---|
| img001 | 0.10–1.38 s | img_slide_left | A side profile of a woman's face with subtle graphical upward arrows along the jawline indicating a lifting effect. |
| img002 | 5.74–6.76 s | img_float | A macroscopic view of glowing collagen fibers forming a strong web under the skin surface. |
| img003 | 10.86–12.54 s | img_slide_left | Fingers gently pinching the youthful, firm skin on a cheek to demonstrate elasticity. |
| img004 | 20.04–21.94 s | img_float | A close-up of a woman's face with perfectly smooth, radiant, and hydrated skin. |

**SFX events** (7):

```
sfx001 img001 whoosh_01  @0.10s  -9dB     sfx005 img003 whoosh_01 @10.86s  -9dB
sfx002 k002   hit_01     @0.50s  -6dB     sfx006 img004 whoosh_01 @20.09s -12dB
sfx003 img002 whoosh_01  @5.79s -12dB     sfx007 k003   hit_01    @20.94s  -6dB
sfx004 k001   hit_01     @5.84s  -6dB
```

**Buildability: NO — 25 issues.** 23 of 39 subtitle groups, 1 of 3 keywords and
1 of 4 image slots are too short.

## Buildability is the session's real finding

| | vitasilk | test-1 |
|---|---|---|
| subtitle groups too short | 26 of 42 | 23 of 39 |
| keywords too short | 2 of 3 | 1 of 3 |
| image slots too short | 3 of 5 | 1 of 4 |
| worst shortfall | 0.60 s | 0.57 s |
| median shortfall | 0.24 s | 0.26 s |

`sub_pop` needs 0.60 s of intro + hold + outro. Half the subtitle groups on
both reels are shorter than that, some far shorter — vitasilk's `g016` is
**0.00 s long**, an interpolated word whose start and end are the same
instant. Nothing was extended: the check reports and leaves.

Two things are true at once and both need saying:

- **The stub timings are guesses.** No `.aep` exists; `introS`, `outroS` and
  `minHoldS` are plausible defaults, not measurements from a built comp. Real
  numbers from Block 6 will move every one of these figures.
- **The shape of the problem will survive better numbers.** A word spoken in
  0.08 s cannot carry any animation with a distinguishable intro and outro. It
  is a real conflict between PROJECT_SPEC §5's 1–2 word fast-reel subtitles and
  a template contract with intro/hold/outro at all, and it is the user's to
  settle — hold a group past its words, allow a minimum-duration floor in
  grouping, or design subtitle templates with near-zero intro.

## Template assignment

With the current stub, one variant per type makes assignment trivial:
vitasilk's 42 groups are all `sub_pop`, its 3 keywords all `kw_slam`, and its 5
slots alternate `img_slide_left` / `img_float` from the two the mode allows.

The multi-variant path is what Block 9 will actually exercise, so it is built
and tested now, against a fixture mode carrying 3 subtitle, 2 keyword and 4
image variants:

| type | elements | distribution | longest run |
|---|---|---|---|
| subtitle | 42 | sub_wipe 14, sub_pop 14, sub_slide 14 | **1** |
| keyword | 3 | kw_glitch 2, kw_slam 1 | **1** |
| image | 5 | img_zoom 2, img_float 1, img_slide_left 1, img_pan 1 | **1** |

Perfectly even across 42 subtitle elements, and **no variant ever repeats back
to back** on any sequence. Checked over the whole sequence rather than adjacent
pairs, which is session 4's slot-5 lesson applied: the walk uses a stride
coprime to the variant count plus a per-cycle bump, so a sequence longer than
the variant list does not repeat its opening run either.

## Cache hit

Both stages re-run on vitasilk without `--no-cache`:

- **$0.0000** each, no new ledger line (68 lines before, 68 after).
- Ten differing leaves, every one bookkeeping: `meta.updatedAt`, both stages'
  `costUsd`/`cached`/`completedAt`, `costs.totalUsd`, and
  `costs.byStage.analysis` and `.images`.

Keywords, groups, supersession, slots, templates and SFX events were identical.

## Spend

| | |
|---|---|
| billable calls | 4 |
| session spend | $0.249868 |
| ledger all-time before | $5.936884 (64 entries) |
| ledger all-time after | $6.186752 (68 entries) |

Gates held: vitasilk's two stages came to $0.1238 against a $0.25 stop, and
cumulative spend peaked at $0.2499 against a $0.70 stop. Everything in goals
1–5 that touched a plan ran on cache hits at $0.0000.

Estimates against actuals this session: $0.0533 / $0.0475, $0.0781 / $0.0763,
$0.0533 / $0.0745, $0.0627 / $0.0516. Right order of magnitude every time, and
under the actual once — a pessimistic gate is not a guarantee.
