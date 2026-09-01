# Block 10 session 38 — the pictures are as big as the corner allows, and why the first one meant nothing

**Status: PROBLEM — the size ruling is done and live, but the opening rule cannot
be built honestly: the only signal the pipeline has does not see what he saw.**

## Why the first picture had no meaning

**It drew the speaker, while the speaker was on screen saying her own name.**

`sora`'s first picture covers 0.099–2.180 s, over the words *"السلام عليكم أنا
الدكتورة لبنى كفافي"* — "hello, I am Dr Lobna Kfafi". The idea the model wrote
for it is **"A female doctor in a white coat smiling"**. So a stock doctor is
drawn in the corner while the actual doctor introduces herself in the frame
behind it. The picture is not empty and it is not badly made: **it is redundant
with the footage**, and it adds nothing a viewer cannot already see.

That is a different fault from landing too early, and the other two reels show
it. All three reels open their first picture at **0.099 s — the very first
word** — and the other two are fine:

| reel | opening words | idea | adds something? |
|---|---|---|---|
| test-1 | *bghiti شد طبيعي للوجه* — "you want a natural facial lift" | a woman touching a firm, lifted jawline | **yes** — it shows the result being offered |
| vitasilk | *5 d9ay9 eyyh a lalla* — "five minutes, yes madam" | a clock face at exactly five minutes | **yes** — it shows the claim |
| **sora** | *hello, I am Dr Lobna Kfafi* | a female doctor in a white coat | **no** — she is already in shot |

test-1 and vitasilk open on a **claim**, which has something to illustrate.
`sora` opens on a **greeting and a name**, which does not. So the honest answer
to the question the session was asked is: **a good picture is not too early — a
picture was made for words that had nothing to picture.**

## Whether the opening still has a picture

**It does, and this session did not take it away.** The rule he asked for cannot
be derived from anything the pipeline currently produces, and the standing
instruction is to say so rather than choose a number. Section "The bar" below
gives the measurements behind that, and what would be needed.

## Done

### Ruling 1 — every picture as large as its own corner allows

Live, on his reel and on the corpus. `service/src/placement/top-left.ts` no
longer takes the reel minimum; each slot is drawn at its own corner's maximum.

`sora`, before and after:

| slot | before | now |
|---|---:|---:|
| img001 | 669 | **1045** |
| img002 | 669 | **1045** |
| img003 | 669 | 669 |
| img004 | 669 | 893 |
| img005 | 669 | 881 |
| img006 | 669 | **1057** |
| img007 | 669 | **1061** |
| img008 | 669 | **1073** |
| img009 | 669 | **1085** |
| img010 | 669 | **1061** |
| img011 | 669 | **1049** |
| mean | 669 (31.0%) | **992 (45.9%)** |

The corpus moved the same way: `test-1` 917 → 917/925/925/937, `vitasilk`
837 → 837/905/913/925/937. In both, the one slot that used to set the size is
the one that did not change — it was already at its own maximum.

`img003` is still 669 px, and that is the point of the rule rather than a
leftover: it is the moment he leans forward and his head sits higher in frame,
and 669 px is genuinely all the corner holds there without covering him. Under
the old rule that one slot dragged the other ten down with it.

**Nothing may cover the speaker, and that has not moved.** `placementIsSafe` is
still asserted per slot and the build still refuses; the size is clamped to what
each corner holds before it is placed, so a bigger picture is refused for that
slot rather than granted across his face.

The retired rule's tests are gone rather than left asserting it —
`top-left.test.ts` and `reel-shape.test.ts` now assert the rule in force, and
one of them pins the defect it removed: **a tight slot added to a roomy reel
must change no other slot's size.** `new-video.test.ts` asserts that a
never-seen video's every picture gives up nothing.

**`imageScale: 1.4` was not removed, and here is why.** It is not wholly inert:
under the new rule a value *below* 1 still draws smaller than the corner, so the
field earns its place — only the value 1.4 is meaningless, because anything at
or above 1 asks for more than the corner and is clamped straight back. Removing
it from the mode would change nothing on any reel, because every build reads the
**pinned client snapshot**, which still carries 1.4 — but it would flip all six
existing plans to "behind" and make the panel tell him his client's look has
changed, permanently, until he presses a control. A nag with no benefit is worse
than an unused setting. What was misleading was the documentation, and that is
fixed in `core/src/mode.ts` and `service/src/placement/top-left.ts`: both now say
a value at or above 1 does nothing.

### The bar — what the planner knows, and what it does not

**There is no score.** `service/src/analysis/slot-select.ts:182` takes whatever
candidates the model returned, sorts them **by time**, and keeps one per equal
window on a first-come basis. The only rules are: no overlap, at least 0.5 s
apart, one per window. **There is no rule of any kind about the opening of a
reel** — no minimum offset, no first-slot exclusion, nothing.

There is, however, an **ordering**. `service/src/analysis/slots.ts:100` asks the
model for *"the N strongest slots, best first"*, and `planSlots` throws that
order away when it sorts by time. The order survives in the analysis cache, so
it could be read back for free — and it was.

**The order already had an opinion about `sora`'s opening, and it was not the
one he has.** Of the 22 candidates the model returned for `sora`, the doctor
picture is **rank 10** — the exact median of the eleven the reel actually used.
The model's own strongest, "Bab Mansour gate in Meknes" at 7.26 s, was never used
at all: it lost its window to a candidate the model rated lower.

Then the other two reels:

| reel | opening picture's rank | of | his verdict |
|---|---:|---:|---|
| sora | **10** | 22 | *"no meaning at all"* |
| test-1 | **4** | 8 | no complaint |
| vitasilk | **10** | 10 — **the model's own worst** | no complaint |

**That is the finding, and it is the second of the two the brief named: the
signal does not see what he sees.** He rejected a median-ranked opening and
accepted the lowest-ranked one in the corpus. A bar on rank set high enough to
drop `sora`'s would drop `test-1`'s and `vitasilk`'s too, and a bar set low
enough to keep theirs would keep `sora`'s. **There is no cut on this signal that
separates the picture he rejected from the two he kept** — so any number chosen
here would be a number that works on one reel, which is exactly what he has
forbidden. **This session therefore stops rather than choosing one**, as
instructed.

What would be needed is not a threshold but a different question. The property
that distinguishes the three is the one the diagnosis found: **does the picture
show something the viewer cannot already see?** `sora`'s does not; the other two
do. Nothing in the pipeline asks that. Asking it means changing the analysis
prompt and the slot schema so each candidate says whether it depicts the speaker
or restates what is in frame — a change that costs a model call to validate,
which is billable and was not authorised here. It is also his call, because it
changes what every reel's pictures are chosen for.

**Where it would break, once it exists.** A reel whose every candidate is weak
must still be allowed to open on the speaker rather than be forced to find a
picture; a reel whose opening genuinely is its strongest must keep it; and a reel
with a single slot must not lose its only picture to an opening rule. Any rule
written here has to answer all three, and a rank-based one answers none of them
well.

### The gates

**`npm run golden`: PASS, 4 of 4, 17,174 fields.** Before re-recording, **28
fields differed and every single one was an image layer's `position` or
`scale`** — 7 image layers × 4 fields:

| reel | layers | what moved |
|---|---|---|
| test-1 | 6, 7, 8 | scale 76.40 → 77.07 / 77.07 / 78.07 |
| vitasilk | 6, 7, 8, 10 | scale 69.73 → 76.07 / 77.07 / 75.40 / 78.07 |

**Nothing else moved at all** — no text, no font, no count, no card geometry, and
**no `outPoint`**, so session 37's hold-the-last-frame rule is untouched. In each
reel the slot that used to set the common size is absent from the diff, which is
what the ruling predicts. The reference was re-recorded and a verify run passed
field for field.

**`sora` was rebuilt last and is at `.local/build/sora-995f2d27-full.aep`** —
112 layers, 11 pictures at 669–1085 px, 88 cards none shrunk, 0 placeholder
words surviving, 0 mismatches against the plan, no font outside `k2-syndicalia`,
and every picture's out point still equal to its words' end. The three
`sora-size-A/B/C` comparison files were deleted; the choice is made.

**`npm run check` exits 1, and nothing new is red.** Per workspace, from its own
output:

| workspace | files | tests |
|---|---|---|
| core | 50 passed, **1 failed** (51) | **756 passed**, 0 failed |
| service | 96 passed (96) | **1229 passed** |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 10 passed, **1 failed** (11) | 209 passed, 2 skipped, **4 failed** |

Both failures are the ones already on the record. The panel's are four of the
five image-picker tests session 35 measured — three cutout fixtures name files
that moved into per-reel subdirectories. Core's is not a failing test at all:
all 756 pass and the *file* fails on `Hook timed out in 10000ms` while
`align-sheet.browser.test.ts` closes Chromium in `afterAll`, which session 37
measured at one run in four.

`check.sh` stops at the first failing step, so the gates after the test step were
run on their own: **modes ok, templates 6 entries ok, ExtendScript 15 files ok,
CLAUDE.md 9,420 of 20,000, references PASS, `validate-templates` 6 templates ok
against the audited `library.aep`**, and the Python sidecar's suite, which
`check` does not run, **149 passed**.

**`sora.mov`, its eleven candidates and every cache entry are untouched** — cache
71 entries / 128 files / 106 MB at both ends, `sora.mov` `344265a0…` at both
ends, ledger **144 lines / `d886596…`, $0.00 spent**.

## Deviations

**After Effects went unresponsive twice mid-session.** Two golden runs failed
with `AeDriveError: After Effects wrote no result` — once on `test-2`, once on
`test-1` — after a long sequence of builds. Both were transient: a `DoScript`
probe returned 0, and the next attempt built and passed. The reel that failed
first has **no image slots at all**, so it does not touch anything this session
changed. Recorded because a build that vanishes without a reason is worth
counting, not because it is understood.

## Failures & open problems

1. **Ruling 2 is not implemented**, deliberately and with the measurements above.
   The opening still gets a picture on every reel.
2. **Unproven by name: the throwaway videos.** `new-video.test.ts` drives one
   never-seen video end to end with every network seam substituted, and it now
   asserts the size ruling. **A second and third video of different shapes were
   not built**, and `reel-shape.test.ts` covers no opening rule because there is
   none to cover.
3. **The picture path's golden coverage is still two reels of four** — `test-2`
   and `test-3` have no image slots, which is why all 28 differing fields came
   from `test-1` and `vitasilk`.
4. The two browser test files remain red for the cause session 35 measured.

## Repo state

Branch `main`. Ledger **144 lines / `d886596…`** at both ends.
`templates/library.aep` `4b0cf05a…c52734` at both ends, never opened for writing.
The six references byte-identical. Cache unchanged. `sora.mov` unchanged. No
project of the user's own was saved.

## Suggested next step

Decide whether the analysis should be asked, per candidate, whether its picture
shows something the viewer cannot already see. That is the question that
separates the opening he rejected from the two he kept, and no threshold on what
exists today does.

---

**The one file, and the one moment**

`.local/build/sora-995f2d27-full.aep` — look at **8.4 seconds**, the seedling.
It is the one picture still at 669 px while every other is 881 to 1085, because
that is the moment he leans forward and it is genuinely all the corner holds.
Whether that one small picture reads as wrong is the thing to judge.
