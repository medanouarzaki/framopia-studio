Status: OK

# Block 10 session 4 — break first, shrink only when there is nothing to break

**Spent $0.00; no API was called.** Ledger **116 lines, sha256 `e5e0a6e9…c132cb`,
byte-identical at both ends.** `templates/library.aep` `1d7553e894…2dc4a5d8` at
both ends. **All five Edit Plans byte-identical** — no build wrote to a plan.
Cache byte-identical (44 entries, 55,355,647 bytes, 77 files).
`app.fonts.allFonts` **1198 → 1198**. One After Effects instance, zero
`aerender`; never launched, never quit, **nothing saved** but the five builds'
own output.

Session 3's rule is corrected. **All five reels built and censused: 338 cards,
2 broken onto two lines at full size, 7 shrunk, zero over the bound.**

Artifact: `reports/block-10-card-fit.json`.

## 1. Done

### Preconditions (all seven pass)

| | measured at start |
|---|---|
| repo | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, name `framopia-studio` |
| After Effects | **1** instance · `aerender` **0** |
| ledger | 116 lines, `e5e0a6e9d6735188065fdbcb33bb9211cf1fc95a5cbc23b192ad246299c132cb` |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| git | `main`, clean, HEAD `9aaaa5d` *docs: report block 10 session 3* |
| open project | `.local/build/test_1-full.aep` — **inside `.local/build/`**, dirty as the user left it, on-disk sha256 `3e8207c6…` |
| fonts | 1198 |

### Deliverable A — the corrected rule

Commits `03ab1d5` *fix: break an overlong card before shrinking it* and
`e04d02a` *docs: record the break-before-shrink ruling*.

`core/src/shrink-to-fit.ts` → **`core/src/card-fit.ts`** (and its test with it).
The name now describes what the module does: shrinking is the fallback, not the
rule. `panel/jsx/text-fit.jsx` gains **`framopiaFitCard`** in place of
`framopiaShrinkToFit`.

The order, each step decided on a width After Effects measured:

1. **Measure the whole card on one line at its authored size.** At or under
   `SUBTITLE_SAFE_WIDTH` — read from `core/src/typography.ts`, never typed —
   it is placed as it is. **329 of 338 cards.**
2. **If not, ask `chooseBreak`.** With a break point the card goes onto two
   lines **at full size** and each line is measured on its own. `chooseBreak`
   returns at most two lines, so the "needs three lines" case cannot arise from
   it; a card whose line still overruns falls to step 3 with its break kept.
3. **Shrink only then**, keeping whatever break was made, driven by the
   **widest line** — which for a point-text layer is the width of the layer's
   own source rect, the union of its lines. Apply, re-measure, iterate, bounded
   by `SHRINK_MAX_ATTEMPTS`.
4. **Assert by reading back.** The build refuses a card it cannot bring under
   the bound, at the `build-elements` stage before anything is saved, naming id,
   kind, text, face, base size, **whether it was broken**, and every measured
   width with its layout. `assertEveryCardFits` in the CLI re-checks the whole
   set against the last width After Effects reported.
5. **No minimum shrink factor** — no floor, no threshold, no refusal below a
   ratio.
6. **Both layers get the identical text and size, checked back.** The shadow
   takes the placed string **including the break character** and the size the
   fit landed on. The builder reads both layers back and throws on either a size
   difference or a **text** difference, naming the comp and both values. A break
   that reached one layer and not the other is the Block 9 defect wearing a
   different hat, so it is now its own refusal.
7. **The split is unchanged.** Arithmetic, policy and refusal in TypeScript
   with **32 tests**; only measuring and setting in `.jsx`; seven of those tests
   read the `.jsx` source to pin the mirror — including one that asserts the
   break is tried **before** any reduction in size, by comparing where each
   appears in the function.

**Tests asserting retired behaviour, rewritten in the same commit.** Named:

| test | was | now |
|---|---|---|
| `the builder sets the card whole and refuses one it cannot fit` | asserted `e.candidate.oneLine` and `not.toContain('framopiaFittedText')` | `the builder hands over the whole candidate…`, asserting `framopiaFitCard(` and `e.candidate, o.safeWidth` |
| `names the card, its face, its size and every measured width` | expected `not wrapped and not clipped` | expects `with no break point` and `not clipped` |
| `convergence on the corpus’ real overflowing cards` | all nine cards | **`convergence on the cards that have no break point`** — the seven single words, since the two breakable ones no longer shrink |
| `gives the shadow the size the shrink landed on and checks both back` | size only | also asserts the placed string and the break-included check |
| `counts an untouched set as untouched` / `reports the smallest factor…` | `shrunk` / `atFullSize` only | `untouched` / `broken` / `shrunk`, plus two new tests separating a card broken at full size from one that also shrank |
| `parks on the first card that was broken or shrunk` | *(new)* | pins the park rule |

`service/src/build/wrap.test.ts` needed no change: it tests `chooseBreak`,
which is unchanged and is now **load-bearing again** rather than vestigial.

**The debt session 3 recorded is resolved.** It called `SUBTITLE_BAND`'s
`(MAX_SUBTITLE_LINES - 1) * LINE_SPACING` = 323 px of second-line descent
"unearned, because no card can have two lines". Cards can have two lines again,
so the band is **correct as authored** and there is nothing outstanding.
`SUBTITLE_BAND`, `MAX_SUBTITLE_LINES` and `LINE_SPACING` are untouched.

**The playhead parks on the first card that was broken or shrunk**, so the
notable card is on screen when the build is opened.

**The ruling is recorded** in `docs/PROJECT_SPEC.md` §3, replacing "never wraps
to a second line": the rule, the date, the user as the source, and the reason —
a keyword that shrinks becomes smaller than the ordinary card beside it, which
inverts what a keyword is for.

### Deliverable B — all five reels

Built through `runBuildJob`, censused with `npm run census:comp`, interleaved.
**`ground-truth` and `test-3` have never been built before.** Build wall clock
2.0–5.7 s each. **Nothing billed.**

#### 1 & 2. What the fit did, and nothing over the bound

| reel | cards | one line, full size | **broken** | **shrunk** | **over the bound** | widest line |
|---|---:|---:|---:|---:|---:|---:|
| ground-truth | 76 | 74 | 0 | 2 | **0** | 1939.9997 |
| test-1 | 66 | 65 | **1** | 0 | **0** | 1815.9050 |
| test-2 | 67 | 65 | **1** | 1 | **0** | 1939.9997 |
| test-3 | 58 | 55 | 0 | 3 | **0** | 1939.9997 |
| vitasilk | 71 | 70 | 0 | 1 | **0** | 1939.9997 |
| **corpus** | **338** | **329** | **2** | **7** | **0** | against 1940 |

**Broken onto two lines at full size — both keywords, both keep their authored
size:**

| reel | id | text | lines | face | size | line widths | widest |
|---|---|---|---|---|---:|---|---:|
| test-1 | k002 | `محفزات الكولاجين` | `محفزات` / `الكولاجين` | Almarai-Bold | **455 → 455** | 1508.78 / **1815.91** | 1815.91 |
| test-2 | k002 | `ترطيب عميق` | `ترطيب` / `عميق` | Almarai-Bold | **455 → 455** | **1295.39** / 1020.57 | 1295.39 |

**Shrunk — all seven are single words with no space to break at:**

| reel | id | text | face | size | factor | before | after | attempts |
|---|---|---|---|---:|---:|---:|---:|---:|
| ground-truth | g026 | `polynucléotides` | Inter-SemiBold | 343 → 254.2308 | ×0.7412 | 2617.38 | 1939.9995 | 2 |
| ground-truth | g053 | `mésothérapie` | Inter-SemiBold | 343 → 296.7007 | ×0.8650 | 2242.73 | 1939.9997 | 2 |
| test-3 | g007 | `mésothérapie` | Inter-SemiBold | 343 → 296.7007 | ×0.8650 | 2242.73 | 1939.9997 | 2 |
| test-3 | g019 | `mésothérapie` | Inter-SemiBold | 343 → 296.7007 | ×0.8650 | 2242.73 | 1939.9997 | 2 |
| test-2 | g026 | `hyaluronique` | Inter-SemiBold | 343 → 312.8933 | ×0.9122 | 2126.67 | 1939.9997 | 2 |
| test-3 | g023 | `hyaluronique` | Inter-SemiBold | 343 → 312.8933 | ×0.9122 | 2126.67 | 1939.9997 | 2 |
| vitasilk | g071 | `matrddadich` | Inter-SemiBold | 343 → 324.9198 | ×0.9473 | 2047.95 | 1939.9997 | 2 |

**The set matches session 2's prediction exactly — nine cards, no more and no
fewer**, and it splits as the ruling intends: the two with a break point break,
the seven without shrink. Every card resolved in **two attempts**; the
six-attempt bound was never approached.

**The worst shrink is now ×0.7412 on an ordinary single word**, where session 3's
was ×0.5589 on a keyword. Nothing in the corpus shrinks a keyword any more.

#### 3. The two cards the user ruled on

Both broke, and **neither had to shrink afterwards** — the finding this section
exists to test, and it came out the good way.

- **`test-1 k002`** `محفزات الكولاجين` → `محفزات` / `الكولاجين`, **Almarai-Bold
  at 455**, the authored `kw_slam_ar` keyword size, unchanged. Lines measure
  1508.78 and 1815.91 px, both under 1940 — the wider by 124 px.
- **`test-2 k002`** `ترطيب عميق` → `ترطيب` / `عميق`, **Almarai-Bold at 455**,
  unchanged. Lines 1295.39 and 1020.57 px, the wider under by 645 px.

The census confirms it independently from the built file: `test-1` reports
**`kw_slam_ar / Almarai-Bold at 455: 2 cards, 0 shrunk`** and `cards at full
size: 66, shrunk: 0` for the whole reel.

#### 4. The client-less pair — observed, not fixed

First builds of either reel. `resolveClientIdentity` returns `source: 'none'`
for both, so `textStyleFor` returns nothing and every card keeps the template's
own type. What the census actually found:

| reel | client on plan | faces | placeholder colour | shadow colour |
|---|---|---|---|---|
| ground-truth | **null** | Inter-SemiBold ×70, Almarai-Bold ×6 | **`#F4F4F4`** ×76 | `#820000` ×76 |
| test-3 | **null** | Inter-SemiBold ×47, Almarai-Bold ×11 | **`#F4F4F4`** ×58 | `#820000` ×58 |
| test-1 | k2 v5 / snapshot v10 | Inter ×48, Almarai ×18 | `#F8F6F2` ×64, **`#C9A96E`** ×2 | `#820000` |
| test-2 | k2 v5 / snapshot v10 | all three | `#F8F6F2` ×64, `#C9A96E` ×3 | `#820000` |
| vitasilk | k2 v5 / snapshot v10 | Inter, Cormorant | `#F8F6F2` ×68, `#C9A96E` ×3 | `#820000` |

**The divergence is real and it is in the colour**: the client-less reels draw
every word in the template's own pale **`#F4F4F4`**, not K2's crème
**`#F8F6F2`**. Four points per channel out of 255, invisible to the eye and
exactly the kind of silent difference that is worth naming. **No gold appears
at all** on either, but that is because neither reel has a keyword rather than
because the fallback drops it.

**The census reports "fonts outside k2-syndicalia: none" for both, and that is a
coincidence, not a check passing.** The templates carry Inter-SemiBold and
Almarai-Bold, which happen to be K2's Latin and Arabic faces. A second client
with different faces would build these two reels in K2's type with nothing
saying so. Observed only; the fix is a separate ruling.

#### 5. The census's own checks, all five reels

| | corpus |
|---|---:|
| text comps censused | **338** |
| text layers read | **676** |
| placeholder words surviving | **0** |
| comps missing a declared layer | **0** |
| comps with an undeclared text layer | **0** |
| comps where placeholder and shadow differ in **text** | **0** |
| comps where placeholder and shadow differ in **size** | **0** |
| compared against the Edit Plan | **338** |
| **text mismatches against the plan** | **0** |
| fonts outside `k2-syndicalia` | **0** |

The two broken cards match the plan because the census normalises the break
character before comparing — a rule written in session 3 that only became
load-bearing this session.

### Deliverable C — why `test-1`'s first picture is a wide shot

Read-only. Nothing was recomposed, regenerated or written.

**1. Where the framing instruction is decided.** At **slot-planning time
only**. `drawVariation` (`service/src/analysis/slot-select.ts:82`) draws one
value per axis, and `composePrompt` (`:152`) fixes it into the slot's `prompt`
string; `planSlots` calls both at `:240`, and `recompose.ts:43` is the only
other caller. **Nothing at generation time re-reads the axes** — the image stage
sends the stored `prompt` verbatim. `ImageSlot.variation` is **null on every
slot in the corpus**, so the drawn values survive only inside that string.

**2. When `test-1`'s four instructions were written.** Its slots carry
`promptModeVersion: 11`. The framing amendment that removed `wide` is
**mode v12**, Block 9 session 13 — **the session after**. Its analysis config is
still `keywords-prompt-v3-k2-syndicalia-v5`, so **the Block 9 regeneration did
not rewrite the slot ideas**; it recomposed the prompts at v11 and generated
from those. `pipeline.images` completed `2026-08-30T02:20:16.411Z` at
`$1.220660`.

**3. The stored instruction for the slot the user is looking at.** `img002`,
**4.599–6.759 s** — the picture at roughly 4–5 seconds. Its idea is
`A female doctor in a medical coat holding a small vial.` and its prompt
contains, verbatim:

> `wide, the whole subject with air around it`

**It names a wide framing.** That is the sentence the user is objecting to, and
it is on the plan because it was composed one mode version before the value was
removed.

**4. `vitasilk`.** Its slots carry **`promptModeVersion: 5`** — composed in
Block 4 and never recomposed. `img004` at 16.94 s
(`A woman looking at a mirror touching her hair with a thoughtful expression`)
carries the identical `wide, the whole subject with air around it`. Its analysis
config is the same `…-v5`; `pipeline.images` completed `2026-08-25T18:37:04.371Z`
at `$0.00` (a cached run). **So the golden reel also carries a wide shot.**

Computed read-only against mode v12, a recompose would draw:

| | stored | at v12 |
|---|---|---|
| test-1 img002 | **wide** | close |
| vitasilk img004 | **wide** | medium |

and no slot on either reel would draw `wide`, because v12 does not offer it.

**5. The consequence for spending.** **Neither change can be exercised by any
reel on disk without spending.**

- **The framing change** could be recomposed for free, but recomposing only
  rewrites the prompt string. The generated pictures are cached under the **old**
  composed prompt, so a recomposed slot misses its cache and its existing images
  are stranded. Seeing a non-wide picture means **regenerating**.
- **The literal-versus-atmospheric change** lives in
  `ACTIVE_SLOT_PROMPT_VERSION` 2 and governs which **ideas** get written, so it
  can only be exercised by a reel whose slot stage runs **fresh**.
  **`ground-truth` and `test-3` are the only reels with no slots planned at
  all**, and each costs about **$2.35** by the dry run.

## 2. Deviations

1. **`core/src/shrink-to-fit.ts` was renamed to `core/src/card-fit.ts`** (git mv,
   with its test). The rule changed materially and the old name described only
   the fallback branch. `SHRINK_MAX_ATTEMPTS`, `ShrinkRow` and
   `summariseShrinks` keep their names, so the CLI and the artifact shape are
   unchanged apart from the added fields.
2. **`ShrinkRow` gained `broken`, `lines` and `lineWidthsPx`**, and
   `ShrinkAttempt` gained `broken`; `ShrinkSummary` gained `untouched` and
   `broken` and `widthAfterPx` now means the widest line. Old
   `.local/build/*-shrink.json` files from session 3 do not carry them; they were
   overwritten by this session's builds.
3. **Each line is measured on its own for the record, and the decision uses the
   layer's own rect.** For a point-text layer the source rect is the union of the
   lines, so its width *is* the widest line — the two agree by construction, and
   measuring per line as well costs two extra measurements on broken cards only.
4. **Builds and censuses were interleaved**, as session 3 did, because the census
   reads the project After Effects already has open. Each reel was therefore
   built twice; all free, all cached.

## 3. Failures & open problems

**Nothing was destroyed or lost.** No plan, cache entry, template, mode file,
generated image or ledger line changed. The five `.aep` files under
`.local/build/` were rewritten — they are the builds' own output.

1. **The refusal path has still never fired.** Every card in the corpus resolves
   in two attempts. `assertEveryCardFits` and the ExtendScript throw are proven
   by unit tests and by reading, not by a real card failing.
2. **The three-line case cannot be reached from `chooseBreak`**, which returns at
   most two lines. A card whose two lines both overran would fall to shrinking
   with its break kept — implemented and untested on real data, because nothing
   in the corpus does it. `test-1 k002`'s wider line lands 124 px under the
   bound, which is the closest anything comes.
3. **`framopiaFitText` and `framopiaFittedText` are still in
   `panel/jsx/text-fit.jsx`.** `framopiaFitText` is used by
   `panel/jsx/measure-survey.jsx` for `npm run wrap:survey`;
   **`framopiaFittedText` is dead** — defined, called nowhere — and was already
   dead before this session. Not deleted.
4. **The client-less colour divergence is live** on two of five reels and was
   observed rather than fixed, as the brief requires. `#F4F4F4` against
   `#F8F6F2`.
5. **Both the framing and the literalness prompt changes remain unobserved.**
   They have now been unobserved across three blocks. This session established
   exactly why — the instruction is frozen into the stored prompt at compose
   time — and what it would cost, but changed nothing.
6. **The measurement is still same-machine.** A shrink factor and a break
   decision are both derived from a measured width, so a second machine whose
   Inter or Almarai differs would produce a different comp. Untested.
7. **Untested this session:** the panel, CEP `evalScript`, the service's HTTP
   layer, the second machine. Every `DoScript` returned `0` on its first
   attempt, so the returns-`1` retry path was never entered.

## 4. Repo state

- Branch **`main`**. Commits this session, in order: `03ab1d5` *fix: break an
  overlong card before shrinking it*, `e04d02a` *docs: record the
  break-before-shrink ruling*, then the measurement and the reports.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 41 | **605** |
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

Every card in the corpus now builds correct and measured, so the thing standing
between this and a golden run is a decision about money rather than a piece of
work: **both prompt changes are frozen into stored prompt strings and only
regeneration can show what they do**, and the reel the user is objecting to —
`test-1` — carries `wide` on the very slot he is looking at, as does `vitasilk`'s
`img004`. About $6.82 of credit remains. Recomposing `test-1` alone is free but
strands its eight pictures, so it is worth putting the choice plainly before
committing anything: regenerate `test-1`'s four slots at v12 to see the framing
fix on the reel he complained about, or plan `ground-truth` or `test-3` fresh at
$2.35 to exercise both changes at once and get a sixth built reel — but not both,
because Block 10's second-machine run draws on the same pot. Two free items can
go in the same session either way: the client-less `#F4F4F4` finding wants a
ruling, and `framopiaFittedText` is dead code that can go once someone confirms
`wrap:survey` is still wanted.
