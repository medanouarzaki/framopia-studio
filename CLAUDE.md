# CLAUDE.md

The repo lives on the external SSD at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`; the drive has to be
mounted before anything works. Test footage sits inside it under
`my files/test videos/` and is gitignored — never commit video or audio.

Operating memory for Claude Code sessions on this repo. Keep this file in
sync with what actually exists — update it at the end of every session.

## What this is

Framopia Studio: an internal After Effects automation tool for a
two-person Moroccan video agency. It turns a finished talking-head reel
into an AE composition with animated subtitles, emphasized keywords,
AI-generated contextual images, SFX, and a watermark. Full spec in
`docs/PROJECT_SPEC.md`.

## Repo map

- `docs/` — locked spec, architecture, orthography, template library guide
- `handoffs/` — session handoff documents
- `reports/` — per-session work reports
- `panel/` — After Effects CEP panel (not started)
- `core/` — `@framopia/core`, the shared workspace package: config loading,
  the cost ledger, pricing constants and the Gemini model pin
  (`core/src/model-config.json`), the token normalizer, the Levenshtein
  aligner, and `SCRIPT_RULES`. Anything both `service/` and `benchmarks/`
  need lives here; nothing is duplicated across the two any more.
- `service/` — Node/TypeScript companion service. `service/src/transcription/`
  holds the production hybrid module (see Status).
- `benchmarks/` — transcription benchmark harness (Scribe, Gemini, local
  Whisper baseline, Scribe+Gemini hybrid), scored on WER, orthography
  conformance, and cross-engine timestamp deviation. See `benchmarks/README.md`.
- `tools/cv/`, `tools/validate-templates/` — helper scripts (not started)
- `templates/` — AE templates (not started)
- `modes/` — per-client config. `k2-syndicalia.json` is a validated stub; the
  schema, loader and validation live in `core/src/mode.ts`
- `assets/brand/`, `assets/watermark/`, `assets/sfx/` — shared assets (not started)
- `.local/` — machine-local config, secrets, run state (gitignored, never committed)

## Commands

- The repo is an npm workspace (`core`, `service`, `benchmarks`). Install
  once at the root; there are no per-package lockfiles.
- `npm run check` (repo root) — `scripts/check.sh`: builds `@framopia/core`,
  then typecheck + lint + test across every workspace, then validates every
  file in `modes/`. This is the regression
  gate; it must pass before any commit that touches code. `core` builds to
  `core/dist/` and the other packages import the built output, so anything
  that runs workspace code builds core first.
  **Read its exit status, never its output.** Session 5 committed on a red
  check because the caller ran `npm run check | grep -E "Tests"` and grep
  matched an error line. The script pipes nothing and prints `check: PASS`
  only on success, so `grep -q "check: PASS"` is a correct test where
  grepping for test counts is not — a failing test still prints a "Tests"
  line.
- Start the service: `npm run build:core && npm run build --prefix service && npm run start --prefix service`.
  On start it writes `.local/service.json` with `{ port, token }`.
- Run the transcription benchmark: `npm run bench -- --audio <abs path>
  (--ground-truth <path.json> | --no-ground-truth)` (add `--dry-run` to
  exercise the harness against fixtures with no network calls, or `--yes` to
  skip the interactive cost confirmation). Paths resolve relative to
  `benchmarks/`, so pass absolute ones from the repo root. See
  `benchmarks/README.md` for the ground-truth format and full flag list.
  `--no-ground-truth` is the unscored mode: engines run, orthography
  conformance and spotchecks still happen, WER columns are dropped from the
  report rather than filled with zeros. Use it for any reel with no
  hand-written transcript.
  `benchmarks/whisper/setup.sh` installs the local Whisper baseline
  (Apple Silicon only, not run by `npm run check`).
- `npm run transcribe -- --video <abs path> [--out <path.editplan.json>]
  [--keyterms <path>] [--yes] [--no-cache]` — the production path end to end:
  hash the video, ffprobe its geometry, extract audio
  (`-vn -ac 1 -ar 16000 -c:a pcm_s16le`), the cached hybrid transcription,
  then tagging, cleaning and grouping, and a **validated Edit Plan** written
  to `<video-dir>/<video-name>.editplan.json`. Billable on a cache miss;
  prints an estimate and asks for confirmation unless `--yes`. It consults
  the cache **before** prompting, so a run that will cost nothing says so
  instead of asking for money. `--no-cache` forces fresh calls and still
  repopulates the entry. The same code runs behind the `transcribe` job type
  on the HTTP path, so the two cannot diverge.
- The conformance scorer separates **violations** from **warnings**. Scored
  violations: digit substitutions, `sh`-for-`ch`, freeze-list near-misses, a
  standalone `ou` (§2 writes the conjunction `w`), and `dial` fused to the
  word it governs (§4 since v1.0.5). Warnings, reported in their own section
  and never in the percentage: vowel-less tokens — the check cannot tell a
  correct dropped schwa (`jbt`, `ymkn`, `ch3rk`) from an unreadable cluster
  (`7l`, `l7l`) without modelling syllables, so it is a human-review signal.
- The Gemini cost **estimate** is deliberately pessimistic
  (`THINKING_TOKEN_MULTIPLIER = 15`) because it feeds a spend gate; observed
  thinking ratios run 5x–30.2x. Actuals always come from `usageMetadata` and
  are never estimated.
- `npm run bench:tag` — turn the hand-written `.local/ground-truth/*.txt`
  transcripts into tagged ground-truth JSON.
- `npm run validate:modes` — parse and validate every `modes/*.json`, printing
  a dotted path per problem. Part of `npm run check`; run it alone while
  editing a mode.
- `npm run bench:aggregate` — rescore every reel's latest run from disk (no
  API calls) into `benchmarks/RESULTS-block1.md`.

## Conventions (binding — see docs/CLAUDE_CODE_GUIDELINES.md)

- No AI attribution anywhere: no "Generated with Claude Code", no
  "Co-Authored-By: Claude", no AI-tool banners in commits, code, or docs.
- Conventional commits: `feat: …`, `fix: …`, `chore: …`, `docs: …`,
  `test: …`. Lowercase after the colon, imperative mood, subject ≤72 chars.
  Small, coherent commits.
- Comments only where a human would write one — explain non-obvious why,
  never what. No decorative banners, no emoji anywhere.
- Secrets (API keys, tokens) live only in `.local/`, which is gitignored.
  Never log secret values. `config.example.json` at repo root documents
  the shape of `.local/config.json` with placeholder values.

## Status

**Block 1 transcription is complete and the config is frozen.** The freeze
record — chosen config, run C numbers, why each alternative lost, and the
caveats it carries — is `docs/DECISION-transcription-config.md`, which is the
Block 1 definition-of-done evidence. `docs/PROJECT_SPEC.md` §7 points at it.

Frozen config: **hybrid** — Scribe v2 batch for word timings and a first
pass, then a Gemini `gemini-3.1-pro-preview` correction pass carrying
`docs/ORTHOGRAPHY_GUIDE.md` (**v1.0.6, frozen**) plus the per-word script
rules, realigned onto Scribe's timings by Levenshtein anchoring with linear
interpolation across inserted words.

Also done: repo scaffold, docs, the `service/` skeleton, the `benchmarks/`
harness, four scored reels in `benchmarks/footage.json` with audio in
`.local/bench-audio/`, hand-written ground truth for all four in
`.local/ground-truth/`, and three scoring passes recorded side by side —
`RESULTS-block1-runA.md` (v1.0.1), `-runB.md` (v1.0.2 rescore),
`RESULTS-block1.md` (**run C, v1.0.3, the run of record**).

`benchmarks/footage.json` holds a fifth reel, `vitasilk` (25.7 s, second
speaker, hair-product domain, one-off test footage rather than a client). It
has **no ground truth**, so it runs with `--no-ground-truth` and is
deliberately absent from `REELS` in `benchmarks/src/aggregate.ts`, which
scores WER. Its unscored run is `benchmarks/RESULTS-block2-robustness.md`.

Three facts that shape everything downstream:

- **Scribe returns Darija in Arabic script, not Arabizi.** Transliteration is
  the Gemini pass's job (`benchmarks/src/engines/script-rules.ts`).
- **Gemini bills thinking tokens at the output rate**, ~5x the visible
  output on these reels. `computeGeminiCost` counts them; any new Gemini
  caller must too, or it under-reports by that factor. Budget $0.35–0.55
  per 90s reel.
- **Gemini's self-reported timestamps drift** — 9/15 by ear against hybrid's
  14/15, worsening through a reel. This, not WER, is why the config is
  hybrid.

**Block 2 (transcription production pipeline) is complete.** Its
definition-of-done evidence is itemized in `reports/block-2-session-7.md`.
What it built:
the Block 1 handoff in `handoffs/block-1.md`; a ledger correction for the one
understated Gemini entry from Block 1 session 4 (see the ledger note at the
end of `benchmarks/RESULTS-block1.md` — the raw 19:50:06 line is known-low and
must never be quoted as an actual cost); the robustness run above; the npm
workspace and `@framopia/core`; three benchmark fixes (dry-run costs from the
real input duration, dry runs no longer touch the stable spotcheck mirror,
and an exact freeze-list hit is never reported as a near-miss of a
neighbour); and the production hybrid module.

`service/src/transcription/` — `scribe.ts` (Scribe v2 batch client),
`correction.ts` (the Gemini correction pass), `align.ts` (anchor alignment of
corrected text onto Scribe timings), `drift.ts`, `cost.ts`, `media.ts`,
`job.ts` (the `transcribe` job runner), `index.ts` (`transcribeHybrid`), plus
the post-processing stages `tagging.ts`, `cleaning.ts` and `grouping.ts`.
It has no fallback path: if the correction pass fails it throws a structured
`TranscriptionError`, because returning the Scribe draft would hand back
Arabic-script Darija labelled as a hybrid result.

`transcribeHybrid` requires the audio duration, because Scribe bills per
audio-hour and its response carries none. It returns a **cost breakdown**
(`scribeUsd`, `geminiUsd`, `totalUsd`) so no caller has to remember to add a
component, prints an estimate before the first billable call, and appends
**two** ledger lines — stages `transcribe-scribe` and
`transcribe-gemini-correction`. It also returns a **token-count drift**
record (draft count, corrected count, delta, fraction); past 15% — a starting
threshold chosen without evidence — it adds a `TranscriptionWarning`. A
high-drift correction is flagged, never dropped.

**Prompt versions.** `ACTIVE_PROMPT_VERSION` in `correction.ts` is the
prompt's identity and will feed the cache fingerprint (ARCHITECTURE §6).
**Version 3 is active** — version 1 plus a per-word `lang` in the response,
and nothing else. Activated in session 7 on the evidence in
`benchmarks/RESULTS-block2-langtagging.md`: under guide v1.0.6, three runs
tagged 81/81 words with no nulls and no out-of-enum values, agreed on
**every** tag (81/81, up from 75/81 under v1.0.5), and moved WER by 0.4 points
(mean 15.6% against version 1's 15.2%) against a 3.7-point floor. Recorded as
an amendment in `docs/DECISION-transcription-config.md`.

**Version 1** is the Block 1 frozen prompt, verbatim, and stays selectable: it
is what run C and every Block 1 figure were measured with. **Version 2**
(version 1 plus a `و` → `w` rule, keyterms moved ahead of the response shape)
stays selectable as the record of the session-3 experiment and is not used —
that comparison (`benchmarks/RESULTS-block2-promptv2.md`) was inconclusive,
having varied two things at once and run each arm once. The `ou` corruption is
caught by the conformance scorer instead of a prompt rule.

`mixed` has never been produced by any run — 365 tagged words across the five
live plans, still nothing. `en` first appeared on the live vitasilk plan (8 words),
where `langDisagreement` also fired for the first and so far only time — on
`filler` ×2, tagged `en` by the model and `fr` by `deriveLang`. **The model
was right and the cross-check was wrong**, so Block 3 session 1 removed
`filler` from `deriveLang`'s French lexicon (it now derives to null, asserting
nothing) and removed `glow`, which was on both lists and only came out English
because the English check ran first.

**The lexicons now carry only spelling-decisive words**, as of Block 3
session 2: an entry may only be a word whose spelling settles its language, so
anything spelled the same in French and English derives to null rather than
being claimed. Removed on that rule: `cocktail`, `enzymes`, `minutes`,
`injections`, `salon`, `mains`, `marque` (French list) and `face` (English
list); `profhilo` went because a brand name is not a language claim, and `ou`
because a standalone `ou` is a scored §2 violation more often than it is the
French "or". The nine accented entries went too — `ACCENTED_RE` already
answered them, and a word listed twice invites the two to drift. Re-deriving
over all five live plans afterwards produced **zero** disagreements, so
nothing that was working stopped working.

**`dial` is written separate since guide v1.0.5** (`dial l7loul`, never
`dl7loul`), because six of the twelve tokens that moved across identical calls
were this one word. `benchmarks/RESULTS-block2-dialrule.md` measured it: the
instability is gone (6/6 occurrences comply in all three runs, stability
69/81 → 79/81) and WER stayed inside the floor.

**All four references are versioned, and all four are now
`v1.0.6-conformant`.** Two corrections got them there. Block 3 session 1 fixed
`test-1` and `test-2` — `dla vidéo` → `dial lvidéo`, `joj dl 7essass` →
`joj dial l7essass`. Block 3 session 2 swept all four against the current guide
with the conformance scorer and straightened the three curly apostrophes §4
forbids (`Wl’effet` ×2, `l’acide`); the record is
`benchmarks/RESULTS-block3-references.md`. Word counts never moved (81 / 67 /
70 / 60), so every correction is token-for-token.

That apostrophe was costing real WER — normalization does not fold `’` onto
`'` and every engine writes the straight form, so the reference was scoring a
correct transcription as a substitution. Fixing it moved test-3's hybrid row
from 20.0% to 18.3% and the aggregate hybrid row from 21.9% to 21.6%.

Every result scored against superseded text carries a notice:
`RESULTS-block1.md` is regenerated from recorded engine outputs with **no API
calls**, runs A and B carry a supersession block, and
`docs/DECISION-transcription-config.md`, `RESULTS-block3-generalisation.md`
and `RESULTS-block3-insertions.md` all name the reference version they used.
The freeze ranking is unchanged throughout.

**The conformance scorer has no rule for apostrophe shape**, so it found none
of those; they were found by grep. Everything the scorer *did* flag on the
references — 11 items — is a freeze-list near-miss false positive
(`l7essass`, `dialo`, `hadi`, `homa` are all correct as written).

**Two open reference questions, both user decisions, both untouched.**
`dial lvidéo`: §2 attaches the definite article while §5 says a French word
keeps its own spelling (`la vidéo`). It follows the `dial lvitaminat`
precedent, but the guide does not settle it and no engine writes it that way —
test-1's fr/en WER went 0.0% → 33.3% on that one token, and the insertion
analysis shows the model writing `la` as a separate word at 3.74s.
**The `w` conjunction written attached** (`Wmabin`, `w7essa`, `Wl'effet`): §2's
attachment rule is stated for the definite article only, so there is no rule
to conform to. It matters because `w` is the single most-inserted token in the
production transcripts.

**The ground-truth reference was corrected to match the guide.** The hand-written
ground truth wrote `dl 7olol`, `dl 7essass`, `dl vitaminat` — the reduced form
§4 has listed as deliberately not frozen since v1.0.1 — so it had been
non-conformant since then and v1.0.5 only made it visible. Those three tokens
are now `dial l7olol`, `dial l7essass`, `dial lvitaminat`; noun spellings are
unchanged. `.local/ground-truth/ground-truth.txt` carries a
`# reference-version:` header, `npm run bench:tag` copies it into the JSON, and
`GroundTruth.version` exposes it, so a scored result can name what it scored
against.

**The noise floor is 3.7 WER points** against the corrected reference — 14.8%
to 18.5% across the three identical correction calls. It got *wider* than the
old 2.5-point figure because correcting the reference removed accidental
credit the outlier run was getting for a fused spelling. **The 2.5-point
figure is superseded** and every result scored against the old reference is
labelled as such in the results files. Any prompt comparison whose effect is
under 3.7 points is not measurable at n=1 on this reel.

**Post-processing** (all pure, no API): `tagging.ts` derives `script` from the
characters and leaves `lang` **null** when the correction pass does not report
it — which is every word under the active prompt, and deliberately not
defaulted to `darija`. `deriveLang` is a cross-check, never a source: a small
French/English wordlist plus accents and elided articles, silent on Arabizi.
Where it and the model disagree the word gets `langDisagreement: true` and
neither side is overwritten. `cleaning.ts` flags `euh`/`eh` fillers and immediate
stutters with `removed`/`removedReason` and never deletes; `ya3ni`/`za3ma` are
reported as unjudged rather than guessed, and non-repetition false starts are
not attempted. `grouping.ts` builds 1–2 word subtitle groups from `wordIds`,
pairing when the gap is ≤180 ms and the span ≤1.2 s, skipping removed words
but still counting their audio in the gap. Alignment carries Scribe's
per-slot confidence onto anchored words and leaves interpolated words at
`null`.

**Cleaning has never fired on real footage.** Zero `removed: true` words
across all five reels ever run, and zero would have: the Scribe drafts contain
no fillers and no immediate repeats at all (343 draft words, five reels). The
footage is scripted and delivered to camera, so `cleaning.ts` is untested
against real input and its unit tests are the only evidence it works.

**Edit Plan v1** lives in `service/src/editplan/` — `types.ts` (the whole
ARCHITECTURE §3 shape), `validate.ts` (structural validation returning issues
with dotted paths, plus `EditPlanVersionError` for an unknown
`schemaVersion`), `io.ts` (`createEditPlan`, `readEditPlan`, `writeEditPlan`,
and `<video-dir>/<video-name>.editplan.json`). The CLI now writes one:
`source` and `pipeline.transcription` are filled, the transcript is tagged,
cleaned and grouped, and the plan is validated before it hits disk. Keywords,
images, zones, sfx and build have types and empty containers only — the stages
that fill them do not exist. `meta.appVersion` is read from the root
package.json, not supplied by a caller.

**The cache** (ARCHITECTURE §6) is at `.local/cache/<video-sha256>/<stage>-<fingerprint>/`,
holding the extracted audio, the raw Scribe JSON and the Gemini correction
output. The transcription fingerprint covers `ACTIVE_PROMPT_VERSION`, the
Gemini model pin, the ORTHOGRAPHY_GUIDE version (**read from the file**, so a
guide bump invalidates on its own), the Scribe model id, and the keyterms; any
one of them changing misses. A hit costs nothing and writes **no** ledger
line; a miss records both legs as before. A corrupt, incomplete or
audio-less entry is a miss with a warning, never a crash. The cache is
consulted **before** ffmpeg and an existing extraction is reused, so a repeat
run does no audio work; the video is hashed once per invocation and the hash
passed down. Entries are bounded at `MAX_ENTRIES_PER_VIDEO = 3` per video
hash, evicting least-recently-written first — chosen, not measured, and
scoped so it can only ever remove children of one directory under the cache
root. Verified live: a
second run on the same reel hit the cache, cost $0.0000, took 4 s against
70 s, and produced a plan differing only in `createdAt`/`updatedAt`,
`completedAt` and the cost bookkeeping. A cache hit now writes
`costs.byStage.transcription: 0` rather than dropping the key, so `byStage` is
diffable across runs — a key that appears and vanishes reads as a pipeline
change.

Two deliberate departures from ARCHITECTURE §3, both to avoid recording a
guess as data: `transcript.words[].lang` is nullable, and `clientMode` and
`watermark` are nullable because transcription runs before either is chosen.

**Block 3 session 1 ran the four Block 1 reels through the production CLI** —
the first evidence the pipeline generalises past vitasilk. All four completed,
all four plans validated, $0.6248 against a $0.8792 estimate; ledger all-time
is $5.445002. Every one of the 148 subtitle groups is 1 or 2 words, every word
lands in exactly one group, and all 291 words carry a lang tag with no nulls.
`readEditPlan` was exercised outside its tests for the first time on all four
plans, and its schema-version gate throws `EditPlanVersionError` as designed.
Numbers, including WER against the corrected references and why it is *not* a
prompt comparison, are in `benchmarks/RESULTS-block3-generalisation.md`.
`benchmarks/src/score-editplan.ts` is the 39-line adapter that scores a
production Edit Plan with the existing benchmark scorer; it reads word texts
only and does not import from `service/`.

**Block 3 session 2** pushed the five local-only commits to GitHub (the repo
had never been pushed from this drive), then:

- **Inserted and deleted tokens extracted** against all four references, with
  no API calls — `benchmarks/RESULTS-block3-insertions.md`, built by
  `benchmarks/src/insertions.ts` and `insertions-cli.ts`. 15 insertions and 2
  deletions across 291 production words. **8 of the 15 are the conjunction
  `w`**; 5 of the remaining 7 are on the §4 freeze list; nothing was inserted
  in Arabic script and nothing was tagged `msa`/`en`/`mixed`. Three carry
  interpolated timings. Alignment reports edits in normalized space, so
  `normalizeWithProvenance` rebuilds the mapping back to source tokens;
  `mapNumeral` is exported from `normalize.ts` so the analysis compares the
  same tokens WER does.
- **A spotcheck page per reel**, listing only that reel's insertions, at
  `benchmarks/results/latest-spotcheck/<reel>-insertions.html` (gitignored;
  regenerate with `npx tsx src/insertions-cli.ts` from `benchmarks/`). The
  existing spotcheck tool was extended, not replaced: it gained an optional
  context column, a configurable lead-in and play length, and configurable
  answer labels. Its timestamp pages are unchanged.
  **The listening pass has not been done** — every row is unjudged, so nothing
  yet says whether the pipeline invents words.
- The client mode machinery below.

**Client modes** (PROJECT_SPEC §5) live in `core/src/mode.ts`: the schema is
the module's own doc comment, plus `validateMode`, `parseMode`, `loadMode`,
`renderStylePrompt`, `renderNegativePrompt` and `requireFonts`.
`modes/k2-syndicalia.json` is version 1 and validates.

- The four palette colours are **locked** and carry roles read off the values:
  `background #1A0000`, `primary #820000`, `accent #C9A96E`, `light #F8F6F2`.
- **Fonts are `{ status: "tbd" }`** and must stay that way. PROJECT_SPEC §5
  forbids inventing them; the user supplies them at Block 9. `requireFonts`
  throws `ModeFontsUnresolvedError` rather than substituting a default, so a
  stage that needs a real font fails loudly instead of shipping a placeholder.
- **No colour is ever written in code.** `imageStyle.stylePrompt` references
  the palette as `{{palette.<role>}}` and `renderStylePrompt` substitutes at
  compose time; a fragment naming a colour literally is a validation failure.
  `GLOBAL_NEGATIVE_PROMPTS` (no text, no watermark, no logo — ARCHITECTURE
  §5.3) is global and lives in code, never in a mode.
- **There is deliberately no `imageVariation` field.** How much images may
  vary within a reel is an open user decision; the gap is the record that the
  question has not been answered, and a guessed default would be
  indistinguishable from a decision.
- `vocabulary` is empty on purpose. Block 2 saw one brand name rendered three
  ways across three identical calls, so these terms are load-bearing as
  transcription key terms once the user supplies them at Block 9.
- `allowedTemplates` holds stub ids matching TEMPLATE_LIBRARY_GUIDE §3
  (`sub_`/`kw_`/`img_`). Real templates arrive in Block 6.
- Validation fails with a dotted path per problem and reports them all at
  once: unknown colour format, missing required field, a template id breaking
  the naming convention or carrying the wrong element prefix, an unknown
  fonts status, a style fragment hardcoding a colour or naming a palette role
  that does not exist, and an id disagreeing with the filename.

Panel, templates, and real job types are not started.

See `docs/BLOCKS.md` for the full block plan and `handoffs/` for prior
session context.
