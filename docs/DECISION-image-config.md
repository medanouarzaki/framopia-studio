# Decision — image config, frozen for Block 4

Status: **frozen**. Settled 2026-08-25 by the user after reviewing the
six-image comparison from Block 4 session 3.

This is the Block 4 definition-of-done evidence for the generation half, in
the same form as `DECISION-transcription-config.md`. PROJECT_SPEC §5 and
ARCHITECTURE §5.4 point here.

## The frozen config

| | |
|---|---|
| model | **`gemini-3-pro-image`** (Nano Banana Pro) |
| resolution | **2K** |
| aspect ratio | **1:1**, sent explicitly |
| candidates per slot | **2** (amends ARCHITECTURE §5.4's 3) |
| negative prompt | mode negatives + `no watermark, no logo` (§5.3 globals) |
| cost basis | actuals from `usageMetadata`, never the price table |

`gemini-3.1-flash-image` stays priced and selectable in `core`. It is not
removed: it is the fallback if pro's cost or latency becomes the binding
constraint, and a mode may name it.

## The evidence

One slot — `img002` of `vitasilk`, a cosmetic bottle of hair serum on a
presentation podium — three candidates from each model, everything else
identical. Full run in `benchmarks/RESULTS-block4-imagebakeoff.md`.

### Cost, measured

Every image was served at exactly the requested 2K 1:1 and every one billed
above its published rate.

| model | published | actual, mean | over | wall clock |
|---|---|---|---|---|
| `gemini-3-pro-image` | $0.1340 | **$0.150366** | +12.2% | 33.1 / 72.3 / 215.0 s |
| `gemini-3.1-flash-image` | $0.1010 | **$0.120352** | +19.2% | 20.5 / 23.0 / 21.7 s |

Pro costs about 25% more per image and is between 1.4x and 10x slower. The
215 s call was its arm's first, so a cold start is the obvious guess and three
calls cannot confirm it.

### Per-reel arithmetic

At the frozen config — pro, 2K, 2 candidates — against measured cost rather
than published:

| slots | published | measured (+12.2%) | budgeted (x1.35 gate) |
|---|---|---|---|
| 4 | $1.072 | $1.203 | $1.447 |
| 5 | $1.340 | $1.504 | $1.809 |

**This is why the candidate default is 2 and not 3.** Three candidates on a
five-slot reel is $2.010 published and $2.256 measured, outside
PROJECT_SPEC §5's `$0.50–2.00` per-reel envelope before a single retry. Two
puts a five-slot reel at $1.50 measured with room for one regeneration.

The band in §5.4 is unchanged: a mode may still ask for 3 or 4 via
`imageCandidates` and pay for them.

### Why pro

**The user's eye, on prompt fidelity.** Both arms produced usable images; pro
followed the composed prompt more closely. That is the whole of it, and it is
the right basis — PROJECT_SPEC §1's invisible-AI requirement is a judgement
about how the output looks, not a metric.

**The cutout metrics did not separate the two models.** All six passed the
gate. `alpha_edge_noise` and `hole_ratio` were 0.00000 on every image of both
arms; `foreground_area` and `edge_halo` differed by less than the spread
within each arm:

| metric | pro mean | flash mean | spread within an arm |
|---|---|---|---|
| foreground area | 0.15292 | 0.16272 | 0.11–0.22 |
| edge halo | 0.07163 | 0.07303 | 0.04–0.10 |

Anyone reading the metrics alone would have to call it a tie. The decision
does not rest on them and should not be defended with them.

**2K rather than 1K** because pro prices 1K and 2K identically ($0.134), so
2K is free quality on this model. 4K is rejected in code: the largest negative
zone in a 2160x3840 frame is ~1700 px and TEMPLATE_LIBRARY_GUIDE §3 works at
1200x1200, so 4K is paid-for pixels that get scaled away.

**1:1 sent explicitly** because the API does not default to square. Session 2
sent `imageSize: 2K` with no `aspectRatio` and was served 2752x1536, which
also billed 21.4% over because the served shape matched no published pair.

## Known caveats

These bound what the freeze can be quoted for.

- **Six images, one prompt, one slot, one reel.** No other subject, no other
  composition, no human face has been through either model. A subject the
  prompt describes badly is untested on both.
- **The choice rests on prompt fidelity as judged by one person on three
  pairs.** It is the right basis and it is a small sample. Revisit with
  evidence, not with preference.
- **The published rate is a floor, not a price.** Ten images at exact
  published pairs billed 1.113x to 1.261x, never once under, and nothing
  explains why a published pair serves 1,930-2,050 output tokens against a
  published 1,680. `IMAGE_COST_MULTIPLIER = 1.35` budgets for it; actuals come
  from `usageMetadata`.
- **Pro's wall clock is unexplained**, spanning 33 s to 215 s on three
  identical requests. If that recurs at five slots it is 10-18 minutes of
  generation per reel, which is a UX problem for the panel and not a cost one.
- **The negative prompt is not a control.** One pro image rendered a legible
  `HAIR SERUM` label straight through `no text`. `no text` has since been
  removed from the globals and text is checked after the fact against what the
  slot depicts. Whether `no watermark` and `no logo` are obeyed is **not**
  established — nothing has tested them.
- **The lighting axis is not reliably obeyed.** All six images carried
  `flat frontal light, no modelling` and pro rendered dramatic rim light
  regardless. The flat entry has since been pruned; the prune's effect is
  unmeasured.
- **The `card` fallback has never fired on a generated image.** Every real
  image has passed the gate. The fallback is exercised by synthetic fixtures
  and by deliberate degradation of a real cutout, not by a model producing a
  bad matte.

## Amendment (2026-08-29) — the gate advises, it never blocks

**Ruled by the user after opening the picker on `vitasilk`.** He asked why the
build showed five images when the gate had passed two.

**Because a verdict has never blocked anything, and must not start.** A gate
verdict answers one question — *is this matte clean enough to render as a
cutout* — and §5.4 makes its consequence a **presentation fallback**: below
threshold the slot renders as a card instead. It is not a judgement that the
picture is unusable, and nothing in the pipeline has ever treated it as one.

So, explicitly:

- The chosen candidate is built. With none chosen the **first** is built,
  whatever its verdict — a documented placeholder from Block 7, when the picker
  did not exist, not a judgement that the first is best.
- The plan and the build both **say which of the two happened**, so a build
  nobody chose for is never mistaken for a choice.
- A candidate the user chooses over the gate's advice is built, and the plan
  records the verdict it overrode in `overriddenGateFailures`.

`buildChoiceFor` in `service/src/build/choose-candidate.ts` is the one
declaration of this, read by the builder and by the picker so the two cannot
disagree, and pinned by `choose-candidate.test.ts` — including that all five of
`vitasilk`'s slots build with eight of ten candidates rejected.

## Amendment (2026-08-29) — cutout metrics judge cutout slots only

`edge_halo`, `hole_ratio` and `alpha_edge_noise` measure **one thing: how
cleanly the background came away.** That bears on a slot whose build shows the
subject cut out of its background, and on nothing else.

**Four of `vitasilk`'s five slots show the whole picture inside a frame.** On
those the matte is never drawn, so a threshold it misses says nothing about what
the user will see. Every rejection in the corpus is of exactly that kind:

| | candidates | judged clean | judged poor |
|---|---:|---:|---:|
| before | 10 | 2 | **8** |
| after | 10 | 2 | **0** |
| of which on cutout slots | 2 | 2 | 0 |
| of which on whole-picture slots | 8 | — | **not judged** |

The eight that stop being reported are `img001-c1`/`c2` and `img003-c1`/`c2`
(edge halo), `img004-c1`/`c2` (holes) and `img005-c1`/`c2` (edge noise) — all on
slots that render whole. `img002`'s two candidates are the only ones the
measurement was ever about, and both pass. The other four reels have no
generated candidates, so nothing changes for them.

**The measurement still happens and still decides the presentation.** §5.4 makes
a poor matte fall back to a card, so the metrics are what turn a slot into a
whole-picture slot in the first place; removing them would remove the fallback.
What is scoped is the **verdict** — whether a candidate is reported as failing
something — because past that fallback the metric has no consequence.
`verdictFor` in `service/src/images/verdict.ts` is the one declaration.

**"The `card` fallback has never fired on a generated image" is superseded.**
That sentence, above, was true when it was written and is not now: the fallback
has fired on **8 of 10** real candidates. It is the normal case, not the
exception.

## Amendment (2026-08-29) — nothing measures whether the picture shows the idea

**This is the substantive image defect, and it is not the gate's.**

The gate measures cutout quality. **No check compares a generated picture
against the idea it was generated from**, so on a slot that renders whole —
which is nearly all of them — nothing is measured about the picture at all. Once
the cutout metrics are scoped to the slots they affect, that is plain: those
candidates carry no verdict because there is none to carry.

Seen on `vitasilk`, every one of these passing every check that exists:

| slot | the idea asked for | both candidates show |
|---|---|---|
| `img001` | a clock face showing exactly five minutes | roughly quarter past |
| `img003` | capsules and molecular structures | an undifferentiated swirl |
| `img004` | a woman at a mirror | two women, no clear mirror |

**What it would take**, none of which is a threshold:

- **A reworked prompt.** The composed prompt carries the mode's style and the
  slot's idea; whether the idea survives into the picture is a prompt-authoring
  question, and the corpus already shows the model dropping specifics — the
  clock is the clearest case.
- **A check.** A vision call comparing the picture against the idea, which is a
  billable model call per candidate and a new stage with its own cache,
  fingerprint and cost.
- **A human pass.** The picker built in Block 8 session 30 is the place for it;
  what it lacks is not a control but a reason for the user to trust or distrust
  what he sees.

**It is Block 9 work.** Block 9 owns the client's visual identity and the
prompts that carry it, so the prompt option and the check option both belong to
whoever settles what a K2 picture should look like. Nothing was attempted here;
naming it correctly is the deliverable.

## Amendment (2026-08-29) — the pictures are too dark to read

**The user's ruling**, after watching a built reel: a generated picture should
be clear at first sight, without the viewer working out what it is. The brighter
end of the brand palette should lead. Not bright for its own sake — the dominant
tone shifts up, and the palette is kept.

**This is the other half of the fidelity defect above.** A picture that does not
show what was asked for and a picture too dark to read are the same kind of
problem, and both are solved in the prompt rather than in a threshold.

### The sentence that causes it

Two fragments of `imageStyle.stylePrompt` carry the palette, and the second is
the one doing the damage:

    dominant colour palette of {{palette.background}}, {{palette.primary}} and {{palette.accent}}
    lit against {{palette.background}}, with {{palette.light}} reserved for highlights

Composed, that reaches the model as *"dominant colour palette of #1A0000,
#820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for
highlights."* It names a near-black ground, leads the palette with it, and
**confines the only light colour to highlights**. The model obeys.

### What it produces, measured

All ten candidates on `vitasilk`, over the whole frame:

| candidate | mean | median | p90 | below 0.05 |
|---|---:|---:|---:|---:|
| img001-c1 | 0.0250 | 0.0019 | 0.0391 | 92.1% |
| img001-c2 | 0.0247 | 0.0028 | 0.0196 | 92.5% |
| img002-c1 | 0.0559 | 0.0028 | 0.1582 | 84.5% |
| img002-c2 | 0.0365 | 0.0019 | 0.0416 | 91.5% |
| img003-c1 | 0.0609 | 0.0242 | 0.1326 | 71.9% |
| img003-c2 | 0.0345 | 0.0061 | 0.0696 | 87.9% |
| img004-c1 | 0.0182 | 0.0030 | 0.0169 | 94.4% |
| img004-c2 | 0.0141 | 0.0051 | 0.0136 | 97.0% |
| img005-c1 | 0.0568 | 0.0022 | 0.2428 | 79.3% |
| img005-c2 | 0.0324 | 0.0050 | 0.0983 | 82.6% |

**Mean relative luminance 0.0359** across the ten, range 0.0141–0.0609.
**87.4% of the average frame sits below 0.05**, from 71.9% to 97.0%. Mid-grey is
0.216, so these pictures average about **a sixth of mid-grey**. Their medians —
0.002 to 0.024 — are darker still than their means, which is a frame that is
nearly all ground with a small lit subject in it.

On a dark reel, at 1.5 to 2.6 seconds on screen, that is not something a viewer
resolves. Session 25 measured the same thing at the outer ring (0.0019–0.0266)
and recorded it as a fact about the frame colour without naming it as a defect.

### The proposed change, not applied

`imageStyle.stylePrompt`, replacing the two fragments above:

    the brighter end of the palette leads: {{palette.accent}} and {{palette.light}}
    carry the subject, with {{palette.primary}} for depth and {{palette.background}}
    kept to the ground behind it

    lit so the subject reads immediately at a glance, bright and clearly separated
    from its ground, not sunk into it

**What each half is for.** The first reorders the palette so the light and the
accent lead and the near-black becomes the surround rather than the subject —
the brand colours are all still named, in the same file, so nothing is invented
and nothing is lost. The second replaces *"lit against #1A0000, with #F8F6F2
reserved for highlights"*, which is the instruction that put 87% of the frame in
shadow; *reserved for highlights* is the specific phrase to remove.

The `lighting` variation axis stays as it is. Its two values — hard directional
light and rim light — are about how the subject is modelled, not how bright the
picture is, and one of them (rim light) already works towards separation.

### What testing it costs

**`test-1`: 4 slots × 2 candidates = 8 images.** Published $1.072; expected
actual about **$1.24** at the measured +15.7% over published; **budgeted ceiling
$1.4472** at `IMAGE_COST_MULTIPLIER` 1.35.

`test-1` rather than `vitasilk` because `vitasilk`'s ten images are the corpus
every measurement in this block rests on, and regenerating them would cost the
comparison as well as the money.

**No image is generated without the user's explicit go-ahead**, and none was
generated for this amendment.

### Why it is Block 9

Block 9 owns the client's visual identity and the prompts that carry it. A
brightness rule written before the K2 palette is settled would be written twice,
and the fragments above are mode data — they belong to whoever decides what a K2
picture looks like. What this session fixes is that the defect is now named,
quantified, and has a prompt to try.

## Amendment (2026-08-29) — literal or atmospheric, decided per moment

**The user's ruling, and it is a judgement rather than a rule.** When she names
something concrete — a country, a brand, an ingredient, a place — the picture
should often be **that thing**, immediately recognisable. Brazil should be able
to become a flag or a landmark. But not always: sometimes the general mood of
what she is saying is the better picture. **The choice is made per moment and
both are valid.**

### What the prompt says today

`slotPrompt` in `service/src/analysis/slots.ts` decides what an idea depicts in
two sentences:

    Each slot illustrates ONE idea or sentence — a thing being explained, claimed
    or shown, that a picture could carry.

    For each slot give the word_ids of the span it illustrates, copied exactly
    from the transcript, and a one-line idea in English describing what the image
    should show. The idea is a description of a picture, not a translation of the
    words and not a caption.

**Nothing in it mentions naming a concrete thing.** So when she says *"le filler
glow mn la marque Vita Silk"* there is nothing telling the model to depict Vita
Silk, and it writes the category instead.

### The evidence, all nine planned slots

| slot | what she says | what the idea depicts | what would serve it | why |
|---|---|---|---|---|
| vitasilk img001 | *"5 d9ay9"* — five minutes | a clock face showing five minutes | **literal** | she names a quantity; a clock is the thing |
| vitasilk img002 | *"le filler glow mn la marque Vita Silk"* | *a cosmetic bottle of hair serum on a presentation podium* | **literal — and it is not** | she names a **brand and a product**; the idea is the generic category |
| vitasilk img003 | *"fih 26 vitamines et aussi des enzymes"* | *vitamin capsules and scientific molecular structures blending into a thick hair cream* | **literal — and it is diluted** | capsules are the concrete half; *molecular structures* is atmosphere bolted on, and two subjects at once |
| vitasilk img004 | *"chno katsnay bach thllay f ch3rk"* — what are you waiting for | a woman at a mirror, thoughtful | **atmospheric, and it is** | a rhetorical question names nothing; the mood is the picture |
| vitasilk img005 | *"ila l9iti 3ndhom la marque Vita Silk"* | *a salon shelf displaying premium hair care products* | **literal — and it is not** | the **brand** again, and the idea is a shelf of unnamed things |
| test-1 img001 | *"bghiti شد طبيعي للوجه"* — do you want a natural lift | a woman touching her lifted jawline | **atmospheric, and it is** | a desired outcome, not an object |
| test-1 img002 | *"3la محفزات الكولاجين"* — collagen stimulators | a doctor holding a small vial | **literal, and nearly is** | the vial is the thing; the doctor is scene-setting around it |
| test-1 img003 | *"شد خفيف للبشرة"* — a light tightening | a cheek showing subtle tightening | **atmospheric, and it is** | an effect, not a thing |
| test-1 img004 | *"kat7ssn lik mn jawdat البشرة"* — improves your skin quality | flawless hydrated skin | **atmospheric, and it is** | an outcome |

**Five of nine call for the concrete thing and four for the mood** — which is
the ruling, measured: neither preference would be right as a blanket rule.

**Of the five that call for the concrete thing, three do not get it.** Both
mentions of the brand became a generic category, and the third was diluted with
atmosphere. **The four that call for mood are all served correctly**, so the
model is not bad at atmosphere — it is that nothing asks it for the concrete
thing.

### The proposed change, not applied

Added to `slotPrompt`, after the sentence about what a slot illustrates:

    When the words name something concrete and depictable — a brand, a product,
    a place, a country, an ingredient, a tool, a number of things — the picture
    should usually be that thing, and the idea should name it as she named it.
    A viewer should recognise it at a glance without working out what it stands
    for.

    When the words name no such thing — a question, a feeling, a promise, a
    result — the picture should carry the mood or the outcome instead, and the
    idea should describe that.

    Decide this for each slot on its own. Both kinds are right, and neither is
    the default. The test is what a viewer would recognise fastest in the two
    seconds the picture is on screen.

    Do not blend the two. A concrete thing beside an abstract one is two
    subjects, and a slot idea depicts one.

The last paragraph is not new policy — it restates the single-subject rule §5
already enforces at plan time, at the point where it is being broken.

### All three image defects are the prompt

The three amendments in this document are one problem seen three ways:

| | recorded | what it is |
|---|---|---|
| fidelity | session 31 | the picture does not show what was asked for |
| darkness | session 34 | the picture is too dark to read at a glance |
| **literalness** | **this one** | the picture shows a category where she named a thing |

**None is a threshold and none is fixable in the gate.** All three are decided
by the words sent to the image model — two in `imageStyle.stylePrompt`, which is
mode data, and one in `slotPrompt`, which is the analysis stage. They should be
changed together and tested together, because a prompt change is a billable
re-generation and doing it three times costs three times.

**It is Block 9.** Block 9 owns the client's visual identity and the prompts
that carry it. Testing all three at once is `test-1`'s 8 images, about **$1.24**
expected against a **$1.4472** budgeted ceiling, and needs the user's explicit
go-ahead. **Nothing was generated and no prompt was changed.**

## Amendment (2026-08-30) — the fragments are applied, and the darkness is fixed

**Applied, on the user's explicit go-ahead, and tested in one generation.** All
three amendments above name the same cause — the words sent to the model — and
say they should be changed together because a prompt change is a billable
regeneration. They were.

| | |
|---|---|
| `imageStyle.stylePrompt` | the two palette/lighting fragments replaced; mode **v10 → v11** |
| `slotPrompt` | the literal-or-atmospheric rule added; `ACTIVE_SLOT_PROMPT_VERSION` **1 → 2** |
| generated | **`test-1`, 8 images**, 4 slots x 2 candidates |
| estimate | $1.0720 published, **$1.4472 budgeted** at `IMAGE_COST_MULTIPLIER` 1.35 |
| **actual** | **$1.220660**, from `usageMetadata` |
| per image | $0.148296 to $0.158490, mean **$0.152583**, **+10.7% to +18.3%** over published |
| ceiling | $1.4472, never approached; $0.226540 unspent |

The published rate is a floor again, twenty-eight images running: nothing has
ever billed under it, and the 1.35 gate cleared the worst by 14%.

### Darkness: fixed, and measured

`tools/image-luminance/measure.py`, which **reproduces this document's own
ten-row table exactly** before it is used on anything new — the same discipline
`tools/font-metrics/measure.py` follows.

| | old prompt (`vitasilk`, 10) | new prompt (`test-1`, 8) |
|---|---:|---:|
| mean relative luminance | 0.0359 | **0.2248** |
| share of the frame below 0.05 | **87.4%** | **47.5%** |

Mid-grey is 0.216, so the pictures went from about a sixth of mid-grey to
slightly above it. Per image, the new eight run 31.8% to 49.3% unlit — except
one.

| candidate | mean | median | p90 | below 0.05 |
|---|---:|---:|---:|---:|
| img001-c1 | 0.2305 | 0.1596 | 0.5269 | 32.3% |
| img001-c2 | 0.2814 | 0.0578 | 0.8081 | 49.3% |
| **img002-c1** | **0.0443** | 0.0048 | 0.0730 | **88.9%** |
| img002-c2 | 0.2344 | 0.0762 | 0.6827 | 48.3% |
| img003-c1 | 0.2373 | 0.1311 | 0.6028 | 47.6% |
| img003-c2 | 0.2298 | 0.1096 | 0.5936 | 42.8% |
| img004-c1 | 0.2498 | 0.2072 | 0.5702 | 39.4% |
| img004-c2 | 0.2908 | 0.2902 | 0.6117 | 31.8% |

**`img002-c1` did not move**, at 88.9% unlit against the old corpus's 87.4%
average. Seven of eight did. The prompt is an instruction and not a control,
which the lighting axis already established.

**And it is the one candidate that passed the cutout gate.** That is not a
coincidence worth ignoring: a near-black ground is what makes a subject easy to
matte. Under the old prompt 2 of 10 passed; under the new one **1 of 8**, and
gate `edge_halo` rose from a 0.045–0.170 range to 0.154–0.490. **Brighter
pictures produce worse cutouts.** It costs nothing today — §5.4 makes a poor
matte fall back to a card, and Block 7 session 9 forces the card frame on every
slot anyway — but a later block that wants real cutouts will meet this
head-on.

### Fidelity: still unmeasured, and deliberately

Nothing compares a picture against the idea it came from, and this session did
not add anything that does. Inventing a metric would have been inventing a
number, and asking a model to grade its own output is not evidence. The
comparison page prints each slot's words and its idea beside the pictures so
the judgement can be made by the person whose judgement it is.

### Literalness: applied, and NOT exercised by this run

The `slotPrompt` fragment governs **which ideas get written**, and this run
reused `test-1`'s four existing ideas rather than re-planning them. So the eight
images test the style fragments and not the literalness rule.

**That was forced by the budget, and the arithmetic is why.**
`IMAGE_SLOTS_PER_30S` went 5.5 → 8 at Block 8 session 35, so re-planning
`test-1` (21.99 s) yields **6 slots, not 4** — 12 images, $1.608 published and
**$2.1708 budgeted**, over the $1.4472 ceiling this run was authorised for. It
would also have replaced the ideas, leaving no comparison.

`test-1` is in any case the reel with least to prove on it: of its four slots
**one names something concrete and three name a feeling**, and by this
document's own table all four are already served correctly. The slots that fail
literalness are `vitasilk`'s `img002` and `img005`, both brand mentions, and
`vitasilk` may not be regenerated.

**So the rule is in force for every slot planned from now on and has never been
observed working.** The first reel to plan slots afresh is its first test.

### What the comparison can and cannot show

**`test-1` had no images before this run** — 4 planned slots, 0 candidates,
nothing on disk. The document's estimate of what testing would cost was right;
its framing that `test-1`'s pictures would be regenerated was not, because there
were none.

So there is **no slot-for-slot before and after**. The before is `vitasilk`'s
ten under the old prompt and the after is `test-1`'s eight under the new one:
different reels, different subjects, different ideas. Both are the same model at
the same resolution and aspect ratio with the same negative prompt, and the only
deliberate difference is the two fragments — but a 6.3x change in mean luminance
is far outside anything subject choice plausibly explains, and the per-image
figures do not overlap at all except for `img002-c1`.

`npm run prompt-page` renders it.

### The negative prompt was not touched

Unchanged, and deliberately: `no watermark` and `no logo` have still never been
tested as controls, and `no text` was ignored outright when it was there.
Nothing was added to the negatives on the strength of hope. None of the eight
images carries unexpected text.

## Amendment (2026-08-30) — the framing axis loses its wide value

**The user's ruling, from looking at the eight images session 12 generated.** He
approved them; what he could not read was the one framed wide.

A picture is placed at a **fixed size in the top-left corner** — 801 to 917 px on
a 2160 px frame, and one size per reel — so how much of the frame the subject
fills inside its own square is the whole of how legible it is. `test-1`'s
`img002` is the evidence, two candidates from one idea:

| candidate | framing drawn | what it shows |
|---|---|---|
| `img002-c1` | *wide, the whole subject with air around it* | a whole doctor, unreadable at 917 px in a corner |
| `img002-c2` | (the same slot, other candidate) | her from the chest, the vial large in frame, reads instantly |

So `wide, the whole subject with air around it` is **removed** from
`imageVariation.axes.framingTightness`. Three values remain — medium, close,
macro — against a validator minimum of two. **Medium is now the loosest framing
any slot can draw.** The subject fills the frame.

Mode **v12**. Nothing that bills moved: `keywordModeContentHash` and
`slotModeContentHash` are unchanged, and the image cache keys on the composed
prompt string, which is only consulted when something regenerates.

### Two prompt changes are applied and have never been observed working

This is the record that should stop a future session assuming either works.

| change | applied | exercised | what would test it |
|---|---|---|---|
| **literal or atmospheric** (`slotPrompt`, `ACTIVE_SLOT_PROMPT_VERSION` 2) | session 12 | **no** | the first reel to plan slots fresh |
| **framing tightness** (`imageVariation`, mode v12) | session 13 | **no** | the first reel to plan slots fresh |

**Neither was tested, and in both cases that was a decision rather than an
oversight.**

The literalness rule governs which *ideas* get written, and session 12 reused
`test-1`'s four existing ideas. Re-planning them would have yielded **six slots,
not four** — `IMAGE_SLOTS_PER_30S` went to 8 at Block 8 session 35 — which is
twelve images at **$2.1708** budgeted against the $1.4472 that run was
authorised for, and it would have replaced the very ideas the before-and-after
rested on.

The framing rule changes what a slot *draws*, so testing it means regenerating.
About **$6.82** of Gemini credit remains and Block 10's golden runs on two
machines come out of it, so the user ruled: do not spend to test it.

**Both get their first real test on the same run** — the first reel that plans
slots fresh will exercise the literalness rule when it writes its ideas and the
framing rule when it composes its prompts. `ground-truth` and `test-3` are the
two reels whose analysis has never run.

**What would miss the cache if anything were regenerated**, measured rather than
guessed and true at the moment this was written:

| reel | slots that would miss | why |
|---|---|---|
| `test-1` | **3 of 4** (6 of 8 images) | the framing draw moves on img001, img002, img003; img004 draws *close* either way and still hits |
| `vitasilk` | **5 of 5** (10 of 10 images) | its stored prompts still carry the *old* palette and lighting fragments — session 12 deliberately did not recompose it — so these would have missed already |

**Nothing was regenerated and no image file was deleted.** Neither plan was
recomposed either: recomposing would leave a plan describing prompts whose
pictures are not on disk.

## References

- `benchmarks/RESULTS-block4-imagebakeoff.md` — the six-image comparison.
- `benchmarks/RESULTS-block4-cutouts.md` — the gate over the same six.
- `reports/block-4-session-3.md` — the run, and its ceiling overrun.
- `core/src/model-config.json` — pricing, both model ids.
- `core/src/pricing.ts` — `IMAGE_COST_MULTIPLIER` and its ten observed ratios.
- `service/src/images/config.ts` — resolution and candidate bounds.

## Amendment (2026-09-01) — slot prompt v3 asks which word the picture is about

**Adopted and live.** `ACTIVE_SLOT_PROMPT_VERSION` is **3**, and the slot
response carries one new optional field, `nameWordId`.

### What it fixes

A picture was placed across the whole span of words the model gave it, so it
arrived where the sentence begins rather than where the thing it depicts is
named. On `sora` a stock doctor appeared on *"hello"*, **1.4 s before** she says
*"I am Dr Lobna Kfafi"* — the user's own complaint. Block 10 session 40 measured
it across the project: of 26 slots, **6 started on the naming word, 19 started
0.10–1.58 s early, and 1 had no naming word at all** because its idea was a
metaphor for the whole sentence.

Session 40 also established that **nothing on disk can identify the word.** The
transcript is Arabic, the idea is English, and matching one against the other
fires on 1 of 26 slots and 0 of 11 on `sora`. There are no per-word tags; the
keyword stage covers 8 of 26 slots and not that one; `transcript.terms` is
orthography segmentation. A greeting-skip list would work on `sora` and is a
value fitted to one reel's language.

The model chose the span and wrote the idea in the same breath, so it is the
only thing that knows, and it was never asked.

### The change

One question added to the prompt, in its own idiom, and one key in the response
shape:

> Also give the one word_id in that span that the picture is about — the word
> naming the thing the image shows, so the picture can appear as it is said
> rather than at the start of the sentence. It must be one of the word_ids you
> gave for that slot. When the idea carries the mood or the outcome of the whole
> sentence and no single word names it, give null.

**`null` is the answer for a metaphor**, and it is the right one: session 40's
`img008` — *"a scale balancing a syringe and vegetables"* over *"I combine
aesthetic medicine and nutrition"* — depicts a balance of two things, and no
single word names it. The planner keeps such a slot exactly as it was: the
picture arrives with its sentence, which is what every plan did before v3.

**Optional with a default, per the standing schema rule.** Absent means the
span's start. The six existing plans stayed valid with no migration, and
`npm run golden` did not move on their account.

### What it cost, and whether it works

**One call, on `sora`, $0.086570.** Projected $0.096 from the v2 call on the
same reel; ceiling $0.35.

**The model named a word on 21 of the 22 candidates it returned**, and declined
on exactly the one that should have declined — the balance-scale idea. Judged
against session 40's hand-read table, it agreed on every slot the two both
covered.

### The cache, and who re-bills

`promptVersion` is part of the slot cache fingerprint
(`analysis/fingerprint.ts`), so **v3 invalidates every reel's slot entry.** That
is correct — a v2 answer has no `nameWordId` and must not be served for a v3
prompt — and it is nearly free, because `slotsReplacementFlags` refuses to
re-plan a reel that has generated candidates before any call is made:

| reel | slot cache | would a v3 bump re-bill it? |
|---|---|---|
| sora | 1 entry, v2 | **no** — 11 candidates, the re-plan is refused |
| test-1 | 2 entries, v1 | **no** — 4 candidates, refused |
| vitasilk | 2 entries, v1 | **no** — 5 candidates, refused |
| ground-truth | 1 entry, v2 | **yes**, ~$0.065 — 6 slots, no candidates |
| test-2 | none | already bills; nothing is lost |
| test-3 | none | already bills; nothing is lost |

**One reel of six**, and it is the one already unable to build.

### Where it breaks

- **A span the model no longer returns.** Adopting the field onto an existing
  plan matches candidates to slots by span; `sora`'s `img004` and `img011` were
  not returned at all and still arrive with their sentences.
- **A naming word near the end of its span.** A picture may not arrive so late
  that its entrance could not finish inside its own words, so it is pulled back
  to `end − entrance`, the entrance being the template's authored opacity ramp
  read from the audit.
- **A word outside the span, or one the transcript never had.** Dropped at the
  parser, again at `planSlots`, and refused by the plan validator. A picture may
  start later inside its own span and nowhere else.
- **The version labels the cache entry; it does not select a prompt.**
  `buildSlotPrompt` takes a version and never branches on it, so asking for v1
  returns today's text. The keyword prompt beside it does branch. Recorded at
  session 41 rather than changed.
