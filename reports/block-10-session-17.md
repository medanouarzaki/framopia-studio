Status: OK

# Block 10 session 17 — a font sample that shows the actual font

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`**,
`templates/library.aep` `1d7553e894…`, cache **46 entries / 79 files /
55,363,681 bytes**, all five Edit Plans and all six hand-made references
byte-identical, `modes/k2-syndicalia.json` untouched — all at both ends. After
Effects **pid 79146** throughout, **445 families / 1198 raw / 1188 distinct**
face names at start and end. The user's `.local/build/vitasilk-full.aep` open
and clean at both ends. Free space **173.1 GB**.

**The sample now draws the face he chose, and says so plainly when it cannot.**

---

## Done

### 1. The sample renders in the real face, or says it cannot

**The mechanism, and why the obvious one is not enough.** The panel is a browser:
it can draw a face only if it can load the file. Matching After Effects' name
against the PostScript name macOS publishes — `system_profiler SPFontsDataType`,
415 files, 3,130 distinct names — resolves **900 of 1188 (75.8%)** and **misses
two of the three faces this studio actually uses**, because `Inter-SemiBold` and
`CormorantGaramondItalic-SemiBoldItalic` are variable-font instances that After
Effects names its own way.

`tools/font-resolve/resolve.py` asks **CoreText** instead, through `ctypes` —
stdlib only, no venv, no wheel — because CoreText owns that naming. JSON in,
JSON out: the CV sidecar's contract.

| | |
|---|---:|
| names offered by After Effects | 1188 |
| **resolve to a real file** | **1164 (98.0%)** |
| resolve to no file | 24 |
| CoreText substitutions returned | **0** |
| time to resolve all 1188 | **0.17 s** |

**What the 24 have in common**: they are registered by an application rather than
installed as a file another process can read. Adobe's own UI faces —
`AdobeClean` ×4, `AdobeCleanUX` ×4, `AdobeCleanHanSC` ×2, `SourceCodePro` ×4 —
plus **Skia's nine named instances** and `EmojiOneColor`. Fourteen of the
twenty-four are Adobe's.

**A substitution is rejected, never returned.** `CTFontDescriptorCreateWithNameAndSize`
answers a descriptor for a name it does not have, so the resolver compares the
name it got back against the name asked for and calls a mismatch unresolvable.
Returning it would be the very defect being fixed.

**The axes are load-bearing, and that was measured rather than assumed.** The
file behind `Inter-SemiBold` is `Inter-VariableFont_opsz,wght.ttf`, whose default
instance is Regular. In Chromium, one string in that one file renders:

| | width at 40 px |
|---|---:|
| `wght 600` — what `Inter-SemiBold` is | **366.89** |
| the file's default, no axes | 352.89 |
| `wght 100` | 325.63 |
| sans-serif fallback | 357.95 |

So without `font-variation-settings` the sample would have been the wrong weight
and still looked plausible — and, worse, closer to the fallback than to the truth.
CoreText returns `wght: 600` exactly, so nothing is inferred from a weight name.

**§1.3 — a face that cannot be resolved says so where the sample would be**, in
his language: *"This font cannot be shown here — the system offers no file for
this font. It will still be used in the composition."* **It never falls back to a
default face.** A test reads the `FontSample` body and fails if `sans-serif` or
`serif` appears in it.

**§1.4 — `AdobeClean-It`, the case he photographed.** It **cannot be resolved**:
CoreText knows the name and offers no file, because Adobe registers it inside its
own applications. So it does **not** now draw in italic — **the field says it
cannot be previewed**, which is the correct outcome and the one this session was
asked to produce. Asserted in the browser: choosing it shows the sentence and
**no sample element is rendered at all**.

**§1.5 — all three K2 faces resolve, and this is not the headline.**

| face | file | axes | drawn |
|---|---|---|---:|
| `Inter-SemiBold` | `~/Library/Fonts/Inter-VariableFont_opsz,wght.ttf` | `wght 600` | 366.89 |
| `CormorantGaramondItalic-SemiBoldItalic` | `~/Library/Fonts/CormorantGaramond-Italic-VariableFont_wght.ttf` | `wght 600` | 289.97 |
| `Almarai-Bold` | `~/Library/Fonts/Almarai-Bold.ttf` | none — static | 218.64 |

**All four files load from `file://`** under the flags CEP's own manifest
declares, and each renders at a width distinct from the fallback — 218.64 for
Almarai on Arabic against a 169.75 fallback. That is a measurement of glyphs
being drawn, not an assertion about CSS.

**§1.6 — the Arabic field samples with Arabic**: `شنو كتعرفي` — "what do you
know" — chosen from the corpus's own speech. It is short enough for the field and
exercises initial, medial and final forms. Arabic has no conventional pangram and
a made-up string would show nothing about a face.

**§1.7 — nothing set a `TextDocument.font`.** The list comes from
`app.fonts.allFonts` and the resolution from CoreText; the family count is
unchanged at 445 and the raw name count at 1198 at both ends of the session.

### 2. The list narrows, and nothing is hidden

The field has a search box above it; typing filters and the list reports
`N of 1188` with *"Nothing is hidden — clear the box for all of them."* Clearing
gives every name back, asserted in the browser by counting options before and
after. The `<select>` opens to 8 rows while filtering so results are visible
without a second click, and stays a normal picker when the box is empty, so
browsing without typing still works.

**Nothing is removed from the list** — Adobe's UI faces included. A hidden font
is a font he cannot choose, and this is his tool for his clients' brands.

**"The standard one" stays first**, pinned by a test comparing its position
against the first generated option.

**§2.4 — the order is left alone, and here is why.** Promoting the three K2 faces
would be right for one client and wrong for the next; promoting recently-chosen
ones needs a store this screen does not have and would reorder the list under him
between visits. Neither rule is better than arbitrary, so alphabetical stands and
search does the work.

### 3. The logo dialog says what it takes

**§3.4 — there was no authority for this anywhere in the repository.** The video
list is mirrored from `service/src/clients/videos.ts` and pinned by a test;
nothing equivalent had ever been written down for still images. Session 16's
list included `svg`, which After Effects does not import as a still. So this is
recorded as a decision in **`docs/PROJECT_SPEC.md` §5** with the date, and
declared once in `panel/src/logo-formats.ts`:

```
png  psd  ai  eps  tif  tiff  tga  jpg  jpeg  gif  bmp
```

PNG with a transparent background is the intended case and the hint says so.

- **The dialog filters to those types**, so an unusable file cannot be chosen.
- **The screen says what it accepts above the button**, in the field's own hint.
- **A chosen file is judged at once.** `judgeLogo` runs on every change and the
  sentence appears immediately, not at build time three steps later.

**One finding that shaped the list: the only consumer of `logoPath` today is the
panel's client card**, which puts it in an `<img>`. No build places it. So the
panel can draw only `png, jpg, jpeg, gif, bmp`, and a legitimate `.psd` is
accepted with *"A .psd works, but this panel cannot show you a preview of one."*
— rather than a refusal, which would contradict the ruling, or a broken image,
which is what happened before.

### 4. 1198 against 1,188, settled

**Measured now, on the same instance neither report restarted**: **445 families,
1198 raw face names, 1188 distinct.**

**Both readings are right and no font appeared or disappeared.** 1198 is the
comma-split count; 1188 is the distinct count. The difference is **10 duplicate
occurrences across 6 names**, each listed under more than one family entry:

```
HalyardMicro-BoldItalic   Helvetica-Light      PingFangHK-Medium
PingFangMO-Medium         PingFangSC-Medium    PingFangTC-Medium
```

Six names accounting for ten occurrences — the PingFang faces appear in several
family entries each. `framopiaInstalledFontNames` does not dedupe, which is what
session 12 measured; `fontListView` does, via `new Set`, which is what session 16
reported. **Neither report is a transcription slip.** Session 16's fault was
reporting a different quantity under the same heading without saying so — the
same shape as the card count it fixed in session 15. Both reports are history and
stay as written; the reconciliation is recorded here and in `CLAUDE.md`.

---

## Deviations

**One, about commits.** §8 asks for the font preview, the search and the logo
formats as separate commits. They landed as one, `3a98a3d`, because all three
change `panel/src/NewClient.tsx` and `panel/src/panel.css`, and the logo hint
imports from `logo-formats.ts` — so a font-only commit would not typecheck. My
first attempt used a message naming only the font sample; I reset it and wrote
one that names all three rather than leave a commit describing half its
contents. Tests and documentation are separate, as asked.

Nothing else outside the four deliverables was touched. No font was hidden or
filtered from the list, no client picture work was started, no billable stage
ran, no reel was built, and no ruled constant, template, cache entry, Edit Plan,
generated image, hand-made reference or mode file changed.

## Failures & open problems

**Unproven, by name:**

- **None of this has been seen in After Effects.** The measurements above were
  taken in Playwright's Chromium, which session 10 established is roughly three
  years newer than CEP 12's Chromium 99. `FontFace` (Chrome 35) and
  `font-variation-settings` (62) are both well inside 99, and the panel's
  capability denylist passes — but **whether a `file://` font loads inside CEP
  has not been observed**, and it is the one thing this session rests on.
- **`AdobeClean-It` italic has not been seen rendering**, and cannot be: it does
  not resolve. What was verified is that the field says so.
- **The 1164 that resolve were not each drawn.** Four were. The other 1160 are
  asserted to have a file and axes, not to render correctly.
- **The logo dialog's type filter has not been opened against a real Finder
  dialog.** The list reaches `showOpenDialogEx`; whether macOS honours it for
  `psd`/`ai`/`eps` is unobserved.
- **`judgeLogo`'s immediate sentence has been seen only against a stubbed
  chooser**, never a real file pick.

**Open:**

- **A client's own pictures still cannot be added from the panel** — its own
  session, as instructed.
- The panel browser suite's 5000 ms timeout is still unmeasured, the build
  guard still needs a ruling, `ground-truth` is still unbuildable, and 14
  historical commits still carry an attribution trailer. All unchanged.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `6def3fa` *docs: record how the font sample resolves its face* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| cache | **46 entries / 79 files / 55,363,681 bytes** |
| fonts | **445 families / 1198 raw / 1188 distinct** at start and end |
| After Effects | pid **79146**, 0 `aerender`; `vitasilk-full.aep` open, clean, 97 items |
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
| core | 720 | **720** |
| service | 1180 | **1180** |
| benchmarks | 173 | **173** |
| panel | 172 + 2 skipped | **190 + 2 skipped** |
| modes | `mode k2-syndicalia v12: ok (fonts set)` | unchanged |
| references | `6 hand-made reference file(s)` · `PASS` | unchanged |
| attribution | `PASS` | `749 tracked text file(s), 682 commit message(s)` · `PASS` |
| templates | `6 template(s) ok` | unchanged |
| ExtendScript | 15 `.jsx` ok | unchanged |

Panel +18: six in `logo-formats.test.ts`, seven in `font-sample.test.ts`, five in
`render.browser.test.ts`.

## Suggested next step

**Open the setup screen again**: panel → client picker → **"Set up a new
client…"**. In order, what is worth his eye:

1. **Latin font** — type `inter` in the box above the list. The list should
   narrow to the Inter faces and say *"N of 1188"*. Pick **Inter-SemiBold**: the
   sample beneath should now be visibly semi-bold Inter, not a plain sans.
2. **The case he photographed** — clear the box, find **AdobeClean-It**. It
   should say *"This font cannot be shown here…"* with **no sample drawn**. That
   is the fix: it is not previewable and no longer pretends to be.
3. **Arabic font** — pick **Almarai-Bold**. The sample should read `شنو كتعرفي`
   in Almarai, right to left.
4. **Cormorant** — pick **CormorantGaramondItalic-SemiBoldItalic**. This is the
   one worth looking hardest at: it should be visibly *italic* and a serif. If it
   is upright or sans, the `file://` font load is not working inside CEP, which
   is the single unproven thing this session rests on.
5. **Logo** — the hint above the button should name PNG first and list the
   accepted types. Choosing a `.psd` should say it works but cannot be previewed;
   the dialog should not offer a `.mov` at all.

## Commits

| | |
|---|---|
| `3a98a3d` | `feat: show the real face, make the list searchable, filter logos` |
| `b174f2d` | `test: pin the sample to the real face and the list to nothing hidden` |
| `6def3fa` | `docs: record how the font sample resolves its face` |
| this one | these reports |
