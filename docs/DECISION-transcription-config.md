# Decision — transcription config, frozen for Block 1

Date: 2026-08-24. This document is the Block 1 definition-of-done evidence
for transcription. Numbers come from `benchmarks/RESULTS-block1.md` (run C).

## The frozen config

**Hybrid: Scribe for time, Gemini for text.**

1. **ElevenLabs Scribe v2, batch** — one pass over the reel's 16kHz mono
   WAV. Provides the word-level timestamps and the first-pass word
   sequence. Keyterms empty until a client vocabulary list exists.
2. **Gemini `gemini-3.1-pro-preview` correction pass** — receives the audio
   plus Scribe's word sequence, and rewrites it to
   `docs/ORTHOGRAPHY_GUIDE.md` v1.0.3, with the per-word script rules from
   `benchmarks/src/engines/script-rules.ts` appended. Strict JSON out.
3. **Levenshtein anchor alignment** — the corrected words are aligned back
   onto Scribe's timings by the same alignment used for WER scoring.
   Matched and substituted words take the Scribe word's start and end.
4. **Linear interpolation across unmatched runs** — words the correction
   pass inserted, which have no Scribe anchor, get timings spread evenly
   across the gap between the anchors on either side.

Model ids and prices live in `benchmarks/src/bench-config.json`; changing
either is a config edit, not a code change.

## Run C — the evidence

Four reels, 88.8s of code-switched Darija/French talking-head audio from one
speaker, scored against hand-written ground truth under guide v1.0.3.

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost |
|---|---|---|---|---|---|---|---|
| **hybrid** | **24.8%** | **26.1%** | **6.5%** | 97.3% (48 ar unscored) | 0ms / 5ms | 0 | $0.5430 |
| gemini | 26.6% | 27.7% | 8.7% | 97.3% (48 ar unscored) | 466ms / 1462ms | 0 | $0.5625 |
| scribe | 71.6% | 98.4% | 6.5% | 100.0% (223 ar unscored) | — | 0 | $0.0054 |
| whisper | 87.4% | 96.3% | 95.7% | 100.0% (223 ar unscored) | 145ms / 484ms | 0 | $0.0000 |

Hybrid wins every reel in run C, including test-1, where it had lost to
Gemini in runs A and B.

**Timestamp spotcheck, by ear, ground-truth reel, 15 sampled words:**

- **hybrid 14/15 hits.**
- **gemini 9/15**, with accumulating drift — by the last rows the next row's
  audio was playing under the current row.

The WER table cannot express this, and it is the single most important
result here: subtitles that say the right words at the wrong time are
unusable, and the drift compounds through a reel.

## Why not the alternatives

- **Scribe alone.** Returns Darija in Arabic script, not Arabizi, and takes
  no prompt — so there is no way to steer it toward the orthography guide at
  all. Its 98.4% Darija WER is that script mismatch, not an accuracy figure;
  its 6.5% fr/en WER is genuinely the best of any engine, which is exactly
  why the hybrid keeps it underneath. Rejected as a complete answer, kept as
  the front end.
- **Gemini alone.** Loses on every WER column and, more decisively, its
  timestamps are self-reported by the model rather than derived from audio
  alignment. The 9/15 spotcheck with accumulating drift is a
  user-verified disqualifier, and no amount of prompt work fixes a model
  estimating its own timings.
- **Whisper large-v3, local.** Translates Darija into MSA rather than
  transcribing it (`عندك` → `هل لديك`) and mangles the French (`les cernes`
  → `لسرن`), giving a 95.7% fr/en WER. Free and useful as a liveness check;
  never a candidate.

## Known caveats

- **The evidence base is 88.8 seconds, one speaker, one domain.** Four reels
  of aesthetic-medicine content from the same person. The gaps between
  hybrid and the rejected options are wide enough to survive that; the
  1.8-point gap between hybrid and Gemini alone is not obviously outside the
  noise. Revisit if production reels differ in speaker, register, or domain.
- **`gemini-3.1-pro-preview` is a preview model.** `gemini-2.5-pro` was
  retired mid-Block-1 and there is no GA Pro tier to pin instead. Swapping
  models is a `bench-config.json` edit; re-running the benchmark after any
  swap is the point of keeping the harness.
- **The `ou`/`و` corruption is unresolved.** In run B's test-1 diff, the
  hybrid path rendered the Darija conjunction `و` as French `ou` where
  Gemini-alone wrote `w` — a failure only the hybrid path can make, since
  only it sees Arabic-script input. It did not recur measurably in run C,
  but nothing was changed to prevent it. Block 2 prompt-fix candidate.
- **Latency is roughly 5x realtime** — 459s of wall time for 88.8s of audio
  in run C, and both API calls are sequential by construction.
- **Cost is ~5x the original session-2 estimate**, at roughly $0.14 per
  ~22s reel, so **$0.35–0.55 per 90s reel**. The cause is that Gemini bills
  thinking tokens at the output rate and they run about five times the
  visible output. Any new Gemini caller must count `thoughtsTokenCount` or
  it will under-report by the same factor.
- **Orthography conformance is 97.3% with 48 Arabic-script words unscored.**
  The conformance scorer only judges Latin-script words, so the Arabic-script
  domain terms the guide now mandates are outside what it can check.

## References

- `benchmarks/RESULTS-block1.md` — run C, the run of record.
- `benchmarks/RESULTS-block1-runA.md`, `-runB.md` — earlier scoring passes,
  kept so the effect of each guide revision stays visible.
- `docs/ORTHOGRAPHY_GUIDE.md` v1.0.3 — injected verbatim into both prompts.
