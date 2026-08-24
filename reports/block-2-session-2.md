Status: OK

# Block 2 — session 2

Workspace unification, three benchmark fixes, and the production hybrid module
ported into `service/`. Mechanical and zero-cost, as specified.

## Read this first

**Zero API calls were made this session** — no ElevenLabs, no Google, live or
otherwise. `.local/costs.jsonl` gained no lines: its last entry is still
`2026-08-24T21:48:47.862Z` (`benchmark-hybrid`), written by the previous
session's vitasilk run, and the file is 27 lines before and after.

**Corrected vitasilk orthography figure: unchanged at 98.6%.** The matcher fix
does not reach this case, and the reason matters. The prescribed fix — an exact
freeze-list hit is never reported as a near-miss of a different entry — cannot
help `bach`, because **`bach` is not in `freeze-list.json`** (the list is 52
words; `wach` is there, `bach` is not). Two further facts I verified rather
than assumed: exact-match precedence was already the *emergent* behaviour of
the old code (it took the minimum edit distance, so `dial` never lost to
`diali`), and `bach` was flagged only because nothing on the list matches it
exactly. So the specified rule was a no-op on observed behaviour. I implemented
it anyway, as an explicit short-circuit rather than a side effect of a
comparison, and pinned it with tests — that is what makes the pending decision
safe: the moment `bach` is added to the freeze list, the exact-match rule takes
over and the flag disappears. Until then it stands. What remains at 98.6%:

- `bach` — flagged as a near-miss of `wach` (edit distance 1). One flag, 73
  words, nothing else: zero digit substitutions, zero `sh`/`ch` errors, 4 of 5
  freeze-list occurrences exact.

I did not add `bach` to the freeze list or touch the guide, as instructed. The
only other way to kill this class of false positive without a dictionary would
be to stop counting an edit at the *first* character as a near-miss (`bach` vs
`wach`, `houa` vs `doua`), since frozen-spelling violations are almost always
internal vowel choices. That is a scoring-semantics change and it is yours to
call, not mine — flagging it, not doing it.

**Ledger line format test: passes byte-identically against a pre-refactor
sample.** `core/src/costs.test.ts` writes a known entry, substitutes only the
timestamp, and compares to a line lifted verbatim from `.local/costs.jsonl` as
written before the move:
`{"stage":"benchmark-scribe","model":"scribe","unit":"run","usd":0.0014212344055555555,"timestamp":"..."}`
— key order, number formatting and all. A second test pins that the `note`
field serializes in place after `usd`.

**Ported correction prompt — what I think is wrong but left alone.** Two
things, neither touched:

1. The prompt tells the model it may "add or remove words to match what is
   actually said", immediately after telling it the draft "may contain
   recognition errors". Nothing bounds how far that licence goes, and this is
   the same prompt that produced the `a lala` insertion and the `ولقيتي` split.
   Those were correct, but the instruction would equally permit a rewrite, and
   the alignment layer downstream absorbs insertions silently by interpolating.
   A cap ("do not change the word count by more than N%") or an explicit
   instruction to preserve token count where possible would make the alignment
   layer's job honest. Left as-is: changing it is a prompt change and would
   invalidate the Block 1 evidence.
2. The keyterms block is appended *after* the JSON-shape instruction, so the
   last thing the model reads before answering is a vocabulary list rather than
   the output contract. It has not caused a malformed response in any recorded
   run, but it is the wrong order.

Also worth stating plainly: `PROMPT_VERSION = 1` is **not** the prompt the
Block 1 evidence was gathered with. It differs by the added `و` → `w`
conjunction rule. Nothing has exercised that rule — no run, live or otherwise —
so it is an unvalidated divergence, recorded as such in a comment in
`correction.ts` and in CLAUDE.md.

## Done

- **Preflight.** T7 mounted; `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`.
  Clean tree, on `main`, in sync with origin, no untracked files. Baseline
  `npm run check` **green, 128 tests** (service 14, benchmarks 114).
- **npm workspace** (`chore: convert the repo to an npm workspace`). Root
  `package.json` gains `workspaces: ["core", "service", "benchmarks"]`. The
  two per-package lockfiles are replaced by one at the root. `npm run check`
  is still the single entry point: it builds `@framopia/core`, then runs
  typecheck, lint and tests across every workspace via `--workspaces
  --if-present`.
- **`@framopia/core`** (`refactor: move config and cost ledger into a shared
  core package`) at `core/`. Now holds `config.ts` (both `AIza` and `AQ.`
  prefixes still accepted, never rejected on prefix), `costs.ts` (`CostEntry`
  with `note?`, `appendCost`, `readCosts`), `pricing.ts` (Scribe rates,
  `estimateScribeCost`, `estimateGeminiCallCost`, `computeGeminiCost`,
  `estimateCosts`), `model-config.json` (the Gemini model pin and prices),
  `paths.ts`, and their tests. **Neither duplicate survives**: no
  `config.ts` or `costs.ts` exists under `service/src/` or `benchmarks/src/`
  in any form.
- **Three benchmark fixes**, each its own commit with tests:
  - `fix: estimate dry-run cost from the real input duration` — `--dry-run`
    now ffprobes the real `--audio` file. Verified end to end against
    `vitasilk.mov`: it prints `Estimated cost for 25.7s of audio … total:
    $0.1013`, which is exactly the figure last session had to compute by hand.
    Falls back to the 1.1s fixture span only when the file does not exist, and
    warns when it does so. The probe is injectable so the test needs no ffprobe.
  - `fix: keep dry runs out of the stable spotcheck mirror` — a dry run writes
    its per-run spotcheck and nothing else; the test asserts
    `latest-spotcheck/` is not even created.
  - `fix: stop the freeze-list matcher flagging exact matches as near-misses` —
    see above.
- **Production hybrid module** at `service/src/transcription/`:
  `types.ts` (`TranscriptWord`, structured `TranscriptionError` carrying stage
  / cause / retryable / status per ARCHITECTURE §8), `scribe.ts`,
  `correction.ts`, `align.ts`, `index.ts` (`transcribeHybrid`). Nothing calls
  it and it is not wired to the job framework. No fallback path: a correction
  failure throws rather than returning the Scribe draft.
- **Fixtures** at `service/fixtures/`, copied from
  `benchmarks/results/2026-08-24T21-47-38-860Z/raw/` and trimmed to the opening
  span. Tests read only from `service/fixtures/`, never across into
  `benchmarks/results/`.
- **Tests** (`test: cover alignment across insertions, deletions and splits`) —
  15 alignment tests, all asserting timings rather than mere return:
  one-to-one match, substitution keeping its anchor timing, confidence not
  propagated, single insertion strictly between anchors (1.5 between 1 and 2),
  a run of insertions spread evenly and ordered, insertion before the first
  and after the last anchor, deletion mid-sequence and at the end, the real
  `ولقيتي` → `w` + `l9iti` split, and the degenerate cases (empty corrected,
  empty draft, all-null draft timings, both empty). Plus 8 correction-prompt
  tests and 3 Scribe-mapping tests.
- **CLAUDE.md** updated for the workspace, `core/`, the transcription module
  and its not-yet-wired status, the three fixes, and `PROMPT_VERSION`.

## Deviations

- **`core/` took more than config and the ledger.** Also moved: pricing
  constants and `computeGeminiCost` (required by `estimateCosts`, which the
  prompt did place in core — leaving the Gemini half in `benchmarks/` would
  have split pricing across two packages, the exact drift being killed);
  `paths.ts` (`REPO_ROOT`/`LOCAL_DIR` were duplicated the same way);
  `SCRIPT_RULES`, `normalizeToken` and the Levenshtein `align` (the production
  module needs all three, and copying them into `service/` would have
  recreated the problem on day one). `benchmarks/` re-exports the moved
  symbols from its old module paths, so its internal imports are unchanged.
- **`bench-config.json` → `core/src/model-config.json`**, export renamed
  `benchConfig` → `modelConfig`. Its prices had to move with the pricing code.
  This made two lines of `docs/DECISION-transcription-config.md` — the freeze
  record — describe a path that no longer exists, so I updated the path and
  noted the move inline. No decision content was touched.
- **No net test-count change from the move, and that is not a loss.**
  `benchmarks/src/config.test.ts` (3 tests) was deleted with its duplicate
  file rather than merged: all three cases are covered by the service-side
  suite that became `core/src/config.test.ts` (5 tests). Three new tests were
  added in core (two ledger-shape, one pinning the session-4 re-costing),
  which is why the total stayed at 128 across the refactor.
- **`core` builds to `core/dist/` and consumers import the built output.**
  Pointing the package at TypeScript source would have broken `node
  dist/server.js`. Consequence: anything running workspace code must build
  core first, so `check`, `bench`, `bench:tag` and `bench:aggregate` all do.
  The documented service start command gains `npm run build:core &&`.
- **The moved `computeGeminiCost` tests were rewritten, not copied.** The
  originals asserted against hardcoded $1.25/$10 rates while the config says
  $2.00/$12.00, and passed only because `toBeCloseTo` defaults to two decimal
  places on numbers around 1e-3 — they could not fail. They now derive
  expectations from `modelConfig` at precision 12. This is a test fix during a
  move, which I would normally avoid; leaving a vacuous test in the new shared
  package seemed worse. Behaviour of the code itself is unchanged.
- **Two extra test files beyond the required alignment coverage**
  (`correction.test.ts`, `scribe.test.ts`), committed with them.
- **New dependency:** `@google/genai@^2.16.0` added to `service/`. Not new to
  the repo — `benchmarks/` already had it, and it is the official SDK for the
  pinned model. Everything else in the new module is Node built-ins.

## Failures & open problems

- **`PROMPT_VERSION = 1` contains an unvalidated rule.** The `و` → `w`
  addition has never been run. Until it is, no evidence describes this prompt.
- **`transcribeHybrid` has never executed.** Every test covers a piece —
  alignment, prompt construction, response parsing, Scribe mapping — but the
  composed function, the live Scribe call, and the live Gemini call are all
  untested by construction, since this session made no API calls. The retry
  path in `correction.ts` and every error path in `scribe.ts` are likewise
  unexercised.
- **`transcribeHybrid` does not report Scribe's cost.** Scribe bills per
  audio-hour and the response carries no duration, so `costUsd` is the
  correction call only; the caller must add `estimateScribeCost(durationS, …)`.
  That is a trap for the integration session and belongs in the wiring.
- **Nothing appends to the cost ledger yet.** ARCHITECTURE §8 wants every
  billable call recorded; the module returns costs and leaves writing to the
  caller, which does not exist. If integration forgets, calls go unrecorded.
- **Alignment interpolation is still only as good as its anchors.** With a
  Darija draft in Arabic script and Arabizi corrected output, most tokens do
  not match textually, so anchors are sparse — the same limitation behind the
  "29 of 73 matched pairs" figure in last session's report. The tests prove
  the interpolation is monotonic and in-bounds; they cannot prove it is right.
- **`service/dist/` contains compiled test files.** `tsconfig.json` includes
  all of `src` with no test exclude. Pre-existing, harmless, untidy; not fixed.
- **`npm audit` reports 5 vulnerabilities** (3 moderate, 1 high, 1 critical)
  in the hoisted dev dependency tree, unchanged by this session's work and not
  investigated.
- I did not re-run the full benchmark or any engine. The corrected orthography
  figure comes from re-scoring the transcript already on disk.

## Repo state

- Branch `main`, pushed to `origin/main`.
- HEAD: `docs: update operating memory for the workspace and transcription module`.
- Ten commits this session, in the specified order.
- `npm run check`: **green, 161 tests** — core 20, service 33, benchmarks 108.
  Baseline was 128; the increase is 3 ledger/pricing tests, 5 freeze-list
  tests, 2 dry-run tests, and 26 in the new transcription module.

## Suggested next step

Wire `transcribeHybrid` to the job framework and validate the one thing this
session added blind. Those belong together: the integration session should run
the composed module against `vitasilk.wav` and at least one Block 1 reel under
`PROMPT_VERSION = 1`, and diff the output against the recorded run C and
vitasilk transcripts — that is the cheapest possible validation of the `و` →
`w` rule, because the recorded outputs are already on disk and the only new
spend is one correction call per reel (~$0.11 each). If the rule changes
nothing, it costs nothing and the divergence closes; if it changes something,
better to know before the pipeline is built on it. Fold in the two prompt
concerns above at the same time if you want them addressed, since they need
the same validation run and the same `PROMPT_VERSION` bump. After that:
Scribe cost accounting in the caller, ledger writes on both calls, the cache
layer keyed on the fingerprint `PROMPT_VERSION` now exists to feed, and Edit
Plan schema v1. The one thing still waiting on you is the `bach` decision —
adding it to `freeze-list.json` with a guide version bump is the only in-scope
fix for the last remaining orthography flag.
