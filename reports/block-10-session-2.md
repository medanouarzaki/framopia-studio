Status: OK

# Block 10 session 2 — the corpus measured in After Effects, and the census made permanent

**Spent $0.00; no API was called.** Ledger **116 lines, sha256 `e5e0a6e9…c132cb`,
byte-identical at both ends.** `templates/library.aep` sha256
`1d7553e894…2dc4a5d8` at both ends. **All five Edit Plans byte-identical**, cache
byte-identical to session 1's opening census (44 entries, 55,355,647 bytes, 77
files), `app.fonts.allFonts` **1198 names at both ends**. After Effects: one
instance, zero `aerender`; never launched, never quit, nothing saved.

Artifacts: `reports/block-10-vitasilk-census.json` and
`reports/block-10-card-widths.json` — 338 measured rows, each carrying its own
inputs.

## 1. Done

### Preconditions (all seven pass)

| | measured at start |
|---|---|
| repo | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `package.json` name `framopia-studio` |
| After Effects instances | **1** · `aerender` **0** |
| ledger | **116 lines**, `e5e0a6e9d6735188065fdbcb33bb9211cf1fc95a5cbc23b192ad246299c132cb` |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| git | `main`, clean, HEAD `608e539` *docs: report block 10 session 1* |
| `app.project.dirty` | **false** — After Effects was holding `.local/build/vitasilk-full.aep`, clean, 97 items |

### Deliverable A — the read-back census, committed

Commit `fe48980` *feat: read a built comp back out of after effects*.

| file | what it is |
|---|---|
| `tools/ae/census.jsx` | the reader. Opens nothing, sets nothing, saves nothing, never writes a font name |
| `core/src/comp-census.ts` | the pure shaping and every derived count, on the `validateTemplates` precedent |
| `core/src/comp-census.test.ts` | **15 tests** |
| `tools/ae/census-cli.ts` | the driver |
| `npm run census:comp` | `-- --aep <abs path> [--out <path>] [--mode <id>]` |

`scripts/check-extendscript.mjs` went **12 → 13 files**; core went **547 → 562
tests**. Both read out of the run's own output.

**It refuses rather than opening a project.** The `.aep` must already be open in
After Effects, and if a different one is it names both and stops. Opening would
replace whatever the user has on screen, and a census is not worth that.

**Every count in the output is derived from the layers in the dump**, never
carried: placeholder words surviving, comps missing a declared layer, comps
carrying an undeclared text layer, comps where placeholder and shadow differ,
fonts seen, and fonts outside the client's declared set. The Block 9 defect — a
hand-duplicated `TXT_MAIN` keeping the template's word, invisible because the
build fills by exact name — is a test case, not a hope.

**The artifact names its own inputs:** the `.aep` path, its sha256, the After
Effects version, the schema version and the timestamp are inside the JSON.

#### Run against session 1's build — every figure reproduces

`reports/block-10-vitasilk-census.json`, over
`.local/build/vitasilk-full.aep` sha256 `d8bdf144…`, AE 26.0x67:

| figure | session 1 reported | census tool | |
|---|---:|---:|---|
| comp count | 84 | 84 | ok |
| `master_final` layers | 83 | 83 | ok |
| `master_subs_only` layers | 72 | 72 | ok |
| master dimensions | 2160x3840 | 2160x3840 | ok |
| master duration | 25.6923590256924 | 25.6923590256924 | ok |
| master frame rate | 29.9700317382812 | 29.9700317382812 | ok |
| project items | 97 | 97 | ok |
| text comps | 71 | 71 | ok |
| text layers checked | 142 | 142 | ok |
| placeholder words surviving | 0 | 0 | ok |
| comps with an unexpected layer set | 0 | 0 | ok |
| text mismatches against the plan | 0 | 0 | ok |
| fonts seen | Inter-SemiBold, CormorantGaramondItalic-SemiBoldItalic | same two | ok |

**All reproduce. Nothing disagrees.** `master_final` breaks down as 1 footage +
1 watermark + 5 sfx + 5 image + 71 text = 83; `master_subs_only` as 1 + 71 = 72.
84 comps = 2 masters + 76 built instances + 6 library templates. Fonts outside
`k2-syndicalia`'s declared set: **none**.

One thing the tool does **not** do that session 1 did by hand: compare each
card's string against the Edit Plan. It records the string; the plan comparison
was run separately this session and is the "0 text mismatches" row above.

### Deliverable B — every card in the corpus, measured

`reports/block-10-card-widths.json` — 338 rows.

**The text is the build's own, not re-derived.** Every card came from
`buildReel()` in `service/src/build/reel-plan.ts`, the function
`build-reel-cli.ts` calls, wired to the same `templates/library.audit.json`, the
same manifest, and the same `resolveClientIdentity` → `textStyleFor` chain. The
338 cards are the corpus's 330 rendered subtitle cards plus its 8 keyword spans.

**Every constant read from `core/src/typography.ts`**, not from a prompt:
`SUBTITLE_SAFE_WIDTH` **1940**, `SUBTITLE_FONT_SIZE` 343, `KEYWORD_FONT_SIZE`
425, `EMPHASIS_SIZE_RATIO` 1.1641, `ARABIC_SIZE_RATIO` 1.07,
`MAX_SUBTITLE_LINES` 2, `LINE_SPACING` 323. Template sizes and tracking came
from the audit: `sub_pop` 343, `sub_pop_ar` 367, `kw_slam` 425, `kw_slam_ar`
455, **tracking 0 and CENTER_JUSTIFY on all four**, so nothing had to be
supplied to the probe that the build does not itself set.

The four faces and sizes actually measured: `Inter-SemiBold` 343,
`Almarai-Bold` 367 and 455, `CormorantGaramondItalic-SemiBoldItalic` **494.742**
(425 × 1.1641, which is the build's one size override).

**How wrap was ensured off.** The probe layer is created with
`comp.layers.addText(...)` — **point text, which has no bounding box and
therefore cannot wrap** — and read with `sourceRectAtTime(t, false)`. So the
figure is the natural single-line ink width. The templates' own `TXT_MAIN` is
point text too: `framopiaFitText` wraps by inserting a break character, not by
resizing a box, and the audit records `extents=false` and `extents=true`
agreeing exactly, which only holds for point text. No fixed box is involved
anywhere.

**The face was verified before it was set, on every case.**
`measure-widths.jsx` refuses if any requested name is missing from
`app.fonts.allFonts`, and it did not refuse. Each row also carries
`fontReadBack`: **0 of 338 differ from the name asked for**, so nothing was
silently substituted. The font-name count is 1198 before and after.

#### 1. How many cards overflow

| reel | overflowing | of | proxy flags |
|---|---:|---:|---:|
| ground-truth | **2** | 76 | 2 |
| test-1 | **1** | 66 | 0 |
| test-2 | **2** | 67 | 1 |
| test-3 | **3** | 58 | 3 |
| vitasilk | **1** | 71 | 1 |
| **corpus** | **9** | **338** | **7** |

Every one, widest first:

| reel | id | kind | text | face | size | width px | shrink to fit |
|---|---|---|---|---|---:|---:|---:|
| test-1 | k002 | keyword | `محفزات الكولاجين` | Almarai-Bold | 455 | **3471.20** | ×0.5589 |
| ground-truth | g026 | subtitle | `polynucléotides` | Inter-SemiBold | 343 | 2617.38 | ×0.7412 |
| test-2 | k002 | keyword | `ترطيب عميق` | Almarai-Bold | 455 | **2449.72** | ×0.7919 |
| ground-truth | g053 | subtitle | `mésothérapie` | Inter-SemiBold | 343 | 2242.73 | ×0.8650 |
| test-3 | g007 | subtitle | `mésothérapie` | Inter-SemiBold | 343 | 2242.73 | ×0.8650 |
| test-3 | g019 | subtitle | `mésothérapie` | Inter-SemiBold | 343 | 2242.73 | ×0.8650 |
| test-2 | g026 | subtitle | `hyaluronique` | Inter-SemiBold | 343 | 2126.67 | ×0.9122 |
| test-3 | g023 | subtitle | `hyaluronique` | Inter-SemiBold | 343 | 2126.67 | ×0.9122 |
| vitasilk | g071 | subtitle | `matrddadich` | Inter-SemiBold | 343 | **2047.95** | ×0.9473 |

**Seven of the nine are single words with no break point**, so the builder
cannot wrap them and they overhang the safe width today. The two that can be
broken are both two-word Arabic keyword spans, and the builder wraps those —
which is what PROJECT_SPEC §3 ruling 3 says should not happen. The corpus
contradicts the ruling in **both** directions at once: seven cards that clip and
two that wrap, where the ruling says shrink.

The next widest card that fits is `شد خفيف` (test-2 k003) at **1921.01** — under
the bound by **18.99 px**, or 0.98%. A slightly longer Arabic keyword joins the
overflowing set.

#### 2. Does `vitasilk` contain an overflowing card — yes, exactly one

**`g071`, `matrddadich`, Inter-SemiBold 343, measured 2047.95 px against 1940 —
over by 107.95 px, needing ×0.9473.** It is a single word with no space, so
`chooseBreak` returns no break point and the builder places it whole.

Block 8 recorded `vitasilk` as having one word past the 11-character proxy. That
word is this one, and **it really does overflow**: the proxy and the measurement
agree here. `vitasilk`'s five widest cards are `matrddadich` 2047.95 (over),
`filler glow` 1816.03, `génération` 1751.51, `vitamines` 1589.89, `Vita Silk`
1547.38.

**So the golden reel cannot be pinned as free of the shrink-to-fit question.**
Whatever `vitasilk` is pinned to today bakes in one card that is 5.3% too wide,
and building shrink-to-fit later will change that comp. Either the golden
comparison tolerates one card moving, or shrink-to-fit lands before the reel is
pinned. That is a decision for the conversation, and it is the practical
consequence of this measurement.

#### 3. The proxy against the measurement

`OVERLONG_WORD_CHARS = 11` (`service/src/transcript-view.ts:112`), applied per
card: flagged when any of its words, with one trailing punctuation mark removed,
is 11 characters or longer.

| | measured overflow | measured fit |
|---|---:|---:|
| **proxy says overflow** | **7** | **0** |
| **proxy says fit** | **2** | **329** |

**No false positive. Two false negatives, and both are Arabic keyword spans:**

| reel | id | text | face | size | width px |
|---|---|---|---|---:|---:|
| test-1 | k002 | `محفزات الكولاجين` | Almarai-Bold | 455 | 3471.20 |
| test-2 | k002 | `ترطيب عميق` | Almarai-Bold | 455 | 2449.72 |

The reason is structural rather than a calibration error. The proxy counts
characters **in a word**; both misses are two-word spans whose individual words
are 5–8 characters, set in a different face at a different size. A per-word
character count cannot see a two-word card, and it cannot see that Almarai at
455 sets far wider per character than Inter at 343.

Its 7 flagged cards are exactly the transcript editor's recorded per-reel
overlong counts — ground-truth 2, test-1 0, test-2 1, test-3 3, vitasilk 1 —
confirmed by calling `transcriptView` for each reel this session. So the proxy
is not broken; it is measuring words, and the ruling is about cards.

#### 4. Reproducibility against Block 9 — the measurement is stable

| keyword | face | size | Block 9 | this session | delta |
|---|---|---:|---:|---:|---:|
| test-1 k002 `محفزات الكولاجين` | Almarai-Bold | 455 | 3471.2 | **3471.1952** | −0.0048 |
| test-2 k002 `ترطيب عميق` | Almarai-Bold | 455 | 2449.7 | **2449.7201** | +0.0201 |
| test-2 k003 `شد خفيف` | Almarai-Bold | 455 | 1921.0 | **1921.0100** | +0.0100 |
| vitasilk k001 `filler glow` | Cormorant…-SemiBoldItalic | 494.742 | 1816.0 | **1816.0279** | +0.0279 |
| vitasilk k002 `Vita Silk` | Cormorant…-SemiBoldItalic | 494.742 | 1547.4 | **1547.3829** | −0.0171 |

**All five agree to the one decimal place Block 9 published**, worst deviation
0.028 px on 1816 — 15 parts per million. Face and size match Block 9's in every
case. Nothing was adjusted to make them agree: the five are rows 
of the same 338-case run, measured by the same tool, and the comparison was
made after the fact.

Two qualifications, because both bear on how far this generalises. It is the
**same machine, the same After Effects 26.0x67 and the same font files** as
Block 9 — this establishes the measurement is stable over time, not across
machines, which is Block 10's actual question. And the probe layer's paragraph
direction is After Effects' default rather than the RTL the `_ar` comps carry;
that is how Block 9 measured too, so the figures are comparable, but whether
direction changes total advance width has never been checked and is untested.

#### 5. Arabic-script runs

Over the display sequence — every rendered card, subtitles and keywords together
in time order.

| reel | Arabic cards | runs | runs of 2+ |
|---|---:|---:|---:|
| ground-truth | 6 / 76 | 3 | 2 |
| test-1 | 18 / 66 | 9 | 5 |
| test-2 | 7 / 67 | 2 | 1 |
| test-3 | 11 / 58 | 4 | 4 |
| vitasilk | **0 / 71** | 0 | 0 |
| **corpus** | **42 / 338** | **18** | **12** |

Every run of two or more, with its combined text:

| reel | cards | at | combined |
|---|---|---:|---|
| ground-truth | g021–g022 | 5.059 s | `الإبرة الحريرية` |
| ground-truth | g074–g076 | 22.039 s | `نتائج جد فعالة` |
| test-1 | k001–g004 | 0.399 s | `شد طبيعي للوجه` |
| test-1 | g006–g008 | 1.659 s | `تحفيز طبيعي للكولاجين` |
| test-1 | g029–g031 | 8.539 s | `تحفيز طبيعي للكولاجين` |
| test-1 | g036–g038 | 11.479 s | `شد خفيف للبشرة` |
| test-1 | g055–g056 | 17.420 s | `محفزات الكولاجين` |
| test-2 | k002–g038 | 8.960 s | `ترطيب عميق للبشرة شد خفيف للبشرة إشراقة ونضارة` (6 cards) |
| test-3 | g009–g011 | 2.579 s | `منطقة حول العينين` |
| test-3 | g026–g027 | 9.279 s | `ومادة الكافيين` |
| test-3 | g043–g045 | 14.439 s | `نتائج جد فعالة` |
| test-3 | g056–g058 | 19.779 s | `نتائج جد فعالة` |

`تحفيز طبيعي للكولاجين` — the term ORTHOGRAPHY_GUIDE §6 names verbatim —
appears twice on `test-1`, three cards each time. **`vitasilk` has no Arabic
card at all**, so the term ruling cannot be exercised on the reel most likely to
be the golden one.

**12 is a card-level count and is not the recorded 13.** The project's own
`splitArabicRuns` counts runs of consecutive Arabic **words** split across
cards, and reports 2 / 6 / 1 / 4 / 0 = **13**, which was re-derived this session
and matches the record exactly. The two figures answer different questions and
neither is wrong; the difference is the unit. Nothing was implemented and no
analysis call was made.

### Deliverable C — three questions

**C1. The watermark's flat second is sourced, and session 1's missing citation
exists.** `WATERMARK_DURATION_S = 1` at `service/src/placement/constants.ts:180`,
read once at `service/src/build/build-reel-cli.ts:512` and defaulted into
`placeWatermark`. The ruling is recorded in **`docs/PROJECT_SPEC.md` §5**: *"It
runs a flat second (user ruling, after seeing it built), not 'one second after
the last beep'."* The constant's own comment says the same and names Block 7
session 11 as where it replaced the beep-derived rule.

So the 1.000 s is a **user ruling, not a measurement**, and the asset being
2.035367 s / 61 frames is not a disagreement — the mark is deliberately shorter
than the file. The beep measurement is kept for a different purpose:
`assertBeepsFitWatermark` checks the last beep (0.400 s) finishes before the
mark leaves, leaving 0.600 s of margin, so a future watermark whose beeps run
long fails loudly instead of being cut mid-beep. Nothing was changed.

**C2. `snapshotsAgree` says all three pinned reels are current.** Run for real
against `modes/k2-syndicalia.json` at **v12**:

| reel | pinned | `snapshotsAgree` | `snapshotIsBehind` | fields differing |
|---|---:|---|---|---|
| test-1 | v10 | **true** | **false** | `version` only |
| test-2 | v10 | **true** | **false** | `version` only |
| vitasilk | v10 | **true** | **false** | `version` only |
| ground-truth | — | — | — | no snapshot; nothing to compare |
| test-3 | — | — | — | no snapshot; nothing to compare |

A field-by-field diff of each pinned snapshot against `snapshotOfMode(mode)`
finds exactly one difference on each: the version number. Palette, faces, colour
roles and `imageScale` are identical. Block 9 session 13's ruling — a reel is
behind when the look differs, not when the number does — is doing exactly what
it was written to do, and no reel is falsely reported as behind.

**C3. `chosenCandidateId` has one writer, reachable only from the panel, and no
persisted choice has ever existed.**

The only code that sets a non-null value is `chooseCandidate` at
`service/src/image-view.ts:350`. It is reached from `POST /images/choose`
(`service/src/server.ts:519`), called by the panel's picture editor
(`panel/src/service.ts:489`). Three other sites write **null**:
`service/src/analysis/job.ts:376` when a slot is first planned, and
`image-view.ts:333` and `:343` when a choice is cleared or a client picture is
chosen instead.

**No choice has ever been persisted, and there is on-disk evidence rather than
inference.** All nine slots across the corpus read null; **no plan carries
`overriddenGateFailures`**, which `chooseCandidate` writes whenever a rejected
candidate is picked — and eight of `vitasilk`'s ten candidates are rejected, so
almost any real choice there would have left that trace. The five
`.pre-script-grouping.bak` plan backups carry none either. The path is exercised
only by `service/src/image-view.test.ts`.

**What the build does with nothing chosen:** `buildChoiceFor`
(`service/src/build/choose-candidate.ts`) returns the **first candidate** with
reason `first candidate, nothing chosen` — a documented placeholder from Block 7
rather than a judgement that the first is best, and the reason is reported so a
build nobody chose for is not mistaken for a choice. On `vitasilk` that selects
`img001-c1` … `img005-c1`, which is what session 1 read back out of the built
project.

## 2. Deviations

1. **The census tool refuses to open a project.** §2 requires it to open
   nothing, and §2's closing line says to open session 1's file read-only. The
   file was **already open** in After Effects, so no open was needed and the
   hard requirement won: the tool asserts the requested `.aep` is the open
   project and refuses by name otherwise. `panel/jsx/library-guard.jsx` was not
   called because nothing is ever opened or imported, which is the condition it
   guards. The limitation this leaves is under *Failures*.
2. **`buildReel` was called with stub `candidateFileFor` and `sfxFileFor`.**
   Only the text half was measured, and `buildReel` derives every card's text,
   template, shadow layers and `textStyle` without consulting either — the stubs
   affect image and audio elements, which were discarded. The text resolution is
   the build's own, unmodified.
3. **The width probe adds a temporary comp to the open project.** That is the
   mechanism `tools/ae/measure-widths.jsx` already established and CLAUDE.md
   already rules on: the comp is removed (`numItems` is 97 before and after) and
   nothing is saved, but After Effects marks the project modified and the flag
   is read-only from a script. So the open project is now **dirty and can be
   closed without saving** — the file on disk is unchanged at sha256
   `d8bdf144…`, and it is the build's own output, reproducible in 5 s.
4. **No new project was created**, so §1's `dirty === false` branch was never
   reached.

## 3. Failures & open problems

**Nothing was destroyed or lost.** No plan, cache entry, template, mode file,
generated image or ledger line changed; every sha256 is identical at both ends.

1. **The census cannot open the file it censuses.** It reads the project After
   Effects already has open. A golden run therefore still needs someone or
   something else to have opened the build — which, since a build leaves its own
   output open, is true immediately after a build and false at any later moment.
   That is a real gap in the golden harness and it is not fixed here.
2. **The census does not compare against the plan.** It records each layer's
   string; whether that string is what the Edit Plan says was checked separately
   this session, by hand, exactly as session 1 did. Two sessions have now run
   that comparison ad hoc. It belongs in the tool.
3. **The measurement is stable in time, not across machines.** The five Block 9
   figures reproduce to 15 parts per million — on the same MacBook, the same
   After Effects 26.0x67 and the same installed font files. Block 10's question
   is whether a second machine agrees, and nothing here answers it. If the
   partner's Inter or Almarai differs by a point release, every width in
   `reports/block-10-card-widths.json` moves.
4. **The probe layer's paragraph direction is not the template's.** The `_ar`
   comps are authored RTL and the probe uses After Effects' default. Block 9
   measured the same way, so the comparison is sound, but **whether direction
   changes total advance width has never been checked** — and 42 of the 338
   cards are Arabic. It would take one deliberate comparison to close and was
   not attempted.
5. **`OVERLONG_WORD_CHARS` has two false negatives and both are in the corpus
   today.** They are not near-misses: 3471 px and 2450 px against a 1940 bound.
   The proxy is not calibrated wrongly, it is measuring the wrong thing — words
   rather than cards. Untouched, as the prompt requires.
6. **`vitasilk` overflows on one card**, so the reel most likely to be pinned as
   golden is not free of the shrink-to-fit question. Named above under B.2.
7. **`ground-truth` and `test-3` have no client at all.** `resolveClientIdentity`
   returns `source: 'none'` for both — no snapshot, and `clientMode` is null —
   so `textStyleFor` returns nothing and every card keeps the template's own
   type. It happens to be invisible today, because the templates carry
   Inter-SemiBold and Almarai-Bold, which are also K2's Latin and Arabic faces,
   and neither reel has a keyword, so the emphasis face never arises. **The
   moment either reel gets keywords, or a second client with different faces
   appears, those two reels build in the wrong type with nothing saying so.**
   Reported, not changed.
8. **Untested this session:** the panel, CEP `evalScript`, the service's HTTP
   layer, the second machine, and any reel other than `vitasilk` in a built
   comp. Every AE call this session returned `0` on its first attempt, so the
   `DoScript`-returns-`1` retry path was never entered and the several-minute
   refusal recorded in Block 9 session 5 remains unreproduced.
9. **`PLACEHOLDER_WORDS` in `tools/ae/census-cli.ts` is a hand-maintained list**
   of the four words the templates ship with. `templates/library.audit.json`
   does not record a layer's text, so there is nothing to derive it from. A word
   missing from the list makes the census quieter rather than wrong — it would
   report the layer's string faithfully and simply not label it as a survivor —
   but it is a list nobody checks, which is the shape this repo distrusts.
   Deriving it would need the audit to record placeholder text.

## 4. Repo state

- Branch **`main`**. HEAD before the reports commit: **`feat: read a built comp
  back out of after effects`** (`fe48980`), on top of `608e539` *docs: report
  block 10 session 1*.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 40 | **562** |
| `framopia-service` | 90 | 1146 |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Gates: `mode k2-syndicalia v12: ok (fonts set)` · `templates: 6 entries, ok` ·
  **`extendscript: 13 .jsx file(s) ok`** · `validate-templates: 6 template(s)
  ok, audited against library.aep` · `validate:panel: ok` · `references: PASS` ·
  `models: birefnet-general ok`, `selfie-multiclass-256x256 ok`.
- Close-out, start → end: ledger 116 lines / `e5e0a6e9…c132cb` → identical ·
  `templates/library.aep` `1d7553e894…2dc4a5d8` → identical · cache 44 entries /
  55,355,647 bytes / 77 files → identical · all five Edit Plan sha256 →
  identical · `app.fonts.allFonts` **1198 → 1198**.

## 5. Suggested next step

The measurement shrink-to-fit needs now exists and is stable, so the next
session should build it: a per-card scale computed inside After Effects from
`sourceRectAtTime` against `SUBTITLE_SAFE_WIDTH`, set on the duplicated
instance's text layer rather than on the template — the system never edits a
template's keyframes — which closes PROJECT_SPEC §3 ruling 3 for the nine cards
named above and removes the last thing standing between `vitasilk` and being
pinned as the golden reel. It is free, local, and the ×0.5589 to ×0.9473 factors
are already computed per card in `reports/block-10-card-widths.json`. Two
smaller things belong in the same session because they are the golden harness's
remaining gaps: teaching the census to compare each string against the Edit Plan
so that check stops being done by hand for a third time, and deciding whether
the census may open a file — because as it stands a golden run can only census a
build in the moments after it was made.
