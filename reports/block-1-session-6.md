# Block 1, Session 6

Status: OK

Block 1 transcription is closed. The config is frozen and the evidence is
committed. Session spend: **$1.1055** (gemini $0.5625, hybrid $0.5430).

## Done

### Step 1 — guide v1.0.3

§6 now states that the script switch is **term-level, never clause-level**:
only the domain term itself renders in Arabic script, every connective,
pronoun, copula and preposition around it stays Arabizi. The canonical
example is written both ways — `محفزات الكولاجين hia 3ibara 3an إبر`, never
`محفزات الكولاجين هي عبارة عن إبر` — and the rejected clause-level
alternative is recorded with its reason: it makes a word's script depend on
its neighbours rather than on the word, which nothing downstream can
predict. Multi-word terms (`المنطقة حول العينين`) still switch as one unit,
because those words are the term. `SCRIPT_RULES` carries the same rule.

**Ground-truth edits, every changed word:**

| file | was | now | why |
|---|---|---|---|
| ground-truth.txt | `لمدة سنة` | `lmodat sana` | function word + common noun, not domain |
| ground-truth.txt | `7sessa` | `7essa` | guide-rejected variant |
| test-1.txt | `وهي` | `whia` | function word |
| test-1.txt | `هي عبارة عن` | `hia 3ibara 3an` | function words |
| test-1.txt | `الجودة` | `ljawda` | common noun, not a domain term |
| test-1.txt | `kids cabin` | `kidom mabin` | mishearing; both engines were right |
| test-2.txt | `فهو عبارة عن` | `fa houa 3ibara 3an` | function words |
| test-2.txt | `شهر` | `chahr` | common noun |
| test-2.txt | `أشهر` | `chhour` | common noun |
| test-3.txt | `ومادة الكافيين` | `w مادة الكافيين` | conjunction split off the domain term |

After the pass, every remaining Arabic-script token in all four transcripts
is a domain term — procedure, anatomy, substance, or an outcome phrase §6
names explicitly. I checked that by listing them; nothing else survives.
`البشرة`, `حمض الهيالورونيك` and `نتائج جد فعالة` were deliberately kept in
Arabic script, since §6 lists anatomical regions, substance names and
register outcome phrases as domain vocabulary.

`kids`/`cabin` are out of the tagger's English lexicon, with the reason
recorded where the list lives. The freeze list needed no change.

### Step 2 — run C

Gemini and hybrid re-run against all four reels under the v1.0.3 prompts.
Scribe and whisper rows are the stored session-4 outputs, reused
deliberately and labelled as such in RESULTS: Scribe takes no prompt so its
output cannot depend on the guide, and Whisper was never a candidate.

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev (med/p90) | null ts | cost |
|---|---|---|---|---|---|---|---|
| **hybrid** | **24.8%** | **26.1%** | **6.5%** | 97.3% (48 ar unscored) | 0ms / 5ms | 0 | $0.5430 |
| gemini | 26.6% | 27.7% | 8.7% | 97.3% (48 ar unscored) | 466ms / 1462ms | 0 | $0.5625 |
| scribe | 71.6% | 98.4% | 6.5% | 100.0% (223 ar unscored) | — | 0 | reused |
| whisper | 87.4% | 96.3% | 95.7% | 100.0% (223 ar unscored) | 145ms / 484ms | 0 | reused |

Against run B, hybrid moved 31.2% → 24.8% overall and 28.5% → 26.1% on
Darija; gemini 35.5% → 26.6% and 29.7% → 27.7%. **The test-1 inversion is
gone** — hybrid now wins all four reels (test-1: hybrid 26.9%, gemini 29.9%).

Your spotcheck evidence is quoted verbatim in RESULTS: hybrid 14/15, gemini
9/15 with accumulating drift.

Spotcheck HTML is now mirrored to
`benchmarks/results/latest-spotcheck/<reel>-<engine>.html` on every run, for
all future runs, documented in `benchmarks/README.md`. Eight files are there
now, one per reel per engine. **I named them per reel rather than
overwriting a single pair** — a sweep covers four reels and one fixed
filename would have left you with whichever reel happened to run last.

### Step 3 — freeze record

`docs/DECISION-transcription-config.md` written: the four-step config, run C
numbers for all engines, your spotcheck evidence, why each alternative was
rejected, and six caveats — the 88.8s/one-speaker evidence base, the preview
model pin, the unresolved `ou`/`و` corruption, ~5x realtime latency,
$0.35–0.55 per 90s reel from thinking tokens, and the fact that orthography
conformance cannot score the 48 Arabic-script words the guide now mandates.
`PROJECT_SPEC.md` §7 gained one line pointing at it and stating that the
decision document wins where they disagree; §7 is otherwise untouched.

## Deviations (what and why)

- **The aggregate builder had to resolve results per engine, not per run.**
  Run C only produced gemini and hybrid, so pairing each reel with a single
  newest directory would have silently dropped the scribe and whisper rows.
  `findLatestRunPerReel` now returns the newest directory *per engine*,
  which is what lets a partial sweep sit on top of an older full one. Three
  tests cover it, including that it ignores the new `latest-spotcheck`
  mirror directory.
- **Run B was snapshotted to `RESULTS-block1-runB.md`** before the builder
  overwrote `RESULTS-block1.md` with run C, matching how run A was preserved
  in session 5. The brief said to keep run B's table; keeping it in its own
  file rather than pasting it into the run C document keeps the run of
  record readable.
- **Scribe's and whisper's numbers moved even though their outputs did not**
  (scribe 67.0% → 71.6% overall, fr/en 10.4% → 6.5%). That is the v1.0.3
  ground truth, not drift: converting Arabic function words to Arabizi makes
  Scribe's Arabic-script output match less often, while dropping
  `kids`/`cabin` from the fr/en subset changes what that column measures.
  Worth knowing before comparing any column across runs.
- **The RESULTS cost line now says what it is.** It sums the cost column,
  which mixes this run's gemini and hybrid charges with session 4's charges
  for the reused scribe and whisper outputs; it is not a fresh spend figure.

## Failures & open problems

- **The `ou`/`و` corruption is unresolved, not fixed.** It did not recur
  measurably in run C, but nothing was changed to prevent it and I would not
  read one clean sweep as evidence that it is gone. Recorded in the decision
  document as a Block 2 prompt-fix candidate.
- **88.8 seconds, one speaker, one domain** remains the whole evidence base.
  Hybrid's margin over the rejected options is wide; its 1.8-point margin
  over Gemini alone is not obviously outside the noise of four short reels.
  The timestamp evidence, not the WER gap, is what makes the decision safe.
- **Orthography conformance cannot see the Arabic-script words the guide now
  mandates** — 48 of them in run C. The scorer judges Latin script only, so
  the part of §6 that changed most this session is the part it cannot check.
  A domain-term checker would need a term list that does not exist yet.

## Repo state

- Branch `main`, clean tree, pushed. Commits this session, oldest first:
  - `docs: settle term-level script switching as v1.0.3`
  - `feat(benchmarks): teach prompts the term-level script switch`
  - `feat(benchmarks): mirror spotchecks to a stable latest path`
  - `feat(benchmarks): resolve results per engine so partial sweeps stack`
  - `docs(benchmarks): record run c under guide v1.0.3`
  - `docs: freeze the transcription config for block 1`
  - `docs: record the block 1 config freeze in operating memory`
- `npm run check`: green — `service/` 14 tests, `benchmarks/` 113 tests
  (up from 110), typecheck and lint clean on both.
- `git log` checked for AI attribution across this session's commits — none.
- Session spend $1.1055; Block 1 total across sessions 3–6, $2.2521.

## Does run C change the freeze conclusion or its caveats?

It strengthens the conclusion and retires one caveat. Hybrid now leads on
every column and every reel, including test-1, where it had lost in runs A
and B — so the one anomaly that argued against the freeze is gone, and it
went away for a legible reason: the term-level rule and the ground-truth
corrections removed errors that were hitting the hybrid path hardest. The
WER margin over Gemini alone actually narrowed slightly, from 4.3 points to
1.8, which matters less than it looks: the decision never rested on WER but
on timestamps, where your 14/15 against 9/15 and hybrid's 5ms p90 against
Gemini's 1462ms are not close. The caveats stand as written — the evidence
base is still 88.8 seconds of one speaker, the model is still a preview pin,
and the `ou`/`و` corruption is still unfixed rather than proven absent.

## Suggested next step

Block 1 transcription is done; `docs/DECISION-transcription-config.md` is
the evidence. Before Block 2 builds the real pipeline on top of this, the
cheapest useful thing is a second speaker or a non-aesthetics reel — one
reel, ~$0.14 — to check that the frozen config is not tuned to one person's
voice and one domain's vocabulary. That is the single caveat that most
affects whether Block 2 is building on solid ground.
