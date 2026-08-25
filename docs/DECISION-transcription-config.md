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

Model ids and prices live in `core/src/model-config.json` (moved there from
`benchmarks/src/bench-config.json` in Block 2 session 2, when the shared
package was created); changing either is a config edit, not a code change.

## Run C — the evidence

Four reels, 88.8s of code-switched Darija/French talking-head audio from one
speaker, scored against hand-written ground truth under guide v1.0.3.

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost |
|---|---|---|---|---|---|---|---|
| **hybrid** | **21.6%** | **21.3%** | **6.5%** | 97.3% (48 ar unscored) | 0ms / 5ms | 0 | $0.5430 |
| gemini | 24.1% | 23.9% | 8.7% | 97.3% (48 ar unscored) | 466ms / 1462ms | 0 | $0.5625 |
| scribe | 71.2% | 98.4% | 4.3% | 100.0% (223 ar unscored) | — | 0 | $0.0054 |
| whisper | 87.4% | 96.3% | 95.7% | 100.0% (223 ar unscored) | 145ms / 484ms | 0 | $0.0000 |

The WER columns above are **re-scored against the `v1.0.6-conformant`
references** and supersede every earlier figure this table carried — hybrid
24.8% / 26.1% / 6.5% then 21.9% / 21.3% / 8.7%, gemini 26.6% / 27.7% / 8.7%
then 24.5% / 23.9% / 10.9%, scribe 71.6% / 98.4% / 6.5%. No engine was ever
re-run: the outputs are the same recorded run-C responses, and only the
references moved (ground-truth in Block 2 session 6, test-1 and test-2 in
Block 3 session 1, the curly apostrophes in all four in Block 3 session 2).
Whisper is unchanged. The ranking that decided the freeze is unchanged; see
`benchmarks/RESULTS-block1.md` for the live table.

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
  models is a `core/src/model-config.json` edit; re-running the benchmark after any
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

## Amendment — prompt version 2, tried and reverted (2026-08-24)

The freeze decision above is unchanged. This records a divergence from it and
its reversal, per HANDOFF_PROTOCOL §6.

Block 2 session 2 added one rule to the correction prompt — that the Arabic
conjunction `و` is written `w`, never French `ou` — and session 3 moved the
keyterms block ahead of the JSON-shape instruction and called the result
prompt **version 2**. Session 3 measured it against the recorded run C output
on the ground-truth reel: overall WER was unchanged at 22.2%, with the darija
subset 1.7 points worse and the fr/en subset 6.2 points better, and no `ou`
corruption appeared under either version. Full comparison in
`benchmarks/RESULTS-block2-promptv2.md`.

The user has reverted the active prompt to **version 1**. The comparison was
inconclusive rather than negative: it varied two things at once and ran each
arm once, with no measurement of run-to-run variance to judge a 1.7-point
difference against. Version 1 is what the Block 1 evidence describes, so it is
what runs.

Version 2 stays selectable in `service/src/transcription/correction.ts` as the
record of the experiment. The `ou` corruption is now detected by the
conformance scorer rather than prevented by prompt wording.

## Amendment — prompt version 3 activated (2026-08-25)

The freeze decision above is unchanged: the engine chain, the model pin and
the alignment method are as frozen. This records a change to the correction
prompt's response shape.

**`ACTIVE_PROMPT_VERSION = 3`.** Version 3 is version 1 — the Block 1 frozen
prompt, verbatim — plus a per-word `lang` from the enum
`darija|msa|fr|en|mixed`, and nothing else: not the version 2 conjunction
rule, not the version 2 keyterms position. ARCHITECTURE §3 requires the field
and PROJECT_SPEC §5 depends on it.

It was measured twice, three runs each, replaying the same recorded Scribe
draft (`benchmarks/RESULTS-block2-langtagging.md`). The first attempt, under
guide v1.0.5, tagged every word but disagreed with itself on the six
Arabic-script domain terms — `darija` twice, `msa` once — because §6 said
which script those take and never which language they are. Guide v1.0.6
settles that. Re-measured under v1.0.6: all six terms `msa` in all three runs,
tag stability 81/81, coverage 81/81 with no nulls and no out-of-enum values,
and a WER mean of 15.6% against version 1's 15.2% — a 0.4-point difference
against a measured 3.7-point noise floor.

Version 1 remains selectable and is what run C and every Block 1 figure were
measured with. `lang` stays nullable in the Edit Plan schema: a model omission
or a cache entry written before version 3 existed still produces null, and
null must remain representable rather than be filled with a guess.

## References

- `benchmarks/RESULTS-block1.md` — run C, the run of record.
- `benchmarks/RESULTS-block1-runA.md`, `-runB.md` — earlier scoring passes,
  kept so the effect of each guide revision stays visible.
- `docs/ORTHOGRAPHY_GUIDE.md` — injected verbatim into both prompts; v1.0.3
  at the time of the freeze, v1.0.4 since (`bach` added to the §4 freeze list).
- `benchmarks/RESULTS-block2-promptv2.md` — the version 2 comparison behind
  the amendment above.
