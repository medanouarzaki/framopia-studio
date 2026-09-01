# Block 10 session 42 — the picture was sized for a position she is never in

**Status: OK.** $0.00 spent; the ledger did not move.

## The one frame, and what she is doing in it

**She is on a different sofa, in a different room. The reel cuts.**

The picture he is looking at at 6.2 s is **`img002`**, and it was 669 px. It is
on screen from **5.679 s to 8.939 s**. For the first six of its eight measured
frames — 5.5 s through 8.0 s — she is standing in the corridor, her face top
sits at 1224–1256 px, and **each of those frames on its own would allow
1073–1105 px.**

Then the reel cuts. At **8.5 s** she is seated on a sofa against a wooden wall,
her face high in frame at 820 px — but also well to the **right**, at 1100 px.
That frame on its own allows **949 px**.

So every single frame of that picture's life allows at least 941 px. It was
drawn at 669.

**The 669 comes from a position she is in at no point in either shot.** The
placement took the union of the face boxes across the life: the **leftmost**
edge she reaches (780 px, standing, at 6.0 s) and the **highest** her face
reaches (820 px, seated, at 8.5 s). Those are two different frames. The union is
a box containing a speaker who is simultaneously as far left as she gets and as
high as she gets — which never happens — and the corner was sized for her.

**So: the union is over-cautious, and this is not "she leans in".** The record
said she leans forward and 669 px was honest. That was measured in session 36
against the slot's *original* window, which ended at 7.159 s — before the cut.
Sessions 39 and 40 stretched the picture's life past the cut and nobody looked
again. Splitting the 376 px:

| | `img002` size | why |
|---|---:|---|
| session 36's window (4.34–7.16 s, one shot) | **1045 px** | the cut is not in it |
| the same rule over the life (5.68–8.94 s, two shots) | **669 px** | the union of two framings |
| **per frame over that same life** | **941 px** | the tightest frame's own bound |

**272 of the 376 px are the union inventing a position.** The remaining 104 px
are honest: the picture really is on screen during the seated shot, where the
corner really is smaller.

`img003`, the seedling, is a separate picture at 8.939–11.099 s, and it is
**893 px**, not 669. At 6.2 s the layer on screen is `img002`.

## The fix, and why it is not a fitted number

A square anchored in the top-left corner is clear of the speaker at one frame if
it stops **before her left edge** *or* **above her head** — either separation is
enough on its own, and the code already knows this: it takes
`max(beside, above)` per box.

So the largest square that is safe for a whole life is

> **the smallest, across the frames, of each frame's own `max(beside, above)`**

and what the code computed was

> `max(` smallest `beside` across frames`,` smallest `above` across frames `)`

The second is **always less than or equal to** the first, for every reel and
every speaker, because each of its two terms is a lower bound on every frame's
`max`. It is not a tuning constant that was set too tight; it is a different
quantity, and it is the wrong one. The replacement is the exact largest safe
size, so there is nothing to choose and nothing fitted.

`sora`'s `img002`: **669 → 941 px.** The reel now runs **881–1073 px** instead of
669–1073, and the odd one out is gone.

## Done

### A — what the tool actually measured

`img002`, frame by frame across its life, from the same masks the build reads:

| t | face top (px) | face left (px) | that frame alone allows |
|---:|---:|---:|---:|
| 5.5 | 1224 | 784 | 1073 |
| 6.0 | 1228 | **780** | 1077 |
| 6.5 | 1244 | 808 | 1093 |
| 7.0 | 1224 | 808 | 1073 |
| 7.5 | 1224 | 792 | 1073 |
| 8.0 | 1256 | 784 | 1105 |
| **8.5** | **820** | 1100 | 949 |
| 9.0 | 848 | 1092 | **941** |

The union's top edge comes from **8.5 s** and its left edge from **6.0 s** —
**2.5 seconds apart, and on opposite sides of a cut.** The frame he is judging,
6.2 s, is one of the six where the corner is wide open.

All eleven slots, and what the two rules give:

| slot | life (s) | frames | union (was) | per frame (now) | gain |
|---|---:|---:|---:|---:|---:|
| img001 | 4.72 | 12 | 1037 | 1037 | 0 |
| **img002** | 3.26 | 8 | **669** | **941** | **+272** |
| img003 | 2.16 | 7 | 893 | 893 | 0 |
| img004 | 4.28 | 10 | 881 | 881 | 0 |
| img005 | 4.30 | 11 | 849 | 917 | +68 |
| img006 | 3.16 | 8 | 1061 | 1061 | 0 |
| img007 | 2.66 | 8 | 1061 | 1061 | 0 |
| img008 | 4.94 | 12 | 1073 | 1073 | 0 |
| img009 | 3.20 | 9 | 1061 | 1061 | 0 |
| img010 | 3.70 | 9 | 1049 | 1049 | 0 |
| img011 | 1.24 | 5 | 1049 | 1049 | 0 |

And the corpus: `test-1` **unchanged on all four**; `vitasilk` +36, +40, +12 on
three of five; `ground-truth` **unchanged on all six**. **19 of the project's 26
slots do not move at all.** The rule only gives back what the union invented,
and where a speaker really is high in frame for a whole life it takes nothing.

### B — the measurement itself is sound

**How the box is made.** `tools/cv/head_boxes.py` reads person masks already on
disk — no model runs here — thresholds the face-skin confidence map at 0.25, and
returns the bounding box of the non-zero pixels as frame fractions. On `sora`
that is **82 frames at 2 fps**. It is the **face skin alone**, not the head:
`"face"` and `"head"` are both selectable and the placement asks for `face`.

**What is added on top.** `HEAD_CLEARANCE` 0.04 and `TOP_LEFT_MARGIN` 0.03, both
fractions of frame width, both marked *chosen, not measured* in their own
comments. Together they take **151.2 px** (86.4 + 64.8) off every bound. On
`img002`'s tightest frame that is the difference between a face top at 820 px
and a corner of 669 px — so **the margins account for 151 px of the old 669 and
are the reason the picture is not simply 820 px**. They were not changed: they
are the slack that covers the sub-sample gap below, and they are his taste.

**Checked against the real video.** Frames were pulled from `sora.mov` at 6.2,
8.0, 8.5 and 9.0 s and looked at. At 6.2 and 8.0 s she is standing in the
corridor with the top-left corner plainly empty; at 8.5 s she is seated on a
sofa in a different room. **The box is not wrong** — it tracks her correctly in
both shots. The fault was entirely in combining them.

**Between samples nothing is measured.** At 2 fps a frame 0.25 s after a sample
is not looked at; the code neither interpolates nor holds, it simply uses the
samples it has, plus **half a sample of slack at each end** of the span so a
movement beginning just outside is still caught. A lean that starts and ends
between two samples is missed — and that was true of the union rule too, which
is no more a proof between samples than this one is. `HEAD_CLEARANCE`'s 86.4 px
is what absorbs it. Naming it rather than claiming it is covered.

### C — the change

`topLeftPlacementDetail` now takes **one box per sampled frame** instead of their
union, and:

- **the size** is the smallest, over the frames, of each frame's own better bound;
- **the nudge** is still bounded by the union, because a move that must be safe
  at every frame has to clear the extreme of every frame. Two different
  questions, two different boxes, and the comment says so;
- **`placementIsSafe` is asserted per frame** in the build, in the placement
  report and in the tests. A picture that clears the union told you nothing you
  did not know; what has to be true is that it is clear in every frame it is on
  screen. The build refuses and names how many frames of how many failed.

A single box still means exactly what it did, so the change is one code path and
the existing single-box cases keep their meaning.

**Session 39's guarantee is not undone.** It is asserted more strictly than
before: frame by frame rather than against a union. `npm run place:images` reports
**clears face yes, in frame yes** for all fifteen corpus slots, over 4 to 20
frames each.

**Alternatives rejected**, since he judges by eye and may prefer one:

- **Let a picture change size during its life.** It would be at its full size in
  the corridor and shrink at the cut. On screen that reads as the picture
  flinching — a scale change with no motivation the viewer can see — and it
  would fight the entrance animation. Rejected.
- **End a picture at the cut instead of shrinking it.** `img002` would run
  5.68–8.20 s at 1073 px and the corner would then be empty until 8.94 s. That
  reintroduces exactly the void his 1 September ruling removed. Rejected.
- **Detect the cut and treat the two shots separately.** This is the same thing
  as measuring per frame, without the shot-detection: per frame already gives
  the right answer at a cut and everywhere else, and needs no new machinery.
- **Widen the margins less.** That is a change to his taste, not to a defect.

**Where it breaks.** A speaker who moves constantly gets the tightest frame's
size, which is correct and can still be small. A very long hold covers more
frames, so more chances of a tight one — the rule cannot help there and does not
pretend to. A picture whose whole life has her high in frame is genuinely small
and stays small; there is nothing to recover. And between two samples nothing is
measured, which the clearance absorbs.

### D — what stops this happening on the next reel

**No value is fitted to a reel or a slot.** The replacement is the exact largest
safe size, derived from the same "left of her **or** above her" rule that was
already there.

- **`reel-shape.test.ts`, 12 new cases**: a speaker who leans in once, who moves
  through five positions, who never moves, a life whose every frame is tight, a
  single box behaving exactly as before, and the nudge over five seeds. The
  headline case builds the cut by hand — a standing box and a seated box — and
  asserts the union answer (670 px) against the per-frame answer (960 px) with
  both frames proved clear.
- **`new-video.test.ts`** asserts the guarantee **frame by frame** on all three
  throwaway videos, reporting how many frames of how many were unsafe, and fails
  if no frame was checked at all.

**How it was proved to fire.** The sizing was mutated to take the *most*
generous frame instead of the least, and the suite re-run: **eight synthetic
cases and all three videos went red**, each naming its unsafe frame count —
`img001 unsafe in 15 of 16 frames` on the second video. The mutation was
reverted and the file confirmed clean.

### E — the gates

**`npm run golden`: 12 fields differed, and every one was an image layer's
`position` or `scale` on `vitasilk`.**

| reel | layers | what moved |
|---|---|---|
| vitasilk | `img001`, `img002`, `img005` | scale 73.73 → 76.73, 66.40 → 69.73, 76.07 → 77.07 |

**No timing field moved anywhere** — no `inPoint`, no `outPoint` — and no text,
font, count or card geometry. `test-1`, `test-2` and `test-3` matched **field
for field**. The three layers are exactly the three slots the measurement
predicted would gain, at exactly the predicted +36, +40 and +12 px; `img003` and
`img004`, predicted to gain nothing, are absent from the diff. The reference was
re-recorded (`74436a960706fecd`) and a verify run passed **4 of 4, 17,174
fields**.

**`sora` rebuilt** at `.local/build/sora-995f2d27-full.aep` — 112 layers,
**881 to 1073 px**, mean 1002. Every gap exactly `0.00e+0`, `stretch = 100`
throughout, and **not one in point or out point changed**: this session moved
sizes only.

**`npm run check`: PASS, exit 0**, on its only run. Per workspace:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **757 passed** |
| service | 97 passed (97) | **1263 passed** |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 11 passed (11) | **213 passed**, 2 skipped, **0 failed** |

Then modes ok, templates 6 entries ok, ExtendScript 15 files ok, CLAUDE.md 9,911
of 20,000, `validate-templates` 6 ok, panel manifest ok, references PASS, both
sidecar models ok, `check: PASS`. **The panel's image-picker tests are still
unfixed** — they passed here as at sessions 40 and 41 and failed at 38 and 39,
unchanged throughout. One pass is not a fix.

**`sora.mov`, its eleven candidates and every cache entry are untouched** — cache
**72 entries / 129 files / 106 MB** at both ends, `sora.mov` `344265a0…` at both
ends, ledger **145 lines / `d4fe2de3…`, $0.00 spent**. Four frames were read out
of `sora.mov` into the scratchpad to look at; the file was never written.

## Deviations

**The panel and the placement report were changed too, though neither was
asked for.** Both computed their own face box — over the words' span, as a union
— so both would now predict a different size from the one the build draws. A
report that disagrees with the build is worse than no report, so `faceBoxesFor`
and `place-images-cli` were moved onto the same frames the builder reads.

**A test block was rewritten rather than deleted.** Session 41's "a picture that
arrives at the word it is about" built its face boxes as unions by hand, which is
no longer how anything works. Its four cases were rewritten to pass the frames
themselves; the property they assert is unchanged and still holds.

## Failures & open problems

1. **Between two samples nothing is measured**, 0.5 s apart at 2 fps. Neither
   rule ever covered it; `HEAD_CLEARANCE`'s 86.4 px is what absorbs it.
2. **`TOP_LEFT_MARGIN` and `HEAD_CLEARANCE` are still chosen, not measured**, and
   together take 151 px off every bound. Unchanged, and his to rule on.
3. **A picture whose life spans a cut is still sized for the tighter shot** —
   941 px rather than the 1073 the corridor would allow. That is honest, but if
   he would rather a picture never straddle a cut, that is a different ruling and
   would need shot detection.
4. **`img002` arrives 1.34 s into its span**, from session 41's naming word.
5. The panel's image-picker tests remain flaky and unfixed; `test-1` still holds
   one picture motionless for 6.8 s; the opening bar is still unbuilt.

## Repo state

Branch `main`. **Ledger 145 lines / `d4fe2de37f5eb0c8…` at both ends, $0.00
spent**, so about **$2.71** of credit remains. `templates/library.aep`
`4b0cf05a8f5d4775…` at both ends, never opened for writing.

`benchmarks/references/golden/census.json` moved from `2fb67fe6c4cb239c…` to
**`74436a960706fecd…`**, deliberately, for the 12 image-size fields above.

The hand-made references, byte-identical at both ends:

| file | sha256 |
|---|---|
| `benchmarks/references/align/vitasilk.json` | `f32e12dcfad55899…` |
| `benchmarks/references/align/vitasilk.rereview.json` | `10a2e5c2971ed27f…` |
| `.local/ground-truth/ground-truth.txt` / `.json` | `1fbbe2190d734db8…` / `64eebfd7374f93d2…` |
| `.local/ground-truth/test-1.txt` / `.json` | `b59a6270c3f704bc…` / `1394f8e863b72aa9…` |
| `.local/ground-truth/test-2.txt` / `.json` | `9ceea1c47ee94a8a…` / `183ba7b05392afaf…` |
| `.local/ground-truth/test-3.txt` / `.json` | `b5413c215ff32fec…` / `5ad64557cd2cd0fa…` |

`.local/plans/sora-995f2d27.editplan.json` moved from `95f85c5a88f0b5f1…` to
`6eb6c995171c584e…`, which is the two rebuilds recording themselves and nothing
else — no slot, span, idea or word changed. The corpus plans were rewritten by
golden's own builds, as they are every run.

Cache **72 / 129 / 106 MB** at both ends. `sora.mov` `344265a032513979…` at both
ends. One After Effects instance throughout and **no `AeDriveError` this
session** — every build and census answered first time. Free space 196 GB →
**157 GB**, which is golden's eight rebuilt `.aep` files and the throwaway
videos' frames. **No project of the user's own was saved**, and
`.local/build/sora-continuous-dissolve.aep` was left alone.

## Suggested next step

Look at `img002` and say whether 941 px is right. If a picture straddling a cut
still reads as too small, the next question is whether a picture should ever span
one — which is a ruling, not a bug, and would need shot detection rather than a
different margin.

---

**The one file, and the one moment**

`.local/build/sora-995f2d27-full.aep` — look at **6.2 seconds**, the same moment
he asked about. The picture in the corner is now **941 px** instead of 669, and
the reel's smallest picture is 881 px instead of 669. Then let it run to **8.5
seconds**, where the reel cuts to the sofa: that is the frame that was setting
the size, and it is the reason the picture is 941 and not 1073.
