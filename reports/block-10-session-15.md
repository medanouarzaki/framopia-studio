Status: OK

# Block 10 session 15 — four corrections the first panel run exposed

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. `templates/library.aep` `1d7553e894…`, cache
**46 entries / 79 files / 55,363,681 bytes**, all five Edit Plans and all six
hand-made references byte-identical. After Effects **pid 79146** throughout;
the user's own `.local/build/vitasilk-full.aep` was open at the start and is
open, clean, at the end. Free space **173.2 GB**.

**The headline is §4.** The new attribution gate, on its first run over the
whole repository and its whole history, found **14 commits carrying
`Co-Authored-By: Claude Sonnet 4.6` trailers**. None is in a tracked file; all
14 are commit messages from **2026-07-20 and 2026-07-21**, a superseded
generation of this project — a FastAPI backend with `T-1xx` ticket numbers,
before the current architecture existed. They cannot be removed without
rewriting pushed history, which the conventions forbid, so they are listed by
sha with their dates and everything else fails.

---

## Done

### 1. The panel counted words and called them cards

`checkBuildability` reports `plan.subtitles.groups.length` — every group,
including the ones a keyword replaced. That is the right number for validating a
plan and the wrong one for the single screen that tells the user what he is
about to get, which had been promising five cards more than it delivered.

**Where it went.** One quantity, three readers:

| site | what it showed | now |
|---|---|---|
| `steps.ts:279` → the Build summary | `73 subtitle cards` | `68 subtitle cards` |
| `steps.ts:337` → `BuildPreview.subtitleCards` | 73 | 68 |
| `App.tsx:621` → the **Words** opener's badge | 73 | 73, from a field of its own |

**The Words badge was reading `subtitleCards` and was right only by
coincidence.** A card is one word today and the badge lists every word, so the
two agreed until a keyword superseded a group — at which point the correct fix
to one made the other wrong. `BuildPreview.words` is a **schema addition,
optional with a default**: a panel reading an older service falls back to the
card count, which is exactly what it read before.

`npm run validate-plan` says `N subtitle group(s)`, which is honest about what
it counts and is unchanged. No report or artifact carried the figure.

**The correct figure comes from the build's own resolution, not a
re-derivation.** `plannedCards` in `service/src/build/planned-cards.ts` is the
one declaration of which groups become cards — not superseded, has a template,
has display timing — and **`buildReel` now uses the same predicate**, so the
preview and the builder cannot drift.

| reel | groups | panel said | panel says | the build makes | words |
|---|---:|---:|---:|---:|---:|
| ground-truth | 76 | 76 | **71** | 71 | 76 |
| test-1 | 67 | 67 | **64** | 64 | 67 |
| test-2 | 69 | 69 | **64** | 64 | 69 |
| test-3 | 58 | 58 | **58** | 58 | 58 |
| vitasilk | 73 | 73 | **68** | 68 | 73 |

**Confirmed against real comps, not only against a re-derivation.** The golden
reference was measured inside After Effects from four built projects and records
`sub_` and `kw_` comps per reel: test-1 64/2, test-2 64/3, test-3 58/0,
vitasilk 68/3 — identical to the new figures on every reel.

**Twelve tests pin it**, per reel: against the elements `buildReel` actually
emits, against what `stepsFor` sends the panel, and against the golden census.
Two retired assertions were rewritten in the same change — `steps.test.ts`
asserted `73 subtitle cards` in the summary and `subtitleCards` of 73.

### 2. The build message described a rescue that was an overwrite

**What the save is for, read from the code before anything changed.**
`build-reel.jsx:94` refuses to replace a project with unsaved changes, except
when the open file is under `.local/build/` — the build's own previous output,
which is not someone's unsaved morning. It saves that and proceeds, reporting
which file.

**It is useful in one case and pointless in the other.** The output path is
`<reel>-full.aep`, so:

- **A different reel's build open with unsaved changes** — a real file that
  keeps its edits, and worth naming.
- **The same reel's build**, which is what the user hit — saved, then overwritten
  by the next line of the same build. The panel printed the same path twice, once
  as the composition and once as work "saved first", while the line above the
  button already said *"Writes …, replacing what is there"*.

**The same-path save is pointless, and removing it is not this session's to
do** (§6, and recorded at `SAME_FILE_SAVE_IS_POINTLESS` in the code). It changes
nothing about what survives. Removing it leaves the `isDirty` guard refusing that
case instead — which would block a rebuild the user plainly wants — so removing
the save means also deciding what the guard should do. That is a behaviour change
to the build's file handling and a ruling, not a patch.

**The message is true now.** `core/src/saved-output.ts` is the one rule, read by
the panel and by the terminal so they cannot say different things:

| case | what is shown |
|---|---|
| nothing saved | nothing |
| the file about to be overwritten | *"The previous build of this reel was open, and this one has replaced it."* — no path, no claim of rescue |
| a different file | *"A build of another reel was open with unsaved changes, so it was saved first: …/test_1-full.aep"* |

Five unit tests, including one that reads both `panel/src/Build.tsx` and
`service/src/build/build-reel-cli.ts` and fails if either grows a second copy of
the comparison or the old sentence. The browser test that asserted the old
wording was rewritten, and now also asserts the path appears **once** in the
result card — scoped there, because the pre-build line legitimately names the
same path and is still on screen.

### 3. Two fields left the golden comparison

`aeVersion` and `fontNameCount` describe the machine that took the census, not
the comp it built. Session 14 compared them deliberately and named them as the
two most likely to fail the partner's first run on facts that say nothing about
whether the system works. Ruled out.

- **They are recorded inputs now**, in `recordedOn` beside the machine and the
  commit. `GoldenReference.recordedOn.fontNames` is a **schema addition,
  optional with a default**.
- **Both are printed on both sides**, in the header of every run: *"recorded …
  (After Effects 26.0x67, 1198 font names)"* against *"this run After Effects
  26.0x67, 1198 font names installed"*.
- **A differing version says so in words**: when the two disagree the run prints
  *"the two were measured on different After Effects builds. That is not a
  difference in what was built: if every field below matches, this is a pass."*
  Exercised against a reference edited to claim 25.2x14 — the line appears and
  the run exits **0**.

**The exclusion list keeps the property that makes it hard to weaken.**
`ExcludedField` gained `because`: `measured` or `not-about-the-comp`. A measured
exclusion must carry the builds behind it; a ruled one must not claim a
measurement it never had, and its `runs` is 0. Tests pin the list at exactly
these four and pin the split two-and-two.

**What replaced `fontNameCount` is what always mattered.** The face set on every
individual text layer is still compared — **132 assertions on test-1, 134 on
test-2, 116 on test-3, 142 on vitasilk**, with the same number of sizes beside
them — and a test asserts a changed face is still a difference while a changed
`fontNameCount` is not.

**Re-recorded**: 737,757 bytes, sha256 `ac4956610da66954…`. Field count
**17,178 → 17,170**, which is exactly the eight fields removed — two per reel
across four reels — and nothing else.

### 4. The no-fingerprints rule has a gate, and it found something

`npm run check:attribution`, in `npm run check`. Pure matching in
`core/src/attribution.ts`, the walk in `tools/attribution/cli.ts`.

**Six patterns, derived from what has actually appeared** — the trailers found in
history, the banner form the rule names in PROJECT_SPEC §1 and
CLAUDE_CODE_GUIDELINES §1, the instance session 14 removed, the robot emoji, a
link to the assistant, and assistant boilerplate.

**The line between a marker and a legitimate mention is whether it is quoted**,
and that is one criterion rather than a list of exceptions. Every document here
that states the rule writes the forbidden string in quotes — `no "Generated with
Claude Code"` in CLAUDE.md, the same in the guidelines, PROJECT_SPEC §1 and the
block handoff, in four different quote styles. An actual attribution never does,
because it is written to be read as a sentence. A `Co-Authored-By` is also only
a trailer when it starts a line; mid-sentence it is prose about one.

**What the gate cannot catch, said plainly rather than implied.** Prose that
names the tool as the author of something without using any marker phrase —
which is exactly what session 14 removed (`# block-N-session-M.md Claude Code
reports`). The project's own planning documents describe their working method in
nearly the same words: `docs/HANDOFF_PROTOCOL.md` says the executor is Claude
Code, and that is a fact about how work is organised, not attribution. Fifteen
such mentions exist across `PROJECT_SPEC`, `BLOCKS`, `HANDOFF_PROTOCOL` and the
handoffs. Separating the two needs a human reading a sentence. **The gate catches
the mechanical forms, and those are what tooling injects.**

**Watched failing, each in a scratch git repository — never by writing an
attribution into a real file:**

| case | exit | message |
|---|---:|---|
| `🤖 Generated with Claude Code` | 1 | `a.md:3 a generated-with tool banner` + the robot emoji, two hits |
| `This document was generated by Claude.` | 1 | `a.md:3 a generated-by, written-by or created-with attribution` |
| `See https://claude.ai/code for details.` | 1 | `a.md:3 a link to the assistant that produced the work` |
| `As an AI language model, …` | 1 | `a.md:3 assistant boilerplate` |
| `Build status 🤖 ok` | 1 | `a.md:3 the robot emoji tool banner` |
| a `Co-Authored-By: Claude` trailer in a commit | 1 | `commit 71531ecf38:3 a Co-Authored-By trailer naming an AI` |
| the rule stated in four quote styles | **0** | `attribution: PASS` |

Every message names the file (or commit) and the line. Two patterns overlapped
on one banner and were narrowed so a single marker is reported once under one
name.

**What it found on the real repository: 739 tracked text files clean, 675 commit
messages clean, and 14 commits from 2026-07 carrying a trailer.**
`ATTRIBUTION_HISTORICAL_COMMITS` lists all 14 by full sha with their date and
subject, and the reason they stay: rewriting 687 commits of pushed history to
correct fourteen messages nobody reads is out of proportion to the fault, and
the conventions forbid the rewrite outright. **The list is frozen and a test
pins it at 14** — a new entry would be a new commit that broke the rule, which
is the thing the gate exists to prevent.

### 5. What is now known

- **The reentrancy question is settled**, by the user's own hands: After Effects
  accepted the `DoScript` while the CEP extension was open. `CLAUDE.md`'s *"NOT
  settled … has never been observed"* is replaced by what was observed. **The
  panel, CEP `evalScript` and the service's HTTP layer are no longer untested.**
- **The build-stamp banner is recorded as working** — it fired against a real
  mismatch, named the cause, gave the command, and cleared when he reopened the
  panel. First time it has been exercised by anything but a test.
- **`docs/SECOND_MACHINE.md` §9 now tells the partner what to do if he sees it**,
  which is exactly when he will: it means the two halves were built at different
  moments, the fix is `npm run service -- --force` and reopening the panel, and
  if it survives that he should send what it says rather than trying anything
  else.
- `CLAUDE.md` gains two sections: the panel run and its two defects, and the
  pre-build figure with the per-reel table.

---

## Deviations

**None.** Nothing outside the four corrections and §5's documentation was
touched. No billable stage ran, no reel was added to the golden set, the
pre-build save was not removed, the build guard and the panel timeout were left
alone, and no ruled constant, mode, template, cache entry, Edit Plan, generated
image or hand-made reference changed.

**No rebuild was needed to verify §1 or §2.** `buildReel` is pure, so the build's
own count is reachable without building, and the golden reference already held
four real builds measured inside After Effects. The user's
`.local/build/vitasilk-full.aep` was open at the start and is open at the end,
clean and unmodified — the golden run's own builds write to that path, and the
last one left it as the session found it.

## Failures & open problems

**Unproven, by name:**

- **The `other-file` branch of the saved-output message has never been produced
  by a real build.** It needs a build of one reel started while a *different*
  reel's output is open and dirty, which means deliberately dirtying a project.
  Covered by unit tests against both branches; the browser test drives only the
  same-file case, which is the one that was wrong.
- **The attribution gate has never fired on the real repository's files** —
  only on scratch copies. That is the correct result, not a gap in coverage, but
  it means the file-scanning path has only ever been watched failing on fixtures.
- **The gate cannot catch prose attribution**, named above with what it would
  take. Session 14's own finding would not be caught by it today.

**Open:**

- **14 commits carry an attribution trailer and will forever.** History is not
  rewritten; they are listed, dated and explained.
- **`ground-truth` still cannot be built** and is outside the golden set — its
  six pictures were never bought, at about $2.17, and the image service has
  answered with a capacity error since session 7.
- **The golden reference is still one machine's output.** `aeVersion` and
  `fontNameCount` leaving the comparison removes the two likeliest spurious
  failures, but nothing has yet compared two real machines.
- **`build-reel.jsx`'s unsaved-changes guard** and **the panel suite's 5000 ms
  timeout** are untouched by instruction, each needing a ruling.
- **The same-path pre-build save is pointless** and is left in place
  deliberately, because removing it means deciding what the guard should do
  instead.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `ce1f6b4` *docs: record that the panel has been driven by hand* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| cache | **46 entries / 79 files / 55,363,681 bytes** |
| fonts | **445 families / 1,198 face names** — one reading counted two ways — at start and end |
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
| core | 704 | **720** |
| service | 1168 | **1180** |
| benchmarks | 173 | **173** |
| panel | 159 + 2 skipped | **159 + 2 skipped** |
| **attribution** | — | `739 tracked text file(s), 675 commit message(s), 6 marker patterns` · `14 historical commit(s) from 2026-07 … listed by sha` · **`attribution: PASS`** |
| references | `6 hand-made reference file(s): 4 transcript, 2 alignment` · `PASS` | unchanged |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| ExtendScript | `14 .jsx file(s) ok` | unchanged |
| panel manifest | `manifest.xml ok` | unchanged |

Core +16: `attribution.test.ts` 8, `saved-output.test.ts` 5, `golden.test.ts` +3.
Service +12: `planned-cards.test.ts` exactly.

## Suggested next step

**Send it.** All four corrections are in, the two things the first real panel run
got wrong are fixed, and the two fields most likely to fail the partner's first
`npm run golden` for no good reason are out of the comparison.

What is left is not reducible from this machine. The golden reference is still
one Mac's output; the attribution gate has only ever been watched failing on
fixtures; and the three doctor checks never seen failing can only be tested by a
machine that has never run this. His first run is the measurement.

## Commits

| | |
|---|---|
| `4b0793d` | `fix: the panel promised cards the build does not place` |
| `a550663` | `fix: stop describing an overwrite as a rescue` |
| `9dedf96` | `fix: stop comparing the machine and start recording it` |
| `dfe8865` | `feat: gate the no-fingerprints rule instead of remembering it` |
| `ce1f6b4` | `docs: record that the panel has been driven by hand` |
| this one | these reports |
