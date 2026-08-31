Status: OK

# Block 10 session 13 — the gate sees the references, and the handover is written

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. `templates/library.aep` `1d7553e894…` at both
ends. Cache **46 entries / 79 files / 55,363,681 bytes**, nothing created. All
five Edit Plans byte-identical. **All seven files in the reference directories
byte-identical**, verified by sha256 at start and end. After Effects pid
**79146** throughout — the same instance since Block 9 session 12 — no project
opened, saved or closed, no font set, installed or activated.

---

## Done

### A. The gate now fails when a hand-made reference is gone

Session 12 found two holes: a deleted **transcript** failed `npm run check` only
as an uncaught `ENOENT` with a stack trace, and a deleted **alignment
reference** failed nothing at all — nothing in the gate read
`benchmarks/references/align/*.json`. Both are closed.

**One declaration, derived from the read sites.** `core/src/references.ts` holds
`REFERENCE_FILES`. It was built by finding what the code actually reads —
`benchmarks/src/verify-references.ts:10` (`.local/ground-truth/<reel>.txt`, four
reels), `service/src/transcription/protected-entries.ts:34` and
`tools/align-review/load.ts:25` (`benchmarks/references/align/`) — not from a
list handed to the session. Each entry carries `id`, `kind`, `reel`, an absolute
`path` resolved against the repository running now, and **`readBy`**, so a
failure says what stops working rather than only what is missing.

**The definition is stated in the gate's own output**, which is the point:

```
references: 6 hand-made reference file(s): 4 transcript, 2 alignment
            a hand-made reference is a file a person authored that nothing can regenerate;
            a README in a reference directory is documentation, not a reference
```

That number has already meant three things in three reports — session 10's "3
alignment references" was a directory walk that counted the README, session 11's
"6" excluded it, session 12 reconciled seven files against six references. None
of them said which. It cannot recur while the definition prints beside the count.

**What the gate checks, per file:** present, readable, and parses — an alignment
reference through `parseAlignReference`, so a wrong `schemaVersion` is caught and
not merely a missing file; a transcript for having text under its header, because
a file emptied to its header would pass an existence check while having lost
everything. **The orthography-conformance check stays separate and unchanged**:
absent is a lost file, non-conformant is a text to correct, and folding them
together would tell a reader the wrong thing about what to do.

**The declaration cannot fall behind the disk.** A hand-made file sitting in a
reference directory that `REFERENCE_FILES` does not declare fails the gate,
naming it — the same shape as `REPO_ANCHORS` pinned against `readdirSync`.
Documentation is excluded **by name**, never by extension: a `.md` is not
automatically safe to ignore. The tagged `.local/ground-truth/*.json` are
excluded because `npm run bench:tag` rebuilds them from the `.txt`.

### Every failure was watched, and no real reference was touched to watch it

`FRAMOPIA_REFERENCE_ROOT` re-roots the declared set onto a scratch tree
(`referenceFilesRootedAt`). **An absence is simulated by never creating a file
rather than by removing one** — these are the files the gate exists to protect,
and session 12 was spent establishing that none had already been lost. The
scratch tree was seeded with **copies**; the originals were never opened for
writing, and their sha256 are identical at both ends of this session.

| simulated | how | what the gate said | names the file |
|---|---|---|---|
| `ground-truth.txt` absent | held aside in the scratch copy | `FAIL ground-truth transcript — absent` | yes |
| `test-1.txt` absent | same | `FAIL test-1 transcript — absent` | yes |
| `test-2.txt` absent | same | `FAIL test-2 transcript — absent` | yes |
| `test-3.txt` absent | same | `FAIL test-3 transcript — absent` | yes |
| `vitasilk.json` absent | same | `FAIL vitasilk alignment review — absent` | yes |
| `vitasilk.rereview.json` absent | same | `FAIL vitasilk alignment rereview — absent` | yes |
| unreadable | `chmod 000` on the scratch copy | `unreadable … EACCES: permission denied` | yes |
| unparseable, wrong schema | `{"schemaVersion":99}` | `unknown schemaVersion 99; this build reads 1 and 2 and 3` | yes |
| unparseable, not JSON | `this is not json` | `Unexpected token 'h' … is not valid JSON` | yes |
| transcript emptied to its header | header line only | `has a header but no transcript text` | yes |
| undeclared reference | a `test-9.json` in the align directory | `sits in a reference directory but is not declared in core/src/references.ts` | yes |
| a README present | copied in | **no failure**, count still 6 | n/a |

**Every one exits 1.** The absence message also says *"nothing regenerates it"*,
names what reads the file, and says where to restore it from — git for the
alignment references, the backup for the transcripts, which are gitignored.

**14 new tests** pin all of it: seven in `core/src/references.test.ts` (including
that every declared file is on this disk and that the declaration knows every
hand-made file in the directories it owns) and seven in
`benchmarks/src/reference-set.test.ts`, which exercise the verdicts against
copies in a `mkdtemp` tree and never touch a real reference.

### The gate's line, before and after

Before — four files, and only their declared version:

```
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
```

After — **6 counted, 10 lines checked**, presence first and conformance second:

```
references: 6 hand-made reference file(s): 4 transcript, 2 alignment
            a hand-made reference is a file a person authored that nothing can regenerate; a README in a reference directory is documentation, not a reference
  ok    ground-truth transcript      present, readable, parses
  ok    test-1 transcript            present, readable, parses
  ok    test-2 transcript            present, readable, parses
  ok    test-3 transcript            present, readable, parses
  ok    vitasilk alignment review    present, readable, parses
  ok    vitasilk alignment rereview  present, readable, parses
  ok    ground-truth                 v1.0.8-conformant
  ok    test-1                       v1.0.8-conformant
  ok    test-2                       v1.0.8-conformant
  ok    test-3                       v1.0.8-conformant
references: PASS
```

---

### B. The font-name trap, written where he will hit it

Session 12 measured that After Effects and macOS name the same installed file
differently. Recorded in all three places, and the mechanism named rather than
just the symptom: **both divergent faces are variable fonts, and After Effects
constructs its own name for an instance instead of taking the file's.**

| the repo pins, and After Effects reports | macOS reports for the same file |
|---|---|
| `Inter-SemiBold` | `Inter-Regular_SemiBold` |
| `CormorantGaramondItalic-SemiBoldItalic` | `CormorantGaramond-SemiBoldItalic` |
| `Almarai-Bold` | `Almarai-Bold` — agrees, and it is the static font |

This also explains a fact `CLAUDE.md` had recorded without explaining — that the
emphasis family is `CormorantGaramondItalic` and not `CormorantGaramond`. It is
not a curiosity of that face; it is what After Effects does to a variable font's
italic file.

- **`CLAUDE.md`** — the table sits where the PostScript-name rule already lived,
  with the consequence for a second machine and the note that nothing outside
  After Effects can check these names.
- **`docs/MACHINE_REQUIREMENTS.md`** — a section saying the requirement can only
  be checked from inside After Effects, that Font Book showing a different name
  is not a failure, and that all three are plain `.ttf` files with none coming
  through Creative Cloud.
- **`docs/SECOND_MACHINE.md`** — in plain English at the font step, with the
  double-click instruction kept because session 12 measured it correct:
  *"Expect the name in Font Book to look wrong. It is not."* And the thing he
  should actually do: **if a build refuses on a font name, send the two lists and
  stop — do not rename or reinstall anything.**

**The doctor's font check reports two lists, not a verdict.** `compareFontNames`
in `core/src/doctor.ts` pairs each missing name with what the host offers under
the same family. Rendered against the names macOS publishes for these very
files, what he would see is:

```
wanted Inter-SemiBold; After Effects lists Inter-Regular, Inter-Regular_SemiBold
| wanted CormorantGaramondItalic-SemiBoldItalic; After Effects lists nothing under that family
```

Four tests pin it, including that a family with nothing under it says so plainly
rather than returning an empty list a reader could mistake for agreement. The
passing path is unchanged and still reads *"Inter-SemiBold, Almarai-Bold,
CormorantGaramondItalic-SemiBoldItalic all listed, among 1198 names"*.

**No font name was changed.** The three pinned names are ruled and stand.

### The two font counts, so they never diverge in a report again

Measured this session at both ends, from one reading:

| figure | value | what it is |
|---|---:|---|
| `app.fonts.allFonts.length` | **445** | **families** |
| the same entries, split on commas | **1198** | **face names** |

`allFonts` is not a list of fonts: each entry stringifies to one family's
PostScript names joined by commas. `panel/jsx/fonts.jsx` splits and returns
names, which is why the production reader and the doctor say 1198; session 11's
ad-hoc probe read the array length and said 445. Both correct, of different
quantities. **Nothing moved**, and the pid is the proof — 79146 throughout, no
restart the change could have hidden in.

---

### C. The handover state, stated once

A new section at the top of `docs/SECOND_MACHINE.md`, before the setup steps,
written from measurement.

- **What works**: four reels build end to end from cache in 2–6 seconds at
  **$0.00**, from a repository in any folder.
- **What does not, and is not his fault**: `ground-truth` refuses. Its six
  pictures were never bought — the image service has answered `503 … currently
  experiencing high demand` for three sessions — so the exact text he will meet
  is quoted for him, `build refused at pre-flight: 6 element(s) have no
  placement; refusing to build a comp with gaps:`, with a slot list under it. The
  document tells him not to chase it and not to spend the ~$2.17 fixing it,
  because that is our decision and not a setup step. Read from
  `service/src/build/preflight.ts:41-49` and from the plan's own six slots, each
  with `position: null` and zero candidates.
- **What is unverified**: every remedy in the document, and the three doctor
  checks never seen failing. His run is what verifies them.
- **What he must measure and cannot copy**: his watermark measurement and his
  loudness records — measurements of his machine's own copies, taken
  automatically on the first pipeline run, with nothing for him to do.
- **What must never travel**: the API key and the ledger, in either direction.
- **First thing, and the one file back**: work to `npm run doctor` until it stops
  printing blockers; send the §12 table, especially any line where what he saw
  differs from what the document says.

---

## Deviations

**None.** Nothing outside the three deliverables was touched. No project was
opened, saved or closed; no font was set, installed, removed or renamed; no reel
was built; no billable stage ran; no second checkout was made; no reference file
was moved, renamed or deleted.

Two scratch artifacts were created and removed inside the session scratchpad,
outside the repository: the re-rooted reference tree used to watch the gate fail,
and copies held aside while a scratch file was mutated.

## Failures & open problems

- **`npm run check` still cannot see a lost tagged `.json`** in
  `.local/ground-truth/`. Deliberate — `npm run bench:tag` rebuilds them from the
  transcripts, so losing one costs a command rather than a human's afternoon —
  but the scorers read them, so the first symptom would be a scorer crash rather
  than a named failure. Recorded, not fixed.
- **The alignment reference set is one reel.** `vitasilk` has a review and a
  re-review; the other four reels have none, so the only non-circular measure of
  aligner correctness covers 73 of the corpus's 343 words. The declaration is
  built so adding a reel's reference is one entry and the drift test then
  requires the file, but nothing was collected here — that is a human's hours.
- **Two of the three font names exist only inside After Effects**, so the check
  cannot be moved out of it, and a different After Effects build could construct
  a different name from the correct file. Now documented in three places and
  reported as two lists; **not solvable from this machine.**
- **`build-reel.jsx`'s unsaved-changes guard is still too narrow** and **the
  panel browser suite's 5000 ms timeout is still unmeasured.** Both untouched by
  instruction; session 12 wrote up what each would need, and each needs a ruling
  rather than a patch.
- **`ground-truth` still cannot be built**, and the image service was not
  retried. It has failed on three consecutive sessions; a fourth attempt is a
  spending decision.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `139165f` *docs: the font names are after effects', and the handover state* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| cache | **46 entries / 79 files / 55,363,681 bytes**, nothing created |
| fonts | **445 families / 1198 face names**, at start and end |
| After Effects | pid **79146**, 0 `aerender`, no project open, not dirty, 0 items |
| credit remaining | **about $6.64**, unchanged — nothing was billed |

**The reference files, sha256, identical at start and end:**

```
b77495a1b2e060e40d5c3a256df35d9da64aa7c2a50498d53cea24edebcf8989  benchmarks/references/align/README.md
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
```

**The Edit Plans, sha256, identical at start and end:**

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
| core | 672 | **685** |
| service | 1168 | **1168** |
| benchmarks | 166 | **173** |
| panel | 159 + 2 skipped | **159 + 2 skipped** |
| templates | 6 entries ok | 6 entries ok |
| ExtendScript | 14 `.jsx` ok | 14 `.jsx` ok |

**The +20 is fully accounted for**, per file: `references.test.ts` +7,
`reference-set.test.ts` +7, `doctor.test.ts` 21 → 25, and **`messages.test.ts`
35 → 37 on its own** — it enumerates every `npm run …` a user-facing message
names, and the gate's new failure text names two more. A test that widens itself
when the code does is the shape this repo wants, so it is reported rather than
absorbed.

**The references gate's own line and stated definition** are quoted in full
under Deliverable A; it reports **6 hand-made reference file(s): 4 transcript,
2 alignment**.

## Suggested next step

**Send the project.** The two gaps that made a handover risky are closed: a lost
reference now fails loudly and by name, and the one trap that would have had him
reinstalling correct fonts is written where he will meet it, with instructions to
report rather than fix.

Nothing else on the list improves his first run. `ground-truth`'s six pictures,
the build guard's breadth and the panel suite's timeout are all better answered
by what his machine reports than by more work here — and the three doctor checks
that have never been seen failing can only be tested by a machine that has never
run this.

## Commits

| | |
|---|---|
| `806bc70` | `feat: fail the gate when a hand-made reference is gone` |
| `139165f` | `docs: the font names are after effects', and the handover state` |
| this one | `CLAUDE.md` and these reports |
