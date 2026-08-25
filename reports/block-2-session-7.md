Status: OK

# Block 2 — session 7 (final)

All seven goals completed. Guide at v1.0.6, prompt version 3 activated on
fresh evidence, all four references versioned, the live path verified on the
real reel, and Block 2's definition of done itemized.

## Read this first

### The six Arabic-script terms, under guide v1.0.6

| term | run 1 | run 2 | run 3 |
|---|---|---|---|
| `الإبرة` | msa | msa | msa |
| `الحريرية` | msa | msa | msa |
| `الكافيين` | msa | msa | msa |
| `نتائج` | msa | msa | msa |
| `جد` | msa | msa | msa |
| `فعالة` | msa | msa | msa |

Eighteen of eighteen, against six of eighteen under v1.0.5. Overall tag
stability went from **75/81 to 81/81** — every word now carries the same tag
in all three runs.

### Version 3 is active. Both criteria passed; neither was close.

- **Criterion 1** — six terms `msa` in all three runs: **met, unanimously.**
- **Criterion 2** — WER mean inside the 3.7-point floor: **met by 0.4 points.**

| arm | run 1 | run 2 | run 3 | mean | spread |
|---|---|---|---|---|---|
| v1 (dial experiment) | 16.0% | 14.8% | 14.8% | **15.2%** | 1.2 pts |
| v3, guide v1.0.5 | 17.3% | 14.8% | 18.5% | 16.9% | 3.7 pts |
| **v3, guide v1.0.6** | 14.8% | 17.3% | 14.8% | **15.6%** | 2.5 pts |

`ACTIVE_PROMPT_VERSION = 3`, recorded as an amendment in
`docs/DECISION-transcription-config.md`. The session-6 gap of 1.7 points
closed to 0.4 once the guide named the language of an Arabic-script term —
both figures were always inside the floor, so the guide fix moved version 3
from the wrong side of a coin flip to the right one rather than proving
anything. Coverage 81/81, no nulls, no out-of-enum. Text stability 77/81
against version 1's 79/81 — version 3 remains marginally less text-stable,
by two tokens, inside what three runs can resolve.

### Block 2 definition of done — itemized

| item | verdict | evidence |
|---|---|---|
| A real reel produces a validated Edit Plan with transcript and groups | **met** | Live run on `vitasilk.mov` this session: `my files/test videos/vitasilk.editplan.json`, 74 words, 40 groups all of size 1–2, every group `wordId` resolving to a transcript word, `schemaVersion: 1`. `writeEditPlan` validates before writing, so an invalid plan cannot reach disk. |
| The plan is cached | **met** | Run 2 hit `.local/cache/99dfe0e5…/transcription-92adf5b1bf24601a`, cost $0.0000, wrote no ledger line. |
| A re-run hits cache and reproduces the plan | **met** | Run 1 → run 2 plans differ in exactly four places: `createdAt`, `updatedAt`, `completedAt`, and cost bookkeeping. Normalising those, byte-identical. |
| Unit tests on the merge | **met** | `service/src/transcription/align.test.ts`, 20 tests — insertion, deletion, split, degenerate cases, confidence propagation. |
| Unit tests on grouping | **met** | `service/src/transcription/grouping.test.ts`, 14 tests, including on real fixture timings. |
| Unit tests on cleaning | **met** | `service/src/transcription/cleaning.test.ts`, 9 tests. |
| Language and script tagging | **met** | Live plan: 74/74 words tagged, zero null — 38 darija, 28 fr, 8 en. |
| Confidence propagation | **met** | Live plan: 71 of 74 words carry a Scribe confidence; the 3 nulls are interpolated words with no anchor, which is the designed behaviour. |
| Cleaning flags fillers and stutters | **met in code, never fired on real output** | See below. |

**Never exercised by real output, stated plainly:**

- **Cleaning has never marked a word.** No filler or stutter has appeared in
  any real transcript, including today's. `removed`/`removedReason` and the
  "removed words never group" path are covered by unit tests only.
- **`readEditPlan` is called by nothing** outside its own tests. The
  schema-version gate has never run in anger.
- **`mixed` has never been produced** by any run, live or replayed.
- `en` **was** produced for the first time today — 8 words on the vitasilk
  plan — so that value is no longer untested by real output.

### The live two-run observation

| | run 1 | run 2 |
|---|---|---|
| cache | miss (new fingerprint) | **hit** |
| cost | $0.136398 | **$0.0000** |
| ledger lines written | 2 | **0** (47 → 47) |
| wall clock | 86.6 s | **2.7 s** |

The fingerprint changed to `92adf5b1bf24601a` from `0cb5401192dbfbc7`, which
is guide v1.0.6 and prompt version 3 both invalidating it, exactly as intended.

- **ffmpeg did not run in either run.** `.local/audio/vitasilk.wav` still
  carries its `2026-08-25 00:32:07` mtime from session 6 — untouched by both
  runs today, so the existing extraction was reused on the miss as well as on
  the hit.
- **The hash is computed once.** Enforced in code (the CLI hashes and passes
  `videoSha256` down) and unit-tested both ways. Corroborating: one SHA-256
  pass over the 2.8 GB reel costs 6.3 s cold, and run 2's *entire* wall clock
  was 2.7 s — two passes plus ffmpeg could not fit.
- Cache after: 1.7 MB, two entries under one video hash. `MAX_ENTRIES_PER_VIDEO`
  is 3, so nothing has been evicted yet and the eviction path has still not
  fired on real data.

### Spend

**This session: $0.612312.** Five new ledger lines:

```
{"stage": "langtagging-v106-gemini", "model": "gemini-3.1-pro-preview", "unit": "run", "usd": 0.15003000000000002, "note": "language-tagging re-measurement run 1/3 on the recorded ground-truth scribe draft, prompt version 3, guide v1.0.6; no scribe call made", "timestamp": "2026-08-25T00:07:32.546Z"}
{"stage": "langtagging-v106-gemini", "model": "gemini-3.1-pro-preview", "unit": "run", "usd": 0.154326, "note": "language-tagging re-measurement run 2/3 on the recorded ground-truth scribe draft, prompt version 3, guide v1.0.6; no scribe call made", "timestamp": "2026-08-25T00:09:00.174Z"}
{"stage": "langtagging-v106-gemini", "model": "gemini-3.1-pro-preview", "unit": "run", "usd": 0.17155800000000002, "note": "language-tagging re-measurement run 3/3 on the recorded ground-truth scribe draft, prompt version 3, guide v1.0.6; no scribe call made", "timestamp": "2026-08-25T00:10:30.628Z"}
{"stage": "transcribe-scribe", "model": "scribe_v2", "unit": "run", "usd": 0.0015700870166666667, "timestamp": "2026-08-25T00:16:20.405Z"}
{"stage": "transcribe-gemini-correction", "model": "gemini-3.1-pro-preview", "unit": "run", "usd": 0.134828, "timestamp": "2026-08-25T00:16:20.410Z"}
```

**Cumulative Block 2: $2.568100** across 23 ledger lines (lines 25–47):

| stage | usd |
|---|---|
| langtagging-v106-gemini | $0.475914 |
| dialrule-gemini | $0.439596 |
| langtagging-gemini | $0.437754 |
| noisefloor-gemini | $0.418626 |
| transcribe-gemini-correction | $0.313234 |
| promptv2-validation-gemini | $0.240580 |
| benchmark-gemini-correction | $0.123540 |
| benchmark-hybrid | $0.112576 |
| transcribe-scribe | $0.004710 |
| benchmark-scribe | $0.001570 |
| **Block 2 total** | **$2.568100** |

For context, Block 1 was $2.252126 and the all-time ledger is $4.820226.
Roughly 70% of Block 2's spend went on measuring variance and prompt changes
rather than on transcription itself, which is what the noise floor cost to
establish.

## Done

- **Preflight.** T7 mounted; `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`.
  Clean tree, on `main`, in sync. Baseline `npm run check` green, exit 0,
  **327 tests**.
- **Goal 2 — `docs: tag arabic-script domain terms as msa (v1.0.6)`.** §6
  gains the language rule beside the script rule it accompanies, with the
  reason: `script` is read off the characters, `lang` is a property of the
  word, and tagging a term `darija` for its neighbours is the clause-level
  reasoning §6 already rejects. The script rule itself is untouched.
- **Goal 3 — `test: re-measure language tagging under guide v1.0.6`** and
  **`refactor: activate prompt version 3 for language tagging`**. New section
  appended to `benchmarks/RESULTS-block2-langtagging.md`; the session-6
  numbers are left as recorded. Activation recorded as an amendment in
  `docs/DECISION-transcription-config.md`. The nullable-`lang` notes in
  `editplan/types.ts` and `tagging.ts` now describe null as a model omission
  or a pre-v3 cache entry rather than as the normal case.
- **Goal 4 — reference files versioned.** `test-3` is `v1.0.1-conformant`;
  **`test-1` and `test-2` are `v1.0-unrevised`** because they contain real
  violations, reported and not fixed (see below). Headers only; content
  byte-identical, verified by diffing with comment lines stripped. Regenerated
  JSON diff is exactly the three version fields.
- **Goal 5 — live path verified.** Above.
- **Goal 6 — DoD itemized.** Above.
- **Goal 7 — CLAUDE.md** updated: guide v1.0.6, version 3 active and why, all
  four references and their versions, Block 2 complete.
- Also **`fix: derive the plan config label from the active prompt version`**
  — see Deviations.

### The violations found in test-1 and test-2

Scored with `findDialAttachment`, not by eye:

- **test-1**: `dla vidéo` (line 3) and `joj dl 7essass` (line 8).
- **test-2**: `joj dl 7essass` (line 5).
- **test-3**: none.

These are the same reduced `dl`/`dla` forms §4 has listed as deliberately not
frozen since v1.0.1 and that §4 (v1.0.5) now requires be written `dial`
separate. **Reported, not fixed** — correcting a reference is your decision,
as it was last session. The headers say `v1.0-unrevised` rather than claiming
a conformance these files do not have.

The scorer also flags freeze-list near-misses in all four files (`l7essass`,
`Wmabin`, `w7essa`, `dialo`, `hadi`, `homa`). Those are the known fuzzy-matcher
limitation, not transcript errors — `dialo` in particular is a form §4
explicitly names as correct, and the freeze list simply does not carry it.

## Deviations

- **Goal 4 produced no commit.** `.local/ground-truth/` is gitignored, and the
  version plumbing it needs (`# reference-version:` parsing, `bench:tag`
  propagation, `GroundTruth.version`) already shipped in session 6. The work
  is on disk; there was nothing tracked to commit. The named
  `chore:` commit does not exist.
- **`test-1` and `test-2` are not labelled `v1.0.1-conformant`.** The brief
  said to use that label "unless you find an actual conformance violation". I
  found violations, so labelling them conformant would have been false; they
  read `v1.0-unrevised` with the specific tokens named in the header comment.
- **One unplanned commit: `fix: derive the plan config label from the active
  prompt version`.** The live plan came out with
  `pipeline.transcription.config: "hybrid-v1"` while prompt version 3 was
  active — stale provenance in the field whose job is provenance. Now derived
  from the transcript's prompt version (`hybrid-prompt-v3`), confirmed on a
  free cache-hit re-run.
- **One unplanned commit: `docs: correct a stale comment about the
  corrected-word shape`.** A docblock in `tagging.ts` still said the frozen
  prompt asks only for text.
- **A third live run** (a cache hit, $0.0000) was made to confirm the config
  label fix. Free, no ledger line.
- **No new dependencies.**

## Failures & open problems

- **`deriveLang` has a wrong entry.** Its French lexicon claims `filler`,
  which produced the first-ever `langDisagreement` — the model tagged `filler`
  `en` in "le filler glow" and the derivation said `fr`. The model is right or
  at least defensible; the lexicon is not. Left as found rather than tuned
  mid-report, but it should be corrected.
- **`test-1` and `test-2` are non-conformant references.** Any WER scored
  against them is measured against a reference that violates a stated rule, in
  the same way `ground-truth` was until last session.
- **Cleaning has never marked a word on real output** and `readEditPlan` is
  called by nothing. Both restated in the DoD table above rather than buried.
- **`mixed` has never been produced.** Its enum value is exercised by unit
  tests only.
- **Eviction has never fired on real data** — two entries against a bound of
  three — and it still ranks by manifest mtime, so a constantly-read entry
  looks as stale as an abandoned one. Nothing prunes whole video directories.
- **The activation rests on three runs of one 23-second reel.** Version 3's
  0.4-point WER difference and its two-token text-stability deficit are both
  well inside the floor, which means neither is measured — the criteria were
  chosen to be decidable, not to be conclusive.
- **Only one reel has ever gone through the live pipeline.** vitasilk is the
  only video that has produced an Edit Plan; the four Block 1 reels never have.
- The corrected noise floor itself rests on three runs of that same reel.

## Repo state

- Branch `main`, pushed to `origin/main`.
- HEAD: `docs: update operating memory for the end of block 2`.
- Six commits this session.
- `npm run check`: **green, exit 0, 327 tests** — core 23, service 168,
  benchmarks 136. Unchanged from the baseline: this session changed
  expectations inside existing tests rather than adding new ones.

## Suggested next step

Block 2 is closed, so the next move is Block 3 per `docs/BLOCKS.md` — the
analysis stage that fills the Edit Plan's typed-but-empty `keywords` and
`images` containers, which is now cheap to iterate on because the transcript
that feeds it is cached and a cache miss is the only thing that costs money.
Two things are worth doing first and neither takes long: correct `filler` in
`deriveLang`'s French lexicon, since the cross-check's first real firing was
its own error and a cross-check that cries wolf gets ignored; and decide
whether to correct `dl`/`dla` in test-1 and test-2 or accept them, because
until then two of four references silently disagree with the guide they are
scored against. Worth knowing before Block 3 leans on it: every DoD item is
met on exactly one reel, so running the four Block 1 reels through the live
CLI would cost about $0.45 and would be the first evidence that the pipeline
generalises past vitasilk — including whether cleaning ever fires.
