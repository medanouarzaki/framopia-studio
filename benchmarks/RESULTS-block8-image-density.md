# Eight images per 30 seconds

Measured 2026-08-29. Read-only: **no image was generated, no plan was
re-planned, and no slot was added to any plan on disk.**

## What the density gives

`IMAGE_SLOTS_PER_30S` goes **5.5 → 8** (user ruling). It is the planner's own
rule, `imageSlotCountFor`, read by the planner and by the dry run so the count a
run would plan and the count it is priced at cannot drift. A mode may override
it with `imageSlotsPer30s`.

| reel | length | slots on the plan today | at 5.5 | **at 8** |
|---|---:|---:|---:|---:|
| ground-truth | 23.3 s | 0 | 4 | **6** |
| test-1 | 22.0 s | 4 | 4 | **6** |
| test-2 | 22.3 s | 0 | 4 | **6** |
| test-3 | 21.2 s | 0 | 4 | **6** |
| vitasilk | 25.7 s | 5 | 5 | **7** |

## What generating them would cost

Read from the dry run, not computed again. These are **budgeted ceilings** at
`IMAGE_COST_MULTIPLIER` 1.35, not forecasts.

| reel | analysis | images | total | why |
|---|---:|---:|---:|---|
| ground-truth | $0.18 | **$2.17** | $2.35 | analysis pending; a run plans 6 slots and generates 12 |
| test-3 | $0.18 | **$2.17** | $2.35 | the same |
| test-1 | $0.00 | $0.00 | $0.00 | analysis already done, so a run **skips** it |
| test-2 | $0.00 | $0.00 | $0.00 | the same |
| vitasilk | $0.00 | $0.00 | $0.00 | the same, and its ten images are cached |
| **corpus** | | **$4.34** | **$4.70** | |

**Three of five reels read $0.00 and that is not a rounding.** A stage the plan
records as done is skipped by a run, so it is priced at nothing — session 14's
fix, when the dry run priced work a run would never do.

## What happens to a plan that already has slots

**Nothing, until someone asks for it.** The new density applies when a reel's
slots are *next planned*. `test-1`, `test-2` and `vitasilk` have all run
analysis, so a run skips the stage and their slot counts do not move.

**And re-planning is refused rather than silent.** `planSlots` throws
`SlotsReplaceBlockedError` on a plan carrying recomposed prompts, generated
candidates or a chosen candidate, and demands `--force`.

**What forcing it on `vitasilk` would mean**, since that is the reel with
images: 5 slots become 7, so **14 images at about $2.53** budgeted — and the
**10 already generated are stranded**. Not deleted: the files and their cache
entries survive, but new slot ideas compose new prompts, new prompts fingerprint
differently, and nothing on the new plan points at them. The $1.55 already spent
on them buys nothing further.

**So the density is worth having on a reel that has not been planned yet, and
costs a re-generation on one that has.** `ground-truth` and `test-3` are the two
that would take it for their first planning.
