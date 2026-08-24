# Block 2 robustness run — one reel outside the Block 1 sample

Run: `benchmarks/results/2026-08-24T21-47-38-860Z`
Config: the Block 1 freeze, unchanged. Scribe v2 batch → Gemini
`gemini-3.1-pro-preview` correction (ORTHOGRAPHY_GUIDE v1.0.3 + shared script
rules) → Levenshtein anchor alignment onto Scribe timings. No prompt, model
pin, or config value was touched for this run.

This is evidence collection, not a re-decision. Nothing here proposes a change
to the frozen config, and one reel could not justify one.

## Why this reel

The Block 1 freeze rests on 88.8 s of a single speaker in a single domain
(aesthetics). This reel is a **different speaker (woman)** talking about a
**hair product**, brand name "vitasilk" — a second voice and a second domain in
one file. The brand is not a Framopia client and never will be a mode; it
appears here only as a real unknown proper noun occurring in real speech, with
no keyterm list behind it. That is the point of including it.

## Reel metadata

| | |
|---|---|
| file | `my files/test videos/vitasilk.mov` |
| label | `vitasilk` |
| duration | 25.692 s |
| resolution | 2160×3840 (portrait) |
| frame rate | 30000/1001 (29.97) |
| video codec | ProRes |
| audio | pcm_s24le, 48 kHz, 2 ch (extracted to mono 16 kHz PCM as usual) |
| ground truth | none |

Materially consistent with the Block 1 reels (same resolution, same frame rate,
same capture chain). It is 25.7 s against their 21–23 s — longer, but not by
enough to change anything. One voice throughout; no audible second speaker.

## Engines, cost, time

Only **scribe** and **hybrid** were run. Gemini-alone and whisper were
deliberately skipped: cross-engine timestamp deviation is not informative here
because hybrid aligns onto scribe's own timings, and whisper is only a liveness
check.

| engine | orthography | ts deviation vs scribe (median/p90) | null ts | cost | wall | realtime |
|---|---|---|---|---|---|---|
| scribe | 100.0% (42 arabic-script words unscored) | — | 0 | $0.001570 | 2.6 s | 0.10x |
| hybrid | 98.6% (0 arabic-script words) | 0 ms / 0 ms (29 matched pairs) | 0 | $0.112576 | 66.3 s | 2.58x |

Estimate before the run was $0.1013 against $0.114146 actually spent (the
hybrid line includes its own scribe call; the standalone scribe run is the
extra $0.001570). Both are recorded in `.local/costs.jsonl`. The Gemini
correction call reported 1096 visible output tokens against 7433 thinking
tokens — 6.8x, above the ~5x seen in Block 1, and one more reason no Gemini
caller may omit `thoughtsTokenCount`.

Wall clock for the whole invocation was 69.4 s, 2.70x realtime.

## Orthography conformance

Scribe scores 100.0% only because 42 of its 73 tokens are Arabic script and the
checker cannot judge those — the same blind spot recorded in Block 1. The score
is not meaningful for scribe.

Hybrid: 98.6%, one flagged item, listed in full:

- `bach` — flagged as a near-miss of freeze-list `wach` (edit distance 1).

This is a **false positive**, not a violation. `bach` (باش, "so that") and
`wach` (واش, the interrogative particle) are different words; hybrid spelled
both correctly. The freeze-list fuzzy matcher has no way to tell a near-miss
spelling from a genuinely different short word. Zero digit-substitution errors,
zero `sh`-for-`ch` digraph errors, 4 of 5 freeze-list occurrences matched
exactly.

## Unknown-proper-noun rendering: "vitasilk"

The brand occurs twice. Every token that plausibly corresponds to it, verbatim,
with context:

**Scribe** (2 occurrences, both in Latin script inside otherwise Arabic-script
text):

1. `Vita` `Silk` — "جبت لكم le filler glow من la marque **Vita Silk** من غير أنه ينغّي"
2. `Vita` `Silk` — "إذا لقيتي عندهم la marque **Vita Silk** ولقيتي le filler glow"

**Hybrid** (2 occurrences):

1. `Vita` `Silk` — "jbt likom le Filler Glow mn la marque **Vita Silk** mn ghir annaho ynourri"
2. `Vita` `Silk` — "ila l9iti 3ndhom la marque **Vita Silk** w l9iti le Filler Glow"

**Distinct forms: one.** `Vita Silk` — split into two tokens, both
title-cased — in all four occurrences across both engines. The pipeline was
completely self-consistent: no misspelling, no drift between occurrences, no
Arabic-script rendering of the brand, and no disagreement between scribe and
hybrid. The correction pass passed the brand through untouched.

Nothing here was corrected and the brand was not added as a keyterm. There is
no canonical spelling to record — this is not a client and no mode file will
ever cover it.

The finding cuts both ways, and it is the honest read: an unknown proper noun
with no vocabulary behind it came out stable, which is weak evidence *against*
keyterm prompting being load-bearing for brand names. But the split form
(`Vita Silk`, not `Vitasilk`) is a real ambiguity that only a keyterm list could
resolve, and only the client would know which is right. One reel, one brand,
two occurrences — do not generalize from it.

## Arabic-script audit

**Hybrid emitted zero Arabic-script words.** There is no list to present.

Scribe produced 42 Arabic-script tokens (its normal behaviour — it returns
Darija in Arabic script), and the correction pass transliterated every one of
them into Arabizi, including all the hair-care vocabulary:

- `شعرك` → `ch3rk` (hair, twice)
- `حرير مسبسب` → `7rir msbsb` (silky, smooth)
- `ينغّي، ييدرات` → `ynourri yhydrati` (nourishes, hydrates)
- `تهلّي` → `thllay` (take care of)

ORTHOGRAPHY_GUIDE §6(a) scopes the Arabic-script rule to the medical and
aesthetic domain, and hair care sits on that boundary. On this reel the
pipeline placed hair care **outside** §6(a) and transliterated throughout —
but it did so with no instruction either way, so this is the model's default,
not a decision the guide made.

**This is an open question for the user, recorded neutrally.** Nothing in the
guide was edited and no ruling is proposed here. The list above is what a §6(a)
ruling would have to cover if hair care were brought inside it.

## `ou` / `و` corruption

**It did not reappear.** The Arabic conjunction و was rendered as `w` in every
instance:

- scribe `ولقيتي` (22.08 s) → hybrid `w` `l9iti` — split correctly, conjunction as `w`
- scribe `وعشرين` (11.62 s) → hybrid folded into `26` (number rule, correct)
- scribe `ولا` / `وى` (24.60 / 24.84 s) → hybrid `walaw` — و inside the word, as `w`

Exactly one hybrid token contains the letters `ou`: **`ynourri`** at 9.84 s,
from scribe's `ينغّي`. This is not the corruption. It is a French-derived
hair-care verb (*nourrir* → *ynourri*) where `ou` spells the /u/ vowel, not a
conjunction resolved into French *ou*. Whether v1.0.3 wants `ou` or `u` for that
vowel in a French-derived Darija verb is a separate orthography question the
guide does not currently answer; it is not a regression.

## Timestamps — one thing the summary table hides

The 0 ms / 0 ms deviation in the table is computed over **29 matched token
pairs out of 73**. Matching is by normalized text, and hybrid transliterates
Darija out of Arabic script, so only the code-switched French/English tokens
(`le`, `la`, `marque`, `salon`, `minutes`, `et`, `aussi`, `des`, `enzymes`,
`c'est`, `dernière`, `génération`, `lissage`, `un`, `soin`, `Vita`, `Silk`) can
match at all. Those agree perfectly. The Darija spans — 60% of the reel — are
not covered by that statistic on this reel at all.

Comparing position-by-position instead (a rough proxy, since hybrid legitimately
re-tokenizes), 34 of 73 tokens carry a start time up to 740 ms from the scribe
token at the same index, concentrated in the first ~10 s where the correction
pass inserted tokens (`هذا` → `a lala`) and split others (`ولقيتي` → `w` +
`l9iti`). That is what anchor alignment with linear interpolation is expected to
do around insertions, and it is not evidence of a fault — but it is not
evidence of correctness either. Only the spotcheck HTML, checked by ear, can
settle it, and that has not been done for this reel.

Spotchecks: `benchmarks/results/latest-spotcheck/vitasilk-hybrid.html` and
`vitasilk-scribe.html`.

## Other observations

Scribe emitted the CJK character **`五`** (Chinese "five") at 1.60 s where the
speaker said "5 minutes" — mid-sentence, in an Arabic/French reel. The
correction pass fixed it to `5`. A one-off, but it shows scribe's raw output can
contain scripts from nowhere near this language pair, and any consumer of raw
scribe output has to tolerate that.

Number handling followed the guide in both places: `خمس دقائق` → `5 d9ay9`,
`ستة وعشرين` → `26`.

## What this does and does not tell us

**Does:** the frozen config runs end to end on a second speaker in a second
domain without failing, at a cost and speed in line with Block 1
($0.1141, 2.7x realtime). Transliteration coverage was complete — zero Arabic
script survived into the hybrid output. An unknown brand name came out stable
and self-consistent. The `ou`/`و` corruption did not recur on this reel.
Orthography conformance was 98.6% with the single flag being a scorer false
positive.

**Does not:** **WER is unscored — there is no ground truth for this reel**, so
nothing here says how *accurate* the transcript is. Everything above is
conformance, consistency, cost and timing; a fluent, well-formed, confidently
wrong transcript would score exactly the same. Nor does it say anything about
timestamp quality on Darija spans, which no automated check on this reel
covers. And it is one reel: the sample is now two speakers and two domains,
which is still thin. Nothing here is a reason to revisit the freeze, and
nothing here confirms it either.

To turn this into scored evidence, hand-written ground truth for `vitasilk`
in `.local/ground-truth/vitasilk.txt` plus `npm run bench:tag` is all that is
needed; the run outputs are on disk and can be rescored without paying again.
