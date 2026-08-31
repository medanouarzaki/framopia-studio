Status: OK

# Block 10 session 19 — the shadow follows the client, not the template

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`**,
**`templates/library.aep` `1d7553e894…` — identical at both ends**, cache **46
entries / 79 files / 55,363,681 bytes**, all five Edit Plans and all six
hand-made references byte-identical, **`modes/k2-syndicalia.json` untouched and
no colour value changed**. After Effects **pid 79146**, **445 families / 1198 raw
/ 1188 distinct** at both ends. Free space **173.1 GB**.

**The shadow takes the client's `primary`, K2's output did not move by a single
field, and it was shown adapting on all four template kinds.**

---

## Done

### 1. The shadow takes the client's deeper colour

**§1.1 — `textColours.shadow` was declared for exactly this and used it.** No
parallel mechanism. It was declared in `ModeTextColours` (`core/src/mode.ts:163`)
as the role for "the shadow copy drawn behind a word, where a template has one",
resolved by `resolveTextColours` into `ResolvedTextColours.shadow`, and carried
into `ClientSnapshot` by `snapshotOfMode`. **Nothing read it** — its own doc said
"recorded and not yet wired through to the build".

What changed is its default. Absent used to mean *leave the template's colour
alone*; it now means **`primary`**. Naming a role still overrides it.

**§1.2 — the same route the placeholder's fill already takes.**
`resolveTextColours` → `textStyleFor` → `TextStyle.shadowFillColor` → the
`shadowStyle` that `build-reel.jsx` already passes to `framopiaSetText` beside
the text and the size. The colour joins the two properties that were already
written together.

**§1.3 — read back and asserted, not assumed.** `framopiaReadTextStyle` now
returns `fillColor` **and `applyFill`**, because a carried fill that is not
applied draws nothing — the trap Block 9 session 6 recorded. The build compares
the shadow's colour against what it asked for and **throws naming both**, in the
same block that already refuses a shadow whose size or text disagrees. Four
source-read tests pin that the set and the read-back are both there.

**§1.4 — which case can actually occur.** A client cannot lack `primary`:
`validateMode` requires all four roles, and session 15 made a plan with no client
identity refuse the build outright. The one real case is **a client with no
measured font names** — `textStyleFor` returns null for them, so no font, no
size and now no shadow colour is set, and the template's own stands. That is the
behaviour every build had before Block 9 session 6, and a test pins it.

**§1.5 — the stale comment is gone.** `reel-plan.ts:45` said the shadow was
"never given a colour — the shadow's own is the design", and the equivalent
comment in `build-reel.jsx` said the same at more length. Both rewritten; a test
fails if either phrase comes back.

**§1.6 — the caption, and the other three.** The fourth said *"depth in the
generated pictures — the shadow behind your words comes from the template, not
from here"*, which was true when session 18 wrote it and false after this. It
now reads **"the shadow behind every word, and depth in the generated
pictures"**. The other three were re-checked against what the code does and are
still accurate.

**The order changed too, by the same rule that set it.** Session 18 put the
colours he sees on every card first. `primary` now draws behind every word, so it
moved from last to third:

| | hex | caption |
|---|---|---|
| 1 | `#F8F6F2` | your ordinary subtitle words, and usually the frame round a picture |
| 2 | `#C9A96E` | the words you emphasise |
| 3 | `#820000` | **the shadow behind every word, and depth in the generated pictures** |
| 4 | `#1A0000` | behind a cut-out picture, and the ground the generated pictures are lit against |

Still one declaration in `core/src/palette-meaning.ts`, read by both the setup
screen and the client card.

### 2. The template was not edited

`templates/library.aep` sha256 is
`1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` at both ends
of the session, checked after every build.

**No stop condition was hit, and the reason is structural rather than lucky.**
`build-reel.jsx` works on `template.duplicate()` — line 175 — so the fill is set
on a duplicated instance inside the built project. The library comp is opened as
an import source and never written. Nothing about this change needed a template
property that only exists on the original.

### 3. K2 does not move, and another client does

**§3.1–3.3 — the check the ruling turns on.**

```
golden: 4 of 4 reels matched, field for field
  ok    test-1    4414 fields identical
  ok    test-2    4279 fields identical
  ok    test-3    3708 fields identical
  ok    vitasilk  4769 fields identical
```

**17,170 fields, zero differing**, against the reference recorded in session 15
and **not re-recorded**. Run twice — once after the code change and once after
the caption change — with the same result both times. The golden census records
the fill colour of every text layer including every shadow, so a shadow coming
out at any other value would have failed it.

**§3.4 — and it was shown adapting, because passing an identical-value check
does not prove the new path ran.** `test-2` — the one reel that carries all four
template kinds — was built against a scratch client whose `primary` is
`#00A0FF`, a colour nothing else in this project uses. The scratch plan was
written outside the repository; **no real plan and no mode file was touched**,
and `test 2.editplan.json`'s sha256 is unchanged.

Read back from that comp:

| template | placeholder | shadow | count |
|---|---|---|---:|
| `sub_pop` | `#F8F6F2` | **`#00A0FF`** | 59 |
| `sub_pop_ar` | `#F8F6F2` | **`#00A0FF`** | 5 |
| `kw_slam` | `#C9A96E` | **`#00A0FF`** | 1 |
| `kw_slam_ar` | `#C9A96E` | **`#00A0FF`** | 2 |

**All 67 shadows took the client's colour; every placeholder kept crème or
gold.** All four template kinds covered.

**§3.5 — the counts.** Across the corpus's four reels, **262 shadow layers are
unchanged** for K2 — that is what the golden run's zero differing fields means.
On the probe, **67 changed** and 0 did not.

The probe's `.aep` and its shrink record were build artifacts I created, and are
removed; the four real builds in `.local/build/` are the golden run's own, which
is where they were before.

---

## Deviations

**None.** No template was edited, no colour value or mode file changed, no fifth
swatch was added, the shadow's offset and blur were not touched, no billable
stage ran, and no cache entry, Edit Plan, generated image or hand-made reference
changed. The shadow colour, the caption and the reports are three commits.

**Tests rewritten rather than left asserting retired behaviour**, named as §7
requires:

- `core/src/palette-meaning.test.ts` — *"does not claim the shadow comes from the
  palette"* became *"names the shadow, which is what primary now draws"*; the
  order assertion moved from `background, primary` to `primary, background`.
- `panel/src/render.browser.test.ts` — the swatch order and the fourth caption.
- `core/src/audit-safety.test.ts` gained a test that fails if either retired
  comment returns.

**One thing found and deliberately not fixed.** `render.browser.test.ts:732`
builds its fixture paths as `cutouts/img001-c1.cutout.png`, and its own comment
says those are "paths that exist, so the error never fires". **They do not
exist** — session 12 moved cutouts into `cutouts/<plan stem>/` and these were
never updated. The test passes anyway because it asserts on the URL string
rather than on the image loading, so its premise is false while it is green. Not
this session's to fix, and reported rather than quietly corrected.

## Failures & open problems

**Unproven, by name:**

- **Nobody has looked at a built comp.** The shadow's colour is read back out of
  After Effects and compared, and the golden census confirms all 262 are
  unchanged — but no one has seen a card. What is proven is that the numbers did
  not move.
- **The `#00A0FF` probe was censused, not viewed.** The fills were read from the
  comp; whether a blue shadow behind crème type looks like anything was not
  judged.
- **The caption has not been seen on screen.** It is asserted in a browser test
  driving the real bundle, which is not his eye in After Effects.
- **The client-with-no-measured-faces case is covered only by unit test.** No
  such client exists to build.

**Open:**

- **`textColours.shadow` is not pinned into a snapshot when a client leaves it
  blank.** `snapshotOfMode` writes `ordinary` and `emphasis` with their defaults
  but only writes `shadow` when named, so a future change to the default would
  move an old reel that never named one. It costs nothing today — K2 names it
  explicitly and all three pinned snapshots carry `shadow: 'primary'`, and none
  reports itself behind — and closing it means adding a key to every fresh
  snapshot, which would make every already-pinned reel compare unequal and fire
  the "client has moved on" banner. That is the spurious-warning failure Block 9
  session 13 fixed, so it is a ruling rather than a patch.
- The panel suite flaked once more under `npm run check`'s parallel load, on the
  image-picker test above, and passed alone and on a second full run. The
  5000 ms timeout is still unmeasured.
- `ground-truth` still unbuildable, the build guard still needs a ruling, and 14
  historical commits still carry an attribution trailer. Unchanged.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `078ebc7` *docs: retire the caption that pointed at the template* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` — **identical at start and end** |
| cache | **46 entries / 79 files / 55,363,681 bytes** |
| fonts | **445 families / 1198 raw / 1188 distinct** at start and end |
| After Effects | pid **79146**, 0 `aerender` |
| the user's project | `.local/build/vitasilk-full.aep`, **open and clean, 97 items** — the state he left it in. It was rebuilt by the golden run, byte-for-byte the same comp, and is the last thing After Effects was left holding. |
| free space | **173.1 GB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references, sha256, identical at start and end:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Edit Plans, sha256, identical at start and end:**

```
0712e4124d8b5f09641de4ed4276897f3c8cb6781e705df64d49c84dc5db7034  ground truth.editplan.json
1acf10bf06925473c501f30b8ebb290c5fa8f091fcc5ca32485e1ff316221e35  test 1.editplan.json
94da6dd60af1d138a87e1c8f2cc235f542014605d14c4795f165d35c11d27f0a  test 2.editplan.json
dbf28f9bafb55b126d97076b16df56baa1a2d7775343dc07ed6af83468302594  test 3.editplan.json
c8501bcafc79ed3bd74fec776a2401efa8e68caab41cea5b8d2d1ac221c63c20  vitasilk.editplan.json
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 728 | **735** |
| service | 1180 | **1184** |
| benchmarks | 173 | **173** |
| panel | 190 + 2 skipped | **190 + 2 skipped** |
| modes | `mode k2-syndicalia v12: ok (fonts set)` | unchanged |
| references | `6 hand-made reference file(s): 4 transcript, 2 alignment` · `PASS` | unchanged |
| attribution | `PASS` | `753 tracked text file(s), 687 commit message(s)` · `PASS` |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| ExtendScript | 15 `.jsx` ok | unchanged |

Core +7: five in the new `text-colours.test.ts`, two in `audit-safety.test.ts`.
Service +4: `text-style.test.ts`. Panel unchanged — three assertions there were
rewritten rather than added.

## Suggested next step

**The thing to check is that nothing changed.** After Effects is holding
`.local/build/vitasilk-full.aep`, rebuilt this session and identical to what it
held before.

1. **Look at any subtitle card.** The word should be crème with the red shadow
   offset down and to the right exactly as it was — same colour, same offset,
   same blur. That colour now comes from K2's own `#820000` rather than the
   template's, and the whole point of the ruling is that he cannot tell.
2. **Look at a keyword** — `filler glow`, `Vita Silk`. Gold word, same red
   shadow.
3. **Then the client setup screen**, panel → client picker → *"Set up a new
   client…"* → **Their colours**. The third swatch is now `#820000` and reads
   *"the shadow behind every word, and depth in the generated pictures"* — it
   moved up from fourth because it now draws something he sees on every card. The
   caption that said the shadow came from the template is gone, because it no
   longer does.
4. **The same four captions appear on the client card** on the main screen once a
   client is picked, and should read identically.

If a card's shadow looks any different from before, that is the finding — the
values are identical by construction and nothing should have moved.

## Commits

| | |
|---|---|
| `e6d6057` | `feat: the shadow takes the client's deeper colour` |
| `078ebc7` | `docs: retire the caption that pointed at the template` |
| this one | these reports |
