Status: OK

Block 3 session 2. Pushed the repo to GitHub for the first time from this
drive, separated the production transcripts' inserted tokens from their
deleted ones so a human ear can rule on them, swept the references against
guide v1.0.6, pruned the language lexicons to spelling-decisive entries only,
corrected a false claim in the freeze record, fixed the cache-hit cost
bookkeeping, and built the client mode schema with a validated K2 stub.

**Zero billable API calls. The ledger gained zero lines** — 55 entries before
and after, the last one still timestamped `2026-08-25T00:51:33.879Z` from the
previous session. Every analysis ran on artifacts already on disk.

## Done

**0. Push.** All five local-only commits verified free of AI attribution
trailers (`git log --format="%B%n%an%n%ae"` grepped for claude / generated
with / co-authored / anthropic — none found), then pushed:
`73a922d..8877184 main -> main`. `git status -sb` now reads
`## main...origin/main` with no divergence.

**The commit last session's report did not name: `8877184`, subject `docs:
update operating memory and add block 3 session 1 report`.** The report named
HEAD as 67c5ff6 and said CLAUDE.md and the reports were uncommitted "at the
time of writing"; 8877184 is the commit that landed them.

**1. Inserted and deleted tokens** (e1a39ac). Findings in
`benchmarks/RESULTS-block3-insertions.md`.

- `benchmarks/src/insertions.ts` — `normalizeWithProvenance` rebuilds the
  normalized-slot → source-token mapping the normalizer discards, so
  alignment's edits can be named in the words actually written.
  `analyseEdits` returns insertions (with timestamps, lang, script, freeze-list
  membership, whether the timing was interpolated, and three words of context
  each side) and deletions.
- `benchmarks/src/normalize.ts` — `mapNumeral` exported so the analysis
  compares exactly the tokens WER compares. `normalizeForWer` now calls it.
- `benchmarks/src/insertions-cli.ts` — the driver.
- `benchmarks/src/insertions.test.ts` — 7 tests.
- **15 insertions, 2 deletions** across 291 production and 278 reference
  words. 8 of the 15 are the conjunction `w`. 5 of the remaining 7 are on the
  §4 freeze list. Nothing inserted in Arabic script; nothing tagged `msa`,
  `en` or `mixed`. Three carry interpolated timings.

**Spotcheck pages**, one per reel, insertions only, each row showing token +
context + a play control starting 1 s before the token and running 2.6 s:

```
benchmarks/results/latest-spotcheck/ground-truth-insertions.html   1 token
benchmarks/results/latest-spotcheck/test-1-insertions.html         6 tokens
benchmarks/results/latest-spotcheck/test-2-insertions.html         5 tokens
benchmarks/results/latest-spotcheck/test-3-insertions.html         3 tokens
```

The existing tool in `benchmarks/src/spotcheck.ts` was extended, not rebuilt:
an optional context column, a configurable lead-in and play length, and
configurable answer labels (`recovery` / `hallucination`). Its default
behaviour and the timestamp pages a benchmark sweep produces are unchanged,
and its 7 existing tests still pass untouched. `benchmarks/results/` is
gitignored, so the pages are not committed.

**2. Reference sweep against guide v1.0.6** (ef18c23). Record in
`benchmarks/RESULTS-block3-references.md`.

- Conformance scorer run over all four references. It flagged 11 items, **all
  freeze-list near-miss false positives**: `l7essass` ×5 (§2 attaches the
  definite article), `dialo` (§4 attaches the pronoun suffix), `hadi` and
  `homa` (real words, not misspellings), `Wmabin` and `w7essa` (the unsettled
  `w` question below).
- **Fixed: three curly apostrophes**, the only unambiguous violation of a
  stated rule (§4: apostrophes are always straight). `Wl’effet` → `Wl'effet`
  in test-1 and test-2, `l’acide` → `l'acide` in test-3. `ground-truth`
  already wrote both of its straight, and is the precedent.
- **The scorer has no rule for apostrophe shape**, so it found none of these.
  They were found by grep. That is a gap in the scorer, not a finding it made.
- All four headers bumped to `v1.0.6-conformant`; `npm run bench:tag`
  propagated it into `GroundTruth.version`. Word counts unchanged at
  81 / 67 / 70 / 60.
- Re-scored from **recorded outputs only, zero API calls**. `aggregate.ts`
  imports no engine client and reads only from disk; I verified that by
  reading it before running it. Supersession notices added to the generated
  header of `RESULTS-block1.md` (so it travels with regeneration),
  `docs/DECISION-transcription-config.md`,
  `RESULTS-block3-generalisation.md` and `RESULTS-block3-insertions.md`.
- **`dial lvidéo` was not touched**, and I verified it is still exactly as it
  was.

**The apostrophe was costing real WER.** Token normalization does not fold `’`
onto `'`, and every engine writes the straight form, so the reference was
scoring a correct transcription as a substitution. Aggregate hybrid 21.9% →
21.6%, gemini 24.5% → 24.1%, scribe 71.6% → 71.2%; test-3 hybrid 20.0% →
18.3%. The reference was wrong, not the engines. The production-vs-run-C
deltas are **unchanged** at +3.8 / +7.4 / +5.7 / +1.7, because both sides moved
together.

**3. Lexicons pruned to spelling-decisive entries** (cd58843), in
`service/src/transcription/tagging.ts`, with the rule stated in a comment at
the head of the lexicon so it is not re-added piecemeal.

Removed as instructed: `cocktail`, `enzymes`, `minutes`, `injections`,
`salon` — each spelled identically in French and English. `profhilo` — a brand
name is not a language claim.

Removed by applying the same rule across both lists:

- `mains` (French) — "mains" is an ordinary English word (electrical mains).
- `marque` (French) — "marque" is an ordinary English word (a car marque).
- `face` (English) — "face" is an ordinary French word (la face).
- `ou` (French) — a standalone `ou` is a **scored §2 violation** (the guide
  writes the conjunction `w`), so claiming it as French would mask the very
  corruption the conformance scorer exists to catch.

Removed as redundant, no behaviour change: the nine accented entries
`dernière`, `génération`, `brésilien`, `mésothérapie`, `polynucléotides`,
`pigmentées`, `réticulé`, `décolleté`, `caféine`. `ACCENTED_RE` already
returned `fr` for every one; a word listed twice invites the two to drift.

Six tests added. **Re-deriving over all five live Edit Plans afterwards
produced zero disagreements**, so nothing that was working stopped working.

**4. Freeze-record correction** (21fdc96), in
`docs/DECISION-transcription-config.md`. The removed sentence, verbatim, is
quoted in the commit body. Replaced with what the tables show — hybrid beats
gemini on three of four reels and loses ground-truth by 1.2 points — plus one
line recording that the claim was inaccurate as written and when it was found.
Nothing else in the doc was softened and the freeze is not restated.

**5. Cache-hit cost bookkeeping** (01f8f6d), in
`service/src/transcription/job.ts`. `costs.byStage.transcription` is now set to
0 on a hit instead of the key being dropped. Test added asserting both the
value and that both runs carry the same `byStage` keys; the byte-identity test
now normalises the *value* rather than blanking the whole object, so a dropped
key would fail it.

**6. Client mode schema, loader and K2 stub** (5c97e6d).

- `core/src/mode.ts` — schema documented in the module's own doc comment,
  plus `validateMode`, `parseMode`, `loadMode`, `renderStylePrompt`,
  `renderNegativePrompt`, `requireFonts`, `ModeValidationError`,
  `ModeFontsUnresolvedError`. Exported from `core/src/index.ts`.
- `modes/k2-syndicalia.json` — version 1, validates. The four locked colours
  with roles read off the values (`#1A0000` background, `#820000` primary,
  `#C9A96E` accent, `#F8F6F2` light).
- **Fonts are `{ status: "tbd", note }`.** No font name was invented.
  `requireFonts(mode, stage)` throws `ModeFontsUnresolvedError` naming the
  stage rather than substituting a default.
- **`imageStyle` encodes the three settled rules.** (a) "a single clear idea,
  readable at a glance"; (b) the negative prompt suppresses extraneous
  objects, background clutter and incidental detail; (c) the palette is
  referenced as `{{palette.<role>}}` and resolved by `renderStylePrompt` at
  compose time — **a fragment naming a colour literally is a validation
  failure**, so no colour can reach a prompt from code.
  `GLOBAL_NEGATIVE_PROMPTS` (no text, no watermark, no logo, ARCHITECTURE
  §5.3) lives in code and is merged by `renderNegativePrompt`.
- **`imageVariation` is absent, with no field and no default**, as instructed.
  A test pins that validation does not require it.
- `allowedTemplates` holds stub ids matching TEMPLATE_LIBRARY_GUIDE §3
  (`sub_pop`, `kw_slam`, `img_slide_left`, `img_float`).
- `vocabulary` is `[]`; the file's `note` field records why and that K2's real
  terms arrive at Block 9.
- `core/src/validate-modes-cli.ts` + `npm run validate:modes`, wired into
  `scripts/check.sh`. Verified end to end with a deliberately broken probe
  mode: it printed three precise dotted-path errors and exited non-zero, and
  the probe was deleted.
- `core/src/mode.test.ts` — 22 tests, including a deliberately broken mode
  that must report all seven of its problems at once in order.

**7. `CLAUDE.md` updated** for the mode machinery, the new command, the
reference versions and the apostrophe finding, the pruned lexicons, the
cache-hit fix, the insertion analysis and the spotcheck pages.

## Deviations

- **`benchmarks/src/spotcheck.ts` was modified**, which "reuse it, do not
  rebuild" could be read as forbidding. The existing tool samples 15 words
  evenly, has no context column, cues 0.3 s ahead and offers hit/miss — none
  of which fits an insertion review. I extended it with four optional
  parameters rather than writing a second generator, so there is still one
  spotcheck page implementation. All its existing tests pass unmodified.
- **Goal 1's numbers were regenerated during goal 2** and its results file
  edited after its own commit. The reference sweep changed what the analysis
  scores against, and leaving the committed file describing the old reference
  would have been wrong. Only the test-3 substitution/match counts moved
  (10 → 9); the inserted and deleted token sets are identical, so the
  spotcheck pages did not need regenerating.
- **`la` was kept in the French lexicon** despite English having a word "la"
  (the solfège syllable). I drew the spelling-decisive line at words in
  ordinary use in both languages. It occurs 7 times across the five plans and
  the model tagged it `fr` every time. The genuine risk is Darija `la` (no),
  not English — flagged below rather than acted on.
- **Nine accented entries were removed under a second justification**
  (redundancy with `ACCENTED_RE`) rather than the spelling-decisive rule,
  which they pass. Behaviour is unchanged; they are listed separately above so
  the two reasons are not conflated.
- **`docs/DECISION-transcription-config.md` was edited in goal 2 as well as
  goal 4**, because its evidence table quotes the aggregate row that the
  re-score moved.
- **The mode module went in `core/`, not `service/`.** Modes are config that
  more than one workspace will read, and `core` already owns config loading,
  paths and pricing.
- **A `note` field was added to the mode schema** to carry the vocabulary
  comment, since JSON has no comments. It follows the existing `note` key in
  `benchmarks/footage.json` rather than inventing a new convention.

## Failures & open problems

- **The listening pass has not been done.** Every row on all four spotcheck
  pages is unjudged. Until someone listens, nothing says whether the pipeline
  invents words, and the production-vs-run-C WER gap stays unexplained. This
  is the session's main output and it is incomplete by design — it needs the
  user's ears.
- **The conformance scorer cannot see apostrophe shape.** A violation that was
  costing measurable WER sat in three references through every previous sweep
  because no rule covers it. Not added this session; the scorer's rule set was
  out of scope. Anything else §-stated but unscored is equally invisible.
- **The `w` conjunction question is open and load-bearing.** The references
  write it attached (`Wmabin`, `w7essa`, `Wl'effet`); §2's attachment rule is
  stated for the definite article only, so there is no rule to conform to. It
  is the single most-inserted token in the production transcripts (8 of 15).
  A **user decision**: settling it touches every reference and every prompt.
- **`dial lvidéo` is still open**, untouched as instructed. The insertion
  analysis now shows the model writing `la` as a separate word at test-1
  3.74 s, which is evidence for the decision but not a decision.
- **Darija collisions in the lexicon are unaddressed.** The stated rule was
  French-versus-English identity. `la` (French article / Darija "no") and
  arguably `non` collide with Darija instead, and the rule as given does not
  reach them. Not guessed at — a user decision if unscripted footage ever
  makes it matter.
- **`renderStylePrompt`, `renderNegativePrompt` and `requireFonts` have no
  caller.** They are unit-tested and unused; the stages that would consume
  them do not exist. The K2 image style itself is a placeholder encoding only
  the three settled rules — it is not a visual identity and should not be
  treated as one.
- **`readEditPlan` is still called by nothing outside its own tests** and last
  session's ad-hoc exercise. Unchanged this session.
- **`cleaning.ts` remains untested against real disfluent input**, unchanged
  from last session: no reel has any disfluencies to clean.
- The mode schema has **no `schemaVersion` field on the file itself** —
  `MODE_SCHEMA_VERSION` is a code constant and `version` in the file is the
  client's content version. If the schema ever changes shape, there is no
  gate equivalent to `EditPlanVersionError`. Noted, not built.

## Repo state

- Branch: `main`. **Pushed** — `73a922d..8877184` at the start, and the six
  session commits pushed at the end; `git status -sb` reads
  `## main...origin/main`.
- HEAD: `5c97e6d` `feat: add the client mode schema, loader and k2 stub`,
  plus the CLAUDE.md and report commit that follows it.
- Session commits: e1a39ac, ef18c23, cd58843, 21fdc96, 01f8f6d, 5c97e6d.
- `npm run check`: **PASS**, exit 0, `check: PASS` marker present, and it now
  validates `modes/` as its last step. **363 tests** — core 45, service 173,
  benchmarks 145 (up from 330: 22 mode, 7 insertions, 6 lexicon, 1 cache-hit,
  2 restructured).
- **Session spend: $0.00.** Zero API calls, zero ledger lines. `.local/costs.jsonl`
  holds 55 entries before and after, unchanged.
- Ledger all-time: **$5.445002**, unchanged from the end of session 1.

## Suggested next step

The spotcheck pages are the thing to do next and they cost nothing but
attention: fifteen tokens across four reels, each cued to a second before it
is spoken, and the answer decides something Block 3 cannot proceed honestly
without. If most are recoveries, the production transcript is *better* than the
reference and the WER regression is largely an artifact of references that
omit words — which would make the references, not the pipeline, the thing to
fix, and would put the `w` conjunction question directly on the table since
`w` is eight of the fifteen. If a meaningful share are hallucinations, that is
a correctness problem in the correction pass that has to be understood before
keyword selection and image prompting are built on top of its output. Either
answer is cheap to act on; not having it means the next block builds on a
transcript quality nobody has characterised.
