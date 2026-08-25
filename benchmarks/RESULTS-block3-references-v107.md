# The references at v1.0.7, after the listening pass

> **Superseded WER figures (Block 4 session 2).** The `test-3` reference was
> corrected: two standalone conjunctions were fused per guide §2 (`W bdebt` →
> `Wbdebt`, `w مادة` → `ومادة`), taking it from 60 reference words to 58.
> They were found by a mechanical scan after three separate hand-written token
> lists had each missed them. Every test-3 WER number below is scored against
> the old text; the re-scored figures are in
> `RESULTS-block4-refcorrection.md`. The findings here are unaffected; only
> the WER column moved.

The user listened to all 16 tokens the Block 3 insertion analysis flagged and
ruled **every one of them a real recovery** — the speaker said them, and no
transcript hallucinated. Separately the user settled the French article by ear:
the token in test-1 is `dial la vidéo`.

**No API calls were made.** The re-score reads recorded engine outputs from
disk; the ledger holds 68 entries before and after.

All four references are now **`v1.0.7-conformant`**.

## What the 16 tokens turned out to be

The ruling was that the words were spoken. It did **not** follow that the
references were missing them, and for twelve of them they were not.

Guide v1.0.7 settles that the conjunction `w` attaches to the word after it.
Every `w` the analysis flagged as an insertion is already in the reference,
attached to its neighbour — the alignment reported it as an insertion only
because the transcript wrote it standalone and the reference wrote it joined.

| reel | flagged token | what the reference actually has | verdict |
|---|---|---|---|
| ground-truth | `w` before `kay3tiw` | `Wki3tew` | already present, attached |
| test-1 | `la` before `vidéo` | `lvidéo` | **corrected to `dial la vidéo`** |
| test-1 | `w` before `hia` | `whia` | already present, attached |
| test-1 | `f` before `الوجه` | `Flwajh` | already present, attached |
| test-1 | `w` before `kay3tiwna` | `Wki3tewna` | already present, attached |
| test-1 | `7ta` before `l joj` | `tal` | **ambiguous, left** |
| test-1 | `7ta` before `l 25` | `tal` | **ambiguous, left** |
| test-2 | `w` before `نضارة` | `ونضارة` | already present, attached |
| test-2 | `w`, `mabin`, `7essa` | `Wmabin 7essa w7essa` | already present, segmented differently |
| test-2 | `chhor` before `kat9edri` | `chhour` | already present, spelled differently |
| test-3 | `w` before `li` | `wli` | already present, attached |
| test-3 | `w` before `7essa` | `w7essa` | already present, attached |
| test-3 | `w` before `kay3ti` | `wkay3ti` | already present, attached |

**One edit was made: `dial lvidéo` → `dial la vidéo` in test-1.** Nothing else
in any reference changed.

### The two tokens left alone

`7ta` in test-1 at 13.30 s and 15.92 s. The transcript reads `mabin 7essa 7ta l
joj` where the reference reads `mabin 7essa tal joj`, and again `mabin 18 7ta l
25` against `mabin 18 tal 25`. §4 freezes both `7ta` (until/even) and `tal` (up
to), so `7ta l` and `tal` may be two spellings of one spoken thing or two words
against one. The recorded analysis cannot tell them apart and neither can this
file, so **they were not guessed at**. A listening pass on those two moments
would settle it.

### Where the correction belongs

For the twelve attached tokens the transcript is the side that is wrong, not
the reference. Guide v1.0.7 states the attachment rule and the correction
prompt now carries it, so the fix arrives by re-transcription rather than by
editing a reference that was already right.

## WER after the change

Word counts: 81 / 68 / 70 / 60 — test-1 gained one because `lvidéo` became two
tokens.

| reel | production before | production after | run C hybrid before | run C hybrid after | gap before | gap after |
|---|---|---|---|---|---|---|
| ground-truth | 19.8% | 19.8% | 16.0% | 16.0% | +3.8 | +3.8 |
| test-1 | 31.3% | **27.9%** | 23.9% | **20.6%** | +7.4 | **+7.3** |
| test-2 | 34.3% | 34.3% | 28.6% | 28.6% | +5.7 | +5.7 |
| test-3 | 20.0% | 20.0% | 18.3% | 18.3% | +1.7 | +1.7 |

test-1's fr/en WER went 33.3% → **0.0%**: the article was its only code-switch
error. The aggregate run-C hybrid row moved 21.6% → 20.8% overall and
6.5% → 4.3% fr/en.

**The production-versus-run-C gap survives, essentially untouched.** It was
+3.8 / +7.4 / +5.7 / +1.7 and is now +3.8 / +7.3 / +5.7 / +1.7. The article fix
moved both sides by the same amount, and the other three reels did not move at
all.

That is worth stating plainly, because the expectation going in was that
reference defects had been penalising correct transcriptions. Two of the three
defects — the curly apostrophes in session 2 and the article here — did exactly
that and are now gone. The third supposed defect, the sixteen omissions, was
not a defect: the references had those words all along. **Nothing about the
references explains the gap.** What remains is the standalone `w`, which is a
transcript error under v1.0.7 and is measured after re-transcription in
`benchmarks/RESULTS-block3-final.md`.

## Supersession

Notices added to the generated header of `RESULTS-block1.md`,
`docs/DECISION-transcription-config.md`,
`benchmarks/RESULTS-block3-generalisation.md` and
`benchmarks/RESULTS-block3-insertions.md`. Every figure in those files scored
against a reference older than `v1.0.7-conformant` is superseded by the tables
above.
