Status: OK

# Block 7 session 5 — text is measured by After Effects, and the cards wrap

Spent **$0.00**. No Gemini call, no ElevenLabs call, no billable request. The
cost ledger is byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` is byte-identical at both ends: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects instances: 1 at session start and 1 at session end**, PID
44015, command line
`/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects`
with no arguments and no `-r`. Helpers were excluded from the count. The count
was re-checked before every `DoScript` — `assertOneInstance` in
`service/src/build/drive.ts` enforces it in code — and never changed. Nothing
was launched, nothing was killed. **No new dependency was added.**

## Done

### Goal 1 — measured in AE, wrapped to two lines

**Where the measurement happens.** `panel/jsx/text-fit.jsx` sets `TXT_MAIN`'s
Source Text, reads `sourceRectAtTime`, and inserts the break only if the
measurement says so. `TXT_MAIN` stays a point-text layer; the string arrives
with the break already in it.

**The sample time is the template comp's mid-point** — 1.001001001 s on a
2.002 s comp — and it is passed explicitly. Never `prop.value`: Block 7 session
3 lost 50 px of baseline to a property read at whatever the current time
indicator happened to be.

**The claim that the source rect ignores the layer transform was checked, not
assumed.** `TXT_MAIN`'s Position is keyframed 750 → 700, so a transform-following
rect would differ between t=0 and the sample time. Measured on all four text
templates with the same probe string:

| template | position at 0 | position at sample | rect at 0 | rect at sample |
|---|---|---|---|---|
| `sub_pop` | [1080, 750, 0] | [1080, 700, 0] | 3228.2 x 336.5 @ -262.4 | 3228.2 x 336.5 @ -262.4 |
| `sub_pop_ar` | [1080, 750, 0] | [1080, 700, 0] | 3340.4 x 351.2 @ -272.7 | 3340.4 x 351.2 @ -272.7 |
| `kw_slam` | [1080, 750, 0] | [1080, 700, 0] | 3999.9 x 416.9 @ -325.2 | 3999.9 x 416.9 @ -325.2 |
| `kw_slam_ar` | [1080, 750, 0] | [1080, 700, 0] | 4141.4 x 435.4 @ -338.1 | 4141.4 x 435.4 @ -338.1 |

**Identical at both times while Position differs.** The sample time cannot bias
a width.

**`SUBTITLE_SAFE_WIDTH = 1940`** in `core/src/typography.ts`, 110 px clear each
side of a 2160-wide comp. **CHOSEN, NOT MEASURED**, and the comment says so
along with what would move it: the user's eye on a built reel.

**Goal 1.5 — what is tested and what is not.** The split is real and is not
papered over:

- **Covered by unit tests** (`service/src/build/wrap.test.ts`, 7 tests):
  break-point selection given a string — a two-word card breaks at its space,
  an Arabic pair breaks the same way without inspecting the script, a single
  word refuses and says why, nothing ever yields more than two lines, a longer
  string balances at the space nearest the middle, padding is tolerated, and
  every word survives in order. The strings are taken from the corpus plans,
  not invented.
- **Not covered by any test, and only exercised by a real AE run**: the
  measurement itself, the decision to break, the re-measurement, the per-line
  widths, and the baseline check. Nothing outside a running After Effects can
  produce a `sourceRectAtTime`, so there is no unit under test. The evidence
  for those is the survey and the built reel, both run for real this session.

**Goal 1.6 — the survey.** `npm run wrap:survey`, emitted to
`benchmarks/RESULTS-block7-wrapping.md` by the tool. **193 cards in 2.9 s.**
Measuring every card is not a cost a production build has to design around.
It uses one scratch duplicate per template with the text swapped between cards,
rather than 194 duplications; `library.aep` is opened as an import source and
never written.

| reel | cards | one line | wrapped | single word over | widest card | width |
|---|---:|---:|---:|---:|---|---:|
| ground-truth | 40 | 27 | 13 | 0 | g013 "les polynucléotides" | 3184.8 |
| test-1 | 43 | 35 | 8 | 0 | k002 "محفزات الكولاجين" | 3471.2 |
| test-2 | 38 | 25 | 13 | 0 | g014 "acide hyaluronique" | 3126.9 |
| test-3 | 31 | 21 | 10 | 0 | g012 "l'acide hyaluronique" | 3318.0 |
| vitasilk | 41 | 32 | 9 | 0 | g027 "dernière génération" | 3228.2 |
| **all** | **193** | **140** | **53** | **0** | — | — |

**The case the ruling does not cover never arises as a whole card.** Every card
that exceeded the bound had a space to break at — zero single-word cards
overflow. It arises one level down instead: **7 cards still have one line over
the bound after breaking**, and every one is a single long word.

| reel | card | text | which line |
|---|---|---|---|
| ground-truth | g013 | les polynucléotides | line 2 |
| ground-truth | g027 | mésothérapie li | line 1 |
| test-2 | g014 | acide hyaluronique | line 2 |
| test-3 | g004 | mésothérapie dial | line 1 |
| test-3 | g010 | hadi mésothérapie | line 2 |
| test-3 | g012 | l'acide hyaluronique | line 2 |
| vitasilk | g040 | matrddadich wla | line 1 |

They are emitted whole and flagged. **Nothing is shrunk, nothing is broken
mid-word, and this is the conversation's to settle** — the ruling covers a card
too wide to fit, not a word too wide to fit.

**Goal 1.4 — wrapping does not move the baseline, and the obvious test for
that would have been wrong.**

The naive comparison — the one-line rect's `top` against the wrapped rect's
`top` — flags **19 of 53 wrapped cards as having moved**. It is a false alarm,
and it was nearly reported as the stop condition. `top` is the distance from the
anchor to the top of the **ink**, so it moves whenever the break sends the
tallest glyph to line two: vitasilk `g036` "marque Vita" reads -261.4 on one
line and -190.3 wrapped, purely because the capital `V` left line one.

The honest comparison is the wrapped rect's top against **line one measured on
its own**: equal means the two-line block puts line one exactly where that line
alone would sit. By that measure, **the first line does not move on any of the
53 wrapped cards.** The approved baseline at y 2480.4 survives wrapping, and
`EXTRA_LINES_RENDER_BELOW` — until now a reading of AE's behaviour — is
confirmed against real cards. No stop condition fired.

### Goal 2 — a build refuses to run on stale pointers

`service/src/build/preflight.ts`. Before anything is built, every path the plan
references is checked: footage, each slot's chosen candidate (the cutout when
the presentation is `cutout`, the generated image otherwise), every SFX file,
and the template AEP. **Every missing path is collected and reported together**
— one run tells you everything that is wrong — and the build fails.

Proven live against a deliberately broken copy of vitasilk's plan (two
candidate paths pointed at a non-existent directory; the copy was deleted
afterwards and no real plan was touched):

```
MissingBuildInputsError: 2 file(s) the plan references are not on disk; refusing to build a comp with gaps:
  image (card) img001: /Volumes/T7 Shield/gone/images-dead/image.jpg
  image (card) img003: /Volumes/T7 Shield/gone/images-dead2/image.jpg
```

**Goal 2.2, with a deviation.** The check runs in TypeScript **before any
`DoScript`**, so it is a thrown `MissingBuildInputsError` rather than the ES3
`{ok:false, stage, message}` contract. That is deliberate and better: the ES3
contract exists so a failure inside AE returns rather than throwing, and this
failure never reaches AE at all — AE was confirmed untouched after the run. The
structured error carries the count, and every missing path by element id and
kind, which is what the goal asked the message to name.

**Goal 2.3** — four tests in `preflight.test.ts`, one of which asserts the
**exact message text**, not the exit code.

**Goal 2.4 — no plan currently has a dead pointer.** All five audited: 42
references (footage, 20 candidate images, 20 cutouts, 17 SFX files), **0
missing**. Session 4's repair holds.

### Goal 3 — the stale figures, and a third defect behind them

Both tools are free and local; neither can bill.

**Re-running them exposed a defect neither had reported.** Session 4 ran
`migrate:display-timing` **before** `migrate:templates-sfx`, so on
ground-truth, test-2 and test-3 the groups had no `templateId` when display
timing was computed — `floorFor` returned null, nothing extended into silence
and nothing merged, and the stored windows were the speech windows. Recomputing
after assignment fixed it. **A merge creates a new group with no template**, so
the two migrations have an order: display timing first, then assignment. Both
were re-run in that order this session.

| reel | groups before | after merges | unbuildable |
|---|---:|---:|---:|
| ground-truth | 40 | **39** | 2 |
| test-1 | 43 | **42** | 3 |
| test-2 | 38 | **37** | 1 |
| test-3 | 31 | 31 | 0 |
| vitasilk | 41 | 41 | 1 |

**Goal 3.2 — the two now agree.** Both conditions that made them incomparable
are gone: every plan carries display timing, and every group carries a
`templateId`.

| | published (Block 6) | now |
|---|---|---|
| `timing-budget`, loosest cell | 7 of 190 unbuildable | **7 of 190** (183/190) |
| `validate-plan`, subtitle groups | 11, on 2 of 5 reels | **7, across all 5** |
| `validate-plan`, keywords | not reported | **1** (test-1 `k001`, 0.18 s of 0.23 s) |
| `timing-budget`, keywords | — | **1** (test-1, 1/2) |

Per reel, `validate-plan`: ground-truth 2, test-1 3 subtitle + 1 keyword,
test-2 1, test-3 0, vitasilk 1. `timing-budget` at 0.13/0.10: ground-truth
37/39, test-1 39/42, test-2 36/37, test-3 31/31, vitasilk 40/41 — the same 7.
**The residual difference is scope, not disagreement**: `validate-plan` also
checks image slots and template-manifest membership, which the timing grid does
not.

Every movement accounted for: the drop from 11 to 7 is display timing
extending cards into silence (vitasilk went 5 → 1); the appearance of figures
for three reels that previously reported none is those reels now carrying
template ids; the merge counts falling to 0 at the loosest cell is those merges
now being baked into the stored plans rather than re-derived each sweep.

**Goal 3.3 — what was updated and what was left.** Two current claims in
`CLAUDE.md` are corrected: the Block 6 session 7 paragraph now says the
condition was removed, and the "deliberately left open" bullet is struck
through and marked closed. `benchmarks/RESULTS-block6-timing-budget.md` is
regenerated. **Left standing deliberately**: `handoffs/block-6.md` and
`reports/block-6-session-7.md`, `block-7-session-1.md`, `-2` and `-3`, all of
which repeat the 11-versus-7 figure. Handoffs and session reports are
historical records of what was true when written and are never rewritten.

### Goal 4 — both arms rebuilt with wrapping

`.local/build/vitasilk-full.aep`, gitignored via `.gitignore:1`.

| | `master_vitasilk_A` | `master_vitasilk_C` |
|---|---:|---:|
| subtitle instances | 38 | 38 |
| keyword instances | 3 | 3 |
| image instances | 5 | 5 |
| audio layers | 8 | 8 |
| **total layers** | **55** | **55** |

46 elements, **0 skipped**, pre-flight passed on 15 referenced files, build
wall clock **1.3 s**. The two arms still differ in exactly one thing —
subtitle out-points — and the check that throws if in-point or position
differs anywhere is still in place and did not fire.

**9 of vitasilk's 41 cards wrapped:**

| card | kind | text | one line | wrapped | line 1 | line 2 |
|---|---|---|---:|---:|---:|---:|
| g004 | subtitle | minutes ymkn | 2283.4 | 1290.3 | 1290.3 | 886.1 |
| k001 | keyword | filler glow | 2001.3 | 958.5 | 908.9 | 958.5 |
| g023 | subtitle | vitamines et | 2008.1 | 1589.9 | 1589.9 | 302.8 |
| g027 | subtitle | dernière génération | 3228.2 | 1751.5 | 1361.1 | 1751.5 |
| g029 | subtitle | brésilien chno | 2292.8 | 1369.7 | 1369.7 | 798.7 |
| g030 | subtitle | katsnay bach | 2166.2 | 1272.2 | 1272.2 | 777.9 |
| g033 | subtitle | la9rab salon | 1984.1 | 1012.3 | 1012.3 | 856.0 |
| g036 | subtitle | marque Vita | 1960.5 | 1223.9 | 1223.9 | 627.5 |
| g040 | subtitle | matrddadich wla | 2709.0 | 2048.0 | **2048.0** | 544.1 |

**One card could not be made to fit: `g040`.** Line 1 is the single word
`matrddadich` at 2048 px against a 1940 bound — 108 px over. It is on screen
whole and flagged, per the ruling's silence on single words.

**Nothing else failed to build.** No group was skipped: 41 groups less the 3
superseded by keywords is the 38 placed, and the 3 keywords render in their
place per Block 3 decision 9.

The playhead is parked on **`g004` "minutes ymkn" at 2.609 s** in
`master_vitasilk_C` — a card that wrapped cleanly. It is chosen **inside AE
after measuring**, since nothing outside knows which cards wrapped; that was a
small builder change and is committed.

## Deviations

1. **The pre-flight failure is a TypeScript error, not the ES3 contract.** Goal
   2.2 asked for the structured JSX error. The check runs before any
   `DoScript`, so nothing in AE can report it — failing earlier is strictly
   better and AE was confirmed untouched. The error still names the count and
   every path.

2. **The baseline test in goal 1.4 is not the comparison the goal implies.**
   Comparing the one-line rect's top against the wrapped rect's top flags 19 of
   53 and is wrong, because `top` tracks the tallest glyph rather than the
   baseline. The report gives both numbers and says which one means anything.
   Had the naive figure been taken at face value, this session would have
   stopped with `Status: PROBLEM — wrapping moved the baseline` on a
   measurement artefact.

3. **Goal 3 required re-running two migrations, not just re-reading figures.**
   The published numbers were stale for a reason nobody had recorded: display
   timing had been computed before templates existed. Re-running was the only
   way to produce figures that mean anything, and it is free.

4. **A builder change was committed under goal 4**, which said not to
   manufacture one. Parking on a wrapped card required the choice to be made
   inside AE, because measurement is the only thing that knows which cards
   wrapped. It is a real change, not a manufactured commit.

## Failures & open problems

- **Seven cards have a line that still exceeds the bound, and the ruling does
  not cover them.** All are single long words: `polynucléotides`,
  `mésothérapie` ×2, `hyaluronique` ×2, `l'acide hyaluronique`, `matrddadich`.
  The options — shrink that card only, allow a hyphenated break, raise
  `SUBTITLE_SAFE_WIDTH`, or accept the overhang — are a product decision and
  nothing was chosen.

- **`SUBTITLE_SAFE_WIDTH` is a guess.** 1940 was picked, not measured. 53 of
  193 cards wrap at that value; a different bound would give a different
  number, and nobody has looked at whether 110 px of margin reads right.

- **The measuring half has no tests and cannot have any.** Everything from
  `sourceRectAtTime` onward is exercised only by the survey and the built reel.
  If AE changes behaviour, `npm run check` will not notice.

- **Wrapping was never checked against a two-line Arabic card on screen.** The
  survey measured `sub_pop_ar` and `kw_slam_ar` cards and they wrapped, but
  vitasilk is all Latin, so the built reel contains no Arabic card at all.
  Right-to-left line order on a wrapped Arabic card is untested by eye.

- **The keyword vertical position is still unverified.** `textCompPosition` is
  applied to keywords using `kw_slam`'s own audited baseline, which is correct
  by construction, but Block 6's `KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` assumption
  has still never been checked against a built comp.

- **The SFX layers have still never been heard**, and the gains (−20 dB hits,
  −24 dB whooshes) are unjudged.

- **ground-truth, test-2 and test-3 still have no keywords** — the keyword
  stage has never run on them and running it bills.

- **The frame-rate mismatch persists**: library comps store 29.9700012207031, a
  master built from 30000/1001 stores 29.9700317382812. Harmless at 25 s,
  unchecked at 90.

- Carried forward: whole-term grouping is unimplemented (11 §6 terms render
  split); the pipeline is 4K-only; the built reel uses first candidates
  regardless of the image gate's verdict, and that gate passed only 2 of 10 on
  vitasilk.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 5 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit that contains it.
- Commits this session, in order: `feat: measure text in after effects and wrap
  to two lines`; `docs: survey how wide every card renders`; `fix: refuse to
  build when a referenced file is missing`; `docs: refresh the figures the
  migrations made stale`; `feat: park the playhead on a wrapped card after a
  build`; `docs: record block 7 session 5 in the operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **975 passed** across
  69 files (core 151 / 6, service 658 / 47, benchmarks 166 / 16); Python **141
  passed**. `validate-templates: 6 template(s) ok`; all four references
  `v1.0.8-conformant`; both model pins ok.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — identical
  to the start-of-session values. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical. Opened only as an import source, never written.
- After Effects: **1 instance at start and end**, PID 44015, unchanged.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

The reel is now complete enough that the two things blocking it are both
judgements, not code. The first is the retiming question the A and C comps
exist to settle, which has been waiting since session 4 and needs nothing but
someone watching both. The second arrived this session: seven cards across the
corpus contain a word that is simply wider than the frame allows, and the
ruling that produced wrapping is silent on them — the choices are to shrink
that one card, allow a hyphen, widen the bound, or let the word overhang, and
each of those is a look rather than an argument. Both can be answered in the
same sitting in front of the built comp, and answering them is what turns this
from a pipeline that produces a reel into one that produces the right reel.
