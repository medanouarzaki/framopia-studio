# Block 10 session 36 — why the pictures are small, and where they are mistimed

**Status: PROBLEM — both defects are measured and general, but the size rule and
the timing rule are the user's own rulings and this session may not replace them
without him.**

## Why his pictures came out smaller than the corpus's

**Every picture in a reel is drawn at the size the tightest single slot can hold.
`sora` has one slot where he leans forward and his head sits higher in frame, and
that one slot set the size for all eleven.**

Slot `img003` — the 0.94 s over "بديت من الصفر" — can hold **669 px**. The other
ten could hold **881 to 1085 px**; the middle one could hold 1049. Nine of them
give up between 212 and 416 px to match the tightest. `sora`'s pictures are at
**31% of the frame** where its own geometry would allow a median of **48.6%**.

The corpus never showed this. `test-1` has four slots spread over 20 px;
`vitasilk` has five spread over 100. **`sora` has eleven spread over 416.** The
rule takes the minimum, and a minimum only falls as you add slots — so a 40-second
reel, which the density rule gives eleven pictures, is a smaller-pictured reel than
a 22-second one **by construction**, and the more the speaker moves the worse it
gets. Nothing was wrong with `sora`. The rule was ruled on four- and five-slot
reels.

## The worst timing offset

**`img002`'s picture disappears 0.818 s — 24.5 frames — before its sentence
finishes.** The words "ومؤسسة ديال مركز cabinet docteur Lobna Kfafi" run from
4.339 s to 7.159 s; the picture is on screen from 4.339 s to **6.341 s**.

The image templates are **2.002 s** comps and the builder gives an image layer **no
time stretch**. A slot longer than 2.002 s simply runs out of source. Cards have a
rule for exactly this — `service/src/build/short-card.ts` stretches a short card's
instance so its entrance still completes — and **images never got one.**

This is not `sora`'s problem either. `vitasilk`'s `img002` loses **18 frames**;
`test-1`'s `img004` loses **6.6**. Nobody looked.

## Done

### A — the whole chain that decides a picture's size

| step | where | what it contributes |
|---|---|---|
| the generated picture | `.local/cache/…/image.jpg` | **2048×2048** every time — 2K, 1:1, `docs/DECISION-image-config.md` |
| the cut-out | `.local/plans/cutouts/<reel>/…` | same 2048×2048; nothing is resampled |
| the face mask | `service/src/placement/face-boxes.ts` | the union of the speaker's face box over the frames the slot is on screen |
| the corner | `service/src/placement/top-left.ts:86` | `max(faceX·2160, faceY·3840) − clearance − margin` — the largest square the top-left corner can hold clear of him |
| margin, clearance | `service/src/placement/constants.ts:110,118` | 64.8 px and 86.4 px, both **chosen, not measured** |
| the mode's scale | `modes/k2-syndicalia.json:80` | `imageScale: 1.4` — **inert**, see below |
| **the reel rule** | `service/src/placement/top-left.ts:223` | **the whole reel is drawn at the minimum of those corners** |
| the builder | `service/src/build/reel-plan.ts:355` | converts that rect to a position and a scale percent |

**Where 669 and 917 diverge is the last-but-one row and nothing else.** Every input
above it behaves identically on both reels — same picture pixels, same margin,
same clearance, same rule for a single corner. Measured:

| reel | length | slots | own maxima (px) | spread | placed at |
|---|---:|---:|---|---:|---:|
| test-1 | 22.0 s | 4 | 917 · 925 · 925 · 937 | **20** | 917 (42.4%) |
| vitasilk | 25.7 s | 5 | 837 · 905 · 913 · 925 · 937 | **100** | 837 (38.7%) |
| **sora** | 40.5 s | 11 | **669** · 881 · 893 · 1045 · 1045 · 1049 · 1057 · 1061 · 1061 · 1073 · 1085 | **416** | **669 (31.0%)** |
| test-2 | 22.3 s | **0** | — | — | — |
| test-3 | 21.2 s | **0** | — | — | — |

**Duration is not the cause; slot count and the speaker's movement are.** `sora`'s
tight slot has a face box at `y = 0.2135` against a median of `0.3156` — he is
about 390 px higher in frame for that one sentence. Every other slot in the reel
is *more* generous than any corpus slot, because for most of the reel he sits
lower than the corpus speakers do.

**Two constants are fitted to nothing, and one is inert.** `TOP_LEFT_MARGIN` (0.03)
and `HEAD_CLEARANCE` (0.04) both say "CHOSEN, NOT MEASURED" in their own comments;
they are fractions of frame width, so they scale with the frame and are not a
corpus artifact. `imageScale: 1.4` **does nothing at all**: the wanted size is the
corner times 1.4, and the placement then clamps it back to the corner, which it
always exceeds. Every picture on every reel is drawn at exactly its corner
maximum, never at 1.4× anything.

### B — the timing, every slot, every reel

**The plan is not where the mistiming is.** For all 20 slots across the three reels
that have any, the picture's window matches the words it was written for **to
0.000 s** — `slot.start`/`slot.end` are the words' own span, and the builder uses
them unchanged (`reel-plan.ts:362`). The ideas match their words too.

The mistiming is between the window and the **template**, which is 2.002 s long with
a 0.4004 s entrance and no exit.

| reel | slot | window | shows | lost at the end |
|---|---|---:|---:|---:|
| **sora** | img002 | 2.820 s | 100% | **0.818 s / 24.5 f** |
| | img001 | 2.081 s | 100% | 0.079 s / 2.4 f |
| | img005 | 2.079 s | 100% | 0.077 s / 2.3 f |
| | img004 | 0.861 s | 43% | — (hold only 0.461 s) |
| | img003 | 0.941 s | 47% | — (hold 0.541 s) |
| | img010 | 1.061 s | 53% | — |
| | img006 · img007 · img011 | 1.20–1.24 s | 60–62% | — |
| | img009 | 1.401 s | 70% | — |
| | img008 | 1.920 s | 96% | — |
| **vitasilk** | img002 | 2.601 s | 100% | **0.599 s / 18.0 f** |
| | img003 | 2.341 s | 100% | 0.339 s / 10.2 f |
| | img005 | 2.039 s | 100% | 0.037 s / 1.1 f |
| **test-1** | img004 | 2.221 s | 100% | 0.219 s / 6.6 f |
| | img002 | 2.160 s | 100% | 0.158 s / 4.7 f |

Read back out of After Effects from the built `sora`: every image layer has
**`stretch = 100`**, in and out points equal to the plan to within a rounding
frame, and a source comp 2.002 s long. Nothing drifts; the layer just ends.

**The entrance always completes.** It lasts 0.4004 s and the shortest window
anywhere is 0.861 s, so no picture is cut off mid-move — the short slots simply
hold for less time. The distribution is two faults, not one: **three pictures on
`sora` end early (0.077–0.818 s) and seven hold for under a second.**

### C — the rest of the picture path

| part | corpus-fitted? |
|---|---|
| **density**, 8 slots per 30 s (`analysis/count.ts:46`) | **No.** Derived from duration; `sora` gets 11 from 40.5 s correctly. But it **compounds** the size defect: more slots means a lower minimum. |
| **the corner**, top-left on every reel | No. A user ruling, geometric, and it holds for any speaker position. |
| **the frame and margins** | No. Fractions of frame width. |
| **the whoosh** | No. It leads the picture by ~17 frames so its impact lands on the entrance; `img001`'s lands at −0.467 s and `build-reel.jsx:461` already trims its in-point to 0. Handled, not a defect. |
| **the cutout and luminance gates** | No evidence of fitting found; not exercised by this session. |
| **the one-size rule** | **Yes — this is the defect.** |
| **golden's coverage of pictures** | **Two of the four golden reels have no image slots at all.** The picture path's regression gate rests on `test-1` and `vitasilk` alone. |

**`new-video.test.ts` asserted nothing about size or timing** — only that a comp was
built with the right number of elements. That is why this reached the user. It now
asserts, from figures derived rather than chosen:

- every picture is inside the frame and clear of the speaker, per slot;
- the size drawn is the size the placement rule computed;
- no window is shorter than the template's own entrance;
- **no window is longer than the template's own duration** — the assertion that
  `sora`'s `img002` and `vitasilk`'s `img002` would fail.

A new `service/src/placement/reel-shape.test.ts` proves the general behaviour over
synthetic reel shapes rather than over reels: that the reel takes the minimum, that
**adding a slot can only lower the size and never raise it**, that a generous slot
added afterwards gives nothing back, and that **a size a corner cannot hold is
refused rather than drawn over the speaker** at every size and position tried. It
reads no disk, runs no model and opens no socket — there is nothing in it for a
network to be reached through.

### D — what changing the size would cost

**Nothing, and no new pictures.** Every candidate is **2048×2048**. At 669 px a
picture is being shown at **32.7% of the pixels that were paid for**; even at 1085
it would be 53%. Re-sizing is a scale percentage the builder writes at build time —
free, and `sora`'s $3.37 of pictures are untouched.

**A bigger picture cannot cover him.** The placement clamps any requested size back
to what that slot's corner holds before it places it, so asking for more is refused
for the tight slot rather than granted across his face. Tried at 500, 800, 1100 and
2000 px against five speaker positions: `clearsFace` true every time.

| if the reel were placed at | pixels | slots that can take it | slots that stay at their own max |
|---|---:|---:|---|
| today | 669 | 11 of 11 | — |
| 37% (the corpus's lower end) | 799 | 10 of 11 | img003 at 669 |
| 42% (the corpus's upper end) | 907 | 8 of 11 | img003 669, img004 893, img005 881 |
| each slot's own maximum | 669–1085 | 11 of 11 | mean **992 px, 45.9%** |

### The gates

**`npm run check` exits 1, and only at the panel.** Per-workspace, read from its
own output:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **757 passed** |
| service | 96 passed (96) | **1226 passed** — up 7 on the new `reel-shape.test.ts` |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 10 passed, **1 failed** (11) | 212 passed, 2 skipped, **1 failed** |

The one failure is *says a picture is gone only when the service says it is gone*,
in the image-picker family session 35 measured: three cutout fixtures name files
that moved into per-reel subdirectories, so the panel's own `onError` removes the
`<img>` in a race with the assertion. One of the five fired this run rather than
five; nothing about it changed.

`check.sh` stops at the first failing step, so the four gates after the test step
did not run inside it and were run on their own: **modes ok, templates 6 entries
ok, ExtendScript 15 files ok, CLAUDE.md 9,037 of 20,000, references PASS,
`validate-templates` 6 templates ok against the audited `library.aep`.** The Python
sidecar's suite, which `check` does not run, is **149 passed**.

## Deviations

**`npm run golden` was not run.** He has `.local/build/sora-995f2d27-full.aep` open
and is watching it, and golden builds four reels — it would have closed the
composition in front of him. No build-path code changed this session, so its inputs
are identical to session 35's **PASS, 4 of 4, 17,174 fields**. That is a statement
about what did not change, not a claim that it was re-run.

`sora` was not rebuilt. Every figure above was read from the plan, from the shrink
record, and from the already-built comp he has open.

## Failures & open problems

1. **The size and the timing are both his rulings and neither was changed.** The
   one-size rule is his, of 2026-08-29, and its stated risk — "one tight slot
   shrinks the whole reel" — is exactly what happened. Replacing it is his call, so
   this session measured it and stopped, per the standing rule that a number which
   can only be justified by pointing at reels must not be chosen here.
2. **Unproven by name: several throwaway videos of different shapes were not built
   end to end.** `new-video.test.ts` drives one 6-second video, whose two slots are
   both short, so its new "ends early" assertion does not fire on it. The general
   behaviour is proven by `reel-shape.test.ts` over synthetic geometry, which covers
   the whole space rather than four samples — but a second and third real video
   through Browse would be a stronger check and was not run.
3. **The picture path's golden coverage is two reels of four**, because `test-2` and
   `test-3` have no image slots.
4. The two browser test files remain red for the cause session 35 measured; nothing
   was done to them.

## Repo state

Branch `main`. Ledger **144 lines / `d886596…` at both ends**, all-time $16.187847 —
**$0.00 spent, no API called**. `templates/library.aep`
`4b0cf05a…c52734` at both ends, never opened for writing. The six references, the
cache (71 entries / 128 files / 106 MB) and `sora.mov` (`344265a0…`) byte-identical
at both ends. No project was saved. 306 GiB free.

## Suggested next step

Put the two rulings to him with the numbers below, then implement whichever he
picks — both are build-time changes over pictures already paid for.

---

**What he has to rule on**

1. **Picture size** — his rule that every picture in a reel shares one size cost
   `sora` nine of its eleven pictures between 212 and 416 px, because one slot can
   hold only 669 where the rest hold 881 to 1085. Keeping one size means 669 px;
   letting them differ means 669 to 1085, averaging 992; a middle course is one size
   at 799 px with the single tight slot left smaller.
2. **A picture that ends before its sentence does** — three of `sora`'s eleven stop
   while he is still speaking, the worst by 24.5 frames, because the template comp
   is 2.002 s and nothing stretches it; the choice is to stretch the animation to
   fill the window, to hold its last frame, or to leave it.
3. **A picture that holds for well under a second** — seven of `sora`'s eleven are
   on screen 0.86 to 1.24 s, of which 0.4 s is the entrance, leaving as little as
   0.46 s of still picture.
