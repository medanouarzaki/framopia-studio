Status: OK

# Block 10 session 28 — CLAUDE.md read whole, and given away

**Spent $0.00; no API was called and no code changed.** Ledger **118 lines,
`3f657131…`, byte-identical at both ends**. `templates/library.aep`
`d2bbb6b7…`, 552,745 bytes, **never opened**. The six hand-made references and
the cache (46 entries / 80 files / 54,256 KB) byte-identical at both ends. After
Effects **one instance**, 0 `aerender`, nothing saved by this session. Free
space **157 GiB**.

**`npm run check` PASS, with the new size check in it; `npm run golden` PASS, 4
of 4 reels, 17,174 fields identical.**

---

## The thing you were worried about, first

**Nothing was deleted. Every one of the 530,588 characters is accounted for, and
most of it was already written down twice.**

`CLAUDE.md` was **530,588 characters over 9,430 lines**. Read whole and measured
rather than skimmed, it was four things:

| what | chars | share |
|---|---:|---:|
| a session-by-session history of blocks 1 to 10 | 376,589 | **71.0%** |
| rules and knowledge distilled from that history | 125,999 | 23.7% |
| the command reference | 23,559 | 4.4% |
| actual orientation — what the project is, the repo map | 4,441 | 0.8% |

**The history was already in `reports/`.** 81 of its 83 session sections have a
matching `reports/block-N-session-M.md` by name; the two that do not are block
summaries rather than session records. Measured at the level of distinctive
tokens — every backticked identifier, path and constant, and every number of
four digits or more, 3,051 of them — **93.4% of `CLAUDE.md` already appeared in
`reports/`**, and 94.4% in `reports/`, `docs/` and `handoffs/` together.

**Of the 1,627 identifier-like tokens in the file, 55 appeared nowhere else in
any markdown. 35 of those turned out to be in the source code.** The remaining
16 are placeholder paths with `<reel>` in them, range notations like `0..1100`,
a content hash, and four filenames written without their directory
(`cost.ts`, `card-fit.test.ts`, `staleness.test.ts`, `build-stamp.test.ts` — all
of which exist). **Not one fact was found that existed only in `CLAUDE.md`.**

What *was* unique is the **synthesis** — 77 rules stated as rules, each with the
measurement that produced it: *"A missing input refuses; it never degrades"*,
*"Staleness is a fact about code, never about clocks"*, *"Nothing typed that can
be chosen"*. Those are the valuable part, and they are what moved into `docs/`.
They were moved **verbatim**: not one was summarised, reworded or renumbered.

---

## Done

### 1. What was in it, measured

**530,588 characters, 9,430 lines, 84,185 words**, in seven parts:

| part | chars | lines |
|---|---:|---:|
| title and preamble | 409 | 10 |
| `## What this is` | 314 | 8 |
| `## Repo map` | 3,002 | 47 |
| `## Commands` | 23,559 | 334 |
| `## Conventions (binding)` — 77 `###` rules plus a 710-char intro | 126,709 | 2,194 |
| `## Status` — blocks 1 to 3, in unbroken prose with no headings | 38,287 | 592 |
| 83 `## Block N session M` narrative sections | 338,302 | 6,244 |

**It only ever grew.** 142 commits touched it: **10,009 lines added, 579
removed**. It passed 1,000 lines at commit 31 (Block 4), 4,000 at commit 61
(Block 8 session 3), 8,000 at commit 121 (Block 10 session 6). The largest single
additions were session records — 200 lines for Block 7 session 3, 141 for Block 8
session 6, 139 for Block 8 session 3.

**Every session was told to update it and none was told what did not belong in
it.** `docs/CLAUDE_CODE_GUIDELINES.md` §5 said *"keep it current in the same
session as the change"* and named *active conventions* and *current pipeline
status* among its contents, with no boundary and no limit. That instruction is
the mechanism, and §4 below replaces it.

### 2. What was duplicated, and whether it had drifted

**No drift was found between `CLAUDE.md` and `docs/`, and it was looked for by
measurement rather than by reading.** Every `CONSTANT = value` claim in
`CLAUDE.md` and in `docs/` was extracted and compared; seven constants are stated
with more than one value somewhere, and **every one is a file narrating its own
history** — `IMPACT_THRESHOLD` 0.95 then 0.90, `EMPHASIS_SIZE_RATIO` 1.0 then
1.1641, `ACTIVE_PROMPT_VERSION` 3 then 4. Checked against the code, the value
each names as current is the value the code holds: `IMPACT_THRESHOLD = 0.9`,
`EMPHASIS_SIZE_RATIO = 1.1641`, `ACTIVE_PROMPT_VERSION = 4`,
`MAX_SUBTITLE_LINES = 2`, `HEAD_CLEARANCE = 0.04`, `MAX_WORDS_PER_CARD = 1`,
`SUBTITLE_SAFE_WIDTH = 1940`. `service/src/decisions.test.ts` already pins the
decision documents against their constants, which is why this was the one place
drift could not hide.

**Three statements in the repo map were stale, and that is the drift that was
there.** It said `templates/` — *"AE templates (not started)"* when
`library.aep` has existed since Block 6 session 7; `modes/k2-syndicalia.json` is
*"a validated stub at version 2"* when it is a real client at version 12; and
`assets/brand/` is *"(not started)"* when the logo is committed and used. A file
whose own rule is *"it must never describe a state the repo isn't in"* described
one in three places, in its first fifty lines, for months.

### 3. Where every part went

**Two commits, deliberately in this order**, so the history shows what arrived
before it shows what left: `87969db` adds, `fd92579` removes.

| part | chars | home |
|---|---:|---|
| 36 rules on **how the system works** | 58,447 | `docs/ARCHITECTURE.md` §9, verbatim |
| 15 rules that are **the user's rulings** | 31,977 | `docs/PROJECT_SPEC.md` §10, verbatim |
| 17 rules on **how to work in this repo** | 18,347 | `docs/CLAUDE_CODE_GUIDELINES.md` §7, verbatim |
| 8 rules about **the templates** | 16,119 | `docs/TEMPLATE_LIBRARY_GUIDE.md` §12, verbatim |
| the **command reference** | 23,559 | `docs/COMMANDS.md`, new, verbatim |
| `## Status` (blocks 1–3) | 38,287 | `reports/operating-memory-archive.md`, verbatim |
| 83 session sections | 338,302 | `reports/operating-memory-archive.md`, verbatim |
| *"The panel has been driven by hand"* — a session record, not a rule | 1,032 | the archive |
| the SCHEMA FRAGILITY RULE, lifted out of `## Status` | — | `docs/CLAUDE_CODE_GUIDELINES.md` §7, under its own heading |
| title, preamble, *What this is*, repo map, the four convention bullets | 4,435 | **kept** in `CLAUDE.md` |
| 77 heading newlines and 6 section joins | 83 | (arithmetic) |
| **total** | **530,588** | |

Growth in each destination: ARCHITECTURE 21,566 → **80,567**; PROJECT_SPEC
32,268 → **64,789**; CLAUDE_CODE_GUIDELINES 15,142 → **37,070**;
TEMPLATE_LIBRARY_GUIDE 47,777 → **64,422**; COMMANDS **23,853** new; the archive
**378,101** new.

**Each rule keeps its own heading**, so a session scanning `ARCHITECTURE.md`
finds *"Looking at the video is a stage now"* as a heading rather than as a
paragraph buried in a wall. Each destination section opens with one paragraph
saying where the text came from and that `git show 1c8c850:CLAUDE.md` is the
file as it stood.

### 4. What `CLAUDE.md` is now

**8,497 characters, 143 lines — 1.6% of what it was.** It holds what the brief
asked for and little else: what the project is; the repo map; the six commands
an ordinary session runs, pointing at `docs/COMMANDS.md`; eleven standing rules
in their shortest form; where the project stands in four lines pointing at
`reports/latest.md`; and a table naming every document in `docs/` and what it
holds.

The repo map lost detail — the panel's debug port, the sidecar's task list, the
watermark's byte count, `SCRIPT_RULES`. **Each of those was checked before it
went**: all eight dropped facts were found elsewhere in the repository, in
`panel/.debug`, `docs/ARCHITECTURE.md`, `docs/MACHINE_REQUIREMENTS.md`,
`benchmarks/RESULTS-block7-watermark.md`, `core/src/index.ts` and
`service/src/build/drive.ts`. The three stale statements were corrected rather
than carried.

### 5. It cannot silently grow again

`scripts/check-claude-md.mjs`, run by `scripts/check.sh` between the ExtendScript
parse and the template validation. `npm run check` now prints
**`claude-md: 8,497 of 20,000 characters`**.

**`CLAUDE_MD_MAX_CHARS` = 20,000, and it is CHOSEN, NOT MEASURED.** Roughly twice
what the file needs to say what it says, so an honest addition fits and a session
record does not.

**The 150,000 figure was not used, and the reason is that it could not be
established.** It comes from the warning the user saw, quoted in this session's
brief. The installed CLI — version 2.1.251, a 197 MB binary — was searched for it
and for any string tying a size to `CLAUDE.md`; the only `150000` found is in an
unrelated browser-tools chunk. So it is recorded in the script's comment and in
the guidelines as the **outer bound**, with 20,000 chosen far enough under it
that the warning can never fire again.

**Proven failing, four ways, on scratch copies — the real file was never
grown.** `FRAMOPIA_CLAUDE_MD` re-points the check, the same device
`FRAMOPIA_REFERENCE_ROOT` gives the reference gate:

| case | result |
|---|---|
| the file as it stood before the move, 530,588 chars | **exit 1**, naming both numbers |
| 20,001 characters | **exit 1** |
| exactly 20,000 | exit 0 |
| a path with no file | **exit 1**, naming the path and the errno |

`CLAUDE.md`'s sha256 is `d6e1083b…` before and after those four runs.

**`docs/CLAUDE_CODE_GUIDELINES.md` §5 is rewritten** and is the boundary the next
twenty-seven sessions read. It names what belongs in `CLAUDE.md` — six things —
and carries a table of what does not and where each kind goes instead. It ends
with the sentence that was missing: **a session updates `CLAUDE.md` only when the
map changed** — a new directory, a new document, a block finishing, a standing
rule added or retired — and leaving it alone is the normal case.

### 6. Nothing was lost, proven line by line

Every non-blank line of the original was searched for, verbatim, in the six
destination files. **7,692 non-blank lines; 70 not found.** Those 70 are, exactly
and completely: the `# CLAUDE.md` title, the four-line preamble about the SSD,
the `## What this is` paragraph, the 47-line repo map, the two `##` headings, and
the four convention bullets — **every one of which stays in `CLAUDE.md`**, the
first three rewritten rather than copied.

**The original is `git show 1c8c850:CLAUDE.md`** — the last commit before the
move, `docs: record the client photographs control and the outgoing-path guard`.
That command is named in five places: the top of the archive, and each of the
four destination sections.

### 7. What a future session actually does now

The brief's real question is whether a session building a feature still learns
what it needs. What changed is the route, not the knowledge:

- **It reads `CLAUDE.md` whole**, which it could not do before — at 530,588
  characters the file was being truncated and nobody knew where.
- The last table in it names every document and what it holds, so *"where does
  the panel get its Node binary from"* leads to `docs/ARCHITECTURE.md`, and
  *"what did he decide about photographs"* leads to `docs/PROJECT_SPEC.md`.
- **Those are files a session already opens.** Every session brief in this
  project has begun *"read `docs/CLAUDE_CODE_GUIDELINES.md`, `docs/PROJECT_SPEC.md`
  and `docs/ARCHITECTURE.md` first"* — the three documents that took 108,771 of
  the 126,000 characters of rules. The knowledge moved **towards** the sessions,
  not away from them.
- Anything historical is in `reports/`, which is where a session was already told
  to look for what the last one did.

---

## Deviations

**The 77 rules were moved as one titled section per document rather than woven
into the existing numbered sections.** Weaving them in would mean rewriting
carefully-worded, measured text to fit a surrounding argument — which is exactly
how a figure gets rounded and a ruling gets paraphrased, and the brief forbids
both. Each rule keeps its own heading and its own words; the section around them
says where they came from. It is the difference between moving furniture and
rebuilding it.

**Two homes were created that the brief did not name.** `docs/COMMANDS.md`,
because 23,559 characters of command reference cannot live in a file that must
be read in seconds and is not architecture, a ruling or a working rule. And
`reports/operating-memory-archive.md`, because the brief's home for session
history is `reports/` and the per-session reports already exist — the archive
exists so that *nothing was deleted* is a fact rather than an inference from a
93.4% token match.

**`## What this is` and the repo map were rewritten rather than moved.** They are
orientation, they stay, and three of their statements were false. Every detail
dropped in the rewrite was first confirmed to exist elsewhere; the check is in
§4 above.

**No code changed and no test was added.** The size check is a script in
`scripts/`, alongside `check-extendscript.mjs`, so it can print the number it
measured and the limit it measured against in one line of the gate's output.

## Failures & open problems

**Unproven, by name:**

- **The 150,000-character limit could not be established.** It is used as an
  outer bound and named as unconfirmed, in the script and in the guidelines.
- **20,000 is chosen, not measured**, and nothing establishes that it is the
  right size for a file a session reads first. What would establish it is a
  session that finds the file too thin — and that is a failure this gate would
  not catch.
- **Nobody has read the four destination documents end to end since the move.**
  Each is 1.5 to 3.7 times its previous size, and whether a rule reads well in
  its new neighbourhood is a judgement no measurement here made.
- **The archive is 378,101 characters and nothing points at any part of it.**
  It exists so that nothing was deleted; the per-session reports are the better
  copy and the archive says so in its own first paragraph.

**Open, and untouched as the brief required:** `preflight.ts` does not check a
chosen client picture's file; a client's photographs are not in the backup set;
`ground-truth` cannot build until its pictures are bought; the three
false-premise tests from session 20; `build-reel.jsx`'s unsaved-changes guard
across two checkouts; and the panel's intermittent image-picker tests — which
**did not flake** in this session's two full `npm run check` runs.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `75e33b0` *test: fail the check when CLAUDE.md outgrows its limit* (this report follows) |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at both ends |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c`, 552,745 bytes, never opened |
| cache | **46 entries / 80 files / 54,256 KB** at both ends |
| After Effects | **one instance**, 0 `aerender`; the project open at start and end is `.local/build/vitasilk-full.aep`, and nothing was saved by this session |
| free space | **157 GiB** |
| credit remaining | **about $6.64**, unchanged |
| `CLAUDE.md` | 530,588 → **8,497 characters**, sha256 `d6e1083b9dc257422b0d6f157a7df0327b3922b80fd98a30697241aa1dc35e02` |

**Hand-made references, sha256, identical at both ends:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Edit Plans, sha256.** `ground truth` is unchanged; the other four moved for one
reason only — `npm run golden` builds all four and each build writes a fresh
`builtAt`. No session code touched a plan.

```
start                                                             end
0712e412…  ground truth   →  0712e412…  (unchanged)
dbe14b78…  test 1         →  cba10e18…  (golden's builtAt)
289e4403…  test 2         →  e6d3a423…  (golden's builtAt)
6847e16b…  test 3         →  1b05174b…  (golden's builtAt)
bd0f00d9…  vitasilk       →  27a6d376…  (golden's builtAt)
```

**`npm run check`: PASS** (exit 0), read from the run's own output. **No test was
added or removed, so every count is unchanged** — the new gate is a script, and
its line is the addition:

| workspace / gate | before | after |
|---|---:|---:|
| core | 751 | 751 |
| service | 1208 | 1208 |
| benchmarks | 173 | 173 |
| panel | 204 + 2 skipped | 204 + 2 skipped |
| pytest | 149 | 149 |
| modes | `mode k2-syndicalia v12: ok (fonts set)` | unchanged |
| ExtendScript | 15 `.jsx` ok | unchanged |
| **claude-md** | — | **`claude-md: 8,497 of 20,000 characters`** |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| panel manifest | `panel/CSXS/manifest.xml ok` | unchanged |
| references | `6 hand-made reference file(s): 4 transcript, 2 alignment` · `PASS` | unchanged |
| attribution | `PASS` | `771 tracked text file(s), 734 commit message(s)` · `PASS` |

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field: test-1 4415,
test-2 4280, test-3 3709, vitasilk 4770, **17,174 fields**, against the reference
recorded 2026-08-31, After Effects 26.0x67, 1198 font names. The reference was
**not re-recorded**.

## Suggested next step

**Read the four destination documents once, end to end.** They are the only part
of this that a measurement cannot answer: 77 rules landed in four files in one
move, each keeping its own words, and whether `ARCHITECTURE.md` now reads as one
document or as two stapled together is a judgement. The most likely finding is
that a handful of §9 rules are really rulings and belong in `PROJECT_SPEC.md`
§10, or the reverse — a cheap correction now, and an entrenched one after another
twenty sessions cite them where they sit.

The other thing worth doing while the file is small: **the next session that
learns something should be watched to see where it puts it.** The gate stops
`CLAUDE.md` growing; nothing yet proves the guidelines' table is the thing a
session reaches for instead.

## Commits

| | |
|---|---|
| `87969db` | `docs: move CLAUDE.md's knowledge into the documents that hold it` |
| `fd92579` | `docs: make CLAUDE.md the short file it was meant to be` |
| `75e33b0` | `test: fail the check when CLAUDE.md outgrows its limit` |
| this one | these reports |
