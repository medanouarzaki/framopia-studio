Status: OK

# Block 11 session 64 — a count that means the same thing twice, and what the partner really needs

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends. Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.**

**Two of this brief's premises turn out to be wrong, and both are said plainly
below.** Session 54 *did* report the third quarantine. And the second machine's
blocker is not 11.9 GB of video — it is **308 KB of JSON**.

**A finding nobody asked for: `npm run doctor` reports a false green on the
footage**, on any machine that can see the T7 Shield. The two rehearsals that
have been run so far were both on such a machine.

---

## 1. Every quarantine directory

Three exist. **There is no fourth**, in `.local/` or anywhere else in the
repository.

| directory | files | created | reported at the time |
|---|---|---|---|
| `.local/quarantine-session51/` | 363 | session 51 | yes |
| `.local/quarantine-session53/` | 139 | session 53 | yes |
| `.local/quarantine-session54/` | **1** | session 54 | **yes — see below** |

`-session54/` holds one file:
`delete-safety-test-2026-09-04T23-29-37-302Z.json`. It is a scratch client left
in `.local/deleted-clients/` by `delete-is-safe.test.ts`, which at the time
deleted a client without removing the moved-aside file.

**The brief's premise is wrong: session 54 did say so**, in one sentence of its
close-out:

> *"One scratch client the deletion test moved aside was found in
> `.local/deleted-clients/` at the end and went to `-session54/`; that directory
> is empty of anything real and was removed."*

Read from the commits rather than inferred: the leftover was written at 00:29;
`a008e68` (01:21) added `rmSync(removed.movedTo)` so it cannot recur; the report
landed at 01:37; the directory's mtime is 01:38.

**Two things are genuinely wrong, neither of them "nobody said".**

1. **The sentence is ambiguous about what "was removed".** Read one way it claims
   `-session54/` was deleted, which is false — it is there with its one file.
   Read the other way it means `.local/deleted-clients/`, which matches what is
   on disk (present but empty, recreated since by `mkdirSync`).
2. **Six later sessions dropped it.** Sessions 55, 56, 57, 58, 60 and 61 all
   asserted two quarantine directories in their fingerprint tables while three
   existed. Session 59 is the only one in that range that names three. A
   fingerprint table that lists what it expects rather than what it found will
   agree with itself forever.

Nothing was moved and nothing was deleted.

## 2. The scan now reads the commit, and the stable count is 786

**The bug, measured before the fix.** An untracked file dropped into `core/src`:

```
$ printf 'export const HINT = "then run npm run not-a-real-script to finish";\n' > core/src/scratch-note-64.ts
Tests  1 failed | 785 passed (786)

 FAIL  src/messages.test.ts > every command named in a message exists > npm run not-a-real-script is a real script ([ 'core/src/scratch-note-64.ts' ])
AssertionError: expected [ Array(65) ] to include 'not-a-real-script'
```

785 → 786 and red, from a file git never heard of.

**The fix, and where it departs from the brief.** The brief asked for the scan to
read the commit *and* said "do not weaken what the test checks". Those conflict:
reading `HEAD` stops checking a message written and not yet committed, which is
the entire point of the file — catching a wrong `npm run` **before** a person is
told to type it.

So the fix does both:

- the generated cases come from `git grep` **at `HEAD`**, which reads the blobs
  at that commit and never looks at the working tree, and lets git apply its own
  ignore rules rather than this file guessing at them;
- **one test, always one**, reads the tracked files **as they stand on disk**, so
  an uncommitted edit is still caught. Untracked files stay ignored — a scratch
  file is not the product and must not fail the gate.

The count contribution of that test is fixed, so the commit still decides the
count.

**Proof one — the untracked file no longer moves anything:**

```
$ printf 'export const HINT = "then run npm run not-a-real-script to finish";\n' > core/src/scratch-note-64.ts
Tests  786 passed (786)
?? core/src/scratch-note-64.ts
```

Same file, same count as the clean tree, green.

**Proof two — nothing was given up.** An uncommitted `npm run not-a-real-script`
appended to the tracked `core/src/paths.ts`:

```
Tests  1 failed | 785 passed (786)

 FAIL  src/messages.test.ts > every command named in a message exists > names only real scripts in the tree as it stands now
AssertionError: expected [ Array(1) ] to deeply equal []
+ Array [
+   "npm run not-a-real-script (core/src/paths.ts)",
+ ]
```

**Count unchanged at 786, and the bad message still caught immediately.**

**Proof three — breaking the fix.** Reverting the case source to the tree
(`mentionedScripts(null)`) with a scratch file present:

```
Tests  2 failed | 785 passed (787)

 FAIL  … > npm run not-a-real-script is a real script ([ 'core/src/scratch-note-64.ts' ])
AssertionError: expected [ Array(65) ] to include 'not-a-real-script'
 FAIL  … > names only real scripts in the tree as it stands now
```

787 — the count moves again. Restored byte-identical from the saved copy, 786
green, and `core/src/scratch-note-64.ts` is gone.

**A bug I introduced and caught.** My first parse split each `git grep` line on
every colon and took the last field, which truncates a script name that carries
one — `templates:audit` became `audit`, `panel:build` became `build` — and 17
cases went red naming scripts that do not exist. Splitting at the last
`:npm run ` marker instead fixes it, and the reason is recorded in the code. The
generated case count is **36 before and after**, so nothing checked was lost.

**The stable core count at this commit is 786.** It differs from 785 by exactly
one: the new tree-check test. It is 786 with a clean tree, with an untracked
scratch file present, and after committing — measured in all three states. 785
was the correct figure at `6b82d19`, measured independently in the rehearsal
clone, which is a different machine directory with a different tree.

**The count instability is not only core.** Measured in passing: the service
suite reports **1378** tests without the corpus Edit Plans and **1398** with
them, and the panel **122** against **244**. Those counts are still properties of
what is on disk. This session did not fix them and does not claim to.

## 3. What the trade costs

Almost nothing, because it was not accepted.

Reading the commit alone would have cost real feedback: a session that writes
`npm run <typo>` into a message would see the gate pass, commit it, and only be
told on the next run — after the mistake is in history. That is the wrong way
round for a check whose whole purpose is to catch the wrong command before a
person types it.

What is actually given up is narrower and I think it is right: **an untracked
file is no longer checked at all.** A scratch file is not part of what this
project ships, and failing the gate on one is noise that trains people to ignore
the gate. If a message matters, it belongs in a tracked file — and from that
moment it is checked, committed or not.

## 4. What a second machine actually needs

Measured in the rehearsal clone at `from-github-2/framopia-studio`, pulled to
`6b82d19`. **No code was written and no document was changed in this part.**

### First: the doctor reports a false green on the footage

`benchmarks/footage.json` records **absolute paths on the T7 Shield**, and
`checkFootage` reads `reel.path` as it stands. So the clone — which holds no
`my files/` at all — reported:

```
  ok    the source reels, which are not in git
        5 of 5 present; not hashed
```

Forcing an empty footage directory gives the truth:

```
  MISS  the source reels, which are not in git
        0 of 5 present; missing: test-1, test-2, test-3, ground-truth, vitasilk
17 present, 7 absent, 0 could not be determined, of 24
```

**This is only right on a machine that can see the T7 Shield**, which is every
rehearsal run so far — sessions 55 and 56 included. On the partner's own Mac the
report will differ from every rehearsal that has been recorded.

### 1. What works with an empty `my files/`

| step | with no videos at all |
|---|---|
| §1–§8 machine setup (brew, node, ffmpeg, CV, fonts, AE scripting) | unaffected — none touch a video |
| §9 `npm run panel:build` | **works** — 232 KB bundle, built in 97 ms |
| §10 API keys | unaffected |
| the panel's screens | **work** |
| create a client | **works** |
| edit a client's details | **works** |
| attach a photograph | **works** — copied into `assets/client-pictures/…` |
| delete a client | **works** — photographs move with them |
| §14 `npm run doctor` | runs, but see the false green above |
| §15 `npm run golden` | **cannot run** |

Every client operation was exercised through the real functions on a clone with
no videos and no API keys:

```
list clients          : 2 client(s) visible
create a client       : ok -> videoless-machine-probe
edit a client         : ok -> "a clinic in Rabat"
attach a photograph   : ok -> assets/client-pictures/videoless-machine-probe/pic001.png
  copied into project : true
delete a client       : ok -> .local/deleted-clients/videoless-machine-probe-…json
  photographs went to : .local/deleted-clients/videoless-machine-probe-…
```

### 2. The smallest set to build one real client video

The five corpus reels are **test fixtures and are not needed at all** to make a
client's video.

| what | size | where it comes from |
|---|---|---|
| the client's own `.mov` | **1.39 GB** (the smaller of Dr Loubna's two; the other is 4.15 GB) | the client |
| `.local/config.json` with real keys | < 1 KB | typed on the machine |
| `panel/dist/panel.js` | 232 KB | `npm run panel:build`, local |
| `templates/library.aep` | 540 KB | **already in git** |
| `assets/` (brand, SFX, watermark) | 26 MB | **already in git** |
| `modes/` | 16 KB | **already in git** |
| a git clone | 23 MB | GitHub |

**1.39 GB against 11.93 GB**, and the 1.39 GB is the client's own footage, which
has to reach the partner regardless of anything in this repository.

### 3. The smallest set to run `npm run golden`

**All four golden reels, in full: 9.51 GB.**

| reel | size |
|---|---|
| test 1.mov | 2.29 GB |
| test 2.mov | 2.31 GB |
| test 3.mov | 2.24 GB |
| vitasilk.mov | 2.68 GB |
| **total** | **9.51 GB** |

`ground truth.mov` (2.42 GB) is excluded from golden, so the full 11.93 GB is
never needed at once.

**Golden cannot run on fewer than four.** `tools/golden/cli.ts:142` reads
`const reels = GOLDEN_REELS`, with no flag to subset it, and the census records
all four — a partial run could not report "4 of 4". The build imports the source
video into the composition (`build-reel-cli.ts:169`,
`{ elementId: 'source', kind: 'footage', path: plan.source.videoPath }`), so the
`.mov` bytes are genuinely required, not just the plan.

### 4. Which of the six actually stop work

| what the clone reports missing | `blocking` | stops work? |
|---|---|---|
| `api-keys` | `'run'` | **yes — the only one of the six** |
| `panel-built` | `'panel'` | no — `npm run panel:build`, 97 ms, local |
| `watermark-facts` | `'money'` | no — one ffmpeg pass |
| `loudness-records` | `'money'` | no — measured by transcription |
| `cache` | `'money'` | no — costs money, not correctness |
| `ledger` | `'money'` | no — the first billable call creates it |

**Session 60 is confirmed among the six and refuted as a general claim.** Only
`api-keys` blocks the pipeline of those six — but `footage` is also
`blocking: 'run'` (`tools/doctor/checks.ts:754`), and it did not appear as a
blocker in any rehearsal **only because of the false green in §4's opening**.
With the footage genuinely hidden, the doctor lists two blockers, not one.

### 5. Does the 11.9 GB have to move?

**No — not for the partner to be useful. It has to move only to run the gate.**

Every one of the 230 service test failures on a videoless clone names an **Edit
Plan JSON**, never a `.mov`. Copying only the five `.editplan.json` files —
**308 KB against 11.93 GB** — gives:

| suite | no corpus | + 308 KB of Edit Plans | this machine |
|---|---|---|---|
| core | 4 failed | **2 failed** | 786 passed |
| service | **230 failed** | **60 failed** | 1397 passed |
| panel | 121 passed, 1 file could not collect | **242 passed, 2 skipped (244)** | 244 |

**The panel suite reaches its full 244 — identical to this machine — with zero
video on disk.** `render.browser.test.ts` cannot even collect its 122 tests
without `vitasilk.editplan.json`, which is 59 KB. The 60 service failures that
remain, and core's last 2, need actual video bytes, the CV artefacts under
`.local/cv/` (877 MB) and `.local/ground-truth/` (60 KB).

**Recommendation.** Send the partner the 308 KB of Edit Plans with the clone, and
do not move the 11.9 GB yet. That buys a machine that can run the panel, do every
client operation, pass the whole panel suite and all but 60 service tests. What
it cannot do is `npm run golden` — the one thing that proves *their* Mac builds
what ours does, and the reason it needs the video is that the build imports the
footage into the composition.

So the question is not "how do we move 11.9 GB" but "when does the partner need
to prove their Mac builds identically". Until that day, 9.51 GB of the transfer
is deferrable and the other 2.42 GB is never needed. If it does have to happen,
it is four files and it can go one at a time.

**This part measured and changed nothing.** What to do about the false green, and
whether `SECOND_MACHINE.md` should be restructured around the 308 KB, are
decisions for Mohamed.

## 5. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run with nothing else touching the tree. **No
workspace was built while a gate was in flight.** **`npm run golden`: PASS** —
4415 + 4280 + 3709 + 4770 = **17,174**, field for field, reference unchanged.

| suite | expected | measured | difference |
|---|---|---|---|
| core | 785 | **786** | **+1**, explained in §2 |
| service | 1397 (+1 skipped) | **1397** (+1 skipped) | — |
| benchmarks | 173 | **173** | — |
| panel | 242 (+2 skipped) | **242** (+2 skipped) | — |

**+1 in core**, one test added to `core/src/messages.test.ts`:

1. `every command named in a message exists > names only real scripts in the tree as it stands now`

Nothing removed or renamed; the 36 generated cases are the same 36 as before.
The arithmetic closes exactly. **786 is the figure future sessions should
assert**, and unlike 785 it means the same thing whatever is lying in the tree.

**Five panel runs, each one:** 242 passed, 2 skipped (244) — five times, no test
failing on any.

| | at start | at end |
|---|---|---|
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | `c600905c5e36ecbc…` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | `f60749f5629b2ced…` |
| `modes/` | `.gitkeep`, both clients | unchanged |
| `assets/client-pictures/` | empty | **empty** |
| `-session51/` · `-session53/` · `-session54/` | 363 · 139 · 1 files | unchanged |
| `aerender` processes | 0 | 0 |

**After Effects was not running at the preamble** — 0 instances, only orphaned
`crashpad_handler` processes. It was open again before `npm run golden`, which is
the only thing that drove it, through `DoScript` into the already-running
instance. It was never launched by this session and never quit. No `.aep` was
written and Mohamed's own project was never saved.

`handoffs/block-10-opening-prompt.md` → `handoffs/block-10.md` is Mohamed's own
uncommitted rename, left exactly as it was.

## 6. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a git listing, test runs, and a directory measurement.
