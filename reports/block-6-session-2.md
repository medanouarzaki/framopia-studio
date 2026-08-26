Status: PROBLEM — §6 term boundaries are not derivable from plan data

Stopped at goal 2 as the stop conditions require. Goal 1 is done, session 1's
commits are pushed, and nothing else was attempted. No API call was made, no
plan was modified, and no source file was changed.

## Done

**Session-start checks.** T7 mounted, repo at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. `git status
--untracked-files=no` empty — no tracked file modified. Ledger
`.local/costs.jsonl` sha256
`a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`, **105
lines**.

**Session 1's four commits were still local and are now pushed.**
`origin/main` went `371557a` → `c70a7b9`. `git log` was scanned for AI
attribution and co-author trailers across the pushed range: none present,
author is the user throughout.

### Goal 1 — where grouping happens

**Two passes produce the final groups, in different packages and at different
times.**

1. `service/src/transcription/grouping.ts` → `groupWordsIntoSubtitles(words,
   options)`. Runs during **transcription**, before any keyword exists. The
   decision is one greedy left-to-right test, at the `pairs` expression: two
   adjacent displayable words pair when `second.start - first.end <=
   MAX_INTRA_GROUP_GAP_S` (0.18 s) **and** `second.end - first.start <=
   MAX_GROUP_DURATION_S` (1.2 s). Otherwise the first stands alone. Removed
   words are filtered out entirely but their audio still counts toward the
   gap. Nothing here reads previous groups, so it is fully re-derivable.
2. `service/src/analysis/regroup.ts` → `regroupForKeywords({groups, words,
   keywords})`. Runs during **analysis**, after keyword selection. It does not
   re-pair anything; it works on a `Set<number>` of cut positions seeded from
   the existing groups, then for each keyword **deletes** the cuts inside the
   span and **adds** cuts at its boundaries. It only ever splits.

**`supersededBy`.** `regroupForKeywords` builds `spanOwner: Map<number,
string>` from a kept keyword's first word position to the keyword id. When the
groups are rebuilt, the group starting at that position gets `supersededBy:
owner`; every other group gets `null`. The semantics are in the
`SubtitleGroup` doc comment: the keyword **replaces** the group's rendering
rather than drawing over it, and the builder is told explicitly rather than
inferring it from overlapping time ranges.

A keyword is **dropped, never forced**, with a reason —
`span-not-contiguous`, `would-exceed-group-size` (> `MAX_GROUP_WORDS` = 2), or
`group-is-human-edited`. Two invariants are asserted at the end and throw
rather than returning: no rebuilt group exceeds 2 words, and the rebuilt
groups cover exactly the displayable word count.

Grouping is in those two files and nowhere else.

## The blocker

**Goal 2's constraint cannot be met from plan data alone, so I stopped there
rather than guessing.**

The constraint requires that a contiguous run of Arabic-script words which
"constitutes one §6 term" groups whole. §6 makes that look derivable: the
switch is term-level, and every connective, pronoun, copula and preposition
around a term stays Arabizi. If that held without exception, a **maximal
contiguous run of Arabic-script words would be exactly one term**, and
`PlanWord.script` alone would decide it.

**It does not hold. test-2 carries an 8-word contiguous Arabic run:**

```
w0030..w0037   ترطيب عميق للبشرة شد خفيف للبشرة إشراقة ونضارة
```

All eight are `script: "arabic"`, `lang: "msa"`, confidence 0.97–1.00. That is
**not one term** — and this is not my reading, it is the guide's own example
list. `ORTHOGRAPHY_GUIDE.md` line 87 lists `ترطيب عميق للبشرة` as a complete
procedure term, and `شد خفيف للبشرة` is the same construction as line 87's
`شد طبيعي للوجه`; `إشراقة ونضارة` is an outcome phrase of the line-90 kind.
The run is **three adjacent §6 terms with no Latin function word between
them**. Grouping it whole would put an eight-word card on screen; splitting it
requires knowing where the boundaries are.

**Nothing in the plan marks them.** The full key set on a `PlanWord` is `id,
start, end, text, sourceText, lang, script, confidence, removed,
removedReason, edited` (plus optional `langDisagreement`). `script` and `lang`
are uniform across all eight. `modes/k2-syndicalia.json` `vocabulary` is `[]`
— empty on purpose, per CLAUDE.md, until the user supplies terms at Block 9 —
so there is no dictionary to match against either.

**Timing does not recover it, and I checked rather than assuming.** The
internal gaps are:

| boundary | gap (s) | real term boundary? |
|---|---|---|
| ترطيب → عميق | 0.061 | no |
| عميق → للبشرة | 0.040 | no |
| للبشرة → شد | 0.060 | **yes** |
| شد → خفيف | 0.060 | no |
| خفيف → للبشرة | 0.019 | no |
| للبشرة → إشراقة | 0.140 | **yes** |
| إشراقة → ونضارة | 0.059 | no |

One true boundary sits at the largest gap (0.140) and the other at 0.060,
which is indistinguishable from the 0.061 and 0.060 gaps that fall **inside**
terms. Any threshold that finds the first boundary either misses the second or
invents two false ones. Prosody is not term structure, and inferring one from
the other is exactly the guess the goal forbids.

**The ambiguity is general, not just test-2's.** Arabic runs across the
corpus:

| reel | Arabic runs | lengths |
|---|---|---|
| ground-truth | 3 | 2, 1, 3 |
| test-1 | 9 | 3, 3, 2, 3, 1, 3, 2, 1, 1 |
| test-2 | 2 | **8**, 1 |
| test-3 | 4 | 3, 2, 3, 3 |
| vitasilk | 0 | — (all Latin) |

test-1's 3-runs (`شد طبيعي للوجه`, `تحفيز طبيعي للكولاجين`) **are** single
terms; test-2's 8-run is three. Run length does not discriminate, and the only
way I could tell them apart was by reading them against the guide's example
list by eye. That is a human judgement, not a derivation, and it is not
available to `groupWordsIntoSubtitles` at runtime.

### What is missing, precisely

A term boundary annotation on the transcript. Two candidate homes, neither of
which exists today:

- **A per-word term id on `PlanWord`**, emitted by the Gemini correction pass.
  That pass already applies §6 — it is what decided these words render in
  Arabic script — so it knows the term structure at the moment it makes the
  decision and is throwing it away. This is the same shape as the `lang`
  field, which was added to the response at `ACTIVE_PROMPT_VERSION = 3` for
  the same reason.
- **A populated `vocabulary` in the mode**, with grouping matching the longest
  run against it. CLAUDE.md already records that these terms are load-bearing
  as transcription key terms once the user supplies them at Block 9.

The first is the better fit: a mode vocabulary is a client's brand and domain
list, whereas term-hood here is a property of the utterance.

**Either one is out of scope for this session.** A prompt version bump
invalidates the transcription cache by design, so re-deriving the corpus costs
real Gemini calls — and this session is explicitly no-billing.

## Deviations

- **I ran `npm run check` despite stopping at goal 2.** It is read-only and
  changes nothing; I ran it only so the report's repo state is measured rather
  than assumed. No goal-6 housekeeping was performed.
- **`CLAUDE.md` was not updated.** Goal 6 requires it never describe a state
  the repo is not in. No source file, plan, constant or mode changed this
  session, so it is already accurate; adding a note about work that did not
  happen would make it less so.
- **Nothing from goals 3, 4, 5 was attempted.** No in-memory regrouping, no
  sweep, no `benchmarks/RESULTS-block6-script-grouping.md`, no `.bak` files,
  no plan writes, no `SUBTITLE_BAND` change, no font metrics read, no `npm run
  place`, no mode bump.

## Failures and open problems

- **Goal 2 is blocked on missing data, not on a coding difficulty.** The
  script-aware split itself (Latin word never pairs with an Arabic word) is
  straightforward and would satisfy every part of the constraint list except
  the multi-word-term one. I did not implement the easy half, because a
  grouping pass that splits mixed pairs but also shatters `محفزات الكولاجين`
  into two cards violates §6c — it would trade the ruling this session was
  meant to implement for a different violation of the same guide.
- **An unrelated observation, not chased.** In test-2's Arabic run,
  `sourceText` is offset by one position against `text` — `w0030` has
  `text: "ترطيب"` but `sourceText: "عميق"`, `w0031` has `text: "عميق"` /
  `sourceText: "للبشرة،"`, and so on through the run. `sourceText` is meant to
  be the raw ASR form of that same word. This looks like a Block 2 alignment
  provenance artifact. It does not affect `text`, `script`, `lang` or the
  timings, so it does not change anything above, and I did not investigate it.
  It is worth a look before anyone relies on `sourceText` for audit or diff.
- **Session 1's finding stands and is still unaddressed**: 10 mixed-script
  subtitle groups, one mixed keyword span on test-1, and test-1's
  `g031`/`g032` splitting `محفزات الكولاجين` across two cards in violation of
  §6c. Nothing this session fixed any of it.
- **Untested paths are unchanged from session 1** — no new code was written,
  so no new untested path exists.

## Repo state

- Branch `main`, clean. **HEAD at the time of writing is
  `c70a7b9 docs: record block 6 session 1`**, and `origin/main` is at the same
  commit — session 1's four commits were pushed this session. **The commit
  carrying this report follows HEAD and cannot be named here.**
- **No source file, plan, mode, constant, template or asset was modified.**
- **The five Edit Plans are byte-identical at both ends of the session**
  (goal 4 never ran, so there is no before/after pair to report — these are
  the unchanged values):

| reel | sha256 |
|---|---|
| ground truth | `41ee41d61ace4586af9f813da4531634f729b679917d0debb187898fcc3e936d` |
| test 1 | `0df0077d058c09a07f8a63c02ee92c1316aecd2e0603ea2c9675cfcd2a75ad76` |
| test 2 | `414b3b6fea51e8e6a9d39d45303b99688f6618b823992f46b2c4d52c1889c453` |
| test 3 | `6b10c2c5ebe3f154e7c165291f9022f745fd23e4b9d855fe5bd939662c252e04` |
| vitasilk | `83594625479afd9d68c5dd5dad7feb6548ad023f5e9dc2d1d543710c12269132` |

- **Ledger `.local/costs.jsonl`, session start and session end, identical:**
  sha256 `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`,
  **105 lines** at both ends. No billable call was made.
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 588 / 41, benchmarks 166 / 16 — **875 TypeScript tests**. pytest
  **141 passed**. Unchanged from session 1, as expected with no code change.

## Suggested next step

The ruling is sound and the blocker is one missing field, so the next session
should add it rather than work around it. Bump `ACTIVE_PROMPT_VERSION` to 5 to
have the correction pass emit a term identifier per word alongside the `lang`
it already reports — the same shape and the same justification as the version
3 change, since the pass is applying §6 anyway and currently discards the term
structure it derives. That is a billable session: the prompt bump invalidates
the transcription cache for all five reels, so budget roughly a full
re-transcription and confirm the estimate against
`docs/DECISION-transcription-config.md` first. With `termId` on the word,
goal 2 becomes mechanical — a group's words must share one `script`, and a run
sharing one `termId` groups whole regardless of length — and goals 3 and 4 run
unchanged. Goal 5 is fully independent of all of this: the subtitle band
constants need no transcript data, only the font files and the user's anchor,
so it could be split into its own free session and landed first if the user
wants to start hand-animating before the transcription re-run is paid for.
