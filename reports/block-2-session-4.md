Status: OK

# Block 2 — session 4

All nine goals completed. Prompt reverted to version 1, noise floor measured,
two conformance rules added, estimator made conservative, Edit Plan schema v1
implemented, and all four transcript post-processing stages landed.

## Read this first

### The noise floor: 2.5 WER points, 12 of 81 tokens moved

Three identical correction calls — same recorded Scribe draft, same audio,
same prompt (version 1), nothing else varied:

| | overall WER | darija | fr/en | tokens | drift |
|---|---|---|---|---|---|
| run 1 | 21.0% | 25.0% | 6.3% | 81 | 8.0% |
| run 2 | 21.0% | 23.3% | 12.5% | 81 | 8.0% |
| run 3 | **18.5%** | **21.7%** | 6.3% | 78 | 4.0% |
| **spread** | **2.5 points** | **3.3** | **6.3** | 3 | 4.0 |

**69 of 81 tokens identical across all three; 12 moved.** Adding run C's
recorded output as a fourth same-prompt sample widens the overall range to
18.5%–22.2%, **3.7 points**. Session 3's version 2 result (22.2%) sits inside
that band.

**Any prompt comparison whose effect is under ~2.5 points is not measurable at
n=1 on this reel.** Cost varied 41% ($0.115–$0.162) and wall-clock 2.9x across
the same three calls, so single-call cost figures carry roughly ±20%.

The most useful part is *which* tokens moved: all twelve are orthography
choices, none a hearing disagreement — the possessive `dial` attached or
detached (`dial l7loul` vs `dl7loul`, six of the twelve), schwa present or
absent (`awal`/`awl`/`awel`), and verb prefixes (`kadiri`/`katdiri`). Full
detail in `benchmarks/RESULTS-block2-noisefloor.md`.

### What the two new conformance rules caught on disk

**`ou` conjunction rule: zero hits, on every transcript on disk.** Sixteen
transcripts re-scored — run C gemini and hybrid for all four Block 1 reels,
vitasilk scribe and hybrid, both session-3 v2 outputs, all three noise-floor
runs, and the live CLI run. Not one standalone `ou`. The corruption is
genuinely absent from every recorded output, which is consistent with the
session-3 finding and is why replacing the prompt rule with detection costs
nothing.

**Vowel-less cluster rule: it catches its target and over-fires.**

| transcript | old | new | flagged |
|---|---|---|---|
| runC ground-truth gemini | 97.6% | 97.6% | — |
| runC ground-truth hybrid | 97.5% | 97.5% | — |
| runC test-1 gemini | 98.6% | 95.9% | `l`, `d` |
| runC test-1 hybrid | 98.6% | 98.6% | — |
| runC test-2 gemini | 96.1% | 92.1% | `nkhdm`, `d`, `l` |
| runC test-2 hybrid | 97.3% | 94.7% | `nkhdm`, `d` |
| runC test-3 gemini | 96.6% | 94.9% | `wbddbt` |
| runC test-3 hybrid | 95.2% | 93.7% | `bddbt` |
| vitasilk scribe | 100.0% | 100.0% | — |
| vitasilk hybrid (v1) | 100.0% | 93.2% | `ymkn`, `ch3rk`, `msbsb`, `jbt`, `ch3rk?` |
| session3 v2 ground-truth | 97.5% | 95.1% | **`7l`, `l7l`** |
| session3 v2 vitasilk | 100.0% | 94.5% | `ymkn`, `ch3rk`, `jbt`, `ch3rk?` |
| noisefloor runs 1–3 | 97.5/97.5/98.7% | unchanged | — |
| live CLI vitasilk | 100.0% | 92.9% | `ymkn`, `ch3rk`, `msbsb`, `jbt`, `ch3rk` |

`7l` and `l7l` — the tokens that motivated the rule — are caught. Bare `l` and
`d` are caught and arguably should be: §4 lists `dl`/`dla` as reduced variants
deliberately *not* frozen.

But `ymkn`, `ch3rk`, `jbt`, `msbsb`, `nkhdm`, `bddbt` are **ordinary, correct
Arabizi** with legitimately dropped schwas, and the rule as specified flags
them. It cost the vitasilk hybrid transcript 6.8 points of a previously
perfect score. The rule is "no vowel character present"; the real distinction
between `jbt` (fine) and `7l` (not fine) is syllable structure, which this
does not model. **Narrowing it is a decision I have left to you** — it needs a
rule change, not a bug fix. Two false-positive classes that *were* bugs are
fixed: non-Latin tokens (Scribe's stray `五`) and all-caps acronyms (`RRS`).

### Total spend: $0.418626

Three new lines in `.local/costs.jsonl`, quoted in full:

```
{"stage":"noisefloor-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.16240600000000002,"note":"noise-floor run 1/3 on the recorded ground-truth scribe draft under prompt version 1; no scribe call made","timestamp":"2026-08-24T22:50:39.583Z"}
{"stage":"noisefloor-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.114982,"note":"noise-floor run 2/3 on the recorded ground-truth scribe draft under prompt version 1; no scribe call made","timestamp":"2026-08-24T22:52:58.587Z"}
{"stage":"noisefloor-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.14123800000000003,"note":"noise-floor run 3/3 on the recorded ground-truth scribe draft under prompt version 1; no scribe call made","timestamp":"2026-08-24T22:54:27.502Z"}
```

Estimated $0.2676, actual $0.4186 — 56% over, because thinking ran 30.2x,
20.4x and 8.3x visible output against the estimator's assumed 5x. Goal 5 fixes
that direction of error. No Scribe calls were made; the recorded draft was
replayed.

### Goals completed

**All nine.** The prompt allowed stopping after Goal 6; that was not needed.

## Done

- **Preflight.** T7 mounted; `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`.
  Clean tree, on `main`, in sync. Baseline `npm run check` **green, 180 tests**
  (core 20, service 52, benchmarks 108).
- **Goal 2 — prompt reverted to version 1**
  (`refactor: revert the active correction prompt to version 1`).
  `ACTIVE_PROMPT_VERSION = 1` in `service/src/transcription/correction.ts`;
  version 2 stays selectable. The comment now says why the session-3
  comparison was inconclusive. Recorded as an amendment in
  `docs/DECISION-transcription-config.md`, leaving the original freeze text
  untouched.
- **Goal 3 — noise floor** (`test: measure run-to-run variance of the
  correction pass`). `benchmarks/RESULTS-block2-noisefloor.md`: three runs,
  all pairwise diffs with context, WER per run and spread, drift per run, the
  69/81 stability count with the twelve moving tokens named, per-call cost and
  thinking ratio. Raw outputs at `benchmarks/results/noisefloor/`.
- **Goal 4 — two conformance rules** (`feat: flag ou conjunctions and
  vowel-less clusters in the conformance scorer`) in
  `benchmarks/src/orthography.ts`: `findOuConjunctions` and
  `findVowellessClusters`, both feeding the score. Fourteen tests including
  every negative case asked for — `ynourri`, `houa`, `l7loul`, `nour`, `walou`
  do not flag under rule 1; `f`, `w`, `mn`, `nhdr`, `3ndk` do not flag under
  rule 2; `7l` and `l7l` do.
- **Goal 5 — conservative estimator** (`fix: make the gemini cost estimate
  conservative for gating`). `THINKING_TOKEN_MULTIPLIER` 5 → 15 in
  `core/src/pricing.ts`, with all seven observed ratios and their sources in
  the comment and an explicit note that it is a gate, not a best estimate.
  Actuals untouched. Three tests: the estimate is ≥ the worst actual recorded
  for the same reel ($0.162406), exceeds the worst recorded billed-output
  token cost, and stays under 3x it so it does not become a scare figure.
- **Goal 6 — Edit Plan schema v1** (`feat: implement edit plan schema v1 with
  validation`) in `service/src/editplan/`: `types.ts`, `validate.ts`,
  `io.ts`, `index.ts`. 29 tests — a minimal plan validates; twelve required
  fields each fail with their dotted path; unknown `lang`/`script`, a word
  ending before it starts, a removed word with no reason, and a group
  referencing a non-existent word all fail with paths; round-trip is
  byte-exact on disk, not merely deep-equal; `schemaVersion` 2 and a missing
  `schemaVersion` both raise `EditPlanVersionError`.
- **Goal 7 — post-processing**, four commits:
  - `feat: tag language and script on transcript words` — `tagging.ts`.
    `parseCorrectionResponse` now preserves any `lang`/`script` the model
    volunteers, so a future prompt flows through without touching this layer.
  - `feat: mark fillers stutters and false starts as removed` — `cleaning.ts`.
  - `feat: group words into subtitle groups` — `grouping.ts`, rule documented
    in the module comment.
  - `feat: propagate word confidence through alignment` — `align.ts`.
- **Goal 8 — CLAUDE.md** updated for all of the above.

## Deviations

- **`transcript.words[].lang` is nullable, departing from ARCHITECTURE §3**,
  which types it as a required `darija|msa|fr|en|mixed`. The premise in the
  prompt — "the correction pass already returns this information" — is not
  true: the Block 1 frozen prompt asks for `{"words":[{"text":"..."}]}` and
  nothing else, so no word carries a language today. The enum has no
  "unknown", `mixed` means something different, and defaulting to `darija`
  would be right often enough to look like data and wrong often enough to
  mislead the review UI. Null is the explicit fallback. `script` needs no
  fallback: it is read off the characters, which is observation, not
  inference.
- **`clientMode` and `watermark` are nullable**, also departing from §3, which
  shows both as objects. Transcription runs before a mode is chosen and before
  the watermark file is measured (§3 itself defers `watermark.durationS` to
  Block 7), so a plan created at transcription time cannot fill them.
- **`ya3ni`/`za3ma` are never marked.** §7 removes them as hesitation and keeps
  them when they introduce an explanation; nothing available here — text,
  timings, confidence — separates the two. They are returned in an `unjudged`
  list instead of guessed, as the prompt directed.
- **Non-repetition false starts are not attempted.** §7's own example of a
  false start is the repetition case, which is covered by the stutter rule; a
  speaker abandoning one sentence for a different one needs semantics.
- **Alignment now carries Scribe's confidence onto substituted words too**,
  not only exact matches, and this reverses a session-2 comment that said it
  should not. The reasoning: a substitution here is almost always
  transliteration, and the confidence describes how clearly that slot was
  heard, not how right the spelling is. Documented in the module. Interpolated
  words stay null.
- **Two extra vowel-rule exclusions beyond the specified §4 exception list**:
  tokens that are not Latin script at all (Scribe's `五`) and all-caps
  acronyms (`RRS`). Both were plainly false positives rather than rule
  changes. `w` was also added to the exception list — flagging the very form
  `findOuConjunctions` demands would be self-contradictory, and a test caught
  it.
- **`f` is frozen in ORTHOGRAPHY_GUIDE §4 but missing from
  `benchmarks/src/freeze-list.json`.** The exception list adds it by hand
  rather than editing the freeze list, which is a data change I did not want
  to make silently. The gap is real and worth closing.
- **The noise-floor experiment used a throwaway script**, run and deleted
  rather than committed; the method and source paths are in the results
  document and the raw outputs are on disk.

## Failures & open problems

- **The vowel-less rule over-fires on ordinary Arabizi** and currently
  degrades the conformance metric for clean transcripts, as tabled above.
  Until it is narrowed, conformance figures from this session are not
  comparable with earlier ones.
- **No stage writes an Edit Plan.** The types, validator and IO exist and are
  tested, but `transcribeVideo` still writes a plain transcript JSON. Nothing
  has produced or consumed a real plan end to end.
- **The post-processing stages are not wired into anything either.** Tagging,
  cleaning and grouping are pure functions with tests; no pipeline calls them,
  so they have never run on a live transcription.
- **Nothing populates `source.sha256`, `fps`, `width` or `height`** — the
  types require them and `createEditPlan` takes them from the caller, but no
  caller exists.
- **The grouping thresholds (180 ms, 1.2 s) are chosen, not measured.** They
  produce sane groups on the vitasilk fixture; no one has watched a reel with
  them applied.
- **`transcribeHybrid` still has no test that runs it end to end.** The
  composed function has executed exactly once, in session 3, live.
- **`meta.appVersion` has no source.** No package.json in the workspace
  carries a version the service could read; the caller must supply the string.
- The `estimateGeminiCallCost` heuristic for visible output (2.5 words/s × 20
  tokens/word) is still unmeasured; only the thinking multiplier was revisited.
- Three identical calls cost $0.115, $0.141 and $0.162, so **no single-call
  cost figure anywhere in this repo is better than ±20%**.

## Repo state

- Branch `main`, pushed to `origin/main`.
- HEAD: `docs: update operating memory for edit plan v1`.
- Eleven commits this session, in the specified order.
- `npm run check`: **green, 263 tests** — core 23, service 118, benchmarks 122.
  Baseline was 180.

## Suggested next step

Caching is now clearly the highest-value next build, and this session sharpened
the argument: $0.42 went on three calls that a cache would have made free on
replay, and the fingerprint inputs all exist already (`ACTIVE_PROMPT_VERSION`,
the model pin, the guide version, the video sha256 the Edit Plan reserves a
field for). Build it at `.local/cache/<video-sha256>/` per ARCHITECTURE §6 and
the rest of Block 2 gets cheaper to iterate on. The natural companion is wiring
the pieces that now exist but touch nothing: have `transcribeVideo` create an
Edit Plan, fill `source` and `pipeline.transcription`, run tagging, cleaning
and grouping over the aligned words, and write the plan beside the video — that
is the first time any of this session's code would run on real output, and it
would immediately expose whether the grouping thresholds and the null-`lang`
fallback survive contact. Two decisions are waiting on you: whether to narrow
the vowel-less rule (it over-fires today), and whether `f` should be added to
`freeze-list.json` to match §4. Neither blocks the work above.
