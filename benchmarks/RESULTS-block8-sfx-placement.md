# The impact frame resolved, and every placement in one table

2026-08-28. Free, local, `$0.00` and no model call.

## The threshold

`IMPACT_THRESHOLD` goes **0.95 → 0.90**, and placement moves from
`impactFrameOf` (the last entrance keyframe, the **settle**) to
`impactCrossingOf` (where the interpolated curve first reaches the threshold).

| threshold | `kw_slam` Transform/Position crosses |
|---:|---:|
| 0.8966 | **4.00 f** — the user's own figure |
| **0.90** | **4.06 f** — chosen |
| 0.95 | 5.25 f — session 24, never shipped |
| linear at 0.90 | 10.80 f |
| last keyframe | 12.00 f — session 22, what was in force |

**All six comps cross at 4.06 frames**, which is what one shared easing preset
should produce and is the evidence the AE convention is being read correctly.

**CHOSEN, NOT MEASURED**, with its reasoning: the user drew these curves and puts
`kw_slam`'s arrival at frame 4. Session 24 measured 5.25 and shipped nothing
because the two disagreed. **Where a measurement and the author of the animation
disagree by less than two frames, the author decides.** 0.90 is his figure to
within a sixteenth of a frame, and it is a round number rather than 0.8966 —
which would be a measurement of this one comp's curve rather than a rule the
next client's templates inherit.

The 8-frame error he heard is **not** the 1.25 frames between the two candidate
thresholds; it is the distance from the settle, where the sound actually sat.

## Every event, all three placements

`s22` is what was in force and what he heard; `s24` is what session 24 measured
and did not write; `s26` is what is now on the plans.

| reel | element | sound | s22 | s24 | **s26** | s22 → s26 |
|---|---|---|---:|---:|---:|---:|
| test-1 | img001 | whoosh_01 | 0.000 | 0.000 | **0.000** | clamped |
| test-1 | k001 | hit_01 | 0.000 | 0.000 | **0.000** | clamped |
| test-1 | k002 | hit_01 | 4.071 | 3.871 | **3.837** | −7.00 f |
| test-1 | img002 | whoosh_01 | 4.304 | 4.071 | **4.037** | −8.00 f |
| test-1 | img003 | whoosh_01 | 10.644 | 10.410 | **10.377** | −8.00 f |
| test-1 | img004 | whoosh_01 | 19.419 | 19.219 | **19.152** | −8.00 f |
| test-2 | k001 | hit_01 | 2.936 | 2.736 | **2.669** | −8.00 f |
| test-2 | k002 | hit_01 | 7.307 | 7.074 | **7.040** | −8.00 f |
| test-2 | k003 | hit_01 | 8.575 | — | — | **dropped for spacing** |
| vitasilk | img001 | whoosh_01 | 0.000 | 0.000 | **0.000** | clamped |
| vitasilk | k003 | hit_01 | 3.770 | 3.537 | **3.504** | −8.00 f |
| vitasilk | img002 | whoosh_01 | 5.973 | 5.739 | **5.706** | −8.00 f |
| vitasilk | k001 | hit_02 | 5.339 | — | **6.607** | file changed |
| vitasilk | k002 | hit_01 | 6.573 | — | — | **dropped for spacing** |
| vitasilk | img003 | whoosh_01 | 11.345 | 11.111 | **11.078** | −8.00 f |
| vitasilk | img004 | whoosh_01 | 16.650 | 16.416 | **16.383** | −8.00 f |
| vitasilk | img005 | whoosh_01 | 19.720 | 19.486 | **19.453** | −8.00 f |

**12 of 15 events moved, every one of them 8.00 frames earlier** — 7.00 on
test-1 `k002`, where the snap to the 29.97 grid falls the other way. **3 clamp**
at the composition start, unchanged, because their derived in-point is negative.

`vitasilk` `k001` is not a placement comparison: the spacing and variation rules
moved it to `hit_02`, whose anchor sits 0.5433 s into the file against
`hit_01`'s 2.0525 s, so its in-point is a different arithmetic. Under `hit_01`
it would have been 5.105.

**The three clamps are worse under this threshold, not better**, and it is
reported rather than absorbed: a nearer impact means the layer must start even
earlier, so `test-1` `k001`'s anchor is late by **1.502 s** where it was 1.268,
and both `img001` whooshes by **0.467 s** where they were 0.200. Those are
elements at the very start of a reel; nothing can be placed before frame zero.

## The change surface

`npm run migrate:sfx-placement` now **asserts** that a migration touches only
`meta`, `source` and `sfx`, by comparing the file before and after and throwing
rather than writing. Verified independently against a snapshot of all five
plans taken before the run: `ground truth` and `test 3` changed `meta` alone,
the other three `meta` and `sfx`. Nothing else on any plan.
