Status: OK

# Block 12 session 72 — the gate builds what it runs, and a video's cost is the real one

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — start, after `npm run check`, after `npm run golden`, and at the end.**
Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.

**A correction to session 71's report is in §10.** It claimed three files were
moved to `.local/quarantine-session71/`; that directory is empty and they are
gone.

---

## 1. Every artefact the gate runs

| artefact | what executes it | built by `check` before this session |
|---|---|---|
| `core/dist` | every workspace's tests, through `@framopia/core` | **yes** — `npm run build:core` |
| `panel/dist` | the browser tests load `panel/dist/index.html` | **yes** — the panel workspace's own `test` script is `node scripts/build.mjs && vitest --run` |
| `service/dist` | `spawn.integration.test.ts` spawns `service/dist/service.js` with a bare node binary | **no** |
| `benchmarks/dist` | nothing — it does not exist on this disk and nothing references it | not applicable |
| `tools/cv/.venv` | the sidecar's pytest run | no, and it should not be — a ~1 GB model download is not a gate's work |

**If `service/dist` were stale, what happens is worse than a plain failure.** The
integration tests are `it.skipIf(!ENTRY_BUILT)`, so:

- artefact **absent** → the tests **skip silently** and the gate is green
- artefact **current** → they pass and the gate is green
- artefact **stale** → they fail

The gate was green at both ends and red only in the narrow window between, which
is how this survived as long as it did. Session 71 hit that window by renaming a
symbol in `core`.

`npm run check` now runs `npm run build --prefix service` immediately after
`build:core`, before anything that could execute it.

## 2. The proof, and what it costs

**With the artefact made stale exactly as session 71 found it** — the compiled
`catalogue.js` importing a name `core` no longer exports:

```
   × the panel’s route to a healthy service > spawns it with a bare node binary and reaches a healthy /health
SyntaxError: The requested module '@framopia/core' does not provide an export named 'MODES_DIR'
   × what happens around a running service > comes up cold, and quickly enough not to be waited on
SyntaxError: The requested module '@framopia/core' does not provide an export named 'MODES_DIR'
   × what happens around a running service > refuses to start a second service over a live lock
```

**The same stale artefact, with the gate's new build line first:**

```
exit: 0
      Tests  8 passed (8)
```

**What it costs.** The service build from cold, with `service/dist` deleted:

```
npm run build --prefix service  2.42s user 0.22s system 170% cpu 1.552 total
```

**1.55 seconds.** The whole gate this session took **11:52.92**, so the build is
about **0.2%** of it. Nothing is skipped to stay fast and nothing is made
conditional on inputs having changed — a gate that decides for itself whether to
rebuild is a gate that can decide wrongly, which is the defect being fixed.

## 3. How far back this reaches, measured

**`npm run check` has never built `service/dist`.** Measured rather than
estimated: `git log -S "build --prefix service" -- scripts/check.sh` returns
nothing at all.

The test that spawns it landed in **`4f83def`, 2026-08-27**, *"test: prove the
panel's route to a healthy service"*. Since that commit, **70 distinct session
reports** have been committed.

**The exposure was bounded, and that is worth saying too.** `npm run golden`
does build the service — `npm run build:core && npm run build --prefix service &&
tsx tools/golden/cli.ts` — and golden ran in every one of those sessions, so the
artefact was never more than one session stale. What a session running `check`
before `golden` actually tested was **the previous session's compiled service**.

## 4. Why the per-video gap exists, from the code

`recordStageSpend` in `service/src/editplan/costs.ts` writes both figures:
`byStage[stage]` is replaced with this run's cost, and `spentByStage[stage]`
**accumulates** — `(spentByStage[stage] ?? 0) + thisRunUsd`. `mergeIntoExistingPlan`
carries `spentByStage` and `spentUsd` forward from the existing plan rather than
resetting them, calling them the floor in as many words, and `clearBlocks`
deletes `byStage[stage]` when a transcript changes but **leaves `spentByStage`
alone**. A re-run therefore adds; a retry that never returned never billed and
never records; a discarded result loses its `byStage` entry and keeps its
`spentByStage` one.

**So the accumulator is right, and it only ever accumulated what it saw.**
`spentUsd` and `spentByStage` are *"absent on every plan written before Block 4
session 7"*, in the schema's own words. Spend billed before that field existed —
and spend onto a plan later replaced — is in the ledger and in no plan. That is
the $5.595868, and no code change can recover which reel it belonged to.

## 5. The per-video figures, before and after

**Nothing moved, and that is the honest result.**

| reel | before | after | plan | ledger | basis | $/second |
|---|---:|---:|---:|---:|---|---:|
| sora-995f2d27 | $3.822113 | **$3.822113** | $3.822113 | $0.000000 | plan | $0.0943 |
| sora-6a60ced1 | $1.551460 | **$1.551460** | $1.551460 | $0.000000 | plan | $0.1148 |
| vitasilk | $1.550444 | **$1.550444** | $1.550444 | $0.000000 | plan | $0.0603 |
| test 1 | $1.220660 | **$1.220660** | $1.220660 | $0.000000 | plan | $0.0555 |
| test 2 | $0.412818 | **$0.412818** | $0.412818 | $0.000000 | plan | $0.0185 |
| ground truth | $0.176484 | **$0.176484** | $0.176484 | $0.000000 | plan | $0.0076 |

**No figure moved, because the ledger knows no video yet.** All 165 lines predate
Block 12 session 68, which is when a line began carrying the video it was for, so
`ledgerUsd` is zero for every reel and every one falls back to its plan.
**Measured: 0 of 165 lines carry a video.**

The mechanism is in place and correct — where the ledger knows a reel it is the
floor, because it is written at the point of spend and cannot hold less than was
charged — and it will move figures as soon as there is post-session-68 spend.
**It did not fix history and this report does not imply it did.** The $5.595868
stays unattributable, never guessed at, never inferred from the cache, never
assigned by time.

**No plan was edited, no `spentUsd` was written, and the 165 lines are untouched.**

## 6. What the screen says a figure is made of

Under each reel, in plain words rather than a label:

> **from what was actually charged — this video's own record says only $4.00**
>
> **from this video's own record, and every charge since agrees**
>
> **from this video's own record — no charge yet says which video it was for**

Today every reel shows the third. A test reads the rows and requires each to say
one of these and never to contain `source:`.

The unattributable total is still shown and still says what it is.
**`leave-the-panel.test.ts` passes unchanged** — nothing here names a command,
and session 67's sentence remains the only exemption.

## 7. Every new assertion, red then green

**The gate's build line** — §2, both states verbatim.

**A reel whose ledger lines exceed its plan.** Mutated so it always prefers the
plan:

```
 FAIL  src/money.test.ts > a reel’s real cost > shows what was charged when the plan claims less
AssertionError: expected 4 to be 9 // Object.is equality
- 9
+ 4
```

Restored byte-identical, green re-verified.

The five service assertions also pin: the cost per second moving with the
corrected figure; the plan winning when it is the larger; the fallback when the
ledger knows no video; and that the **real** ledger today gives `basis: plan` and
`ledgerUsd: 0` for every reel — so the claim in §5 is asserted, not just measured
once.

No panel assertion reads the whole screen's `textContent`, and none holds a live
Playwright handle.

## 8. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run after committing, **11:52.92** wall.
**`npm run golden`: PASS** — 4415 + 4280 + 3709 + 4770 = **17,174**.

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

| suite | passed | skipped | total | session 71 |
|---|---|---|---|---|
| core | **813** | 0 | **813** | 813 — unchanged |
| service | **1421** | 1 | **1422** | 1416 passed |
| benchmarks | 173 | 0 | 173 | 173 |
| panel | **270** | 2 | **272** | 269 passed, 271 total |

**+5 in service**, all in `money.test.ts`, read by name:

1. `a reel's real cost > shows what was charged when the plan claims less`
2. `… > moves the cost per second with it`
3. `… > keeps the plan's figure when it is the larger`
4. `… > falls back to the plan when the ledger knows no video`
5. `… > reads the real ledger, which knows no video yet`

**+1 in panel**, in `money.browser.test.ts`:

6. `the money screen > says what each video's figure is made of`

1416 + 5 = 1421 and 269 + 1 = 270. Both close exactly, and **core did not move**.

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
· **`quarantine-session71` 0** · `transcripts` 1.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 9. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after the
gate, after golden, and at the end. Nothing here could bill: a build step, a
comparison between two records, and a sentence.

## 10. A correction to session 71's report

Session 71 reported: *"The three scratch clients my own deliberate kill created
went to `.local/quarantine-session71/` — moved, not deleted."*

**That directory exists and is empty.** Searched: the three filenames appear
nowhere in the repository except `.local/quarantine-session69/`, which holds its
own copies from that session. The `mv` in session 71 was written with
`2>/dev/null`, so if it moved nothing the error was swallowed and never seen —
and the report's claim was never checked against the disk.

**Nothing unique was lost.** The files were scratch clients written by
`new-video.test.ts`, and byte-identical copies of all three are preserved in
`quarantine-session69`. But the claim was wrong, the empty directory is left in
place rather than tidied away because it is the evidence, and **which run removed
them could not be established from what is on disk** — so that is reported as
unknown rather than guessed at.
