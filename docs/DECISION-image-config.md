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

## References

- `benchmarks/RESULTS-block4-imagebakeoff.md` — the six-image comparison.
- `benchmarks/RESULTS-block4-cutouts.md` — the gate over the same six.
- `reports/block-4-session-3.md` — the run, and its ceiling overrun.
- `core/src/model-config.json` — pricing, both model ids.
- `core/src/pricing.ts` — `IMAGE_COST_MULTIPLIER` and its ten observed ratios.
- `service/src/images/config.ts` — resolution and candidate bounds.
