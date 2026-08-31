Status: OK

# Block 10 session 20 — the audit

**Spent $0.00; no API was called. Nothing was fixed.** Ledger **118 lines, sha
`3f657131…`**, `templates/library.aep` `1d7553e894…`, cache **46 entries / 79
files / 55,363,681 bytes**, all five Edit Plans and all six hand-made references
byte-identical, After Effects **pid 79146**, **445 families / 1198 raw / 1188
distinct** — all at both ends. `npm run golden` passes **4 of 4, zero differing
fields**, so the audit itself moved nothing. Free space **173.3 GB**.

**Three reels were built read-only to measure §1** — `test-1`, `test-2` and the
four the golden run rebuilds. After Effects is left on
`.local/build/vitasilk-full.aep`, clean, which is what it held at the start.

---

## 1. The clipped keyword — found, and it is not what was expected

### The leading hypothesis is refuted

**No text template animates Scale.** Read from the committed audit, all four —
`sub_pop`, `sub_pop_ar`, `kw_slam`, `kw_slam_ar` — carry `scale [100,100,100]`
with **zero keyframes**. The "pop" is three other properties:

| property | keyed values |
|---|---|
| `Effects/Fast Box Blur/Blur Radius` | 30 → 0 |
| `Transform/Position` | [1080, **750**] → [1080, **700**] |
| `Transform/Opacity` | 0 → 100 |

So a card cannot overshoot its width at the peak of its animation, and every
width measured with `sourceRectAtTime` is the width that is drawn. **The
hypothesis was worth testing and it is wrong.**

### The real cause: a two-line card overruns the bottom of its own comp

**Measured in After Effects, in a real build**, by computing each text layer's
ink box in composition space from `sourceRectAtTime`, its Position and its
Anchor Point:

```
k002__kw_slam_ar   comp 2160 x 1100   layer TXT_MAIN
  text  'محفزات\rالكولاجين'
  ink   top=374.2  bottom=1131.7  left=171.1  right=1987.0
  OUTSIDE: bottom by 31.7px
```

**The clip is vertical, not horizontal.** The right edge is at 1987 of 2160,
well inside. The bottom is at **1131.7 in a comp 1100 tall**.

**And it is lost, not merely overhanging.** The master's layer for that comp has
`collapseTransformation = false` and scale 100%, so the element comp is
rasterised at 2160 × 1100 and everything outside is cut at the boundary.

**Both two-line cards in the whole corpus clip, by exactly the same amount.**

| reel | card | template | text | headroom |
|---|---|---|---|---:|
| test-1 | k002 | `kw_slam_ar` | `محفزات` / `الكولاجين` | **−31.7 px** |
| test-2 | k002 | `kw_slam_ar` | `ترطيب` / `عميق` | **−31.7 px** |

**Every other card has at least 243 px of headroom.** This is a cliff, not a
gradient — test-1's next-worst card sits at +243.3 px, test-2's at +263.9 px.
1 of 66 and 1 of 67.

### Why, in one line of arithmetic

The first baseline rests at **y = 700**; `LINE_SPACING` is **323**; the comp is
**1100** tall. So a second line's baseline is at 1023 and has **77 px** for its
descenders. Almarai-Bold at 455 puts these glyphs' ink **108.7 px** below the
baseline. 108.7 − 77 = **31.7**.

**Both offenders are `kw_slam_ar`** — Arabic *emphasised keywords* at 455,
matching what the user saw exactly: an emphasised keyword, in the two
dermatology reels.

**The shadow is worse and was not measured by the same route.**
`TXT_MAIN_SHADOW` carries a Transform effect offsetting it **+8 across and +15
down**, and `sourceRectAtTime` does not include an effect — so the shadow's ink
box reads identically at 1131.7 while it is *drawn* 15 px lower, clipped by
about **46.7 px**. Stated as arithmetic from the audit's `effectOffsets`, not as
a second measurement.

### Why nothing caught it

**`assertEveryCardFits` checks width and only width** —
`core/src/card-fit.ts:133`: `row.fits && row.widthAfterPx <= row.safeWidthPx`.
There is no height term anywhere: no constant, no check, no test. The golden
census records every text layer's font, size, colour and text, and **not its ink
box against its comp bounds**, which is why 17,170 fields matched while a card
was being cut in half.

Session 4's break-before-shrink ruling made two-line cards the preferred
outcome, and nothing measured what a second line does vertically. Session 2
measured all 338 cards for width on a point-text probe.

### What would have to change — reported, not done

Four possibilities, each with what it costs:

1. **Make the text comps taller.** Edits `templates/library.aep`, which this
   session may not do and the user authored.
2. **Raise the first baseline when a card breaks.** Build-side, per instance, no
   template edit — but it moves a two-line card off the ruled baseline at
   y = 2480.4, so two cards in a row would sit at different heights.
3. **Never break a keyword; shrink it instead.** Reverses session 4's ruling,
   which the user made by eye after seeing a keyword at ×0.5589.
4. **Reduce `LINE_SPACING` for two-line cards.** Cheapest, changes how every
   two-line card reads.

**Whatever is chosen, the missing check is the same**: nothing asserts a card's
ink fits its comp vertically, and that check would have caught this before he
did.

---

## 2. "Ready, with problems" — the banner is honest, and its trigger is routine

**What it compares.** `compareBuildStamps` takes the panel bundle's stamp and
the service's, and compares **only the content half** — `sourceHalf`, the part
after the `+`, a hash of every compiled or evaluated source file. Two artifacts
built at different commits from identical source therefore **match**, which is
correct.

**Right now it is not firing.** Measured this session:

```
panel bundle   "f6225b1554+9d80ac264557cc0b"
service dist   "f6225b1554+9d80ac264557cc0b"
running service reports  f6225b1554+9d80ac264557cc0b
source hash now          9d80ac264557cc0b
```

Identical content halves → verdict `match`.

**And no other contributor is firing either.** The readiness line says "Ready,
with problems" when any of six things is true, and all six are currently clean
on the live service: ffmpeg 8.0.1 present, ffprobe present, the CV venv present
(Python 3.11.14), templates valid with 0 issues, the Node comparison matching
(**one nvm version installed, v24.14.1, and the service runs it**), and the
stamp matching.

**So the warnings he saw were true at the time, and here is what makes them
happen.** The service reads its build stamp **once, at startup** — deliberately,
so a rebuild the running process has not loaded is not reported as current. And:

- `npm run check` **rebuilds the panel bundle** — the panel workspace's test
  script is `node scripts/build.mjs && vitest --run`.
- **Nothing in `scripts/check.sh` rebuilds the service**, and rebuilding it
  would not help anyway: the *running* process keeps its startup stamp.

So running the test suite — the most routine action in this project — advances
the panel's stamp while the running service keeps the old one. Reopening the
panel does not restart the service, which is why it recurs "on a fresh open".

**It is not crying wolf: the running service genuinely is older code.** Two
things about it are still worth a ruling:

- **The remedy is a terminal command**, `npm run service -- --force`, on a screen
  built for someone who is told not to use a terminal. His partner will meet this
  on a fresh install; `docs/SECOND_MACHINE.md` §9 does tell him what to do.
- **A warning that fires from a harmless routine action trains a person to ignore
  it**, which is the cost even when every instance is true.

---

## 3. Arabic-first: what actually breaks

### Coverage today, measured

| reel | words | Arabic | cards with Arabic | keywords | Arabic keywords |
|---|---:|---:|---:|---:|---:|
| ground-truth | 76 | 6 | 6 | 3 | 1 |
| test-1 | 67 | 19 | 19 | 2 | 2 |
| test-2 | 69 | 9 | 9 | 3 | 2 |
| test-3 | 58 | 11 | 11 | 0 | 0 |
| vitasilk | 73 | **0** | 0 | 3 | 0 |
| **corpus** | **343** | **45** | **45** | **11** | **5** |

**13.1% of words and cards are Arabic script. Five Arabic keywords exist in the
entire corpus** — and two of those five are the two cards §1 found clipped. The
`kw_slam_ar` path has been exercised by **five cards, ever**.

### What is Arabic-aware, what assumes Latin, what has never been exercised

| stage | state |
|---|---|
| transcription (Scribe) | **Arabic-native** — it returns Darija in Arabic script; the pipeline transliterates *away* from that |
| correction prompt | **Arabizi by construction**: it injects `ORTHOGRAPHY_GUIDE.md` verbatim, whose §1 says "Moroccan Darija → **Latin script (Arabizi)**" |
| tagging | **aware** — `script` is derived from the characters |
| grouping | **aware** — never mixes scripts in one card (Block 6 session 6) |
| keyword selection | **aware but thin** — a span straddling a script boundary is dropped, which has happened once |
| template choice | **aware** — `_ar` by suffix |
| font choice | **aware** — Almarai for Arabic |
| sizing | **`ARABIC_SIZE_RATIO` 1.07, and it is the user's eye, not a measurement** — the metrics give 1.0161–1.0300 |
| RTL | **aware** — direction set per token, never on a container |
| shrink-to-fit | **script-blind, and §1 is what that costs** |
| image prompts | **Latin-only in practice** — every idea and prompt is English |
| `Transcript.terms` | **built for Arabic §6 terms and unread by grouping** — unstable at n=3 |

### Every rule written for Arabizi

- **`docs/ORTHOGRAPHY_GUIDE.md`** — the whole document. §1 makes Latin the
  default and Arabic the exception; §2 is Arabizi attachment (`w`, `dial`, the
  definite article); §3a numerals; §4 is a freeze-list of **Arabizi spellings**;
  §5 French/English inline; §6 is the *exception* that would become the rule;
  §8 forbids mixing scripts in a word. It is injected verbatim into every
  correction call, so rewriting it re-prices every reel.
- **`ACTIVE_PROMPT_VERSION`** — changing the guide changes the corrected words,
  which invalidates the transcription cache **and both hand-made alignment
  references**, the project's only non-circular measure.
- **`OVERLONG_WORD_CHARS = 11`** — a character count standing in for a width.
  Arabic words are shorter in characters and wider per character at 455, so the
  proxy is calibrated for the wrong script; session 2 already measured it missing
  both two-word Arabic spans.
- **`ARABIC_SIZE_RATIO = 1.07`** — ruled by eye on a delivered reel, never
  re-checked at volume.
- **`headStem`** — strips the Arabic definite article and proclitics; a heuristic
  for comparison only.
- **The `_ar` template pair** — two comps of four; an Arabic-first reel would use
  them for nearly every card.

### What breaks first, in order, at 90% Arabic

1. **Card clipping** (§1). Two-line cards are `kw_slam_ar` today; at 90% Arabic
   nearly every keyword is, and every two-line one is cut.
2. **The orthography guide contradicts the goal.** §1 instructs the model to
   transliterate to Latin; an Arabic-first reel would come back Arabizi.
3. **The overlong-word proxy** stops matching, so the transcript editor's ruling
   count is wrong for the script it is counting.
4. **`ARABIC_SIZE_RATIO`** at volume — 4% on every card, never verified.
5. **`Transcript.terms`** becomes load-bearing rather than groundwork: at 90%
   Arabic, §6 term boundaries decide most cards, and the term source is measured
   unstable.
6. **The image prompts** stay English, which is invisible but means the pictures
   are shaped by a Latin description of Arabic speech.

### The work, estimated

- **Rules that are data** — 2–3 sessions: invert the guide, bump the correction
  prompt, re-collect the alignment references (a human's hours, not a machine's).
- **Code that assumes Latin** — 2–3 sessions: the vertical fit from §1, the
  overlong proxy, the size ratio, term-aware grouping.
- **Nobody knows yet** — unbounded: whether Scribe's Arabic-script output needs
  the correction pass at all when nothing is being transliterated; whether the
  aligner's cross-script cost model is still needed or becomes dead weight;
  whether Almarai suits other dialects' readers.

**None of it was started.**

---

## 4. Client photographs: exactly what is missing

**Exists:**

- `POST /clients/pictures` and `DELETE /clients/pictures` — `server.ts:186` and
  `:210`.
- `addClientPicture` / `removeClientPicture` on the service side, in
  `service/src/clients/create.ts`, writing `pictures` onto the mode file with a
  generated id.
- `ClientMode.pictures` in the schema, validated.
- `addClientPicture` in **the panel's own service layer**, `panel/src/service.ts:376`.
- The picture editor already **offers** a client's pictures beside the generated
  ones and stores the choice: `Images.tsx:213` reads `view.clientPictures`,
  `:215` reads `slot.chosenClientPictureId`.
- `ImageSlot.chosenClientPictureId` is a human-flagged marker and wins over
  `chosenCandidateId`.
- `fitByLongEdge`, so a phone photograph at 3024×4032 lands inside the box.

**Does not exist:** **a control that calls it.** `addClientPicture` is declared
and **no component invokes it** — a search across every `.tsx` returns the
declaration and nothing else. There is also no panel caller for the DELETE.

**A session to finish it would build:** a picture list on the client screen with
a *Choose file…* button (the `pickImageFile` chooser from session 16 already
exists), a description field per picture — his words, "the clinic exterior" — a
remove control, and the wiring to `addClientPicture` / `removeClientPicture`,
plus a refresh of the client list after a write. Nothing in the service or the
schema needs to change.

**The two tests that must not be weakened** are in
`service/src/clients/pictures.test.ts`:

- **"is not read by anything that can call the image model"** — reads every file
  under `service/src/images/` and fails if one mentions the field. A doctor's
  patient results do not go to an image model.
- **"is not copied anywhere: the module that owns it writes nothing"** — reads
  `core/src/client-pictures.ts` with comments stripped and fails if it writes a
  file or names a cache path.

---

## 5. What else nothing checks

### 5.1 Green checks whose premise is false

**`panel/src/render.browser.test.ts:731-734`** — confirmed with evidence:

```
CUTOUTS  = <repo>/my files/test videos/cutouts
REAL_C1  = cutouts/img001-c1.cutout.png     MISSING
REAL_C2  = cutouts/img001-c2.cutout.png     MISSING
REAL_CUT = cutouts/img002-c1.cutout.png     MISSING
```

All three are absent — Block 10 session 12 moved cutouts into
`cutouts/<plan stem>/`. The file's own comment says these are "paths that exist,
so the error never fires and the ready branch is what is under test", which is
**false**. The tests pass because they assert on the URL *string*, never on the
image loading.

**A mechanical scan for the same shape found no others**, and its limit is worth
stating: it only matched `path.join(REPO_ROOT, 'literal', …)`, so a path built
through an intermediate constant — which is exactly how these three are built —
would be missed. **The scan is weaker than the finding it was written to
generalise**, so "no others" means "none of that narrow shape", not "none".

### 5.2 Numbers that appear in more than once place

| number | where | status |
|---|---|---|
| card count | `plannedCards` → panel and builder | **one declaration** since session 15, pinned |
| reference count | `core/src/references.ts` → gate and backup | **one declaration** since session 13, printed with its definition |
| font figures | 445 / 1198 / 1188 | reconciled in session 17; the production reader returns 1188 |
| `HEAD_CLEARANCE`, `BOTTOM_EXCLUSION`, `MIN_ZONE_SHORT_EDGE` | `zones.py` and `placement/constants.ts` | mirrored, pinned by test |
| gains in `manifest.json` and `sfx.json` | two files | mirrored, pinned by test |
| golden field count | 17,170 | matches `SECOND_MACHINE`'s "about 17,000" |
| doctor checks | 24 | matches `SECOND_MACHINE`'s "24 things" — verified from the doctor's own summary |

**No new duplicate was found.** The three that historically disagreed have all
been given one home.

### 5.3 User-facing sentences that are now false

Every numeric claim in `docs/SECOND_MACHINE.md` was checked against a
measurement and **all of them hold**: 24 doctor checks, about 17,000 golden
details, four videos, two to six seconds, 19 GB, `$0.00`.

**The one that will mislead is not a number**: §15 says a golden failure means a
different After Effects, a font that resolved differently, or an incomplete
cache. **A clipped card would not fail the golden run at all** (§1), so that
list is complete about what golden covers and silent about what it does not.

### 5.4 Every open problem across Block 10, gathered

| item | first named | status |
|---|---|---|
| `ground-truth` unbuildable, six pictures unbought (~$2.17) | s6 | **open** |
| the image service's 503 | s7 | **open**, three sessions |
| `build-reel.jsx`'s guard recognises only its own checkout | s11 | **open**, needs a ruling |
| panel suite flakes under `npm run check` load | s14 | **open**, flaked again this session |
| the ledger guard's failure path never fired | s14 | **open** by design |
| the golden reference is one machine's output | s14 | **open** until the partner runs it |
| `other-file` saved-output branch never produced by a real build | s15 | **open** |
| attribution gate cannot catch prose attribution | s15 | **open**, stated in code |
| 14 historical commits carry a trailer | s15 | **closed as accepted**, frozen list |
| client pictures have no control | s16 | **open** — §4 above |
| nothing seen inside CEP: fonts, colours, choosers | s16, s17 | **open** — the partner's run is the test |
| `background` never observed as a picture frame | s18 | **open**, benign |
| `textColours.shadow` not pinned into a snapshot when blank | s19 | **open**, needs a ruling |
| `render.browser.test.ts` fixture paths | s19 | **open** — §5.1 above |
| reference count meaning three things | s12 | **fixed** s13 |
| card count wrong in the panel | s15 | **fixed** s15 |
| two font figures under one heading | s16 | **fixed** s17 |
| captions describing only the picture frame | s18 | **fixed** s18–19 |

### 5.5 What would differ on another machine that the doctor does not check

- **The system `python3`.** `service/src/fonts.ts:67` spawns **`python3`** for
  the CoreText font resolver. The doctor checks `tools/cv/.venv/bin/python` and
  **not** the system one. A machine without `python3` on `PATH` loses every font
  preview, and the failure is a per-face "this font cannot be shown here" rather
  than anything the doctor names.
- **After Effects' font naming.** Session 17 established AE constructs its own
  names for variable-font instances. The doctor's `fonts` check asks the running
  AE for the names the mode declares — so it catches an absence, but a machine
  whose AE constructs a *different* name reports the face as missing with no clue
  that the name, not the file, is what differs.
- **The After Effects version.** `after-effects` checks presence, not version.

---

## Deviations

**None.** Nothing was fixed, no file was modified except these two reports, no
billable stage ran, and no ruled constant, mode file, template, cache entry, Edit
Plan, generated image or hand-made reference changed. `templates/library.aep` was
never opened for writing.

**Three reels were built read-only, as §6 permits**: `test-1` and `test-2` to
measure the ink box of their two-line cards, which cannot be measured any other
way, and the four the golden run rebuilds. Those builds write into
`.local/build/`, which is where the builds already were.

## Failures & open problems

**Unproven, by name:**

- **The shadow's 46.7 px clip is arithmetic, not a measurement.** The word's
  31.7 px was measured in After Effects; the shadow's extra 15 px comes from the
  audit's `effectOffsets`, because `sourceRectAtTime` does not include an effect.
- **Only `test-1` and `test-2` were measured for vertical containment.**
  `ground-truth`, `test-3` and `vitasilk` have no two-line cards, so nothing
  there can clip by this mechanism — but their comps were not measured.
- **Nobody has looked at the clipped card.** Its ink box is 31.7 px outside the
  comp and the master does not collapse; that it is visibly cut on screen follows
  from those two facts rather than from anyone seeing it.
- **The banner's history is inferred.** The mechanism is measured; that it is
  what he saw each time is the most probable explanation, not an observation.
- **The Arabic estimate is a judgement**, not a measurement. The coverage
  figures are measured; the session counts are not.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `59d3d09` *docs: report block 10 session 19* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| cache | **46 entries / 79 files / 55,363,681 bytes** |
| fonts | **445 families / 1198 raw / 1188 distinct** at start and end |
| After Effects | pid **79146**, 0 `aerender`; `vitasilk-full.aep` open, clean, 97 items |
| free space | **173.3 GB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references and Edit Plans** — sha256 identical at start and end:

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

**`npm run check`: PASS** (exit 0) — core **735**, service **1184**, benchmarks
**173**, panel **190 passed + 2 skipped**; `mode k2-syndicalia v12: ok`,
`templates: 6 entries, ok`, `validate-templates: 6 template(s) ok`,
`validate:panel: manifest.xml ok`, `references: 6 hand-made reference file(s):
4 transcript, 2 alignment` · `PASS`, `attribution: 754 tracked text file(s),
690 commit message(s)` · `PASS`, `extendscript: 15 .jsx file(s) ok`.

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field, **17,170
fields**, reference not re-recorded.

## Suggested next step

**Fix the clipping.** It is the only finding here that puts a wrong frame in
front of a client, and it is live in two of the five reels.

---

## What to rule on, in the order it matters

1. **How should a two-line card stop being cut off?** Taller template comps
   (which only you can edit), a raised baseline for broken cards, no breaking for
   keywords at all, or tighter line spacing.
2. **Should a card's height be checked the way its width is?** Whatever fixes the
   clip, nothing today asserts a card fits its comp vertically, and that is why
   it reached you rather than a test.
3. **Is Arabic-first the direction?** If it is, the orthography guide is the
   first thing to rewrite and it invalidates the transcription cache and both
   hand-made alignment references — so it wants deciding before more reels are
   transcribed, not after.
4. **Should the stale-service banner be reachable without a terminal?** It is
   honest every time it fires, and it fires because you ran the tests; your
   partner cannot act on its remedy as written.
5. **Should client photographs be finished?** Everything but the control exists;
   it is one session.
6. **Should `ground-truth`'s six pictures be bought** at about $2.17, so the
   golden set is five reels instead of four?
7. **Should a client who names no shadow colour have it pinned into their
   snapshot?** Doing it makes every already-pinned reel report itself behind
   once; not doing it means a future default change would move an old reel.
