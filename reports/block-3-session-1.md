Status: OK

Block 3 session 1. Committed the Block 2 handoff, corrected and re-scored the
last two non-conformant reference transcripts, fixed `deriveLang`'s only real
misfire, and ran the four Block 1 reels through the production CLI for the
first time.

## Done

**1. Block 2 handoff committed.** `handoffs/block-2.md` verified to begin
`# Handoff — Block 2` and committed alone as `docs: add block 2 handoff`
(2b989b5).

**2. test-1 and test-2 references corrected and everything re-scored**
(85d4605, `fix: correct dl/dla in the test-1 and test-2 references and
re-score`).

- `.local/ground-truth/test-1.txt`: `dla vidéo` → `dial lvidéo`,
  `joj dl 7essass` → `joj dial l7essass`.
- `.local/ground-truth/test-2.txt`: `joj dl 7essass` → `joj dial l7essass`.
- Both headers bumped `v1.0-unrevised` → `v1.0.1-conformant`, following the
  wording the ground-truth reference already uses. Noun spellings untouched;
  replacements applied to body lines only.
- Grep for remaining standalone `dl`/`dla` and other attached-`dial` forms
  across all four references: **none found.** The only remaining `dial`-family
  tokens are the pronoun-suffixed forms §4 explicitly attaches — `dialha`,
  `dialk`, `dialna`, `dialo` — which are correct as written.
- `npm run bench:tag` re-run; `GroundTruth.version` now reads
  `v1.0.1-conformant` for all four references. Word counts unchanged (67 and
  70), confirming the corrections are token-for-token — only the four expected
  token texts moved in the JSON diffs.
- `npm run bench:aggregate` re-scored `benchmarks/RESULTS-block1.md` from
  recorded engine outputs. **Zero API calls**: `aggregate.ts` imports no engine
  client and only reads from disk.
- `benchmarks/src/aggregate.ts` gained a reference-version notice at the head
  of the generated report, so the supersession travels with the numbers.
- `benchmarks/RESULTS-block1-runA.md` and `-runB.md` got a `> **Superseded
  figures.**` block matching the convention already used in
  `RESULTS-block2-noisefloor.md`.
- `docs/DECISION-transcription-config.md`'s run-C evidence table re-scored
  (hybrid 24.8/26.1/6.5 → 21.9/21.3/8.7, gemini 26.6/27.7/8.7 →
  24.5/23.9/10.9) with a note naming the superseded figures. Scribe and
  Whisper are unchanged. The freeze ranking is unchanged.

**3. `deriveLang` French lexicon fixed** (3967dc5, `fix: remove filler from
the french lexicon in deriveLang`), in
`service/src/transcription/tagging.ts`.

- `filler` removed. It now derives to **null** rather than being reasserted as
  English — the derivation goes silent instead of trading one claim for
  another.
- `glow` also removed from `FRENCH_LEXICON`. It was on both lists and only
  came out English because the English check ran first; the same class of
  error, and unambiguous since the file already declared it English. Behaviour
  is unchanged by that half.
- Test added pinning the exact phrase: `le` → `fr`, `filler` → `null`,
  `glow` → `en`.

**4. Four Block 1 reels through the production CLI** (67c5ff6, `test: run the
four block 1 reels through the production pipeline`). Full numbers in
`benchmarks/RESULTS-block3-generalisation.md`. Headlines:

- All four ran, all four plans validated, four cache misses as expected.
  $0.624776 actual against a $0.8792 estimate.
- **Zero removed words on all four reels.** Not a stage failure: the Scribe
  drafts contain no fillers and no immediate repeats at all (343 draft words
  across five reels). The footage is scripted, so `cleaning.ts` is untested
  against real input.
- Every one of 148 groups is 1 or 2 words; every word lands in exactly one
  group.
- 291 of 291 words tagged, no nulls, no out-of-enum values. **`mixed` still
  never produced.** `msa` count equals the Arabic-script count on every reel.
- **`langDisagreement` fired zero times.**
- Cache hit on a test-1 re-run: $0.0000, 4.1s against 89.3s, no new ledger
  line, plan differing in exactly seven bookkeeping leaves.
- `readEditPlan` read all four real plans successfully, and its schema-version
  gate threw `EditPlanVersionError` outside tests for the first time.
- Scoring adapter fit: `benchmarks/src/score-editplan.ts`, 39 lines, no
  service-package dependency, with unit tests.

**5. `CLAUDE.md` updated** for the reference versions, the `deriveLang` fix,
the cleaning-never-fires finding, the new results file and adapter, and the
session's ledger position.

## Deviations

- **Two files edited beyond the letter of goal 2.** `benchmarks/src/aggregate.ts`
  and `docs/DECISION-transcription-config.md`. The first because regenerating
  `RESULTS-block1.md` silently deleted a hand-appended "Ledger note" section
  that `CLAUDE.md` points at as authoritative; it is now inside the template so
  regeneration cannot drop it again. The second because it quotes the run-C
  aggregate row as Block 1 freeze evidence, and leaving it at the superseded
  numbers would have left a doc describing a state the repo is not in.
- **`glow` removed from the French lexicon alongside `filler`**, which goal 3
  did not name. Judged unambiguous rather than borderline: the file's own
  comment already asserted it is English.
- **The ground-truth reel's WER also moved** in the re-score, by more than
  test-1's and test-2's did. `RESULTS-block1.md` on disk had never been
  regenerated after Block 2 session 6 corrected that reference, so it was
  carrying stale numbers independently of this session's change. Both
  corrections are now reflected.

## Failures & open problems

- **Production WER is worse than run C on all four reels** — +3.8, +7.4, +5.7,
  +1.7 points, three of them past the 3.7-point floor. Reported as measured,
  not explained away. It is not yet a finding about prompt or guide quality:
  n=1 per reel, the floor was only ever measured on the ground-truth reel, and
  guide version and prompt version varied together (v1.0.3/v1 → v1.0.6/v3).
  Settling it needs a repeated run on at least two reels, which is billable.
- **The correction pass adds tokens on every reel** (+7, +3, +6, +5), and the
  hypothesis is longer than the reference on three of four. Insertions count
  against WER directly. Whether those are words the reference omits or
  hallucinations is a spotcheck question and **no spotcheck was done**.
- **`dial lvidéo` may be the wrong correction.** §2 attaches the definite
  article; §5 says a French word keeps its own spelling, which would give
  `dial la vidéo`. Applied as instructed and following the `dial lvitaminat`
  precedent, but the guide does not settle it, and the token cost test-1 its
  entire fr/en score (0.0% → 33.3%). A user decision.
- **`cleaning.ts` has never run against real disfluent input** and will not
  until unscripted footage exists. Unit tests are its only evidence.
- **`costs.byStage.transcription` disappears on a cache hit** rather than
  being set to 0, so a consumer diffing `byStage` keys sees a key come and go.
  Not fixed.
- **Borderline French-lexicon entries left unchanged** in
  `service/src/transcription/tagging.ts`, listed for a user decision, not
  guessed at:
  - `cocktail` — English origin, fully naturalised in French, identical
    spelling. Unresolvable from spelling alone.
  - `enzymes`, `minutes`, `injections` — identical in French and English. In
    these reels they follow French articles (`des injections`), so `fr` is
    probably right, but the lexicon has no context to check that.
  - `profhilo` — a brand name, not a French word. §5 says brand names are
    written as the client writes them, so tagging it `fr` is a claim about
    language the guide does not make.
  - `salon` — French in origin and in Moroccan French speech; kept, but it is
    also an English word.
- **Two pre-existing issues found but not touched**, both outside this
  session's scope:
  - The references use curly apostrophes (`l’effet`) where guide §4 says
    apostrophes are always straight.
  - `docs/DECISION-transcription-config.md` says "Hybrid wins every reel in
    run C", but gemini beat hybrid on the ground-truth reel both before and
    after the re-score (21.0 vs 22.2, now 14.8 vs 16.0). The claim was already
    inaccurate; the re-score did not create it and I did not rewrite prose in
    the frozen decision doc.

## Repo state

- Branch: `main`, not pushed.
- HEAD: 67c5ff6 `test: run the four block 1 reels through the production
  pipeline` (plus an uncommitted `CLAUDE.md` and these reports at the time of
  writing).
- `npm run check`: **PASS**, exit 0, `check: PASS` marker present.
  **330 tests** — core 23, service 169, benchmarks 138 (up from 327: one
  `deriveLang` test, two `planWords` tests).
- Session spend: **$0.624776**, eight ledger lines, two per reel. Both gates
  held — reel 1 at $0.1477 against a $0.35 stop, peak cumulative $0.6248
  against a $1.20 stop.
- Ledger all-time: **$5.445002** across 55 entries, up from $4.820226 / 47.
- Edit plans for the four reels are beside the videos in the gitignored
  footage folder and are not committed.

## Suggested next step

The generalisation run did its job and turned up one thing worth settling
before Block 3 builds on top of transcription: production scores 1.7–7.4 WER
points worse than run C on every reel, and nobody can currently say whether
that is guide v1.0.6, prompt version 3, or noise, because all three are live
at once and every figure is n=1. The cheapest way to separate them is to
re-run two reels — test-1, the worst mover, and ground-truth, the only reel
whose floor is known — three times each under the current config, which
establishes a per-reel floor for about $0.9 and would either absorb the
regression or make it real. That should be paired with a by-ear spotcheck of
the inserted tokens, since insertions drive the delta and WER cannot tell a
recovered word from a hallucinated one. Both are cheap relative to discovering
later that keyword and image selection were built on a transcript quality
nobody had characterised.
