# Block 1, Session 2

Status: OK

## Done

- Full transcription benchmark harness under `benchmarks/` (own TypeScript
  package `framopia-benchmarks`, wired into root `npm run check`):
  - `types.ts` / `ground-truth.ts`: normalized transcription result shape
    shared by all engines; hand-written ground truth (`{words:[{text,lang,
    script}]}`, no timestamps by design) plus a plain-text-to-ground-truth
    converter for later manual tagging.
  - Scorers (`normalize.ts`, `wer.ts`, `orthography.ts`, `timestamps.ts`),
    all pure functions, heavily unit tested:
    - WER via Levenshtein alignment with backtrace, reused for
      per-language subset WER (code-switched fr/en vs darija).
    - Orthography conformance against `docs/ORTHOGRAPHY_GUIDE.md` §2–§4:
      banned digit substitutions, sh-vs-ch digraph (flagged for review,
      not auto-failed), and freeze-list adherence via edit-distance-≤1
      fuzzy matching (`freeze-list.json`, seeded from §4).
    - Timestamp scoring has no ground truth to compare against (documented
      in code), so it measures cross-engine agreement (median/p90 delta)
      and internal monotonicity instead.
  - `spotcheck.ts`: self-contained HTML (no CDN) sampling 15 words evenly
    across an engine's timed range, with seek-and-play buttons and a
    copyable hit/miss summary.
  - Engine clients (`engines/scribe.ts`, `gemini.ts`, `whisper.ts`,
    `hybrid.ts`): thin, one retry on network/5xx failure, raw responses
    written to disk, response-mapping functions unit tested against
    synthetic fixtures. `hybrid.ts` anchors a Gemini correction pass back
    onto Scribe's word timings via the same Levenshtein alignment used for
    WER, interpolating linearly across runs of unmatched (inserted) words
    — unit tested against substitution, insertion, deletion, and
    multi-word-gap cases, since this is the presumed production merge shape.
  - `bench-config.json`: Gemini model id and prices, so a future model A/B
    is a config edit, not a code change.
  - Runner CLI (`run.ts`, `npm run bench`): prints per-engine cost
    estimates and requires `--yes` or an interactive y/N confirmation
    before any billable call; `--dry-run` runs the full pipeline against
    fixtures with no network calls at all; writes per-engine JSON, raw
    responses, `report.md` (results table), and spotcheck HTML to
    `results/<timestamp>/`.
  - `whisper/setup.sh`: creates a gitignored venv, installs `mlx-whisper`,
    predownloads `large-v3` into `benchmarks/whisper/models` (also
    gitignored). Written but not run this session (see Deviations).
- `benchmarks/README.md` documents the ground-truth format and CLI usage.
- Verified `npm run bench -- --dry-run` end to end from the repo root: it
  produced `report.md`, per-engine JSON, and spotcheck HTML with real
  (non-fabricated) scores computed from the fixtures, then the test
  output was deleted (it lives in the gitignored `results/`).
- `CLAUDE.md` updated: repo map, `npm run bench` command, and status.

## Deviations (what and why)

- **`config.ts` and `costs.ts` are duplicated into `benchmarks/`, not
  imported from `service/`.** The brief said "prefer importing." The two
  packages have independent `tsconfig.json` `rootDir: "src"` (no npm
  workspace yet — session 1 explicitly deferred that), so a relative
  cross-package import would reach outside `benchmarks/src` and break the
  build. Duplicating a ~50-line file was simpler than restructuring both
  packages' tsconfigs this session; both write the same
  `.local/costs.jsonl` / read the same `.local/config.json` shape, so
  behavior is identical. Worth reconciling once a workspace exists.
- **Provider pricing and API shapes are researched, not verified live.**
  Scope forbids live calls this session, so ElevenLabs Scribe's request/
  response shape (endpoint, `xi-api-key` header, keyterms field), the
  Gemini model default (`gemini-2.5-pro` — chosen because Gemini 3 Pro
  variants are still preview as of 2026-08), and Gemini's audio-input
  price (set equal to text input in `bench-config.json` as a placeholder,
  since Pro-specific audio pricing wasn't confirmed) are all based on
  current documentation/search, not a real call. `bench-config.json`
  carries a `note` field flagging this. These should be spot-checked
  before the first real (non-dry-run) benchmark.
- **Gemini pre-call cost estimates are rough by necessity.** Actual token
  usage is only known after a call returns (via `usageMetadata`); the
  pre-call estimate shown in the confirmation prompt uses a documented
  audio-tokenization rate (32 tok/s) plus a guessed words-per-second and
  per-word JSON overhead, explicitly labeled "rough" in the CLI output
  and in `estimate.ts`. Scribe's estimate is exact (published flat rate).
- **Freeze-list fuzzy matching excludes words under 4 characters** (`f`,
  `fin`, `rah`, `m3a`, `7ta`) from `docs/ORTHOGRAPHY_GUIDE.md` §4. An
  edit-distance-≤1 match against a 3-character word produces false
  positives (e.g. "nta" incorrectly matched "7ta"); a unit test caught
  this. Documented in `orthography.ts`; narrows freeze-list coverage but
  avoids noisy conformance scores.
- **`whisper/setup.sh` was written but not executed.** There's no real
  footage this session (explicitly out of scope) and no way to validate a
  multi-GB local model download without audio to run it against; the
  `--dry-run` path already exercises the whisper mapping code via a
  fixture without needing the real binary. It'll run for real once there's
  footage to benchmark.

## Failures & open problems

None blocking. The unverified-but-documented items above (Scribe/Gemini
API shapes, Gemini audio pricing) are the main risk for the first live
run and should be sanity-checked then, not assumed correct from this
session.

## Repo state

- Branch: `main`, clean working tree, all commits pushed (verified below).
- Key commits this session (oldest to newest):
  - `48f7989` feat(benchmarks): scaffold package and ground-truth data model
  - `dbddf3f` feat(benchmarks): add WER, orthography, and timestamp scorers
  - `3bb174d` feat(benchmarks): add spotcheck HTML generator
  - `911eb95` feat(benchmarks): add Scribe and Gemini engine clients
  - `21c93f1` feat(benchmarks): add Whisper baseline and hybrid engine clients
  - `e3b6997` feat(benchmarks): add runner CLI wired into npm run bench
  - `beb3c40` fix(benchmarks): keep whisper model cache under benchmarks/whisper/
  - `21d0c03` docs: update CLAUDE.md for the benchmark harness
- `npm run check`: green — `service/` 4 test files / 14 tests,
  `benchmarks/` 13 test files / 91 tests, all passing; typecheck and lint
  clean on both packages.
- `git log` checked for AI attribution trailers (`co-authored`, `generated
  with`, `anthropic`) across this session's commits — none found.

## Suggested next step

Get real footage (5–10 min of reels) and hand-write ground truth for a
1–2 min subset per `docs/BLOCKS.md`'s Block 1 user tasks, then run
`npm run bench -- --audio <clip> --ground-truth <gt.json>` for real —
starting with `--engines scribe` alone to spot-check the Scribe API
assumptions above before spending on Gemini/hybrid calls. Refine
`docs/ORTHOGRAPHY_GUIDE.md` against the real transcript per its §9 open
questions, then freeze a winning transcription config to close out Block 1.
