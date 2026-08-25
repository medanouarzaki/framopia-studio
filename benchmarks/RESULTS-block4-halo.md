# The edge-halo metric, corrected — and a hypothesis refuted

`edge_halo` measured alpha in a band outside the subject and **could not tell
a rim the model rendered from background the remover retained**. Session 7
fixed that by comparing each ring pixel against the same pixel in the original
image. **No threshold was changed.**

The fix is correct and it changes nothing on this footage, because **the
premise behind it was wrong**. That is the finding.

## What the fix does

A ring pixel is excluded when the original is bright there — luminance at or
above `RENDERED_LIGHT_LUMA = 0.5` — because the light was in the source, so
alpha there is a rendered highlight. A ring pixel dark in the original but
carrying alpha in the cutout is background that should have gone, and it
counts.

The boundary was declared before the corpus was measured, at the midpoint of
the luminance range and not fitted to any image. The gap it has to sit in is
wide: the K2 mode grounds every subject against `background` #1A0000, whose
Rec. 709 luminance is **0.022**, while a rendered highlight runs toward
`light` #F8F6F2 at **0.965**.

**The failure mode this accepts:** a subject genuinely lit against a bright
ground is excluded either way. The metric separates a rendered rim from a
retained *dark* background, not from a retained bright one. On a mode with a
light background it would go blind, which is a reason to revisit it there
rather than to trust it.

## All sixteen images, before and after

Six bake-off corpus images and ten `vitasilk` candidates. **No generation, no
API call.**

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

**Zero of sixteen gate verdicts changed.** Yield stays **2/10** on `vitasilk`
and 6/6 on the corpus.

## Why: the hypothesis was wrong

Session 6 attributed the halo failures to rendered rim light being
misclassified. Measuring the ring's luminance directly refutes it:

| candidate | ring luma p50 | p90 | p99 | max | share at or above 0.5 |
|---|---|---|---|---|---|
| `img001-c1` | 0.022 | 0.157 | 0.348 | 0.408 | **0.0 per cent** |
| `img003-c2` | 0.070 | 0.140 | 0.214 | 0.447 | **0.0 per cent** |
| `img002-c2` | 0.023 | 0.064 | 0.159 | 0.316 | **0.0 per cent** |

**No pixel in any measured ring reaches the boundary.** The ring sits over
#1A0000. The alpha there is retained background, and the halo failures are
**real halo**.

### The rim is real, and it is somewhere else

The user's session-5 observation stands — the bright edge is in the original.
It is simply not in the region this metric measures. Comparing a band just
*inside* the solid edge against the band outside it:

| image | inside-edge luma p50 | core p50 | outside-ring p50 |
|---|---|---|---|
| `gemini-3-pro-image-1` | **0.921** | 0.079 | 0.031 |
| `img002-c1` | **0.877** | 0.429 | 0.295 |
| `gemini-3-pro-image-2` | 0.044 | 0.224 | 0.064 |
| `img001-c1` | 0.088 | 0.081 | 0.046 |

Where a rim was rendered it is **inside the solid mask**, and the remover
correctly kept it as subject. Two different things were conflated: a rendered
rim the matte includes, and a soft halo of dark background the matte leaves.
They do not overlap.

## What this means for the gate

**The four halo-alone failures are genuine matte defects.** Raising
`MAX_EDGE_HALO` would admit real retained background, not rescue correct
renders. The ruling session 6 asked for now has one fewer option: the metric
has been fixed and the failures survived it.

### The bound is deciding at the fifth decimal

Asked to check whether any candidate decides at the fourth decimal, the answer
is worse than that. Every image within one per cent of the bound:

| image | halo | margin | verdict |
|---|---|---|---|
| `img001-c1` | 0.1004224016 | **+0.000422** | fails |
| `img005-c1` | 0.0999574013 | **−0.000043** | passes |
| `img004-c1` | 0.0978757628 | −0.002124 | passes |
| `gemini-3-pro-image-2` | 0.0965631087 | −0.003437 | passes |
| `gemini-3.1-flash-image-2` | 0.0965196302 | −0.003480 | passes |

**`img005-c1` passes by 43 parts in a million.** `img001-c1` fails by 422.
Five of sixteen images sit within 0.35 per cent of the bound, and two of them
are decided at the **fifth** decimal.

A threshold resolving cases that finely is not doing real work on those
images: the difference between `img005-c1` and `img001-c1` is 0.0005 of mean
alpha in a ring, and nothing suggests a human could see it. The bound is
sitting in the middle of this footage's distribution rather than above it.

**Nothing was moved.** Refitting is out of scope and would be fitting to
sixteen images from two reels. But a gate whose outcome turns on the fifth
decimal is reporting a coin-flip as a verdict, and that is the more useful
thing to know than which side any one image landed.

## The metric can still fail

An exclusion rule that can be talked out of firing is worth less than no rule.
A real cutout with its alpha dilated over dark ground, **with the original
supplied**, still crosses:

```
dilate_alpha(real cutout) + original luminance -> edge_halo 0.60 > 0.10 -> card
```

Asserted in `tools/cv/tests/test_degradation.py`, alongside an assertion that
the real corpus ring is dark in the source and the inside-edge band is bright
— so the explanation above is checked by the suite rather than left as prose.
