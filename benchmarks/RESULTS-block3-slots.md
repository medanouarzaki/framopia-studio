# Keywords under the new constraints, and the first image slot plans

Block 3 session 4. Two reels through both analysis stages: keywords re-run
under the two-word span cap and head-term diversity rule, then image slots
planned for the first time. **No image was generated — that is Block 4.**

Mode `k2-syndicalia` v2, keyword prompt version **2**, slot prompt version 1,
`gemini-3.1-pro-preview`.

## Keywords

Count from duration at 4 per 30 s: 3 for both reels.

### vitasilk — 25.7 s, $0.0588, 94.7 s wall, cache miss

0 resolution failures, 0 diversity skips, **0 narrowed**, 0 text mismatches.

| id | keyword | words | score | reason (verbatim) |
|---|---|---|---|---|
| k001 | `filler glow` | 2 | 0.99 | identifies the specific product being promoted |
| k002 | `Vita Silk` | 2 | 0.98 | names the brand of the treatment |
| k003 | `lissage brésilien` | 2 | 0.97 | specifies the cosmetic procedure |

### test-1 — 22.0 s, $0.0693, 91.0 s wall, cache miss

0 resolution failures, 0 diversity skips, **0 narrowed**, 0 text mismatches.

| id | keyword | words | score | reason (verbatim) |
|---|---|---|---|---|
| k001 | `محفزات الكولاجين` | 2 | 0.95 | names the core procedure and main topic |
| k002 | `injections` | 1 | 0.92 | identifies the delivery method of the treatment |
| k003 | `شد` | 1 | 0.88 | states the main aesthetic benefit |

### What changed against session 3

| | session 3 | session 4 |
|---|---|---|
| vitasilk words emphasized | 5 | 6 |
| test-1 words emphasized | **10** | **4** |
| test-1 longest span | 4 words (`18 7ta l 25 chher`) | 2 words |
| test-1 duplicate idea | `محفزات الكولاجين` **and** `تحفيز طبيعي للكولاجين` | gone |

test-1 was the out-of-spec reel: ten emphasized words on a 22 s reel against
PROJECT_SPEC §5's 3–5 per 30 s. It now sits at four.

**No candidate needed narrowing on either reel.** The prompt asked for one- or
two-word spans and the model complied, which is what the version bump was for:
`narrowSpan` is the guarantee, not the mechanism. The narrowing rule is
therefore **live but unexercised on real data** — only unit tests have run it.

**No diversity skip fired either.** The prompt's "do not return two candidates
about the same thing" appears to have prevented the collision upstream rather
than the selector catching it. The selector rule is likewise unexercised on
real data.

## Image slots

Count from duration at 5.5 per 30 s: 5 for vitasilk, 4 for test-1.

### vitasilk — 25.7 s, 5 slots, $0.0467, 27.0 s wall, cache miss

0 resolution failures, 5 spread/overlap rejections (4 `too-close`, 1
`window-taken`), 0 shortfall.

| id | window | idea (verbatim) | composition | lighting | crop |
|---|---|---|---|---|---|
| img001 | 0.10–2.68 s | A sleek digital stopwatch or clock face showing exactly five minutes. | low in frame | hard directional | macro |
| img002 | 6.26–8.86 s | A luxurious, glowing hair care product bottle radiating light on a premium display. | off-centre | flat frontal | wide |
| img003 | 11.48–12.74 s | Multiple glowing vitamin capsules floating and absorbing into a strong strand of hair. | centred | rim | medium |
| img004 | 14.02–16.88 s | A professional hair straightener gliding smoothly through thick hair, leaving a flawless, sleek finish. | edge to edge | soft diffuse | close |
| img005 | 20.00–25.48 s | A woman confidently and eagerly sitting in a salon chair, ready for her treatment. | off-centre | flat frontal | medium |

Gaps between slots: **3.58 s, 2.62 s, 1.28 s, 3.12 s**. Uncovered reel time:
**10.91 s** of 25.7 s.

### test-1 — 22.0 s, 4 slots, $0.0492, 27.1 s wall, cache miss

0 resolution failures, 4 spread/overlap rejections (3 `too-close`, 1
`window-taken`), 0 shortfall.

| id | window | idea (verbatim) | composition | lighting | crop |
|---|---|---|---|---|---|
| img001 | 0.10–1.38 s | A smiling woman gently touching her firm, lifted cheeks. | centred | hard directional | wide |
| img002 | 4.60–6.76 s | A sleek glass vial containing a beauty serum. | off-centre | flat frontal | macro |
| img003 | 10.94–12.54 s | A close-up profile of a well-defined, youthful jawline. | low in frame | rim | close |
| img004 | 19.72–21.94 s | A macro shot of flawless, dewy skin with a healthy glow. | edge to edge | soft diffuse | medium |

Gaps between slots: **3.22 s, 4.18 s, 7.18 s**. Uncovered reel time:
**14.73 s** of 22.0 s.

### Full composed prompts

What would actually be sent to the image model. Nothing here is written in
code: the palette values come from `mode.palette`, the invariant half from
`mode.imageStyle.stylePrompt`, the last three clauses from this slot's draw
against `mode.imageVariation.axes`.

**vitasilk img001**

```
A sleek digital stopwatch or clock face showing exactly five minutes.. a single
clear idea, readable at a glance. one subject, centred and unobstructed.
dominant colour palette of #1A0000, #820000 and #C9A96E. lit against #1A0000,
with #F8F6F2 reserved for highlights. subject low in frame with headroom above.
hard directional light with defined shadow. macro, a single detail standing for
the whole
```

**vitasilk img002**

```
A luxurious, glowing hair care product bottle radiating light on a premium
display.. a single clear idea, readable at a glance. one subject, centred and
unobstructed. dominant colour palette of #1A0000, #820000 and #C9A96E. lit
against #1A0000, with #F8F6F2 reserved for highlights. subject off-centre with
open space to one side. flat frontal light, no modelling. wide, the whole
subject with air around it
```

**test-1 img001**

```
A smiling woman gently touching her firm, lifted cheeks.. a single clear idea,
readable at a glance. one subject, centred and unobstructed. dominant colour
palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2
reserved for highlights. subject centred, symmetrical. hard directional light
with defined shadow. wide, the whole subject with air around it
```

**test-1 img002**

```
A sleek glass vial containing a beauty serum.. a single clear idea, readable at
a glance. one subject, centred and unobstructed. dominant colour palette of
#1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for
highlights. subject off-centre with open space to one side. flat frontal light,
no modelling. macro, a single detail standing for the whole
```

The negative prompt is the same on every slot, mode negatives followed by the
ARCHITECTURE §5.3 globals:

```
no extraneous objects, no background clutter, no incidental detail, nothing in
frame that is not carrying the idea, no busy or competing composition, no text,
no watermark, no logo
```

**The double full stop is a real defect**, visible in all four prompts above:
the model's idea already ends in a period and the composer joins fragments with
`. `. Cosmetic, not fixed this session, and it goes to the image model as
written.

### A repeat that had to be fixed

vitasilk has five slots against four values per axis, so the first draw came
back around: **img005 was originally identical to img001 on composition,
lighting and crop** — two of five images composed exactly the same way. The
draw now advances an extra step each time it completes a cycle. img005 above is
the corrected draw, produced on a **free cache hit**, and it now shares two
axes with img002 and differs on the third. With four values and five slots some
repeat is unavoidable; a three-axis duplicate is not.

## Cache hits

Both stages re-run on test-1 without `--no-cache`:

- **$0.0000** each, "Cache hit — no billable calls for this run."
- **No new ledger line**: 64 lines before, 64 after.
- The plan differed in ten leaves, all bookkeeping — `meta.updatedAt`, both
  stages' `costUsd`/`cached`/`completedAt`, `costs.totalUsd`, and
  `costs.byStage.analysis` and `.images` going to **0 rather than vanishing**.

Slots, keywords, spans, variation draws and composed prompts were identical.

## Spend

| | |
|---|---|
| billable calls | 4 |
| session spend | $0.224164 |
| ledger all-time before | $5.712720 (60 entries) |
| ledger all-time after | $5.936884 (64 entries) |

Gates held: vitasilk's two stages combined came to $0.1055 against a $0.25
stop, and cumulative spend peaked at $0.2242 against a $0.80 stop.

**The estimator is now roughly right.** It printed $0.0533 against a $0.0588
actual for keywords and $0.0781 against $0.0467 for vitasilk's slots — the same
deliberately pessimistic thinking multiplier as transcription, fed the prompt
that will actually be sent instead of a duration the call does not have. The
old number was $0.0040 against ~$0.05.
