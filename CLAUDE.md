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
  the cost ledger, pricing constants and the Gemini model pins — text and
  **image** — (`core/src/model-config.json`), the token normalizer, the Levenshtein
  aligner, and `SCRIPT_RULES`. Anything both `service/` and `benchmarks/`
  need lives here; nothing is duplicated across the two any more.
- `service/` — Node/TypeScript companion service. `service/src/transcription/`
  holds the production hybrid module, `service/src/analysis/` the keyword and
  image-slot stages, and `service/src/images/` the image generation stage
  (see Status).
- `benchmarks/` — transcription benchmark harness (Scribe, Gemini, local
  Whisper baseline, Scribe+Gemini hybrid), scored on WER, orthography
  conformance, and cross-engine timestamp deviation. See `benchmarks/README.md`.
- `tools/cv/` — the Python CV sidecar: repo-local venv, subprocess, JSON in
  and JSON out. Background removal and the §5.4 cutout gate, local OCR,
  person segmentation and zone derivation for frame analysis. Tasks:
  `remove_bg`, `detect_text`, `segment_person`, `segment_overlay`,
  `compute_zones`, `component_stats`, `zone_overlay`, `component_overlay`,
  `short_edge_overlay`, `placement_overlay`, `head_overlay`, `torso_overlay`.
  Downloaded weights live in
  `tools/cv/models/` (gitignored) and are pinned by sha256 in
  `tools/cv/models.json`.
  `tools/validate-templates/` — not started
- `templates/` — AE templates (not started)
- `modes/` — per-client config. `k2-syndicalia.json` is a validated stub at
  version 2; the schema, loader and validation live in `core/src/mode.ts`
- `assets/brand/`, `assets/watermark/`, `assets/sfx/` — shared assets (not started)
- `.local/` — machine-local config, secrets, run state (gitignored, never committed)

## Commands

- The repo is an npm workspace (`core`, `service`, `benchmarks`). Install
  once at the root; there are no per-package lockfiles.
- `npm run check` (repo root) — `scripts/check.sh`: builds `@framopia/core`,
  then typecheck + lint + test across every workspace, validates every
  file in `modes/`, then verifies every reference file's
  `# reference-version:` header against a clean scorer pass. This is the regression
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
  API calls) into `benchmarks/RESULTS-block1.md`. It **regenerates the whole
  file**, so a notice hand-added to the markdown is lost; the header text
  lives in `benchmarks/src/aggregate.ts`.
- `npm run bench:verify-refs` — check every reference's declared version
  against a clean conformance pass. `-- --write` stamps the header, and only
  after a clean pass; it is the only thing allowed to write that header
  (CLAUDE_CODE_GUIDELINES §3). Part of `npm run check`.
- `npm run bakeoff --prefix service [-- --first-only]` — **billable.** The
  Block 4 image bake-off on `vitasilk` slot `img002`. `--first-only`
  generates one image and stops.
- `npm run images -- --plan <abs path.editplan.json> [--mode <id>]
  [--ceiling <usd>] [--no-cache] [--force] [--probe]` — **billable.**
  `--probe` generates one candidate and halts without writing the plan. The production
  image stage: candidates, cutouts, metrics, gate and text verdict onto a
  plan. Takes the session spend baseline once so every arm shares one ceiling.
- `npm run plan-page -- --plan <abs path.editplan.json> [--out <dir>]` — free.
  The review page for a plan's candidates, grouped by slot.
- `npm run cutouts` — free, local. Runs the CV sidecar's cutout gate over
  `benchmarks/results/latest-imagebakeoff/` and writes cutouts, metrics and a
  review page to `benchmarks/results/latest-cutouts/`. Generates no images.
  Needs `tools/cv/setup.sh` first.
- `npm run recompose -- --plan <abs path.editplan.json> [--mode <id>]` — free.
  Re-composes an existing plan's image prompts against the current mode. No
  Gemini call and no analysis re-run. Paths must be absolute.
- `npm run frames -- (--reel <label> | --all) [--force]` — free, local. Samples
  a reel from `benchmarks/footage.json` at ARCHITECTURE §5.5's 2 fps into
  `.local/cv/<video-basename>/frames-2fps/` with a `frames.json` manifest
  beside them. An existing sample is **refused, not replaced**, without
  `--force`: the masks next to it were computed from those exact frames.
- `npm run segment -- (--reel <label> | --all) [--no-debug]` — free, local.
  Person segmentation over an already-sampled reel into
  `.local/cv/<video-basename>/masks-2fps/`, plus contact sheets and close-ups
  under `benchmarks/results/latest-segmentation/`. Needs `tools/cv/setup.sh`.
- `npm run zones -- (--reel <label> | --all) [--method maximal|three]
  [--threshold <t>] [--write-plan] [--no-debug]` —
  free, local, **no inference**: it reads the masks already on disk. Writes
  `zones.json` beside them and contact sheets, close-ups and a validity
  timeline under `benchmarks/results/latest-zones/`. `--threshold` re-reads the
  stored **confidence** masks at that value instead of the binary ones, which
  is how the sensitivity sweep varies one thing. `--write-plan` persists the
  zones onto the reel's Edit Plan, preserving every `manual: true` zone.
- `npm run timing-budget [-- --out <path>]` — free, local, **read-only**. Sweeps
  every plan's subtitle groups, keywords and image slots against a grid of
  (intro+outro, minHold) budgets, **re-deriving display timing from the word
  speech timings** for each cell rather than reading the stored values, and
  writes `benchmarks/RESULTS-block6-timing-budget.md`. Reuses
  `checkBuildability` and `applyDisplayTiming`; no plan is modified.
- `npm run place -- (--reel <label> | --all) [--dry-run] [--no-debug]` — free,
  local, deterministic. The placement solver: assigns each image slot a zone, a
  position and a uniform scale, writes them onto the plan and renders
  `benchmarks/results/latest-placement/`. `--dry-run` solves and reports
  without writing.
- `npm run components -- [--floor <f>]` — free, local. Connected-component
  analysis over every stored binary mask, plus the twelve frames with the
  largest dropped component rendered to `benchmarks/results/latest-components/`.
  Modifies no mask.

**`.local/cv/` is not a cache.** Nothing fingerprints it, no stage looks
entries up in it, and it is deliberately outside `.local/cache/` so that it is
out of reach of `evictStaleEntries`, which deletes children of a video's
directory by age. Frames and masks are regenerated by re-running the two
scripts above, never by a cache miss.

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

**The noise floor is 5.2 WER points** since the Block 4 session 1 reference
correction; see the Block 4 section. The 3.7 figure below is superseded and is
kept because it is what every Block 3 comparison was judged against.

**The noise floor was 3.7 WER points** against the then-corrected reference — 14.8%
to 18.5% across the three identical correction calls. It got *wider* than the
old 2.5-point figure because correcting the reference removed accidental
credit the outlier run was getting for a fused spelling. **The 2.5-point
figure is superseded** and every result scored against the old reference is
labelled as such in the results files. Any prompt comparison whose effect is
under 3.7 points is not measurable at n=1 on this reel — **read 5.2 for
anything measured from Block 4 onward.**

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
- **`imageVariation` is the varying half of an image prompt**, settled by the
  user in Block 3 session 3 and the reason the mode is at version 2. Every
  slot gets the whole of `imageStyle.stylePrompt`, which is what keeps the
  palette dominant across a reel; each slot then draws one value from each of
  the `composition`, `lighting` and `crop` axes so the set reads as designed
  rather than batched. The axes are mode data for the same reason colours are:
  no composition, lighting or crop term may be written in a source file.
  Which value a slot draws is session 4's problem, not the mode's. The K2
  axis *values* are placeholders like the rest of the stub; the axis *names*
  are settled.
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

**Analysis** is `service/src/analysis/`, driven by
`npm run analyse -- --plan <path.editplan.json> [--stage keywords|slots]
[--mode <id>] [--keywords auto|propose] [--yes] [--no-cache]`, and checked with
`npm run validate-plan -- --plan <path.editplan.json>`. Two stages,
same shape: derive a count from duration, one structured Gemini call for
candidates, then pure deterministic selection that imposes the count.

- `count.ts` — `keywordCountFor(durationS)`: PROJECT_SPEC §5's 3–5 per 30 s
  taken at its midpoint of 4, pro-rata, rounded, floored at 1. Pure. All five
  reels are 21–26 s, so all five get **3**. The model is never asked how many
  keywords exist.
- `keywords.ts` — `ACTIVE_ANALYSIS_PROMPT_VERSION = 1`, the prompt, the parse,
  and the one structured Gemini call. Criteria are stated in priority order:
  **primary is semantic weight** (the word carrying its sentence's claim),
  **secondary is brand and domain vocabulary, as a tiebreak only**. Delivery
  and vocal emphasis are ruled out in the prompt — nothing here hears prosody.
  Mode vocabulary is passed as an explicit term list; empty for K2 today, and
  the non-empty path is fixture-tested. Asks for `max(8, 3 × count)`
  candidates and appends its own ledger line at the point of spend, so a
  stubbed call in a test cannot bill.
- `select.ts` — everything downstream of the model, and all of it
  deterministic: score descending, tiebreak on start time then first word id
  so the order is total and never depends on incoming order. Drops any
  candidate whose ids do not resolve, names a removed word, overlaps a
  selected keyword, has no ids, or scores outside 0–1, and **counts each as a
  resolution failure — never fuzzy-matched into place**. Text comes from the
  plan, not the model; a disagreement is recorded as a text mismatch.
- `fingerprint.ts` / `cache.ts` / `cached.ts` — the §6 cache for the analysis
  stage, reusing `cacheEntryDir` and `evictStaleEntries` rather than a
  parallel system. The fingerprint covers the analysis prompt version, the
  Gemini model pin, **mode id and mode version**, the transcript content and
  the candidate count. A mode version bump invalidates. Eviction is now **per
  stage**, so an analysis write can no longer evict the transcription entry.
- `job.ts` — reads a plan, enriches `keywords`, sets `pipeline.analysis` and
  `costs.byStage.analysis` (**0 on a cache hit, never absent**), and writes
  back. `writeEditPlan` validates first, so a keyword naming an unknown word,
  claiming a removed word, overlapping another keyword or scoring outside 0–1
  cannot reach disk. `templateId` stays null until session 4.

**`auto` and `propose` differ only in the `approved` flag.** The mode is a run
parameter, never reaches the model, and the selection is identical — asserted
in unit tests and confirmed live.

**Where determinism holds, precisely.** The cache gives byte-identical output
on identical inputs, and everything downstream of the model response is
deterministic. **The Gemini call itself is not reproducible** and nothing in
the code or docs claims it is. Measured on vitasilk
(`benchmarks/RESULTS-block3-keywords.md`): three cache-bypassed calls picked
the **same three keywords with the same spans in the same order**, while
scores moved (0.90–0.98 on the same word), reasons were reworded every time,
wall clock spread 30–93 s and cost spread 9.8%. One reel, one domain, with a
brand and a procedure name in it — the conditions most favourable to a stable
answer.

**Live run:** vitasilk $0.0514 and test-1 $0.0498, 3 keywords each, **0
resolution failures and 0 text mismatches** on both. Session spend $0.267718
over 5 calls; ledger all-time $5.712720.

**The cost estimate is stage-aware since Block 3 session 4.**
`estimateGeminiTextCallCost` in `core/src/pricing.ts` estimates from the
prompt that will actually be sent plus an expected answer size, using the same
deliberately pessimistic thinking multiplier as transcription. It printed
$0.0533 against a $0.0588 keyword actual and $0.0781 against a $0.0467 slot
actual. The old duration-based call was fed 0 and printed $0.0040 against
~$0.05, which is worse than printing nothing. Actuals still come only from
`usageMetadata`.

**Transcription merges into an existing plan** since Block 3 session 4
(`service/src/editplan/merge.ts`). It used to build a fresh plan and write it,
silently deleting whatever keywords a later stage had added.

- `transcriptContentHash` covers each word's id, text, timing and removed
  flag — everything that can invalidate a block pointing at it. Stored on the
  plan as `transcript.contentHash` (a **departure from ARCHITECTURE §3**,
  which does not name the field), but the merge **recomputes it from the
  existing plan's own words** rather than trusting the stored value, so a plan
  written before the field existed is answered exactly instead of assumed
  stale.
- Transcript unchanged: `keywords`, `images` and `sfx` are kept as they are,
  and `meta.id` and `meta.createdAt` survive.
- Transcript changed: those three blocks are **cleared**, their pipeline
  stages reset to `pending`, their `byStage` costs dropped, a `built` plan
  marked `stale`, and the CLI says so on stdout. A stale word-id reference is
  never re-resolved onto a neighbour — a keyword pointing at the wrong word is
  worse than a missing one. `zones` survive: they come from computer vision
  over frames and reference no word.
- ARCHITECTURE §3's rule that a re-run never overwrites a human-flagged item
  is enforced: a clear that would destroy a `keywords.items[].edited` item or
  an image slot with a `chosenCandidateId` throws `PlanMergeBlockedError` and
  demands `--force`. `KeywordItem.edited` is a **second schema departure**,
  added because keywords had no way to carry that flag.

**Keyword spans are capped at two words and must not repeat an idea**
(`service/src/analysis/span.ts`), both enforced in the pure selector.
TEMPLATE_LIBRARY_GUIDE §4 designs for "1–2 short words, our real case" and §8
notes "best on 1 word"; session 3 put ten emphasized words on a 22 s reel.

- An over-long candidate is **narrowed, not dropped**. The rule: drop
  droppable tokens from both ends while more than one remains; if two or fewer
  remain that is the span; otherwise keep the first token plus the second when
  the second is not droppable. Head-initial is right for all three languages
  here. Droppable = a function word or a bare number.
- **This can break a §6 Arabic-script domain term** that the orthography guide
  treats as one unit: `تحفيز طبيعي للكولاجين` narrows to `تحفيز طبيعي`. A real
  tension between the guide and the template contract, resolved in favour of
  the template because the text has to fit on screen.
- Diversity: two keywords collide when their significant tokens share a stem.
  `headStem` sees through the Arabic definite article and the single-letter
  proclitics (`الكولاجين` and `للكولاجين` are the same idea) and through an
  attached Latin article. It is a **heuristic used only for comparison** — it
  never rewrites a word and refuses to strip down to a stub. A collision skips
  the candidate and the next by score takes its place; a count the candidates
  cannot fill is reported as a `shortfall`, never padded.
- `ACTIVE_ANALYSIS_PROMPT_VERSION` is **2**: version 1 plus the span-length
  preference and "do not return two candidates about the same thing".
  Narrowing is the guarantee; the prompt makes it the exception.

**The image slot planner** is `slots.ts` (prompt, call, parse) and
`slot-select.ts` (pure), with `ACTIVE_SLOT_PROMPT_VERSION = 1` and its own
cache stage `imageslots`. **No image is generated — that is Block 4.**

- Count from duration at 5.5 per 30 s, PROJECT_SPEC §5's midpoint, same
  rounding and floor as keywords. 4 for the Block 1 reels, 5 for vitasilk.
- Spread is enforced by dividing the reel into `count` equal windows and
  keeping at most one slot per window by midpoint, plus `MIN_SLOT_GAP_S = 0.5`
  as an absolute floor (chosen, not measured). A window no candidate reached
  is a shortfall, not a second slot crammed next to the first.
- Slots must not overlap in time, word ids must resolve, and an unresolved
  slot is dropped and counted rather than fuzzy-matched. Images are
  **independent of keywords** per §5, so the planner is never told about them.
- `prompt` = idea + all of `mode.imageStyle.stylePrompt` (the invariant half,
  which is what keeps the palette dominant) + this slot's variation draw.
  `negativePrompt` = mode negatives + the §5.3 globals. **No colour and no
  composition term is written in code.**
- The variation draw is deterministic from `meta.id` and the slot index: a
  per-axis offset and a stride coprime to the axis length, so consecutive
  slots never share a value and the walk covers the whole axis, plus a
  per-cycle bump so a reel with more slots than an axis has values does not
  repeat its first draw exactly. vitasilk's fifth slot was an exact copy of
  its first on all three axes before the bump existed.
- `ImageSlot` gained `wordIds` and `presentation` became nullable — two more
  **schema departures**, both recorded in `service/src/editplan/types.ts`.

Validation covers both blocks: a keyword or slot naming an unknown word,
claiming a removed word, overlapping another, or scoring outside 0–1 cannot
reach disk, because `writeEditPlan` validates first.

**Live run** (`benchmarks/RESULTS-block3-slots.md`): 4 billable calls,
$0.224164, ledger all-time $5.936884. test-1 went from ten emphasized words to
four and lost its duplicate-idea pair. **Nothing needed narrowing and no
diversity skip fired on either reel** — the prompt prevented both upstream, so
those two selector rules are live but unexercised on real data.

**Block 3 session 5 finished the analysis stage.** What it added:

- **Prompt punctuation is normalised** (`composePrompt`). Fragments come from
  three places that cannot agree on terminal punctuation, and every session-4
  prompt shipped reading `...five minutes.. a single clear idea`. Each fragment
  is now stripped of its own trailing punctuation before the separator is
  added, and a test pins that no composed prompt doubles punctuation or
  whitespace.
- **Subtitle groups are keyword-aware** (`service/src/analysis/regroup.ts`).
  Grouping runs during transcription, before any keyword exists, so a span can
  land across two groups — it did on four of six live keywords. After
  selection, the pass re-cuts the word sequence so every keyword span is
  exactly one group, and the group records `supersededBy`. **It only ever
  splits**, so the 1–2 word rule cannot be broken by it; a keyword that still
  cannot align — non-adjacent words, or a group carrying a human edit §3
  forbids re-deriving — is **dropped and counted**, never forced.
- **`templates/manifest.json` and `assets/sfx/sfx.json`** are stubs following
  TEMPLATE_LIBRARY_GUIDE §8 exactly. Both carry a machine-readable
  `stub: true`, and `assertRenderable` throws `StubTemplatesError` so a
  rendering stage cannot build from placeholder timings. **No audio file
  exists**; the index declares ids only and Block 6 supplies the sounds.
  `npm run validate:modes` now also validates the manifest and checks that
  every id a mode allows exists in it with the right type.
- **Template assignment is deterministic** (`assign.ts`): an offset and a
  coprime stride seeded from `meta.id` and the element type, plus a per-cycle
  bump. Consecutive elements never repeat a variant and the walk covers every
  variant. The multi-variant path is tested now against a fixture mode with
  3/2/4 variants — 42 subtitle elements came out 14/14/14 with a longest run
  of 1 — so Block 9 does not discover it broken. A type with no allowed
  variant throws `NoTemplateVariantError`.
- **SFX events are derived** (`sfx.ts`), recomputed on every run from the
  assigned templates and the manifest bindings, at element start plus the
  binding offset. An sfxId the index does not define throws `UnknownSfxError`.
  Subtitles declare no SFX per §10, so 42 groups produce none.
- **Buildability checks** (`buildability.ts`), exposed as
  `npm run validate-plan -- --plan <path>`: element duration against
  intro + minHold + outro, every keyword span mapping to exactly one group,
  slot word ids resolving, no slot overlap, and every templateId in the
  manifest. It reports every failure at once and **repairs nothing**.

**Both live plans currently fail buildability**, and this is the block's real
finding: 26 of 42 vitasilk groups and 23 of 39 test-1 groups are shorter than
`sub_pop`'s 0.60 s of intro + hold + outro, worst case 0.00 s — an interpolated
word whose start and end are the same instant. The stub timings are guesses and
Block 6 will move them, but a word spoken in 0.08 s cannot carry an animation
with a distinguishable intro and outro at any timing. It is a real conflict
between PROJECT_SPEC §5's fast-reel 1–2 word subtitles and a template contract
having intro/hold/outro at all, and it is the user's to settle. Numbers in
`benchmarks/RESULTS-block3-complete.md`.

**Schema departures from ARCHITECTURE §3 introduced in Block 3**, all
documented at their definition in `service/src/editplan/types.ts`:

| field | shape | why |
|---|---|---|
| `transcript.contentHash` | `string?` | A re-run must tell whether downstream word-id references still mean anything without diffing two word arrays. Recomputed from the words, so a plan predating the field is answered exactly rather than assumed stale. |
| `keywords.items[].edited` | `boolean?` | §3 requires an automated re-run never overwrite a human-flagged item; keywords had no way to carry the flag. |
| `subtitles.groups[].supersededBy` | `string \| null` (optional) | A keyword and a group can claim the same words and §3 never says which wins. The keyword replaces the group's rendering, and the builder is told rather than inferring it from overlapping time ranges. |
| `subtitles.groups[].edited` | `boolean?` | Same reason as the keyword flag: the re-grouping pass is an automated re-run over groups. |
| `images.slots[].wordIds` | `string[]` | §3 gives a slot only start/end, which leaves a merge unable to tell whether the span it illustrates still exists. |
| `images.slots[].presentation` | `'cutout' \| 'card' \| null` | §3 types it as always set; the quality gate is Block 4, and a guessed `cutout` would read as a decision. |
| `subtitles.groups[].displayStart` / `.displayEnd` | `number?` each | How long the card is on screen, which is not when the words were spoken. §3 gives a group only start/end, and those stay the single timing authority. Optional with a default: absent means the display window is the speech window. |
| `keywords.items[].kind` | `'label' \| 'promise'` (optional) | The selector forces a mix of the thing being named and the claim made about it, and the panel has to show which is which. Optional so a plan from an earlier prompt version stays readable. |

**Block 3 session 6 closed the block.** The user settled four things by ear
and the pipeline was changed to match:

- **The conjunction `w` attaches** (guide §2, v1.0.7). Every Block 3 transcript
  had written it standalone; the references had been writing it attached all
  along, so the references were right and the transcripts were wrong.
- **A French noun keeps its French article** (§2/§5): `dial la vidéo`. A French
  root carrying Darija morphology takes the attached article: `dial lvitaminat`.
  Both legal — write what was spoken.
- **A §6 term is never broken in the subtitle track** (new §6c). The keyword
  layer selects a *subset* of a long term because keyword templates hold one or
  two words; that is a pointer into the term, not a spelling of it.
- **Keywords must cover the label and the promise**, at the same count of 3.

`ACTIVE_PROMPT_VERSION` is **4** (version 3 plus the two spelling rules stated
explicitly rather than left to be found in the guide) and
`ACTIVE_ANALYSIS_PROMPT_VERSION` is **3** (label and promise co-primary, each
candidate marked with its kind). The guide bump and the prompt bump both
invalidate the transcription cache by design, which is why session 6 cost more
than the rest of the block together.

**The rule took, completely: 22 attached conjunctions and 0 standalone across
all five reels**, including Arabic-script `ونضارة` and `ومادة`.

**WER inverted on three of four reels.** Against the v1.0.7 references,
production now beats run C hybrid on test-1 (14.7% against 20.6%), test-2
(22.9% against 28.6%) and test-3 (16.7% against 18.3%). test-1 halved from
31.3%. The gap that had stood since session 1 is gone on those three.
ground-truth was the exception at 22.2% against 16.0%, and that was **a
reference defect**: its own reference wrote the conjunction standalone on
three lines and the article standalone on two, so the transcript was penalised
for being right. **Block 4 session 1 corrected it** — production is now 11.8%
against run C's 23.7%, and the inversion holds on all four reels. (The "four
lines" here was a miscount of the same five-token list.)

**The subtitle timing floor is largely fixed.** Two causes, two fixes:
`sub_pop`'s stub timings were wrong (0.60 s floor against
TEMPLATE_LIBRARY_GUIDE §5's own budget of 4 frames per end, which is 0.33 s),
and display timing did not exist. Buildability went 31 → 10 issues on vitasilk
and 25 → 8 on test-1. **Every image slot now passes.** What still fails is 7
subtitle groups per reel and a few keywords, each blocked because merging would
make a 3-word group or would break a keyword's group alignment.

`service/src/analysis/display-timing.ts` holds it. **Word timings are never
modified** — `start`/`end` stay exactly what the words say, and
`displayStart`/`displayEnd` are how long the card is up. Extension takes only
silence, never reaches into the next group or past the reel; a merge is tried
only after extension fails and is refused outright on a superseded group; a
group that can be neither extended nor merged is reported, never faked.
`findShortWords` reports every word under 0.05 s with its id, text and whether
its timing was interpolated — 11 across the two reels, 7 of them interpolated.
**Nothing is repaired**; that is a Block 2 alignment question.

**Template assignment is a seeded shuffle**, not the session-4 coprime
rotation, which produced a visible A,B,C cycle that PROJECT_SPEC §1 rules out.
Determinism is unchanged and no variant repeats back to back.

**SCHEMA FRAGILITY RULE, standing.** `readEditPlan` validates on read, so a
required schema addition makes every previously written plan unopenable —
including for migration. Session 5 hit this and had to move a check out of
structural validation. Every schema addition is now **optional with a
default**, or ships with a migration path that does not read through the new
validator.

## Block 4 — image generation

**Session 1 was preparation only and spent nothing.** The ledger held 84
entries and $7.556062 at both ends of the session, byte-identical.

**The `ground-truth` reference is corrected and the numbers moved a lot.**
It still wrote a standalone `w` on three lines and a standalone definite
article on two, which guide §2 forbids — and its header had already been
bumped to `v1.0.7-conformant` in Block 3 session 6, so it had been claiming a
conformance it did not have. The five tokens named in
`RESULTS-block3-final.md` are fused. Re-scored from recorded engine outputs
with **no API call**; `benchmarks/RESULTS-block4-refcorrection.md` is the
record.

- The reel goes from **81 reference words to 76**, so unlike the Block 3
  reference corrections this one is *not* token-for-token and every WER
  denominator for it moved.
- **Production drops 22.2% → 11.8%**, a 10.4-point improvement — materially
  more than the 6.2 points Block 3 estimated, and not reconciled to it: 6.2
  was the production-vs-run-C *gap*, which nets the transcript's penalty
  against the credit run C got for making the same non-conformant choice.
- **Production now beats run C hybrid on all four reels.** ground-truth was
  the last holdout and now shows the largest margin: −11.9, against −5.9,
  −5.7 and −1.6. Run C hybrid on this reel worsened 16.0% → 23.7%.
- **The noise floor is now 5.2 points**, re-scored from the recorded
  three-call set — up from 3.7, which is superseded, as 2.5 was before it.
  Any prompt comparison under 5.2 points is not measurable at n=1 on this
  reel. Caveat: that set ran prompt version 1 and production is on version 4;
  nothing here re-measures the current prompt.
- `RESULTS-block1.md` was regenerated by `npm run bench:aggregate` (disk only)
  and seven other results files carry a supersession notice. Only WER moved;
  every finding in them stands.

**Image pricing lives in `core`** — `geminiImagePrices` in
`model-config.json`, read off ai.google.dev/gemini-api/docs/pricing on
2026-08-25, with `computeImageCost` and `estimateImageRunCost` in
`pricing.ts`. Per-model, per-resolution-tier. **Nothing about image cost is
hardcoded outside core.** An unknown model id throws
`UnknownImageModelError` rather than costing zero.

Per image: `gemini-3-pro-image` $0.134 at 1K and 2K, $0.24 at 4K;
`gemini-3.1-flash-image` $0.045/$0.067/$0.101/$0.151 at 0.5K/1K/2K/4K;
`gemini-3.1-flash-lite-image` $0.0336 at 1K; `gemini-2.5-flash-image` $0.039,
**which retires 2026-10-02 and must not be used** — config validation rejects
any priced model carrying a `retiresOn`.

`GEMINI_IMAGE_MODEL_PRO` and `GEMINI_IMAGE_MODEL_FLASH` are both live options.
**Session 2 picks one, by the user's eye. Nothing in code may assume either.**

**1K–2K only, never 4K.** The largest negative zone in a 2160×3840 frame is
roughly 1700 px across and TEMPLATE_LIBRARY_GUIDE §3 has image comps at
1200×1200, so 4K is paid-for pixels that get scaled away.
`ALLOWED_IMAGE_RESOLUTIONS` is `['1K', '2K']`; `validateImageConfig` rejects
4K by name, and `validateEditPlan` rejects a candidate recording it. The
default is 1K.

**`service/src/images/`** — `config.ts` (the resolution ruling, 2–4 candidates
per slot per ARCHITECTURE §5.4 at a default of 3, and a `ceilingUsd` default
of $3), `client.ts` (the one-method `ImageGenerationClient` interface),
`gemini-client.ts` (**the real client, never invoked in session 1**),
`fingerprint.ts`, `cache.ts`, `estimate.ts`, `generate.ts`.

- The cache is `.local/cache/<video-sha256>/images-<fingerprint>/`, reusing
  `cacheEntryDir` and `evictStaleEntries` **stage-scoped**, so an image write
  cannot evict the transcription entry. The image is written before the
  manifest, so an interrupted write reads as a miss; an entry naming a missing
  file is a miss with a warning, never a zero-byte candidate.
- The fingerprint covers the composed prompt, the negative prompt, model id,
  resolution, candidate index, mode id and mode version. **A mode version bump
  invalidates**, even when this slot's prompt is unchanged, because it may
  have changed what a later slot draws from the variation axes.
- **`appendCost` fires once per image the client actually returned, and
  nowhere else** — not in a wrapper, not on a cache hit, not on an injected
  fake. Block 3 session 3 wrote eight fabricated ledger lines by billing
  around a call that never happened. A test runs the whole path against the
  fake and asserts the ledger is byte-identical.
- The ceiling is checked **before the first call**, so an over-budget run
  costs nothing rather than aborting halfway with images already billed.

**Six new optional fields on `ImageCandidate`** — `modelId`, `resolution`,
`generatedAt`, `costUsd`, `promptFingerprint`, `metrics` (§5.4's alpha edge
noise, hole ratio, foreground area, edge halo). Every one is
optional-and-validated-only-when-present under the schema fragility rule, and
all five existing plans still open through `readEditPlan`.

**The mode palette is reachable without fonts.** `loadMode` →
`parseMode` → `validateMode` never touches `requireFonts`, and neither do
`renderStylePrompt` or `renderNegativePrompt`. Confirmed live against
`k2-syndicalia` with `fonts.status: "tbd"`: the palette resolves and the four
style fragments render.

**Nothing had been generated as of session 1.** Session 2 made the first live
call; see the session 2 section below. The cutout gate, the metrics that would
fill `ImageCandidate.metrics`, and the job that would write candidates back
onto a plan still do not exist.

## Block 4 session 2 — the first live image calls

**Six images were planned. One was generated, for $0.122593, and the run
halted.** Ledger 84/$7.556062 at start, 85/$7.678655 at end.

**A reference header is written by the checker now, never by hand.**
`npm run bench:verify-refs` gates every `.local/ground-truth/*.txt` file's
`# reference-version:` header on a clean scorer pass, and it runs inside
`npm run check`. `-- --write` is the only writer, and only after a clean pass.
The rule is in `CLAUDE_CODE_GUIDELINES.md` §3, with its general form: anything
asserting that a property is verified must be emitted by the thing that
verifies it.

**The scorer now flags a standalone `w`, `و` or bare `l`** (`findProclitics`
in `benchmarks/src/orthography.ts`, a scored violation). Guide §2 had claimed
since v1.0.7 that it did; it did not — `w` was only in the vowel-less
*exception* set, which suppresses a warning rather than raising one. The
guide's claim is true now.

**`test-3` had two standalone conjunctions and no list ever named them.** A
mechanical scan of all four references — a standalone token is one bounded by
whitespace — found `W bdebt` on line 17 and `w مادة` on line 18. Line 17
appears in no token list anywhere, and test-3's own header block asserted "No
edit" was needed. Corrected to `Wbdebt` and `ومادة`; §2 states the rule with
the same letter in Arabic script. The reel goes 60 reference words to 58.

Scan results, all four references: **standalone `w` — ground-truth 0, test-1
0, test-2 0, test-3 2. Bare `l` — 0 everywhere.** `wa7d l cocktail` was
already corrected by session 1. The three prior counts (six, five, four) were
all describing `ground-truth` alone.

Re-scored from recorded outputs, no API call: test-3 production **16.7% →
12.1%**, run C hybrid 18.3% → 24.1%. **Production now beats run C hybrid on
all four reels by 5.7 to 12.0 points.** The noise floor is **still 5.2** — it
is measured on `ground-truth`, which session 2 did not touch, and was
re-derived rather than assumed.

`RESULTS-block1.md`'s supersession notice **lives in `src/aggregate.ts`** now:
the file is regenerated by `npm run bench:aggregate`, which silently
overwrote session 1's hand-added notice. A notice in generated output cannot
survive.

### What the first live image found

Two of four post-image-1 checks failed, and both are one defect:

- **`GeminiImageClient` sent no `aspectRatio`.** The API does not default to
  square: a 2K 1:1 request returned **2752x1536**. It is now a required
  config field, allowed values `1:1` only (TEMPLATE_LIBRARY_GUIDE §3 works at
  1200x1200), and it **joins the cache fingerprint** because it changes both
  the pixels and the price.
- **The call billed $0.122593 against a $0.101 estimate, 21.4% over** — about
  2,042 output tokens against the 1,680 Google publishes for 2K, for 0.78%
  more pixels. **The token count for a served aspect ratio is not derivable
  from area**: 2,042 sits between the published 2K and 4K counts and matches
  neither. The price table prices *published (size, aspect) pairs*, so a
  request whose served dimensions match no published pair is an **unpriced
  request** whose cost the table cannot predict. **Every per-reel cost
  projection is a floor until a call is confirmed to land on the requested
  tier.**
- **The response is `image/jpeg`, not PNG.** The cache layer handled it; the
  bake-off writer did not, and named JPEG bytes `.png`. Extensions follow the
  returned mime type now.
- **The model returned no text at all.** So the `Avoid:` phrasing drew no
  conversational reply. Whether it was *obeyed* is a question about the
  picture and **nobody has looked at the picture.**

**Costs are billed from `usageMetadata`, never the price table**
(`computeImageCostFromUsage` in `core/src/pricing.ts`). The table is what the
estimate is built from; the two are recorded side by side rather than assumed
equal, which is how the 21.4% gap was visible at all.

**The mode's own prompt contradicted itself.** `img002` composed to
`one subject, centred and unobstructed` (invariant style fragment) plus
`subject off-centre with open space to one side` (variation draw), live on
every slot the planner had ever produced. Fixed in session 3: the composition
axis is gone and `validateMode` now rejects the pair.

**No model was picked and no quality judgement exists.** One landscape image
from one model is not a comparison. That image was the wrong shape and was
discarded in session 3, which regenerated the corpus at the correct one.

## Block 4 session 3 — the bake-off ran, and went over budget

**Session spend $1.326673 against a $1.00 ceiling.** Ten images were generated
where six were planned, because a cache-eviction defect made the verification
run regenerate an arm that was already on disk. Ledger 91 → 95 entries,
$8.491707 → $9.005328. The overrun is recorded in
`reports/block-4-session-3.md`; the measurement is
`benchmarks/RESULTS-block4-imagebakeoff.md`.

**ORTHOGRAPHY_GUIDE is v1.0.8.** The conjunction before an Arabic-script term
attaches *in Arabic script* as a proclitic: `ومادة`, never `w مادة` and never
`و مادة`. §2 states it; §6 and §8 cross-reference it, because both could be
read as forbidding it and neither does — §8 bans mixing scripts inside one
word and the fused form is one script throughout, and §6's term-level rule is
untouched because after fusion there is no separate conjunction word whose
script a neighbour could decide. `findProclitics` names the required fix when
the next token is Arabic script. **No WER figure moved** — all 20 rows
identical, `RESULTS-block1.md` byte-identical — which is what the ruling
predicted, the references already carrying the fused form.

**The mode is v3 and its variation axes are camera angle, framing tightness
and lighting.** Composition is gone: when the quality gate returns `cutout`
the background is discarded, so variation expressed as where the subject sits
inside the generated frame is erased, and the set reads as batched precisely
where cutouts work best. Every axis term is now a property of the subject.
`centred and unobstructed` stays in the invariant half — it survives the
cutout and helps it by holding the subject clear of the frame edge.

**`validateMode` rejects a contradiction between the two halves of a prompt**
(`VARIATION_CONTRADICTIONS` in `core/src/mode.ts`, an enumerated pair table).
Session 2 shipped `one subject, centred and unobstructed` alongside `subject
off-centre with open space to one side` on **every slot the planner had ever
produced**, and it was found by a human reading the composed string.

**Prompts recompose without a model call**
(`service/src/analysis/recompose.ts`, `npm run recompose -- --plan <abs path>`).
A mode bump changes the composed prompt but not the underlying idea, and the
idea is the only part a Gemini call produces; re-running analysis would pay for
ideas already on disk and replace them with different ones, the call not being
reproducible. It walks the same pure path the planner used, so the output is
byte-identical to what the planner would have written at this mode version — a
test asserts exactly that. Run on `vitasilk` and `test-1`.

- `ImageSlot.promptModeVersion` is a **schema addition, optional with a
  default**, absent on every plan written before this session and validated
  only when present. All five plans still open through `readEditPlan`.
- **Slot planning now refuses to overwrite recomposed prompts, generated
  candidates or a chosen candidate** and demands `--force`
  (`SlotsReplaceBlockedError`). It set `plan.images = { slots }` wholesale
  before, destroying all three silently.
- **The mode-version divergence is resolved** (session 4): analysis keys on a
  content hash of the fields each call reads, not on `mode.version`, and the
  four existing entries were migrated by rename. Both reels hit at $0.00.

**The client reports what it received.** `image-dimensions.ts` reads width and
height out of the returned bytes — PNG IHDR and the JPEG frame header, no
decoder dependency — and `generateImages` throws
`ImageDimensionMismatchError` before anything is billed, cached or written.
Unreadable bytes fail closed with their own message: an image that cannot be
measured cannot be confirmed to be the tier that was paid for. The parser is
tested against session 2's real 2752x1536 response and agrees with the system
decoder on it.

### What the six images established

**Session 2's `aspectRatio` fix works: all six came back 2048x2048.** All six
`image/jpeg`; neither model returned PNG. **No model returned any text**, so
the `Avoid:` phrasing drew no conversational reply — whether the negatives
were *obeyed* is a question about the pictures and **nobody has looked at
them.** No model was picked.

**The price table under-predicts even at the correct shape.** Session 2's
explanation — a served shape matching no published pair — was necessary but
not sufficient. All six of these were served at exactly the requested 2K 1:1
and still billed over: flash **+19.2%** mean, pro **+12.2%** mean, roughly
1,930–2,050 output tokens against the 1,680 published for 2K. **The published
per-image rate is a floor, not a price**, which is why the ledger takes its
figures from `usageMetadata` and never the table.

Wall clock: flash 20.5–23.0s, consistent; pro 33.1s / 72.3s / 215.0s for three
identical requests, the 215s being the arm's first call.

### The eviction defect

`generateImages` sized its eviction budget from **one call's** image count, so
a second call over the same video and stage deleted the first call's entries.
The bake-off's pro arm evicted the flash arm's three images, and the
"second invocation is a cache hit" check regenerated six for $0.51.

Fixed: `evictStaleEntries` takes a **protect list it never removes**, and the
image budget is `MAX_IMAGE_ENTRIES_PER_VIDEO = 64` — an image costs ~$0.12 to
regenerate and ~1.5MB to keep. The two-arm scenario is a test that fails
against the old eviction and passes against the new. Session 4 confirmed it on
the four surviving entries and on a live `--first-only` hit at $0.00; **a full
two-arm live run is still unverified**, because the same defect had already
deleted two pro entries and re-running would have billed.

The corpus at `benchmarks/results/latest-imagebakeoff/` (gitignored, kept for
session 4) is six 2048x2048 JPEGs: the pro files from the first run, the flash
files from the second, all the same model, prompt, resolution and aspect
ratio. `candidates.json` was rebuilt to describe the files actually on disk.

## Block 4 session 4 — the cutout gate and the text check

**Spent $0.00.** Ledger 95 entries / $9.005328 / sha `66e02a42…` at both ends,
byte-identical.

**`npm run bakeoff` could not be run as the session asked.** Session 3's
eviction defect had already deleted `gemini-3-pro-image` candidates 1 and 2
before the fix landed, so a full run would have regenerated two images (~$0.30)
against a $0.25 ceiling and a generate-nothing rule. A read-only probe showed
**4 of 6 hit, 2 billable misses**; the live cache-hit path was verified instead
on `--first-only`, which hit at $0.00 and wrote no ledger line. **The eviction
fix is confirmed on the four surviving entries and still unverified across a
full two-arm run.**

**The ceiling is a running check.** It bounds a **session**, not a call: the
caller captures the ledger's image total once and every arm shares it, and
before each request the ledger is re-read and the run **aborts** — not
truncates — if the next image would cross. Session 3's ceiling was evaluated
once, pre-flight, against an estimate, and two arms each passed their own.
The pre-flight check survives but measures against what is *left*, and
estimates only the **billable** images: the cache is resolved first, so a fully
cached re-run is never refused for want of budget.

**`IMAGE_COST_MULTIPLIER = 1.35`** in `core/src/pricing.ts`, on the
`THINKING_TOKEN_MULTIPLIER` precedent: a deliberately pessimistic **gate**, not
a best estimate. Ten images at exact published pairs billed 1.113 to 1.261 over
published, mean 1.166, **never once under**; 1.35 clears the worst by 7%. The
estimate now carries both figures. Actuals still come only from
`usageMetadata`.

**Analysis is fingerprinted on mode *content*, not `mode.version`**
(`keywordModeContentHash`, `slotModeContentHash`, `compositionContentHash` in
`core/src/mode.ts`, each enumerating the fields its consumer reads). The
keyword prompt reads client name and vocabulary; the slot prompt reads name
alone; composition reads palette, both halves of `imageStyle` and the axes —
and composition is pure, so nothing that bills keys on it. Session 3's v3 bump
invalidated every entry for an edit the model never saw, and a font at Block 9
would have done the same. **The four existing entries were migrated by rename,
free and provable** — `name` and `vocabulary` are identical between v2 and v3,
and the old fingerprint reproduces exactly from current inputs. **Verified:
both reels hit at $0.00 on keywords and slots, ledger unchanged.**

**`expectedDimensions` fails closed.** It returned null for a pair it could not
derive and `generateImages` reads null as "no expectation", so allowing a
non-square ratio would have silently disabled the dimension check — the
`findProclitics` defect again. It throws now, resolved once before any request.

### The sidecar

**`tools/cv/`** — repo-local venv (`python3.11`, the system 3.14 has no wheels
for this stack), pinned `requirements.txt`, `setup.sh`. Invoked as a
subprocess: **JSON on stdin, JSON on stdout, nothing else on stdout ever**;
progress and tracebacks to stderr; a failure is still valid JSON. Tasks
`remove_bg` and `detect_text`. Its pytest suite runs inside `npm run check`,
**skipped with a notice, never silently**, when the venv is absent.

Background removal is rembg with **BiRefNet-general** (~1GB model, downloaded
once to `~/.rembg/`). `service/src/images/sidecar.ts` is the client;
`npm run cutouts` runs the corpus.

**`post_process_mask` defaults OFF, and that is load-bearing.** It thresholds
the matte to hard edges and returns an alpha channel with **literally zero**
partial values, which reads as flawless to three of the four §5.4 metrics
because they measure the transition band it just destroyed. Same image:
`edge_halo` 0.0000 with the post-pass, **0.0749** without. A gate fed the
post-passed matte is not gating.

**All four metrics read the alpha channel alone**, so a dark subject scores the
same as a light one — every image in the corpus is dark on dark. `edge_halo`
skips the first 2 px outside the subject: hair and motion blur ramp to clear
across a couple of pixels, and with no skip a genuinely soft matte is
indistinguishable from a rim of old background. **That defect was found by a
test**, not by reading.

**Thresholds are provisional and were declared before the corpus was
measured**: edge noise ≤ 0.02, holes ≤ 0.01, foreground area 0.05–0.92, halo
≤ 0.10. Nothing was fitted to six images from one prompt on one slot, and
none has been changed since — the halo bound was examined at session 5 and
held.

### What the corpus said

**All six pass the gate** (`benchmarks/RESULTS-block4-cutouts.md`). Background
removal survives dark-on-dark: every matte is a single blob, no holes,
foreground area 11–22%, nowhere near either bound. **Two images sit within
0.004 of the halo threshold** (0.0966 and 0.0965 against 0.10) — they pass, and
a blind threshold landing that close to two of six is worth knowing. Nothing
was moved to accommodate them.

**Edge noise and hole ratio did not vary at all** across the six. Both are
exercised only by synthetic tests and **neither is validated against real
data**. Nothing has produced a `card` fallback on a real image, so that path is
untested outside the suite.

**Text detection: one true positive, five true negatives, no false
positives.** `gemini-3-pro-image-1` reads `HAIR` (0.984) and `SERUM` (0.958);
the other five read nothing. The negative prompt carrying
`no text, no watermark, no logo` did not prevent it, which is the whole reason
the check exists. RapidOCR, local and offline.

`ImageCandidate.detectedText` is a **schema addition, optional with a
default** — absent means the pass has not run, which is not the same as having
run and found nothing. **Advisory, never a delete.** All five plans still open
through `readEditPlan`.

Review page: `benchmarks/results/latest-cutouts/index.html`, four views per
image (original, checkerboard, on the mode's `light`, on its `background`),
because a halo is invisible on a ground its own colour. Gitignored, regenerate
with `npm run cutouts`.

## Block 4 session 5 — rulings implemented, generation blocked

**Spent $0.00. The Gemini account's prepayment credits are depleted**
(HTTP 429 `RESOURCE_EXHAUSTED`, "Your prepayment credits are depleted"), so
the ten-image production run did not happen and **the block's definition of
done is not met**. Ledger 95 / $9.005328 / sha `66e02a42…` at both ends.
Everything that does not need the API is done.

**The image config is frozen**: `docs/DECISION-image-config.md` —
`gemini-3-pro-image`, 2K, 1:1, **2 candidates per slot**. PROJECT_SPEC §5 and
ARCHITECTURE §5.4 point at it. It says plainly that **the cutout metrics did
not separate the two models** — all six passed, two metrics were identically
zero, the other two differed by less than the spread within each arm — so the
decision rests on the user's judgement of prompt fidelity and must not be
defended with the metrics.

The candidate default is **2, amending §5.4's 3**: pro bills ~$0.151 per 2K
image, so three on a five-slot reel is $2.26 against PROJECT_SPEC's $2.00
envelope. `DEFAULT_IMAGE_CONFIG` now carries the frozen config; a pre-flight
caught that it still said flash-at-1K, which would have generated ten images
on the wrong model.

**Mode v4**, three rulings:

- **`no text` is out of the global negatives.** It never worked — one corpus
  image rendered a legible label straight through it — and the thing guarded
  against was uncontrolled labelling. `no watermark` and `no logo` stay, and
  **whether *those* are obeyed has never been tested.**
- **The flat/frontal/unmodelled lighting entry is pruned.** Its effect is
  unmeasured and the mode note says so: all six images carried it and pro
  rendered dramatic rim light regardless, so the axis is not reliably obeyed.
  `soft diffuse light` was kept — neither flat nor frontal, and it declares
  shadows — and is the next candidate if separation turns out to be the issue.
- **`imageCandidates: 2`** on the mode. §5.4 called the count mode-overridable
  and nothing carried it until now.

Recomposed both plans free; **all four analysis cache entries still hit at
$0.00** after the bump, which is session 4's content-hashed fingerprints
working as designed.

**The halo threshold stands at 0.10.** The user compared originals against
cutouts: the bright edge is **in the original**. It is rim light the model
rendered, not background the matte retained, so the two near-misses are
correct renders. Recorded at `MAX_EDGE_HALO` with the limit it exposes —
`edge_halo` cannot tell a rim the model drew from a rim the remover left, and
runs high by construction wherever the lighting axis calls for rim light.

**OCR is a correctness check, not a presence check.** Detected words are
compared against the slot's own `idea` plus the mode vocabulary, casefolded
and accent-stripped so `caféine` matches `CAFEINE`. Unexpected words are an
**advisory warning** — never a delete, because a false positive on a stylised
texture must not drop a good candidate. The regression case passes:
`gemini-3-pro-image-1`'s `HAIR SERUM` is now **clean** against a hair-serum
slot, where the presence check called it a failure. All six corpus images
re-checked; one has text and it is correct, five have none.

**The two silent metrics can fire.** `alpha_edge_noise` and `hole_ratio` read
0.00000 on all six images, which could not be told from a metric that cannot
fire. A real cutout degraded deterministically produces the pipeline's **first
`card` outcomes**:

| degradation | metric | before → after | gate |
|---|---|---|---|
| hole punched | `hole_ratio` | 0.00000 → 0.04972 | **card** |
| specks scattered | `alpha_edge_noise` | 0.00000 → 0.02721 | **card** |
| alpha dilated ~3 px | `edge_halo` | 0.07489 → 0.60043 | **card** |

Each moves its own metric and leaves the others alone, so a `card` can be
attributed to a cause.

**The BiRefNet model is pinned by sha256** (`tools/cv/models.json`,
`verify-models.sh`, inside `npm run check`). It was a ~928 MiB unpinned
download and Block 10's DoD is a golden run green on two machines. A mismatch
fails the build; a model not yet downloaded exits 2 and does not.

**`service/src/images/job.ts` is the production stage** — generate per slot,
cut out, gate, check text, write onto the plan. `npm run images -- --plan
<abs path> [--ceiling <usd>]`. `chosenCandidateId` is **left null**: the editor
picks in Block 8. `presentation` is set **only when every candidate agrees**,
because it follows whichever candidate is picked. `cutoutQuality` is the
**minimum** headroom across the metrics, not the mean — a matte with one bad
metric and three perfect ones is a bad matte — and a test pins its thresholds
to the Python gate's so the two cannot drift. A re-run does not block on
candidates (they return from cache free and identical) but does block on a
chosen candidate.

**The stage is verified end to end against the real sidecar** — real cutouts,
metrics, gate, OCR verdict and plan write, with only the paid generation
substituted (`job.integration.test.ts`, a temp plan, never a real one).
**What has never run is the paid generation itself**, and with it the cache
re-run check, the ten-image review page, and every DoD item.

### Block 4 definition of done — not met

| item | state |
|---|---|
| every slot has candidates | **no** — no plan has a candidate on it |
| gated cutouts on disk with metrics | **no** on a plan; the six-image corpus has them |
| costs recorded | code path proven by test, never exercised live |
| cache prevents regeneration | proven for analysis, **unproven for images across a full run** |

## Block 4 is complete — session 6 met the DoD

**Session spend $1.550444** against a $2.25 ceiling. Ledger 95 → 105 entries,
$9.005328 → $10.555772, sha `66e02a42…` → `a7e85e4b…`.

**`my files/test videos/vitasilk.editplan.json` is the fixture plan**: five
slots, ten candidates, every one with a cutout on disk, four §5.4 metrics, a
gate outcome, a text verdict and its actual cost. `chosenCandidateId` is null
on every slot — the editor picks in Block 8.

| DoD item | evidence |
|---|---|
| every slot has candidates | 5 slots × 2 = 10, `status: generated` |
| gated cutouts on disk with metrics | 10 PNGs in `my files/test videos/cutouts/`, metrics and `gate` per candidate |
| costs recorded | 10 ledger lines at the point of spend, $1.550444, actuals from `usageMetadata` |
| cache prevents regeneration | re-run: `10 already cached, 0 to generate`, `billed 0`, ledger sha unchanged |

**The cache re-run is also the eviction fix's first full multi-batch test**,
unverified since session 3 broke it. Ten entries across five slots survived
the run that wrote them.

**Mode is v5.** Session 6 pruned `soft diffuse light, shadows barely readable`
by the user's ruling — barely-readable shadows are the flat characterless look
under a gentler name. The lighting axis is at the validator's minimum of two
values; a diffuse *and* modelled entry is the user's to write at Block 9, like
the fonts. Both plans recomposed free and **all four analysis cache entries
still hit at $0.00**.

**Decision docs are now tested against the constants they freeze**
(`service/src/decisions.test.ts`, in `npm run check`). Session 5 nearly paid
for their being unconnected: `DECISION-image-config.md` froze pro-at-2K while
`DEFAULT_IMAGE_CONFIG` still said flash-at-1K, and ten wrong images would have
passed every check. The tests parse the markdown and fail in both directions;
the table parser throws rather than returning undefined, so a restructured
table cannot quietly stop the checking. They immediately caught real drift —
`DECISION-transcription-config.md` recorded `ACTIVE_PROMPT_VERSION = 3` while
the code has run 4 since Block 3 session 6; the amendment is now written.

### What the run actually found

**Only 2 of 10 candidates passed the gate**, and this is the block's real
result rather than the DoD checkbox.

- **Five failed on `edge_halo`, four of them on halo alone** (up to 0.1703
  against 0.10). `edge_halo` **could not tell a rim the model drew from a rim
  the remover left**, so the gate was rejecting correct renders. **Session 7
  fixed the metric, not the threshold** — see below. The lighting prune is a
  plausible contributing cause and was never isolated: these ten span five
  slots with different subjects while the clean corpus was six images of one
  slot, so subject and slot changed alongside lighting.
- **Two failed on `hole_ratio`** (img004, 0.09251 and 0.01739) — a genuine
  matte defect, and **the metric's first firing on a real image**. It read
  0.00000 on all six corpus images and needed deliberate degradation in
  session 5 to prove it worked.
- **Two failed on `alpha_edge_noise`** (img005, 0.08965 and 0.38286), also a
  first on real input — **but arguably a false positive.** That slot's idea is
  `A salon shelf displaying premium hair care products`, inherently
  many objects, while the metric counts everything outside the largest
  connected blob as speckle and the mode's invariant fragment says
  `one subject, centred and unobstructed`. **The idea contradicts the
  invariant** and the gate reports it as a matte failure. A mode and prompt
  problem surfacing through a metric.

**Every slot's two candidates agreed**, so the null "candidates disagree"
presentation is still untested on real data.

**The text check earned its place.** `no text` was removed at session 5
because it never worked; the correctness check that replaced it caught
`elixir, luxe` on img002-c1 and **47 unexpected words on img005-c1** —
`velvet`, `golden`, `noir`, `repair`, `solde` and a long gibberish tail, a
shelf rendered full of fake labels. Four of ten carry text the slot did not
ask for; all advisory, nothing deleted. One clean pass: img002-c2 reads
`hair, serum`.

**Costs ran +12.9% to +18.4% over published, mean +15.7%**, never under —
twenty of twenty across the block. The 1.35 gate covered all of them. The mean
has crept up from session 3's +12.2% on three images, which argues for leaving
the gate where it is rather than tightening it toward the mean.

Numbers and the full per-candidate table: `benchmarks/RESULTS-block4-vitasilk.md`.
Review page: `benchmarks/results/latest-cutouts/vitasilk/index.html`, grouped
by slot with each idea above its candidates (`npm run plan-page`).

**`test-1` was not run.** One fixture meets the DoD and a second reel buys no
DoD item.

## Block 4 session 7 — closed out, $0.00 spent

Ledger 105 entries / $10.555772 / sha `a7e85e4b…` at both ends, byte-identical.

**`edge_halo` compares against the original image now.** It measured alpha
outside the subject and could not tell a rim the model rendered from
background the remover retained. A ring pixel bright in the source
(luminance ≥ `RENDERED_LIGHT_LUMA = 0.5`) is rendered light and is excluded;
dark in the source but carrying alpha is retained background and counts. The
boundary was declared before measuring, at the midpoint of the range, and the
gap is wide — #1A0000 is 0.022 and #F8F6F2 is 0.965. **No threshold changed.**

**The fix changed nothing, and the reason is the finding.** Zero of sixteen
gate verdicts moved. The ring's median luminance is 0.022 and **no pixel in
any measured ring reaches the boundary** — the alpha there is genuinely
retained background. The rendered rim is real but sits **inside the solid
mask**, where the remover correctly keeps it: `gemini-3-pro-image-1` has
inside-edge luminance **0.921** against a core of 0.079 and an outside ring of
0.031. Two different things were conflated. **The halo failures are real
halo**, so raising the bound would admit real defects rather than rescue
correct renders. Both facts are asserted in the suite, not left as prose.
Numbers: `benchmarks/RESULTS-block4-halo.md`.

**The bound decides at the fifth decimal.** `img005-c1` passes by 43 parts in
a million (0.0999574); `img001-c1` fails by 422 (0.1004224). Five of sixteen
images sit within 0.35% of it. Nothing was moved — refitting to sixteen images
from two reels is not evidence — but a gate whose outcome turns on the fifth
decimal is reporting a coin-flip as a verdict.

**Session 6's halo count was wrong**: five candidates fail on halo, not six,
and **four fail on halo alone** (img004-c2 fails `hole_ratio` regardless). The
three stated reasons summed to 10 against 8 failing candidates by
double-counting. Attributing the failures to the v5 lighting prune was a
hypothesis stated as a measurement — these ten span five slots with different
subjects while the clean corpus was six images of one slot.

**A slot idea must depict one subject** (`checkSlotIdea` in `core/src/mode.ts`,
thrown as `MultiSubjectIdeaError` from `planSlots`). `img005`'s shelf idea
contradicted the mode's own `one subject, centred and unobstructed` and failed
three ways at once — the gate read the extra objects as matte noise, the model
wrote 47 invented label words, and the matte was unusable. A **hard failure at
plan time naming the slot**, never a rewrite: the planner is what needs to
change. Flags **img003 and img005** on vitasilk, **nothing on test-1**.
Neither idea was edited and nothing was re-planned. The marker list is
enumerated and **incomplete by construction** — it misses
`scientific molecular structures`, and the doc comment says so.

**The plan records cumulative spend.** `costs.spentUsd` and
`costs.spentByStage` accumulate across runs — a cached run adds nothing, a
regenerated slot **adds** rather than replaces, so the figure can exceed one
clean run because the money really was spent. Named `spent` rather than `cost`
for that reason. `byStage` stays as it was, holding the **last** run's cost,
because session 6 valued its diffability. Both written through
`recordStageSpend` so they cannot drift, and applied to transcription too.
Slot planning now writes `imageSlots`, not `images` — sharing a bucket with
image generation made a cumulative total meaningless.

**The ledger has no reel identifier**, so cumulative per-reel spend can only
accumulate forward. `vitasilk`'s `spentUsd` was backfilled to **$1.550444**,
the ten production lines, which is the only precisely attributable figure;
transcription and analysis stay absent, and absent means unknown rather than
zero.

**Decision docs are tested against their constants**
(`service/src/decisions.test.ts`). It caught real drift on its first run:
`DECISION-transcription-config.md` recorded `ACTIVE_PROMPT_VERSION = 3` while
the code has run 4 since Block 3 session 6.

### Block 4 is complete

| | |
|---|---|
| block image spend | **$2.999713** over 21 billed images |
| of which wasted | **$0.514522** (17.2%), all session 3's eviction defect |
| all-time ledger | **$10.555772** over 105 entries |
| per five-slot reel | **~$1.71** (images $1.55 + transcription $0.16), inside PROJECT_SPEC §5's $0.50–2.00 |

Amendment sweep for the handoff: `docs/BLOCK4-AMENDMENTS.md` — every
amendment with its doc and section, verified against the repo, plus the twelve
schema additions (all optional with a default) and what is left open.

**Still open and needing a ruling, not a fix:** the gate's yield is 2/10, the
four halo-alone failures are genuine, and the bound is deciding at the fifth
decimal. `no watermark` and `no logo` have never been tested as controls.

## Block 5 session 1 — frame sampling and person segmentation

**Spent $0.00; no API was called.** Ledger 105 entries / $10.555772 /
sha `a7e85e4b…` at both ends, byte-identical.

**Frame sampling reads real presentation timestamps.** `service/src/frames/`
is the new stage: `sample.ts`, `segment.ts`, `footage.ts` and two CLIs. The
reels are 30000/1001, so the sample grid and the real timestamps diverge from
the second frame onward — sample 1 is at **0.5005 s**, not 0.5 — and the
divergence grows through a reel. Selection is a `select` expression with
`-fps_mode passthrough` rather than the `fps` filter, because `fps` resamples
onto its own grid and synthesises a timestamp for every frame it emits;
showinfo's `pts_time` is then the frame's own. `frames.json` records
`timestamps: "pts" | "nominal"` so a fallback cannot be mistaken for a
measurement. All five reels sampled at `pts`.

**231 frames across the five reels**, all 2160x3840 sources at an exact
quarter scale to 540x960. Per reel: test-1 44, test-2 45, test-3 43,
ground-truth 47, vitasilk 52.

**`segment_person` is MediaPipe's `selfie_multiclass_256x256`**, pinned by
sha256 in `tools/cv/models.json` and verified by `npm run check`. The person
mask is the union of all five non-background categories, which is what a
placement solver needs: hair, clothes and a held bottle occlude a zone exactly
as skin does. Two PNGs per frame — the raw 8-bit confidence mask and the
binary mask at 0.5. **Keeping the confidence is deliberate**: a threshold is a
decision that will be revisited, and re-running segmentation to try 0.4 would
mean re-reading every frame of every reel.

**No dilation and no smoothing.** The mask that gets judged is the mask the
model produced; a safety margin around a subject is a separate, measured
change.

**All five reels segmented, 35.2 s total, 0 null bounding boxes.**
personPixelRatio min/median/max: ground-truth 0.174/0.208/0.241, test-1
0.246/0.261/0.266, test-2 0.202/0.238/0.257, test-3 0.250/0.257/0.273,
vitasilk 0.346/0.461/0.498. Nothing degenerate; vitasilk is higher because it
is framed tighter.

**Segmentation is bit-identical across runs**, measured rather than assumed:
test-1 re-segmented, 88 of 88 mask files matched by sha256, 0 differing. One
reel only.

**138 of 231 frames carry more than one connected component** — up to 18 on
vitasilk. The specks are tiny (median 0.03% of mask pixels, worst 2.1%) but
`person_stats` boxes **every** component, so a speck moves a box edge by up to
**0.052 of the frame** on the worst frame (median 0.000, 90th percentile
0.028). Whether the box should follow the largest component instead is a
Block 5 session 2 decision; nothing was changed here, because narrowing the
box is exactly the kind of silent repair the raw mask is meant to expose.

Debug renders: `benchmarks/results/latest-segmentation/<reel>-contactsheet.png`
and six `<reel>-frame-<index>.png` per reel, mask tinted at 40%. They contain
footage and are covered by the pre-existing `benchmarks/results/` ignore.

**Not done and not attempted this session:** zone computation, the placement
solver, and any Edit Plan schema change. No plan was read or written.

## Block 5 session 2 — zones

**Spent $0.00; no API was called.** Ledger 105 entries / $10.555772 /
sha `a7e85e4b…` at both ends, byte-identical.

**Zones are derived from the mask, never from the bounding box.** Session 1
measured person pixels at ~0.25 of the frame against a median bounding box of
~0.64 of it: the subject fills about two-fifths of its own box, and the rest is
negative space beside the head and between the arms. A box-derived left or
right zone would throw that away. `person_stats`' bbox stays reported metadata
and is not an input to zone derivation.

**MediaPipe Image Segmenter is frozen for this project.** The user reviewed all
five contact sheets and ruled the masks accurate. YOLO11-seg is assessed and
rejected and **ultralytics must not be installed**; ARCHITECTURE §1.4 named it
as the fallback and that is now closed.

**`tools/cv/framopia_cv/zones.py`** holds the whole derivation, and every
constant in it is **chosen, not measured**:

| constant | value | why |
|---|---|---|
| `PERSON_COMPONENT_FLOOR` | 0.0001 of frame | 52 px at 540x960, under any limb at this size; set from the corpus distribution, the cut itself chosen |
| `ZONE_MARGIN` | 0.02 | clearance so a zone never abuts the subject |
| `MIN_ZONE_AREA` | 0.03 | below this a zone is worse than none, because the solver would treat it as a real option |
| `BOTTOM_EXCLUSION` | 0.15 | the mask under-covers low-contrast fabric there and an unselected pixel reads as free space |
| `LATERAL_INSET` / `VERTICAL_INSET` | 0.03 / 0.05 | no zone runs into the frame border |
| `OPEN_SAMPLES` / `CLOSE_SAMPLES` | 2 / 1 | opening is slow, closing is eager |

**The component floor is validated by a render, not by the histogram.** The
non-largest component distribution decays smoothly from 1 px with **no natural
gap**, so the cut is a judgement: 444 non-largest components across 231 frames,
median 0.000015 of frame, p90 0.00022, max 0.00583. **No non-largest component
anywhere in the corpus reaches 1% of the frame.** The largest component the
floor actually drops is **ground-truth frame 29 at 0.000098 of frame**, and the
twelve worst-case renders show every dropped component to be a hem fragment at
the very bottom edge — inside `BOTTOM_EXCLUSION` in any case. **No hand or limb
is dropped anywhere in the corpus.**

**Occupancy is read per row and per column over the span each zone covers**,
never from a bounding box. A skirt flaring left inside the excluded band does
not kill the left zone, because the left zone does not reach there.

**All five reels yield zones, on every sample.** Zero empty samples across 231
frames; four reels give top, left and right, vitasilk gives top and left only.
Each reel produced exactly one window per kind spanning the whole reel — the
footage is a fixed camera on a seated or standing speaker, so the hysteresis
never had a dropout to absorb. **The reduction is therefore live but
unexercised on real input**, and only the unit tests show it opening and
closing.

| reel | top area | left area | right area | valid s / kind | wall clock |
|---|---|---|---|---|---|
| test-1 | 0.2348 | 0.1351 | 0.1277 | 21.52 | 0.4 s |
| test-2 | 0.2377 | 0.1973 | 0.1470 | 22.02 | 0.4 s |
| test-3 | 0.2818 | 0.0936 | 0.1321 | 21.02 | 0.3 s |
| ground-truth | 0.2456 | 0.1973 | 0.1055 | 23.02 | 0.4 s |
| vitasilk | 0.1340 | 0.0418 | none | 25.53 | 0.5 s |

**`BOTTOM_EXCLUSION` costs nothing in validity.** Measured against the same
derivation at 0.0: **0.0% of total valid seconds removed on all five reels.**
It changes rectangle heights, not whether a zone exists.

**The bottom 15% of the frame is not generally under-covered.** Mean mask
coverage there runs 0.21–0.64 against 0.21–0.42 over the rest — **higher, not
lower, on every reel** — and occupied rows in the band are 100% on four reels
and 88.3% on ground-truth, which is the only reel with a frame under 50%. The
dress defect the exclusion guards against is one reel and a few rows, not a
corpus-wide gap. Reported, not acted on.

**The threshold barely matters.** Re-deriving from the stored confidence masks
at 0.4 and 0.6 changed **zone count not at all and total valid seconds not at
all** — 0.0% on every reel at both. Mean rect area moved −4.2% to +1.7%, the
largest being vitasilk's thin left strip. Re-thresholding the confidence mask
at 0.5 reproduces the stored binary masks **exactly**, on all five reels. This
was a sensitivity measurement; **no default changed and no threshold is
recommended.**

**Known geometric gap: `MIN_ZONE_AREA` does not capture usability.** vitasilk's
left zone is 0.052 wide by 0.800 tall — area 0.042, over the 0.03 floor, but a
strip no square image fits. A minimum dimension or an aspect bound is missing
and is the solver session's problem. **Zones may also overlap each other** (top
overlaps left and right in the frame corners); they are independent candidates
and non-overlap is the solver's job, per ARCHITECTURE §5.5.

Debug output: `benchmarks/results/latest-zones/<reel>-contactsheet.png`,
six `<reel>-frame-<index>.png` and `<reel>-timeline.png` per reel;
`benchmarks/results/latest-components/` for the floor renders. Both covered by
the pre-existing `benchmarks/results/` ignore.

**Not done and not attempted:** the placement solver, any Edit Plan read or
write, and any schema change. Zones exist only as `zones.json` beside the masks.

## Block 5 session 3 — the short-edge predicate, zones on the plan

**Spent $0.00; no API was called.** Ledger 105 entries / $10.555772 /
sha `a7e85e4b…` at both ends, byte-identical.

**`MIN_ZONE_AREA` is gone, replaced by `MIN_ZONE_SHORT_EDGE = 0.15` of frame
width (324 px of 2160).** Generated images are 1:1, so the largest square a
zone can hold is bounded by its short edge alone; area let one long dimension
pay for a fatally short one, and vitasilk's 0.052 x 0.800 left zone cleared a
0.03 area floor at **113 px wide**. The two are not kept as an AND: a 324x324
region is area 0.0127, under the old floor, and is exactly what the predicate
must admit. **CHOSEN, NOT MEASURED.**

**Normalized units are anisotropic and the constant names its basis.** The
frames are 2160x3840, so `w` is a fraction of 2160 and `h` of 3840; the short
edge is compared in units of frame **width**, converting `h` through the aspect
ratio. A bare `min(w, h)` would have been wrong by 1.78x on one axis.

**The predicate re-cuts windows rather than deleting zones**, because it is
applied per frame before the temporal reduction. Two reels gained a zone:

| reel | under area (0.03) | under short edge (0.15) |
|---|---|---|
| test-1 | 3 zones, 64.56 s | unchanged |
| test-2 | 3 zones, 66.07 s | unchanged |
| test-3 | left 253 px, 21.02 s | left **449 px**, two windows, 20.02 s |
| ground-truth | right 285 px, 23.02 s | right **393/437 px**, two windows, 22.02 s |
| vitasilk | left 113 px, 25.53 s | left **361 px**, one window, **1.00 s** |

Every emitted zone now has a short edge of at least 345 px; the old set ran
down to 113 px.

**This is the first time hysteresis has opened and closed on real footage.**
Session 2 recorded the reduction as live but unexercised — every reel gave one
unbroken window. Under the new predicate a zone narrows below the floor
mid-reel and the window splits, on test-3 and ground-truth.

**vitasilk has effectively one usable zone against five image slots**: top for
the whole 25.53 s, plus a left zone valid for 1.00 s. Its total valid seconds
fall 51.05 → 26.53. **Session 4's solver has to handle a reel with fewer zones
than slots**, and this is not a defect in the predicate — the subject fills the
frame below the head.

**`BOTTOM_EXCLUSION`'s recorded reason was wrong and is corrected.** It was
written as compensation for a mask that under-covers low-contrast fabric;
session 2 measured coverage in that band as *higher* than over the rest of the
frame on all five reels, which refutes it. It is a **product rule** — no image
is ever placed at the bottom of a 9:16 frame — and the comment now says that
and nothing else. It still costs 0.0% of valid seconds.

**`CLOSE_SAMPLES` stays 1**, ruled. The asymmetry is deliberately in the
direction of not placing an image: a closed zone costs a placement
opportunity, a zone left open through a real intrusion puts a generated image
on a hand. The `close_samples=2` test is kept as documentation of the
alternative.

### Zones on the Edit Plan

**The `zones` container already existed** in ARCHITECTURE §3 and in
`createEditPlan`, and every plan carries `{ sampleFps: 2, zones: [] }`. What
this session added is **item** validation, which cannot make an older plan
unopenable because there are no items in one to reject. **Proven, not
asserted:** all five plans reopened through `readEditPlan` after the change —
vitasilk 73 words / 5 slots / 3 keywords / 41 groups, test-1 67 / 4 / 3 / 38,
and the three transcription-only plans intact.

`service/src/frames/plan-zones.ts` holds the writer. Writing zones onto
vitasilk changed exactly **three top-level keys: `meta`, `pipeline`, `zones`**
— none added, none removed, and every other key byte-identical. It does not
route through any cache API.

**Manual zones are ground truth and survive a recomputation byte-identical.**
`mergeZones` replaces the automatic zones and carries every `manual: true` one
across by reference, listing them first. A computed zone whose id a manual zone
claims is **dropped rather than renamed**, because the id is what the panel and
the solver refer to. Proven end to end on vitasilk through the live service: a
manual right zone was set, zone computation re-run, and the manual zone came
back identical while the two automatic zones were refreshed.

**Service endpoints**, following the existing token-auth and `{ error }`
conventions: `POST /zones/manual` with `{ planPath, zone }`, and
`DELETE /zones/manual?planPath=&zoneId=`. The set route forces `manual: true`
whatever the caller sends. Refusing to clear a non-manual zone is a 400, an
out-of-frame rect is a 400, an unreadable plan is a 404, no token is a 401 —
all four exercised live.

A manual zone is deliberately allowed to break `MIN_ZONE_SHORT_EDGE`: the
predicate exists to stop the *derivation* offering an unusable rectangle, and
an editor who places one anyway has decided something the derivation cannot.

Debug output gained `benchmarks/results/latest-zones/<reel>-shortedge.png`, one
frame per reel with each zone's short edge dimensioned and labelled in source
pixels, so the constant is judged by eye rather than from a table.

**Not done and not attempted:** the placement solver, jitter, and
slot-to-zone assignment. Session 4.

## Block 5 session 4 — the placement solver

**Spent $0.00; no API was called.** Ledger 105 entries / $10.555772 /
sha `a7e85e4b…` at both ends, byte-identical.

**Block 5's DoD is NOT met: `test-1` slot `img004` is unplaceable.** It spans
19.719-21.940 s; every test-1 zone's validity window ends at **21.5215 s**,
which is the last sampled frame. The reel is 21.9886 s, so the slot needs the
zone free for **0.4185 s past the last observation**, inside a **0.4671 s
unobserved tail**. The solver throws `UnplaceableSlotError` and writes nothing.
This was not worked around: extending a window to the reel end would invent
validity for an interval nobody sampled. **It is the user's call** — sample the
final frame, extend the last window by one sample interval, or shorten the
slot.

**`SUBTITLE_BAND` is declared once, in `service/src/placement/constants.ts`,
and is PROVISIONAL.** PROJECT_SPEC §5 fixes the subtitle position as global but
no document states its coordinates. Full frame width, 600 px tall per
TEMPLATE_LIBRARY_GUIDE §3's 2160x600 subtitle comps, centred at 0.75 of frame
height — normalized y **0.671875 to 0.828125**. **CHOSEN, NOT MEASURED.** Block
6 replaces it when templates are built; changing it is one edit.

**Keywords need no exclusion of their own on current evidence.** Keyword
templates place at the emphasized word's subtitle position
(TEMPLATE_LIBRARY_GUIDE §6), so a keyword occupies the subtitle band.
`KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` records the assumption in code. **A keyword
template declaring an offset breaks it and Block 6 must know.**

**Card and cutout footprints differ and are not collapsed.** A card is a framed
image with a visible border, so it is inset from the zone edge
(`CARD_EDGE_CLEARANCE = 0.02` of frame width, 43 px); a cutout's edge is the
subject's own silhouette, meant to sit against the background, so
`CUTOUT_EDGE_CLEARANCE = 0`. Both CHOSEN, NOT MEASURED. Measured on vitasilk:
the one cutout placed at **508 px** against cards at 390-430 px in the same
zone. **A slot whose presentation is still null is treated as a card**, the
more demanding footprint, because the gate sets it only when every candidate
agrees.

**Jitter cannot leave its region by construction, not by a clamp.** The square's
side is drawn first, then its position is drawn from the travel the side leaves
inside the safe region — so there is nothing to clamp. The result is still
re-validated against every hard constraint. A test drives 200 seeds through a
zone sized to the minimum and asserts every rect stays inside the zone, the
frame, the subtitle band and the bottom exclusion.

**Determinism proven, not asserted**: two runs on vitasilk produced
byte-identical output, sha `e57df93a…` both times. The seed is
`meta.id:slot.id`, on the Block 3 `assign.ts` sha256-chain precedent.

**The time-overlap constraint never fired.** Neither fixture has two slots
overlapping in time — ARCHITECTURE §5.3 plans non-overlapping windows — so the
rule is implemented and unit-tested but **unexercised on real data**.

### vitasilk: five slots, one usable zone

All five land in `z_top_1`, whose rect is **(65, 0, 2030, 547) source px** —
reported here for the first time. The left zone's only window is
[7.007, 8.008] s and contains no slot's span.

| slot | zone | presentation | pos x | pos y | scale | placed px |
|---|---|---|---|---|---|---|
| img001 | z_top_1 | card | 0.0521 | 0.0169 | 0.3580 | (113, 65) 430 sq |
| img002 | z_top_1 | cutout | 0.5766 | 0.0097 | 0.4230 | (1245, 37) 508 sq |
| img003 | z_top_1 | card | 0.6534 | 0.0128 | 0.3502 | (1411, 49) 420 sq |
| img004 | z_top_1 | card | 0.5541 | 0.0126 | 0.3375 | (1197, 48) 405 sq |
| img005 | z_top_1 | card | 0.1380 | 0.0119 | 0.3252 | (298, 46) 390 sq |

Horizontal spread is real — 1299 px across the frame. **Vertical spread is
28 px, effectively none**, because the zone is 547 px tall and the squares
nearly fill it. Scale spread is 30.1%. **Four of the ten pairs overlap
spatially**; all four are non-concurrent so it is legal, but the set is five
images in one horizontal band and whether it reads as designed is the user's
eye on `benchmarks/results/latest-placement/vitasilk-overview.png`.

**A tension the solver surfaced.** `MIN_ZONE_SHORT_EDGE` 0.15 admits a zone;
after card clearance and the 0.88 fill, the *placed* square is materially
smaller than the zone. The same 0.15 is applied here to the placed rect
(`MIN_PLACED_SHORT_EDGE`), which is what the constant's stated reason describes,
and on that basis **test-1's 345 px and 365 px side zones cannot hold a card**.
The zone predicate and the placement footprint disagree about what 0.15 means
and it needs a ruling.

`service/src/placement/` — `constants.ts`, `geometry.ts`, `solve.ts`,
`plan-placement.ts`, `place-cli.ts`. `ImageSlot.position` and `ImageSlot.scale`
are **schema additions, optional with a default**; all five plans reopen.
Writing placements onto vitasilk changed exactly `meta`, `pipeline`, `images`,
and within a slot only `zoneId` changed with `position` and `scale` added. A
test parses `zones.py` and fails if the mirrored `BOTTOM_EXCLUSION` or
`MIN_ZONE_SHORT_EDGE` drift.

## Block 5 session 5 — final frames, maximal rectangles, head masks

**Spent $0.00; no API was called.** Ledger 105 entries / $10.555772 /
sha `a7e85e4b…` at both ends, byte-identical.

**Every reel's last decodable frame is now sampled**, appended outside the 2 fps
grid and flagged `final: true` in `frames.json`. It is found by seeking
(`-sseof -1 -copyts`) and decoding, not by trusting a container's frame count.
It is named `frame-final.png`, never numbered, so a stale file can never be
swept into the `frame-NNNN.png` grid list and desynchronise showinfo's
timestamps from the files they describe.

| reel | last grid | final frame | gap closed | tail left |
|---|---|---|---|---|
| test-1 | 21.5215 | 21.9553 | 0.4338 | 0.0334 |
| test-2 | 22.0220 | 22.2889 | 0.2669 | 0.0334 |
| test-3 | 21.0210 | 21.1545 | 0.1335 | 0.0334 |
| ground-truth | 23.0230 | 23.2232 | 0.2002 | 0.0334 |
| vitasilk | 25.5255 | 25.6590 | 0.1335 | 0.0334 |

The 0.0334 s left over is one frame at 29.97 fps — the last frame's own
duration, so nothing is unobserved. **`test-1` `img004` (19.719-21.940 s) is now
contained** and places.

**The 231 pre-existing frames were reproduced byte-identically** by the
`--force` resample, and the 462 pre-existing masks were never rewritten at all:
`_write_or_verify` verifies an existing mask against the model's fresh output
and writes only new files. All 472 comparisons matched, which re-verifies
session 1's determinism claim without risking the evidence.

**The top-zone shortfall was diagnosed before anything was changed**, and both
hypotheses hold:

- **The intersection over a window is governed by its worst frame.** vitasilk's
  per-frame top rectangle runs min 547 px, **median 879**, p90 970, max 1015 —
  and **one frame, index 14 at 7.007 s, sets 547 for the whole 25.53 s window**
  while 34 of 53 frames exceed 800 px. The other four reels have a median-minus-
  minimum of 12-16 px, so intersection costs them nothing.
- **The three fixed kinds are structurally blind to the region beside the head
  and above the shoulders.** Free-area coverage on the median frame: 0.76-0.82
  on four reels but **0.47 on vitasilk**, whose right rectangle captures nothing
  at all.

**The three-rectangle decomposition is replaced by maximal free rectangles**
(`tools/cv/framopia_cv/rects.py`), the default for `compute_zones`; `--method
three` keeps the old one selectable because every Block 5 figure before this
session was measured with it. Largest-rectangle-under-histogram with a
monotonic stack per row, objective changed from **area to `min(width, height)`**
— the grid is isotropic and area rewards a strip no square image fits.
Extraction is greedy: take the best, mark it occupied, repeat.

`kind` is now a **label derived from position**, not the thing that defines the
rectangle: `top` above the person's topmost row, `left`/`right` beside the
columns the person occupies **within the rectangle's own rows**, which is what
puts the beside-the-head region on a side instead of nowhere. A rectangle
fitting none returns None and is dropped — ARCHITECTURE §3's enum is
`top|left|right` and no fourth value was invented.

**New constants, all CHOSEN NOT MEASURED**: `GRID_DOWNSAMPLE = 4` (a cell is 16
source px, well under ZONE_MARGIN's 43), `MAX_ZONES_PER_FRAME = 4`,
`MATCH_MIN_IOU = 0.5`. **The matching rule is a new decision**: rectangles found
by position carry no identity across frames, so a frame's rectangle joins the
track whose last rectangle it overlaps most by intersection over union, and one
matching nothing starts a new track. The fixed kinds matched implicitly.

| reel | method | zones | largest square | valid s | coverage |
|---|---|---|---|---|---|
| test-1 | three | 3 | 959 | 65.87 | 0.8202 |
| test-1 | **maximal** | **18** | 959 | **79.31** | 0.5357 |
| test-2 | three | 3 | 971 | 66.87 | 0.8064 |
| test-2 | **maximal** | **19** | **1023** | **76.14** | 0.5941 |
| test-3 | three | 4 | 1151 | 62.46 | 0.8067 |
| test-3 | **maximal** | **7** | **1184** | **78.61** | 0.6735 |
| ground-truth | three | 4 | 1003 | 68.67 | 0.7599 |
| ground-truth | **maximal** | **7** | **1007** | **90.39** | 0.5730 |
| vitasilk | three | 2 | 547 | 26.66 | 0.4702 |
| vitasilk | **maximal** | **20** | **816** | **83.12** | **0.6563** |

**Zone count rose on every reel**, so no stop condition. **vitasilk's largest
square goes 547 → 816 px** and **test-1's side zones go 345/365 → 624-656 px**,
because a maximal rectangle is bounded by the person only where it actually
sits, not by the widest point of the arms over the whole frame height.

**Coverage fell on four of five reels**, and that is not a defect being hidden:
the old side rectangles spanned the full frame height and counted a great deal
of area they could never hold a square in, while the new ones are capped at
`MAX_ZONES_PER_FRAME` and do not overlap each other. Coverage is a diagnostic
here, not the objective.

**Placement improves markedly.** vitasilk's five slots now spread across **four
zones** at 344-742 px instead of all five in one zone at 390-508 px; test-1's
four slots across three zones at 488-793 px. **test-1 `img004` places.**

**Head masks exist, as data only** — `<stem>-head.png`, hair plus face skin,
8-bit confidence, 236 written. No torso zone, no new zone kind, no placement
change, no schema change from it. Long hair counts as head, which over-excludes
and is the safe direction: an image over a chin is a defect.

| reel | head/frame min | median | max | head bottom y min | median | max |
|---|---|---|---|---|---|---|
| test-1 | 0.0190 | 0.0211 | 0.0224 | 0.4104 | 0.4146 | 0.4208 |
| test-2 | 0.0165 | 0.0200 | 0.0220 | 0.4042 | 0.4156 | 0.4229 |
| test-3 | 0.0249 | 0.0295 | 0.0315 | 0.5073 | 0.5177 | 0.5240 |
| ground-truth | 0.0149 | 0.0170 | 0.0179 | 0.4073 | 0.4125 | 0.4167 |
| vitasilk | 0.0701 | 0.0893 | 0.1018 | 0.5854 | 0.6583 | **0.8510** |

The head bottom edge is the upper bound of any future torso zone. **vitasilk's
reaches 0.851** on one frame — long hair over the shoulders — which leaves
almost nothing between it and `BOTTOM_EXCLUSION` at 0.85. A torso zone on that
reel may not exist at all.

Head coverage was checked by eye on
`benchmarks/results/latest-head/<reel>-contactsheet.png`: hair, face and glasses
are fully covered on every frame of ground-truth and vitasilk, with no thin or
partial heads.

## Block 5 is complete — session 6 built torso zones

**Spent $0.00; no API was called.** Ledger 105 entries / $10.555772 /
sha `a7e85e4b…` at both ends, byte-identical. All 944 frames and masks
byte-identical; none added, none removed.

**An image may be placed over the speaker's middle-to-lower torso, never over
the head or face.** A deliberate departure from PROJECT_SPEC §4 and
ARCHITECTURE §5.5, both of which place images only in negative space. The
user's reason: mid-to-lower torso is dead visual weight in a talking-head reel
and an image there reads as deliberate composition.

**`kind` gains a fourth value, `torso`** — a widening of ARCHITECTURE §3's
`top|left|right`. A widening cannot be optional-with-default the way a new
field can, so **all five plans were reopened to prove it**: vitasilk 73 words /
5 slots / 20 zones, test-1 67 / 4 / 18, test-2 69 / 0 / 19, test-3 58 / 0 / 7,
ground-truth 76 / 0 / 7. The widening also had to reach `assertPlaceable` in
`plan-zones.ts`, which carried its own hardcoded list and rejected a manual
torso zone until it was pointed at `ZONE_KINDS`.

**A torso zone is bounded** above by the lowest head pixel plus
`HEAD_CLEARANCE`, below by whichever of `BOTTOM_EXCLUSION` and `SUBTITLE_BAND`
sits higher in the frame — the band, at 0.6719 against 0.85 — and **laterally
by where the body IS**, taking the person's own column extent within its rows.
The narrow side of that boundary is deliberate: a rectangle inside the body on
every frame reads as placed on the speaker, one overhanging the background
reads as a mistake.

**New constants, both CHOSEN NOT MEASURED**: `HEAD_THRESHOLD = 0.25` and
`HEAD_CLEARANCE = 0.04` of frame width (86 px). The head mask is a confidence
map and the body mask's 0.5 trims exactly the low-confidence pixels at hair
edges and jaw boundaries, which is where under-coverage would come from.
`SUBTITLE_BAND` is **passed into the sidecar**, not mirrored: it is declared
once in `service/src/placement/constants.ts` and a second copy would drift.

**Ruling 3 holds by property, not by mechanism.** A frame whose head drops
lower either shrinks its window's intersected rectangle or fails the IoU match
and splits the window in two; in both cases **no emitted rectangle overlaps a
head pixel on any frame it claims**. Never a median, never a percentile. A test
asserts the property rather than the path.

| reel | torso zones | longest window | its rect (px) | largest square | bounded by |
|---|---|---|---|---|---|
| ground-truth | 4 | 4.50 s | (744, 1682, 840, 898) | 872 px | frame 17, 8.508 s, head 0.4156 |
| test-1 | 6 | 4.50 s | (640, 1694, 936, 886) | 894 px | frame 32, 16.016 s, head 0.4188 |
| test-2 | 10 | 5.00 s | (704, 1906, 900, 674) | 894 px | frame 1, 0.500 s, head 0.4740 |
| test-3 | 9 | 4.00 s | (548, 2098, 1116, 482) | 514 px | frame 19, 9.509 s, head 0.5240 |
| **vitasilk** | **0** | — | — | — | — |

**vitasilk gets no torso zone and that is the correct outcome**, ruled in
advance. Its head mask reaches y **0.9510** at frame 12 (6.006 s) — long hair
over the shoulders — and **48 of its 53 frames have a head that alone blocks the
whole band**. Nothing was relaxed to produce one.

**What `HEAD_THRESHOLD = 0.25` costs is contiguity, not size.** Against 0.5 the
largest square is 3-7% **larger** at 0.25 on every reel, because shorter windows
intersect fewer frames. What it costs is validity: a single 21-23 s window at
0.5 becomes 4-10 windows totalling 10-14 s, longest 4-5 s. The constant stays
at 0.25.

**`TORSO_ZONE_IS_LAST_RESORT = true`** — torso zones are tried only after every
background zone that fits, because the spec says negative space and this is a
departure taken only when negative space does not serve. **Whether a cutout or
a card sits better over a body is undecided**: with torso last-resort a slot
only reaches one when nothing else fits, and refusing it there on presentation
grounds would leave the slot unplaced. The user's eye on a built comp in Block 7
decides it.

**Both fixtures place fully: vitasilk 5 of 5, test-1 4 of 4**, and **every slot
on both had more than one candidate zone** — so fragmentation costs no choice
for background zones. It costs every torso placement: test-1 has 6 torso zones
and **not one is valid long enough to contain a slot's span**.

**vitasilk's spread against session 4**, which is what the rework was for:

| | session 4 | now |
|---|---|---|
| x spread | 1299 px | 1289 px |
| **y spread** | **28 px** | **1230 px** |
| **scale spread** | **30.1%** | **115.5%** |

All spatial overlaps found are **non-concurrent and therefore legal** — two on
vitasilk, one on test-1. **Zero concurrent overlaps.**

### Block 5 definition of done — met

| item | verdict | evidence |
|---|---|---|
| computed zones visibly avoid the speaker on real footage | **yes** | user reviewed the reworked zone renders and the head contact sheets on all five reels this conversation |
| the solver places all fixture slots without overlaps | **yes** | 5/5 and 4/4; every overlap non-concurrent |
| manual override round-trips | **yes** | a `torso`-kind manual zone survived recomputation byte-identical, listed first, with 24 automatic zones refreshed around it |

## Block 6 session 1 — the timing budget, before any comp is animated

**Spent $0.00; no API was called.** Ledger 105 entries / sha `a7e85e4b…` at
both ends, byte-identical. No plan on disk was modified.

`service/src/analysis/timing-budget.ts` sweeps every reel against
intro+outro ∈ {0.13, 0.20, 0.27, 0.33, 0.40} s (4, 6, 8, 10, 12 frames at
29.97) × minHold ∈ {0.10, 0.15, 0.20, 0.25, 0.30} s. It **reuses**
`checkBuildability` and `applyDisplayTiming` rather than reimplementing either:
both already take a caller-supplied templates map, so a synthetic template
carrying the candidate triple is all that is needed. Only the sum
intro + minHold + outro is ever compared, so how a budget splits between intro
and outro changes nothing.

**Display timing is re-derived from speech timings for every cell.** Reading
the stored `displayStart`/`displayEnd` would measure the stub manifest's floor
instead of the budget under test. In fact **no plan currently stores display
timing at all** — `groupsWithDisplayTiming` is 0 on all five — so
`displayWindow` has been falling back to speech timings everywhere.

**No swept budget makes every subtitle group buildable.** The best cell is the
loosest, intro+outro 0.13 s with minHold 0.10 s (floor 0.23 s), at **176 of 182
groups (97%)**. Against the stub's current 0.33 s floor the corpus is at 86%.

| intro+outro | 0.10 | 0.15 | 0.20 | 0.25 | 0.30 |
|---|---|---|---|---|---|
| 0.13 s (4f) | **97%** | 93% | 86% | 81% | 74% |
| 0.20 s (6f) | 92% | 84% | 78% | 72% | 66% |
| 0.27 s (8f) | 81% | 77% | 67% | 63% | 55% |
| 0.33 s (10f) | 74% | 67% | 62% | 55% | 47% |
| 0.40 s (12f) | 66% | 57% | 53% | 43% | 35% |

**Two structural findings decide how to read that.** The merge rescue barely
fires — 20 merges in 20 of 125 reel-cells, **0 at the loosest budget** — because
it merges only when a pair totals two words or fewer and grouping has already
paired words wherever it could. And **silence is the scarce resource**: the
pooled median gap after a group is **0.059 s** and the p10 is **0.020 s**, so a
card can rarely be held more than hundredths of a second past its words. Pooled
group speech duration is min 0.000 · p10 0.241 · median 0.520 · max 1.260 s.

Two of the six failures at the loosest budget are **degenerate word timings**,
not display problems: vitasilk `g017` "mn" has a speech duration of **0.000 s**
and test-1 `g007` "tb3i m3aya" of 0.030 s. `findShortWords` already reports
them as Block 2 alignment artifacts; no intro or outro choice rescues them.

**The corpus is not single-script.** A scan of all five plans found **10
subtitle groups mixing Latin and Arabic script within one 1–2 word group** —
ground-truth 2, test-1 6, test-2 1, test-3 1, vitasilk 0 — and **1 of 3
keyword spans on test-1 is mixed-script** (`k003` "jawdat البشرة"), with 2 of 3
wholly Arabic. **A single-script subtitle or keyword template contract does not
stand.** Image slots: vitasilk 1 cutout / 4 card, test-1 4 null.

Panel and real job types are not started; templates exist only as a stub.

## Block 6 session 2 — script-aware grouping, blocked

**Spent $0.00.** Ledger 105 entries / sha `a7e85e4b…` at both ends. Nothing was
changed: no source file, no plan, no constant.

The user ruled that **a subtitle group never mixes scripts**, and grouping was
to become script-aware. The session stopped at that goal because the second
half of the rule — an Arabic-script run that is one §6 term groups whole even
past two words — **cannot be decided from plan data**.

`PlanWord` carries `script` and `lang` and nothing that marks a term.
§6's term-level rule makes a maximal Arabic run look like exactly one term,
because the function words around a term stay Arabizi. **test-2 refutes it**:
`w0030..w0037` is an eight-word Arabic run, uniformly `arabic`/`msa`, and it is
three terms — ORTHOGRAPHY_GUIDE line 87 lists `ترطيب عميق للبشرة` among its own
examples. Timing does not recover the boundaries either: one true boundary sits
at the run's largest internal gap (0.140 s) and the other at 0.060 s, which is
indistinguishable from the 0.061 and 0.060 gaps *inside* terms.

Run length does not discriminate — test-1's 3-runs **are** single terms. The
missing input is a term id per word, best emitted by the Gemini correction pass,
which applies §6 already and discards the structure. That is a prompt bump, so
it invalidates the transcription cache and costs money.

Session 1's findings stand unaddressed: 10 mixed-script groups, one mixed
keyword span, and test-1 `g031`/`g032` splitting `محفزات الكولاجين` across two
cards against §6c.

**Unrelated, observed and not chased:** in that same test-2 run `sourceText` is
offset by one against `text` (`w0030` is `text: ترطيب` / `sourceText: عميق`).
A Block 2 alignment provenance artifact; it touches nothing downstream.

## Block 6 session 3 — the real subtitle band

**Spent $0.00.** Ledger 105 entries / sha `a7e85e4b…` at both ends.

**`SUBTITLE_BAND` is derived now, not chosen.** Block 5's provisional guess —
full width, 600 px tall, centred at 0.75 of frame height, y 0.671875 to
0.828125 — is gone. The new band is **y 0.5147231771, h 0.2689751953**, or
**1976.54 to 3009.40 px**, and it is computed from the user's measured anchor
plus ink extents read out of the font files.

**Global subtitle typography lives in `core/src/typography.ts`**, on
PROJECT_SPEC §5's authority: "Global (not per-mode): subtitle position,
subtitle base style, SFX set." §5 named Inter Semi-Bold and left the Arabic
face as `TBD_ARABIC_FONT` "collected at the start of Block 6 and recorded here
by amendment" — this session collected it and amended §5. **Nothing was added
to the mode and no mode version was bumped, so no cache was invalidated.**
`modes/k2-syndicalia.json` stays at v5 with `fonts: { status: "tbd" }`,
because §5 line 75 reserves K2's own font identity for Block 9.

Anchor **(1080, 2480.4)**, `y` the **text baseline**; subtitle size 343,
keyword size 425, line spacing 323; Almarai Bold at **1.07x** the Latin size;
both tracks may wrap to two lines.

**The metrics are read, never estimated** — fontTools against
`~/Library/Fonts/Inter-VariableFont_opsz,wght.ttf` and
`~/Library/Fonts/Almarai-Bold.ttf`, using OS/2 usWinAscent/usWinDescent, the
font's own statement of maximum ink reach. Inter ships variable and Semi-Bold
is an instance; its MVAR varies only `xhgt, stro, strs, undo, unds` — no
vertical metric — and instantiating at wght=600 across both ends of the opsz
axis reproduces 2269/-660 exactly.

| face | upem | ascent | descent |
|---|---|---|---|
| Inter Semi-Bold | 2048 | 2269 | 660 |
| Almarai Bold | 1000 | 1108 | 453 |

**Almarai is the taller face in both directions** at the keyword size — 503.86
against 470.86 above the baseline, 206.00 against 136.96 below — so the band is
built on it. top = 2480.4 − 503.8630; bottom = 2480.4 + 323 + 206.0018.

**The one assumption**, stated in code at `EXTRA_LINES_RENDER_BELOW`: a second
line renders **below** the first, which is what an AE point-text layer anchored
at 0,0 does. If the templates grow upward instead, the band moves up by exactly
`LINE_SPACING` and nothing else changes.

**No placement moved.** Both fixtures re-solved byte-for-byte onto Block 5
session 6's recorded positions and scales — vitasilk 5 of 5, test-1 4 of 4 —
because every placement already sat far above either band. **No placed rect
intersects the old band or the new one**, so the "inside one but not the other"
question is empty on this corpus.

**The band eliminates every torso zone in the corpus, and that is the real
cost.** Torso zones are bounded below by `SUBTITLE_BAND.y`, which rose 603 px.
Re-bounded against the new top: ground-truth 898 → 295 px tall, test-1 886 →
283, test-2 674 → 71, and **test-3's starts below the new band top and ceases
to exist**. None survives `MIN_PLACED_SHORT_EDGE` after card clearance and the
0.88 fill. Block 5 session 6's four reels' worth of torso zones are dead on the
measured geometry. It costs no placement today — torso was last-resort and zero
of the nine placements used one — but the kind is now reachable only through a
manual zone.

**The zones stored on the plans are stale**, computed with the old band.
`npm run zones --write-plan` would refresh them; it was not run, because goal 2
scoped the writing to `npm run place`.

`npm run place` wrote only `meta` and `pipeline` on both fixtures; the other
three plans were untouched.

## Block 6 session 4 — the band measured from the real repertoire

**Spent $0.00.** Ledger 105 entries / sha `a7e85e4b…` at both ends.

**The band is measured from real glyph outlines now, not OS/2 usWin.**
`FONT_METRICS` in `core/src/typography.ts` holds Inter **1970/480** and Almarai
**1100/427**, against session 3's usWin 2269/660 and 1108/453. Extents come
from glyph bounding boxes through a pen, so composites resolve, following only
the layout features a shaper enables without an application opting in
(`ccmp locl rlig liga clig calt kern mark mkmk init medi fina isol curs rvrn
rclt`). **Stylistic sets are excluded** — AE does not enable them, and
including them put Inter's maximum on `zero.slash.circled`.

**`SUBTITLE_BAND` is y 0.5156705729, h 0.2649487630 — 1980.1750 to 2997.5783
px.** All three values it has ever held are in the comment.

**The answer to the question the session asked is NO.** The honest band is
**15.46 px shorter out of 1032.86, 1.50%**, and the top moves down only
**3.64 px**. **No reel recovers a usable torso zone**, and two more aggressive
readings fail too: dropping the Allah ligature (ascent 997) and corpus-only
(800) both leave every reel short. For test-1's torso to hold the minimum
square the band top would have to sit at 2180.6 px, implying a maximum ascent
of **659 Almarai units against the font's real 1100**. **The band was never the
cause — the anchor position is.** Record:
`benchmarks/RESULTS-block6-band-repertoire.md`.

**The corpus repertoire is 81 characters** across the five plans and four
references: 52 Latin, 26 Arabic, plus `è` and `é`. **Zero Arabic diacritics** —
nothing in U+064B–U+0652 or U+0670 anywhere, which is what §1 predicts. The
apostrophe is U+0027 straight throughout; no non-breaking space, no
presentation forms. **Five reels, one client, two speakers** — the Arabic set
is missing eleven letters that plainly can occur, which is why the band is not
measured from the corpus alone.

**The margin is the widening of the measured set, not a round number on top**:
every unvocalized Arabic letter in all four positional forms, Arabic
punctuation, printable ASCII, and §5's accented French. Worth **+300 Almarai
ascent units over corpus-only, 37.5%**. Almarai's ascent is the Allah ligature
ﷲ, absent from the corpus but permitted by §6(b).

**Full vocalization cannot exceed the band**, resolved from the font rather
than assumed: harakat outlines top at 747, Almarai's highest GPOS base anchor
is 407 against a highest mark anchor of 390, so an attached mark's ink is
bounded by **764 against 1100**.

**Torso zones are now 0 on every reel**, confirmed by re-deriving rather than
predicted: `npm run zones --all --write-plan` refreshed all five, and 29 torso
zones across four reels became none.

| reel | zones before | after | torso before | after |
|---|---|---|---|---|
| ground-truth | 11 | 7 | 4 | **0** |
| test-1 | 24 | 18 | 6 | **0** |
| test-2 | 29 | 19 | 10 | **0** |
| test-3 | 16 | 7 | 9 | **0** |
| vitasilk | 20 | 20 | 0 | 0 |

**No placement moved.** vitasilk 5/5 and test-1 4/4 re-solved onto the same
positions and scales for the third session running, and no slot became
unplaceable. `npm run place` was re-run **after** the zone refresh as well as
before, because placements reference zone ids.

**`torso` remains a valid `kind`** in the schema and in `assertPlaceable`; it
is now reachable only through a manual zone. Recovering it automatically needs
a product decision — the anchor, the keyword size,
`MIN_PLACED_SHORT_EDGE`, or the rule that images never overlap the band — not a
better measurement.

## Block 6 session 5 — torso retired, term spans built and found unstable

**Spent $0.412818** of a $0.60 ceiling, over 3 keyword calls on test-2. Ledger
105 → 108 entries, $10.555772 → $10.968590, sha `a7e85e4b…` → `50ec3f57…`.

**Automatic torso derivation is retired** (user ruling). `compute_zones` no
longer emits `kind: "torso"`; **the kind itself is not retired** — it stays in
the schema, `assertPlaceable` accepts it, and a manual torso zone still
round-trips byte-identical, pinned by a test. `torso_rect` and its unit tests
are kept because the ruling turns on where the subtitle anchor sits, not on the
geometry being wrong: the measured band leaves **71–295 px where
`MIN_PLACED_SHORT_EDGE` needs 324**, and session 4 established that no honest
measurement of the fonts recovers it. Move the anchor and it is one edit back.

**`ACTIVE_ANALYSIS_PROMPT_VERSION` is 4** — version 3 plus §6 term boundaries,
and nothing else. **In the analysis pass, not transcription**: that config is
frozen and a bump there invalidates the transcription cache for every reel,
where this invalidates **keywords only** (the slot stage keys on
`ACTIVE_SLOT_PROMPT_VERSION` separately, confirmed in `fingerprint.ts`).

`Transcript.terms?: TermSpan[]` is a **schema addition, optional with a
default**; absent means "not analysed", which is deliberately **not** the same
as "every run is one term". All five plans reopen. `service/src/analysis/
terms.ts` is the pure selector: a term whose ids do not resolve, that names a
removed or Latin word, that is non-contiguous, or that overlaps another term is
**dropped and counted, never fuzzy-matched**; Arabic words no term covers are
reported. `validate.ts` enforces the same on write. Terms are parsed from the
cached `rawText`, so a cache hit and a live call go down one path.

**The mechanism works. The model's answer does not.** Three cache-bypassed
calls on test-2 returned **three different term sets, and only the first
matched ORTHOGRAPHY_GUIDE §6**:

| run | terms | verdict |
|---|---|---|
| 1 | `ترطيب عميق للبشرة` / `شد خفيف للبشرة` / `إشراقة ونضارة` / `الوجه` | **correct** |
| 2 | all seven words split minimally | wrong |
| 3 | the two 3-word terms right, `إشراقة ونضارة` split in two | wrong |

Runs 2 and 3 break `ترطيب عميق للبشرة` or `إشراقة ونضارة` across cards — **the
exact §6c violation the ruling exists to prevent**. §6 line 87 lists
`ترطيب عميق للبشرة` verbatim as one term, so run 1 is right and the others are
not a matter of taste.

**Keyword spans were stable across all three** (same three spans every time,
only scores moving: 0.95/0.99, 0.90/0.95/0.95), which matches Block 3's
finding. **Term spans are a harder question than keyword spans and the model is
not reliable on it at n=3.**

**Session 5 therefore stopped at goal 3.** Script-aware grouping (goal 4), the
cost measurement (goal 5) and the corpus write (goal 6) were **not attempted**:
grouping built on a span set that is wrong two times in three is not
deliverable, and the remaining budget could not have covered the other reels
anyway.

**test-2 carries its first keywords** — `Profhilo`, `ترطيب عميق`, `شد خفيف`,
**unreviewed** — and `transcript.terms` was **cleared** so the plan does not
assert boundaries nothing trusts. **The analysis cache still holds run 3's
response**, so a plain re-run restores run 3's terms; bypass the cache to get a
fresh answer.

Cost note: the keyword call now bills **$0.1136–$0.1835** against a $0.0539
estimate, roughly double to triple. The added term question costs real thinking
tokens and `estimateGeminiTextCallCost` has not been re-tuned for it.

See `docs/BLOCKS.md` for the full block plan and `handoffs/` for prior
session context.
