Status: OK

# Block 10 session 10 — the sharing document, and the two things it could not be written without

**Spent $0.00; no API was called.** Ledger **118 lines, sha256
`3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`**,
byte-identical at both ends. `templates/library.aep` `1d7553e894…2dc4a5d8`. All
seven hand-made references identical. **All five Edit Plans identical.** Cache
identical at 46 entries / 55,363,681 bytes / 79 files, nothing created.
`app.fonts.allFonts` **1198 → 1198**. **No secret was printed, logged or
written** — verified by running the repo's own `classifyFile` over every file
this session touched.

**Session 9's design hole is closed**, and the answer to the question the golden
run rests on is **yes: a cache entry survives being copied to another machine.**

## 1. Done

### Preconditions (all nine pass)

Repo at the mount, one After Effects instance, no `aerender`, ledger 118 /
`3f657131…`, library `1d7553e8…`, branch `main` clean at `96ed2a1`, open project
`.local/build/test_3-full.aep` inside `.local/build/`, seven references recorded,
fonts 1198.

### A. The doctor can now tell "scripting is off" from "not running"

Commit `312c2c0`. **It can be done, and the experiment is what settled it.**

`DoScript` returns a status, not the script's value — confirmed:

| sent | returned |
|---|---|
| `2+2` | `0` |
| `String(app.version)` | `0` |
| `var a = 1;` | `0` |
| **`throw new Error("deliberate")`** | **`1`** |
| `app.noSuchProperty.x` | `1` |
| `if (!(true)) { throw … }` | `0` |
| `if (!(false)) { throw … }` | `1` |

**So there is a one-bit channel that needs no file**: a script that completes
returns 0, one that throws returns 1. The doctor now sends
`if (!app.version) { throw new Error('no version'); }` **before** the
file-writing probe, and the two cases come apart:

| a script completed | a result file appeared | verdict |
|---|---|---|
| yes | yes, preference reads on | **present** |
| yes | yes, preference reads off | **absent** |
| yes | yes, preference unreadable | unknown |
| **yes** | **no** | **absent — the preference is off**, with the exact Preferences path |
| no | no | unknown — *"either After Effects is not running, or a DoScript was refused"* |

`scriptingVerdict` in `core/src/doctor.ts` is the decision, **7 tests driven
entirely by injected probe results** — nothing reaches a live host. Both new
branches were also watched end to end through `FRAMOPIA_DOCTOR_AE_STATE`.

**Only the completing case is evidence.** A `DoScript` that returns 1 did
nothing and says nothing about the script, so `answering: false` is not read as
"not running" — it falls to `unknown`, which is why the unknown reason names
both possibilities and says which to rule out first.

The user's preference was read, never written. It is **on** on this machine.

### B. What travels, measured

**`npm run backup` includes**, measured by running its own survey:

| group | files | size |
|---|---:|---:|
| transcription-cache | 22 | 8.1 MB |
| analysis-cache | 13 | 50 KB |
| ground-truth (hand-written transcripts) | 8 | 30 KB |
| align-references (hand-made) | 3 | 15 KB |
| ledger | 1 | 17 KB |
| plans | 10 | 515 KB |
| images (generated pictures and cutouts) | 63 | 95.8 MB |
| config | 1 | 292 B — **classified secret, skipped** |
| footage | 5 | 11.9 GB |

**The key exclusion is enforced by the file's bytes, not its name.**
`classifyFile` in `service/src/backup/secrets.ts` reads the first 64 KB and
matches a field whose name ends `apikey`/`token`/`secret`/`password`/`credential`
carrying 16+ unbroken credential characters, or a value in a shape a provider
publishes. Run over the backup set today it flags **exactly one file**,
`.local/config.json`, and that file is named on screen when skipped rather than
silently omitted.

**`benchmarks/footage.json` now carries a fetch note** (commit `f6753c6`): every
reel has its `sha256` and `bytes`, and the file has a `fetchNote` saying the
reels are the agency's own footage, live beside the repo on the SSD, have no
download, and that a file which does not match is a different cut whose cached
transcription will miss. The doctor reads the catalogue's hash now, with the
Edit Plan's as the fallback. **All five verify**, in 18 s.

| reel | sha256 | bytes |
|---|---|---:|
| test-1 | `365967c9fd2c82f7…` | 2,454,029,392 |
| test-2 | `c3a2ac59de3dc1ec…` | 2,481,948,148 |
| test-3 | `20f8c61d4f01f867…` | 2,402,073,330 |
| ground-truth | `2b3957559a491ee9…` | 2,594,226,244 |
| vitasilk | `99dfe0e530ab85d1…` | 2,873,609,310 |

**The replay set for a $0.00 run**, measured: `.local/cache/` **53 MB**,
`my files/test videos/cutouts/` **53 MB**, the five `*.editplan.json` **308 KB**
— plus the footage at 11.9 GB. **Nothing was copied**; this session establishes
what would be.

**What must never travel**, and why, now written into the document: the API key
(the second machine has its own, and cloud backup refuses it), the ledger
(append-only, and the second machine starts at zero), the watermark measurement
and the loudness records (**measurements of that machine's own copies, taken
there**), and any client's own photograph.

#### The finding the golden run rests on

**A cache entry copied to another machine still hits, and its audio resolves
from wherever it now lives. Measured, not reasoned about.**

Every transcription manifest stores an **absolute** `audioPath` — 11 of them
across the cache. But `readTranscriptionCache`
(`service/src/transcription/cache.ts:181`) does
`const audioPath = path.join(ref.dir, AUDIO)` and **overwrites** the stored value
before returning the payload. Proven by copying one entry into a temporary
directory and reading it there:

| | entry directory | manifest says | read back as | hit |
|---|---|---|---|---|
| real cache root | `<repo>/.local/cache/2b39…/transcription-758a…` | `<repo>/…/audio.wav` | `<repo>/…/audio.wav` | **yes** |
| **relocated copy** | `<tmp>/cachecopy/2b39…/transcription-758a…` | `<repo>/…/audio.wav` | **`<tmp>/…/audio.wav`** | **yes** |

The stored path is provenance and is never read.

**The Edit Plans are a different matter, and the answer is still good.** They
carry **52 absolute paths across the five plans** — `source.videoPath`,
`source.audioPath`, `clientMode.path`, `watermark.assetPath`,
`candidates[].path`, `candidates[].cutoutPath` — and **every one of the 52 points
inside the repository root. None points outside it.** So the plans are portable
**if and only if the repository sits at the same absolute path on both
machines**, which is requirement 1 of `docs/MACHINE_REQUIREMENTS.md` and what the
doctor's `repo` check looks for. The sharing document says so in its own words,
before step 1.

### C. The document

`docs/SECOND_MACHINE.md`, commit `f1758fd`. Fourteen steps, each a command to
paste with what he should see, ending at **`npm run doctor` until it stops
printing blockers** — a condition he can check rather than judge.

It covers the drive and repo, Homebrew, Node via nvm against `.nvmrc`,
`npm install`, ffmpeg, `tools/cv/setup.sh` and `verify-models.sh`, the three
fonts, **the After Effects scripting preference with the exact Preferences path
and why it matters**, `npm run panel:install` and `panel:build`, his own API
keys, the footage, the copied cache, and the two measurements only his machine
can make.

**It says plainly that none of it is verified.** The opening section states that
every fix-it step is a first attempt written from the code, that the doctor marks
its own suggestions *(unverified remedy)* for the same reason, and that his run
is what turns them into facts. **It names the three checks never seen failing** —
repository, Node, dependencies — and says his Mac is their first real test.

**It ends with a table for him to fill in**: worked / what you actually saw, per
step, plus three open questions including *"anything this document said that
turned out to be untrue"*.

Written for a motion designer: short sentences, every technical term explained in
a clause, no step that says "install X" without the command, no step that asks
him to open a file by hand. **It contains no key, token or fragment of one** —
checked with the repo's own classifier.

### D. The disk figure is derived

Commit `78c66bd`. `MIN_FREE_GB` was 20, chosen. It is **19**, derived from
**14.643 GB** measured on 2026-08-31:

| component | GB |
|---|---:|
| the checked-out repository (714 tracked files) | 0.033 |
| `node_modules`, after `npm install` | 0.164 |
| `tools/cv/.venv`, after `tools/cv/setup.sh` | 0.801 |
| the segmentation model | 0.015 |
| the cutout model | 0.906 |
| the five source reels | 11.926 |
| the cache copy | 0.052 |
| the generated pictures and cutouts | 0.052 |
| frames and masks, generated on the machine | 0.584 |
| built `.aep` files and measurements | 0.106 |
| extracted audio | 0.003 |
| **total** | **14.643** |

Plus a quarter again. The components are listed at the constant and the check
says where its figure comes from. **`benchmarks/whisper/models` (4.0 GB) is
deliberately excluded** — the local Whisper baseline is optional, Apple Silicon
only, and not part of `npm run check`; only its `setup.sh` is tracked, and the
git repository itself is **254 KiB packed**.

## 2. Deviations

1. **No remedy was executed**, per §5 — so the document remains unverified by
   construction and says so in its own opening.
2. **Nothing was copied.** The transfer set is measured and described; the copy
   is the partner's session.
3. **`benchmarks/footage.json` gained `sha256` and `bytes` per reel** as well as
   the fetch note. The brief asked for the hash and a sentence; the byte count
   came free from the same measurement and makes a truncated copy visible
   without hashing 12 GB.

## 3. Failures & open problems

**Nothing was destroyed or lost.** No file was moved, renamed or deleted. Ledger,
plans, references, cache, library all byte-identical. The After Effects
preference was read, never written.

### Everything in the document is a guess, and here is which parts most

**All 24 remedies remain unverified** — none has been executed against the state
it claims to fix. Within the document, the parts carrying the most risk, by name:

- **§2 Homebrew and §3 nvm install one-liners.** Copied from those projects'
  published instructions, not run here. A version bump in either URL breaks them
  silently.
- **§6 `tools/cv/setup.sh`.** It has been run on this machine in an earlier block
  and works here; it has never been run on a Mac without Python already present,
  and what it does about that is untested.
- **§7 the fonts.** "Double-click and press Install Font" is how macOS works, not
  something this session confirmed, and the partner may have the faces already
  from a different source under different names.
- **§8 the scripting preference path.** The wording matches After Effects 26 on
  this machine. It was read, never toggled, so **the claim that switching it off
  produces the failure this session now detects is inferred from the code, not
  observed.**
- **§9 the panel appearing under Window → Extensions.** Verified on this machine
  in Block 8; unverified after a fresh install.
- **§12 the copy.** The three folders and their sizes are measured; that copying
  them produces a $0.00 run on another machine is exactly what the golden run
  will test and has not been tested.

### Three checks still never seen failing

**`repo`, `node`, `dependencies`.** Unchanged from session 9 and unfalsifiable
from inside a working checkout. The document names them and tells the partner his
machine is their first test.

### Other

- **The one-bit channel has an untested edge.** If the scripting preference also
  prevented `DoScript` from running a script at all, the liveness probe would
  return 1 and the doctor would say `unknown` rather than `absent`. That is the
  correct answer for that case, but **it is a guess that the preference gates
  writing rather than execution** — inferred from the code, and only the partner's
  machine can settle it.
- **The cache-portability finding covers transcription entries.** Analysis, slot
  and image entries were scanned for absolute paths and carry none, but only the
  transcription case was proven by relocating an entry and reading it back.
- **`.local/audio/` is not in the transfer set.** The plans reference it, but
  `job.ts` restores that file from the cache when it is missing, so it should not
  need copying — **not tested**, and it is the one thing in §12 that could turn
  out to be wrong.
- **Untested:** the panel, CEP `evalScript`, the service's HTTP layer, and the
  second machine itself. Every `DoScript` returned `0` first time.

## 4. Repo state

- Branch **`main`**. Commits: `312c2c0` *fix: tell a blocked scripting preference
  from a dead host*, `78c66bd` *fix: derive the free-space figure instead of
  choosing it*, `f6753c6` *docs: record where each reel comes from and its hash*,
  `f1758fd` *docs: how to set this up on a second mac*, then the reports.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 43 | **651** |
| `framopia-service` | 90 | 1163 |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Core 644 → 651 (7 `scriptingVerdict` tests). `extendscript: 14 .jsx file(s) ok`,
  `references: PASS`, both model pins ok.
- **Ledger: 118 lines, sha256 `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`.**
- All-time spend **$12.365734**; **about $6.64 of credit remains**, unchanged.

## 5. Suggested next step

The document exists and the two things it could not honestly be written without
are settled — a copied cache entry provably still hits, and the doctor can now
name the scripting preference instead of shrugging at it — so the next move is
the partner following `docs/SECOND_MACHINE.md` on his own Mac and filling in the
table at the bottom. That single run converts 24 unverified remedies into
verified ones, tests the three checks that have never been seen failing, and
settles the one thing this session could only infer: whether switching that
preference off produces the failure the doctor is now written to detect. It costs
nothing, it needs no API, and it is the only remaining way to answer Block 10's
actual question. The image purchase for `ground-truth` stays parked at $2.1708
until the model's demand spike passes, and nothing about it blocks the
second-machine run.
