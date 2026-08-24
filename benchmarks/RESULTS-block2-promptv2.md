# Correction prompt version 2 against the Block 1 baseline

## Headline

**Overall WER on the Block 1 reel did not move: 22.2% under both versions.**
It did not degrade by a point; it did not change at all. Underneath that, the
two language subsets moved in opposite directions and cancelled — darija got
1.7 points worse (25.0% → 26.7%), French/English got 6.2 points better
(12.5% → 6.3%). One reel, 81 reference words, so a single token moving is
worth more than a point.

**The `و` → `ou` corruption was not present under either version.** Every
standalone conjunction in both drafts came out as `w` in v1 as well as v2, so
version 2's rule had nothing to fix on these two reels. It is not shown to
help; it is shown not to hurt.

Nothing here is a decision. The numbers are below; the ruling is the user's.

## Method

The experiment isolates the prompt. Scribe was **not** re-run for the
comparison: the recorded Scribe drafts already on disk were replayed through
the version 2 correction prompt, so the only variable between the two columns
is the prompt text. Version 1 was not re-run either — its outputs are the
recorded ones from run C and the Block 2 session 1 vitasilk run.

Version 1 as built by `service/src/transcription/correction.ts` was verified
byte-identical to the Block 1 frozen prompt (`buildHybridCorrectionPrompt` in
`benchmarks/src/engines/hybrid.ts`), with and without keyterms, before any
call was made.

| reel | why | recorded draft | recorded v1 output |
|---|---|---|---|
| `ground-truth` | has hand-written ground truth, scored in run C, and is the reel the human timestamp spotcheck used (hybrid 14/15 vs gemini 9/15) | `benchmarks/results/2026-08-24T20-34-32-007Z/raw/scribe.json` | same run's `raw/hybrid.json` |
| `vitasilk` | second speaker, second domain, no ground truth | `benchmarks/results/2026-08-24T21-47-38-860Z/raw/scribe.json` | same run's `raw/hybrid.json` |

Raw outputs: `benchmarks/results/promptv2/{ground-truth,vitasilk}.json`.

## Cost and time

Estimated $0.1873 before spending; actual **$0.2406**.

| reel | cost | wall | prompt tok (text/audio) | visible out | thinking |
|---|---|---|---|---|---|
| ground-truth | $0.103680 | 88.3 s | 3834 / 582 | 413 | 7491 |
| vitasilk | $0.136900 | 157.8 s | 3811 / 643 | 1096 | 9570 |

Thinking ran 18.1x the visible output on the ground-truth reel and 8.7x on
vitasilk — both above the ~5x the estimator assumes, which is why the actual
came in 28% over the estimate. The estimator's `THINKING_TOKEN_MULTIPLIER` of
5 now looks low on this workload.

## Token-count drift

| reel | draft | v1 | v1 drift | v2 | v2 drift |
|---|---|---|---|---|---|
| ground-truth | 75 | 81 | 8.0% | 81 | 8.0% |
| vitasilk | 73 | 73 | 0.0% | 73 | 0.0% |

Neither reel crosses the 15% warning threshold under either version, and
version 2 did not change the count on either reel.

## WER — ground-truth reel, 81 reference words

| | overall | darija | fr/en |
|---|---|---|---|
| v1 (run C, recorded) | 22.2% | 25.0% | 12.5% |
| v2 | **22.2%** | **26.7%** | **6.3%** |
| change | 0.0 | +1.7 (worse) | −6.2 (better) |

Orthography conformance was 97.5% under both, with the same two flags in each
(`l7essass` twice, matched as a near-miss of the frozen `7essass` — the
definite article attached to a frozen word, which the matcher cannot model).

## Token diff — ground-truth (4 differing positions of 81)

1. `[3]` — v1 `pigmentés?` → v2 `pigmentées`
   - v1: `3ndk les cernes pigmentés? tb3i m3aya tal`
   - v2: `3ndk les cernes pigmentées tb3i m3aya tal`
   - v2 agrees with `les cernes` in gender and drops a question mark the
     sentence does not need. This is the fr/en subset improving.
2. `[17]` — v1 `awal` → v2 `awl`
   - v1: `joj dial l7loul awal 7el houa الإبرة`
   - v2: `joj dial l7loul awl 7l houa الإبرة`
3. `[18]` — v1 `7el` → v2 `7l`
   - v1: `dial l7loul awal 7el houa الإبرة الحريرية`
   - v2: `dial l7loul awl 7l houa الإبرة الحريرية`
4. `[50]` — v1 `l7el` → v2 `l7l`
   - v1: `kidom lmodat sana l7el ttani houa la`
   - v2: `kidom lmodat sana l7l ttani houa la`

Positions 2–4 are the darija subset getting worse: v2 dropped the short vowel
in `7el` (solution) and `awal` (first), giving `7l` and `awl`. The ground
truth writes the vowel. Three tokens, and they account for the entire darija
regression.

## Token diff — vitasilk (15 differing positions of 73)

No ground truth, so none of these is right or wrong on WER; they are recorded
as behaviour.

1. `[1]` v1 `d9ay9?` → v2 `d9ay9` — `5 d9ay9? ayeh` / `5 d9ay9 ayeh`
2. `[4]` v1 `lala` → v2 `lalla` — `ayeh a lala 5 minutes` / `ayeh a lalla 5 minutes`
3. `[13]` v1 `ghayrd` → v2 `ghayrdd` — `un soin li ghayrd lik ch3rk` / `un soin li ghayrdd lik ch3rk`
4. `[17]` v1 `msbsb` → v2 `msbseb` — `ch3rk 7rir msbsb jbt likom` / `ch3rk 7rir msbseb jbt likom`
5. `[21]` v1 `Filler` → v2 `filler` — `jbt likom le Filler Glow mn` / `jbt likom le filler glow mn`
6. `[22]` v1 `Glow` → v2 `glow` — same context
7. `[27]` v1 `Silk` → v2 `silk` — `la marque Vita Silk mn ghir` / `la marque Vita silk mn ghir`
8. `[30]` v1 `annaho` → v2 `anno` — `mn ghir annaho ynourri` / `mn ghir anno ynourri`
9. `[49]` v1 `katsnay` → v2 `katsnnay` — `chno katsnay bach thllay` / `chno katsnnay bach thllay`
10. `[55]` v1 `la9rab` → v2 `la9reb` — `siri la9rab salon ila` / `siri la9reb salon ila`
11. `[63]` v1 `Silk` → v2 `silk` — `la marque Vita Silk w l9iti` / `la marque Vita silk w l9iti`
12. `[67]` v1 `Filler` → v2 `filler` — `w l9iti le Filler Glow ma` / `w l9iti le filler glow ma`
13. `[68]` v1 `Glow` → v2 `glow` — same context
14. `[70]` v1 `trddich` → v2 `trddadich` — `ma trddich walaw d9i9a` / `ma trddadich wala d9i9a`
15. `[71]` v1 `walaw` → v2 `wala` — same context

Two patterns worth naming. Version 2 **lowercased the brand and product name**
(`Vita Silk` → `Vita silk`, `Filler Glow` → `filler glow`) at all four
occurrences — consistent within the run, but a change from v1. And the
consonant-doubling differences (`ghayrdd`, `katsnnay`, `msbseb`, `trddadich`)
are spelling instability the guide does not currently rule on either way.

## `و` in the drafts, and what each version produced

Mapping is by Levenshtein anchor alignment across scripts, so rows where the
draft token has no Arabizi counterpart are approximate. The standalone
conjunctions are unambiguous.

**ground-truth** — 17 draft tokens contain `و`; the two that are the
standalone conjunction:

| draft | v1 | v2 |
|---|---|---|
| `[41]` `و` (`لعشرين يوم و l'effet`) | `w` | `w` |
| `[70]` `و` (`خمستاش يوم و كيعطيو`) | `w` | `w` |

The other 15 are word-internal or word-initial `و` inside ordinary words
(`جوج`, `هو`, `يوم`, `وحصة`, `وزايد`, `كيعطيو`, `كيدوم`, `واحدcocktail`) and
neither version produced `ou` for any of them.

**vitasilk** — 5 draft tokens contain `و`:

| draft | v1 | v2 |
|---|---|---|
| `[34]` `وعشرين` | `26` (number rule) | `26` |
| `[48]` `شنو` | `chno` | `chno` |
| `[64]` `ولقيتي` | `w l9iti` | `w l9iti` |
| `[70]` `ولا` | `trddich` | `trddadich` |
| `[71]` `وى` | `walaw` | `wala` |

The conjunction in `ولقيتي` split off as `w` under both versions.

## Every `ou` token, classified

**ground-truth v1** (4) and **v2** (4) — identical sets:

| token | context | classification |
|---|---|---|
| `[16]` `l7loul` | `lik joj dial l7loul awal 7el houa` | long vowel /uː/ (§3) — legitimate |
| `[19]` `houa` | `l7loul awal 7el houa الإبرة الحريرية li` | frozen §4 spelling of `houa` — legitimate |
| `[52]` `houa` | `sana l7el ttani houa la mésothérapie li` | frozen §4 spelling — legitimate |
| `[56]` `houa` | `la mésothérapie li houa wa7d cocktail dial` | frozen §4 spelling — legitimate |

**vitasilk v1** (1) and **v2** (1) — identical:

| token | context | classification |
|---|---|---|
| `[31]` `ynourri` | `mn ghir annaho ynourri yhydrati fih 26` (v1) / `mn ghir anno ynourri yhydrati fih 26` (v2) | French root *nourrir* (§5) — legitimate |

**Zero conjunction corruptions in either version on either reel.**

## What this does and does not tell us

**Does:** version 2 is not a regression on overall WER for the one reel that
can be scored, and it does not reintroduce the `ou` bug. It costs the same and
takes the same time. Token-count drift is unaffected.

**Does not:** it does not show the `و` rule helps, because the bug did not
occur under version 1 on either reel — run B's occurrence is still the only
sighting, and neither of these reels reproduces it. The overall WER tie hides
a real 1.7-point darija regression traceable to three tokens (`7el` → `7l`,
`awal` → `awl`, `l7el` → `l7l`), which may be the reordered keyterms block, the
added paragraph, or ordinary run-to-run variance in a preview model — this
experiment cannot separate those, because it changed two things at once and
ran each version once. A repeat under version 1 on the same draft would
establish the noise floor and has not been done.

Nor does it say anything about vitasilk accuracy: no ground truth, so those 15
differences are described, not judged.

## Live end-to-end run

Separately, the new CLI was run live on `my files/test videos/vitasilk.mov` —
ffmpeg extraction, a fresh Scribe call, the version 2 correction, alignment,
artifact written to `.local/transcripts/vitasilk.json`. This is the first time
`transcribeHybrid` has actually executed.

Cost: scribe $0.001570 + gemini $0.075618 = **$0.077188**. 84.8 s. 70 draft
tokens, 70 corrected, 0.0% drift, no warnings. Both ledger legs were written.

One finding from it: this run rendered the brand as **`Vitasilk`** — one
token, capitalised — where the recorded v1 run produced `Vita Silk` and the v2
replay produced `Vita silk`. That is three distinct renderings of the same
unknown proper noun across three calls. Block 2 session 1 recorded the brand
as self-consistent; that held within a single run and does not hold across
runs. Whether keyterm prompting is load-bearing for brand names now looks more
open than it did, not less.
