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
| **hybrid** | **20.8%** | **21.3%** | **4.3%** | 97.3% (48 ar unscored) | 0ms / 5ms | 0 | $0.5430 |
| gemini | 23.3% | 23.9% | 6.4% | 97.3% (48 ar unscored) | 466ms / 1462ms | 0 | $0.5625 |
| scribe | 71.3% | 98.4% | 6.4% | 100.0% (223 ar unscored) | — | 0 | $0.0054 |
| whisper | 87.4% | 96.3% | 95.7% | 100.0% (223 ar unscored) | 145ms / 484ms | 0 | $0.0000 |

The WER columns above are **re-scored against the `v1.0.7-conformant`
references** and supersede every earlier figure this table carried — hybrid
24.8% / 26.1% / 6.5% then 21.9% / 21.3% / 8.7%, gemini 26.6% / 27.7% / 8.7%
then 24.5% / 23.9% / 10.9%, scribe 71.6% / 98.4% / 6.5%. No engine was ever
re-run: the outputs are the same recorded run-C responses, and only the
references moved (ground-truth in Block 2 session 6, test-1 and test-2 in
Block 3 session 1, the curly apostrophes in all four in Block 3 session 2,
and the French article in test-1 in Block 3 session 6). The immediately
preceding figures this table carried were hybrid 21.6% / 21.3% / 6.5%,
gemini 24.1% / 23.9% / 8.7% and scribe 71.2% / 98.4% / 4.3%.
Whisper is unchanged. The ranking that decided the freeze is unchanged; see
`benchmarks/RESULTS-block1.md` for the live table.

Hybrid beats Gemini on overall WER on three of the four run-C reels —
test-1 (23.9% against 29.9%), test-2 (28.6% against 30.0%) and test-3 (18.3%
against 23.3%) — and loses the ground-truth reel by 1.2 points (16.0% against
14.8%). test-1 is the reel it had lost to Gemini in runs A and B.

That claim originally read "Hybrid wins every reel in run C, including
test-1, where it had lost to Gemini in runs A and B." It was never true:
Gemini beat hybrid on the ground-truth reel under the original scoring
(21.0% against 22.2%) as well as after every subsequent re-score. Found and
corrected in Block 3 session 2.

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

## Amendment — prompt version 4 activated (2026-08-25)

Recorded here in Block 4 session 6. It was activated in Block 3 session 6 and
recorded in `CLAUDE.md` and `reports/block-3-session-6.md`, but not in this
file, so the freeze record named version 3 while the code ran version 4 for
three sessions. A test now reads this file and fails when the two diverge
(`service/src/decisions.test.ts`).

The freeze decision above is unchanged: the engine chain, the model pin and
the alignment method are as frozen.

**`ACTIVE_PROMPT_VERSION = 4`.** Version 4 is version 3 plus two spelling
rules stated outright in the prompt rather than left to be found in the guide:
the conjunction `w` attaches to the word that follows it, and a French noun
spoken with its French article keeps that article (`dial la vidéo`) while a
French root carrying Darija morphology takes the attached one
(`dial lvitaminat`). Both are ORTHOGRAPHY_GUIDE v1.0.7 rules the user settled
by ear over a listening pass.

**The rule took completely: 22 attached conjunctions and 0 standalone across
all five reels**, including Arabic-script `ونضارة` and `ومادة`.

WER against the v1.0.7 references inverted on three of four reels — production
beat run C hybrid on test-1 (14.7% against 20.6%), test-2 (22.9% against
28.6%) and test-3 (16.7% against 18.3%). The fourth, ground-truth, was a
reference defect corrected in Block 4 session 1; production now beats run C on
all four. Numbers in `benchmarks/RESULTS-block3-final.md` and
`benchmarks/RESULTS-block4-refcorrection.md`.

Both the prompt bump and the guide bump invalidate the transcription cache by
design, which is why the session that made them cost more than the rest of
Block 3 together.

## Amendment — transliteration-aware alignment cost adopted (2026-08-28)

The frozen config names the alignment method as "realigned onto Scribe's
timings by Levenshtein anchoring with linear interpolation across inserted
words." **The anchoring's substitution cost is now transliteration-aware.**
Everything else in the freeze is unchanged: Scribe v2 batch, prompt version 4,
the same guide, the same interpolation, the same drift accounting.

**Why.** Scribe returns Darija in Arabic script and the correction pass returns
Arabizi, so under a flat cost **every cross-script pair scores exactly 1**. The
comparison carries no information at all: whole runs tie, and which draft token
a word receives is settled by the backtrace's preference order rather than by
evidence. Scoring the pair against ORTHOGRAPHY_GUIDE §2's character table gives
it a minimum to find — `mn`/`من` costs 0.2 where `mn`/`غير` costs 1.

**The evidence is two hand-made references**, judged by the user and never
generated by code:

- `benchmarks/references/align/vitasilk.json` — 73 rows, all judged: 54
  correct, 18 wrong, 1 two-tokens, **74.0% human-confirmed**.
- `benchmarks/references/align/vitasilk.rereview.json` — the 17 rows the change
  moved, judged 2026-08-28: **7 correct, 2 misheard, 7 wrong, 1 unjudged**.

The change moved 16 of the 18 pairings marked wrong and **none** of the 54
marked correct; the second pass returned nine repaired and none damaged.

**The corpus check.** Across all five reels, from the cached responses with no
model call: **anchored words 330 → 330**, no reel losing one, interpolated
13 → 13, zero-duration words 13 → 13, duplicate intervals 0 → 0, and 67 rows
changing anchor. Block 7's discarded same-script fix took anchored words from
330 to 230, which is why that is the guard.

**One regression, recorded rather than netted away.** `vitasilk` `w0036` (`26`)
held `وعشرين` under the flat model and holds nothing now. Its true source is
`ستة` + `وعشرين`, two tokens for one word, which the aligner has no operation
for; the user left the row unjudged. It is the only merge regression among nine
anchor losses, against nine gains.

**The flat model stays selectable** as `legacy`, the same way prompt version 2
above stays selectable: every figure recorded before this date was measured
with it, and a comparison against those numbers must be able to reproduce them.
Nothing in the pipeline passes it.

Recorded at sha `6708431`, entry `transcription-758a3924d090d1b5` on every reel,
prompt version 4. Full working in
`docs/DEFECT-alignment-script-mismatch.md` §A.0.

## References

- `benchmarks/RESULTS-block1.md` — run C, the run of record.
- `benchmarks/RESULTS-block1-runA.md`, `-runB.md` — earlier scoring passes,
  kept so the effect of each guide revision stays visible.
- `docs/ORTHOGRAPHY_GUIDE.md` — injected verbatim into both prompts; v1.0.3
  at the time of the freeze, v1.0.4 since (`bach` added to the §4 freeze list).
- `benchmarks/RESULTS-block2-promptv2.md` — the version 2 comparison behind
  the amendment above.
- `docs/DEFECT-alignment-script-mismatch.md` — the alignment defect, its
  diagnosis and the adoption above.
- `benchmarks/references/align/` — the two hand-made references the adoption
  rests on.

## Amendment — the corpus is pinned at ORTHOGRAPHY_GUIDE v1.0.7 (2026-08-28)

**The five reels stay on transcriptions made against guide v1.0.7 for the
remainder of Block 8.** The guide itself is unchanged and stays at v1.0.8; what
is pinned is the corpus, not the rules.

**How it arose.** The transcription fingerprint reads the guide version out of
the file, deliberately, so a guide bump invalidates on its own. The bump to
v1.0.8 happened in Block 4 session 3 and nothing has been re-transcribed since,
so the invalidation was never felt. Block 8 session 13 found it by recomputing
every fingerprint against the entries on disk: the pinned entry
`transcription-758a3924d090d1b5` reproduces exactly at (prompt v4, guide
v1.0.7), and today's configuration computes `ceba491c1af5b52f`, which exists
nowhere.

**Why the corpus is pinned rather than re-transcribed.**

- **The correction call is not reproducible.** Three identical calls in Block 2
  returned three different corrected texts. Re-transcribing does not restore the
  same words at better spelling; it returns *different* words.
- **Different words invalidate both hand-made references.**
  `benchmarks/references/align/vitasilk.json` (73 rows) and
  `vitasilk.rereview.json` (17 rows) judge pairings between specific corrected
  words and specific draft tokens. Change the corrected words and every row
  names something that no longer exists. They are the project's only
  non-circular measure of aligner correctness and **cannot be regenerated** —
  they are a human's judgement, collected over two passes.
- **The money does not justify it.** Re-transcribing all five reels costs
  ~$0.84, and the cascade it triggers — new texts miss the analysis and slot
  caches, new slot ideas miss every image — takes it to **~$3.57** against a
  remaining balance of roughly **$8.04**, which must also cover `test-1`'s
  image candidates (~$1.21, approved in principle) and Block 10's golden runs
  on two machines.

**What v1.0.7 does not carry** is v1.0.8's single rule: the conjunction before
an Arabic-script term attaches in Arabic script as a proclitic (`ومادة`, not
`w مادة`). That is one orthographic rule affecting a small number of tokens, and
it is a spelling difference in text the pipeline already produces — not a defect
in timing, alignment, or anything downstream.

**The compatible-reuse policy.** A cache entry at the **same prompt version**
with an **older guide version** is reused, and labelled `compatible` everywhere
it is visible — the dry run, the runner's log, and the Edit Plan's own
`pipeline.<stage>.cacheProvenance`. Any other difference resolves `none` and a
run bills. `core/src/entry-resolve.ts` is the single implementation and
`resolveTranscriptionEntry` the single caller-facing entry point; the rule is
pinned by tests in both packages.

**The analysis stages do not get a compatible reuse.** Their fingerprint carries
no guide version, so the only way an analysis entry can differ is in the prompt
version, the mode content the call reads, the transcript or the candidate count
— and each of those changes the question the model was asked. `test-1` and
`vitasilk` hold keyword entries at analysis prompt version 3 against an active
4, and v4 asks for §6 term boundaries v3 was never asked for. Those resolve
`none`.

**Deferred to Block 10**, with the second reference: whether to re-transcribe
the corpus at the current guide, what it costs at that point, and whether a
reference collected against v1.0.7 pairings can be carried forward or has to be
re-made. Nothing here forecloses it.

## Amendment — Arabic is written in Arabic letters (2026-08-31)

**User ruling, 2026-08-31.** `docs/ORTHOGRAPHY_GUIDE.md` is at **v2.0.0**:

> **Arabic is written in Arabic letters. French and English are written as they
> are.**

One rule, and no judgement about whether a French word is technical enough.
`3ndk` becomes `عندك`; `les cernes pigmentés` stays Latin; `alors` and
`la vidéo` stay Latin because they are French; `sana`, `yom` and `l7essass`
become Arabic because they are Arabic.

**Why it reverses the founding assumption.** Every version from v1.0.0 to
v1.0.8 wrote Moroccan Darija in **Arabizi** and reserved Arabic script for a
named medical domain and for formal MSA. That was a Moroccan-agency habit, and
the tool is now being built for Arabic content creators whose speech is mostly
Arabic with some English. Measured against the corpus, the old rule put only
**13.1% of words — 45 of 343 — in Arabic script.**

**What did not change.** `ACTIVE_PROMPT_VERSION = 4` is unmoved. The prompt's
shape is unmoved: same head, same `SCRIPT_RULES` block, same two restated
spelling rules, same response shape, same keyterms position. What changed is
**what those rules say**, and the guide they carry, both of which are the
guide's business rather than the prompt's.

**Nothing already transcribed re-bills, and this was measured rather than
reasoned about.** `guideVersion` is one of the five transcription fingerprint
inputs, so a bump does move the fingerprint — but `resolveTranscriptionEntry`
resolves **`compatible`** for an entry at the same prompt version and an older
guide, and reuses it. Run against the real cache after the bump, all five reels
resolve `compatible` on `transcription-758a3924d090d1b5` (prompt v4, guide
v1.0.7), and every reel's dry run reports transcription as **skip**. The corpus
therefore stays Arabizi until somebody deliberately re-transcribes it.

**Two orthography instructions live in code, not in the guide, and both were
rewritten in the same commit** — `SCRIPT_RULES` in `core/src/script-rules.ts`
and the version-4 `spellingRules` block in
`service/src/transcription/correction.ts`. Both restated the Arabizi rules
verbatim; leaving them would have sent the model a guide saying one thing and a
prompt saying the opposite. **Neither is covered by any fingerprint input** —
the cache keys on the guide's *version*, not on the prompt's text — so they must
be changed with the guide or not at all, and a test now fails if an Arabizi
instruction reaches the prompt again.

**The four hand-written ground-truth transcripts are pinned at v1.0.8 and are
not rewritten.** `REFERENCE_ORTHOGRAPHY_VERSION` in
`benchmarks/src/verify-references.ts` is the pin; before it, `npm run check`
compared each reference's header against whatever version the guide currently
carried, which under v2.0.0 asks whether a record of what was said obeys a rule
made afterwards. The conformance scorer is unchanged for the same reason: it
scores the v1.0.x rules, which are the rules those four files were written
under.

**What this leaves open.** No reel has ever been transcribed under v2.0.0, so
nothing here is evidence that the new rules produce a better transcript — only
that the configuration is consistent and costs nothing to adopt. Judging a
v2.0.0 run needs a reference in the new orthography, and the four that exist are
Arabizi.
