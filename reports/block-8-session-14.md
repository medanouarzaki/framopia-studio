Status: OK

Block 8 part 2, session 14. **$0.00 spent, no API was called, After Effects was
not driven.**

**The most important thing in this session: the dry run was misstating cost, and
it is the one feature built to keep part 2 affordable.** It never consulted the
cache. It is fixed, and what it now reports is below.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `f1445d0` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`correction.ts` was not touched, the prompt version stays frozen at 4, both
hand-made reference files are untouched, and `templates/library.aep` is
unchanged.

## Done

### Goal 1 — the contradiction, resolved: the dry run was wrong

**Both statements were true of different code, and neither was true of the dry
run.**

- **The runner** (`transcribeHybridCached`) resolved by **computed
  fingerprint** — `transcriptionCacheRef` → `cacheEntryDir`, no fallback. Every
  reel was a miss.
- **The diagnostics** resolved by **`selectTranscriptionEntry`**, the pinned
  prompt version. Every reel hit `transcription-758a3924d090d1b5`, correctly for
  their purpose.
- **The dry run used neither.** It read `plan.pipeline[stage].status` and, for
  any stage the plan recorded as `done`, printed *"already on the plan; a re-run
  reads the cache and bills nothing"*. That sentence was **generated from the
  plan's memory of a past run, never from the cache**, so it could not have been
  right except by coincidence.

**Yes — the dry run misstated what a run would cost.** On `vitasilk` it printed
**"nothing to pay"** while a real run would have re-transcribed (~$0.17) and
re-run keyword analysis (~$0.18), because that reel's keyword entry sits at
analysis prompt version 3 against an active 4. The panel rendered the same
falsehood: `stage.status === 'done' ? 'cached'`.

**What a real run would have done, before the fix** — transcription: **miss and
bill on all five reels**. Keywords: hit only on `test-2`; miss on the other
four. Image slots: hit on `test-1` and `vitasilk`, never run elsewhere. Images:
`vitasilk` 10 of 10 cached, `test-1` 0 of 8.

### Goal 2 — one resolver, with visible provenance

`core/src/entry-resolve.ts` holds the rule; `service/src/transcription/resolve-entry.ts`
is the one caller-facing entry point, used by the runner, the dry run and the
diagnostics. It returns the entry **and how it was found**.

`compatible` is deliberately narrow: **a guide-version difference at an
identical prompt version, and nothing else.** An entry's guide version is
**recovered, not assumed** — its fingerprint is reproduced against each version
in `GUIDE_VERSION_HISTORY` and it must match the directory name, so an entry
that differs in anything else cannot masquerade as compatible.

**The provenance reaches the artifact.** `PipelineStage` gains `cacheEntryId`
and `cacheProvenance`, **optional with a default**, validated only when present;
every existing plan opens unchanged. Guidelines §3: a tool names the inputs it
selected, in its output artifact.

**The analysis stages resolve `exact` or `none`, never `compatible`, and the
reason is in the code.** Their fingerprint carries no guide version at all, so
the only way an analysis entry can differ is the prompt version, the mode
content the call reads, the transcript, or the candidate count — each of which
changes the question the model was asked. Analysis prompt v4 asks for §6 term
boundaries that v3 was never asked for, so serving a v3 answer would be
presenting an answer to a different question as a cheaper version of the right
one. **`test-1` and `vitasilk` therefore report `none` and the dry run says a
run would bill.**

**What the fixed dry run reports**, resolved against the cache on disk:

| reel | transcription | analysis | images | estimate |
|---|---|---|---|---:|
| ground-truth | **compatible** | none | not planned | $0.18 |
| test-1 | **compatible** | none | **none**, 0 of 8 cached | **$1.73** |
| test-2 | **compatible** | none (slots miss, keywords hit) | not planned | $0.18 |
| test-3 | **compatible** | none | not planned | $0.18 |
| vitasilk | **compatible** | none | **exact**, 10 of 10 | $0.18 |

Corpus **$2.45**. Every transcription row is `compatible` — the pin working:
reused, labelled, and not re-transcribed.

**A fingerprint matching nothing is said out loud before anything is spent.**
The runner logs the resolution note before it can reach `runHybrid`, and a test
asserts that ordering by position in the file rather than by reading it. The
panel now renders `provenance`, never `status`, and shows *"cached, older
guide"* with a line saying it will not re-transcribe and will not bill.

**Pinned by tests**: 11 in `core/src/entry-resolve.test.ts` (exact, compatible,
newest-compatible-wins, a different prompt version, a newer guide, nothing on
disk, an unrecoverable entry, version ordering) and 10 in
`service/src/transcription/resolve-entry.test.ts`, including four that pin the
shared rule itself — that the runner and the dry run both call it, that no
caller selects a transcription entry by prompt version alone, and that the note
is logged before anything runs.

**`GUIDE_VERSION_HISTORY` is pinned to the guide**: a test reads
`docs/ORTHOGRAPHY_GUIDE.md` and fails if it names a version the list omits. A
missing version would resolve `none` and send a caller to the API.

### Goal 3 — the migration, run on all five plans

`npm run migrate:alignment [-- --apply]`. **$0.00, no API call.** It imports
`alignCorrectedOntoDraft` rather than reimplementing it, so a migrated plan and
one written by a fresh run carry identical timings.

| reel | words | retimed | `sourceText` changed | cards moved | schema valid after |
|---|---:|---:|---:|---:|---|
| ground-truth | 76 | 15 | 15 | 19 | **yes** |
| test-1 | 67 | 17 | 16 | 20 | **yes** |
| test-2 | 69 | 14 | 14 | 15 | **yes** |
| test-3 | 58 | 4 | 4 | 5 | **yes** |
| vitasilk | 73 | 17 | 17 | 19 | **yes** |
| **corpus** | **343** | **67** | **66** | **78** | |

Validity is proven rather than asserted: `writeEditPlan` validates before
writing and each plan was **reopened through `readEditPlan`** afterwards, with
the reread counts printed.

**67 retimed words independently reproduces session 13's 67 moved anchors**,
derived here from the plans instead of from the aligner.

**Everything timing-derived is recomputed in the same pass**, verified against
the code rather than trusted: word `start`/`end`/`sourceText`/`confidence`;
subtitle card spans; display timing and holds via `applyDisplayTiming`; keyword
spans; image-slot spans; SFX event times via `deriveSfxEvents`; and
`transcript.contentHash`. Grouping did not need re-running and could not have
changed identity: `MAX_WORDS_PER_CARD` is 1, so the timing-aware pairing branch
is unreachable and card membership is fixed by the word list. Short-card
entrance stretching is computed at build time and stored nowhere.

**Placement was checked, not assumed.** Zone validity windows come from video
frames and reference no word, so nothing there is timing-derived; the slot spans
that index into them do move. All five `vitasilk` slots sit inside their
assigned zone's validity window **before and after** — 5 inside, 0 outside in
both.

**Nothing text-derived moved, and the migration refuses to write if it does.**
`hashTranscript` is compared before and after and a change stops that reel. It
did not fire.

**Exactly what changed on `vitasilk`**, diffed field by field against a
pre-migration copy: top-level `meta`, `transcript`, `subtitles`, `images`,
`sfx`. Word fields: `start`, `end`, `sourceText`, `confidence` **and nothing
else** — `text`, `id`, `lang`, `script`, `removed`, `removedReason`, `edited`
all byte-identical. Group fields: `start`, `end`, `displayStart`, `displayEnd`.
Keyword fields: **none**. Slot fields: `start` only. **`zones`, `costs` and
`pipeline` byte-identical.**

**`vitasilk`'s images block is intact: all ten candidate pointers present**, and
their ids, paths, costs and gate verdicts diff clean against the pre-migration
copy. `costs.spentUsd` is still $1.550444 and `chosenCandidateId` is still null
on all five slots.

**Clipped holds fell 28 → 23** (ground-truth 9→8, test-1 7→5, test-2 4→3,
test-3 3→2, vitasilk 5→5): pairings that now sit on their own token give cards
that fit their template floor.

#### `vitasilk` 8.8–11.9 s, word by word

| word | text | before | after |
|---|---|---|---|
| w0027 | `Silk` | `Silk` 8.619–8.860 | `Silk` 8.619–8.860 |
| w0028 | `mn` | **`mn` 8.899–8.899 (interpolated)** | **`من` 8.939–9.000** |
| w0029 | `ghir` | `من` 8.939–9.000 | **`غير` 9.079–9.199** |
| w0030 | `anno` | `غير` 9.079–9.199 | **`أنه` 9.279–9.759** |
| w0031 | `il` | `أنه` 9.279–9.759 | `ينغى,` 9.779–9.800 |
| w0032 | `nourrit` | `ينغى,` 9.779–9.800 | `يهدئ.` 9.819–11.079 |
| w0033 | `il` | `يهدئ.` 9.819–11.079 | `فيه` 11.159–11.279 |
| w0034 | `hydrate` | `فيه` 11.159–11.279 | `ستة` 11.479–11.579 |
| w0035 | `fih` | `ستة` 11.479–11.579 | `وعشرين` 11.619–12.039 |
| w0036 | `26` | `وعشرين` 11.619–12.039 | **none, interpolated at 12.059** |

**The head of the run is repaired**: `mn`, `ghir` and `anno` each hold the token
they translate, and `mn` gained a real anchor where it had been a zero-duration
interpolated point. **The tail is displaced, not repaired** — `il nourrit` and
`il hydrate` are two words each against one draft token and `26` is one word
against two, shapes no substitution cost can express, so the one-token shift is
pushed down the run to `w0036`, which loses its anchor. That is the regression
already recorded in §A.0.1 and the limit recorded in §A.5, not a new defect.

### Goal 4 — recorded as a decision

- **`docs/DECISION-transcription-config.md`** — an amendment dated 2026-08-28:
  the corpus pinned at guide v1.0.7 for the remainder of Block 8; the three
  reasons (non-reproducible correction calls, both hand-made references
  invalidated and unregenerable, ~$3.57 against ≈$8.04 that must also cover
  `test-1`'s images and Block 10's two-machine golden runs); what v1.0.7 does
  not carry; the compatible-reuse policy; why analysis gets no compatible reuse;
  and the deferral to Block 10.
- **`docs/DEFECT-alignment-script-mismatch.md`** — new §A.0.3 with the migration
  table and the `vitasilk` span before and after.
- **`CLAUDE.md`** — the session-13 staleness convention rewritten as the pin and
  the reuse policy, the `migrate:alignment` command, and a session section.

## Deviations

- **The panel was changed**, which the goals did not name. Goal 2 requires the
  dry run to report provenance per stage, and the panel is where a user reads
  it; it was rendering `status === 'done' ? 'cached'`, the same falsehood in the
  UI. Leaving it would have fixed the service and left the lie on screen.
- **One test was rewritten rather than added.** `App.test.tsx`'s dry-run test
  asserted the retired behaviour — a fixture with no `provenance`, expecting
  "cached" from `status`. Guidelines §3 requires retiring it in the same change;
  it now asserts the new contract, and a second test asserts the specific
  defect cannot return.
- **A regression I introduced was caught by an existing test and fixed.**
  Routing the read through the resolver made a **corrupt manifest** resolve as
  `none` — reporting a damaged entry as an absent one and sending the caller to
  the API with no explanation. The runner now still reads the exact fingerprint
  directory when it exists, so a corrupt entry is a miss **with its own
  warning**, as it was before. Pinned by a test.

## Failures & open problems

- **Nothing was lost or destroyed.** The migration changed only the fields named
  above; a field-by-field diff against a pre-migration copy is in Goal 3. No
  cache entry, ledger line, reference, template or image file was touched. The
  ledger is byte-identical.
- **The migration's two guards never fired on real data.** The word-count
  refusal and the `hashTranscript` refusal are the safety properties that make
  it safe to run, and both are unexercised outside the code path itself. They
  have no unit test — the migration is a CLI script and testing them needs the
  logic extracted first.
- **A run that transcribes can still evict the entry the corpus is pinned to.**
  `MAX_ENTRIES_PER_VIDEO` is 3 and `vitasilk` already holds three transcription
  entries, so a fresh transcription would evict least-recently-written — which
  could be `transcription-758a3924d090d1b5`, the entry both hand-made references
  describe. Compatible reuse means no write happens today, so nothing is at risk
  now. **No guard was added.**
- **`test-1` reports $1.73 to run** — 0 of 8 image candidates cached. That is
  the ~$1.21 approved in principle in part 1, now measured against the current
  config, and it is the largest single spend left in the block.
- **Four reels moved 50 rows nobody has judged.** Only `vitasilk` has a
  reference. The migration puts the adopted pairings into four artifacts whose
  correctness rests on the corpus guard that §A.0.2 showed to be nearly
  insensitive.
- **The staged panel flow is still not built.** Session 13 stopped before it and
  this session did not reach it; it remains part 2's main deliverable.
- Carried forward: headless AE is not met; `vitasilk` is the only reel ever
  built; the CJK `五` is classified Latin; 13 multi-word Arabic §6 terms split
  across cards; splits and merges need an aligner operation that does not exist.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`95de16c` `docs: record the guide pin, the
  reuse policy and the migration`**, preceded by `feat: migrate plans onto the
  adopted alignment` and `feat: resolve cache entries once, with visible
  provenance`, on session 13's `f1445d0`. **This report's own commit follows
  it.** Goals 2 and 3 are in separate commits as required.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — `@framopia/core` **353** (21
  files), `framopia-service` **775** (56 files), `framopia-benchmarks` **166**
  (16 files), `framopia-panel` **67** passed + 2 skipped (3 files), **1361 TS
  total** against session 13's 1339; pytest **141**, unchanged.
- The five Edit Plans are gitignored, so the migration's output is on disk and
  not in the commit; the commit carries the migration that reproduces it.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Build the staged panel flow, which is now unblocked: the money question is
settled, the dry run tells the truth, and the plans carry the timings the
transcript step will display. Do it in the order session 13's brief set out —
the persistent rail, step state derived from the plan's `pipeline` bookkeeping
rather than panel-local state, step 1 moved in intact, steps 2 to 5 as honest
empty states showing the real counts. One thing to carry into it: the plan now
records `cacheProvenance` per stage, so the rail can show a reel as transcribed
**and** say the transcription came from an older guide, which is exactly the
kind of fact a wizard holding its own progress would lose. Before the first
image spend on `test-1`, re-read the dry run rather than part 1's ~$1.21 — it
now reports $1.73 against the current config.

## What the user does next

**Nothing is needed from you.** Your After Effects and the panel in it are
untouched; the panel changes are built but you have not been asked to reload.

**The important finding, plainly.** The "what will this cost" screen was wrong.
It was reading the plan's memory of a past run instead of looking at what is
actually cached, so it told you `vitasilk` would cost nothing when a run would
have re-transcribed it and re-run the keyword analysis. It now looks at the
cache for every stage and reports what a run would really do. For the corpus
that is **$2.45**, and almost all of it — **$1.73** — is `test-1`, which has
image slots planned but no images generated.

**Your ruling is implemented.** The reels stay on the older orthography guide,
and every place a reuse happens now says so rather than hiding it: the log
before anything runs, the cost screen per stage, and the plan file itself.
Nothing re-transcribes, so your two reference files stay valid.

**The timing fix is finally in the artifacts.** Session 12 changed the code;
until today the plans still carried the old timings. All five are migrated, free
— **67 words retimed**. In the span you flagged twice, `mn`, `ghir` and `anno`
now each sit on the Arabic word they actually translate, and `mn` has a real
duration instead of a zero-length point.

**One part of that span is still wrong and I want you to know before you look.**
`il nourrit` and `il hydrate` are each two French words that Scribe heard as one
Arabic word, and `26` is one word Scribe heard as two. The aligner has no way to
say "two words, one token" or "one word, two tokens", so the error is pushed to
the end of the run and `26` ends up with no timing of its own. That needs a new
capability, not a better setting, and it is not something this session could
have done.
