Status: OK

# Block 12 session 73 — a skipped test no longer looks like a passing one

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — start, after `npm run check`, after `npm run golden`, and at the end.**
Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.

**The counts did not move, and that is the correct result.** No test was added
and nothing that used to skip now runs: what changed is that the gate refuses to
reach those tests with the thing they test missing.

---

## 1. Every test that skips itself

**37 skip conditions across 13 test files.** They fall into three kinds, not the
two the brief expected — the third is named rather than forced into the others.

### A — cannot run on this machine. Skipping is correct.

| test | condition | untested if wrongly met |
|---|---|---|
| `align-sheet.browser` ×2 (core) | `!!launchFailure` | the review sheet a person opens, if chromium will not launch |
| `frame-colour` (service) | `!existsSync(SIDECAR_PYTHON)` | the frame colour on real pictures, without the CV venv |
| `audio-path` (service) | `FFMPEG === null` | where a video's audio is written, without ffmpeg |
| `materialised` (service) | `cloudOnly() === null` | the cloud-only file check, when this Mac has no such file |
| **`capabilities` — *"the bundle is not built, so the capability gate is skipped with a notice"*** | `skipIf(built)` | nothing — see below |
| **`render.browser` — *"the built panel is not built, so the browser check is skipped with a notice"*** | `skipIf(built)` | nothing — see below |

**The two panel skips in the signature, finally named.** They have been there
since before Block 11 and nobody had said what they were. They are **inverse
guards**: they exist so that an *absent* bundle produces a loud notice rather
than silence, and they skip precisely because the bundle **is** built. On a
machine where the bundle exists there is genuinely nothing for them to test, so
this is the right kind of skip and it hides nothing.

### B — skips because the thing it tests is missing. This is the defect.

| test | condition | what goes untested |
|---|---|---|
| `spawn.integration` (5 tests) | `!ENTRY_BUILT` → `service/dist/service.js` | the panel's whole route to a healthy service |
| `job.integration` | `!existsSync(BUILD_CLI)` → `service/dist/build/build-reel-cli.js` | the build job, spawned |
| every `skipIf(!built)` panel block (18 blocks) | `panel/dist` | every browser test there is |
| `new-video` | `!ready` — ffmpeg **and** the vitasilk reel **and** the CV venv | a video the tool has never seen |

Closed in §2 for the artefacts. `new-video`'s condition is kind A in part — it
needs the corpus and the sidecar — and is left alone.

### C — a known-failing test, kept deliberately

**`no-colours.test.ts` — `it.skip('does not come out in K2 Syndicalia's four')`.**
This is **the one skip in the service signature**. It is not "cannot run here"
and not "the thing is missing": it runs fine and it fails. Session 55 measured
that a client created with no palette comes out in K2's four colours exactly, and
closing it needs somebody to say what a client with no colours *should* look
like — a decision about taste. The test stays as the record so the day it is
decided the answer is already written.

**Forcing this into one of the two kinds would have made the report tidier and
wrong.**

## 2. The absent case, closed

**What it did before, measured.** With `service/dist/service.js` removed:

```
 ✓ src/spawn.integration.test.ts (8 tests | 5 skipped) 2ms
      Tests  3 passed | 5 skipped (8)
exit=0
```

**Green, having tested nothing.** That is the shape that hid a broken compiled
service for seventy sessions: green when the artefact is absent, green when it is
current, red only in the narrow window between.

`scripts/check-artefacts.mjs` runs **after the builds and before the tests**.
That position catches both causes and does not need to tell them apart: a build
nobody ran leaves the artefact missing, and a build that ran and wrote nothing —
or wrote it somewhere else — leaves it missing too. It checks the artefact, not a
build's exit status.

**Proved three ways.**

**Absent → red:**

```
check: FAIL — the gate is about to run tests against artefacts that are not there.
Each of these is executed by a test that SKIPS when it is missing, so leaving
them absent would give a green run that tested nothing.

  service/dist/service.js
      spawn.integration.test.ts spawns it with a bare node binary, and skips without it
      built by: npm run build --prefix service

The build steps above run earlier in this script. One of them produced nothing.
exit=1
```

**Stale → red**, session 72's case, still caught by the tests themselves:

```
check: 5 compiled artefacts present before the tests run
integration tests exit=1
SyntaxError: The requested module '@framopia/core' does not provide an export named 'MODES_DIR'
```

**Current → green:**

```
check: 5 compiled artefacts present before the tests run
integration tests exit=0
      Tests  8 passed (8)
```

**No skip condition was removed.** A test that genuinely cannot run without
something still says so; what changed is that the gate no longer arrives at it
with the thing missing.

**And one dependency stopped being invisible.** `panel/dist` was built only as a
side effect of the panel workspace's own `test` script. The gate now builds it
outright, because a dependency that works because something else happens to run
first is one nobody can see — and the artefact check has to run before the tests,
not in the middle of them.

## 3. What the gate now says about skips

Quoted from the real run:

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
check: 37 skip conditions across 13 test files — a skip is a test that did not run, and is counted here so a green total never hides one. reports/block-12-session-73.md names every one and says which are correct.
```

It reads the conditions out of the source rather than re-running the suites,
which would double the gate for a number the suites have already reported.

## 4. Everything suppressing errors while moving a user asset

**Swept, and the honest answer is that there is nothing in the repository to
fix.**

| where | found |
|---|---|
| `scripts/*.sh`, `scripts/*.mjs`, `tools/` — `2>/dev/null`, `\|\| true` near `mv`/`cp`/`rm` | **none** |
| every `renameSync`/`copyFileSync`/`rmSync`/`unlinkSync` in `core/src`, `service/src`, `panel/src`, `tools` — 39 call sites, scanned for a swallowing `catch` within five lines | **none** |
| `docs/*.md`, as instructions someone would paste | **none** |

**The one instance was a session's own shell command** — session 71's
`mv … 2>/dev/null`, which moved nothing and reported that it had. It was never
committed code, which is exactly why the rule belongs where sessions read it.

Written into `CLAUDE.md`, beside the never-delete rule:

> **Moving a user's file aside never hides its errors, and is verified after.**
> Session 71 moved three files to a quarantine directory with `2>/dev/null`,
> moved nothing, and reported that it had. List the destination afterwards and
> say what is actually in it, or the claim is untested.

`CLAUDE.md` is 12,829 of its 20,000 characters and the gate's own limit check
passes.

**Proved by demonstration**, the suppressed form against the rule's form:

```
=== session 71's shape: errors suppressed, no verification ===
  exit=1 — and it printed nothing
  files in destination: 0

=== the rule: errors kept, destination verified ===
mv: rename nonexistent-a.json to …/quarantine-demo/nonexistent-a.json: No such file or directory
mv: rename nonexistent-b.json to …/quarantine-demo/nonexistent-b.json: No such file or directory
  exit=1
  files in destination: 0 — checked, not assumed
```

The first is a silent failure a report can be written on top of. The second
cannot be mistaken for success.

## 5. Every new assertion, red then green

All three are in §2 and §4 verbatim: the artefact check red on absence and green
when present; the integration tests still red on staleness; the move rule
reporting a failure instead of swallowing it.

**Nothing was added to a test suite**, which is why no count moved. The
protection is in the gate, ahead of the suites, because the defect was that the
suites could not see their own preconditions.

## 6. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run after committing. **`npm run golden`:
PASS** — 4415 + 4280 + 3709 + 4770 = **17,174**, field for field.

```
check: 5 compiled artefacts present before the tests run
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk …
check: 37 skip conditions across 13 test files …
```

| suite | passed | skipped | total | session 72 |
|---|---|---|---|---|
| core | **813** | 0 | **813** | 813 — unchanged |
| service | **1421** | 1 | **1422** | 1421 — unchanged |
| benchmarks | **173** | 0 | **173** | 173 — unchanged |
| panel | **270** | 2 | **272** | 270 — unchanged |

**No test was added and no count moved**, deliberately. The one service skip is
§1's kind C; the two panel skips are §1's inverse guards. Nothing that used to
skip now runs, because none of them was skipping for a reason this session
removed — the artefacts were all present on this machine already, and what was
fixed is the gate's behaviour when they are not.

**Five panel runs, each with its exit status:** 270 passed, 2 skipped (272),
exit 0 — five times.

**Part 0, as found at both ends:**

| | at start | at end |
|---|---|---|
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |
| **ledger lines** | **165** | **165** |
| **ledger sha256** | **`786497a5f371d179…`** | **`786497a5f371d179…`** |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/.gitkeep` | `e3b0c44298fc1c14…` | same |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | same |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | same |
| `assets/client-pictures/` | 0 files | 0 files |

The ledger was re-checked after `npm run check` and after `npm run golden`: 165
lines, `786497a5f371d179…`, unchanged at both.

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**`.local/` at the start:** `audio` 27 · `bench-audio` 5 · `build` 70 · `cache`
159 · `cv` 2234 · `deleted-clients` 0 · `doctor` 1 · `evidence` 3 ·
`ground-truth` 10 · `plans` 66 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `quarantine-session69` 3
· `quarantine-session71` 0 · `transcripts` 1. `modes/` holds its three files and
`.local/plans/` its seven plans at the end, after every suite ran to completion.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 7. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after the
gate, after golden, and at the end. Nothing here could bill: a file-existence
check, a count of skip conditions, and a rule written down.
