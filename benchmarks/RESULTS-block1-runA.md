# Block 1 transcription benchmark — run A (guide v1.0.1)

> **Superseded figures.** Every WER number here was scored against
> pre-`v1.0.1-conformant` references — the ground-truth reel still wrote
> `dl 7olol`, `dl 7essass`, `dl vitaminat`, and test-1 and test-2 still wrote
> `dla vidéo` and `joj dl 7essass`. The corrected references are scored in
> `RESULTS-block1.md`. This file is preserved verbatim as the record of what
> was measured at the time and is not re-scored; nothing in it should be
> quoted as a current WER figure.

Preserved verbatim from the session-4 commit. The engine outputs behind it
are the same ones run B rescores; only the scoring rules and the ground
truth changed between them. Kept so the effect of the v1.0.2 corrections
stays visible instead of being silently overwritten.


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
| scribe | 68.8% | 98.3% | 10.4% | 100.0% (223 ar unscored) | — / — | 0 | $0.0054 | 11.2s |
| gemini | 40.6% | 36.6% | 14.6% | 97.3% (35 ar unscored) | 721ms / 2895ms | 0 | $0.5719 | 567.9s |
| whisper | 84.1% | 95.9% | 95.8% | 100.0% (223 ar unscored) | 155ms / 1460ms | 0 | $0.0000 | 50.2s |
| hybrid | 36.2% | 35.5% | 10.4% | 97.2% (37 ar unscored) | 0ms / 1794ms | 0 | $0.5334 | 654.1s |

Total billed: $1.1107.

## How to read these numbers

**Scribe's darija WER is not an accuracy measurement.** Scribe returns
Darija in Arabic script and the ground truth is written in Latin Arabizi,
so essentially every Darija word counts as a substitution. Its fr/en WER
is the honest signal for raw Scribe, and it is the best of any engine.

**Hybrid's 0ms median deviation is structural, not earned.** Hybrid takes
Scribe's word timings by construction, so it can only agree with Scribe at
the median; the p90 is where its realignment of inserted words shows up.

**Two known scoring artifacts inflate the Darija WER of both Gemini rows**,
and neither is a transcription error:

- *Numerals.* The ground truth writes digits (`4`, `15`, `18`) where Gemini
  spells the number out (`rb3a`, `khmstachr`, `tmntach`). The orthography
  guide has no numeral rule, so neither form is wrong yet.
- *Arabic-script scope.* The v1.0.1 §6 rule covers procedure and treatment
  terms. The ground truth also puts anatomical regions and substance names
  in Arabic script (`المنطقة حول العينين`, `ومادة الكافيين`) where Gemini
  transliterated them (`lmnti9a 7awl l3inin`, `wmaddat lcaféine`).

On the ground-truth reel these two account for roughly a tenth of the
reference words. Closing both in the guide would move the Gemini and
hybrid Darija numbers down without either engine changing.

## Per reel

### ground-truth — 23.3s, 81 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 72.8% | 98.3% | 6.3% | 100.0% (61 ar unscored) | — / — | 0 | $0.0014 | 2.9s |
| gemini | 37.0% | 39.7% | 18.8% | 97.6% (5 ar unscored) | 240ms / 641ms | 0 | $0.1561 | 133.5s |
| whisper | 90.1% | 94.8% | 100.0% | 100.0% (60 ar unscored) | 159ms / 319ms | 0 | $0.0000 | 13.5s |
| hybrid | 34.6% | 39.7% | 12.5% | 96.3% (5 ar unscored) | 0ms / 0ms | 0 | $0.1487 | 228.5s |

### test-1 — 22.0s, 67 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 71.6% | 100.0% | 60.0% | 100.0% (62 ar unscored) | — / — | 0 | $0.0013 | 2.8s |
| gemini | 46.3% | 33.3% | 40.0% | 98.6% (16 ar unscored) | 861ms / 6919ms | 0 | $0.1120 | 90.6s |
| whisper | 73.1% | 94.9% | 100.0% | 100.0% (56 ar unscored) | 120ms / 4561ms | 0 | $0.0000 | 12.1s |
| hybrid | 50.7% | 38.5% | 40.0% | 100.0% (16 ar unscored) | 0ms / 7175ms | 0 | $0.1396 | 260.2s |

### test-2 — 22.3s, 69 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 71.0% | 97.7% | 0.0% | 100.0% (59 ar unscored) | — / — | 0 | $0.0014 | 3.3s |
| gemini | 42.0% | 37.2% | 0.0% | 97.3% (8 ar unscored) | 1281ms / 2361ms | 0 | $0.1342 | 188.6s |
| whisper | 88.4% | 100.0% | 100.0% | 100.0% (65 ar unscored) | 140ms / 299ms | 0 | $0.0000 | 13.0s |
| hybrid | 36.2% | 37.2% | 0.0% | 97.3% (10 ar unscored) | 0ms / 0ms | 0 | $0.1277 | 91.1s |

### test-3 — 21.2s, 59 reference words

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev vs scribe (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 57.6% | 96.9% | 6.3% | 100.0% (41 ar unscored) | — / — | 0 | $0.0013 | 2.2s |
| gemini | 37.3% | 34.4% | 12.5% | 95.2% (6 ar unscored) | 500ms / 1661ms | 0 | $0.1696 | 155.1s |
| whisper | 83.1% | 93.8% | 87.5% | 100.0% (42 ar unscored) | 200ms / 659ms | 0 | $0.0000 | 11.6s |
| hybrid | 22.0% | 21.9% | 6.3% | 94.8% (6 ar unscored) | 0ms / 0ms | 0 | $0.1174 | 74.2s |
