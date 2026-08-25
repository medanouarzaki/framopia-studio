Status: PROBLEM — the Gemini account's prepayment credits are depleted, so the ten-image production run did not happen and Block 4's definition of done is not met. HTTP 429 `RESOURCE_EXHAUSTED`: "Your prepayment credits are depleted." Nothing was spent, nothing was corrupted, and every part of the session that does not need the API is complete.

The stage the DoD asks for is built, unit-tested, and verified end to end
against the real sidecar with only the paid generation substituted. What is
missing is a generation run, and no amount of local work substitutes for it.

## Ledger

| | entries | total | sha256 |
|---|---|---|---|
| start | 95 | $9.005328 | `66e02a42e711d8d608770e5442761f7139d65cb4da01ba6e2761ede32d3dd29d` |
| end | 95 | $9.005328 | `66e02a42e711d8d608770e5442761f7139d65cb4da01ba6e2761ede32d3dd29d` |

Byte-identical. **$0.00 against a $2.25 ceiling.** The failed call cost
nothing; the API refused before generating.

### Per-image estimate vs actual

**No image was generated, so there is no actual for any of the ten.** The
pre-flight, which is all that exists:

```
mode k2-syndicalia v4, imageCandidates=2
model gemini-3-pro-image 2K 1:1
slots 5, candidates/slot 2

  $0.1340 published per image, budgeted at $0.1809 (x1.35)
  5 slots x 2 candidates = 10 images
  estimated cost:       $1.8090
  published rate total: $1.3400
  measured (+12.2%):    $1.5035

cache: 0 hits, 10 to generate
```

**The pre-flight earned its place.** It showed `DEFAULT_IMAGE_CONFIG` still
set to `gemini-3.1-flash-image` at 1K while `DECISION-image-config.md` had
just frozen pro at 2K. Without it the run would have generated ten images on
the wrong model, inside budget and entirely wrong.

## Done

### A1 — the halo threshold stands

The user compared originals against cutouts: **the bright edge is in the
original**. It is rim light the model rendered, not background the matte
retained, so the two near-misses (0.0966 and 0.0965 against 0.10) are correct
renders. **No threshold changed.**

Recorded at `MAX_EDGE_HALO` in `tools/cv/framopia_cv/gate.py` and in
`benchmarks/RESULTS-block4-cutouts.md`, with the limit it exposes: `edge_halo`
measures alpha outside the subject and cannot tell a rim the model drew from a
rim the remover left. Wherever the lighting axis calls for rim light it runs
high by construction.

### A2 — mode v4

`modes/k2-syndicalia.json` v3 → v4, `core/src/mode.ts`,
`service/src/images/config.ts`.

- **`no text` removed** from `GLOBAL_NEGATIVE_PROMPTS`. `no watermark` and
  `no logo` kept.
- **`flat frontal light, no modelling` pruned** from the lighting axis. The
  mode note records that the prune's effect is unmeasured: all six corpus
  images carried that value and pro rendered dramatic rim light regardless.
- **`imageCandidates: 2`** on the mode, plus `DEFAULT_CANDIDATES_PER_SLOT = 2`
  in code. §5.4 amended with the arithmetic.
- **Fonts stay tbd.**

**`img002` before:**

```
prompt: A cosmetic bottle of hair serum on a presentation podium. a single clear idea, readable at a glance. one subject, centred and unobstructed. dominant colour palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for highlights. seen from slightly below, looking up. close, the subject filling most of the height. flat frontal light, no modelling.

negative: no extraneous objects, no background clutter, no incidental detail, nothing in frame that is not carrying the idea, no busy or competing composition, no text, no watermark, no logo
```

**after:**

```
prompt: A cosmetic bottle of hair serum on a presentation podium. a single clear idea, readable at a glance. one subject, centred and unobstructed. dominant colour palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for highlights. seen from slightly below, looking up. close, the subject filling most of the height. hard directional light with defined shadow.

negative: no extraneous objects, no background clutter, no incidental detail, nothing in frame that is not carrying the idea, no busy or competing composition, no watermark, no logo
```

**The analysis cache still hits at $0.00 after the bump**, on both reels and
both stages:

```
vitasilk   keywords  Cache hit — no billable calls
vitasilk   slots     Cache hit — no billable calls
test 1     keywords  Cache hit — no billable calls
test 1     slots     Cache hit — no billable calls
ledger sha UNCHANGED
```

That is session 4's content-hashed fingerprinting working: the mode changed,
the fields the analysis call reads did not.

### A3 — OCR as a correctness check

`tools/cv/framopia_cv/text_check.py`. Detected words are compared against the
slot's `idea` plus the mode vocabulary, casefolded and accent-stripped.
Unexpected words are an advisory warning, never a delete.

**All six corpus images re-checked against the `img002` idea:**

| image | text | verdict | expected | unexpected |
|---|---|---|---|---|
| `gemini-3-pro-image-1` | yes | **ok** | hair, serum | — |
| `gemini-3-pro-image-2` | no | ok | — | — |
| `gemini-3-pro-image-3` | no | ok | — | — |
| `gemini-3.1-flash-image-1` | no | ok | — | — |
| `gemini-3.1-flash-image-2` | no | ok | — | — |
| `gemini-3.1-flash-image-3` | no | ok | — | — |

**The regression case passes**: `HAIR SERUM` is clean against a hair-serum
slot, where the presence check called it a failure.

**No verdict exists for the ten new images**, because there are none.

`ImageCandidate.textVerdict` added, optional-with-default, as a sibling to
`detectedText` rather than a shape change to it. **All five plans open through
`readEditPlan`:**

```
OK   vitasilk      v1 words=73 slots=5 candidates=0 modeV=[4,4,4,4,4]
OK   test 1        v1 words=67 slots=4 candidates=0 modeV=[4,4,4,4]
OK   ground truth  v1 words=76 slots=0 candidates=0 modeV=[]
OK   test 2        v1 words=69 slots=0 candidates=0 modeV=[]
OK   test 3        v1 words=58 slots=0 candidates=0 modeV=[]
```

### A4 — the image config is frozen

`docs/DECISION-image-config.md`. `gemini-3-pro-image`, 2K, 1:1, 2 candidates.
Measured costs, per-reel arithmetic, and the caveats that bound what it can be
quoted for.

It states plainly that **the cutout metrics did not separate the two models**
and that the decision rests on the user's judgement of prompt fidelity across
three pairs. PROJECT_SPEC §5 and ARCHITECTURE §5.4 amended to point at it.

### A5 — the two carried risks

**The BiRefNet model is pinned by sha256**
(`58f621f0…`, 972,666,916 bytes) in `tools/cv/models.json`, verified by
`tools/cv/verify-models.sh` inside `npm run check`. A mismatch fails the
build; a model not yet downloaded exits 2 and does not, so a fresh clone still
runs the gate. Verified to fail as well as pass.

**`CLAUDE_CODE_GUIDELINES.md` §4** gains "a defect report names the state it
destroyed", with session 3's deleted cache entries as the worked example and
the rule that unrecoverable state belongs in **Failures & open problems**.

### A6 — the two silent metrics fire

`tools/cv/tests/test_degradation.py`, on a real corpus cutout:

| case | edge noise | hole ratio | fg area | edge halo | gate |
|---|---|---|---|---|---|
| baseline (real cutout) | 0.00000 | 0.00000 | 0.12275 | 0.07489 | cutout |
| hole punched | 0.00000 | **0.04972** | 0.11665 | 0.06359 | **card** |
| specks scattered | **0.02721** | 0.00000 | 0.12619 | 0.02400 | **card** |
| alpha dilated ~3 px | 0.00000 | 0.00000 | 0.12275 | **0.60043** | **card** |

```
hole punched      -> hole_ratio 0.0497 > 0.01
specks scattered  -> alpha_edge_noise 0.0272 > 0.02
alpha dilated 3px -> edge_halo 0.6004 > 0.1
```

**The pipeline's first `card` outcomes.** Each degradation moves its own
metric and leaves the others alone, so a `card` can be attributed to a cause.

### B — the production stage

`service/src/images/job.ts`, `quality.ts`, `images-cli.ts`.

Per slot: generate the mode's candidate count → sidecar `remove_bg` per
candidate → metrics → gate → text verdict → onto the plan, filling `path`,
`cutoutPath`, `cutoutQuality`, `metrics`, `gate`, `detectedText`,
`textVerdict`, and the slot's `presentation` and `status`.

- **`chosenCandidateId` is left null.** The editor picks in Block 8.
- **`presentation` is set only when every candidate agrees** — it follows
  whichever candidate is picked, and session 1 made the field nullable so a
  guess could not read as a decision. A split leaves it null and the
  per-candidate `gate` carries the detail.
- **`cutoutQuality` is the minimum headroom, not the mean.** A matte with one
  bad metric and three perfect ones is a bad matte. It orders candidates and
  never decides; a test reads the Python gate's source and pins the thresholds
  so the two cannot drift.
- **Costs at the point of spend only.** 17 tests, including one asserting the
  real ledger is byte-identical after a full run against fakes.
- **On re-run:** candidates alone do not block — they return from cache
  byte-identical and free. A **chosen candidate** blocks with
  `ImagesReplaceBlockedError` naming the slot, and demands `--force`.

**Verified end to end against the real sidecar** (`job.integration.test.ts`):
real background removal, metrics, gate, OCR verdict and plan write, with only
the paid generation substituted by a client replaying an image from disk. It
writes to a temp plan, never a real one.

## Deviations

- **The ten-image run was not made and not retried.** The error names an
  account state and its fix; a retry that partially succeeded would have spent
  on images the session would then abandon.
- **`soft diffuse light, shadows barely readable` was kept.** The ruling said
  to prune entries specifying flat, frontal or unmodelled light and to keep
  directional and modelled ones; this entry is neither clearly, being not flat
  and not frontal but barely modelled. Kept as the narrower reading, flagged
  in the mode note as the next candidate. **Your call if you want it gone.**
- **`DEFAULT_IMAGE_CONFIG` was changed to the frozen config**, which A4 did
  not literally ask for — it asked for the doc. Freezing a config the code
  does not use is a document about nothing, and the pre-flight showed the
  default was flash-at-1K.
- **`imageCandidates` was added to the mode schema.** §5.4 has called the
  count mode-overridable since Block 1 and nothing carried it.
- **A per-candidate `gate` field was added.** The gate judges a matte and each
  candidate has its own; `presentation` alone could not carry that.
- **An integration test against the real sidecar was added**, not asked for.
  It is the one seam the API outage left verifiable and the only evidence the
  stage works outside its own fakes.

## Failures and open problems

- **Block 4's definition of done is not met.** No plan has a candidate on it.
  See the DoD table below.
- **The paid generation path has not run since session 3.** Everything
  downstream of `client.generate` is proven; the call itself is not, under the
  frozen config, and neither is the ten-image cache re-run — which would also
  have been the first genuine multi-batch exercise of the eviction fix. That
  fix remains unverified across a full run, as it has been since session 3.
- **`test-1` was not run**, as instructed.
- **The ten-image review page does not exist**, because there are no ten
  images.
- **`no watermark` and `no logo` have never been tested.** `no text` was
  removed because it demonstrably failed; nothing establishes that the other
  two work.
- **The lighting prune's effect is unmeasured** and the axis is not reliably
  obeyed.
- **`slotPresentation` returning null on a split is untested against real
  data** — no real image has ever failed the gate, so no real slot has ever
  had disagreeing candidates.
- **`cutoutQuality`'s scale is a construction, not a measurement.** It is a
  reasonable ordering and no evidence says a 0.3 matte looks worse than a 0.6
  one.
- **The pipeline stage is named `images` for both slot planning and image
  generation**, and `pipeline.images.status` read `done` before a single image
  existed. Pre-existing and confusing; not changed mid-session.
- Carried forward: `cleaning.ts` has never fired on real footage; the Block 3
  insertions listening pass is unjudged; two pro cache entries deleted in
  session 3 are permanently gone.

## Block 4 definition of done

| item | met | evidence |
|---|---|---|
| a fixture Edit Plan where every slot has candidates | **no** | no plan carries a candidate; `vitasilk` has 5 slots and 0 candidates |
| gated cutouts on disk with metrics | **no** for a plan | the six-image corpus has cutouts, metrics and gate outcomes in `benchmarks/results/latest-cutouts/`; no plan references them |
| costs recorded | **no** | the path is tested against fakes and asserted not to touch the real ledger; it has never recorded a real image cost |
| cache preventing regeneration | **partial** | proven for analysis at $0.00 across a mode bump; for images, proven only against fakes and on four surviving entries |

## Repo state

- Branch `main`, HEAD `1125d49` — `test: exercise the image job against the
  real sidecar` at the last code commit; docs commits follow.
- Ten commits this session.
- **`npm run check` exit 0**, `check: PASS`. core **113** (5 files), service
  **497** (33 files), benchmarks **166** (16 files) — **776** TypeScript tests,
  plus **48** sidecar pytest tests. `references: PASS`, `models: birefnet-general ok`.
- No commit carries an AI attribution trailer.
- Pushed at session end.

## Suggested next step

Top up the Gemini prepayment credits at ai.studio, then run exactly the
command that failed — `npm run images -- --plan "<abs>/vitasilk.editplan.json"
--ceiling 2.25`. Everything downstream of the API call is already proven
against the real sidecar, so the run either produces the DoD in one go or
fails on something genuinely new. Budget $1.81 and expect ~$1.51; watch the
first image's dimensions and cost the way session 3's probe did, because the
frozen config has never actually been sent to the API — pro at 2K 1:1 is a
combination this repo has generated at, but not since the config was frozen or
the prompt recomposed. Immediately after it succeeds, re-run the same command
and confirm zero billable calls: that is the cache verification and the first
full-run exercise of the eviction fix in one step, and it costs nothing if the
fix is right. Only then extend the review page and consider `test-1`.
