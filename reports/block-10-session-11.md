Status: OK

# Block 10 session 11 — the project runs from any folder

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131e5cda5c9`,
byte-identical at both ends**. Cache **46 entries / 79 files / 55,363,681 bytes**
at both ends, nothing created. `templates/library.aep` **`1d7553e894e10f82`** at
both ends. All five Edit Plans untouched — last written 2026-08-30 20:30 or
earlier, before this session began. One After Effects instance (pid 79146)
throughout, zero `aerender`, **no project saved**.

---

## The finding

**Every Edit Plan stored absolute paths rooted at the drive this project grew up
on** — 52 of them across the five plans. `docs/SECOND_MACHINE.md` handled it by
telling the partner to put the repository at that exact path, which he cannot:
he clones from GitHub onto his own disk and does not own that drive.

`resolveStoredPath` re-roots each one **at read time**, onto whatever repository
is running. **The file keeps what it says; the reader gets a path that works
here.** Proven by cloning the repository to a second absolute path and running
the whole corpus from it.

---

## A. The resolver

`core/src/stored-path.ts`, 132 lines. It **does not guess**. Four outcomes, and
each is a decision it can defend:

| the stored path | what happens |
|---|---|
| already inside the repository running now | returned unchanged |
| contains a repository anchor (`my files`, `.local`, `benchmarks`, …) | re-rooted onto this repository |
| absolute and inside no repository | returned unchanged — it is a real path to somewhere else |
| empty, or not absolute | **throws `StoredPathError` naming the field** |

**Order matters and is deliberate.** "Already here" is tested first, so a path
that legitimately lives in this repository and happens to contain an anchor word
deeper down is never split at the wrong segment.

**`REPO_ANCHORS` is pinned against the real directory listing.** A test reads
`readdirSync(REPO_ROOT)` and fails if a top-level directory exists that the
anchor list does not know — so a new folder cannot silently become the one thing
that will not resolve on the second machine. 21 tests, including one that
asserts every absolute path on all five real plans resolves without throwing.

**It is the same shape as a precedent this repo already trusts.**
`readTranscriptionCache` has always recomputed `audioPath` from the entry's own
directory rather than believing the manifest, which is why a cache entry was
already portable. The plans now get the same treatment.

## The three read sites

Routing happens at chokepoints, not at call sites — there are twenty of the
latter and three of the former.

- **`readEditPlan`** (`service/src/editplan/io.ts`) — six kinds of field:
  `source.videoPath`, `source.audioPath`, `clientMode.path`,
  `watermark.assetPath`, and every candidate's `path` and `cutoutPath`.
- **`loadReels`** (`service/src/frames/footage.ts`) — the single source of every
  downstream `reel.path`.
- **`countCandidatesOnDisk`** (`service/src/steps.ts`) — parses a plan directly
  rather than going through `readEditPlan`, so it resolves explicitly.

**A consequence, stated rather than discovered later:** a read-modify-write
cycle persists the resolved form. That is self-healing, not a migration — a plan
written on the second machine names the second machine's paths, and a plan
written here names these. Either resolves on either machine.

**A grep test pins the rule** (`service/src/editplan/stored-paths.test.ts`).
It strips comments, then fails on any module under `service/src` or `tools` that
`JSON.parse`s a plan **and** reads a path field **without** going through
`resolveStoredPath` or `readEditPlan`. **Proven to fail**: reverting `steps.ts`
alone produced `expected [ 'service/src/steps.ts' ] to deeply equal []`.

---

## B. The proof — the whole corpus, from a second copy

A sandbox at `…/framopia-portable-check`, made with `cp -Rc` — an APFS
copy-on-write clone, so **18 GB apparent and free space 157.6 GB before and
after**, in **8.98 s**. It carried `.local` (767 MB), the footage (12 GB), the
cutouts (51 MB), `node_modules` and both `dist` directories. Never pushed from,
never committed from.

**It self-resolved.** `REPO_ROOT` reported the sandbox, because it resolves from
the module's own location.

**The resolver, on real data:** the file on disk still says the original paths;
`readEditPlan` hands back sandbox paths for all six fields; **24 absolute paths
on the resolved plan, 0 of them not on disk**; every catalogued reel rooted in
the sandbox.

**Four reels built from the sandbox and four from the original**, each one
censused in After Effects immediately after its own build:

| reel | from the sandbox | from the original |
|---|---:|---:|
| vitasilk | 5.561 s | 4.950 s |
| test-1 | 4.550 s | 4.824 s |
| test-2 | 2.357 s | 2.331 s |
| test-3 | 2.325 s | 2.192 s |
| ground-truth | refused, `UnplaceableElementsError` | refused, the same |

**Every census is identical once the repository root is normalised.** Summaries
identical field for field; the only differences are `measuredAt` and
`aepSha256`, both expected — After Effects embeds a timestamp in the file it
writes, so two builds of the same comp never have the same bytes.

**Nothing was bought and nothing missed.** The sandbox's dry run read `$0.0000`
for `vitasilk`, `test-1` and `ground-truth`, all stages skipped, `10 of 10` and
`8 of 8` candidates cached; the sandbox's ledger was byte-identical at both ends.

**Session 10's two gaps are closed by relocation.** The transcription entry hits
with `HIT=true` and its audio resolved to the sandbox while the manifest still
names the original — the recompute the known limitation described, observed.
The analysis, image-slot and image manifests carry **zero** absolute paths, and
the image payload's `image.jpg` was on disk.

## `.local/audio/` is not wanted by a build

Session 10 flagged it as the item in the transfer set most likely to be wrong.
Deleted **from the sandbox copy only** — the original's five files were verified
present before and after — the sandbox still built `vitasilk` in 5.54 s, and its
dry run still resolved the transcription entry as `compatible` at `$0.00`.
Nothing downstream of transcription reads it: the build's pre-flight lists
`source.videoPath` and never `source.audioPath`.

**The restore half is read, not run.** `service/src/transcription/job.ts` copies
`cached.audioPath` to the canonical location on a cache hit, so a transcription
run would recreate the folder. Running one is billable and was not authorised,
so that sentence stands on the code rather than on a run, and is written that
way in `docs/MACHINE_REQUIREMENTS.md`.

## The sandbox is gone

Removed after four checks, each of which refuses rather than proceeding: the two
paths are not equal, the name is the one this session created, it is a git
checkout, and it does **not** contain this session's own report. Free space
**161 GB before and after** — a clone shares its blocks, so removing it reclaims
almost nothing. The original's top-level listing is unchanged and its working
tree held only the three files this session edited.

**The sandbox's path appears in no committed file**, checked after the fact.

---

## Two deviations, both reported rather than smoothed over

**The build's unsaved-changes guard cannot recognise another checkout's output.**
`build-reel.jsx` tests `openFile.fsName.indexOf(o.buildDir) === 0`, so each
checkout recognises only **its own** `.local/build`. The sandbox refused to
build while the original's output was open, and then the original refused while
the sandbox's was. Worked around with a guarded `release.jsx` that closes
without saving **only** when the open project's `fsName` matches an expected
path exactly, with the `.aep`'s bytes verified unchanged either side
(`e480effc4aa2a5de…`). It refused correctly when handed the wrong expectation,
which is the evidence the guard works. **Not fixed** — it is a real question
about what that rule should say when two checkouts exist, and it is not this
session's to settle.

**The sandbox was removed while After Effects still held its project.** My
ordering error: the last no-audio build saved into the sandbox, and `rm -rf`
then left After Effects holding a dirty project whose file did not exist. Closed
with the same guarded release — nothing of the user's was in it, the project was
created by this session and its file was already gone — leaving After Effects on
an **empty untitled project, not dirty, zero items**, which is the state this
repo already documents as holding no work.

---

## C. The documents, and whether `repo` is falsifiable

**`docs/SECOND_MACHINE.md`** no longer names a path. "Put the repository at
exactly this path" is replaced by "put it wherever you like", with the old rule
explained so a reader who meets it elsewhere knows why it is gone. Every
`cd "/Volumes/…"` became `cd "<repo>"` — six of them — and the drive no longer
appears in the file at all. The cache-transfer step now says "into the same
places *inside the repository* — the repository itself can be anywhere".

**`docs/MACHINE_REQUIREMENTS.md`** requirement 1 is "the repository in **any**
folder this account can read and write", and the known limitation records that
the 52 stored paths are now harmless, with what proved it.

**The doctor's `repo` check** no longer says "the repo has to be at this exact
path". It is "the repository, wherever it is", it reports the root it resolved,
it now also checks the folder is **writable**, and it carries a note saying a
particular path is not required.

**Is `repo` falsifiable at last? No — but it is no longer unfalsifiable for the
reason it was.** It cannot report `absent` while it is running, because the code
doing the reporting had to be loaded from the repository to run at all; that is
a property of where the check lives, not of what it asserts. What did change:
the check now has a second failure mode that is reachable — a repository in a
folder this account cannot write — and it was **demonstrated varying**, which it
never had been. Run from the sandbox it reported the sandbox root; run from the
original it reported the original; **21 present, 0 absent, 3 could not be
determined, of 24** in both. Session 10 listed `repo` among three checks never
seen failing, and that list is now honest about the difference between "never
seen failing" and "seen reporting two different true things".

---

## Close-out

| | |
|---|---|
| ledger | **118 lines, `3f657131e5cda5c9`** — identical at both ends |
| `templates/library.aep` | **`1d7553e894e10f82`** — identical at both ends |
| Edit Plans | all five untouched; last written 2026-08-30 20:30 or earlier |
| cache | **46 entries / 79 files / 55,363,681 bytes**, nothing created |
| cutouts | 19 files |
| references | 6 — four hand-written ground truths, two hand-made alignment references |
| After Effects | **1 instance (pid 79146)**, 0 `aerender`, no project saved |
| project left | empty untitled, not dirty, 0 items |
| free space | **173.2 GB** |
| sandbox | **removed**, verified against the original's path first |

**`npm run check`: PASS.** core **672**, service **1168**, benchmarks **166**,
panel **159 passed + 2 skipped**, ExtendScript **14 `.jsx` ok**.

**An earlier run of the same command failed, and it was contention rather than a
defect.** Six panel browser tests timed out at 5000 ms while builds were still
settling; the panel suite passed alone (159 + 2 skipped) and the full check
passed on a second run with After Effects idle. The same class of thing Block 7
session 11 measured on the cutout suite. Reported because a red check that turns
green on a re-run is exactly the kind of thing a session should not quietly drop.

**`app.fonts.allFonts` reads 445, and the 1198 carried since session 5 does not
reproduce.** It read 445 before this session touched anything and 445 after, so
nothing here moved it, and no font was written this session. What matters for a
build was checked rather than assumed: **all three K2 faces are present** —
`Inter-SemiBold`, `CormorantGaramondItalic-SemiBoldItalic`, `Almarai-Bold`. Why
the number moved between session 10 and now is **not established**, and is not
guessed at here.

**No secret was printed, logged, echoed, or written into any report, document,
artifact or commit** — not a value, not a prefix, not a length, not a hash.

## Commits

| | |
|---|---|
| `d70529d` | `feat: resolve a stored path against the repo running now` |
| `de5869f` | `fix: route every stored path through the resolver` |
| this one | the documents, the doctor's `repo` check, and these reports |
