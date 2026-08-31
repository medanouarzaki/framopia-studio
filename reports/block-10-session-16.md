Status: OK

# Block 10 session 16 — setting up a client: nothing typed that can be chosen

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. `templates/library.aep` `1d7553e894…`, cache
**46 entries / 79 files / 55,363,681 bytes**, all five Edit Plans and all six
hand-made references byte-identical. **`modes/k2-syndicalia.json` untouched.**
After Effects **pid 79146** throughout, **445 families / 1,198 face names** at
both ends; the user's own `.local/build/vitasilk-full.aep` open and clean at
start and end. Free space **173.2 GB**.

All four rulings are implemented. **None has been seen working by a person** —
they are covered by nine new browser tests driving the real built bundle in
Chromium, which is not the same as his eye on it in After Effects, and the last
section names exactly what to open.

---

## Done

### 1. Every path is picked, never typed

**The inventory, taken before anything changed.** Every place in the product
where a user supplies a path:

| where | file | line | before |
|---|---|---:|---|
| the video picker | `panel/src/App.tsx` | 337, 481 | **already a chooser** — `pickVideoFile` behind a *Browse…* that appears only when the call is really there. Its typed field went in Block 8 session 44. |
| client setup · Video folder | `panel/src/NewClient.tsx` | 99 | **typed** — *"The full path to where their footage lives."* |
| client setup · Logo | `panel/src/NewClient.tsx` | 137 | **typed** — *"The full path to their logo."* |

**And nothing else.** Four `<input>` elements exist in the whole panel: those
two, the watermark checkbox, and the transcript editor's word text. The image
editor offers a client's pictures but takes no path — adding one to a client is
not a panel control at all today, which is the gap named under *what still
cannot be set here*. The watermark is an asset of this repository, not a field.

**The mechanism was read first and reused, not reinvented.** CEP's
`window.cep.fs.showOpenDialogEx` is what the video picker has used since Block 8
session 44, and **`chooseDirectory` is its second argument** — so a folder
chooser and a file chooser are the same call. `pickFolder` and `pickImageFile`
join `pickVideoFile` in `panel/src/file-dialog.ts`, all three through one private
`pick()`.

- **A cancel leaves the field exactly as it was.** All three answer null for a
  cancel *and* for a host with no dialog, and at the call site null means "he
  chose nothing", never "clear what he had". Asserted in the browser: pick a
  folder, then cancel, and the first path is still there.
- **The chosen path is still shown** beneath the button, and remains correctable
  — but it is not the thing he has to produce.
- **The field falls back to a text input only where the chooser genuinely is
  absent**, with a sentence saying so. That host is a real case for the second
  machine, and this project has been wrong about the host five times.
- **Paths are stored as they always were.** Nothing here writes a path
  differently; `POST /clients` puts them on the mode file and every reader goes
  through `resolveStoredPath`, so a path inside the repository is re-rooted on
  another machine and one outside it stays absolute.

**`panel/src/path-fields.test.ts` pins the rule by reading the source**, the
shape sessions 8 and 11 used for repo-wide rules: every `<input type="text">` in
every `.tsx` whose `aria-label` names a path, folder, directory, logo or file
fails unless it is inside `PathField`. A new screen with a typed path field fails
here rather than reaching him.

### 2. Fonts are a list, in the names a build can use

`GET /fonts` → `fontListView()` → `runFontList()` → `panel/jsx/font-list.jsx`,
driving the running After Effects through the same `runJsx` the builder uses.

**Read live this session: 445 families, 1,188 distinct names**, and all three K2
faces present under After Effects' own spellings — `Inter-SemiBold`,
`Almarai-Bold`, `CormorantGaramondItalic-SemiBoldItalic`.

**The names have to be After Effects' own.** Session 12 measured that macOS
publishes `Inter-Regular_SemiBold` and `CormorantGaramond-SemiBoldItalic` for
those same files, because both are variable fonts and After Effects constructs
its own name for an instance. A list built from the system would offer names no
build can set.

**Nothing writes a font to build the list.** Setting a name that is not installed
adds it to `app.fonts.allFonts` for the rest of the application session, so a
reader that wrote would corrupt what the next reader sees.

**Two fields, Latin and Arabic**, each opening on *"The standard one"* — blank
still means Inter Semi-Bold and Almarai Bold, exactly as before.

**A list that cannot be built is said out loud.** `available: false` carries the
reason in the words the panel prints, the field falls back to text, and the hint
gains *"The list of faces could not be built — <why>. Type the name After Effects
uses."* An empty chooser and an unfillable one look identical on screen and mean
opposite things; a service too old to answer, and After Effects not answering at
all, both land here rather than as an empty list.

**§2.3, the sample set in itself: built, and honestly qualified.** A line beneath
each field renders sample text with `fontFamily` set to the chosen name — the
same thing the client card already does for a client's type. **It is drawn by the
panel's Chromium, which resolves font names its own way**, so a name it cannot
match falls back to the standard face. The choice is still correct; only the
preview is approximate, and the code says so. Whether any particular face renders
in it has **not been observed** — see the unproven list.

### 3. Subtitle height is a slider over a real frame

`GET /subtitle-preview` finds a frame the pipeline already extracted —
`.local/cv/<stem>/frames-2fps/`, the middle frame of the first reel that has one,
chosen deterministically so the screen does not change between openings. It
resolved to `.local/cv/ground truth/frames-2fps/frame-0023.png` this session.

- **The line is drawn at `baselineY / 3840` of the preview's height**, over the
  frame, and moves with the slider. Asserted in the browser at the default and at
  3000 px.
- **The number follows and stays visible**, and stays directly editable for
  someone who knows the figure. A *Use the usual* control appears once he has
  moved it.
- **The default is read from `SUBTITLE_ANCHOR_BASELINE_Y`**, 2480.4, through the
  service — no number is typed into this screen's source.
- **Blank still means the default**, as before.
- **The preview is honest about what it is.** With a frame it says *"A real frame
  from ground truth."*; with none it says *"No footage to show yet, so this is a
  plain 2160 × 3840 frame."* — never a plain frame presented as footage. Both
  asserted. It also states the scale: the frame is drawn 216 px wide against a
  2160 px source, and the sentence says *"Shown at about a tenth of 2160 × 3840"*.

### 4. The four colours are on the screen

The sentence *"Colours and their own pictures are added afterwards, once the
client exists"* is gone, and with it the two-visit setup.

- **Four fields**, each an `<input type="color">` swatch he picks with its hex
  beside it, labelled with the role in the words `service/src/catalogue.ts`
  already uses on the client card: *behind a cut-out picture*, *the deeper of the
  two frame colours*, *the frame around a picture*, *the lighter of the two frame
  colours*. Kept identical so a colour means the same thing on the screen that
  sets it and the screen that shows it.
- **The defaults are what the tool does today.** Verified against `buildClient`
  rather than assumed: a client saved with no colours and a client saved with
  what this screen now sends produce **identical palettes**, and both equal K2
  Syndicalia's four ruled values —
  `#1A0000`, `#820000`, `#C9A96E`, `#F8F6F2`. **`modes/k2-syndicalia.json` was
  not touched**, and `git diff` over `modes/` is empty.
- `POST /clients` **already accepted `palette`**; the panel had simply never sent
  it. No service change was needed for this one.

**What still cannot be set here, and why:** a client's **own pictures**. That is
genuinely later rather than missing — a picture is chosen per video, against the
moment it illustrates, and there is nothing to point at until the client has
footage. The screen now says that instead of lumping it with the colours.
Everything else on `ClientMode` that the panel exposes — name, note, video
folder, both fonts, language, logo, video shape, subtitle height, watermark
default, and the four colours — is set in one pass.

---

## Deviations

**One, and it is about commits rather than code.** §9 asks for the font list, the
height slider and the colours as separate commits. They landed as one,
`ce6b835` *feat: complete a client in one pass, by eye*, because all three change
the same three files — `NewClient.tsx`, `panel.css` and the browser tests — and
splitting them would have meant patch-level staging of interleaved hunks. My
first attempt committed all three under a message naming only the fonts; I reset
it and rewrote the message rather than leaving a commit that misdescribed its own
contents. The path pickers and the documentation are separate as asked.

**One thing noticed and not fixed, as §5 directs.** The panel asks for a value
the machine already knows in one more place: the **Note** field on the same
screen suggests *"Dermatologist, Casablanca"*, which is genuinely his to write.
Nothing else was found — the video shape, language and watermark are already
pickers, and the client picker is a `<select>`. **No other typed-where-choosable
field exists in the panel today.**

Nothing else outside the four deliverables was touched. No billable stage ran,
no reel was built, the pre-build save and the build guard are untouched, and no
ruled constant, mode file, template, cache entry, Edit Plan, generated image or
hand-made reference changed.

## Failures & open problems

**Unproven, by name:**

- **No part of this screen has been seen by a person.** Nine browser tests drive
  the real built bundle in Chromium and assert what is on it, which is not the
  same as his eye on it inside After Effects. Everything below follows from that.
- **The font sample rendering has never been observed.** The element exists with
  the right `font-family`; whether Chromium 99 inside CEP resolves After Effects'
  constructed names — `CormorantGaramondItalic-SemiBoldItalic` in particular — is
  unknown, and session 12's measurement suggests it may not.
- **`GET /fonts` has never been called from the panel inside After Effects.** It
  was exercised in-process here and returns 1,188 names; the panel's own fetch is
  covered only against a stub.
- **The colour input has never been opened.** `<input type="color">` is Chrome 20
  and well inside CEP's Chromium 99, but the native picker it opens on macOS
  inside a CEP panel has not been seen.
- **The choosers have never opened a real Finder dialog.** They are the same call
  the video picker uses and which the user exercised on 2026-08-31, but
  `chooseDirectory: true` specifically has not been run against a real host.
- **The frame preview has never been drawn from a real file.** The browser test
  points at a path that does not exist, so it asserts the sentence and the line
  position, not that the image loads.

**Open:**

- **A client's own pictures still cannot be added from the panel** — stated on
  the screen as later work rather than hidden.
- **The panel browser suite flaked once again under load.** `says a picture is
  gone only when the service says it is gone` timed out in the first full
  `npm run check`, passed alone, and passed in the second full run. The same
  contention shape sessions 14 and 15 recorded; the 5000 ms timeout is untouched
  by instruction and still wants a measured contention factor.
- Everything session 15 left open is unchanged: `ground-truth` unbuildable, the
  golden reference still one machine's output, the build guard and the panel
  timeout each needing a ruling, and 14 historical commits carrying an
  attribution trailer.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `9b5ab37` *docs: record the four setup-screen rulings* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| cache | **46 entries / 79 files / 55,363,681 bytes** |
| fonts | **445 families / 1,198 face names** at start and end |
| After Effects | pid **79146**, 0 `aerender`; the user's `vitasilk-full.aep` open, clean, 97 items |
| free space | **173.2 GB** |
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

**`npm run check`: PASS** (exit 0), counts read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 720 | **720** |
| service | 1180 | **1180** |
| benchmarks | 173 | **173** |
| panel | 159 + 2 skipped | **172 + 2 skipped** |
| modes | — | `mode k2-syndicalia v12: ok (fonts set)` |
| references | `6 hand-made reference file(s): 4 transcript, 2 alignment` · `PASS` | unchanged |
| attribution | — | `741 tracked text file(s), 677 commit message(s), 6 marker patterns` · `PASS` |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| ExtendScript | 14 `.jsx` ok | **15 `.jsx` ok** |
| panel manifest | `manifest.xml ok` | unchanged |

Panel +13: four in `path-fields.test.ts` and nine in `render.browser.test.ts`.

## Suggested next step

**Put the screen in front of him.** Everything here is a judgement about how it
looks and feels, and none of it has been looked at.

In the panel — **Window → Extensions → Framopia Studio** — the client picker's
last entry is **"Set up a new client…"**. That opens it. What is worth his eye,
in order:

1. **Video folder** and **Logo** are buttons now. Whether *Choose folder…* opens
   a real Finder folder chooser, and whether the path underneath reads well or
   should be shortened.
2. **Latin font** and **Arabic font** are lists of what his After Effects has.
   Whether the sample line beneath actually renders in the face he picked — the
   one thing here most likely not to work.
3. **Subtitle height** is the slider, over a frame from `ground truth`. Whether
   the line lands where he expects at the default, and whether a 216 px preview
   is large enough to judge by.
4. **Their colours** — four swatches at the bottom. Whether the roles read
   clearly and whether picking a colour behaves.

A `Save this client` on that screen writes a real mode file into `modes/`, so it
is worth knowing before he presses it that a client saved and not wanted is a
file to delete by hand.

## Commits

| | |
|---|---|
| `9ac2239` | `feat: choose every path instead of typing it` |
| `ce6b835` | `feat: complete a client in one pass, by eye` |
| `9b5ab37` | `docs: record the four setup-screen rulings` |
| this one | these reports |
