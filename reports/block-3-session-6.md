Status: OK

Block 3 session 6, the final session of the block. Folded the user's listening
rulings into the references, bumped the orthography guide to v1.0.7, stated the
two spelling rules in the correction prompt, fixed the subtitle timing floor,
made keywords cover the label and the promise, and re-ran the whole pipeline on
all five reels.

**Session spend $1.369310 over 16 billable calls.** Both cost gates held.

## Done

**1. References at v1.0.7** (be5ed1a). Record in
`benchmarks/RESULTS-block3-references-v107.md`.

The ruling was that all 16 flagged tokens were really spoken. It did **not**
follow that the references were missing them, and for twelve of them they were
not. Guide v1.0.7 settles that `w` attaches, and every flagged `w` is already
in the reference joined to its neighbour — `Wki3tew`, `whia`, `w7essa`,
`ونضارة`, `wli`, `wkay3ti`, `Flwajh`. The alignment reported them as
insertions only because the *transcript* wrote them standalone.

- **One edit made:** `dial lvidéo` → `dial la vidéo` in test-1.
- **Twelve already present**, verified token by token against the files.
- **Two left alone as ambiguous**, exactly as instructed: `7ta` at test-1
  13.30 s and 15.92 s, where the transcript reads `7ta l` and the reference
  reads `tal`. §4 freezes both words, so this may be one spoken thing spelled
  two ways or two words against one. **Not guessed at.**
- All four headers bumped to `v1.0.7-conformant`, `bench:tag` re-run,
  everything re-scored **from recorded outputs with zero API calls** (ledger 68
  lines before and after). Supersession notices added to `RESULTS-block1.md`'s
  generated header, `docs/DECISION-transcription-config.md`,
  `RESULTS-block3-generalisation.md` and `RESULTS-block3-insertions.md`.

**WER movement, and the honest answer on the gap:** only test-1 moved, from
31.3% to 27.9% overall and 33.3% to 0.0% fr/en. The run-C row it is compared
against moved the same amount, 23.9% → 20.6%. The other three reels did not
move at all. **The session-1 gap survived goal 1 essentially untouched** —
+3.8 / +7.4 / +5.7 / +1.7 became +3.8 / +7.3 / +5.7 / +1.7. Nothing about the
references explained it. What did explain it was the standalone `w`, fixed in
goals 2 and 3 and measured in goal 6.

**2. Orthography guide v1.0.7** (f66faf5). Three rules, all settled by the
user, plus §9 entries recording each:

- §2: the conjunction `w` attaches, with `Wki3tewna` and `Mabin 7essa w7essa
  15 yom` drawn from the real references, and `إشراقة ونضارة` for Arabic
  script. A standalone `w` is a spelling error.
- §2/§5: a French noun spoken with its French article keeps it (`dial la
  vidéo`); a French root with Darija morphology takes the attached article
  (`dial lvitaminat`). Both legal; write what was spoken.
- **New §6c**: a §6 term is never broken in the subtitle track. The keyword
  layer selects a **subset** of a long term because keyword templates hold one
  or two words, and that selection does not alter the term — it is a pointer
  into it, not a spelling of it.

Verified that `readGuideVersion` reads `1.0.7`, so the transcription cache
invalidates by design.

**3. Correction prompt version 4** (62fe786). Rules (a) and (b) stated
explicitly in the prompt, because a rule buried in a long injected document is
followed by chance. **This is the only difference from version 3** — a test
asserts that stripping the new block makes version 4 identical to version 3,
and that versions 1, 2 and 3 are untouched so past figures still reproduce.

**4. Subtitle timing floor** (6db0f52). Two causes, two fixes.

**4a.** `sub_pop`'s stub timings were wrong: a 0.60 s floor against
TEMPLATE_LIBRARY_GUIDE §5's own budget of 4–8 frames per end and groups "as
short as ~0.3 s". Set to 0.13 / 0.07 / 0.13, a 0.33 s floor. **This alone
removed 14 of vitasilk's and 13 of test-1's failures** (31 → 17 and 25 → 12).
Keyword and image timings untouched.

**4b.** `service/src/analysis/display-timing.ts`. **Word timings are never
modified** — `start`/`end` stay the §3 authority; `displayStart`/`displayEnd`
are new and say how long the card is up. Extension takes only silence and
never reaches the next group or the reel end; a merge is tried only after
extension fails, and is refused if the merged group would exceed two words or
if **either** group is superseded by a keyword, because that alignment was
established in session 5 and the emphasis layer rests on it. A group that can
be neither extended nor merged is reported and left alone. 21 tests.

Per the standing fragility rule, both fields are **optional with a default**.

**4c.** `findShortWords` reports every word under 0.05 s with its id, text and
whether its timing was interpolated. **Nothing is repaired** — a Block 2
alignment question.

Buildability: vitasilk **31 → 10**, test-1 **25 → 8**.

**5. Label and promise** (1d1558d). Keyword prompt version 3 makes the two
co-primary and asks the model to mark each candidate's kind. **The mix is
forced in the selector, not the prompt**: it reserves a place for the best of
each kind before filling by score, so a run of strong labels cannot crowd out
the promise. A pool that cannot supply both reports `kindShortfall` and selects
by score — never padded, never an invented kind. Head-term diversity is now
per kind, so `Vita Silk` and a promise about it no longer collide while two
labels still do.

Also replaced session 4's coprime rotation with a **seeded shuffle** carrying a
no-adjacent-repeat constraint: 14/14/14 with longest run 1 is a visible A,B,C
cycle and PROJECT_SPEC §1 forbids machine uniformity. Determinism is unchanged.

**6. Live run** (a388440). Full detail in
`benchmarks/RESULTS-block3-final.md`. Ledger all-time before: **$6.186752**.

**The gate: test-1 re-transcribed alone at $0.2090**, under the $0.30 stop. The
transcript-changed merge branch fired for real and cleared keywords, images and
sfx. Verification before spending more:

- **`w`: 0 standalone, 3 attached** (`whia`, `wki3tewna`, `wl'effet`).
- **`dial la vidéo`: correct.**

Across all five reels after re-transcription: **22 attached, 0 standalone**,
including Arabic-script `ونضارة` and `ومادة`.

**WER against the v1.0.7 references:**

| reel | session 1 | now | run C hybrid | gap |
|---|---|---|---|---|
| ground-truth | 19.8% | 22.2% | 16.0% | **+6.2** |
| test-1 | 31.3% | **14.7%** | 20.6% | **−5.9** |
| test-2 | 34.3% | **22.9%** | 28.6% | **−5.7** |
| test-3 | 20.0% | **16.7%** | 18.3% | **−1.6** |

**The session-1 gap does not survive on three of four reels — it inverted.**
fr/en is 0.0% on test-1 and test-2. ground-truth is the exception and it is a
**reference defect**: its own reference writes the conjunction standalone on
four lines (`Mabin 7essa w 7essa` ×2, `W l'effet`) and the article standalone
on two (`wa7d l cocktail`, `3lih l caféine`), so the transcript is penalised
for being right. Not corrected — the listening pass did not cover them and I
was not going to edit a reference on my own reading.

**vitasilk keywords** ($0.0490):

| id | kind | text | words | score | template | supersedes | reason (verbatim) |
|---|---|---|---|---|---|---|---|
| k001 | **label** | `filler glow` | 2 | 0.95 | kw_slam | g013 | names the specific product being promoted |
| k002 | **label** | `Vita Silk` | 2 | 0.95 | kw_slam | g016 | identifies the brand manufacturing the product |
| k003 | **promise** | `7rir` | 1 | 0.90 | kw_slam | g010 | promises a silky texture for the hair |

**test-1 keywords** ($0.1233, run 3, the one on disk):

| id | kind | text | words | score | template | supersedes | reason (verbatim) |
|---|---|---|---|---|---|---|---|
| k001 | **promise** | `شد` | 1 | 0.95 | kw_slam | g002 | states the primary structural benefit of lifting |
| k002 | **label** | `محفزات الكولاجين` | 2 | 0.95 | kw_slam | g013 | names the exact category of the aesthetic product |
| k003 | **promise** | `jawdat البشرة` | 2 | 0.95 | kw_slam | g037 | specifies the skin attribute that will be upgraded |

**Three test-1 runs, cache bypassed:** `محفزات الكولاجين` (label) and
`jawdat البشرة` (promise) in **all three**, same ids and spans. `شد` (promise)
in **two of three**. `شد طبيعي` (promise) in **one** — the same moment, one
word longer. **The label/promise mix held in every run**, 1 label and 2
promises, no kind shortfall anywhere. Scores moved 0.92–0.99 on the same word
and reasons were reworded every time. Reported flat.

**Slots:** vitasilk 5 ($0.0517), test-1 4 ($0.0815), ideas and variation draws
in the results file. **Every image slot passes the duration check on both
reels**, against 3 of 5 and 1 of 4 failing in session 5. Four full composed
prompts are quoted there, all verified free of doubled punctuation.

**SFX:** 8 events on vitasilk, 7 on test-1, none from subtitles.

**Final buildability:** vitasilk 10 issues (7 groups, 3 keywords, 0 slots),
test-1 8 (7 groups, 1 keyword, 0 slots). 12 of vitasilk's 41 groups and 10 of
test-1's 38 hold their card past the last word; test-1 merged one pair.

**Cache hit:** both stages on vitasilk at **$0.0000**, no new ledger line (84
before, 84 after), ten differing leaves all bookkeeping. **The test suite
billed nothing**: 84 lines before `npm run check` and 84 after.

**7. `CLAUDE.md` updated** for all four rulings, the prompt versions, the
timing work, the shuffle, the standing fragility rule, and the two new schema
departures.

## Deviations

- **Goal 1 made one reference edit, not sixteen.** The instruction was to
  insert each recovered token at the position the analysis identified. Twelve
  of them were already in the references, written attached — inserting a
  standalone `w` would have violated ruling (a) and made four correct
  references wrong. I read (a) and (c) together: the words were spoken, and
  where the reference already writes them joined it is spelling them
  correctly. Stated in full in the results file rather than acted on silently.
- **The "16 flagged insertions" reconcile as 15 + 1.** The insertion analysis
  lists 15 tokens; the sixteenth row on the test-1 spotcheck page was the
  `dial lvidéo` spelling question added in session 3, settled by ruling (b).
  No sixteenth token was invented to make the number work.
- **A float tolerance was added to the duration checks.** `0.13 + 0.07 + 0.13`
  is 0.33000000000000007, so a card exactly 0.33 s long was reported as short.
  `DURATION_EPSILON_S = 1e-6`, far below one frame at any frame rate.
- **The third test-1 repeat was run after checking headroom.** At $1.246 with
  $0.154 left and the two prior runs at $0.128 and $0.098, a third fit; it came
  to $0.123 for a total of $1.3693. Had it not fit I would have reported two of
  three.
- **A final slots pass was run on test-1 after the repeats.** The keyword-only
  runs re-cut groups without re-deriving templates, display timing or SFX,
  which live in the slots stage; the pass was a cache hit at $0.0000 and
  restored consistency. That ordering dependency was flagged in session 5 and
  is still not enforced by anything.

## Failures & open problems

- **ground-truth's reference is not v1.0.7-conformant.** Four standalone
  conjunctions and two standalone articles, named exactly in the results file.
  test-3 has one more. This is why ground-truth is the only reel whose gap
  widened, and it is a one-pass fix nobody has authorised.
- **Two `7ta` tokens in test-1 remain undecided** — `7ta l` against `tal`. A
  listening pass on those two moments settles it.
- **7 subtitle groups per reel still fail the floor**, each blocked because a
  merge would make a 3-word group or would break a keyword's group alignment.
  Keywords have no display window at all: a keyword replaces a group and
  inherits that group's timing problem, and 3 of vitasilk's and 1 of test-1's
  fail `kw_slam`'s 0.65 s.
- **11 words across the two reels are under 0.05 s**, seven of them
  interpolated, including three at exactly 0.000 s. Reported, never repaired.
  It is a Block 2 alignment defect and it is the root of several of the group
  failures above.
- **All template timings are still invented.** The 0.33 s subtitle floor comes
  from the guide's frame budget, not from a built comp; Block 6 will move every
  number in the buildability tables.
- **No audio file exists** for either declared sfx id.
- **Keyword selection is less stable than vitasilk's was.** test-1 varied the
  `شد` / `شد طبيعي` span across three runs; vitasilk held all three in
  session 3. Three runs on one reel is the minimum that says anything and it
  says the span, not the choice, is what moves.
- **Code paths added this block that have still never run against real data**,
  updated from session 5's list:
  - keyword span narrowing (`narrowSpan`) — the prompt has prevented every
    over-long span since version 2;
  - head-term diversity skipping — no live collision since the prompt change,
    and now less likely still since a label and a promise no longer collide;
  - all three re-grouping drop reasons;
  - `--force` on transcribe;
  - `NoTemplateVariantError`, `UnknownSfxError`, `StubTemplatesError`;
  - the entire multi-variant assignment path — the real mode has one variant
    per type;
  - `readEditPlan`'s schema-version gate outside its own tests;
  - `merge-blocked-by-keyword` and `merge-would-exceed-two-words` **did** fire
    for real this session, as did the **transcript-changed merge branch**,
    which cleared keywords, images and sfx on test-1 and vitasilk. Those three
    come off the list.
- **`analyse-cli.ts`, `transcribe-cli.ts` and `validate-plan-cli.ts` have no
  unit tests**; verified only by live runs.

## Block 3 handoff data

**Spend across all six sessions: $2.735836 over 37 billable calls.**

| session | calls | spend |
|---|---|---|
| 1 | 8 | $0.624776 |
| 2 | 0 | $0.000000 |
| 3 | 5 | $0.267718 |
| 4 | 4 | $0.224164 |
| 5 | 4 | $0.249868 |
| 6 | 16 | $1.369310 |

By stage: `transcribe-gemini-correction` $1.450128, `analysis-keywords`
$0.916206, `analysis-slots` $0.357084, `transcribe-scribe` $0.012418.
**Ledger all-time: $7.556062** across 84 entries.

**Schema departures from ARCHITECTURE §3 introduced in Block 3**, verbatim for
the handoff's Amendments section:

| field | shape | why |
|---|---|---|
| `transcript.contentHash` | `string?` | A re-run must tell whether downstream word-id references still mean anything without diffing two word arrays. Recomputed from the words, so a plan predating the field is answered exactly rather than assumed stale. |
| `keywords.items[].edited` | `boolean?` | §3 requires an automated re-run never overwrite a human-flagged item; keywords had no way to carry the flag. |
| `keywords.items[].kind` | `'label' \| 'promise'` (optional) | The selector forces a mix of the thing being named and the claim made about it, and the panel has to show which is which. Optional so a plan from an earlier prompt version stays readable. |
| `subtitles.groups[].supersededBy` | `string \| null` (optional) | A keyword and a group can claim the same words and §3 never says which wins. The keyword replaces the group's rendering, and the builder is told rather than inferring it from overlapping time ranges. |
| `subtitles.groups[].edited` | `boolean?` | Same reason as the keyword flag: the re-grouping pass is an automated re-run over groups. |
| `subtitles.groups[].displayStart` / `.displayEnd` | `number?` each | How long the card is on screen, which is not when the words were spoken. §3 gives a group only start/end, and those stay the single timing authority. Optional with a default: absent means the display window is the speech window. |
| `images.slots[].wordIds` | `string[]` | §3 gives a slot only start/end, which leaves a merge unable to tell whether the span it illustrates still exists. |
| `images.slots[].presentation` | `'cutout' \| 'card' \| null` | §3 types it as always set; the quality gate is Block 4, and a guessed `cutout` would read as a decision. |

**The eight fabricated ledger lines from session 3, for the permanent record.**
`.local/costs.jsonl` is gitignored, so these reports are the only place this
can live. In Block 3 session 3 the first version of `analysis/cached.ts` called
`appendCost` in the cache wrapper rather than inside the model call, so running
`cached.test.ts` — which injects a fake model — appended **eight `$0.01`
entries under stage `analysis-keywords`, model `gemini-test`, totalling
$0.08 of spend that never happened**. They were removed the same session by
matching on `stage === 'analysis-keywords' && model === 'gemini-test'`, and the
ledger was verified back at 55 entries / $5.445002 before work continued. The
architecture was then changed so it cannot recur: `appendCost` now fires inside
`runKeywordAnalysis` and `runSlotAnalysis`, at the point of spend, so a stubbed
call cannot bill. Every session since has verified the ledger line count before
and after `npm run check`.

## Repo state

- Branch: `main`. **Pushed** at the end of the session (see below).
- HEAD: `a388440` `test: run the complete pipeline on five reels after the
  v1.0.7 changes`, plus the CLAUDE.md and report commit that follows it.
- Session commits: be5ed1a, f66faf5, 62fe786, 6db0f52, 1d1558d, a388440.
- `npm run check`: **PASS**, exit 0, `check: PASS` marker present.
  **588 tests** — core 69, service 374, benchmarks 145 (up from 549).
- Session spend: **$1.369310** over 16 billable calls.
- Ledger all-time: **$7.556062** across 84 entries, up from $6.186752 / 68.

## Suggested next step

Block 3 ends with the pipeline producing better transcripts than the frozen
Block 1 config on three of four reels, which makes the freeze record itself the
next thing to look at rather than anything downstream: `run C` is still the
document of record and it now describes a configuration the current pipeline
beats, so a re-run of the benchmark harness under guide v1.0.7 and prompt v4
would either replace the freeze or show that the gain is reel-specific. That
should be paired with the ground-truth reference fix, because the one reel
where the new config lost is the one whose reference is not v1.0.7-conformant,
and until those six tokens are corrected any comparison including
ground-truth is measuring the reference rather than the engine. Both are cheap
— the reference fix is free and the re-score reads recorded outputs — and
together they would let Block 4 start from a freeze that reflects what the
pipeline actually does.
