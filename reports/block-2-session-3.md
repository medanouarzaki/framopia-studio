Status: OK

# Block 2 — session 3

Prompt versioning, guide v1.0.4, drift instrumentation, cost accounting, the
transcription CLI, the version 2 validation run, a vacuous-test sweep, and two
pieces of tidying.

## Read this first

### WER on the Block 1 reel under version 2

**Overall WER did not move: 22.2% under both versions.** Not a degradation of
more than a point — not a change at all. The two subsets moved in opposite
directions and cancelled:

| ground-truth reel, 81 ref words | overall | darija | fr/en |
|---|---|---|---|
| v1 (run C, recorded) | 22.2% | 25.0% | 12.5% |
| v2 | **22.2%** | **26.7%** | **6.3%** |
| change | 0.0 | +1.7 worse | −6.2 better |

Only 4 of 81 tokens differ. One is the fr/en gain (`pigmentés?` → `pigmentées`,
agreeing with `les cernes`). The other three are the entire darija regression:
v2 dropped a short vowel in `awal` → `awl`, `7el` → `7l`, `l7el` → `l7l`, where
the ground truth writes the vowel. **I have not decided whether version 2
stands** — that is yours. Version 2 is active in code; rolling back is one
constant (`ACTIVE_PROMPT_VERSION` in `service/src/transcription/correction.ts`).

### Every `ou` token in both v2 outputs, classified

**ground-truth v2** — 4 tokens, identical to v1's set:

| token | context | classification |
|---|---|---|
| `l7loul` | `lik joj dial l7loul awl 7l houa` | long vowel /uː/ (§3) — legitimate |
| `houa` | `l7loul awl 7l houa الإبرة الحريرية li` | frozen §4 spelling — legitimate |
| `houa` | `sana l7l ttani houa la mésothérapie li` | frozen §4 spelling — legitimate |
| `houa` | `la mésothérapie li houa wa7d cocktail dial` | frozen §4 spelling — legitimate |

**vitasilk v2** — 1 token, identical to v1's:

| token | context | classification |
|---|---|---|
| `ynourri` | `mn ghir anno ynourri yhydrati fih 26` | French root *nourrir* (§5) — legitimate |

**Zero conjunction corruptions, in either version, on either reel.** Every
standalone `و` in both drafts came out as `w` under v1 as well as v2. Version
2's rule is shown not to hurt; it is not shown to help, because there was
nothing to fix on these reels.

### Token-count drift

| reel | draft | v1 | v1 drift | v2 | v2 drift |
|---|---|---|---|---|---|
| ground-truth | 75 | 81 | 8.0% | 81 | 8.0% |
| vitasilk | 73 | 73 | 0.0% | 73 | 0.0% |
| vitasilk (live CLI run, fresh Scribe) | 70 | — | — | 70 | 0.0% |

Nothing crosses the 15% warning threshold.

### Total spend: $0.317768

Four new lines in `.local/costs.jsonl`, quoted in full:

```
{"stage":"promptv2-validation-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.10368,"note":"prompt version 2 validation on the recorded ground-truth scribe draft; no scribe call made","timestamp":"2026-08-24T22:30:31.358Z"}
{"stage":"promptv2-validation-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.1369,"note":"prompt version 2 validation on the recorded vitasilk scribe draft; no scribe call made","timestamp":"2026-08-24T22:33:09.136Z"}
{"stage":"transcribe-scribe","model":"scribe_v2","unit":"run","usd":0.0015700857944444444,"timestamp":"2026-08-24T22:35:39.152Z"}
{"stage":"transcribe-gemini-correction","model":"gemini-3.1-pro-preview","unit":"run","usd":0.07561799999999999,"timestamp":"2026-08-24T22:35:39.158Z"}
```

The validation pair was estimated at $0.1873 and cost $0.2406 — 28% over,
because thinking tokens ran 18.1x visible output on the ground-truth call and
8.7x on vitasilk, against the estimator's assumed 5x.

### Vacuous-test sweep

31 `toBeCloseTo` call sites across the three workspaces. **Two were genuinely
vacuous, both fixed; one of them was asserting something false.** Everything is
listed under Done.

## Done

- **Preflight.** T7 mounted; `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`.
  Clean tree, on `main`, in sync, no untracked files. Baseline `npm run check`
  **green, 161 tests** (core 20, service 33, benchmarks 108).
- **Prompt versioning** (`refactor: make the correction prompt
  version-selectable`) in `service/src/transcription/correction.ts`. Both
  versions are constructible at runtime via `buildCorrectionPrompt(draft,
  { version })`. **Version 1 was verified byte-identical to the Block 1 frozen
  prompt** (`buildHybridCorrectionPrompt` in `benchmarks/src/engines/hybrid.ts`),
  with and without keyterms, before any call was made. Four tests, including a
  structural check that strips the conjunction rule and the keyterms line from
  both and asserts the remainders match exactly.
- **ORTHOGRAPHY_GUIDE v1.0.4** (`docs: freeze bach in the orthography guide
  (v1.0.4)`). `bach` (باش) added to the §4 freeze list under a new v1.0.4
  block, version header bumped with the one-line reason. `bach` added to the
  freeze-list JSON. §6(a) untouched. The session-2 test that pinned `bach` as a
  false positive now asserts it is conformant.
- **Drift instrumentation** (`feat: report token-count drift between the draft
  and the correction`) in `service/src/transcription/drift.ts`.
  `DRIFT_WARNING_THRESHOLD = 0.15` with a comment saying it is a starting value
  chosen without evidence. Nine tests. To test "the result is returned in both
  cases" without an API, the pure tail of `transcribeHybrid` is now
  `assembleHybridResult`.
- **Cost breakdown and ledger legs** (`feat: account for scribe and gemini
  costs in the hybrid result`). `transcribeHybrid` now requires `durationS` and
  returns `cost: { scribeUsd, geminiUsd, totalUsd }`; it prints an estimate
  before the first billable call and appends both legs. Five tests using the
  recorded vitasilk usage numbers.
- **CLI** (`feat: add a cli entry that transcribes a video end to end`) at
  `service/src/transcribe-cli.ts`, `npm run transcribe -- --video <path>`.
  ffmpeg extraction per ARCHITECTURE §5.1, Scribe, correction, alignment,
  artifact to `.local/transcripts/<name>.json`. Cost gate with confirmation
  unless `--yes`. `service/src/transcription/job.ts` registers the same code as
  the `transcribe` job type via a new `registerJobRunner` in `jobs.ts`, so the
  HTTP path cannot diverge; the CLI runs without the server.
- **Version 2 validation** (`test: compare correction prompt version 2 against
  the block 1 baseline`) — `benchmarks/RESULTS-block2-promptv2.md`, with the
  full token diff for both reels, the `و` mapping, the `ou` classification, WER
  against ground truth, drift, cost and wall-clock. Scribe was not re-run: the
  recorded drafts from `benchmarks/results/2026-08-24T20-34-32-007Z/raw/` and
  `.../2026-08-24T21-47-38-860Z/raw/` were replayed, so the prompt is the only
  variable. Reel choice: `ground-truth`, because it is the only Block 1 reel
  that is both scored in run C and the one the human timestamp spotcheck used.
- **Live end-to-end run.** `transcribeHybrid` executed for the first time, on
  `my files/test videos/vitasilk.mov`. $0.077188, 84.8 s, 70 tokens, 0% drift,
  no warnings, both ledger legs written.
- **Vacuous-test sweep** (`test: replace assertions that cannot fail`):
  - `core/src/pricing.test.ts:7` — **fixed, and it was asserting a falsehood.**
    "is zero for zero-duration audio" expected 0; the real value is **0.004**,
    because the orthography guide's ~2000 prompt tokens are charged whatever
    the duration. It passed only because 0.004 is inside the default 0.005
    tolerance. Now asserts the fixed guide-prompt cost at precision 12, plus
    `toBeGreaterThan(0)`.
  - `benchmarks/src/engines/scribe.test.ts:40` — **fixed, fully vacuous.**
    Expected `(30/3600)*0.22` ≈ 0.00183 at default precision, so any value in
    roughly [0, 0.0068] passed, zero included.
  - `benchmarks/src/engines/scribe.test.ts:32,36` — fixed. Not vacuous but
    loose (0.005 tolerance on 0.22 accepts a 2% pricing error) and hardcoded
    $0.22/$0.264 rather than deriving from config — the same class as the known
    bug. Now derived from `SCRIBE_USD_PER_AUDIO_HOUR` and
    `SCRIBE_KEYTERM_SURCHARGE` at precision 12.
  - Tightened for rigour though not vacuous: `core/src/costs.test.ts:30,31`
    (0.3, 0.5); `benchmarks/src/wer.test.ts:16,23,30,66` (1/3, 1/2, 0.5);
    `benchmarks/src/timestamps.test.ts:25,26,39` (0.1, 0.5 — a 5 ms tolerance
    on a timestamp-deviation test); `benchmarks/src/engines/hybrid.test.ts:42,
    57,58,59` (0.65, 0.725, 1.15, 1.575 — interpolated timings, where 5 ms of
    slack hides real interpolation error).
  - Already explicit, left alone: the ten sites added in sessions 2–3
    (`core/src/pricing.test.ts:54,63,81,100`, `service/src/transcription/
    align.test.ts:62,70,71`, and the `cost.test.ts` and `drift.test.ts` sites).
  - **Flagged, not fixed:** `service/src/transcription/cost.test.ts:20` asserts
    `totalUsd` equals `scribeUsd + geminiUsd` using the result's own fields. It
    is the right assertion for "the total is the sum of its parts" but cannot
    catch both components being wrong together; the other four tests in that
    file cover the components independently.
  - No other assertion found that cannot fail. `toBeUndefined()` in
    `jobs.test.ts:15,23` and the `toBeGreaterThan(0)` confidence checks are
    genuine.
- **Tidying** (`chore: keep compiled tests out of the service build`).
  `service/tsconfig.json` now excludes `src/**/*.test.ts`; `service/dist/`
  rebuilt clean, zero test files.
- **CLAUDE.md** updated for prompt versioning and the active version, guide
  v1.0.4, drift, the cost breakdown and both ledger legs, and the CLI.

### npm audit — investigated, nothing changed

All five findings are one root cause: `vitest@2.1.4` and its `vite`/`esbuild`
chain. **All are devDependencies; none is reachable from anything we ship.**
The service ships `@google/genai` and `@framopia/core` only.

| package | severity | advisory | reachable? |
|---|---|---|---|
| `vitest` (direct) | critical | GHSA-5xrq-8626-4rwp — arbitrary file read/execute when the Vitest **UI server** is listening | No. We only ever run `vitest --run`; `--ui` is never invoked. |
| `vite` | high | GHSA-4w7w-66w2-5vf9 path traversal in optimized-deps `.map`; GHSA-fx2h-pf6j-xcff `server.fs.deny` bypass **on Windows**; GHSA-v6wh-96g9-6wx3 launch-editor NTLM disclosure **on Windows** | No. No Vite dev server is ever started, and two of the three are Windows-only. |
| `esbuild` | moderate | GHSA-67mh-4wv8-2f99 — any website can read dev-server responses | No. Requires a running dev server. |
| `@vitest/mocker` | moderate | transitive via `vite` | No. |
| `vite-node` | moderate | transitive via `vite` | No. |

A fix exists — `vitest@4.1.11` — but it is a **breaking major bump** (2.x → 4.x)
across all three workspaces. Not attempted, per instruction.

## Deviations

- **`freeze-list.json` lives at `benchmarks/src/freeze-list.json`**, not
  `benchmarks/freeze-list.json` as the prompt said. Used the real path.
- **`PROMPT_VERSION` was renamed `ACTIVE_PROMPT_VERSION`.** With two versions
  now constructible, a bare `PROMPT_VERSION` would not say which of the two it
  names. The result field is still `promptVersion`.
- **`transcribeHybrid`'s signature changed twice** — it now requires
  `durationS`, and `costUsd: number` became `cost: HybridCostBreakdown`. Both
  are breaking, and both are the point of Goal 5; nothing outside the module
  called it.
- **The validation experiment used a throwaway script**, written under
  `service/src/`, run, and deleted rather than committed. The method and the
  exact source paths are recorded in the results document, and the raw v1/v2
  outputs are kept at `benchmarks/results/promptv2/` (gitignored with the rest
  of `results/`). A committed harness would be worth having if this comparison
  is repeated; it is not worth it for one run.
- **Ledger stage for the validation calls** is `promptv2-validation-gemini`,
  distinct from the production `transcribe-*` stages, with a `note` saying no
  Scribe call was made — otherwise the ledger would imply two full hybrid runs.
- **The live CLI run was on `vitasilk.mov`**, so it exercised ffmpeg extraction
  from ProRes rather than reusing an existing `.wav`.
- **New dev dependency:** `tsx` added to `service/` to run the CLI from source.
  Already used by `benchmarks/` and already in the tree; no new package.

## Failures & open problems

- **The version 2 experiment changed two things at once and ran each version
  once.** The conjunction rule and the keyterms reordering moved together, so
  the 1.7-point darija regression cannot be attributed to either, and it may
  simply be run-to-run variance in a preview model. There is no noise floor: a
  repeat under version 1 on the same recorded draft would establish one and was
  not done.
- **The `و` rule remains unvalidated in the sense that matters.** The bug did
  not occur under version 1 on either reel, so nothing tested whether the rule
  prevents it. Run B is still the only sighting.
- **The brand name is not stable across runs.** Three calls produced three
  renderings of the same unknown proper noun: `Vita Silk` (recorded v1),
  `Vita silk` (v2 replay), `Vitasilk` (live CLI run). Session 1 recorded the
  brand as self-consistent; that held within a run and does not hold across
  runs. Version 2 also lowercased `Filler Glow` → `filler glow` at all
  occurrences. This makes keyterm prompting look more load-bearing, not less.
- **The thinking-token multiplier is too low.** `THINKING_TOKEN_MULTIPLIER = 5`
  in `core/src/pricing.ts` produced an estimate 28% under actual; the two calls
  ran 18.1x and 8.7x. Not changed — changing an estimator mid-session with two
  data points would be trading one guess for another — but it is now known low.
- **`transcribeVideo` and the job runner have thin coverage.** Two tests cover
  registration and the missing-`videoPath` failure. The success path is covered
  only by the single live run; `extractAudio` and `probeDurationSeconds` have
  no unit tests, and the correction retry path and every `scribe.ts` error path
  remain unexercised.
- **The CLI writes into `.local/transcripts/` and `.local/audio/`** by default,
  which no cleanup touches. Extracted WAVs accumulate.
- **Nothing caches.** Each run re-extracts audio and re-pays for both calls.
  `ACTIVE_PROMPT_VERSION` exists to feed the fingerprint; the cache does not.
- The 15% drift threshold has never been crossed, so the warning path is
  covered by unit tests only and has never fired on real output.

## Repo state

- Branch `main`, pushed to `origin/main`.
- HEAD: `docs: update operating memory for the transcription cli`.
- Nine commits this session, in the specified order.
- `npm run check`: **green, 180 tests** — core 20, service 52, benchmarks 108.
  Baseline was 161.

## Suggested next step

The version 2 ruling is yours and it gates the rest: if you want the darija
regression separated from noise before deciding, the cheapest experiment is a
second version 1 call on the same recorded ground-truth draft (~$0.09), which
gives a same-prompt noise floor to compare the 1.7 points against — worth doing
before treating that number as signal, since three tokens produced it. Either
way the next build step is caching, and it is now the highest-value one: the
fingerprint inputs already exist (`ACTIVE_PROMPT_VERSION`, the model pin, the
guide version), every experiment so far has re-paid for calls it could have
replayed, and a cache would have made this session's validation nearly free.
After that, Edit Plan schema v1 over the transcript artifact the CLI already
writes, plus the language/script tagging and subtitle grouping BLOCKS.md wants
for Block 2. Two smaller things worth folding in: the brand-name instability
argues for testing keyterms on vitasilk now rather than later, and
`THINKING_TOKEN_MULTIPLIER` should be re-derived once a handful more calls have
been recorded rather than guessed again.
