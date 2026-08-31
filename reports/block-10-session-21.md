Status: PROBLEM — option D changes how the card renders and is rejected; the fix is C, which is the user's to make in library.aep

# Block 10 session 21 — a card is cut off, and now something measures height

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`**,
**`templates/library.aep` `1d7553e894…` — identical at both ends and never
opened for writing**, cache **46 entries / 79 files / 55,363,681 bytes**, all
five Edit Plans and all six hand-made references byte-identical. After Effects
**pid 79146**, **445 families / 1198 raw / 1188 distinct** at both ends. Free
space **173.3 GB**.

**The height check exists and refuses both cut cards. Option D was tried,
measured, and fails.** The fix is C, and `templates/library.aep` is his.

---

## 1. The check, failing before anything was changed

Written first, committed first — `335c737 feat: refuse a card that its own comp
cuts off` — and run against the unmodified builder. **Verbatim:**

```
CardClippedError: test_1 k002 (keyword) is cut off by its own card comp:
"محفزات الكولاجين" in Almarai-Bold at 455, broken onto two lines, reaches
374.2px to 1196.7px (the word to 1181.7px, its shadow 15.0px lower) in a comp
1100px tall — 96.7px below outside it. Anything outside is not drawn, so the
build stops here.

CardClippedError: test_2 k002 (keyword) is cut off by its own card comp:
"ترطيب عميق" in Almarai-Bold at 455, broken onto two lines, reaches
374.2px to 1196.7px (the word to 1181.7px, its shadow 15.0px lower) in a comp
1100px tall — 96.7px below outside it. …
```

| reel | exit |
|---|---|
| test-1 | **1** — refused |
| test-2 | **1** — refused |
| test-3 | 0 |
| vitasilk | 0 |

**Exactly the two cards session 20 found, and neither of the other two reels.**

### 96.7 px, against session 20's 31.7 — and why both are right

| what is measured | reaches | over |
|---|---:|---:|
| at rest (y = 700), word only — session 20 | 1131.7 | 31.7 |
| during the entrance (y = 750), word only | 1181.7 | 81.7 |
| during the entrance, word **and** shadow | **1196.7** | **96.7** |

The templates animate Position from **750 down to 700**, so a card sits 50 px
lower while its entrance plays. Measuring only at rest reports the best case of a
card that is visibly cut on its way in, so the check takes the **lowest** keyed
position. The shadow's +15 is the rest.

### The shadow term, measured rather than assumed

Session 20 flagged this as arithmetic. **It was measured this session, and the
answer is that no single call can give it:**

```
comp/layer                        extents=false        extents=true
k002__kw_slam_ar  TXT_MAIN        top=-325.8 h=757.5   top=-325.8 h=757.5
k002__kw_slam_ar  TXT_MAIN_SHADOW top=-325.8 h=757.5   top=-325.8 h=757.5
                                  effect offset [8, 15.0]
```

`sourceRectAtTime` returns an identical rect at **both** `extents` settings on a
layer carrying a Transform effect — so it never includes the effect. **Both terms
are measured** — the rect from the layer, the offset read off the effect's own
Position and Anchor Point — and their sum is arithmetic over two measurements.
The code says so at `CardVerticalExtent.shadowDropPx`.

### Where it lives

Beside the width check, not in a parallel mechanism. `assertEveryCardFits` now
asks both questions; `CardClippedError` and `cardClippedMessage` sit next to
`CardTooWideError` and `cardTooWideMessage`, and the failure names the card, the
reel, the extent, the comp height and the overrun — the same shape as the width
failure. Six tests pin it, including that the shadow term is what makes 96.7
rather than 81.7, and that a too-wide card still fails on width first.

---

## 2. Option D — tried, measured, rejected

### What the property is, before touching anything

Read off a real build: every comp layer in both masters has
`collapseTransformation = false` and — the part that mattered — **zero effects on
the master layer**. The Fast Box Blur and the shadow's Transform live on layers
*inside* the card comp. So the usual caution about collapsing a layer with its
own effects did not apply, and D looked sound.

It is settable on the instance: `collapse=True` after the write, read back per
card, **66 of 66 on test-1**, with `library.aep` untouched.

### With D in place, all four reels build

| reel | exit |
|---|---|
| test-1 | 0 |
| test-2 | 0 |
| test-3 | 0 |
| vitasilk | 0 |

And the effects inside were provably undisturbed — blur 30 → 0 on both layers,
Transform offset [8, 15] intact.

### But `sourceRectAtTime` cannot tell you whether it worked

With collapse on, the master layer still reports `top=0.0 h=1100.0` — the comp's
nominal bounds. **That is the same answer it gives with collapse off**, so it
carries no signal either way. There is no non-rendering call that answers whether
the content now draws outside.

### So it was settled on pixels, and D fails

One frame of `master_final` at the middle of the k002 card's life, saved twice
from the same open project — once with collapse on, once with it toggled off and
**restored immediately** (before `True`, during `False`, after `True`, never
saved). Then diffed.

```
differing bbox: (5, 1978, 2155, 3181)
```

The card comp's bottom edge in the master is row **2880**. The difference is
**not confined to the strip below it**:

| band | differing (sampled) | max | mean |
|---|---:|---:|---:|
| above the boundary — the card body, rows 1978–2870 | 476,815 | **230** | 21.3 |
| the recovered strip, rows 2881–2978 | 102,991 | 231 | 31.4 |
| further below, rows 2979–3181 | 137,029 | 15 | 3.4 |

**Collapse changes the whole card, by up to 230 levels of 255, in a region that
was never being clipped.** The sampled frame is 0.51 s into a 1.020 s card, past
the 0.4004 s entrance, so the blur is at 0 and this is not the entrance being
caught mid-animation. §2.3 said that if anything differs, that is the finding.
**It differs, and D is rejected.**

D was reverted in full — `collapseTransformation` appears nowhere in the builder,
and `npm run check` passes with it gone.

### What C requires

The four text card comps in `templates/library.aep` — `sub_pop`, `sub_pop_ar`,
`kw_slam`, `kw_slam_ar` — are **2160 × 1100** with the first baseline at y = 700.
A two-line card reaches **1196.7 px**, so **the comps need to be at least 1197 px
tall**, and a round **1250** would leave 53 px for a face with deeper descenders
than Almarai's.

Nothing else has to move: the baseline stays at 700, the placement arithmetic
derives the layer's position from the audited placeholder and the comp's own
anchor, and a taller comp changes the anchor consistently. **The audit must be
re-run afterwards** — `npm run audit:templates` — because `validate:templates`
refuses an audit whose sha256 does not match the `.aep`.

**This session did not attempt it and did not open that file.**

---

## 3. The corpus, and the next client

### Every card's headroom

**262 cards across four reels**, measured during their builds:

| headroom | reel | card | template | lines | size | reaches |
|---:|---|---|---|---|---:|---:|
| **−96.7** | test_1 | k002 | `kw_slam_ar` | two | 455 | 1196.7 |
| **−96.7** | test_2 | k002 | `kw_slam_ar` | two | 455 | 1196.7 |
| 178.3 | test_1 | g003 | `sub_pop_ar` | one | 367 | 921.7 |
| 196.0 | vitasilk | k001 | `kw_slam` | one | 494.7 | 904.0 |
| … | | | | | | |
| 335.0 | vitasilk | g034 | `sub_pop` | one | 343 | 765.0 |

**2 clipped, 260 with at least 178.3 px to spare.** A cliff, and the cliff is
`LINE_SPACING` = 323.

### Which combinations would overrun

Per template and face, the worst card's headroom, and what it would become if
that card were broken onto two lines:

| template | face | size | cards | worst headroom | if broken |
|---|---|---:|---:|---:|---:|
| `sub_pop_ar` | Almarai-Bold | 367 | 32 | 178.3 | **−144.7** |
| `kw_slam` | Cormorant | 494.742 | 4 | 196.0 | **−127.0** |
| `kw_slam_ar` | Almarai-Bold | 455 | 2 one-line | 242.6 | **−80.4** |
| `sub_pop` | Inter-SemiBold | 343 | 217 | 261.0 | **−62.0** |
| `sub_pop` | Inter-SemiBold | 324.9 (shrunk) | 1 | 331.4 | +8.4 |

**Every template's worst card would be cut if it broke.** Only the shortest Latin
words at 343 — 183 of the 260 one-line cards, by their own descenders — have the
323 px a second line costs.

### One line never overruns here, and why

The worst one-line card in the corpus reaches 921.7 px against 1100 — **178.3 px
clear**. One line overruns only if `750 + ink descent + 15 > 1100`, i.e. a
descent below the baseline of more than 335 px, which no face at these sizes
reaches. **A larger face would**: this is a property of the sizes in use, not a
guarantee, and a client whose Arabic face descends further, or a keyword ratio
above 1.1641, could break it on one line.

### Written down

`docs/PROJECT_SPEC.md` now carries the height rule beside the width one, with
the geometry, the per-template table, the measurement date, and that D was tried
and rejected. The width rule has been written since Block 8; **its twin never
was**, which is the same shape as the check that never existed.

---

## Deviations

**One, and it is the session's result.** §2 said try D and, if it fails, report
what C requires without attempting it. **D failed on measurement**, so the code
ships the check and no fix. `Status` is `PROBLEM` for that reason, not because
anything is broken.

**A consequence that must not be buried: `npm run golden` no longer passes.**

```
golden: test-1 did not build: CardClippedError: test_1 k002 (keyword) is cut off
by its own card comp … 96.7px below outside it …
```

Two of the four reels refuse to build, so the golden run cannot complete. **That
is the check working**: those two reels have been producing cut cards on every
build, and the build now refuses rather than shipping one. It will pass again
when C is done. Downgrading the refusal to a warning to keep golden green would
recreate the exact failure this session exists to end — a check that detects
something and does not stop it.

**Two frames were rendered to PNG**, outside the repository, to settle D. Not
`aerender`, not the render queue, not a deliverable: `saveFrameToPng` on one
frame, twice. It was the only way to answer a question `sourceRectAtTime`
provably cannot.

**The open project was mutated and restored**: collapse toggled off on one layer
to take the comparison frame, then set back, with before/during/after read back
(`True` → `False` → `True`). It was never saved. It is a build artifact in
`.local/build/`.

Nothing else was touched: no template edit, no shrinking, no baseline move, no
change to `LINE_SPACING`, `MAX_SUBTITLE_LINES`, `SUBTITLE_SAFE_WIDTH`, the +8/+15
offset, the ratios, the palette or the fonts. The golden reference was not
re-recorded.

## Failures & open problems

**Unproven, by name:**

- **Nobody has looked at a card.** The clip is measured three ways and the D
  difference is measured in pixels; that a viewer sees it is inference from
  those.
- **D's rejection rests on one frame of one card.** The difference is large and
  well outside the clipped strip, which is enough to reject it — but *why* the
  body changes was not established. The likeliest cause is the shadow's Transform
  effect compositing differently under collapse, and that was not isolated.
- **1250 px is a suggestion, not a measurement.** 1197 is measured as the minimum
  for this corpus; the margin above it is a judgement about faces nobody has
  used.
- **The height check has never passed on a card that needed it.** It refuses the
  two real cases and passes the 260 that were never at risk; no card has yet been
  measured fitting *because* something was fixed.
- **`npm run check` flaked twice** on the five image-picker browser tests under
  parallel load, passing alone and on re-run — sessions 14, 15, 16, 19 and 20 saw
  the same five. Reported, untouched.

**Open:** everything session 20 gathered, unchanged, plus the golden run being red
until C.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `dcba576` *docs: rule that a card fits its comp in both directions* (+ `test:` commit) |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` — **never opened for writing** |
| cache | **46 entries / 79 files / 55,363,681 bytes** |
| fonts | **445 families / 1198 raw / 1188 distinct** at start and end |
| After Effects | pid **79146**, 0 `aerender`; left on `.local/build/vitasilk-full.aep`, clean, 97 items — the reel it held at the start |
| free space | **173.3 GB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references and Edit Plans**, sha256 identical at start and end:

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json

0712e4124d8b5f09641de4ed4276897f3c8cb6781e705df64d49c84dc5db7034  ground truth.editplan.json
1acf10bf06925473c501f30b8ebb290c5fa8f091fcc5ca32485e1ff316221e35  test 1.editplan.json
94da6dd60af1d138a87e1c8f2cc235f542014605d14c4795f165d35c11d27f0a  test 2.editplan.json
dbf28f9bafb55b126d97076b16df56baa1a2d7775343dc07ed6af83468302594  test 3.editplan.json
c8501bcafc79ed3bd74fec776a2401efa8e68caab41cea5b8d2d1ac221c63c20  vitasilk.editplan.json
```

**`npm run check`: PASS** (exit 0) — core **741**, service **1184**, benchmarks
**173**, panel **190 passed + 2 skipped**; `mode k2-syndicalia v12: ok`,
`templates: 6 entries, ok`, `validate-templates: 6 template(s) ok, audited
against library.aep`, `validate:panel: manifest.xml ok`, `references: 6
hand-made reference file(s): 4 transcript, 2 alignment` · `PASS`,
`attribution: 755 tracked text file(s), 695 commit message(s)` · `PASS`,
`extendscript: 15 .jsx file(s) ok`. Core +6: the height tests.

**`npm run golden`: FAILS** — `test-1 did not build: CardClippedError … 96.7px
below outside it`. Two reels refuse; the other two build. It passes again when
the card comps are tall enough.

## Suggested next step

**C, in his hands.** The four text card comps go from 1100 px tall to at least
**1197**, and 1250 leaves room for a deeper face. Then `npm run audit:templates`,
because the audit is stamped with the `.aep`'s sha256 and `validate:templates`
refuses a stale one. The height check then passes, both reels build, and the
golden reference will legitimately move for `test-1` and `test-2` — at which
point it wants re-recording, with exactly which fields moved reported.

---

## What to open and look at

**The two cards that are being cut are the point, and they cannot be built right
now** — the build refuses them, which is the new behaviour. So what is worth
looking at is what D would have done, and why it was rejected:

1. **`.local/build/vitasilk-full.aep` is open in After Effects** — a reel with no
   two-line card, built normally, unaffected by any of this. Its cards should
   look exactly as they always have. That is the control.
2. **The two frames of `test-1`'s `محفزات الكولاجين`** are in the session
   scratchpad, `collapsed.png` and `uncollapsed.png`. Put them side by side: the
   collapsed one has the second line's descenders that the other loses — and the
   whole card reads differently, which is why D was rejected rather than shipped.
   That difference is the judgement being asked for: if it looks acceptable, D
   becomes a live option again and this session's rejection was too strict.
3. **`templates/library.aep`, the four text comps** — the change C asks for is
   their height, 1100 → 1250, and nothing else. The baseline stays at 700.
