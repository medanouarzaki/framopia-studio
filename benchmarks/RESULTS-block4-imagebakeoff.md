# Model bake-off — halted after image 1

**The bake-off did not run.** The sequencing gate was designed to catch a
defect on the first image rather than the sixth, and it caught two. One flash
image was generated for **$0.122593**; the remaining five were not.

Two of the four post-image-1 checks failed:

| # | check | result |
|---|---|---|
| 1 | response parsed, real shape not an assumed one | **partial** — parsed, but returned `image/jpeg` where the caller assumed PNG |
| 2 | bytes are a valid image of the requested dimensions | **FAIL** — 2752x1536, not the requested 2K 1:1 |
| 3 | `usageMetadata` present, cost within 20% of estimate | **FAIL** — $0.122593 against $0.101, **21.4% over** |
| 4 | exactly one ledger line written | pass — 84 to 85 |

Checks 2 and 3 are one defect, not two.

## The defect

`GeminiImageClient` sent `imageConfig: { imageSize: '2K' }` and **no
`aspectRatio`**. The API does not default to square: it chose its own ratio
and returned a 16:9 landscape.

```
requested   2K, 1:1   = 2048 x 2048 = 4,194,304 px
received              = 2752 x 1536 = 4,227,072 px
```

That is **0.78% more pixels for 21.4% more cost**. Working backwards from
$0.122593 at $60/M output and a ~120-token prompt gives about **2,042 output
tokens**, against the **1,680** Google publishes for the 2K tier.

Those two figures cannot be reconciled by area, so **the token count for a
served aspect ratio is not derivable from area.** 2,042 falls between the
published 2K count (1,680) and the 4K count (2,520) and matches neither. The
price table prices *published (size, aspect) pairs*; **a request whose served
dimensions match no published pair is an unpriced request**, and the table
cannot predict its cost. The tier served was not the tier requested, and the
21.4% overage is the measure of that.

This is exactly the failure the sequencing was for. At image 6 it would have
cost $0.705 and produced six landscape images for a square comp.

`ImageConfig.aspectRatio` is in the SDK's own type
(`node_modules/@google/genai/dist/genai.d.ts`), documented as supporting
`"1:1"` among others, and simply was never set — session 1 wrote the client
against the API without executing it, and this is what that cost.

### The third finding: the response is JPEG, not PNG

`mimeType` came back **`image/jpeg`**. The cache layer handled it correctly —
`imageFileName` maps jpeg to `image.jpg` and the entry on disk is right — but
the bake-off CLI wrote the review copy as `<model>-<index>.png` regardless, so
a JPEG sat behind a `.png` name. Session 3 uses these files as its cutout test
corpus, so a mislabelled corpus would have been handed forward.

The session brief specified `.png` filenames. That was written before anyone
knew what the API returns. **The extension now follows the returned mime
type**, which is the only version of the rule that can be true.

## The slot

`img002` in `vitasilk`'s Edit Plan, 6.259s–8.86s, the second of five.
Word ids `w0018`–`w0027`. Context text: `jbt likom le filler glow mn la marque
Vita Silk`. Idea: `A cosmetic bottle of hair serum on a presentation podium`.

### Prompt, verbatim

```
A cosmetic bottle of hair serum on a presentation podium. a single clear idea, readable at a glance. one subject, centred and unobstructed. dominant colour palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for highlights. subject off-centre with open space to one side. flat frontal light, no modelling. wide, the whole subject with air around it.
```

### Negative prompt, verbatim

```
no extraneous objects, no background clutter, no incidental detail, nothing in frame that is not carrying the idea, no busy or competing composition, no text, no watermark, no logo
```

**The composed prompt contradicts itself and was sent anyway**, because this
session was to vary one thing and the prompt was not it. The invariant style
fragment says `one subject, centred and unobstructed`; the variation draw for
this slot says `subject off-centre with open space to one side`. The mode's
invariant half and its varying half disagree about where the subject goes.
Nothing validates that they can both be satisfied. This is a mode-authoring
problem, not a generation one, and it is live on every slot the planner has
ever produced.

## The one image

| field | value |
|---|---|
| model | `gemini-3.1-flash-image` |
| candidate index | 0 |
| resolution requested | 2K, 1:1 |
| dimensions received | **2752 x 1536** |
| mime type | `image/jpeg` |
| bytes | 1,508,160 |
| wall clock | 14.2 s |
| **estimate** | **$0.1010** |
| **actual, from `usageMetadata`** | **$0.122593** |
| overage | +21.4% |
| ledger lines written | 1 |
| **text returned alongside the image** | **none** |

File: `benchmarks/results/latest-imagebakeoff/gemini-3.1-flash-image-1.jpg`.
Kept, not deleted: session 3 uses it.

### The negative-prompt question is unanswered

The model returned **no text at all** alongside the bytes — the `parts` array
held only `inlineData`. So the `Avoid:` phrasing did not draw a conversational
reply, which is the failure mode session 1 flagged. That is the only thing
this says. **Whether the model obeyed the negatives is a question about the
picture, and nobody has looked at the picture.** One image from one model
cannot answer it either way.

## Cache

Verified on a second invocation of the identical slot and candidate index:

```
ledger lines written: 0 (expected 0)
  img002-c1 idx=0 cached=true actual=$0.000000 est=$0.1010
ledger before=85 after=85
ledger sha UNCHANGED
```

A hit costs $0.00 and writes no ledger line, as designed.

**The fix invalidates this entry.** `aspectRatio` is now part of the
fingerprint — it changes the pixels and it changes the price, so it has to
key — which means session 3's first run is a miss and regenerates. That is
correct: the cached image is the wrong shape.

## Per-reel arithmetic

Published per-image rates at 2K, from
`core/src/model-config.json` (ai.google.dev, read 2026-08-25):
flash **$0.101**, pro **$0.134**.

| candidates/slot | flash, 4-slot | flash, 5-slot | pro, 4-slot | pro, 5-slot |
|---|---|---|---|---|
| 2 | $0.808 | $1.010 | $1.072 | $1.340 |
| 3 | $1.212 | $1.515 | $1.608 | $2.010 |
| 4 | $1.616 | $2.020 | $2.144 | $2.680 |

At 1K, where pro is priced identically and flash is $0.067:

| candidates/slot | flash, 4-slot | flash, 5-slot | pro, 4-slot | pro, 5-slot |
|---|---|---|---|---|
| 2 | $0.536 | $0.670 | $1.072 | $1.340 |
| 3 | $0.804 | $1.005 | $1.608 | $2.010 |
| 4 | $1.072 | $1.340 | $2.144 | $2.680 |

**Treat every figure above as a floor.** The one real call billed 21.4% over
its published rate. Until a call is confirmed to land on the requested tier,
the published rate is not a reliable predictor of the invoice — which is the
second reason the ledger records `usageMetadata` and never the table.

## No verdict

No model was picked, no quality judgement was made, and none should be read
into this file. One landscape image from one model is not a comparison.
