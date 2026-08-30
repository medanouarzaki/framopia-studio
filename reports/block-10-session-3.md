Status: OK

# Block 10 session 3 — shrink-to-fit

**Spent $0.00; no API was called.** Ledger **116 lines, sha256 `e5e0a6e9…c132cb`,
byte-identical at both ends.** `templates/library.aep` `1d7553e894…2dc4a5d8` at
both ends. **All five Edit Plans byte-identical** — no build wrote to a plan.
Cache byte-identical (44 entries, 55,355,647 bytes, 77 files).
`app.fonts.allFonts` **1198 at both ends**. One After Effects instance, zero
`aerender`; never launched, never quit, **nothing saved** but the three builds'
own output.

An overlong card now **shrinks on one line**. Nothing wraps, nothing clips, and
across three real builds **zero of 204 cards exceed the bound**.

Artifact: `reports/block-10-shrink.json`.

## 1. Done

### Preconditions (all seven pass)

| | measured at start |
|---|---|
| repo | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, name `framopia-studio` |
| After Effects | **1** instance · `aerender` **0** |
| ledger | 116 lines, `e5e0a6e9d6735188065fdbcb33bb9211cf1fc95a5cbc23b192ad246299c132cb` |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| git | `main`, clean, HEAD `8846574` *docs: report block 10 session 2* |
| open project | `.local/build/vitasilk-full.aep` — **inside `.local/build/`**, dirty as session 2 left it, on-disk sha256 `d8bdf144…` which **matches what session 1 recorded** |

### Deliverable A — shrink-to-fit

Commit `a5bcb7b` *feat: shrink an overlong card to fit instead of wrapping it*.

| file | what changed |
|---|---|
| `core/src/shrink-to-fit.ts` | the arithmetic, the bound, the refusal, the summary |
| `core/src/shrink-to-fit.test.ts` | **29 tests** |
| `panel/jsx/text-fit.jsx` | `framopiaShrinkToFit`, `framopiaShrinkNextSize`, `framopiaTooWideMessage` |
| `panel/jsx/build-reel.jsx` | the builder shrinks instead of breaking, and refuses a card it cannot fit |
| `service/src/build/build-reel-cli.ts` | asserts every achieved width and writes the per-reel artifact |

Point by point against the design:

1. **Measured in After Effects, in the real instance comp, at build time.**
   `framopiaShrinkToFit` runs on the duplicated instance's own placeholder
   layer, after the text is set, at `instance.duration / 2` — never a probe
   layer, never a figure from `reports/block-10-card-widths.json`. Those
   figures are used only for the cross-check in §3 below and for unit-test
   fixtures.
2. **The size is written on the `TextDocument`.** A test reads the function's
   own source and fails if it ever touches `property('Scale')`; the templates
   animate Scale and nothing here writes it. `templates/library.aep` is
   byte-identical.
3. **Both text layers get the identical size, and it is read back.** The
   shadow is set to `e.shrink.finalFontSize` — not to the style's size, which
   for a shrunk card is the size it *would* have had — and the builder then
   reads both layers back and **throws** if the sizes differ, naming the comp
   and both numbers. The census checks the same property independently across
   a whole build: **0 comps where placeholder and shadow sizes differ**, in all
   three reels.
4. **The card is placed unbroken.** The builder sets `e.candidate.oneLine` and
   never `twoLines`. A test asserts `framopiaFittedText` no longer appears in
   `build-reel.jsx`.
5. **Apply, re-measure, iterate.** `SUBTITLE_SAFE_WIDTH` is read from
   `core/src/typography.ts`, never typed. The loop's exit condition is
   `measured.width <= safeWidth` — a measurement, never the arithmetic that
   produced the size — bounded by `SHRINK_MAX_ATTEMPTS = 6`. The CLI then
   re-checks the whole set through `assertEveryCardFits`, which reads the last
   width After Effects reported.
6. **A card that cannot be brought under the bound fails the build.** The
   ExtendScript throws at the `build-elements` stage — before anything is saved
   — with the card's id, kind, text, face, base size and **every measured
   width in the attempt sequence**. There is no clip fallback and no wrap
   fallback. `cardTooWideMessage` in TypeScript is the same sentence and is
   unit-tested; the two are separate implementations because the loop runs
   where the measuring happens, and a test pins the arithmetic they share.
7. **No minimum shrink factor.** No floor, no warning threshold, no refusal
   below a ratio. The corpus's worst case is **×0.5589** and it built.
8. **Every shrunk card is in an artifact.** The build writes
   `.local/build/<reel>-shrink.json` beside the `.aep`: per card the id, reel,
   text, template, face, base size, final size, factor, width before and after,
   the number of attempts, and **every intermediate measurement**. The three
   reels' artifacts are consolidated into the committed
   `reports/block-10-shrink.json`.
9. **Pure logic in TypeScript.** `needsShrink`, `nextFontSize`,
   `assertEveryCardFits`, `cardTooWideMessage`, `summariseShrinks`. Only
   measuring and setting live in `.jsx`, and four tests read the `.jsx` source
   to pin the mirror — this repo's rule for a rule with two implementations.

**`nextFontSize` floors rather than rounds.** Rounding up could put a card back
over a bound the arithmetic had just cleared; flooring can only be safe, and
1e-4 of a point is far below anything a rendered width can show.

### Deliverable B — the census can verify it

Commit `95ee278` *feat: census reads card sizes and checks them against the
plan*.

- **Every text layer's font size** is recorded (the reader already captured it;
  it is now carried onto the comp as `fontSizePx` and used).
- **The full size is derived from the dump**, as the largest size seen among
  cards sharing a template *and a face*. Grouping by face is what keeps a Latin
  keyword at the emphasis ratio (494.742) from reading as an enlarged
  `sub_pop`. The census reports `cardsAtFullSize`, `cardsShrunk`,
  `smallestSizeFactor` and a per-group breakdown.
- **`placeholderShadowSameSize`** per comp, and
  `compsWherePlaceholderAndShadowSizesDiffer` in the summary.
- **The plan comparison is emitted by the tool now.** `--plan` resolves what
  each card should read through **`buildReel`**, the builder's own function,
  and the census reports `textCompsComparedAgainstPlan` and
  `textMismatchesAgainstPlan` and names any card that disagrees. Whitespace and
  break characters are normalised on both sides before comparing. Absent
  `--plan`, both figures are **null** — unmade, not passed.

**11 new tests** (core 591 → 602).

### Deliverable C — three real builds

All three through `runBuildJob`, the function `POST /jobs {type:"build"}`
calls. **Nothing billed: the ledger is byte-identical.** Build wall clock
6.0 s, 4.3 s, 2.2 s.

#### 1. Zero cards over the bound

| reel | cards | shrunk | **over the bound after the build** | widest card |
|---|---:|---:|---:|---:|
| vitasilk | 71 | 1 | **0** | 1939.9997 |
| test-1 | 66 | 1 | **0** | 1939.9997 |
| test-2 | 67 | 2 | **0** | 1939.9997 |
| **total** | **204** | **4** | **0** | against 1940 |

Every shrunk card, with the width After Effects measured after the shrink:

| reel | id | text | face | size | factor | before | **after** | attempts |
|---|---|---|---|---:|---:|---:|---:|---:|
| test-1 | k002 | `محفزات الكولاجين` | Almarai-Bold | 455 → **254.2928** | **×0.5589** | 3471.20 | **1939.9997** | 2 |
| test-2 | k002 | `ترطيب عميق` | Almarai-Bold | 455 → **360.3268** | ×0.7919 | 2449.72 | **1939.9996** | 2 |
| test-2 | g026 | `hyaluronique` | Inter-SemiBold | 343 → **312.8933** | ×0.9122 | 2126.67 | **1939.9997** | 2 |
| vitasilk | g071 | `matrddadich` | Inter-SemiBold | 343 → **324.9198** | ×0.9473 | 2047.95 | **1939.9997** | 2 |

Exactly the four cards session 2 predicted for these three reels, and no
others. **Every one converged in two attempts**, so the six-attempt bound was
never approached. Each lands a few ten-thousandths under the bound, which is
the flooring working.

The census, run separately over each built file, agrees: **0 placeholder words
surviving, 0 comps missing a declared layer, 0 with an undeclared text layer,
0 where placeholder and shadow differ in text, 0 where they differ in size,
0 text mismatches against the plan** across all 204 cards.

#### 2. Actual against predicted — the RTL question is closed

Session 2 measured every card on a **point-text probe layer** at After Effects'
default paragraph direction, and flagged that the `_ar` comps are authored RTL
and that whether direction changes advance width had never been checked. This
build measures inside the real `sub_pop_ar` and `kw_slam_ar` instances.

Comparing each card's width at its **base size** — the same quantity, measured
two different ways:

| | cards | bit-identical | max abs delta | mean | median |
|---|---:|---:|---:|---:|---:|
| **all** | 204 | **204** | **0.000000 px** | 0.0 | 0.0 |
| **Arabic script** | 25 | **25** | **0.000000 px** | 0.0 | 0.0 |
| Latin | 179 | **179** | 0.000000 px | 0.0 | 0.0 |

**Every one of the 204 is bit-identical, Arabic and Latin alike.** Paragraph
direction does not change advance width, so **session 2's artifact is correct
for its Arabic figures too** and its five-figure Block 9 reproduction stands.
The Arabic cards were not merely close; they matched exactly, which is a
stronger result than the comparison was designed to detect.

**Four base sizes disagree by 4.4e-6, and the widths do not.** All four are
Latin keywords at the emphasis ratio: the build reports **494.742004394531**
where session 2 asked for **494.742**. After Effects stores `fontSize` as a
float32 and reports back its nearest value — the same class of artefact as the
frame rate reading 29.9700317382812 rather than the exact 30000/1001. The
widths are identical, so nothing was set differently.

The 134 cards of `ground-truth` and `test-3` were not built and are not in this
comparison; 204 + 76 + 58 = 338.

#### 3. `Almarai-Bold` in a built comp — the first time

`vitasilk` is all-Latin. These are the first builds to place the Arabic face.

| reel | fonts the census found | outside `k2-syndicalia` |
|---|---|---|
| vitasilk | `CormorantGaramondItalic-SemiBoldItalic`, `Inter-SemiBold` | **none** |
| test-1 | **`Almarai-Bold`**, `Inter-SemiBold` | **none** |
| test-2 | **`Almarai-Bold`**, `CormorantGaramondItalic-SemiBoldItalic`, `Inter-SemiBold` | **none** |

**`test-2` is the first build to place all three of K2's faces at once.** The
per-template breakdown the census derives:

| reel | group | cards | shrunk |
|---|---|---:|---:|
| test-1 | `sub_pop` / Inter-SemiBold @ 343 | 48 | 0 |
| test-1 | `sub_pop_ar` / Almarai-Bold @ 367 | 16 | 0 |
| test-1 | `kw_slam_ar` / Almarai-Bold @ 455 | 2 | **1** |
| test-2 | `sub_pop` / Inter-SemiBold @ 343 | 59 | **1** |
| test-2 | `sub_pop_ar` / Almarai-Bold @ 367 | 5 | 0 |
| test-2 | `kw_slam` / Cormorant @ 494.742 | 1 | 0 |
| test-2 | `kw_slam_ar` / Almarai-Bold @ 455 | 2 | **1** |
| vitasilk | `sub_pop` / Inter-SemiBold @ 343 | 68 | **1** |
| vitasilk | `kw_slam` / Cormorant @ 494.742 | 3 | 0 |

The 367 and 455 in the `_ar` groups are `ARABIC_SIZE_RATIO` already applied by
hand when the comps were authored, exactly as `text-style.ts` describes.

#### 4. The red shadow at a reduced size — measured, unchanged

The offset is a **Transform effect on `TXT_MAIN_SHADOW`, +8 across and +15
down**, read from `templates/library.audit.json` and identical on all four text
comps. It is a user ruling from Block 9 and **nothing here changed it**.

Cap height measured in After Effects for each face at each size ("H" through
`sourceRectAtTime`); ink height is the card's own string.

| card | face | size | cap height | offset ÷ cap height | offset ÷ font size |
|---|---|---:|---:|---:|---:|
| vitasilk g071 before | Inter-SemiBold | 343 | 249.55 | 0.0601 | 0.04373 |
| vitasilk g071 **after** | Inter-SemiBold | **324.92** | 236.39 | **0.0635** | 0.04617 |
| test-2 g026 before | Inter-SemiBold | 343 | 249.55 | 0.0601 | 0.04373 |
| test-2 g026 **after** | Inter-SemiBold | **312.89** | 227.64 | **0.0659** | 0.04794 |
| test-2 k002 before | Almarai-Bold | 455 | 325.78 | 0.0460 | 0.03297 |
| test-2 k002 **after** | Almarai-Bold | **360.33** | 257.99 | **0.0581** | 0.04163 |
| test-1 k002 before | Almarai-Bold | 455 | 325.78 | 0.0460 | 0.03297 |
| test-1 k002 **after** | Almarai-Bold | **254.29** | 182.07 | **0.0824** | 0.05899 |

**How much further out the shadow reads, per card:** vitasilk g071 **1.056×**,
test-2 g026 **1.096×**, test-2 k002 **1.263×**, and test-1 k002 **1.789×**.

So on three of the four the shadow moves out by 6–26% relative to the letters,
which is small. On `test-1 k002` — the ×0.5589 case — the offset is **1.79×
larger relative to cap height** than on an unshrunk card: 15 px behind letters
182 px tall rather than behind letters 326 px tall. That is the one card where
the question is real, and it is the user's eye, not a number to invent here.

#### 5. The wrap path is unreachable

Under the old rule a card wrapped when its measured one-line width exceeded the
bound **and** `chooseBreak` found a break point. Against session 2's
measurement of all 338 cards: **2 would have wrapped** (`test-1 k002` and
`test-2 k002`, the two breakable overflows) and **7 would have overhung** (the
single words with no break point). **Both are now zero**: the builder passes
`candidate.oneLine` and never `twoLines`, and no card is left over the bound.

Now unused for subtitles, **none of it deleted**:

| | state |
|---|---|
| `framopiaFittedText` (`panel/jsx/text-fit.jsx`) | **defined and called nowhere** — genuinely dead |
| `framopiaFitText` (same file) | no longer used by the builder; still used by `panel/jsx/measure-survey.jsx` for `npm run wrap:survey` |
| `chooseBreak` (`service/src/build/wrap.ts`) | still called by `reel-plan.ts` and `wrap-survey-cli.ts`; the builder reads only `candidate.oneLine` |
| `LINE_SEPARATOR`, `BreakCandidate.twoLines` / `.lines` / `.reason` | produced on every element, unread by the builder |
| `MAX_SUBTITLE_LINES`, `LINE_SPACING` (`core/src/typography.ts`) | read only by `SUBTITLE_BAND` |
| `EXTRA_LINES_RENDER_BELOW` | read only by `wrap-survey-cli.ts`'s prose |

**Named debt, not touched.** `SUBTITLE_BAND` adds
`(MAX_SUBTITLE_LINES - 1) * LINE_SPACING` = **323 px** of descent for a second
line no card can now have. The band bounds where every picture is placed, so
narrowing it would move image placement on every reel; that belongs in its own
session with its own evidence, as the brief says.

## 2. Deviations

1. **`parkOnWrapped` became `parkOnShrunk`.** The builder parked the playhead on
   a card that wrapped so the thing to judge was on screen; nothing wraps now,
   so on every build it would have fallen through to `no wrapped card to park
   on`. It parks on a shrunk card instead — the analogous and now-useful thing.
   Renaming it rather than leaving a warning fire on every build is a judgement
   call and is the only behaviour change beyond the ruling itself.
2. **The build's own shrink artifact is `.local/build/<reel>-shrink.json`**,
   beside the `.aep`, which is machine-local like every other build output. The
   three reels' artifacts are consolidated into the committed
   `reports/block-10-shrink.json`, so a figure exists in a committed file as
   §A.8 requires.
3. **The census was interleaved with the builds.** It reads the project After
   Effects already has open and refuses to open one, so each reel had to be
   built and censused before the next was built. Three extra builds were run
   for that; all free, all cached.
4. **`framopiaFitText` was kept rather than replaced.** `npm run wrap:survey`
   still calls it, and §5 forbids deleting the wrapping machinery.
5. **`buildReel` is called with stub `candidateFileFor` and `sfxFileFor`** in
   the census's `--plan` path. Only the text is wanted, and `buildReel` derives
   a card's text, template and style without consulting either — the same
   substitution session 2 made and reported.

**No test asserted retired behaviour.** Checked by name: nothing outside the new
tests mentions `parkOnWrapped`, `framopiaFittedText`, `fit.wrapped` or
`textFits`. `service/src/build/wrap.test.ts` tests `chooseBreak` alone, which is
unchanged and still used.

## 3. Failures & open problems

**Nothing was destroyed or lost.** No plan, cache entry, template, mode file,
generated image or ledger line changed. The three `.aep` files under
`.local/build/` were rewritten — they are the builds' own output, reproducible
in seconds, and their old contents were the same builds from earlier sessions.

1. **`ground-truth` and `test-3` were not built**, so shrink-to-fit has been
   exercised on 204 of the corpus's 338 cards. The five remaining overflowing
   cards live on those two reels — `polynucléotides` ×1 and `mésothérapie` ×3
   and `hyaluronique` ×1, all Inter-SemiBold single words with no break point,
   the same shape as `matrddadich` which built. They are untested, and one of
   them, `polynucléotides` at 2617.38 px, is the widest Latin card in the
   corpus. Neither reel has a client (session 2 §3.7), so building them would
   also have exercised the no-client path, which remains untested.
2. **A card that cannot be brought under the bound has never happened**, so the
   refusal path is proven only by unit tests and by reading. Every real card
   converged in two attempts. A synthetic case was not driven through After
   Effects.
3. **The census still cannot open the file it censuses**, so the three-build
   sequence had to interleave. For a golden run that means the census can only
   read a build in the moments after it was made. Unchanged from session 2, and
   it now costs a real workflow constraint rather than a theoretical one.
4. **The shadow at ×0.5589 is a real open question**, quantified above at
   1.79× and deliberately not acted on. It needs the user's eye.
5. **`framopiaFittedText` is dead code** — defined, called nowhere. Left in
   place because §5 forbids deleting the wrapping machinery, but it is not
   machinery any more, it is a leftover.
6. **The measurement is still same-machine.** Everything here was measured on
   one MacBook, one After Effects 26.0x67 and one set of font files. A shrink
   factor is derived from a measured width, so a second machine whose Inter or
   Almarai differs would shrink by a different amount and produce a different
   comp — which is exactly what a golden comparison would flag, and nothing here
   tells us whether it will.
7. **Untested this session:** the panel, CEP `evalScript`, the service's HTTP
   layer, the second machine. Every `DoScript` returned `0` on its first
   attempt, so the returns-`1` retry path was never entered.

## 4. Repo state

- Branch **`main`**. Commits this session, in order: `a5bcb7b` *feat: shrink an
  overlong card to fit instead of wrapping it*, `95ee278` *feat: census reads
  card sizes and checks them against the plan*, then the reports.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 41 | **602** |
| `framopia-service` | 90 | 1146 |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Gates: `mode k2-syndicalia v12: ok (fonts set)` · `templates: 6 entries, ok` ·
  `extendscript: 13 .jsx file(s) ok` · `validate-templates: 6 template(s) ok,
  audited against library.aep` · `validate:panel: ok` · `references: PASS` ·
  `models: birefnet-general ok`, `selfie-multiclass-256x256 ok`.
- Close-out, start → end: ledger 116 lines / `e5e0a6e9…c132cb` → **identical** ·
  `templates/library.aep` `1d7553e894…2dc4a5d8` → **identical** · cache 44
  entries / 55,355,647 bytes / 77 files → **identical** · all five Edit Plan
  sha256 → **identical** · `app.fonts.allFonts` **1198 → 1198**.

## 5. Suggested next step

The two reels that were not built are the gap worth closing first, and closing
it costs nothing: `ground-truth` and `test-3` are fully cached, they hold the
five remaining overflowing cards including the corpus's widest Latin one, and
they are the only two reels with no client — so one pass builds and censuses
them, exercises shrink-to-fit on the rest of the corpus, and puts a real
measurement under session 2's §3.7 finding that a client-less reel silently
takes the template's own type. With all 338 cards built and censused clean, the
golden run has a fixed target and `vitasilk` can be pinned, which is the thing
this block exists for. Two smaller items belong with it: the shrunk-shadow
figures above want the user's eye on the ×0.5589 card before anyone builds on
them, and `SUBTITLE_BAND`'s 323 px of second-line descent is now provably
unearned — worth its own session, because narrowing it moves every picture on
every reel.
