Status: OK

# Block 9 session 11 — the shadow is filled, and it is proven

**Spent $0.00. No API was called.** After Effects was driven over AppleScript
`DoScript` into the already-running instance; never launched, never quit, no
`aerender`, no `-r` process. **`templates/library.aep` was read and audited,
never written** — identical sha256 at both ends. **Nothing is left dirty.**

## 1. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, same sha256 — byte-identical |
| cache at start | **36 entries** — 11 transcription, 7 analysis, 4 imageslots, 14 images |
| cache at end | **36 entries, census identical** |
| After Effects at start | **1 instance, pid 79146, started Thu Aug 27 21:00:05** |
| After Effects at end | **1 instance, pid 79146, started Thu Aug 27 21:00:05** — same process |
| `aerender` at start / end | **0 / 0** |
| `library.aep` at start | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| `library.aep` at end | **identical**, and identical to session 10's — nothing was saved |

**What was open, before and after.** At the start: an **empty untitled project,
clean** — session 10's mess had been closed without saving, exactly as needed.
At the end: `.local/build/vitasilk-full.aep`, the build's own output, **clean**.
The library was opened read-only twice during the session and both times left
replaced by something else rather than sitting open.

## 2. The audit's output

The fields session 10 committed without ever running **produce what they claim**.
Read out of `templates/library.audit.json`:

| comp | layer | size | fill | stroke | Transform offset |
|---|---|---:|---|---|---|
| `sub_pop` | `TXT_MAIN` | 343 | `#F4F4F4` | false | none |
| `sub_pop` | `TXT_MAIN_SHADOW` | 343 | `#820000` | false | **[8, 15]** |
| `sub_pop_ar` | `TXT_MAIN` | 367 | `#F4F4F4` | false | none |
| `sub_pop_ar` | `TXT_MAIN_SHADOW` | 367 | `#820000` | false | **[8, 15]** |
| `kw_slam` | `TXT_MAIN` | 425 | `#F4F4F4` | false | none |
| `kw_slam` | `TXT_MAIN_SHADOW` | 425 | `#820000` | false | **[8, 15]** |
| `kw_slam_ar` | `TXT_MAIN` | 455 | `#F4F4F4` | false | none |
| `kw_slam_ar` | `TXT_MAIN_SHADOW` | 455 | `#820000` | false | **[8, 15]** |

**Six comps, no duplicates**, and the six still hold their placeholder words —
`kan9olo`, `المنطقة`, `Booster`, `شد طبيعي` — on both layers, as an unbuilt
template should.

## 3. The build, read back out of the file

This is the verification session 10 could not do. `vitasilk`: 76 elements, 0
skipped, **71 text comps**, every one carrying both layers.

| comp | word | font | size | `TXT_MAIN` | `TXT_MAIN_SHADOW` | same text |
|---|---|---|---:|---|---|---|
| `g001__sub_pop` | `5` | Inter-SemiBold | 343 | `#F8F6F2` | `#820000` | yes |
| `g002__sub_pop` | `d9ay9` | Inter-SemiBold | 343 | `#F8F6F2` | `#820000` | yes |
| … 68 more subtitle cards, all alike | | | | | | |
| `k001__kw_slam` | `filler glow` | CormorantGaramondItalic-SemiBoldItalic | 494.742 | `#C9A96E` | `#820000` | yes |
| `k002__kw_slam` | `Vita Silk` | CormorantGaramondItalic-SemiBoldItalic | 494.742 | `#C9A96E` | `#820000` | yes |
| `k003__kw_slam` | `7rir` | CormorantGaramondItalic-SemiBoldItalic | 494.742 | `#C9A96E` | `#820000` | yes |

- **No placeholder word survives anywhere.** Checked by name for all four across
  every text layer of every comp: none.
- **The shadow kept `#820000`** — one distinct shadow colour across all 71
  cards. The mains are exactly two: crème `#F8F6F2` for ordinary words and gold
  `#C9A96E` for emphasized ones.
- **No card's shadow text differs from its main.**

**The wrapped case, on the corpus's own strings rather than a synthetic one.**
Nothing wraps at the ruled 1.1641, so I forced it by building the same reel at
the retired 1.3479 into a scratch file:

```
k001__kw_slam   TXT_MAIN         'filler\rglow'   wrapped=True
k001__kw_slam   TXT_MAIN_SHADOW  'filler\rglow'   wrapped=True
   -> shadow identical to main: True
```

**And the Arabic path**, which `vitasilk` has none of. Built `test-2`: 7 Arabic
cards, Almarai-Bold at 367 crème over `#820000`, and the wrapped Arabic keyword
`k002__kw_slam_ar` carrying `'ترطيب\rعميق'` identically on both layers, gold at
455 — Almarai rather than Cormorant, because the emphasis face is a Latin serif.
No placeholder survived there either. Both scratch files were deleted.

## 4. The band

**`FONT_METRICS` gains the emphasis face**: CormorantGaramondItalic-SemiBoldItalic
at **1000 / 806 / 281**, instanced at wght 600 from the *italic* family.

Derived by `tools/font-metrics/measure.py`, which **reproduces the two committed
faces exactly before it reports a third** — that is the whole reason to believe
the third:

```
latin     {'unitsPerEm': 2048, 'ascent': 1970, 'descent': 480}   committed …  MATCHES
arabic    {'unitsPerEm': 1000, 'ascent': 1100, 'descent': 427}   committed …  MATCHES
emphasis  {'unitsPerEm': 1000, 'ascent': 806,  'descent': 281}   (no committed value)
```

**Cormorant wins neither direction.** At 494.742 it reaches 398.76 up and 139.02
down, against Almarai's 500.23 and 194.18. **So the extent term did not move.**
It is in the derivation because a band built from two of the three faces on
screen was right by luck, not by construction.

**`SHADOW_DESCENT_PX` comes from the audit**, not from a number typed in.
Downward only — the band is full frame width, so the +8 sideways does not enter.
**The blur is not a term**: it animates 30 → 0 across the entrance, so at rest,
which is what the band clears, the offset is the whole of the shadow's reach —
and it is on the visible layer too.

| | top | bottom | height |
|---|---:|---:|---:|
| before | 1980.175 | 2997.578 | 1017.403 |
| **after** | 1980.175 | **3012.578** | **1032.403** |

**Proof it can fail** — the band tracks the file rather than a constant:

| | offset | band height |
|---|---:|---:|
| no template declares a shadow | 0 | 1017.403 |
| **the real templates** | **15** | **1032.403** |
| an audit taken before offsets were recorded | 0 | 1017.403 |
| the offset forced to 40 | 40 | 1057.403 |

The third row is the case worth naming: **an old audit reports zero, which is
indistinguishable from a shadow that does not move.** The defence is that
`validateTemplates` refuses an audit whose sha256 does not match the `.aep`. Six
tests pin all of it.

## 5. What moved in zones and placements

**Nothing.** `npm run zones -- --all --write-plan` and `npm run place -- --all`
re-derived every reel and the results are byte-identical:

| reel | zones | placements |
|---|---|---|
| ground-truth | 7, unchanged | 0 slots |
| test-1 | 18, unchanged | 4 slots, unchanged |
| test-2 | 19, unchanged | 0 slots |
| test-3 | 7, unchanged | 0 slots |
| vitasilk | 20, unchanged | 5 slots, unchanged |

The band's bottom edge moved 15 px down and **constrains nothing**, because
torso zones were retired in Block 6 session 5 and no remaining zone is bounded
from below by it. Worth knowing rather than assuming: the band term is correct
now and it happens to be inert.

## 6. The deleted script and the new guard

**`tools/ae/measure-shadow.jsx` is gone.** It nested each template comp in a
probe and asked for its rectangle, which is the comp's bounds and not its ink —
and an effect is applied after the source rect is taken, so neither the offset
nor the blur was ever visible to it. A rendered extent needs rendering and this
project never renders. The reasoning is a paragraph in
`docs/TEMPLATE_STYLE_PASS.md` rather than dead code kept as a warning.

**`panel/jsx/library-guard.jsx` is the self-import guard**, called by
`build-reel.jsx`, `build.jsx`, `measure-survey.jsx` and `audit.jsx` **before**
each opens anything, and loaded by both drivers. Demonstrated firing, with
`library.aep` genuinely open:

```
refusing to import /…/templates/library.aep into itself: that file is the project
currently open in After Effects. Importing it would duplicate every comp and leave
the project dirty. Close it first, or open something else.
```

A different path passed through in the same run, and the project was left clean
and replaced. It compares `fsName` — After Effects' own absolute path — so a
relative path or a symlink cannot slip past, and a project with no file is let
through because a never-saved project cannot be the file being imported. Eight
tests pin it by reading the sources, the way the unsaved-work refusal is pinned;
none of it can be exercised outside After Effects.

## 7. The client field

`textColours.shadow`, a **palette role** like the other two rather than a hex
value. K2's is `primary` — **derived**, by reading `#820000` out of the audit's
new fill-colour field and matching it to the palette role that holds it.

**Optional with no default.** Absent means the template's own shadow colour
stands, which is what the build does today; inventing a palette default would
give a client who has not chosen somebody else's look. Mode is **version 10**,
and the bump moves no cache key — `keywordModeContentHash` `7756f1e7883417fc`,
`slotModeContentHash` `a654c324f198ed37`, `compositionContentHash`
`c5b43f23a3bd4b0b`, all unchanged and pinned. The three pinned plans were
re-pinned to v10. **It is not wired through to the build**, as instructed.

## 8. Deviations

- **`test-2` was built as well as `vitasilk`.** `vitasilk` has no Arabic cards,
  so the `_ar` shadow path would have gone unverified — which is the kind of gap
  this session exists to close. The extra build was free and both scratch files
  were deleted.
- **`tools/font-metrics/measure.py` is new.** There was no committed derivation
  for `FONT_METRICS`; Block 6 session 4 measured the two faces by hand and
  committed only the numbers. Adding a third without a tool would have meant
  typing one, which the brief forbids. It uses fontTools out of `tools/cv/.venv`,
  which is an incidental of that stack rather than a declared dependency — so it
  is run by hand when a face is added and is **not** part of `npm run check`.

## 9. Failures and open problems

- **`tools/font-metrics/measure.py` depends on fontTools being in
  `tools/cv/.venv`** and on the three font files being in `~/Library/Fonts`. It
  is not in `npm run check`, so a machine without either finds out only when
  someone adds a face. That is deliberate — the alternative is a check that
  needs three fonts installed — but it is a real limitation for Block 10's
  golden run on a second machine.
- **The shadow colour field is recorded and unread.** Nothing sets the shadow's
  colour at build time; the templates' own `#820000` is what renders.
- **An audit predating `effectOffsets` yields a zero shadow term** and looks
  exactly like a shadow that does not move. The sha256 staleness check is the
  only thing standing between that and a band 15 px short.
- **`OVERLONG_WORD_CHARS = 11` is still a character-count proxy** for a rendered
  width, now three faces and a shadow away from what it was calibrated on.
- **No card in the corpus wraps at the ruled ratio**, so the wrapped path is
  exercised only by the two deliberate probes described in §3 rather than by a
  normal build.
- Nothing was lost. No cache entry, plan block, reference, ledger line or
  template content changed; the plans changed only in `meta`, `pipeline` and
  `clientSnapshot`.

## 10. Repo state

- Branch **`main`**, seven commits ahead of `49e97a5`, nothing force-pushed.
- HEAD: **`c5a2ea9 docs: record the two text layers, the band and the guard`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 38 | **541** |
| `framopia-service` | 89 | **1130** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 9.11 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v10: ok (fonts set)
templates: 6 entries, ok
extendscript: 12 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 9.11s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 11. Suggested next step

`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/vitasilk-full.aep`

The type work is finished and on screen: three faces, two colours, a shadow
behind every word. What is left in this line is small and can wait for his eye —
wiring the client's shadow colour through to the build so a future client does
not inherit K2's red, which is one field already recorded and one line in
`text-style.ts`. The larger open thing is unrelated to type:
`docs/DECISION-image-config.md` still carries three image-prompt defects —
fidelity, darkness and literalness — which are one prompt change and about $1.24
of regeneration to test together, and they need his go-ahead rather than more
groundwork.
