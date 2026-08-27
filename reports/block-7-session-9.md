Status: PROBLEM — goal 4 not fixed: the aligner fix was implemented, measured as a regression, and reverted

# Block 7 session 9 — top-left framed images, and an aligner fix that failed

Spent **$0.00**. No Gemini call, no ElevenLabs call, no image regenerated, no
billable request. Ledger byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` byte-identical: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` — the
template was read and audited, never edited.

**After Effects: 1 instance at start and end**, PID 44015, no `-r`. Helpers
excluded; re-checked before every `DoScript` and never changed. **No new
dependency.**

Five of six goals are complete. **Goal 4 is not**: the fix was written, measured
against the reel, found to be a regression, and reverted. Detail below.

## Done

### Goal 1 — the face mask has been rendered

`npm run face-sheets` → five sheets in
`benchmarks/results/latest-face/`, one per reel, the face mask tinted over the
real frames. **The sidecar's `head_overlay` task was reused, not replaced** — it
tints whichever mask it is handed and does not know which categories went into
it, so the face sheet is the same code, tint and labels as Block 5's head
sheets.

**Absolute paths:**

- `/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-face/ground-truth-face-contactsheet.png`
- `/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-face/test-1-face-contactsheet.png`
- `/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-face/test-2-face-contactsheet.png`
- `/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-face/test-3-face-contactsheet.png`
- `/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-face/vitasilk-face-contactsheet.png`

**The frame most worth checking on each**, chosen as the one where the mask has
shrunk furthest from its reel's median — under-coverage shows as a mask pulling
away from the face it protects:

| reel | frame | face area | below median by |
|---|---|---:|---:|
| ground-truth | 0027 | 0.00685 | 6.3% |
| test-1 | 0006 | 0.00740 | **20.4%** |
| test-2 | 0038 | 0.00811 | 10.1% |
| test-3 | 0033 | 0.01219 | 6.3% |
| vitasilk | 0044 | 0.03003 | **19.8%** |

**Nothing is frozen on my reading of these.** The proxy points the eye; the
ruling is the user's.

### Goal 2 — images are top-left

**Measured before implementing, and the ruling holds beyond the reel it was made
on.** Largest square anchored top-left that clears the mask across every sampled
frame:

| reel | vs face mask | fraction | binds | vs head mask |
|---|---:|---:|---|---:|
| ground-truth | 898 px | 0.416 | left of face | 803 px |
| test-1 | 838 px | 0.388 | left of face | 759 px |
| test-2 | 882 px | 0.408 | left of face | 779 px |
| test-3 | 995 px | 0.461 | above face | 951 px |
| vitasilk | 834 px | 0.386 | left of face | 523 px |

**The corner is clear on all five.**

**It costs a little size**, and the user should know: against session 8's
`master_img_face`, img001 is equal and the other four are **3.2% to 7.5%
smaller** (28–68 px). He ruled on the corner, not on the last 7%.

**Zero concurrent image pairs** across all five reels — 0 on every reel — so
nothing stacks in the corner and that sub-question does not arise.

**Implemented** in `service/src/placement/top-left.ts`.
`TOP_LEFT_MARGIN` 0.03 (65 px) and `TOP_LEFT_JITTER` 0.06, both **chosen, not
measured**, recorded as such at the constants. **Jitter is one-sided**: it can
only shrink the square, so it cannot grow onto the face or past the frame —
holding by construction rather than by a clamp, which is Block 5's rule.

**Asserted on all five reels: 9 slots placed, 0 outside the frame, 0 overlapping
the face.** Seven unit tests, including the tightest real face box in the corpus
across fifty seeds.

**The zone machinery is retired for automatic image placement, not removed.**
Manual zones still round-trip, the derivation stays, and the plans keep their
solved placements — the treatment Block 6 gave torso geometry.

**Recorded as an amendment** to PROJECT_SPEC §4 and ARCHITECTURE §5.5 in the
module's own doc comment and in `CLAUDE.md`, with the user's reason.

### Goal 3 — every image is framed, and the frame fits

`img_float` is forced for every slot. On `vitasilk` **two slots change**:
`img002`, which was `cutout`, and `img004`, which was a `card` carrying
`img_slide_left` — the cutout template — a mismatch session 8 reported.
`img_slide_left` stays in the library and the manifest, and
`validate-templates` still passes on it.

**Consequences, stated and not acted on:**

- `presentation` and the cutout gate **now decide nothing** about how an image
  renders. The gate, its metrics and the sidecar are untouched. PROJECT_SPEC §5
  gives the editor an override and Block 8's panel is where presentation may
  become a per-slot choice again.
- **Background removal still runs**, producing an artifact nothing displays. Its
  measured cost is the segmentation pass: **39 s for all five reels**
  (7.0–8.6 s each). **Not removed** — whether to keep generating cutouts is a
  ruling for the conversation.

**The misalignment, diagnosed from the audit.** `audit.jsx` now records each
layer's **parent**, which decides whether a position is in comp space or its
parent's — the audit could not answer the question before.

| comp | layer | parent | size | position | anchor | scale |
|---|---|---|---|---|---|---|
| img_float | IMG_MAIN | **CARD** | 1000×1000 | [540, 540, 0] | [500, 500, 0] | 100% |
| img_float | CARD | none | 1080×1080 | [600, 600, 0] | [540, 540, 0] | 100% |
| img_slide_left | IMG_MAIN | none | 1000×1000 | [600, 600, 0] | [500, 500, 0] | 100% |

**The cause, verified against real slots rather than asserted.** `CARD` is a
fixed 1080 px and does not scale with the picture. Session 7's content-aware
scaling sizes the **content** to the solid's 1000 px — right for a cutout, whose
margin is transparent, wrong for a card, whose margin is picture. The canvas
then renders at `1000 × canvas/content` and spills past the frame whenever the
content fills less than **1000/1080 = 0.926** of its canvas:

| slot | content fraction | canvas renders | verdict |
|---|---:|---:|---|
| img001 | 0.905 | 1105 px | **overflows by 25 px** |
| img002 | 0.681 | 1468 px | **overflows by 388 px** |
| img003 | 1.000 | 1000 px | fits, 40 px border |
| img004 | 1.000 | 1000 px | fits, 40 px border |
| img005 | 0.973 | 1028 px | fits, 26 px border |

**Two of five — exactly the "some slots" reported.** The goal's hypothesis was
right in substance and wrong in mechanism: the frame does not diverge by the
content factor, it is the *picture* that grows past a fixed frame.

**Fixed in the builder, not the template**: a card is sized by its canvas
(`canvasScalePercent`). Confirmed on the build — all five slots now render
1000 px inside the 1080 px frame. Four tests pin the frame tracking the image
across two real content factors and a sweep of canvas sizes.

### Goal 4 — NOT fixed

**The defect is precisely located.** Reproduced from the cache, free:

```
op          ref  hyp  draft        corrected    interval
match       26   27   Silk         Silk         8.619-8.860
delete      27        من                        8.939-9.000
substitute  28   28   غير          mn           9.079-9.199
substitute  29   29   أنه          ghir         9.279-9.759
substitute  30   30   ينغّي،       annaho       9.819-10.519
```

The aligner deletes draft token 27 (`من`) and every substitution after it is
shifted by one: `mn` — which *is* `من` — takes `غير`'s interval, `ghir` takes
`أنه`'s, and `il` opens 0.540 s before its own token.

**Goal 4.1/4.3 — how anchors are chosen, and the real cause.** `align()` is
plain Levenshtein over normalized tokens with four operations: match,
substitute, insert, delete. **There is no many-to-one operation**, so a merge
(`ستة` + `وعشرين` → `26`) is expressed as one substitute plus one delete. But
that is not what breaks it. **The draft is Arabic script and the corrected text
is Arabizi**, so a cross-script pair never matches by string and every
substitution in such a run costs exactly the same. Levenshtein has **no signal
at all**, and the path it picks among the ties is arbitrary. Draft 72 tokens
against corrected 73 forces one net insertion somewhere, and it landed badly.

**Goal 4.4 — the fix was written, measured, and reverted.** I required an anchor
to be a match or a substitution between tokens of the *same script*, on the
reasoning that a cross-script substitution is not evidence of correspondence.
Measured on the reported interval before applying:

| word | old interval | new interval | new anchor |
|---|---|---|---|
| mn | 8.899–8.899 | 9.262–9.262 | interpolated |
| ghir | 8.939–9.000 | 9.665–9.665 | interpolated |
| il | 9.279–9.759 | 10.470–10.470 | interpolated |
| fih | 11.479–11.579 | 12.079–12.739 | **`vitamin`** |
| 26 | 11.619–12.039 | 12.799–12.859 | **`et`** |
| vitamines | 12.079–12.739 | 12.920–13.179 | **`aussi`** |

Removing cross-script anchors removed nearly every anchor, and the surviving
Latin tokens then paired across long distances — **a three-token shift against
the old one-token one**, seven words reduced to zero-duration points, and
**2 duplicate intervals** where there had been none. Across the corpus it moved
144 timings and dropped anchored words from 330 to 230.

**It is a regression and it was reverted. `align.ts` is unchanged and no plan
was written.** The repair CLI was deleted rather than left as a trap.

**Goal 4.6 — the check exists and passes, which is the finding.** Four tests in
`align.test.ts` assert that a word's interval is the interval of the draft token
it records anchoring to — across a clean sequence, an insertion and a deletion.
**They pass on the current aligner.** The defect is not a wrong
interval-to-token mapping; it is the aligner choosing a semantically wrong
*pairing* among equal-cost paths, and **no check on the aligner's own output can
see that** without knowing that `ghir` is `غير`.

**What it actually needs: transliteration-aware matching** — a cost function
that knows Arabizi `ghir` and Arabic `غير` are the same word. That is real
Block 2 design work.

**Goals 4.5 and 4.7 were therefore not completed**: no re-alignment was applied
and no display timing or SFX was re-derived from one.

### Goal 5 — a short card gets a faster entrance

`service/src/build/short-card.ts`. Where a card cannot fit `introS + minHoldS`,
**the instance is time-stretched** — `layer.stretch`, applied before the in and
out points because a stretch changes the layer's duration. **No keyframe is
touched**, per TEMPLATE_LIBRARY_GUIDE §5, and the template is untouched: the
same instance can be stretched differently in two masters.

`MIN_INTRO_S` is **two frames at 29.97 (0.0667 s), chosen not measured**, with
the reason at the constant: below two frames an entrance stops reading as motion
and becomes a flash.

| reel | cards | shortened | on the two-frame floor | still unbuildable |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 33 | 9 | **0** |
| test-1 | 67 | 21 | 7 | **0** |
| test-2 | 69 | 26 | 4 | **0** |
| test-3 | 58 | 18 | 3 | **0** |
| vitasilk | 73 | 22 | 5 | **0** |
| **all** | **343** | **120** | **28** | **0** |

**No card is left unbuildable.** The 28 on the floor are the ones to watch: they
get two frames and no more, because their words are shorter than that.

Eight tests: the floor is never breached at any duration, a long card keeps the
full 0.13 s, the stretch never exceeds 100%, and the output is a stretch and
nothing else.

### Goal 6 — rebuilt

`.local/build/vitasilk-full.aep`, gitignored. Build wall clock **8.2 s**,
76 elements, **0 skipped**.

| comp | subtitles | keywords | images | audio | total layers |
|---|---:|---:|---:|---:|---:|
| `master_final` | 68 | 3 | 5 | 8 | **85** |
| `master_subs_only` | 68 | 3 | **0** | **3** | **75** |

`master_subs_only` differs in exactly one thing: the images and the audio that
belongs to them. Both are built from the same element list.

**Verified:** 0 placements outside the frame, 0 images overlapping the face
mask, every image framed (`img_float` on all five), and every card's in-point
`introS` before its own word — never after.

**Active comp: `master_final`, playhead at 9.5 s.**

## Deviations

1. **Goal 4 was reverted rather than shipped.** The instruction was to fix it;
   the fix measured as a regression. Shipping it would have been worse than the
   defect.

2. **Goal 3's stated hypothesis was wrong in mechanism** and I report the real
   mechanism instead: the frame does not diverge by the content factor, the
   picture grows past a fixed frame. The arithmetic is verified against real
   slots either way.

3. **`audit.jsx` was extended** to record layer parenting. The goal said to
   diagnose from the audit; the audit could not answer without it. The template
   was not touched and its sha256 is unchanged.

## Failures & open problems

- **The alignment slip is unfixed** and is the user's oldest outstanding
  subtitle defect. It needs transliteration-aware matching.

- **28 cards get a two-frame entrance**, the minimum. Whether that reads is
  unjudged.

- **The face mask is rendered but unreviewed.** Two reels have a frame ~20%
  below their median area — those are where to look.

- **The top-left rule is measured on face-mask bounding boxes**, not silhouettes,
  so it is conservative.

- **Background removal still runs** at 39 s per corpus pass, producing cutouts
  nothing renders.

- **The variant comps from session 8 are gone**, replaced by `master_final` and
  `master_subs_only`. If the user wanted to re-compare sizes, that now needs a
  rebuild.

- Carried forward: all 13 multi-word Arabic runs split across cards; the
  pipeline is 4K-only; the built reel uses first candidates regardless of the
  image gate.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 9 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit containing it.
- Commits this session, in order: `feat: place images top-left and frame every
  one`; `feat: give a short card a faster entrance`; `docs: record block 7
  session 9 in the operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **1034 passed** across
  73 files (core 151 / 6, service 717 / 51, benchmarks 166 / 16); Python **141
  passed**.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` —
  identical to start-of-session. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical.
- After Effects: **1 instance at start and end**, PID 44015.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

The alignment slip is now the only defect left that puts a word on screen at the
wrong moment, and this session established what it will actually take: the draft
is Arabic script and the corrected text is Arabizi, so the aligner is choosing
among tied costs with no signal, and no tie-break heuristic fixes that — it needs
a cost function that knows `ghir` and `غير` are the same word. `SCRIPT_RULES` in
`core` already encodes that transliteration for the correction prompt, so the
knowledge exists in the repo and the work is to turn it into a distance measure
and re-align from cache, which stays free. Everything else in front of the user
is a look: the face-mask sheets, whether an image over the torso reads as
composition, and whether a two-frame entrance reads at all.
