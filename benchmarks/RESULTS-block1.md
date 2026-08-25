# Block 1 transcription benchmark — run C (guide v1.0.3)

**Every WER column here is scored against the `v1.0.6-conformant`
references.** The engine outputs are unchanged — they are the same recorded
run-C responses — but the references they are measured against have been
corrected three times since run C was first written: the ground-truth reel in
Block 2 session 6, test-1 and test-2 in Block 3 session 1 (`dla vidéo` →
`dial lvidéo`, `joj dl 7essass` → `joj dial l7essass`), and all four in
Block 3 session 2, which straightened the curly apostrophes §4 forbids.
**Any run-C WER figure quoted elsewhere from before those corrections is
superseded by this table.** Nothing but the WER columns moved; cost, wall time
and timestamp deviation are untouched.

The run of record for the Block 1 freeze decision. Earlier runs are kept
beside it: run A (guide v1.0.1) in `RESULTS-block1-runA.md`, run B (a free
rescore of run A's outputs under v1.0.2) in `RESULTS-block1-runB.md`.

**Run C re-ran gemini and hybrid only**, under prompts carrying guide
v1.0.3 — the term-level script rule, the numeral rule, and the widened
medical/aesthetic domain. The scribe and whisper rows are the stored
session-4 results, reused deliberately: Scribe takes no prompt, so its
output cannot depend on the guide, and Whisper is a local baseline that
translates Darija into MSA and was never a candidate. The ground truth also
changed for v1.0.3: Arabic-script function words were converted to Arabizi,
and two transcription defects the engines had gotten right (`kids cabin` for
`kidom mabin`, `7sessa` for `7essa`) were corrected.

## Timestamp spotcheck — by ear, on the ground-truth reel

Checked by the user against the audio, 15 sampled words per engine:

- **hybrid: 14/15 hits.**
- **gemini: 9/15**, with accumulating drift through the reel — by the last
  rows the next row's audio was playing under the current row.

This is the evidence the WER table cannot carry. Hybrid inherits Scribe's
word timings; Gemini self-reports them, and self-reported timings drift.

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
| scribe | 71.2% | 98.4% | 4.3% | 100.0% (223 ar unscored) | — / — | 0 | $0.0054 | 11.2s |
| gemini | 24.1% | 23.9% | 8.7% | 97.3% (48 ar unscored) | 466ms / 1462ms | 0 | $0.5625 | 387.1s |
| whisper | 87.4% | 96.3% | 95.7% | 100.0% (223 ar unscored) | 145ms / 484ms | 0 | $0.0000 | 50.2s |
| hybrid | 21.6% | 21.3% | 6.5% | 97.3% (48 ar unscored) | 0ms / 5ms | 0 | $0.5430 | 459.5s |

Cost column total: $1.1109. Note this mixes runs — the
gemini and hybrid figures were billed by this run, the scribe and whisper
figures are the session-4 charges for the outputs being reused, not a
fresh spend.

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
| scribe | 75.3% | 98.3% | 6.3% | 100.0% (61 ar unscored) | — / — | 0 | $0.0014 | 2.9s |
| gemini | 14.8% | 13.3% | 12.5% | 97.6% (7 ar unscored) | 240ms / 1300ms | 0 | $0.1398 | 82.8s |
| whisper | 92.6% | 95.0% | 100.0% | 100.0% (60 ar unscored) | 159ms / 319ms | 0 | $0.0000 | 13.5s |
| hybrid | 16.0% | 16.7% | 12.5% | 97.5% (6 ar unscored) | 0ms / 0ms | 0 | $0.1627 | 105.9s |

### test-1 — 22.0s, 67 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 74.6% | 100.0% | 33.3% | 100.0% (62 ar unscored) | — / — | 0 | $0.0013 | 2.8s |
| gemini | 29.9% | 26.1% | 33.3% | 98.6% (19 ar unscored) | 811ms / 3331ms | 0 | $0.1592 | 99.3s |
| whisper | 79.1% | 95.7% | 100.0% | 100.0% (56 ar unscored) | 120ms / 659ms | 0 | $0.0000 | 12.1s |
| hybrid | 23.9% | 21.7% | 33.3% | 98.6% (19 ar unscored) | 0ms / 20ms | 0 | $0.1439 | 117.7s |

### test-2 — 22.3s, 70 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 75.7% | 98.0% | 0.0% | 100.0% (59 ar unscored) | — / — | 0 | $0.0014 | 3.3s |
| gemini | 30.0% | 28.6% | 0.0% | 96.1% (11 ar unscored) | 581ms / 720ms | 0 | $0.1330 | 130.0s |
| whisper | 91.4% | 100.0% | 100.0% | 100.0% (65 ar unscored) | 140ms / 299ms | 0 | $0.0000 | 13.0s |
| hybrid | 28.6% | 26.5% | 0.0% | 97.3% (12 ar unscored) | 0ms / 0ms | 0 | $0.1636 | 193.8s |

### test-3 — 21.2s, 60 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 56.7% | 97.0% | 0.0% | 100.0% (41 ar unscored) | — / — | 0 | $0.0013 | 2.2s |
| gemini | 23.3% | 33.3% | 6.3% | 96.6% (11 ar unscored) | 231ms / 499ms | 0 | $0.1306 | 75.0s |
| whisper | 85.0% | 93.9% | 87.5% | 100.0% (42 ar unscored) | 159ms / 659ms | 0 | $0.0000 | 11.6s |
| hybrid | 18.3% | 21.2% | 0.0% | 95.2% (11 ar unscored) | 0ms / 0ms | 0 | $0.0727 | 42.1s |


## Ledger note — one understated cost entry from session 4

The `.local/costs.jsonl` entry

```
{"stage":"benchmark-gemini","model":"gemini","unit":"run","usd":0.031668,"timestamp":"2026-08-24T19:50:06.011Z"}
```

is **known-low and must never be quoted as an actual cost**. It was written
before `computeGeminiCost` billed `thoughtsTokenCount` at the output rate, so
it counts only the 2084 visible output tokens and omits 10295 thinking tokens.

The raw response survives at
`benchmarks/results/2026-08-24T19-48-01-202Z/raw/gemini.json`
(`promptTokensDetails` 2748 TEXT + 582 AUDIO, `candidatesTokenCount` 2084,
`thoughtsTokenCount` 10295). Re-costed with the current constants
($2.00/M input, $12.00/M output) the call was **$0.155208**, not $0.031668 —
4.9x. Reconstructing the old formula from the same usage reproduces
$0.031668 exactly, which is what identifies this raw response as that call.

The ledger is append-only, so the original line stands. A delta-only entry of
$0.123540 (`stage: benchmark-gemini-correction`) was appended with a `note`
naming the corrected timestamp. Ledger totals are therefore correct in sum;
the single 19:50:06 line is not correct on its own.

No other entry needed correcting. 19:50:06 is the first Gemini line in the
ledger, and the next one (19:54:06, $0.156060) reproduces exactly from its own
raw `usageMetadata` **with** thinking tokens included, so the fix was already
in place from that call onward.
