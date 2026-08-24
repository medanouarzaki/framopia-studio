# Block 1 transcription benchmark — run B (guide v1.0.2 rescore)

Preserved verbatim from the session-5 commit, alongside run A in
`RESULTS-block1-runA.md`. Run C supersedes it.


Run A, scored under guide v1.0.1, is preserved in `RESULTS-block1-runA.md`.
**Run B rescores the identical engine outputs** — no engine was re-run and
none was re-prompted with the v1.0.2 rules, so nothing here measures how the
engines would behave if told about the numeral rule or the widened
Arabic-script scope. What changed is the scoring, in three ways: spelled-out numerals now compare
equal to the digits the ground truth writes (§3a); edge punctuation is
stripped from Arabic-script tokens, which it previously was not, so
`للوجه؟` and `للوجه` no longer count as different words; and one ground
truth typo (`main` for `mabin`) was corrected.

Four reels, 88.8s of code-switched Darija/French
talking-head audio, scored against hand-written ground truth. Ground truth
carries no timestamps by design, so timestamp quality is measured as
agreement with Scribe plus internal monotonicity, never as accuracy.

WER is pooled across reels (total errors over total reference words), not
averaged over per-reel rates. Orthography conformance only judges
Latin-script words; the parenthetical counts Arabic-script words the rule
set cannot speak to, which is the whole story for raw Scribe.

## Aggregate — all four reels

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 67.0% | 98.3% | 10.4% | 100.0% (223 ar unscored) | — / — | 0 | $0.0054 | 11.2s |
| gemini | 35.5% | 29.7% | 14.6% | 97.3% (35 ar unscored) | 666ms / 1586ms | 0 | $0.5719 | 567.9s |
| whisper | 84.1% | 95.9% | 95.8% | 100.0% (223 ar unscored) | 145ms / 484ms | 0 | $0.0000 | 50.2s |
| hybrid | 31.2% | 28.5% | 10.4% | 97.2% (37 ar unscored) | 0ms / 8ms | 0 | $0.5334 | 654.1s |

Total billed: $1.1107.

## How to read these numbers

**Scribe's darija WER is not an accuracy measurement.** Scribe returns
Darija in Arabic script and the ground truth is written in Latin Arabizi,
so essentially every Darija word counts as a substitution. Its fr/en WER
is the honest signal for raw Scribe, and it is the best of any engine.

**Hybrid's 0ms median deviation is structural, not earned.** Hybrid takes
Scribe's word timings by construction, so it can only agree with Scribe at
the median; the p90 is where its realignment of inserted words shows up.

**The numeral artifact is gone.** Guide v1.0.2 §3a settles numbers as digits
and the WER normalizer maps the spelled-out Darija forms onto them, so
`khmstach` and `15` now compare equal. Together with the Arabic punctuation
fix, this is what moved the rows between run A and run B.

**The timestamp deviation columns moved too, and for the same reason.**
Cross-engine deviation pairs words by their normalized text, so every Arabic
word carrying a question mark used to fail to pair and drop out of the
comparison. With punctuation stripped, hybrid's p90 against Scribe falls
from 1794ms to single digits — which is what hybrid inheriting Scribe's
timings should have looked like all along.

**The Arabic-script scope artifact is still live in these numbers.** Guide
v1.0.2 §6 now covers anatomical regions and substance names, matching what
the ground truth does, but the engines that produced these outputs were
prompted under v1.0.1 and still transliterate them (`lmnti9a 7awl l3inin`
for `المنطقة حول العينين`, `wmaddat lcaféine` for `مادة الكافيين`). Those
remain real errors against the ground truth. Unlike the numeral case this
one cannot be fixed by rescoring — it needs a re-run under the v1.0.2
prompt, which would cost another sweep.

## Per reel

### ground-truth — 23.3s, 81 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 72.8% | 98.3% | 6.3% | 100.0% (61 ar unscored) | — / — | 0 | $0.0014 | 2.9s |
| gemini | 29.6% | 29.3% | 18.8% | 97.6% (5 ar unscored) | 240ms / 641ms | 0 | $0.1561 | 133.5s |
| whisper | 90.1% | 94.8% | 100.0% | 100.0% (60 ar unscored) | 159ms / 319ms | 0 | $0.0000 | 13.5s |
| hybrid | 27.2% | 29.3% | 12.5% | 96.3% (5 ar unscored) | 0ms / 0ms | 0 | $0.1487 | 228.5s |

### test-1 — 22.0s, 67 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 68.7% | 100.0% | 60.0% | 100.0% (62 ar unscored) | — / — | 0 | $0.0013 | 2.8s |
| gemini | 40.3% | 28.2% | 40.0% | 98.6% (16 ar unscored) | 641ms / 1721ms | 0 | $0.1120 | 90.6s |
| whisper | 73.1% | 94.9% | 100.0% | 100.0% (56 ar unscored) | 120ms / 659ms | 0 | $0.0000 | 12.1s |
| hybrid | 44.8% | 33.3% | 40.0% | 100.0% (16 ar unscored) | 0ms / 32ms | 0 | $0.1396 | 260.2s |

### test-2 — 22.3s, 69 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 68.1% | 97.7% | 0.0% | 100.0% (59 ar unscored) | — / — | 0 | $0.0014 | 3.3s |
| gemini | 39.1% | 32.6% | 0.0% | 97.3% (8 ar unscored) | 1281ms / 2361ms | 0 | $0.1342 | 188.6s |
| whisper | 88.4% | 100.0% | 100.0% | 100.0% (65 ar unscored) | 140ms / 299ms | 0 | $0.0000 | 13.0s |
| hybrid | 33.3% | 32.6% | 0.0% | 97.3% (10 ar unscored) | 0ms / 0ms | 0 | $0.1277 | 91.1s |

### test-3 — 21.2s, 59 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 55.9% | 96.9% | 6.3% | 100.0% (41 ar unscored) | — / — | 0 | $0.0013 | 2.2s |
| gemini | 33.9% | 28.1% | 12.5% | 95.2% (6 ar unscored) | 500ms / 1621ms | 0 | $0.1696 | 155.1s |
| whisper | 83.1% | 93.8% | 87.5% | 100.0% (42 ar unscored) | 159ms / 659ms | 0 | $0.0000 | 11.6s |
| hybrid | 18.6% | 15.6% | 6.3% | 94.8% (6 ar unscored) | 0ms / 0ms | 0 | $0.1174 | 74.2s |
