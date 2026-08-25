# The four references swept against orthography guide v1.0.6

The references were corrected piecemeal — `v1.0-unrevised` → `v1.0.1-conformant`
across Block 2 session 6 and Block 3 session 1 — while the guide moved to
v1.0.6. Nothing had ever run the conformance scorer over the references
themselves. This is that sweep.

**No API calls were made.** The scorer is pure text analysis and the re-score
reads recorded engine outputs from disk. The ledger gained zero lines.

All four references are now **`v1.0.6-conformant`**.

## What the scorer found

| reference | words | score | flagged |
|---|---|---|---|
| ground-truth | 81 | 97.5% | 2 freeze-list near-misses, 2 vowel-less warnings |
| test-1 | 67 | 98.5% | 1 freeze-list near-miss |
| test-2 | 70 | 94.3% | 4 freeze-list near-misses, 3 vowel-less warnings |
| test-3 | 60 | 93.3% | 4 freeze-list near-misses |

Every one of the 11 flagged items is a **near-miss false positive**. Not one
is a violation of a stated rule. The near-miss check compares each word to the
freeze list at edit distance 1, which cannot tell a misspelling from a
correctly prefixed or suffixed form:

| flagged | verdict | why |
|---|---|---|
| `l7essass` ×5 | correct | §2 attaches the definite article. This is the very form the `dial l7essass` correction produced. |
| `dialo` | correct | §4 states the pronoun suffix attaches: `diali`, `dialk`, `dialha`, `dialo`, `dialna`. |
| `hadi` | correct | A real word (this/that, f.), not a misspelling of `ghadi`. |
| `homa` | correct | A real word (they), not a misspelling of `houa`. |
| `Wmabin`, `w7essa` | **unsettled** | The `w` conjunction written attached. See below. |

The scorer has **no rule for apostrophe shape**, so it found none of the
violations that actually existed. Those were found by grep.

## What was fixed

Three curly apostrophes, the only unambiguous violation of a stated rule in
any of the four references. Guide §4: "Apostrophes are always straight
(`l'ADN`, `l'effet`), never curly."

| reference | before | after |
|---|---|---|
| test-1 | `Wl’effet` | `Wl'effet` |
| test-2 | `Wl’effet` | `Wl'effet` |
| test-3 | `l’acide` | `l'acide` |

`ground-truth` already wrote both of its apostrophes straight, which is why it
needed no fix and is the precedent the other three were brought in line with.

**This was costing real WER.** Token normalization does not fold `’` onto `'`,
and the engines all write the straight form, so a curly apostrophe in the
reference scored as a substitution against a correct transcription. Correcting
test-3 turned one substitution into a match on the production side and one on
the run-C side — the reference was wrong, not the engines.

## What was deliberately left alone

- **`dial lvidéo` (test-1).** Under user review from Block 3 session 1 and
  explicitly not to move this session. Untouched, and confirmed untouched.
- **The `w` conjunction written attached** — `Wmabin`, `w7essa`, `Wl'effet`,
  `Wki3tewna`, `Wl` and friends. §2 gives `w` as the spelling of the
  consonant و and §2's attachment rule is stated for the **definite article
  only**. The guide does not say whether the conjunction attaches to the
  following word, so there is no rule to conform to. A **user decision**: if
  the conjunction should be written separate, it affects every reference and
  every prompt, and it is the single most-inserted token in the production
  transcripts (8 of 15 insertions — see `RESULTS-block3-insertions.md`).
- **Vowel-less tokens** (`l` ×2, `nkhdm`, `fl`, `wl`). Already warnings rather
  than violations by design: the check cannot separate a correct dropped schwa
  from an unreadable cluster without modelling syllables.
- **`hyaluronique` (test-3).** Contains `q`, and §2 says `q` never appears in
  a Darija word — but §5 says a French word keeps its own spelling, and this
  is French. Not a violation.
- **Capitalisation.** The references capitalise sentence-initial words
  (`Bghiti`, `Wmabin`, `Kat9dri`). The guide says nothing about case, and
  normalization lowercases before scoring, so nothing depends on it.

## Re-score

`npm run bench:tag` regenerated the tagged JSON — the only content diffs are
the three apostrophes and the version string; word counts are unchanged at
81 / 67 / 70 / 60. `npm run bench:aggregate` re-scored `RESULTS-block1.md`
from the recorded run-C outputs. What moved:

| table | before (v1.0.1) | after (v1.0.6) |
|---|---|---|
| aggregate hybrid | 21.9% / 21.3% / 8.7% | 21.6% / 21.3% / 6.5% |
| aggregate gemini | 24.5% / 23.9% / 10.9% | 24.1% / 23.9% / 8.7% |
| aggregate scribe | 71.6% / 98.4% / 6.5% | 71.2% / 98.4% / 4.3% |
| test-3 hybrid | 20.0% / 21.2% / 6.3% | 18.3% / 21.2% / 0.0% |
| test-3 gemini | 25.0% / 33.3% / 12.5% | 23.3% / 33.3% / 6.3% |
| test-3 scribe | 58.3% / 97.0% / 6.3% | 56.7% / 97.0% / 0.0% |

Only test-3 moved per-reel; test-1 and test-2 still mismatch on `Wl'effet` for
the attached `W`, which the apostrophe fix does not touch. Supersession
notices were added to `docs/DECISION-transcription-config.md`, the generated
header of `RESULTS-block1.md`, `RESULTS-block3-generalisation.md` and
`RESULTS-block3-insertions.md`.

**The production-vs-run-C deltas are unchanged** at +3.8 / +7.4 / +5.7 / +1.7,
because the correction moved both sides equally. Nothing here explains the
regression.
