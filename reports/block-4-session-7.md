Status: OK

Block 4 is closed. The corrections are applied, `edge_halo` now measures what
it claims, both rulings are in, and the block reconciles.

The substantive result is a **refuted hypothesis**. The halo fix was built on
the belief that the gate was rejecting rendered rim light. It is not: the
failures are genuine retained background, the rendered rim lives somewhere the
metric never measured, and the fix changes no verdict on any of the sixteen
existing images.

## Ledger

| | entries | total | sha256 |
|---|---|---|---|
| start | 105 | $10.555772 | `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` |
| end | 105 | $10.555772 | `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` |

Byte-identical. **$0.00** against a $0.25 ceiling. Three cached runs of the
image job during the session each printed `billed 0, cached 10, $0.000000`.

## Done

### A1 — the failure count

Verified from the plan data rather than the table: **5 candidates fail on
`edge_halo`**, not six, and **4 fail on halo alone** — img004-c2 fails
`hole_ratio` regardless. The three stated reasons summed to 10 against 8
failing candidates by double-counting it.

**Four is the number that matters**: a halo fix would move yield 2/10 → 6/10
and leave img004 and img005 on `card`. Corrected in
`reports/block-4-session-6.md`, `reports/latest.md`,
`benchmarks/RESULTS-block4-vitasilk.md` and `CLAUDE.md`.

### A2 — the causal claim downgraded

Session 6 attributed the failures to the v5 lighting prune as though measured.
It is a hypothesis: the clean corpus was six images of **one slot**, these ten
span five slots with different subjects, and session 5 had already recorded
the lighting axis as not reliably obeyed. Lighting changed, and so did subject
and slot. Restated with the confound named in all four files.

### B — `edge_halo` compares against the original

`tools/cv/framopia_cv/metrics.py`. A ring pixel is excluded when the original
is bright there — luminance at or above `RENDERED_LIGHT_LUMA = 0.5` — because
the light was in the source. Declared before measuring, at the midpoint of the
range; the gap is wide, #1A0000 being 0.022 and #F8F6F2 0.965.

The accepted failure mode is stated at the function: **a subject lit against a
bright ground is excluded either way.** The metric separates a rendered rim
from a retained *dark* background, not from a retained bright one, and on a
mode with a light background it would go blind.

**`MAX_EDGE_HALO` is unchanged at 0.10.**

#### All sixteen images

| image | halo before | halo after | delta | gate before | gate after |
|---|---|---|---|---|---|
| `gemini-3-pro-image-1` | 0.0749 | 0.0744 | -0.0005 | cutout | cutout |
| `gemini-3-pro-image-2` | 0.0966 | 0.0966 | +0.0000 | cutout | cutout |
| `gemini-3-pro-image-3` | 0.0435 | 0.0435 | +0.0000 | cutout | cutout |
| `gemini-3.1-flash-image-1` | 0.0619 | 0.0619 | -0.0000 | cutout | cutout |
| `gemini-3.1-flash-image-2` | 0.0965 | 0.0965 | +0.0000 | cutout | cutout |
| `gemini-3.1-flash-image-3` | 0.0607 | 0.0599 | -0.0008 | cutout | cutout |
| `img001-c1` | 0.1004 | 0.1004 | +0.0000 | card | card |
| `img001-c2` | 0.1187 | 0.1187 | +0.0000 | card | card |
| `img002-c1` | 0.0532 | 0.0499 | -0.0034 | cutout | cutout |
| `img002-c2` | 0.0455 | 0.0455 | +0.0000 | cutout | cutout |
| `img003-c1` | 0.1214 | 0.1218 | +0.0004 | card | card |
| `img003-c2` | 0.1703 | 0.1703 | +0.0000 | card | card |
| `img004-c1` | 0.0960 | 0.0979 | +0.0019 | card | card |
| `img004-c2` | 0.1395 | 0.1400 | +0.0005 | card | card |
| `img005-c1` | 0.0963 | 0.1000 | +0.0037 | card | card |
| `img005-c2` | 0.0824 | 0.0830 | +0.0006 | card | card |

**Zero of sixteen verdicts changed. Yield stays 2/10.**

#### Why: the premise was wrong

| candidate | ring luma p50 | p90 | p99 | max | share ≥ 0.5 |
|---|---|---|---|---|---|
| `img001-c1` | 0.022 | 0.157 | 0.348 | 0.408 | **0.0%** |
| `img003-c2` | 0.070 | 0.140 | 0.214 | 0.447 | **0.0%** |
| `img002-c2` | 0.023 | 0.064 | 0.159 | 0.316 | **0.0%** |

**No pixel in any measured ring reaches the boundary.** The ring sits over
#1A0000 and the alpha there is retained background — the halo failures are
**real halo**, and raising the bound would admit real defects.

The rim the user saw is real and sits **inside** the solid mask, where the
remover correctly keeps it:

| image | inside-edge luma p50 | core p50 | outside-ring p50 |
|---|---|---|---|
| `gemini-3-pro-image-1` | **0.921** | 0.079 | 0.031 |
| `img002-c1` | **0.877** | 0.429 | 0.295 |
| `img001-c1` | 0.088 | 0.081 | 0.046 |

Two different things were conflated: a rendered rim the matte includes, and a
soft halo of dark background it leaves. Both facts are asserted in
`tools/cv/tests/test_degradation.py` rather than left as prose.

#### The fourth-decimal check — it is worse than that

| image | halo | margin | verdict |
|---|---|---|---|
| `img001-c1` | 0.1004224016 | **+0.000422** | fails |
| `img005-c1` | 0.0999574013 | **−0.000043** | passes |
| `img004-c1` | 0.0978757628 | −0.002124 | passes |
| `gemini-3-pro-image-2` | 0.0965631087 | −0.003437 | passes |
| `gemini-3.1-flash-image-2` | 0.0965196302 | −0.003480 | passes |

**`img005-c1` passes by 43 parts in a million.** Two candidates decide at the
**fifth** decimal; five of sixteen sit within 0.35% of the bound. Nothing was
moved, and refitting to sixteen images from two reels would not be evidence —
but a gate whose outcome turns on the fifth decimal is reporting a coin-flip
as a verdict.

#### The metric can still fail

The fix could have blinded it. A real cutout with alpha dilated over dark
ground, **with the original supplied**, still crosses:

```
dilate_alpha(real cutout) + original luminance -> edge_halo 0.60 > 0.10 -> card
```

### C1 — single-subject slot ideas

`checkSlotIdea` in `core/src/mode.ts`, thrown as `MultiSubjectIdeaError` from
`planSlots`. A **hard failure at plan time** naming the slot and the phrase,
never a rewrite.

**Flagged on both plans:**

| plan | slot | idea | markers |
|---|---|---|---|
| vitasilk | `img003` | Vitamin capsules and scientific molecular structures blending into a thick hair cream | `capsules` |
| vitasilk | `img005` | A salon shelf displaying premium hair care products | `shelf`, `display`, `products` |
| test-1 | — | none flagged (4 slots) | — |

`test-1`'s `a small vial` (singular) correctly passes. **Neither idea was
edited and nothing was re-planned.** Recorded in PROJECT_SPEC §5 and
ARCHITECTURE §5.4.

### C2 — cumulative spend

`costs.spentUsd` and `costs.spentByStage` accumulate; `byStage` stays
last-run, because session 6 valued its diffability. Both written through
`recordStageSpend` (`service/src/editplan/costs.ts`) so they cannot drift, and
applied to transcription through the merge.

**`vitasilk` reconciled against the ledger:**

| | |
|---|---|
| plan `spentByStage.images` | **$1.550444** |
| ledger, ten production lines from 17:43 | **$1.550444** |
| plan `byStage.images` after the cached re-run | $0.000000 |

**The ledger has no reel identifier**, so only the images figure is precisely
attributable — the ten lines are one per candidate on this plan. Transcription
and analysis stay absent, and absent means unknown rather than zero. Backfilled
explicitly; the code did not produce it.

**All five plans open through `readEditPlan`:**

```
OK   vitasilk      v1 slots=5 candidates=10 spentUsd=1.550444
OK   test 1        v1 slots=4 candidates=0  spentUsd=absent
OK   ground truth  v1 slots=0 candidates=0  spentUsd=absent
OK   test 2        v1 slots=0 candidates=0  spentUsd=absent
OK   test 3        v1 slots=0 candidates=0  spentUsd=absent
```

### D1 — block reconciliation

| | |
|---|---|
| ledger entries | 105 |
| ledger total | $10.555772 |
| `images-generate` lines | 21, $2.999710 |
| session 2 | 1 line, $0.122593 |
| session 3 | 10 lines, $1.326673 |
| session 6 | 10 lines, $1.550444 |
| sum of sessions | **$2.999710** — reconciles exactly |
| wasted (session 3) | $0.514522, **17.2%** of block image spend |

**One discrepancy, flagged rather than reconciled silently.** Session 6's
report quoted $1.326676 and $2.999713; the raw ledger floats give $1.326673
and $2.999710. The $0.000003 difference is from summing per-image figures
rounded to six places rather than the stored values. The ledger is the
authority; the session-6 figures are three ten-thousandths of a cent high.

### D2 — amendment sweep

`docs/BLOCK4-AMENDMENTS.md`. Every amendment with its doc and section,
**verified against the repo** rather than restated: PROJECT_SPEC §5 (frozen
config, single-subject ideas, candidate default), ARCHITECTURE §5.4 (four
amendments), ARCHITECTURE §3 (twelve schema additions, every one confirmed
optional by reading the type), CLAUDE_CODE_GUIDELINES §4, and the
transcription decision-doc drift correction.

While verifying, found that ARCHITECTURE §5.4's base statement and cutout-gate
sentence had been absorbed into an amendment paragraph by an earlier edit of
mine. Restructured so they precede the amendments.

## Deviations

- **The marker list was extended beyond the brief's examples** to include
  `capsules`, `sachets` and `vials`. The brief said "plurals of product
  nouns"; `capsules` is one, and excluding it while including `bottles` would
  be inconsistent. It pulls `img003` into the flagged set — a bigger claim
  than `img005` alone, and stated as a judgement rather than slipped in.
- **Slot planning's stage key changed from `images` to `imageSlots`.** Not
  asked for, but slot planning and image generation were writing the same
  `byStage` key, and a cumulative total over a shared bucket means nothing.
  Session 6 had already recorded the naming as confusing.
- **`vitasilk`'s plan metrics were refreshed** by a cached re-run so the
  corrected halo values reach the plan and the review page. $0.00, ledger sha
  unchanged.
- **`vitasilk`'s `spentUsd` was backfilled from the ledger.** The field is new
  and the history is real; leaving it absent would have understated a known
  figure. Reported as a backfill, not as something the code produced.

## Failures and open problems

- **The gate's yield is 2/10 and the halo fix did not improve it.** The four
  halo-alone failures are genuine retained background. The options session 6
  listed are down to two: accept `card` for these, or move the bound on
  evidence that does not exist yet.
- **The bound decides at the fifth decimal** on two of sixteen images. That is
  not a working threshold on those images whichever way they fall.
- **`edge_halo` goes blind on a light-background mode**, by construction. K2
  grounds everything against #1A0000 so it works here; the first client mode
  with a light ground needs this revisited, not trusted.
- **The multi-subject marker list is incomplete by construction** and misses
  `scientific molecular structures` in the very idea it does flag, on a
  different word. A hard failure built on a word list will keep missing cases.
- **`no watermark` and `no logo` have never been tested** as controls.
- **The ledger has no reel identifier.** Cumulative per-reel spend can only
  accumulate forward; for every reel but `vitasilk` it is unknown, and even
  there only the images stage is attributable.
- **`img003` and `img005` are flagged but still on the plan.** Re-planning
  costs a Gemini call and was deliberately not spent. The plan and the rule
  now disagree, which is the honest state.
- **The "candidates disagree" presentation is still untested on real data.**
- Carried forward: `cleaning.ts` has never fired on real footage; the Block 3
  insertions listening pass is unjudged; two pro cache entries deleted in
  session 3 are permanently gone.

## Repo state

- Branch `main`, HEAD `6aca993` — `docs: sweep the block 4 amendments and
  record the halo precision` at the last commit before the report.
- Seven commits this session.
- **`npm run check` exit 0**, `check: PASS`. core **121** (6 files), service
  **512** (35 files), benchmarks **166** (16 files) — **799** TypeScript tests,
  plus **58** sidecar pytest tests. `references: PASS`,
  `models: birefnet-general ok`.
- No commit carries an AI attribution trailer.
- Pushed at session end.

## Suggested next step

The block is closed and the open items are all rulings rather than code. The
one worth taking first is the halo bound, because it now has evidence behind
it that it did not have this morning: the failures are genuine retained
background, not misclassified rim light, so the question is no longer "is the
metric wrong" but "is 0.10 the right amount of leftover background to
tolerate" — and two images decided at the fifth decimal say the bound is
sitting where the footage is densest. Looking at `img001-c1` and `img005-c1`
side by side on the dark ground would settle it: they differ by 0.0005 of mean
alpha and land on opposite sides, so if they look the same to you the bound is
in the wrong place regardless of direction. After that, Block 5 is the CV
zones work, and re-planning `vitasilk` to clear the two flagged ideas costs one
Gemini analysis call whenever a second fixture is worth it.
