# Block 1, Session 5

Status: OK

No API calls were made. Everything below rescores the engine outputs
session 4 already paid for. Session spend: **$0.00**.

## Done

### Step 1 — orthography v1.0.2

- **`dial`/`diali` confirmed.** The "say the word if you want `dyal` back"
  caveat is gone; §4 now records the decision as settled on 2026-08-24.
- **New §3a, numbers.** Numbers are digits, never spelled out: `4`, `15`,
  `18`. The section spells out why this does not collide with §2 — `3`, `7`
  and `9` are letters inside a word (`3ndi`, `7essa`, `so9`), and a digit
  standing alone as its own token is a number. Nothing else in Arabizi
  produces a standalone digit token, so the two readings never overlap.
- **§6 widened to the whole medical/aesthetic domain**, listed by kind:
  procedures and treatments, anatomical regions (`المنطقة حول العينين`,
  `البشرة`), substance names (`مادة الكافيين`, `الكولاجين`), and outcome
  phrases in the same register (`نتائج جد فعالة`). Brands and French
  technical terms stay Latin, now with `le RRS eyes` and `l'acide
  hyaluronique` named explicitly, plus a tiebreaker for substances that have
  both an Arabic domain name and a French technical one: write the one
  actually spoken.
- **`SCRIPT_RULES` updated to match**, both rules, in the one shared block
  that the transcription and correction prompts both read.
- **Ground truth typo fixed.** `main` → `mabin` in three places
  (`ground-truth.txt` ×2, `test-1.txt` ×1), all unambiguously "between".
  `test-2.txt`'s `les mains` is genuine French and was left alone. The
  tagger no longer carries singular `main` in its French lexicon, with the
  reasoning recorded where the list lives.
- Freeze list needed no change; no test asserted the old content.

### Step 2 — retag and rescore

Retagging picked up the fix — `main`/`Main` no longer appears anywhere in
the ground truth. Word counts unchanged (81 / 67 / 69 / 59). fr/en tagged
words per reel:

- **ground-truth (16):** les, cernes, pigmentées, la, vidéo, Alors, les,
  polynucléotides, l'ADN, du, saumon, l'effet, la, mésothérapie, cocktail,
  caféine
- **test-1 (5):** vidéo, des, injections, kids[en], cabin[en]
- **test-2 (11):** les, le, profhilo, faiblement, réticulé, le, cou, le,
  décolleté, les, mains
- **test-3 (16):** la, mésothérapie, le, RRS, eyes[en], mésothérapie,
  l’acide, hyaluronique, non, réticulé, les, petites, ridules, les, cernes,
  pigmentées

`normalizeForWer` in `normalize.ts` maps spelled-out Darija numerals onto
digits before comparison, deliberately kept off the paths where a word is a
word — hybrid's alignment and the cross-engine timestamp keys — so it
affects scoring only. `wa7d` and `joj` are deliberately excluded from the
map: in these reels they are the indefinite article and a quantifier
(`wa7d l cocktail`, `joj dial l7essass`), not numerals, and the ground truth
never writes them as digits.

**Run B aggregate** (guide v1.0.2, identical engine outputs):

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 67.0% | 98.3% | **10.4%** | 100.0% (223 ar unscored) | — | 0 | $0.0054 | 11.2s |
| gemini | 35.5% | 29.7% | 14.6% | 97.3% (35 ar unscored) | 666ms / 1586ms | 0 | $0.5719 | 567.9s |
| **hybrid** | **31.2%** | **28.5%** | **10.4%** | 97.2% (37 ar unscored) | 0ms / 8ms | 0 | $0.5334 | 654.1s |
| whisper | 84.1% | 95.9% | 95.8% | 100.0% (223 ar unscored) | 145ms / 484ms | 0 | $0.0000 | 50.2s |

Against run A: gemini 40.6 → 35.5 overall and 36.6 → 29.7 on Darija; hybrid
36.2 → 31.2 and 35.5 → 28.5. Run A is preserved verbatim in
`benchmarks/RESULTS-block1-runA.md`; run B is `benchmarks/RESULTS-block1.md`,
which states plainly at the top that no engine was re-run or re-prompted.

### Step 3 — the test-1 inversion

Under v1.0.2 the inversion survives but narrows: gemini 40.3%, hybrid 44.8%
(run A: 46.3 / 50.7). Aligning both engines against the corrected ground
truth word by word, the two share 26 of their roughly 30 errors — this is a
small divergence on a shared error floor, not two different failure modes.

**Hybrid's extra errors are one specific corruption, and it is
Scribe-anchored.** Three times hybrid renders the Darija conjunction و as
French `ou` where gemini writes `w`. Scribe hands the correction pass Arabic
script, and the pass resolves that character to the French word rather than
the Arabizi letter — a code-switch failure that only the hybrid path can
make, because only the hybrid path sees Arabic-script input. The fourth
divergence is a worse local alignment around `الجودة`, where hybrid deletes
the word and substitutes `jawdat` for the following `dial`; gemini keeps
both slots. There is no evidence of the other hypothesis, the correction
pass overriding a right answer — Scribe's own words survive correction
intact everywhere I looked.

**The shared error floor is mostly ground-truth ambiguity, and two thirds
of it is one thing.** Six of the shared errors are a single clause the user
wrote entirely in Arabic script — `محفزات الكولاجين هي عبارة عن إبر` —
including the function words `هي عبارة عن`. Both engines transliterated
those (`hia`, `3ibara`, `3an`). This is beyond even the widened §6 rule,
which covers domain vocabulary, not whole clauses; the rule as written does
not tell an engine to switch script for `هي`. Two more shared errors are
`kids cabin`, which both engines heard as `kidom mabin` ("it lasts
between") — in context (`Wl'effet dial … 18 tal 25 chahr`, "and its effect
lasts 18 to 25 months") the engines are right and the ground truth is a
mishearing, and my tagger compounded it by marking both words English.

**One real scoring bug fell out of the diff and is fixed.** `normalizeToken`
stripped edge punctuation from Latin tokens but returned Arabic tokens
untouched, so the ground truth's `للوجه؟` never matched an engine's
`للوجه`. That is two free errors on test-1 alone and it also broke the
cross-engine timestamp keys, which pair words by normalized text — with it
fixed, hybrid's p90 deviation against Scribe drops from 1794ms to 8ms,
which is what inheriting Scribe's timings should have looked like all along.
The run B table above already includes this fix.

## Deviations (what and why)

- **The brief predicted the rescore would remove "GT inconsistency penalties
  only where normalization now aligns, e.g. digits". It did more than that**,
  because the test-1 diff turned up the Arabic punctuation bug, which is a
  scoring bug rather than a normalization preference. The brief authorised a
  code change in Step 3 if a scoring bug was found, so I fixed it and folded
  it into run B rather than leaving a known-wrong column standing. It moves
  every engine slightly and moves the timestamp columns a lot.
- **Numeral mapping is a fixed table, not a parser.** It covers 3–20 in the
  spellings the Block 1 engines actually produced plus obvious neighbours.
  Compound numbers stay unmatched: the ground truth's `25` against an
  engine's `khmsa w 3chrin` is three tokens against one and no
  token-for-token map can fix it. It costs both Gemini rows one error on
  test-1 and I left it rather than special-casing.
- **One ground-truth typo was left in place.** `ground-truth.txt` line 13
  reads `7sessa` where every other line writes `7essa`; the guide already
  lists `7sessa` as a rejected variant. The brief scoped this session to the
  `main`/`mabin` fix specifically, so I did not widen it — but it is the
  same class of error and costs every engine one word.

## Failures & open problems

- **The widened §6 rule is still not reflected in any engine output.** The
  outputs scored here were produced under v1.0.1 prompts. Anatomical regions
  and substance names remain real errors against the ground truth in these
  numbers, and unlike the numeral artifact this cannot be rescored away — it
  needs a fresh sweep under the v1.0.2 prompt, which costs roughly another
  $1.10 at the corrected Gemini pricing.
- **The ground truth switches script at clause level, not term level.** §6
  now covers domain vocabulary; it does not cover `هي عبارة عن`. Either the
  ground truth should be brought back to term-level switching, or §6 needs a
  clause-level rule. Until one or the other happens, every engine carries
  errors on those words no matter how well it transcribes.
- **`kids cabin` is wrong in the ground truth** and both engines are right.
  Worth correcting before any further scoring; it also needs the tagger's
  English lexicon revisited, since `kids`/`cabin` were tagged en.
- **88.8 seconds is still a thin basis.** The hybrid-versus-gemini gap is
  4.3 points overall and 1.2 on Darija; on four short reels, with hybrid
  losing one of them, that gap is not clearly outside the noise.

## Repo state

- Branch `main`, clean tree, pushed. Commits this session, oldest first:
  - `docs: add numeral rule and widen medical scope as v1.0.2`
  - `feat(benchmarks): score spelled-out numerals as digits`
  - `docs(benchmarks): add v1.0.2 rescore as run b`
  - `fix(benchmarks): strip edge punctuation from arabic tokens`
  - `docs(benchmarks): explain the run b scoring changes`
  - `docs: note guide v1.0.2 and the rescore in operating memory`
- `npm run check`: green — `service/` 14 tests, `benchmarks/` 110 tests
  (up from 104), typecheck and lint clean on both.
- `git log` checked for AI attribution across this session's commits — none.

## Suggested next step

**Did the gap widen or narrow?** It held. Hybrid led gemini by 4.4 points
overall in run A and leads by 4.3 in run B, and on Darija the lead moved from
1.1 points to 1.2 — both engines gained about five points from the scoring
corrections and neither gained at the other's expense. What actually changed
in hybrid's favour is the timestamp column: with the Arabic punctuation bug
fixed, hybrid's p90 deviation from Scribe is 8ms rather than 1794ms, which
makes its one structural advantage — real word timings inherited from
Scribe — legible for the first time.

Before freezing I would fix the two remaining ground-truth defects
(`kids cabin`, `7sessa`), decide whether §6 switches script by term or by
clause, and only then spend the ~$1.10 on a v1.0.2 sweep. That re-run is the
only way to see whether the widened Arabic-script rule closes the gap
between the engines or leaves it where it is, and it is also the only
remaining unknown standing between these numbers and a config freeze.
