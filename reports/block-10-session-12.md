Status: OK

# Block 10 session 12 — every reference accounted for, and the font count explained

**An audit. Nothing was changed, fixed, recovered or installed.** No file was
created, moved, renamed, deleted or modified except these two reports.
**Spent $0.00; no API was called.**

**No hand-made reference is missing.** All seven files sessions 5 through 10
recorded are on disk with the sha256 each of those sessions wrote down, and git
shows that nothing under `benchmarks/references` has ever been deleted or
renamed. **The font count is fully reconciled**: 445 and 1198 are the same
reading counted two ways, and the arithmetic is exact.

---

## Done

### 1. Every hand-made reference, accounted for

**The read sites, found in the code rather than assumed.** There are exactly
two, and each names its own directory:

| module | constant | what it points at |
|---|---|---|
| `benchmarks/src/verify-references.ts:10` | `REFERENCE_DIR` | `.local/ground-truth/` |
| `service/src/transcription/protected-entries.ts:34` | `REFERENCE_DIR` | `benchmarks/references/align/` |

A repo-wide search for any other reference directory found none — only
`benchmarks/whisper/.venv/…/torch/ao/nn/quantized/reference`, which is a
vendored PyTorch module and nothing to do with this.

**Everything in both, measured now:**

| sha256 | bytes | modified | file |
|---|---:|---|---|
| `b77495a1b2e060e4…` | 4,004 | 2026-08-27 23:11 | `benchmarks/references/align/README.md` |
| `f32e12dcfad55899…` | 9,309 | 2026-08-27 18:52 | `benchmarks/references/align/vitasilk.json` |
| `10a2e5c2971ed27f…` | 2,427 | 2026-08-27 23:11 | `benchmarks/references/align/vitasilk.rereview.json` |
| `1fbbe2190d734db8…` | 2,256 | 2026-08-25 12:55 | `.local/ground-truth/ground-truth.txt` |
| `b59a6270c3f704bc…` | 1,878 | 2026-08-25 12:55 | `.local/ground-truth/test-1.txt` |
| `9ceea1c47ee94a8c…` | 1,768 | 2026-08-25 12:55 | `.local/ground-truth/test-2.txt` |
| `b5413c215ff32fec…` | 1,455 | 2026-08-25 12:55 | `.local/ground-truth/test-3.txt` |

`.local/ground-truth/` holds four more files that are **not** hand-made: the
four `.json` tagged forms, which `npm run bench:tag` regenerates from the `.txt`
files, plus `listen.html` and a `.DS_Store`.

**Every modification time predates session 5.** The four transcripts have not
been touched since 2026-08-25; the three alignment files since 2026-08-27.
Sessions 5 through 11 — including session 11's `rm -rf` and its recovery from an
ordering error with a live project open — left every one of them alone.

### Git history: nothing has ever been removed

`benchmarks/` is tracked and the whole history of that path is four commits, all
on 2026-08-27:

| commit | what it did |
|---|---|
| `62b8810` *feat: add alignment review sheet* | **A** `align/README.md` |
| `36f94cc` *feat: add the alignment reference scorer* | **M** `align/README.md` |
| `2c711b8` *docs: add hand-made alignment reference for vitasilk* | **A** `align/vitasilk.json` |
| `99faf35` *docs: add the hand-made re-review reference for vitasilk* | **A** `align/vitasilk.rereview.json`, **M** `README.md` |

`git log --all --diff-filter=D` over the reference paths returns **nothing**:
no reference file has ever been deleted. `git log --follow` on each of the three
shows no rename in its history.

**`.local/` is gitignored** (`.gitignore:1`) and **zero files under it have ever
been tracked**, so the four hand-written transcripts have never been in git and
never could be recovered from it. That is the standing finding behind
`npm run backup`, restated here because it is what makes their survival matter.

### Session by session: the number was measured, and it means a file count

| session | what it asserted | what it listed |
|---|---|---|
| 1–4 | no reference-count assertion | — |
| **5** | "All seven hand-made reference files unchanged" | **all seven, by name and sha256** |
| 6 | "All seven hand-made references unchanged"; "seven files, sha256 recorded" | a count, not a list |
| 7 | "seven files, sha256 recorded, all identical at end" | a count |
| 8 | "All seven hand-made references identical" | a count |
| 9 | "All seven hand-made references identical" | a count |
| 10 | "seven hand-made references identical" | a count |
| **11** | "six — four hand-written ground truths and two hand-made alignment references" | a count, and a definition |

**Seven was measured, not carried from a prompt.** Session 5 wrote the table and
said so in its own words: *"The prompt asks for 'the four hand-made references';
there are two distinct sets and both were recorded, because either reading is
defensible."* Its seven sha256 prefixes are `b77495a1`, `f32e12dc`, `10a2e5c2`,
`1fbbe219`, `b59a6270`, `9ceea1c4`, `b5413c21` — **identical to what is on disk
today**. Sessions 6 through 10 then repeated the figure without re-listing it,
which is the weaker habit, but the figure they repeated was a real one.

### Verdict

**Seven exist, and session 11 did not miscount so much as silently redefine.**
All seven are shown above. Session 11's "six" excluded
`benchmarks/references/align/README.md`, which is documentation about the
references rather than a reference — a defensible narrowing, and **its defect is
that it was made in a close-out figure without a word.** A close-out number
whose definition moves between sessions cannot do the job a close-out number is
for, which is to be compared against the previous session's.

**Nothing is missing, so there is nothing to recover and no recovery route to
report.**

### The `references` gate counts four files, and would catch only those four

`scripts/check.sh:42` runs `npm run verify-refs`, which maps over a hardcoded
`REFERENCE_REELS = ['ground-truth','test-1','test-2','test-3']` and, for each,
reads `<reel>.txt` and checks its `# reference-version:` header against a clean
orthography pass. Its own output in this session's run:

```
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
```

**It would catch the deletion of any of the four `.txt` files**, because
`readFileSync` is called unguarded inside the `.map` at
`verify-references.ts:94` and the module contains **zero** occurrences of `try`,
`catch` or `existsSync` — so an absent file is an uncaught `ENOENT` and a
non-zero exit. It would fail as a crash rather than as a named failure, which is
loud but uninformative.

**It would not catch, and nothing else in `npm run check` would either:**

- the deletion of either **alignment reference**. No test anywhere reads
  `benchmarks/references/align/*.json` — searched across every `*.test.ts` in
  `core`, `service`, `benchmarks`, `panel` and `tools`, and the only hit is
  `service/src/backup/secrets.test.ts`, which reads `vitasilk.json` to assert it
  is *not* classified as a secret. Delete both references and `npm run check`
  stays green. They are in git, so they are recoverable — which is the reason the
  gap has cost nothing so far, not a reason it is safe.
- the deletion of any of the four tagged `.json` files.

**Not fixed here**, per §4. Recorded as the gap it is.

*(I did not execute the absent-file case. Three attempts to drive
`verifyAllReferences` at an empty directory failed on `tsx -e` module resolution,
and running it properly would have meant creating a file, which §0.8 forbids in
an audit. The claim above is read from the source, and it is stated that way.)*

### The backup's view reconciles exactly

Computed from `service/src/backup/set.ts` in process — **no backup was run and
nothing was transferred**:

| group | files | bytes | session 10 recorded |
|---|---:|---:|---|
| `ground-truth` | **8** | 30,364 | 8 files / 30 KB ✔ |
| `align-references` | **3** | 15,740 | 3 files / 15 KB ✔ |

**Both of session 10's figures reproduce to the byte.** The apparent
contradiction in the brief — *"3 alignment references, not 2"* — dissolves:
`align-references` is a directory walk
(`walk(benchmarks/references/align)`), so its three files are the two references
**plus the README**. The group is titled "Hand-made alignment references" and
contains one file that is not one.

`ground-truth`'s eight are the four `.txt` and the four `.json`; `walk` skips
`.DS_Store` at `set.ts:48` and the group excludes `.html`, which is why ten files
on disk survey as eight. The four `.json` are regenerable from the four `.txt`,
so the irreplaceable count in that group is **four**.

**So three different true counts are in circulation** — 2 hand-made alignment
references, 3 files in their directory, 7 files across both reference sets — and
no report before this one said which it meant.

---

### 2. Why the font count moved: it did not

**`app.fonts.allFonts` reads 445 now, and the same reading yields 1198.** The
arithmetic, measured in one pass this session:

```
app.fonts.allFonts.length                                   =  445
sum over entries of entry.split(',').length                 = 1198
```

`allFonts` is **not** a list of fonts. Each entry stringifies to one family's
PostScript names joined by commas — the first six entries read
`AcademyEngravedLetPlain`, then
`AdobeClean-Regular,AdobeClean-It,AdobeClean-Bold,AdobeClean-BoldIt`, and so on.
**445 is families; 1198 is faces.**

`panel/jsx/fonts.jsx`'s `framopiaInstalledFontNames` splits on commas and
returns names, which is where 1198 came from in sessions 1 and 5 through 10.
Session 11 used an ad-hoc probe that read `allFonts.length`, which is 445. **Both
numbers are correct measurements of different quantities, and neither session
said which it was counting.** `panel/jsx/fonts.jsx` had already documented the
comma-joined shape in its own header comment since Block 9.

**Nothing moved, and the strongest evidence is the pid.** After Effects is
**79146**, the same instance session 11 recorded and the same one running since
Block 9 session 12. The count could not have changed across a restart because
there has been no restart, and the documented pollution mechanism only ever adds
names.

**The two readings can be reconciled, and the arithmetic is shown above.** No
guess was needed.

### Where each K2 face actually comes from

Read from `system_profiler SPFontsDataType`. **All three are plain font files in
`~/Library/Fonts`. None arrives through Creative Cloud.**

| repo's stored name | file | origin |
|---|---|---|
| `Inter-SemiBold` | `~/Library/Fonts/Inter-VariableFont_opsz,wght.ttf` | user font file, 874,708 B, `0be2399ea925f1f8…` |
| `CormorantGaramondItalic-SemiBoldItalic` | `~/Library/Fonts/CormorantGaramond-Italic-VariableFont_wght.ttf` | user font file, 640,236 B, `387cd7058b72961b…` |
| `Almarai-Bold` | `~/Library/Fonts/Almarai-Bold.ttf` | user font file, 152,744 B, `353c525f8afc461c…` |

**But two of the three names are After Effects' own construction, and macOS does
not publish them.** What CoreText reports for those same files:

| the repo pins | macOS reports | same? |
|---|---|---|
| `Inter-SemiBold` | `Inter-Regular_SemiBold` (family `Inter`) | **no** |
| `CormorantGaramondItalic-SemiBoldItalic` | `CormorantGaramond-SemiBoldItalic` (family `Cormorant Garamond`) | **no** |
| `Almarai-Bold` | `Almarai-Bold` (family `Almarai`) | yes |

Both variable fonts are named differently by After Effects than by the operating
system. This is the mechanism behind a fact `CLAUDE.md` already records without
explaining — *"the emphasis family is `CormorantGaramondItalic`, not
`CormorantGaramond` — a separate family on this machine"*: After Effects derives
its own family name from the italic **file**, and macOS derives it from the
family **metadata**.

**Creative Cloud is running** — `Creative Cloud` (3 processes), `CCXProcess` (2),
`AdobeIPCBroker`, `Core Sync` — and Adobe Fonts is active on this machine, with
**28 synced font files** under
`~/Library/Application Support/Adobe/CoreSync/plugins/livetype`. It supplies
`Inter Tight` and `AdobeClean`, among others. **It supplies none of the three K2
faces.** Font files by location: `/System/Library/Fonts` 372, `~/Library/Fonts`
80, Adobe CoreSync 59, `/Library/Fonts` 1.

### The consequence for the partner

**The font check is a reliable gate, and the install instructions are correct —
but the check cannot be moved outside After Effects.**

Reliable, because `build-reel.jsx`'s `check-fonts` stage asks After Effects
itself, which is the thing that will draw the type, and After Effects accepts an
unresolvable name silently. Asking anything else would answer a different
question.

Correct, because all three faces are ordinary `.ttf` files. `docs/SECOND_MACHINE.md`
telling the partner to double-click and install works for these three, and no
Creative Cloud subscription or font sync is needed for them. **Had any of the
three come from Adobe Fonts this document would have been wrong**, which is why
it was worth measuring.

**The residual risk, named:** the two variable-font names are constructed by After
Effects, not published by the files. Installing the correct file does not
guarantee that a different After Effects build constructs the same name — and
because the doctor cannot see After Effects' naming from macOS's font list, that
divergence would surface only when a build refuses on the partner's machine, with
a name that is correct here and absent there. Nothing was changed; the check
stays as it is.

---

### 3. Two things recorded, not fixed

#### The build guard recognises only its own checkout

`panel/jsx/build-reel.jsx:94`:

```js
var isOurs = openFile !== null && o.buildDir && openFile.fsName.indexOf(o.buildDir) === 0;
if (isDirty && isOurs) { app.project.save(); … }
```

**What it protects:** unsaved work in whatever project After Effects has open.
The build replaces the open project, so a dirty project is a refusal — an
unreadable `dirty` counts as dirty, because refusing costs a re-run and guessing
costs the user's morning. The `isOurs` branch was added in Block 8 session 35,
after the guard stopped the user four times running and the file was the build's
own previous output each time.

**Why it is too narrow:** `o.buildDir` is *this* checkout's `.local/build`, so
two checkouts of the same repository refuse each other's output — session 11 hit
it in both directions. The property the guard actually wants is *"this file is a
build artifact of this tool"*, and it is testing *"this file is a build artifact
of this copy of this tool"*.

**What the rule should probably say instead:** match on the trailing
`.local/build/` segment rather than on an absolute prefix, so any checkout
recognises any checkout's output; or, better, have the builder mark what it
writes and test for the mark, so the answer does not depend on a path at all.
Either is a widening of a guard that exists to protect the user's work, so it
wants a ruling and not a session that wanted to keep going. **Unchanged.**

#### The panel browser tests time out under load

**The six, from session 11's own failing run** — all in
`panel/src/render.browser.test.ts`:

| test | how it failed |
|---|---|
| a pipeline run › shows every stage with its state, in the dry run's words | `Test timed out in 5000ms` |
| the image candidate picker › shows the picture the build will place, not the cut-out of it | `page.waitForSelector: Timeout 5000ms exceeded` |
| the image candidate picker › offers the picture before the background was removed, on a cutout slot only | `page.waitForSelector: Timeout 5000ms` |
| the image candidate picker › still shows the pictures when the service is older than the panel | `AssertionError: expected [] to have a length of 3` |
| the image candidate picker › says a picture is gone only when the service says it is gone | `page.waitForSelector: Timeout 5000ms` |
| the image candidate picker › encodes the spaces in a real path | `page.waitForSelector: Timeout 5000ms` |

**The timeout is 5000 ms and it is vitest's default** — `panel/` has no
`vitest.config` and `package.json` sets no `testTimeout`, so nothing was chosen.
Five of the six are a Playwright `waitForSelector`; the sixth is the whole test
expiring. The one `AssertionError` is the same failure wearing different clothes:
it asserts on a list the page had not yet rendered.

**Idle, the whole file runs 93 tests in 14.8 s**, so the average test is ~160 ms
against a 5000 ms bound — a 30× margin that six tests nonetheless exhausted while
After Effects builds were settling.

**The suite does have a history, in a different file.** `b5adf67` *test: widen
the cutout timeout for a loaded machine*, then `adfa6ca` *test: set the cutout
timeout from a measured contention factor* — Block 7 session 11 measured one
cutout at 18 s idle against 72 s under load and set the bound from the
measurement rather than from a guess. **That is the precedent**: measure the
contention factor on these six, then set a bound that clears it, rather than
widening until it stops failing. **Not done here.**

---

## Deviations

**None.** Nothing was created, moved, renamed, deleted or modified except these
two reports. No project was opened, saved or closed; no font was set, installed
or activated; no backup was run; no billable stage ran.

One thing was *not* executed that the audit would have liked to execute: the
`references` gate's behaviour on an absent file, described above and reported as
read from source rather than as observed.

## Failures & open problems

- **A close-out count changed definition without saying so** (seven files → six
  hand-made references). Nothing was lost, and this report shows all seven, but
  the habit is the defect: sessions 6 through 10 repeated a figure they did not
  re-derive, and session 11 re-derived a different figure without saying it was
  different. **Not fixed here.**
- **`npm run check` cannot see the loss of an alignment reference.** They are the
  only non-circular measure of aligner correctness in this project and nothing in
  the gate reads them. They are in git, which is why the gap has cost nothing.
  **Not fixed here**, per §4.
- **Two of the three K2 font names exist only inside After Effects**, so the font
  check cannot be verified from outside it and a second machine's After Effects
  could name the same file differently. **Not changed**, per §2.5.
- **The build guard is too narrow** and **the panel browser timeout is unmeasured**
  — both recorded above with what a fix would need, neither touched.
- The four hand-written transcripts remain **gitignored, on this disk and in the
  Google Drive backup only**. Unchanged, and stated because this session's whole
  premise was that one of them might have gone.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD at start | `1be6eb0` *docs: the project runs from any folder* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` — identical at start and end |
| cache | **46 entries / 79 files / 55,363,681 bytes** — identical at start and end |
| references | **7 files**, every sha256 as listed above, identical at start and end |
| After Effects | **1 instance, pid 79146** (unchanged since session 11 — no restart), 0 `aerender` |
| open project | none; not dirty, 0 items — the state session 11 left |
| `app.fonts.allFonts` | **445 families / 1198 PostScript names**, at start and end |
| credit remaining | **about $6.64**, unchanged — nothing was billed |

**Edit Plan sha256, all five:**

```
0712e4124d8b5f09641de4ed4276897f3c8cb6781e705df64d49c84dc5db7034  ground truth.editplan.json
1acf10bf06925473c501f30b8ebb290c5fa8f091fcc5ca32485e1ff316221e35  test 1.editplan.json
94da6dd60af1d138a87e1c8f2cc235f542014605d14c4795f165d35c11d27f0a  test 2.editplan.json
dbf28f9bafb55b126d97076b16df56baa1a2d7775343dc07ed6af83468302594  test 3.editplan.json
c8501bcafc79ed3bd74fec776a2401efa8e68caab41cea5b8d2d1ac221c63c20  vitasilk.editplan.json
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | result |
|---|---|
| core | **672 passed** (672) |
| service | **1168 passed** (1168) |
| benchmarks | **166 passed** (166) |
| panel | **159 passed, 2 skipped** (161) |
| **references** | `ok ground-truth / test-1 / test-2 / test-3` — all `v1.0.8-conformant`, **`references: PASS`** |
| templates | 6 entries ok; `validate-templates: 6 template(s) ok, audited against library.aep` |
| ExtendScript | `14 .jsx file(s) ok` |
| panel manifest | `validate:panel: panel/CSXS/manifest.xml ok` |

Every panel browser test passed this run, with After Effects idle.

## Suggested next step

**Make the reference count self-measuring, and widen the gate to cover the
alignment references.** Both are small and both are the same shape: a figure
that is typed into a report is a figure nobody checks. A gate that enumerated the
reference set from one declaration — the one `npm run backup` already has in
`service/src/backup/set.ts` — and failed on a file that is not there would make
"seven" a measurement rather than a sentence, and would close the hole where
deleting both alignment references leaves `npm run check` green.

The two recorded-not-fixed items each need a ruling before code: whether the
build guard should recognise any checkout's output, and what contention factor
the panel browser suite should be bounded at.
