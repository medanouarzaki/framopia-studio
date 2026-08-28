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
- `panel/` — After Effects CEP panel. `panel/src/` is React + TypeScript
  (strict), bundled by esbuild to `panel/dist`; `CSXS/manifest.xml` declares it
  against host **AEFT 26.0** at manifest schema **6.0**, and `.debug` opens
  remote debugging on **port 8099**. `panel/jsx/` holds the ExtendScript the
  service drives: `build.jsx` (places one template instance), `image-probe.jsx`
  (source replacement), `json2.jsx` (a guarded `JSON.stringify` for hosts
  without one). ES3 only.
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
  `tools/validate-templates/` — the §9 template audit and validator.
  `tools/align-review/` — the alignment review sheet (`npm run align:review`),
  a read-only instrument that cannot import the cost ledger or reach the
  network; the allowlist is pinned by a test in `core/src/align-review.test.ts`.
- `templates/` — AE templates (not started)
- `modes/` — per-client config. `k2-syndicalia.json` is a validated stub at
  version 2; the schema, loader and validation live in `core/src/mode.ts`
- `assets/brand/` — shared assets (not started).
  **`assets/sfx/` is real** as of Block 7 session 2: four audio files and an
  index that is no longer a stub. `assets/watermark/intro.mov` **exists**: the ProRes 4444 intro overlay,
  22,969,368 bytes, in git (`.gitignore` negates `*.mov` for this directory).
  Measured in `benchmarks/RESULTS-block7-watermark.md`.
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
- `npm run loudness:measure` — free, local, **read-only**. Measures every reel's
  integrated loudness, loudness range and true peak with ffmpeg's `ebur128` and
  writes `.local/build/loudness.json`. What the SFX levels are set against: the
  corpus runs −13.9 to −14.6 LUFS at **0.0–0.2 dBFS true peak**, so it has no
  headroom at all and every sound added to it clipped. Both figures go on the
  plan as `source.dialogueLufs` and `source.dialoguePeakDbfs`; absent means
  unmeasured, and the build then attenuates nothing and falls back to each
  file's absolute gain rather than to a guessed loudness.
- `npm run watermark:measure` — free, local. Measures
  `assets/watermark/intro.mov` with ffprobe/ffmpeg and **emits** every claim
  into `benchmarks/RESULTS-block7-watermark.md`: duration in seconds and
  frames, both frame rates, pixel format and whether an alpha plane is really
  there, SAR, colour tags, the audio stream and its `volumedetect` figures, the
  straight-vs-premultiplied verdict with its separation check, and the
  per-frame alpha bounding box. Nothing about that file is hand-typed into a
  document.
- `npm run diagnose:timing [-- --reel <name> --from <s> --to <s>]` — free, local,
  **read-only**. Dumps a reel's words and cards over a span, checks them against
  the raw Scribe response in the transcription cache, and writes
  `benchmarks/RESULTS-block7-timing-defect.md`.
- `npm run migrate:regroup [-- --apply]` — free, local. Re-groups every plan to
  one word per card and re-derives supersession, display timing, templates and
  SFX. Dry-run by default.
- `npm run face-sheets` — free, local. Contact sheets of the face-only mask for
  all five reels into `benchmarks/results/latest-face/`, reusing the sidecar's
  `head_overlay` task rather than adding a renderer.
- `npm run top-left` — free, local. Computes each image slot's top-left
  placement from its face-mask span and writes `.local/build/topleft-<reel>.json`.
- `npm run image-ceiling` — free, local, **read-only**. Computes the largest
  placeable square per slot under each constraint relaxed one at a time, ranks
  what each is worth, and writes `benchmarks/RESULTS-block7-image-ceiling.md`
  plus `.local/build/image-ceilings.json` for the builder's variants.
- `npm run image-fill` — free, local, **read-only**. Measures how much of its own
  canvas each generated image fills and how large the subject is on screen;
  writes `benchmarks/RESULTS-block7-image-fill.md`. Regenerates nothing.
- `npm run diagnose:missing` — free, local, **read-only**. Explains which words
  have nothing readable on screen and why; writes
  `benchmarks/RESULTS-block7-missing-cards.md`.
- `npm run repair:source-text [-- --apply]` — free, local. Repairs `sourceText`
  on existing plans by matching each word's stored interval against the cached
  raw Scribe response. Re-transcribes nothing.
- `npm run image-size` — free, local. Measures how large each image could be
  under three rules and writes `benchmarks/RESULTS-block7-image-size.md` plus
  `.local/build/image-sizes.json` for the builder's three variants.
- `npm run wrap:survey` — free, local. Measures every card in the corpus in
  After Effects and writes `benchmarks/RESULTS-block7-wrapping.md`. Reads
  `library.aep` as an import source; builds no master and writes no comp.
- `npm run build:reel -- --plan <abs path.editplan.json> [--out <abs path.aep>]`
  — free, local. Builds a whole reel into **two master comps in one project**,
  `_A` and `_C`, differing only in subtitle out-points so the retiming question
  can be judged by flipping between them. One duplicated comp per element,
  shared by both masters, so nothing else can differ.
- `npm run migrate:alignment [-- --apply]` — free, local, **$0.00 and no API
  call**. Re-aligns every plan from its resolved transcription cache entry under
  the adopted transliteration cost and rewrites the word timings, then recomputes
  everything derived from them: card spans, display timing, keyword and image-slot
  spans, SFX event times and `transcript.contentHash`. **Refuses to write if
  `hashTranscript` moves** — alignment may not change word text, so nothing
  text-derived (keyword selection, image prompts, candidates) can move. Dry-run
  by default.
- `npm run migrate:display-timing [-- --apply]` — free, local. Gives existing
  plans the display timing `applyDisplayTiming` has always computed but never
  persisted. Dry-run by default.
- `npm run migrate:templates-sfx [-- --apply]` — free, local. Assigns template
  ids to every element and re-derives SFX from the current manifest.
- `npm run repair:candidate-paths [-- --apply]` — free, local. Repoints a
  plan's `candidates[].path` at the cache entry it describes, recomputing the
  fingerprint rather than guessing.
- `npm run build:comp -- --plan <abs path.editplan.json> --group <groupId>
  [--out <abs path.aep>] [--template <id>] [--placeholder <layer>]` — free,
  local. Places one subtitle card in a master comp by driving the **already
  running** After Effects over AppleScript `DoScript`, and reports what AE
  actually did. Starts a new project every time; never opens or writes
  `templates/library.aep`. Saves to `.local/build/`.
- `npm run probe:image -- --image <abs path> --master <comp name>` — free,
  local. Runs on the project `build:comp` left open: duplicates an image
  template, replaces `IMG_MAIN`'s source and reports whether it took.
- `npm run retiming` — free, local, **read-only**. Counts, across every plan,
  how many consecutive subtitle pairs would overlap on screen under each
  reading of TEMPLATE_LIBRARY_GUIDE §5's retiming rule. Writes
  `benchmarks/RESULTS-block7-retiming.md`. Modifies no plan.
- `npm run migrate:image-cache [-- --apply]` — free, local, one-shot. Re-keys
  image cache entries onto the Block 7 fingerprint. Dry-run by default; it
  refuses to move an entry whose **old** key does not reproduce from its own
  manifest, so a rename is never made on a guess.
- `npm run service` — free, local. Builds core and the service, then starts the
  companion service on 127.0.0.1 on a free port, writing `.local/service.json`
  with `{ port, token, pid, startedAt }`. **This is what the panel spawns**
  (`service/dist/service.js`, directly, with a resolved Node binary) and what to
  run by hand when diagnosing a panel that cannot reach it. `npm run
  service:build` builds without starting.
- `npm run validate:panel` — free, local. Parses `panel/CSXS/manifest.xml` and
  fails on any parse error. Part of `npm run check`.
- `npm run panel:build` / `npm run panel:dev` — build the CEP panel to
  `panel/dist` (gitignored) with esbuild, once or in watch. `panel/dist` is what
  the manifest's `MainPath` points at, so the panel shows nothing until this has
  been run.
- `npm run panel:install` — free, local, **idempotent**. Sets `PlayerDebugMode`
  on `com.adobe.CSXS.10`–`13` and symlinks `panel/` into
  `~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio`,
  printing what it actually did. It refuses to delete a real directory it did
  not create. **After Effects reads the extensions folder at launch, so restart
  AE once after the first install**; after that a rebuild only needs the panel
  closed and reopened (Window → Extensions → Framopia Studio).
- `npm run align:score -- --reel <label> [--compare <path>] [--allow-sha-drift]
  [--cost-model default|expensive-insert] [--entry <id>]` — free, local, **read-only**. Scores the current aligner
  against the hand-made reference at `benchmarks/references/align/<reel>.json`.
  **The only non-circular measure of aligner correctness in the project**: every
  figure comes from a human's verdicts and nothing reads the aligner's own
  record as ground truth. Single-run mode reports the four verdict counts with
  their cross-script/same-script split and the share of judged pairings a human
  has confirmed; it **refuses** when the reference's git sha is not the sha the
  current pairing was generated at, because a reference judges one aligner.
  `--compare <path>` scores the working tree against a reference from another
  commit and buckets every moved row by the human's verdict — candidate repairs
  (`wrong` and moved), **regressions** (`correct` and moved), still-inexpressible
  (`two-tokens`), unrepaired (`wrong`, unmoved) — and writes
  `<reel>.rereview.html`, holding only the moved rows with the old pairing beside
  the new one. **The repair count is a candidate figure until a human passes over
  that sheet**, and the tool says so in those words. Also writes
  `<reel>.score.json`. With no reference it fails naming the path and
  **synthesises nothing**. Drift is judged on **`alignerHash`** — a hash of
  `core/src/align.ts`, `core/src/normalize.ts` and `core/src/align-review.ts`,
  the three modules that can change a pairing — not on the repo HEAD; a
  reference written before the hash existed is **noticed, not rejected**.
  `--cost-model` selects an alignment cost model for an experiment; the default
  is what every production path uses.
- `npm run align:review -- --reel <label> [--entry <id>]` — free, local,
  **read-only**. Runs the current aligner over a reel's cached Scribe draft and
  corrected words and writes `<reel>.pairs.json` and a self-contained
  `<reel>.html` review sheet to `benchmarks/results/latest-align-review/`. One
  row per corrected word with the draft token it was paired with, the aligner's
  own operation, and four verdict buttons. The sheet carries the reel, **cache
  entry, prompt version, aligner sha and row count on screen**, not only in the
  JSON. Judgements download to `benchmarks/references/align/` — see the README
  there.

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

### Cache-entry selection is declared, never by directory order

**The active transcription cache entry is the one whose prompt version equals
`ACTIVE_PROMPT_VERSION`.** Not `readdir` order, not newest-by-mtime, not first
match. `selectTranscriptionEntry` in `core/src/cache-select.ts` is the only
implementation; nothing matching, or more than one matching, **fails naming the
reel, the pin and every version on disk** rather than falling back.
`--entry <id>` reads a historical entry deliberately, and every tool prints the
entry id and prompt version it selected and stamps it into whatever it writes.
Pinned by `core/src/cache-select.test.ts`, including that a listing arriving in
reverse order still selects the pinned version.

A reel accumulates one entry per configuration: `vitasilk` holds three (prompt
versions 1, 3 and 4), the other four hold two each (3 and 4).

### A tool that can write to the plan is not a diagnostic

**Any tool carrying a write path resolves its inputs by the same declared rules
as production code, and is tested as production code.** A diagnostic that is
wrong makes a document wrong; a tool with `--apply` corrupts the artifact
everything downstream is built on. `repair-source-text-cli.ts` sat among the
diagnostics, picked its cache entry by `readdir` order like the two beside it,
and wrote nine `sourceText` values from the wrong draft into a committed plan
while reporting `343/343 correct`. A tool is classified by its write path, not
by where it lives. Full statement in `docs/CLAUDE_CODE_GUIDELINES.md` §3.

### A tool names the inputs it selected, in the artifact and not only on stdout

**Every tool that selects among several possible inputs prints what it selected
and writes it into whatever artifact it produces** — entry id, version, sha,
enough to reproduce the figure or discover you cannot. Terminal output does not
count: it scrolls away, it is not committed, and the artifact outlives the
session. `docs/DEFECT-alignment-script-mismatch.md` carried figures from three
different cache entries for a whole block because no artifact said which
produced which, and one of them is still unattributable. The sibling of §3's
rule that a verified property must be emitted by the thing that verifies it.

### Never leave a test asserting retired behaviour

Rewrite or delete it in the same change that retires the rule; a test kept for
the record says so in its name. Block 7 session 11 found four at once, one
named "only the sum is ever compared", green and false. Full statement in
`docs/CLAUDE_CODE_GUIDELINES.md` §3.

### A rule shared by more than one tool is pinned by a test

As a mirrored constant already is. Session 11's first reconciliation of the
reporting tools with the builder was insufficient because `sweepTemplate` held
a second copy of how the entrance budget splits — arithmetic rather than a
named value, which is why it was missed. A comment saying "keep in sync" is
not a pin.

### Nothing in the panel's startup path may throw

There is no error surface before React mounts, so anything thrown at module
load reaches the user as a blank panel — which is exactly what happened when
`cep_node` was missing. **A missing capability is a state the app renders, not
an exception.** `detectHost()` returns a discriminated union and never throws;
`index.tsx` mounts unconditionally; every `loadX` rejection resolves to an
empty list. The panel is a view over the service and the ExtendScript layer and
is never the place a decision lives.

### A comment must not break the file it documents

**In XML, `--` is illegal anywhere inside a comment.** Name flags without their
leading hyphens, or keep the explanation outside the comment. A comment above
`<CEFCommandLine>` naming `--enable-nodejs` made the manifest unparseable and
After Effects dropped the extension with nothing on screen to say why.
`npm run validate:panel` parses it now. Full statement in
`docs/CLAUDE_CODE_GUIDELINES.md` §1.

### Fonts gate the Build, never the Run

PROJECT_SPEC §5 reserves a client's own fonts for Block 9, which comes **after**
Block 8, so gating the pipeline on them made this block's DoD unreachable.
Fonts decide how the comp is drawn, not whether speech can be transcribed,
analysed or imaged. `buildFonts` in `core/src/build-fonts.ts` states which faces
a build will use: a mode with `fonts.status: "tbd"` falls back to the **global**
subtitle pair — Inter Semi-Bold and Almarai Bold at 1.07x — and the panel says
so at Build. That fallback was already happening and nobody had decided it:
`requireFonts` throws on a `tbd` mode and **nothing outside `core` has ever
called it**, so every Block 7 build took the global pair without asking.

### The review sheet writes every displayed row, or nothing

A downloaded reference carries **one entry per displayed row**, in display
order, an unmarked row written with `verdict: null` rather than omitted, plus
`rowCount` and `markedCount` **computed by the same walk that writes the
entries**. The download refuses loudly rather than write a partial file.

Marks are keyed by **word id**. They were keyed by `data-i`, the corrected-word
index, while the download walked positions `0..n-1`: on the main sheet every
corrected word is a row so the two coincide, but a re-review sheet holds only
the rows a change moved — indices `0,1,2,28…54` against positions `0..16` — so
a mark survived only where a row's index equalled its own position. **Seventeen
hand-made judgements went in and three came out.** Reference schema is **3**;
versions 1 and 2 stay readable, and `scoreAlignment` ignores a null verdict
rather than counting an unreviewed row as judged.

`localStorage` is keyed by variant, reel, sha **and a fingerprint of the row
set**, so one change's marks cannot be restored onto another change's rows. A
sheet with nothing under its own key migrates once from the pre-fix key, mapping
the old index keys onto word ids, and shows what it restored.

### A stub is a claim about the host, and needs evidence

Writing `window.CSInterface = …` in a test asserts the host provides it. CEP
does not — no library is loaded — and session 7's pickers-and-logo fix passed
its tests while the panel was broken in After Effects. Prefer stubbing what the
**platform** guarantees (`window.location`) over what the **host** might inject,
and never stub a method the code does not call. Full statement in
`docs/CLAUDE_CODE_GUIDELINES.md` §3.

### The repository root has one resolver, and it is verified

`resolveRepoRoot` in `core/src/repo-root.ts` is the only implementation, used
by the panel and by core's own `REPO_ROOT`. It **follows symlinks** — CEP always
loads the extension through
`~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio`, and
walking `..` from a symlinked location lands in the extensions folder — walks
up from any directory inside the repo, and **verifies** each candidate against
`package.json`'s name and the `service/`, `modes/` and `core/` directories
before believing it. **It never returns an empty string**: failure is a
`RepoRootError` naming every candidate and what each returned.

The panel offers three candidates and takes the first that verifies:
`__adobe_cep__.getSystemPath`, `CSInterface.getSystemPath`, and
**`window.location`** — the last needs no CEP API at all, because the page is
loaded from `.../com.framopia.studio/dist/index.html`.

**`CSInterface` is never defined in this extension.** `index.html` loads no CEP
library and nothing used the native API, so the old code — which tested for
`CSInterface` alone — always fell through to an empty extension path.
`realpathSync('')` returns the process cwd, which for a Finder-launched After
Effects is `/`, so the root became `/` and the panel reported a missing file at
`/service/dist/service.js`.

### CEP runs Chromium 99, and the bundle is gated against it

**CEP 12, in After Effects 2026, runs Chromium 99.0.4844.84** — read off the
machine twice: the running `CEPHtmlEngine` process carries
`--user-agent-product=Chrome/99.0.4844.84`, and the bundled
`Chromium Embedded Framework.framework` declares `99.2.15.0`. That is roughly
three years behind the Chromium Playwright ships, so **the headless check is
more capable than production** and has certified something CEP could not do.

`core/src/cep-capabilities.ts` holds the version and the features it lacks;
`panel/src/capabilities.test.ts` asserts them against **`panel/dist`**, not
`panel/src`, because the bundler sits between the two. **The build cannot be
the gate**: esbuild at `--target=chrome99` passes a container query through
without a word. Comments are stripped before scanning, so a note explaining why
a feature was removed does not trip it.

Not available in Chromium 99, and on the denylist: CSS container queries
(`@container`, `container-type`, `container-name`, Chrome 105), `:has()` (105),
`@scope` (118), `color-mix()` (111), `text-wrap: balance` (114),
`Object.groupBy` (117), `Array.fromAsync` (121), `toSorted`/`toReversed`/
`toSpliced` (110), `AbortSignal.timeout` (103), `URL.canParse` (120).
**Available and used**: `ResizeObserver` (64), `AbortController` (66), grid and
flex `gap` (84), `overflow-wrap: anywhere` (80), custom properties (49).

### The pipeline runner, and where the money is gated

`POST /jobs {type:"pipeline", params:{reel, mode}}` returns a job id; the panel
polls `GET /jobs/:id`, whose `detail` carries the runner's per-stage progress.
**The job lives in the service**, so the user can leave step 1, or close the
panel, without losing the run.

`service/src/pipeline.ts` orchestrates four stages and **spends nothing itself**.
Every billable call is made by the stage function, which writes its own ledger
line at the point of spend; the ledger writer is deliberately not imported into
the runner and a test asserts it stays that way.

**The plan is the source of truth for resumption.** Each stage writes its result
and its `cacheEntryId`/`cacheProvenance` into the plan, so a stage the plan
records as `done` is skipped with its reason said out loud. `redo: [stageId]`
runs one again deliberately.

**Two ceilings, and they are different things.** `PIPELINE_CEILING_USD = 4` in
`service/src/pipeline.ts` is the **hard gate**: a running check against the
ledger before each billable request, so a run is aborted rather than truncated.
ARCHITECTURE §6's **$2.00 is a soft alarm** the panel shows against a reel's
cumulative `costs.spentUsd` — a warning, never a refusal. The hard gate sits
above the alarm because a reel legitimately crossing $2.00 should warn, not
fail. `PIPELINE_CEILING_USD` is CHOSEN, NOT MEASURED.

**Frame analysis is reported, not driven.** Zones need sampled frames and the
Python sidecar, which take minutes and have their own commands; the stage
reports what the plan already has, or says which commands to run. Pretending to
have run it would be worse.

### The three subtitle questions are ruled, and all three land in Block 9

Recorded in `docs/PROJECT_SPEC.md` §3 with the date. **None is implemented**;
they are the user's decisions on what the transcript editor showed him.

1. **A multi-word §6 term occupies one card together.** `MAX_WORDS_PER_CARD` = 1
   stands for ordinary speech; a §6 term overrides it.
2. **A card stays tight to its word; the animation compresses.** This ratifies
   Block 7's short-card entrance stretching, so the **23 clipped holds are a
   recorded decision, not an open defect. Nothing to build.**
3. **An overlong word shrinks to fit** — never clipped, never wrapped to a
   second line; the type scales down for that word on its own card.

**Ruling 1 needs a term source the project does not have.** The split-term
detector flags every run of consecutive Arabic-script words, and §6 defines a
term semantically: some of the 13 are not terms. `Transcript.terms`,
`service/src/analysis/terms.ts` and `ACTIVE_ANALYSIS_PROMPT_VERSION` 4 all exist
and are **unread by grouping**, because Block 6 session 5 got three different
term sets from three identical calls and two of them broke a term the guide
names verbatim. A trustworthy source is either a hand-made reference of term
spans — the same shape as the alignment references, and the same cost in the
user's time — or a prompt that returns them stably, which n=3 says the current
one does not.

**Ruling 3 needs a width measurement the panel cannot take.** Rendered width
comes from `sourceRectAtTime` inside After Effects — the panel's 11-character
proxy is not it. A per-word scale touches `service/src/build/` (a scale computed
per card from the measured rect against `SUBTITLE_SAFE_WIDTH`) and the template
contract (`TXT_MAIN`'s scale becomes a per-instance value). **The system never
edits a template's keyframes**, so the scale is set on the instance, not the
comp. It also depends on the K2 fonts Block 9 collects: a different face changes
every width.

### The impact frame is measured, and it disagrees with the user's eye by 1.25 frames

The audit now carries each key's interpolation type and temporal ease, so the
crossing is computable. `core/src/impact-crossing.ts` builds AE's bezier —
`influence` is the fraction of the segment a handle spans, `speed` is the value
rate, so a handle's vertical extent is `speed × influence/100 × d` — and finds
where the value first reaches `IMPACT_THRESHOLD` of its delta.

**Every comp and every entrance property crosses at 5.25 frames**, against a
settle at 12.00 and a linear reading of 11.40. Six comps agreeing exactly is
what one shared easing preset should produce, and it is the evidence the
convention is being read correctly.

**The user says `kw_slam`'s word lands at frame 4, and 5.25 is not that.** The
convention is not the problem — the threshold is. Frame 4 corresponds to a
threshold of **0.8966**, where `IMPACT_THRESHOLD` was chosen at **0.95**:

| threshold | crossing |
|---:|---:|
| 0.8966 | 4.00 f — the user's eye |
| 0.90 | 4.06 f |
| 0.95 | 5.25 f — as chosen |

**Nothing was migrated onto 5.25.** The 17 SFX events remain where session 22
left them, 8 frames late, and the threshold is a judgement about when a motion
reads as arrived that belongs to the person who drew the curve.

**Two units traps, both found by the numbers disagreeing.** A *spatial* property
reports one ease for all three dimensions because AE eases along the path, so
its value axis is the magnitude; a *non-spatial* multi-dimensional property
reports one ease per dimension. Comparing a 3-D magnitude against dimension
zero's speed put `img_float`'s Scale at 7.27 frames where everything else gave
5.25. And a null ease is not linear — AE refused to answer, and reading it as
zero would put a plausible number where a missing one belongs.

### The impact frame is not the settle frame, and it is still unmeasured

Session 22 placed every sound on **12 frames**, the last entrance keyframe. The
user built these templates and has settled what that figure is: **the easing
front-loads the motion, so the word has landed by frame 4 and frames 4 to 12 are
the tail settling.** The animation is not changing.

`introS = 0.13 s` (4 frames) describes the **arrival**; the last key (12 frames)
describes the **settle**. Both are right about different things and neither is
what SFX placement needed. **The 17 events session 22 moved are therefore 8
frames late** — down from about two seconds, and not corrected, because the
correction cannot be measured yet.

The impact is where a property first reaches `IMPACT_THRESHOLD` = **0.95** of its
final value (`core/src/impact-frame.ts`, **CHOSEN NOT MEASURED**). That needs the
interpolated curve, and the audit recorded only `index`, `time`, `value` — two
endpoints and a duration, which cannot say when the value arrives between them.
On `kw_slam` the same two keys give **11.40 frames if linear** against the user's
**4**; the whole difference is easing.

`audit.jsx` now records `keyIn/OutInterpolationType` and
`keyIn/OutTemporalEase` (influence and speed per dimension), optional with a
default so an older audit reads as *not recorded* rather than as linear.
**One more `npm run audit:templates` run supplies it.** `impactFrameOf` is
documented as measuring the settle so nothing reads it as the impact again.

### No script the host evaluates may discard unsaved work

Session 22 fixed this in the audit. **Three more scripts had it and nobody had
looked**: `panel/jsx/build.jsx`, `panel/jsx/build-reel.jsx` and
`panel/jsx/measure-survey.jsx` each called
`app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES)` before starting their own
project. All three refuse now, with the same sentence and the same rule — an
unreadable `dirty` counts as dirty, because refusing costs a re-run and guessing
costs the user's work. Pinned for all three by
`core/src/audit-safety.test.ts`.

**This is why `vitasilk` was not rebuilt in session 23**: building drives the
user's open instance, and until he has run the guarded build himself nothing in
this project has been heard.

### The audit never closes a project it did not open

`tools/validate-templates/audit.jsx` called
`app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES)` unconditionally — it
destroyed unsaved work in whatever the user had open, and it cost Block 8
session 21 its second half, because taking the measurement would have thrown his
project away. **A diagnostic that mutates the host is the same class of mistake
as a diagnostic that writes to the plan.**

`refuseIfUnsafe` runs before anything opens: a project with unsaved changes is a
**refusal with a sentence**, not a prompt. An unreadable `dirty` is treated as
dirty — refusing costs a re-run, guessing costs the user's work. A *saved*
project that is not the library is closed, and the fact is announced in the
output rather than done silently.

**The CLI had the same defect one layer up**: it wrote whatever the script
returned into `library.audit.json`, so a refusal would have replaced a working
measurement with an error message. It now throws and leaves the file untouched.

### SFX placement is measured end to end

**The impact frame: every one of the six comps settles at 0.4004 s = 12.00
frames**, derived from its last entrance keyframe by `impactFrameOf`. Read from
the audit the user ran; `templateImpacts` maps it, and a template whose impact
cannot be derived is **absent from the map**, so `deriveSfxEvents` falls back to
the manifest offset rather than to a guess.

**What the 0.13 s offset turned out to be: wrong by 53.4 frames for a hit.**
`hit_01`'s anchor is 2.0525 s into the file and the impact is 0.4004 s after the
element, so the layer starts **1.6521 s before** it, where the old rule started
it 0.13 s after. A whoosh moves 8.7 frames earlier.

**`introS` says 0.13 s and the comps animate over 0.4004 s.** Two claims about
the same templates, and only the second is measured. SFX uses the measured one;
buildability, display timing and the short-card rule still use `introS` and
**nothing in session 22 changed them**. Recorded, not resolved.

**Each sound declares its anchor** — `onset` for a dry percussive hit, `peak`
for a riser that sweeps into a slam — defaulted from the measured shape and
carrying `anchorSource` so a declared choice is never mistaken for a derived
one. A field per file, emitted by the measuring tool, never hardcoded in the
placement code.

**Gain is derived, not typed.** The user's −20 dB and −24 dB are now targets
that are *reached*: each file's gain is `target − measured peak`. `whoosh_02`
peaks 8.39 dB down, so it moves from −24 to −15.61; the other three move by
about a decibel.

**All 17 events across the corpus moved**, and **3 clamp** at the composition
start because their derived in-point is negative — reported with `clamped` and
`clampedByS` rather than absorbed. `npm run migrate:sfx-placement` is the
migration.

### A sound's impact is not at its first sample

`npm run sfx:measure` — free, local, **read-only on the audio** — measures every
file in `assets/sfx/sfx.json` and writes the result back into it. Nothing about
a sound's timing is typed by hand.

**`hit_01`'s peak is 2.0525 s — 61.5 frames — into the file.** It is bound to
every keyword, and the placement rule put the file's *start* at the card's start
plus 0.13 s, so its impact has been landing about **2.05 s after the card**, on
every reel and every build. The median card is 0.30 s.

The mp3 padding the defect was reasoned from is **not** what is wrong: container
delay measures 0.000000 s on both mp3s. Head delay and the sound's own quiet
opening are recorded separately, because adding them would put an error back.

`placeSfx` in `core/src/sfx-placement.ts` is the replacement rule: **peak lands
on the template's impact frame**, snapped to 29.97 with ties rounding **down**
(early reads as part of the impact, late reads as a separate event), and a peak
later than the impact clamps at the comp start reporting how late it then is.

**It is not in force yet, and the reason is a measurement that could not be
taken.** The impact frame comes from the template's own keyframes, and
`templates/library.audit.json` records keyframe **counts without times**.
`audit.jsx` now emits every key's time and value, but **the audit has not been
re-run: it closes the open After Effects project without saving**
(`audit.jsx:122`), and the user's instance is open. Until
`npm run audit:templates` runs, `impactFrameOf` returns null with a reason for
all six comps and the 0.13 s offset stays.

### A removed keyword stays removed

`keywords.removedWordIds` — **schema addition, optional with a default** —
records the words a human took off the keyword list. `edited: true` protects a
keyword a human *added*, because there is an item to flag; a removal left
nothing, so a transcript change cleared the block and the analysis proposed the
same keyword again. Three things honour it now: `humanFlaggedItems` reports it
so `PlanMergeBlockedError` refuses the clear, `clearBlocks` carries it through a
clear that discards the items, and the analysis stage filters a removed word out
of its proposals and logs that it did. Promoting the word again clears the
marker — that is the user changing their mind, not the marker outliving its
decision.

### Step 3 is the keyword picker, and SFX is re-derived rather than patched

`GET /keywords?reel=`, `POST /keywords/add`, `POST /keywords/remove`;
`service/src/keyword-view.ts` derives it all from the plan.

Each keyword shows its card, interval, the analysis's reason, its template
variant (`kw_slam` or `kw_slam_ar` **by script**), its size — 425 against the
subtitle's 343, both from `core/src/typography.ts` — and the hit bound to it at
+0.13 s, −20 dB.

**Both edits re-derive `sfx` through `deriveSfxEvents` rather than patching an
event.** ARCHITECTURE §3 calls SFX generated and never hand-authored, so a hit
added by hand would drift from the binding the moment the manifest moved.

**A promoted keyword is `edited: true`**, which `humanFlaggedItems` reports and
`PlanMergeBlockedError` refuses to discard: a transcript change clears the
keyword block, and the merge stops rather than losing a human's choice.
**A removal has no such protection** — there is no item left to flag — so a
transcript change followed by a re-run restores a keyword the user deleted.
Known gap, not fixed.

**An add appends; it never re-sorts the block.** The stored order is the
selector's, by score, and re-sorting on an unrelated add would move every item
as a side effect. The view sorts by start time, which is a rendering decision.

**The SFX preview plays the bound file through the browser**, at the gain the
build uses (−20 dB is `10 ** (-20/20)` = 0.1 volume). It works from a `file://`
page because the manifest declares `allow-file-access-from-files`; verified in
Playwright's Chromium, **not on CEP**, and a failure is reported rather than
swallowed. `hit_01` is an mp3, not a wav.

**A reel with no keywords says why** — analysis pending, or analysis ran and
chose none — and every view names the analysis prompt version, the mode and the
cache entry the plan recorded.

### A count names its scope, or it is the wrong number

The transcript editor's three ruling counts read **1, 5 and 0** on `vitasilk`
while session 18's report said **7, 23 and 13**. Both were right — one per reel,
one over the corpus — and nothing on the button or in the report said which. The
user could not rule on any of them, correctly.

Per reel, and pinned by a test for all five reels:

| reel | overlong | clipped | split terms |
|---|---:|---:|---:|
| ground-truth | 2 | 8 | 2 |
| test-1 | 0 | 5 | 6 |
| test-2 | 1 | 3 | 1 |
| test-3 | 3 | 2 | 4 |
| vitasilk | 1 | 5 | 0 |
| **corpus** | **7** | **23** | **13** |

**`vitasilk`'s zero is real, not a broken detector.** All 73 of its words are
`script: latin` — the correction pass transliterates Darija to Arabizi — so no
Arabic run exists to be split. The Arabic on that reel is in `sourceText`, which
is the raw Scribe draft and never gets built. 39 of its words have an Arabic
`sourceText` and none has an Arabic `text`.

**The clipped breakdown recorded in `handoffs/block-8-part-1.md` is 9/7/4/3/5 =
28 and is pre-migration.** Block 8 session 14's alignment migration took the
corpus from 28 to 23; the per-reel figures today are 8/5/3/2/5. `vitasilk` is 5
either way, which is why the screen and the old record agreed by accident.

Both scopes are now on the button, and **a proxy says it is one**: the overlong
count is a character count at `OVERLONG_WORD_CHARS = 11` standing in for
`sourceRectAtTime` in After Effects.

### The script toggle is free; a text edit is not

`hashTranscript` is `[id, text]` over non-removed words and
`transcriptContentHash` is `[id, text, start, end, removed]`. **Neither covers
`script`**, so flipping it misses no cache and clears no block — where editing a
word's text changes both, missing the keyword and image-slot caches and costing
about $0.24 on a re-run. The panel says which is which, because a free edit and
a paid one must not look alike.

What flipping it does change is the **template variant**: `assignTemplates`
picks `sub_pop` or `sub_pop_ar` by script, and that decides the font — Inter
Semi-Bold or Almarai Bold at 1.07x. `editWord` moves the card to the matching
variant in the same write, because leaving it would have the builder draw Arabic
in Inter. A template with no counterpart is left alone rather than given an
invented id.

**It cannot correct the CJK draft token.** `vitasilk` `w0005` displays `5`,
correctly Latin; `五` is its `sourceText`, which is cache data the panel never
writes.

### Step 2 is the transcript editor, and every figure in it is the service's

`GET /transcript?reel=` returns the words, the cards they become, and the three
questions the user has to rule on; `POST /transcript/word` and
`/transcript/card` write edits. `service/src/transcript-view.ts` derives all of
it — a figure computed in the panel would be a second implementation of a rule
the service already owns.

**Direction is set per token, never on a container.** A word's own `script`
decides its `dir`, so an Arabic word reads right to left inside an otherwise
left-to-right row; a `dir` on the row or the list would reorder the Latin words
around it. A browser test asserts the list and the row carry no `dir` at all.

**Confidence is banded, and never red.** `conf-high` ≥ 0.9, `conf-mid` ≥ 0.7,
`conf-low` below, and `conf-none` for an interpolated word the aligner never
measured. The accent belongs to Run pipeline, and a low-confidence word is
something to look at rather than an error.

**Every edit sets `edited`**, which is what `PlanMergeBlockedError` refuses to
discard on a re-run. Word ids and order never change, and a word cannot be
emptied — it is marked removed instead, so the card can still be built.

**An edit to a word's text changes `hashTranscript`**, so the keyword and
image-slot caches miss and a later run bills for them again. **The panel says so
before he types**, and a test pins that the sentence is true: a text edit moves
the hash and a timing edit does not.

**The three open questions carry their basis, not just a count.** Clipped holds
(23) and split Arabic runs (13) are computed from the plan and reproduce the
recorded corpus figures exactly. **Overlong words (7) are a proxy**: the real
measurement is `sourceRectAtTime` in After Effects against
`SUBTITLE_SAFE_WIDTH`, and the panel counts characters at
`OVERLONG_WORD_CHARS = 11`. The two agree exactly on this corpus — the seven
longest words are the seven measured overlong, with the boundary between 11 and
10 characters — and the marker says which measurement it is.

### The dry run answers what pressing Run will do, not what a stage would cost

`PIPELINE_STAGES` in `service/src/pipeline-stages.ts` is the one declaration of
the stage ids, their order, their labels and which of them can bill. The dry run
and the runner both import it, and `pipeline-stages.test.ts` pins that they
agree — guidelines §3, a rule shared by more than one tool.

Two corrections that fell out of building the runner, both the mirror of the
defect session 14 fixed:

- **A stage the plan records as done is priced at nothing**, because a run skips
  it. `vitasilk` read $0.18 for analysis — its keyword entry sits at an older
  analysis prompt version — while a run skips the stage entirely.
- **Images are priced only when a slot can exist**: on the plan already, or from
  an analysis stage that will run and plan some. `test-2` read $1.45 while its
  analysis had already run and planned none, so a run reaches no image call.

### The panel is a five-step view over the plan, never a wizard

**Selecting a reel or a mode never navigates** (user ruling). It used to jump to
the furthest step the plan supported, which hid every step in between and left
Build open on a reel with no keywords. The rail updates availability; the user
chooses. The only automatic move is off a step the new plan cannot show.

**Which step a reel opens on is remembered per reel in `localStorage`**, keyed
`framopia.panel.last-step`. Closing a CEP panel unloads the page, so React state
cannot survive it. It is a **view preference, never a fact about the plan**, so
it does not reach the Edit Plan: two people opening the same reel are entitled
to be looking at different steps. Every access is guarded — a `file://` page
with site data disabled throws on the accessor itself.

**`resumeAt` is gone.** It was session 15's navigation rule and nothing reads it
now; it was removed with the test that pinned it rather than left unreferenced.

**Build opens whenever there are subtitle cards, and that is the stated rule.**
A subtitles-only comp is a legitimate build: keywords and images are
enrichments, and `ground-truth` builds 76 cards with neither. The pane says what
the comp **would and would not** contain, and names each buildability issue
rather than counting them.

`1 Reel · 2 Transcript · 3 Keywords · 4 Images · 5 Build`. **Step availability
and where the panel opens are derived from the Edit Plan on disk**, by
`stepsFor` in `service/src/steps.ts`, served at `GET /steps?reel=&mode=`. The
panel renders what it is told and decides none of it: closing the panel,
restarting After Effects or reloading the extension has to land the user where
the reel actually is, and the plan is the only thing that survives all three.

`resumeAt` is **the end of the unbroken run of available steps, not the furthest
available one.** `build` is available whenever there are cards, so taking the
last would open a reel with no keywords straight on Build and hide the gap that
is the actual next thing to do. Today: ground-truth and test-3 resume at
`transcript`, test-2 at `keywords`, test-1 and vitasilk at `build`.

**Steps 2 to 5 are honest empty states.** Each names what will live there and
shows figures already on the plan — words and cards, keyword count, slots and
candidates *actually on disk*, the fonts a build would use. Nothing is mocked.

**The rail's current marker is white, never brand red.** PROJECT_SPEC §6 spends
`#ED1C24` on one thing and the user ruled that thing is Run pipeline; a red rail
would put four more of them on screen. Pinned by a browser test that walks the
computed styles.

**Docked at the manifest's 420 px the rail shows the numbers and only the
current step's name**, on one row, never wrapping and never scrolling
sideways — asserted by measuring `offsetTop` and `scrollWidth` in a real engine.
Labels return at the two-column width.

**A malformed `/steps` payload degrades to a locked rail, never a throw.** The
same rule that keeps the startup path from throwing, applied to the service's
replies.

### The panel is laid out by a measured width, not a container query

A docked CEP panel's **window** is the size of the screen while its **panel** is
a column wide, so a media query lays out for the wrong thing — and a container
query lays out for nothing at all, because Chromium 99 does not implement one.
A `ResizeObserver` toggles a `wide` class on `.app` from the panel's measured
width; it fires on observe, so the first measurement is taken **after** layout
rather than during the first render, and it re-evaluates on every resize.

The split is at **830 px of the panel's own width** (`PANEL_TWO_COLUMN_PX` in
`panel/src/panel-width.ts`), measured in session 9: a column must never be
narrower than the single column already is when docked at the manifest's
420 px, where the value side of a fact row is 242 px. Two columns reach 241 px
at 820 and 246 px at 830. Service sits beside Video and Client mode, Build spans
both beneath. Verified from 380 px to 1920 px with **zero overflow at every
width**.

### The service must be built before the panel can start it

The panel spawns `<repo>/service/dist/service.js`. `npm run service:build`
builds it; `npm run service` builds and starts it from a terminal. The panel
re-checks that the file exists **on every attempt**, against the freshly
resolved root, so the message cannot outlive the condition.

### ffmpeg and ffprobe are resolved too, for the same reason as Node

The panel reported `ffmpeg version 8.0.1` and, eight minutes later, `missing`,
with nothing changed on the machine. The first reading came from a service the
user had started **from a terminal**, which inherits a shell `PATH`; the second
from one **After Effects spawned**, which does not. Homebrew is not on that
path. **ffmpeg detection had never worked in a panel-spawned service, and a
terminal-started process had been masking it.**

`resolveFfmpegPath` in `core/src/ffmpeg-path.ts` resolves each tool
independently: `ffmpegPath`/`ffprobePath` in `.local/config.json` →
`/opt/homebrew/bin` → `/usr/local/bin` → `PATH`. Nothing is version-pinned —
Homebrew's `bin` is a directory of symlinks, so no Cellar version appears — and
`PATH` stays last rather than absent, because a machine that installs elsewhere
and puts it on the path is working. `verified` says which case it is.

**Every call site uses it**: `service/src/health.ts`,
`service/src/transcription/media.ts`, `service/src/frames/sample.ts`,
`benchmarks/src/audio.ts` and `tools/measure-watermark/cli.ts`. A second site
left on `PATH` reproduces the defect somewhere less visible.

**The resolved path is in the health payload and on screen**, under the version
each tool reported, exactly as Node's is. A failure names every candidate tried
and what each returned.

### The panel says which service answered

`GET /health` reports the service's own `pid` and `startedAt`, and `connect`
reports whether the panel **spawned** it or found it **already running**. The
panel shows one quiet line: `Started by the panel · pid 21204 · since 01:34:13`.

It exists because a terminal-started service and a panel-spawned one disagree
about what the machine has — that is what the ffmpeg reading above was — and
nothing on screen distinguished them.

### The panel spawns Node directly, at a resolved absolute path

After Effects launches from the Finder and inherits no shell profile, so the
panel's `PATH` is roughly `/usr/bin:/bin` — `npm` is not on it and neither is
an nvm-installed Node. **Never `npm`, never through a shell, never a hardcoded
path**: the version is in the nvm directory name, so a literal breaks on the
next upgrade and on the partner's machine. `resolveNodePath` in
`core/src/node-path.ts` tries, in order, `nodePath` in `.local/config.json`,
`process.execPath` **when it really is node** (inside CEP it is After Effects),
the newest `~/.nvm/versions/node/*/bin/node` compared **numerically**, then
`/opt/homebrew/bin/node` and `/usr/local/bin/node`. Nothing resolving is a
panel state, never a throw. `GET /health` reports which one won.

### Alignment uses a transliteration-aware substitution cost

Adopted 2026-08-28. `ACTIVE_ALIGN_COST_MODEL` in
`service/src/transcription/align.ts` is `transliteration`; the flat model stays
selectable as `legacy`, the way prompt version 2 stays selectable in
`correction.ts`, because every figure recorded before that date was measured
with it. Nothing in the pipeline passes it.

Under a flat cost every cross-script pair scores exactly 1, so the comparison
carries no information and the backtrace's preference order decides the reel.
The evidence is two hand-made references: the change moved 16 of the 18
pairings the user marked wrong and none of the 54 he marked correct, and his
second pass returned 7 correct, 2 misheard, 7 wrong, 1 unjudged. **Anchored
words across the corpus are unchanged at 330** — Block 7's discarded fix took
them to 230, which is the guard. One regression is recorded rather than netted
away: `vitasilk` `w0036` (`26`) lost its anchor, its true source being two
tokens the aligner cannot express.

### The corpus is pinned at ORTHOGRAPHY_GUIDE v1.0.7, and reuse is labelled

**`ORTHOGRAPHY_GUIDE.md` is v1.0.8; every transcription cache entry on disk was
written at v1.0.7 or earlier.** The transcription fingerprint reads the guide
version out of the file, by design, so a guide bump invalidates on its own — and
one happened in Block 4 session 3, four blocks ago. Nothing noticed because **no
reel has been re-transcribed since.**

Attributed exactly, each entry reproducing its own directory name from
(promptVersion, guideVersion) and nothing else matching:

| entry | promptVersion | guide | on disk for |
|---|---:|---|---|
| `transcription-0cb5401192dbfbc7` | 1 | 1.0.5 | vitasilk |
| `transcription-92adf5b1bf24601a` | 3 | 1.0.6 | all five |
| `transcription-758a3924d090d1b5` | 4 | **1.0.7** | all five — the pinned entry |
| `ceba491c1af5b52f` | 4 | **1.0.8** | **nothing** — what production would compute today |

`selectTranscriptionEntry` picks by **prompt version**, so every diagnostic and
review tool reads `758a…` and is right to; `transcribeHybridCached` computes the
**fingerprint** and would miss. The two are not in conflict — they answer
different questions — but only the second one spends money.

**The analysis cache is stale the same way**, for a different reason:
`ACTIVE_ANALYSIS_PROMPT_VERSION` is 4 and `test-1`'s and `vitasilk`'s keyword
entries were written at 3. `test-2`'s is at 4. The **slot** entries hit, and so
do all ten `vitasilk` image entries, against the transcripts as they stand.

**Nothing in any cache key depends on alignment.** Adopting the transliteration
cost cost $0.00 to put on the plans, because alignment is recomputed locally
from the cached Scribe response on a cache hit. What costs money is
re-transcribing, and the guide bump is why that would happen.

**So the corpus is pinned at guide v1.0.7 for the rest of Block 8** (user
ruling, recorded as an amendment in `docs/DECISION-transcription-config.md`).
Re-transcribing is not reproducible, so it would return *different* corrected
words and invalidate both hand-made references — the project's only
non-circular measure, and impossible to regenerate. The guide file itself stays
at v1.0.8; what is pinned is the corpus.

**Cache reuse is explicit, never silent.** `core/src/entry-resolve.ts` is the
one rule and `resolveTranscriptionEntry` the one caller-facing entry point,
used by the runner, the dry run and the diagnostics. It returns how the entry
was found:

- **`exact`** — the computed fingerprint is on disk.
- **`compatible`** — same prompt version, older guide version. Reused, and said
  out loud everywhere it is visible: the runner logs it before anything is
  spent, the dry run reports it per stage, and the plan records it in
  `pipeline.<stage>.cacheProvenance` and `cacheEntryId`.
- **`none`** — a run would transcribe and bill. **Said before the call, not
  discovered by being billed.**

**The rule is narrow on purpose**: a guide-version difference at an identical
prompt version, and nothing else. **The analysis stages therefore never resolve
`compatible`** — their fingerprint carries no guide version, so their only
possible difference is the prompt version, the mode content or the transcript,
each of which changes the question the model was asked. `test-1` and `vitasilk`
sit at analysis prompt version 3 against an active 4 and resolve `none`.

An entry whose manifest is corrupt is invisible to the resolver, so the runner
still reads the exact fingerprint directory when it exists: a damaged entry is
a miss **with its own warning**, never reported as an absent one.

### A re-run clears keywords, images and sfx, and nothing would refuse

`transcriptContentHash` covers each word's **start and end**, so any change to
alignment changes it and `mergeIntoExistingPlan` clears `keywords`, `images` and
`sfx` and resets their stages to pending. `PlanMergeBlockedError` guards
human-flagged items — but **no plan carries one**: `chosenCandidateId` is null on
all nine slots and no keyword is `edited`. So the clear happens silently, without
`--force`, and `vitasilk` loses the plan-side record of ten generated images.
The files and the cache entries survive; the plan's pointers do not.

### A cache entry a reference depends on is never evicted

`MAX_ENTRIES_PER_VIDEO` is 3 and `vitasilk` holds 3, so a fresh transcription
evicts the least recently written. The correction call is not reproducible, so
evicting the entry a hand-made reference describes does not cost a
re-transcription — it makes the reference a description of a transcript that no
longer exists and **cannot be recreated at any price**.

`protectedEntryDirs` in `service/src/transcription/protected-entries.ts` derives
the protected set **from the reference files themselves**: the reference names
its reel, the reel names its plan, the plan carries the video hash, and the
entry is whichever one `selectTranscriptionEntry` picks. **No directory name is
typed anywhere** — a list a human maintains is a list nobody checks, and it
would silently stop protecting anything the day a reference was added for
another reel.

If everything over budget is protected, `evictStaleEntries` throws
`ProtectedEvictionError` rather than evicting or quietly leaving the video over
budget. The one thing a reference does not record is its entry id, so protection
resolves through the pinned prompt version; that is exact while
`ACTIVE_PROMPT_VERSION` is frozen, which it is for Block 8.

### The correction prompt version is frozen for the rest of Block 8

`ACTIVE_PROMPT_VERSION` is **4** and must not move until Block 8 closes.
Changing it changes the corrected words, which changes the pairings under
review, which **invalidates every hand-made reference under
`benchmarks/references/align/`** — files nobody can regenerate, because they are
a human's judgement. Any change to it is a deliberate, reported act with the
references re-collected, never a side effect of another change.

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
no fillers and no immediate repeats at all (**339 draft word tokens** across
the five reels, at the pinned prompt v4 entries; 343 is the *corrected* word
count, not the draft's). The
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

## Block 6 session 6 — script-aware grouping, and the build spec

**Spent $0.00.** Ledger 108 entries / sha `50ec3f57…` at both ends.

**A subtitle group never mixes scripts.** Implemented in
`service/src/analysis/regroup.ts` by cutting at every script change — the pass
still only ever splits, so the 1–2 word rule cannot be broken by it. A
post-condition throws if any rebuilt group mixes scripts. **Mixed-script groups
across the corpus: 10 → 0**, matching session 1's count exactly. Groups
184 → 194, 20 changed; vitasilk is untouched, being all Latin.

**Whole-term grouping is deliberately NOT implemented, and this is not an
oversight.** A multi-word §6 term can still land across two or three cards —
**eleven of them do**, itemized in
`benchmarks/RESULTS-block6-script-grouping.md` §5. Accepted by user ruling on
session 5's evidence: three identical analysis calls returned three different
term sets, two of which split a term the guide names verbatim, so grouping on
them would trade a visible constant violation for an invisible varying one.
**`Transcript.terms`, `service/src/analysis/terms.ts`, the validator rules and
`ACTIVE_ANALYSIS_PROMPT_VERSION` 4 all stay in place and are not read by
grouping.** They are the groundwork for the Block 7 revisit, not dead code.

**One keyword was lost, and it is the expected conflict.** test-1 `k003`
"jawdat البشرة" is dropped with the new reason `span-is-mixed-script` — the
only keyword in the corpus whose span straddles a script boundary. Dropped
rather than narrowed: which half carries the emphasis is not the pass's call.
Every surviving keyword still maps to exactly one group, and **`supersededBy`
survives a split**, verified by test rather than assumed.

**Buildability is unchanged in substance: 7 of 190 groups unbuildable at
intro+outro 0.13 s / minHold 0.10 s, against session 1's 6 of 182.** Of that
difference **one group is the cost of this change and one is not**: splitting
makes test-1 `hia` (0.099 s, formerly half of `الكولاجين hia`) unbuildable and
rescues test-1 `mn`, netting zero; test-2 `le` is a lone group that arrived
when session 5 added test-2's first keywords. **No cell in the 25-cell grid
moves more than 2 points.**

**The merge rescue woke up**: merges across the grid went 20 → 245, and 0 → 4
at the loosest budget. Splitting mixed pairs creates the adjacent single-word
groups the rescue needs. **A consequence worth remembering: two cards the plan
lists separately can be shown as one, so the group count on a plan is not the
card count on screen.**

**All five plans rewritten**, each backed up first to
`<name>.editplan.json.pre-script-grouping.bak` and reopened through
`readEditPlan` after writing. vitasilk came back byte-identical.
**`.gitignore` had `*.editplan.json` but not the suffixed backups**, so plan
backups were committable until this session; `*.editplan.json.*` now covers
them.

**`npm run timing-budget` gained `--footage <dir>`**, read-only, so a grouping
change can be swept on copies before the corpus is written.

**`docs/TEMPLATE_BUILD_SPEC.md`** is what the user builds the six comps
against: `sub_pop`, `sub_pop_ar`, `kw_slam`, `kw_slam_ar`, `img_slide_left`
(cutout), `img_float` (card). It records the type constants from
`core/src/typography.ts`, the **intro+outro ≤ 0.13 s with minHold 0.10 s**
budget and what two extra frames cost (**7 unbuildable at 0.13 s, 16 at
0.20 s**), the intro/hold/outro contract, that keyword templates declare no
offset and `KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` depends on it, why the `_ar`
variants exist, and that every manifest entry carries `sfx: []` until audio
exists. **The manifest's stub `sub_pop` still declares 0.26 s of intro+outro,
twice the budget**; the spec says to replace it and the stub was deliberately
not edited.

**Two things the spec flags that nothing has tested:** comps are authored at
30 fps against 29.97 fps footage, which drifts about one frame every 33 s and
has never been exercised end to end; and the `_ar` variants must be added to
`modes/k2-syndicalia.json`'s `allowedTemplates` before they can be assigned.

## Block 6 session 7 — the comps exist, and the validator checks them

**Spent $0.00.** Ledger 108 entries / sha `50ec3f57…` at both ends.

**`templates/library.aep` is committed** — 432,197 bytes, sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`. Six comps
the user built by hand, all **29.97 fps**, all 2.002 s long:
`sub_pop`, `sub_pop_ar`, `kw_slam`, `kw_slam_ar` at 2160x1100 with `TXT_MAIN`;
`img_slide_left` (cutout) and `img_float` (card) at 1200x1200 with `IMG_MAIN`.
`img_float` also carries a decorative `CARD` layer with `IMG_MAIN` parented to
it, which §4 permits.

**The manifest is real: `stub` is `false`.** Every entry is `introS` 0.13,
`outroS` **0**, `minHoldS` 0.10, `anchor: "center"`, `sfx: []`.
`assertRenderable` no longer throws, so a rendering stage may run.

**Mode is v6** — `sub_pop_ar` and `kw_slam_ar` added to `allowedTemplates`,
which session 6 flagged as needed before the assigner could see them.
**The bump invalidates the image-generation cache and nothing else**:
`service/src/images/fingerprint.ts` keys on `modeVersion`, while the keyword
and slot stages key on content hashes of the fields their own call reads
(unchanged here). **14 cached image entries would regenerate at roughly $1.55
if `npm run images` is re-run** — nothing was re-run this session.

### Reading the AEP

**Launching After Effects with `-r` is unusable on this machine.** A script
whose entire body is `app.quit()` left AE running for 120 s. **Amended in Block
7 session 2: the 120 s was a timeout, not proof that the script never runs.**
That same `-r` process stayed resident across sessions and eventually executed
and exited `rc=0` — quitting After Effects in the middle of a later session
that depended on it being open. When it executed, and what unblocked it, is
unknown. The operational conclusion is unchanged (`-r` cannot drive a build)
but the reason is "unusably slow and unpredictable", not "never executes", and
**a stray `-r` process must be treated as live, not inert.** **AppleScript
`DoScript` into an already-running instance does work** — AE 26.0x67 — and that
is what the audit uses. Nothing parses the binary `.aep`.

`tools/validate-templates/` — `audit.jsx` (the §9 ExtendScript run: dumps every
comp's name, fps, size, duration and layer kinds) and `cli.ts`. Two modes:

- `npm run audit:templates` drives AE and writes `templates/library.audit.json`,
  stamping it with the `.aep`'s **sha256**. Needs AE open.
- `npm run validate:templates` checks the manifest against that dump. Fast, no
  AE, and **this is what `npm run check` runs**.

**A `.aep` edited after its audit fails as stale rather than being validated
against a stale picture of itself.** The pure comparison lives in
`core/src/templates.ts` (`validateTemplates`) and is unit tested without AE.

It fails on: a manifest id with no comp; a `sub_`/`kw_`/`img_` comp with no
manifest entry; a placeholder missing or of the wrong kind; **fps ≠ 29.97**;
`introS + minHoldS + outroS` exceeding comp duration; **`introS + outroS >
0.13`**; and an `sfxId` `assets/sfx/sfx.json` does not define.

**Proven against four real broken `.aep` copies**, built by scripting AE to
open the library, break one thing, and save elsewhere — **the committed library
was never mutated** and its sha256 is unchanged. Plus three manifest/audit
fixtures. All seven exit 1 and name the comp and the layer.

**`IMG_MAIN` is a solid, not the still §4 suggests.** A solid replaces exactly
as well, so the validator accepts `footage` or `solid` for it and rejects text.

### The timing number holds

**7 of 190 subtitle groups unbuildable at the built comps' own budget** —
unchanged from session 6. The comps land exactly on the grid's loosest cell
(intro 0.13 + outro 0 + minHold 0.10 = a 0.23 s floor), which session 6 had
already swept. **The stub's 0.33 s floor is gone**: the user built to the spec
and the spec's number is confirmed rather than moved.

`npm run validate-plan` reported a different figure at the time — **11 duration
failures, test-1 6 and vitasilk 5 — and it was not comparable.** It reads
*stored* `displayStart`/`displayEnd`, which no plan then had, and it skips any
group with no `templateId`, which was every group on ground-truth, test-2 and
test-3. **Both conditions were removed in Block 7 sessions 4 and 5 and the two
tools now agree**; see the Block 7 session 5 section.

### Three deliberate departures from TEMPLATE_LIBRARY_GUIDE

All ruled by the user, all needing a guide amendment (proposed in
`reports/block-6-session-7.md`):

1. **§3: comps are 29.97 fps, not 30.** Every source reel is 30000/1001. The
   validator **requires 29.97 and rejects 30**.
2. **§3: text comps are 2160x1100, not 2160x600.** §3's example height cannot
   hold a two-line keyword — session 4 measured the worst-case type block at
   1017.4 px.
3. **§5: `outroS` is 0.** A subtitle hard-cuts into the next card, spending the
   whole 4-frame budget on the entrance. The structure is intro + hold, and
   `outroS: 0` is a legitimate value rather than a missing one.

### Known limitation: the pipeline is 4K-only

PROJECT_SPEC §4 locks 2160x3840 and nothing reads a frame size from the
footage. **Not implemented, scoped only.** `FRAME_WIDTH`/`FRAME_HEIGHT` in
`service/src/placement/constants.ts` and `SOURCE_WIDTH`/`SOURCE_HEIGHT` in
`service/src/frames/zones.ts` are two hardcoded copies of the same fact.
`SUBTITLE_ANCHOR_X`, `SUBTITLE_ANCHOR_BASELINE_Y`, `LINE_SPACING` and the four
font sizes in `core/src/typography.ts` are absolute pixels tied to that frame,
as is `COMP_SIDE_PX`. **Everything expressed as a fraction of the frame already
scales on its own** — `BOTTOM_EXCLUSION`, `MIN_ZONE_SHORT_EDGE`,
`MIN_PLACED_SHORT_EDGE`, `CARD_EDGE_CLEARANCE`, `FILL_FRACTION`,
`SCALE_JITTER`, `ZONE_MARGIN`, `HEAD_CLEARANCE`, and the whole `SUBTITLE_BAND`
derivation, which divides by `FRAME_HEIGHT` at the end. The template comps
themselves are the harder half: they are authored at fixed pixel sizes.

## Block 6 is complete — deliberately left open

**Five things are unfinished on purpose.** None is an oversight; each has its
reasoning in the report named beside it. Read this before "fixing" any of them.

- **Whole-term grouping is unimplemented.** Eleven ORTHOGRAPHY_GUIDE §6 terms
  render split across subtitle cards. `Transcript.terms`,
  `service/src/analysis/terms.ts`, `ACTIVE_ANALYSIS_PROMPT_VERSION` 4 and the
  validator's term rules are all **live and unread by grouping** — groundwork
  for the revisit, **not dead code**. Term spans proved unstable across
  identical calls: three cache-bypassed runs, three different answers, one
  matching the guide (`reports/block-6-session-5.md`). Block 7 revisits with
  the user's eye on a built comp.
  Terms itemized in `benchmarks/RESULTS-block6-script-grouping.md` §5.

- **The image cache over-invalidates on mode version. Fix before Block 9.**
  `service/src/images/fingerprint.ts` keys on `modeVersion`, while the analysis
  stages key on a content hash of the fields their own call reads — session 4's
  fix, never extended to images. Session 7's v6 bump added two template ids no
  image call reads and **stranded 14 cached images, ~$1.55 to regenerate**.
  **A font landing at Block 9 will strand every cached image on every reel.**
  Nothing was re-run; the image files are still on disk.
  (`reports/block-6-session-7.md`)

- **The pipeline is 4K-only.** PROJECT_SPEC §4 locks 2160x3840 and nothing
  reads a frame size from the footage. Scoped in
  `reports/block-6-session-7.md`: six constant groups, the duplicated
  `FRAME_WIDTH`/`SOURCE_WIDTH` pair that can drift today, and the comps
  themselves as the hard half. The user does not deliver HD now and may with
  future clients. Block 10.

- **`assertRenderable` no longer guards anything.** `templates/manifest.json`
  stopped being a stub in session 7, so the gate that kept rendering stages
  away from placeholder timings is off — and **`assets/sfx/sfx.json` is still a
  stub with no audio files**, which nothing checks before a build. Block 7
  collects the audio. (`reports/block-6-session-7.md`)

- ~~**`npm run validate-plan` says 11 where `npm run timing-budget` says 7.**~~
  **Closed in Block 7 session 5: the two agree.** Both causes are gone — every
  plan carries display timing and every group carries a `templateId`. Both now
  report **7 unbuildable subtitle groups and 1 unbuildable keyword** across the
  corpus. The figure to quote is 7 subtitle groups, and it is no longer a
  disagreement.

## Block 7 session 1 — housekeeping, the cache fix, the watermark measured

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends, byte-identical.

**PROJECT_SPEC §4 was not the last document carrying 30 fps.** The sweep the
session was asked to run refuted its own premise: `docs/TEMPLATE_BUILD_SPEC.md`
§2 and `docs/TEMPLATE_LIBRARY_GUIDE.md` §9 and §10 carried it too, and the
build spec carried a whole paragraph reasoning *from* the pre-amendment guide —
"the build spec keeps 30 fps because that is what the guide fixes" — which
would have told the next person to build a comp `npm run validate:templates`
rejects. All four sites are corrected; §10 and the build spec also said
2160×600, which guide §3 amended to 2160×1100 in Block 6. **No code constant
asserts 30**: `core/src/templates.ts` requires 29.97 and uses 30 only as the
rejected case, and the `fps: 30` occurrences in `service/src/**` are test
fixtures. Handoffs and per-session reports were left alone — they are
historical records.

**The image cache no longer keys on `mode.version`.** Every mode field the
image request carries reaches the model *only* as `prompt` or `negativePrompt`,
and both are hashed verbatim, so a mode content hash would be redundant at
best: `modeId` plus the two strings is the whole key. The old comment's
justification — that a bump may change what a **later** slot draws from the
variation axes — does not hold, because that later slot's own prompt then
changes and it misses on its own key, while this slot's cached bytes are still
the right answer to this slot's unchanged request. Two tests pin it: a bump
that adds a template id ⇒ **same** key, an edit reaching either prompt string ⇒
different key. `generate.test.ts`'s "regenerates when the mode version bumps"
asserted the defect and is inverted.

**All 14 existing entries were migrated, free and provably.** Their manifests
record every fingerprint input **except `aspectRatio`** — which was *recovered,
not assumed*: the pre-Block-7 key was recomputed from the manifest plus each
allowed ratio and had to reproduce the directory name, and 14 of 14 did at
`1:1`. $2.064064 of billed spend was on disk. **Verified, not asserted:** all
ten vitasilk production images now hit under the current mode v6, 0 miss. The
other four are Block 4 bake-off entries whose *prompts* were composed at mode
v3; they still miss, and correctly so — the request changed. The migration
renames directories and touches no bytes and no ledger line.

**`ImageCachePayload.modeVersion` is still written** and is now provenance
only, annotated as such at its definition.

### The watermark file

`assets/watermark/intro.mov`, sha256
`99edc6499392f2e72ce3df83b5a0f6a69246b7ab57f1b44c97092e8b8811886e`, copied
byte-identical from `/Volumes/T7 Shield/Framopia/Brand/Logos/Tititit.mov`
(untouched). **23 MB of binary entered git deliberately.**

| | |
|---|---|
| codec | ProRes 4444 (`ap4h`), `yuva444p12le`, 12-bit |
| size | 1924 × 2154, SAR 1:1, **square pixels** |
| duration | **2.035367 s = 61 frames at 30000/1001** |
| colour | bt709 / bt709 / bt709 |
| audio | pcm_s16le stereo 48 kHz |

**Three facts Finder does not show, and each changes what the builder does:**

- **The frame rate is 30000/1001**, the same as every source reel, so the
  overlay needs no rate conversion. Finder's `00:02` hides 61 frames.
- **The audio is NOT silent** — mean −18.3 dB, max −0.5 dB. The watermark
  carries a full-level sound and the build has to decide whether to keep it.
  Nothing in PROJECT_SPEC or ARCHITECTURE anticipates watermark audio.
- **The alpha is premultiplied against black**, and the measurement separates
  the hypotheses rather than assuming they are separable. 2,958,234 partial
  alpha pixels exist across the 61 frames; over 439,105 of them on nine sampled
  frames, **0.0000%** violate the premultiplied prediction and **100%** violate
  the straight one, max excess **0** levels. The guard that makes that
  evidence: the artwork is essentially white (mean max(r,g,b) **252.7** on
  16.8M opaque pixels), so a straight reading would leave a half-transparent
  edge near 255 — it sits at **0.9854** of its alpha instead. On dark artwork
  the same test would decide nothing, and the tool reports **undecided** in
  that case rather than taking the larger number.

**The artwork is full-bleed**: non-zero alpha touches all four frame edges
somewhere in the clip, so the file carries no margin of its own to crop to.

**PROJECT_SPEC §5's watermark TODO is deliberately still open.** Where the
watermark sits in a 2160 × 3840 frame and at what scale is a user ruling, not a
property of the file; the amendment lands in one pass when it arrives.


## Block 7 session 2 — sfx collected, beeps located, the builder blocked

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends, byte-identical. `templates/library.aep` unchanged at
sha `dac234ce…`.

**Status: the session's headline goal did not happen.** No template instance
has been placed. The blocker is below and it is a one-line gap in a tool, not a
design problem.

### The SFX index is real

Four files, copied from `~/Documents/sfx` (**originals untouched**) and renamed
so that two different sounds no longer share a stem. **`hit-2.mp3` and
`hit-2.wav` are different sounds** — the user said so and it was verified, not
assumed: best waveform cross-correlation **0.0537** at any lag, energy spanning
1.06–5.10 s against 0.50–4.27 s, peaks at 2.49 s against 0.59 s, onset spectral
centroid 555 Hz against 136 Hz. Identical audio would correlate at ~1.0.

**Nothing else records which original became which**, so the mapping lives here
and in `reports/block-7-session-2.md`:

| source | repo file | sha256 |
|---|---|---|
| `hit-2.mp3` | `hit_01.mp3` | `67bd3984…` |
| `hit-2.wav` | `hit_02.wav` | `08b9483c…` |
| `whoosh-1.wav` | `whoosh_01.wav` | `9ed0c7ec…` |
| `whoosh-2.mp3` | `whoosh_02.mp3` | `64c4ea6f…` |

The mapping is sorted-filename order. **Nothing was converted, normalised or
re-encoded** — the mp3s stay mp3, at their original sample rates (48 kHz and
44.1 kHz) alongside two 96 kHz wavs. Gains are the user's, deliberately quiet:
**hits −20 dB, whooshes −24 dB**, recorded in `sfx.json`'s own `gainNote` as
starting values to be judged by ear.

**`templates/manifest.json` was not touched: every entry still declares
`sfx: []`.** Which template fires which sound is an unmade ruling. No validator
failed as a result — `validateTemplateManifest` only checks that a *declared*
`sfxId` exists in the index, and none is declared.

**`assertRenderable` still guards nothing, and a real index does not change
that.** It throws only on `manifest.stub`, which has been `false` since Block 6
session 7. `SfxIndex.stub` is validated as a boolean and **read by nothing**;
no code path has ever checked that an sfx file exists before a build. That gap
is unchanged and no guard was added this session.

### The watermark's three beeps

`npm run watermark:measure` now locates them and emits the arithmetic.
**Three bursts**, from an RMS envelope at 1 ms hops with runs closer than 30 ms
joined:

| beep | start s | end s | peak s | frames (start–end) |
|---:|---:|---:|---:|---|
| 1 | 0.033 | 0.133 | 0.085 | 0.99–3.99 |
| 2 | 0.166 | 0.267 | 0.217 | 4.98–8.00 |
| 3 | 0.300 | 0.400 | 0.352 | 8.99–11.99 |

**The count holds at 3 across every threshold from 5% to 30% of peak.** It
collapses to 1 at 1–2% because the beeps ring down into each other and the
envelope floor between them never drops below ~0.9% of peak — a property of the
decay tails, not a different number of beeps. The 30 ms merge gap is
**measured, not chosen**: each beep is a two-pulse tone whose pulses sit ~22 ms
apart while the silence between beeps is ~33 ms.

**The user's ruling resolves comfortably.** Last beep ends 0.400 s; + 1.000 s =
**1.400 s = frame 41.96**, against a video of 2.035367 s / 61 frames —
**inside, with 0.635 s (19 frames) to spare.** Nothing needs extending or
freezing. Read the end time as ±: it moves 0.368–0.400 s across the thresholds
that agree on the count.

### The retiming conflict, counted

`npm run retiming` → `benchmarks/RESULTS-block7-retiming.md`. Every subtitle
card sits at the same place on screen, so a card whose intro begins while the
previous is still held is two cards stacked.

| reading | pairs overlapping | min | median | max |
|---|---|---|---|---|
| A: `inPoint = displayStart − introS` (guide §5 as written) | **162/189 (86%)** | 0.009 s | ~0.090 s | 0.130 s |
| B: `inPoint = displayStart` (intro inside the window) | **0/189 (0%)** | — | — | — |

**Nothing was changed and nothing is recommended** — the choice is the user's
eye on a built comp. Two things qualify the numbers: **no plan in the corpus
stores display timing** (`displayStart` absent on all 194 groups across all five
reels), so these are speech windows and writing display timing can only raise
the count; and 42 groups carry no `templateId` and used the subtitle fallback of
0.13 s, which is not a guess because all four text templates declare the same
`introS`.

### The blocker

**`templates/library.audit.json` does not record layer positions.**
`tools/validate-templates/audit.jsx` emits `{ name, kind }` per layer and
nothing else, so there is no way to compute where a 2160×1100 `sub_pop` comp
must sit inside a 2160×3840 master for `TXT_MAIN`'s baseline to land on
`SUBTITLE_ANCHOR_BASELINE_Y`. The session prompt forbade the two workarounds —
measuring by hand in the AEP, or assuming the layer is centred — so the comp
builder was not written and **no AE work was done at all**. `panel/jsx/build.jsx`
and `service/src/build/` do not exist.

The fix is small and belongs to the audit, which is the thing that verifies:
`audit.jsx` should emit each layer's `Position` and `Anchor Point`, with the
`AuditLayer` type and `validateTemplates` widened to match, then
`npm run audit:templates` re-run. That is a change to a tool, and the ruling the
conversation owes is only whether to make it.

**After Effects was left closed, not open.** A stray `-r quit.jsx` process from
Block 6 session 7 was still resident when this session began, and it executed
after the session's final checks, quitting the application. Nothing was lost —
no AE work had been done — and it was not relaunched.

**The subtitle group that was chosen and not built:** vitasilk `g027`,
wordIds `w0045`/`w0046`, text `dernière génération`, start 14.439 s, end
15.319 s, no display timing, script `latin`, `templateId: sub_pop`,
`supersededBy: null`, group 27 of 41. Retiming under reading A would have been
`inPoint` 14.309, `outPoint` 15.319.


## Block 7 session 3 — the first template instance placed in After Effects

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at sha `dac234ce…` — every
AE operation started a new project.

**A subtitle card is on screen for the first time in this project's history.**
`.local/build/vitasilk-probe.aep` holds a 2160x3840 master with the vitasilk
reel, one `sub_pop` instance carrying `dernière génération`, and one
`img_float` instance carrying a generated cutout.

### The audit records layer geometry now

That was session 2's blocker and it is fixed at source rather than worked
around. `audit.jsx` emits, per layer: `position`, `anchorPoint`, `scale`,
`opacity`, `width`/`height`, `sourceRect` at a named `sampleTime`, the text
style (`font`, `fontSize`, `justification`, `tracking`) and a **keyframe count
per animated property, path-qualified**, found by walking every property group
so effects are covered as well as transform.

**`prop.value` is a trap and the audit now says so in its own output.** An
animated property reports its value at the project's current time indicator —
not at any time the script chose. `sub_pop`'s `TXT_MAIN` first came back at
y **750** with opacity **0**, which is the *start of its intro*, because the
CTI happened to sit on frame 0. Every property therefore carries both `value`
and **`valueAtSampleTime`**, and everything downstream computes from the
latter. Reading the first draft's numbers as settled geometry would have put
every subtitle card 50 px low.

Measured, `sub_pop` / `TXT_MAIN` at sampleTime 1.001001001 s:

| field | value |
|---|---|
| position | `value` [1080, **750**, 0] · **`valueAtSampleTime` [1080, 700, 0]** · 2 keyframes |
| anchorPoint | [0, 0, 0], 0 keyframes |
| scale | [100, 100, 100] · opacity 100 at sample time, 2 keyframes |
| width x height | 2160 x 1100 |
| sourceRect | top −253.285423278809, left −641.366455078125, w 1290.939453125, h 257.137474060059 |
| text | Inter-SemiBold, 343, CENTER_JUSTIFY (raw 7415), tracking 0 |
| animated | Fast Box Blur/Blur Radius 2 · Transform/Position 2 · Transform/Opacity 2 |

`img_float` / `IMG_MAIN`: solid, position [540, 540, 0], anchorPoint
[500, 500, 0], 1000 x 1000 **inside a 1200 x 1200 comp** — it is parented to
`CARD` (1080 x 1080, position [600, 600, 0], anchor [540, 540, 0]), so its
position is in `CARD`'s space, not the comp's.

**`AuditLayer`'s new fields are optional with a default**, so an older audit
still parses — but `requireGeometry` in `core/src/templates.ts` **fails the
validator** when a declared placeholder has no audited `position` or
`anchorPoint`, naming comp, layer and field and saying to re-run the audit. An
absent measurement is not a measurement of zero. The message wording is
asserted by test, not left pinned by reading.

### SFX are bound

Keyword templates fire `hit_01` at `offsetS` 0.13 (where the animation lands,
frame 4); image templates fire `whoosh_01` at `offsetS` 0 (a whoosh leads
motion); **subtitles stay silent** — they fire ~190 times a reel. `hit_02` and
`whoosh_02` are unused on purpose, for template styles not yet built.

`gainDb` is now mirrored in `templates/manifest.json` and `assets/sfx/sfx.json`,
so **a test pins them equal**, along with one pinning the offsets by element
type.

**Derivation fires, and what it exposes matters more than that it works.**
Re-deriving read-only over the corpus: vitasilk 5 events, test-1 4 — **all
whooshes, no hits anywhere**, because **no keyword on any plan carries a
`templateId`** (0 of 2, 0 of 3, 0 of 3). The keyword binding is live and
unexercised.

**The stored events on both plans are stale** and a re-derive contradicts them:
vitasilk stores 8 where derivation gives 5, test-1 stores 7 against 4. The
stored ones carry gains **−12 / −9 / −6** and keyword events for `k001`–`k003`
— the fingerprint of a run against the *stub* manifest, which stopped existing
in Block 6 session 7. **No plan was rewritten**; this is reported, not fixed.

**Validation does not check that a bound sound's file exists on disk.**
`validateTemplateManifest` checks only that the `sfxId` is in the index, and
`validateSfxIndex` never opens the `file` it names. A core test added in
session 2 checks existence at `npm run check` time, which is not a build-time
gate. No new guard was added this session.

### Where display timing went

**`applyDisplayTiming` exists, is complete, and is called** — from
`planImageSlotsForPlan` (`service/src/analysis/job.ts:319`), the image-slot
stage. Line 150 always sets both fields. It is **pure local computation over an
existing plan: no API, no cost.** Run read-only on vitasilk it produces
**41/41** windows, 0 merges, 1 unbuildable.

So the field is absent for a different reason: **the only stage that calls it
has not been run since the call was added.** The evidence is on the plans
themselves — their stored SFX events still carry the stub manifest's gains, and
`deriveSfxEvents` is called eleven lines after `applyDisplayTiming` in the same
function, so both last ran together, before either the display-timing wiring or
the real manifest existed. The `pre-script-grouping` backups from Block 6
session 6 already have zero display timing, which rules out re-grouping as the
cause.

**But `regroup.ts` would drop it anyway.** It constructs fresh group objects
(`service/src/analysis/regroup.ts:167-178`) carrying `id`, `wordIds`, `start`,
`end`, `templateId`, `supersededBy` and optionally `edited` — display timing is
not among them. So re-running the slot stage restores the windows only until
the next re-group.

Consumers, and what each does when it is absent: `displayWindow`
(`display-timing.ts:20`) falls back to speech timing, and `buildability.ts:75`
and `retiming.ts:35` both go through it, so **nothing fails and nothing skips —
every consumer silently measures speech instead.** `validate.ts:234-241`
validates the fields only when present. `timing-budget.ts:111` deliberately
clears them to sweep budgets from speech.

### What After Effects actually did

Every line below is an observation; all of it was assertion before this
session.

| | |
|---|---|
| master fps requested | 29.97002997003 (30000/1001) |
| **master fps as AE stores it** | **29.9700317382812** — off by 1.77e-06 |
| library comps as AE stores them | **29.9700012207031** — a *different* float |
| inPoint requested / AE | 14.309 / 14.309017350684 (+0.00052 frames) |
| outPoint requested / AE | 15.319 / 15.318985652319 (−0.00043 frames) |
| layer anchorPoint (read, not assumed) | [1080, 550, 0] |
| layer position (computed) | [1080, 2330.39990234375, 0] |
| **baseline landed at** | **y 2480.39990234375** against a target of 2480.4 |

**AE stores frame rate as a float32 and the two comps disagree.** The library
comps read 29.9700012207031 — the value of a comp authored by typing "29.97" —
while a comp created from the exact rational reads 29.9700317382812. Both pass
`REQUIRED_FPS` 29.97 with its tolerance. The gap is 3.05e-05 fps, about
7.8e-04 frames across a 25.7 s reel, so it changes nothing today; it is
recorded because "the comps and the master are the same frame rate" is now
known to be false in the strict sense.

The position arithmetic, every term sourced:

```
target baseline (core/src/typography.ts)          x 1080     y 2480.4
placeholder baseline in sub_pop (audit, settled)  x 1080     y 700
comp-layer anchor in master (AE, read back)       x 1080     y 550
position = target − (placeholder − anchor)
  x = 1080   − (1080 − 1080) = 1080
  y = 2480.4 − ( 700 −  550) = 2330.4
```

**Baseline error −9.77e-05 px**, which is float32 storage of 2330.4, four
orders of magnitude below a pixel.

**Nothing was disturbed.** The duplicate's keyframes survived exactly (Blur
Radius 2, Position 2, Opacity 2, before and after); `TXT_MAIN`'s font, size,
justification and tracking are unchanged after the Source Text swap; and the
**original `sub_pop` is untouched** — still one layer, still `kan9olo`, same
keyframe counts, same style.

**Importing `library.aep` brings 11 items**, not 6: a `library.aep` folder, the
six comps, a `Solids` folder and the three solid footage items (`CARD`,
`solid`, `solid`) the image comps use.

**The card is timed on speech, not display timing** — no plan carries any (see
above). A stated limitation of this probe, not a decision about the builder.

**The structured-error contract holds.** Three deliberate failures, each run
for real, each returning `{ok:false, stage, message}` with nothing thrown:
`find-template` for a missing comp and for a missing layer,
`import-footage` for a missing reel.

### A solid IMG_MAIN does accept a replaced source

`AVLayer.replaceSource(FootageItem, false)` on `img_float`'s solid `IMG_MAIN`,
using `img001-c1.cutout.png`. **It works**, and transforms and keyframes
survive — position [540, 540, 0], scale [100, 100, 100], Blur Radius 2 keys,
Opacity 2 keys, all identical before and after.

**But the layer takes the new source's size, and that is a builder
requirement.** `width` x `height` went **1000 x 1000 → 2048 x 2048** and the
anchor point was rescaled with it, [500, 500, 0] → **[1024, 1024, 0]** — the
same *relative* point, half the layer. Scale stayed at 100%, so a replaced
image renders at 2048 px inside a 1200 px comp, **171% of comp width**. The
builder must set scale explicitly after replacement; the template's 100% is
only correct for the original solid.

The cache holds **JPEGs**, not PNGs — the API returns `image/jpeg` — so the
PNG used is the cutout beside the plan.


## Block 7 session 4 — the whole reel, twice

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

`.local/build/vitasilk-full.aep` holds **`master_vitasilk_A`** and
**`master_vitasilk_C`**, 55 layers each: 38 subtitle cards, 3 keywords, 5
images, 8 SFX layers and the reel. **They differ only in subtitle out-points**
— one duplicated comp per element is shared by both masters, so the text and
the artwork are literally the same item in each, and a test in the planner
throws if any other field diverges. 33 of 46 placements are shortened in C, by
0.0706 s on average, 2.331 s across the reel.

### Subtitle wrapping is NOT implemented

Goal 1's premise was that Block 6 session 4 built reusable glyph-outline
machinery. **It did not.** Only its *output* survives: `FONT_METRICS` in
`core/src/typography.ts` carries vertical ink extents (ascent/descent per face)
and nothing horizontal, `benchmarks/RESULTS-block6-band-repertoire.md` is
hand-written and referenced by nothing as an output path, and no committed file
imports fontTools. fontTools 4.63.0 exists in `tools/cv/.venv` but is **absent
from `tools/cv/requirements.txt`**, so it is an unpinned incidental. The
session's instruction was to stop rather than duplicate, and it stopped.
**Every card in the built reel is still clipped at the comp edges.**

### Four data defects, all fixed free and locally

- **`regroup.ts` discarded display timing.** It builds fresh group objects and
  the field was not among them, so every grouping pass silently cleared it. It
  now carries the window through a group that came out **unchanged**, and drops
  it from one it had to **split** — a split group's inherited window was
  computed against a different word set and could hold its card over the next
  one's words. A test fails on the old behaviour.
- **Display timing is on all five plans**: 193 groups gained it, 0 already had
  it. `npm run migrate:display-timing` imports `applyDisplayTiming` rather than
  copying it, so a migrated plan and one written by the slot stage carry
  identical windows.
- **The keyword stage never assigned templates.** `assignTemplates` always
  handled keywords correctly and its own tests passed; the stage wrote every
  keyword with `templateId: null` and never called it, so any keyword run after
  a slot run left them null and SFX had nothing to attach a hit to. The stage
  assigns before writing now.
- **Assignment was script-blind**, and this was found only because goal 4 tried
  to apply it: the seeded shuffle drew from all allowed variants regardless of
  script and would have put `sub_pop_ar` under **20 of vitasilk's 41 Latin
  cards**. It draws per script now, partitioning on the `_ar` suffix
  (`SCRIPT_VARIANT_SUFFIX`), with a per-script counter so each face still
  spreads. Re-derived across the corpus: **0 script mismatches on all five
  reels**, 0 of 8 keywords.

**A fifth defect, inherited from session 1**: re-keying the image cache renamed
every entry's directory and **did not update the plans that name them**, so all
10 of vitasilk's `candidates[].path` pointed at directories that no longer
existed and 4 of 5 image slots were skipped on the first build attempt.
**Nothing was lost** — every file was on disk under its new key.
`npm run repair:candidate-paths` recomputes the fingerprint from the slot's own
prompt and the frozen config; 10 repaired, 0 unresolved, and the mapping
reproduces session 1's migration table exactly.

### SFX re-derived

vitasilk 8 → 8 events but **every one changed**: the stub-era gains −12/−9/−6
became −24 (whooshes) and −20 (hits), and the image offsets moved by up to
0.05 s. test-2 gained its first 3 events. **test-1 went 7 → 6: `hit_01` on
`k003` is gone**, correctly — that keyword was dropped in Block 6 session 6 for
straddling a script boundary, and the stored event had outlived it. A test pins
that derivation cannot produce a gain absent from `assets/sfx/sfx.json`.

### A replaced image is scaled by the builder now

`placeholderScalePercent` = audited solid width / real source width × the
template's own scale. For vitasilk: **1000 px solid at 100% / 2048 px source →
48.828125%**, applied to all five slots and confirmed by AE. **The factor is
never hardcoded** and is tested on a larger source, a smaller one, a template
that already scales its placeholder, and the identity case.

**The rescaled anchor is correct for the template's animation**, which session 3
left open: AE moved `IMG_MAIN`'s anchor [500,500] → [1024,1024] when the source
changed, and both are the centre of their layer, so the keyframed position
still points at the image centre. No template edit is needed.


## Block 7 session 5 — text is measured by After Effects

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

**Subtitles wrap now, and the width comes from After Effects.** Session 4
stopped because no font-metrics machinery existed and a hand-rolled one would
have to model advance widths, kerning and Arabic positional shaping. The
ruling: measure inside AE with **`sourceRectAtTime`**, because a library models
what AE will draw while AE reports what AE draws, and the builder is already
inside AE when it needs the answer. **No font library, no font files, no new
dependency.**

`SUBTITLE_SAFE_WIDTH = 1940` in `core/src/typography.ts` — 110 px clear each
side of a 2160-wide comp. **CHOSEN, NOT MEASURED**; the user's eye on a built
reel is what would move it.

**The split between what is tested and what is not is deliberate and stated.**
`service/src/build/wrap.ts` decides *where* a break goes and is pure and unit
tested against real corpus strings; `panel/jsx/text-fit.jsx` decides *whether*
one is needed and **cannot be tested outside a running AE**. The report says
which is which rather than implying the whole is covered.

### What the corpus actually measures

`npm run wrap:survey` — **193 cards in 2.9 s**, so measuring every card is not
a cost a production build needs to design around.

| | |
|---|---|
| one line | 140 |
| wrapped to two | **53** |
| single word wider than the bound | **0** |
| still over the bound after breaking | **7** |

**The case the ruling does not cover never arises as a whole card** — every
card that exceeded the bound had a space to break at. It arises as a *line*:
**7 cards have one line still over after breaking**, all of them a single long
word — `polynucléotides`, `mésothérapie` ×2, `hyaluronique` ×2, and
`matrddadich`. They are emitted whole and flagged; nothing is shrunk and
nothing is broken mid-word. **This is the conversation's to settle.**

**The source rect is transform-independent, checked rather than assumed.**
`TXT_MAIN`'s Position is keyframed 750 → 700, and the rect is byte-identical at
t=0 and at the sample time on all four text templates. The sample time is the
comp mid-point, past the intro, explicit — never `prop.value`, which Block 7
session 3 lost 50 px of baseline to.

**Wrapping does not move the first line, on any of the 53 wrapped cards.** The
approved baseline at y 2480.4 survives, and `EXTRA_LINES_RENDER_BELOW` is now
confirmed against real cards.

**The obvious test for that would have been wrong, and nearly was reported.**
Comparing the one-line rect's `top` against the wrapped rect's `top` flags **19
of 53** — but `top` is the distance from the anchor to the top of the *ink*, so
it moves whenever the break sends the tallest glyph to line two. A card losing
its only capital reads as "the line moved" when nothing moved. The honest
comparison is the wrapped rect's top against **line one measured on its own**,
and by that measure nothing moved.

### A build refuses to run on stale pointers

`service/src/build/preflight.ts`. Session 4's first full build **silently
skipped 4 of 5 image slots** because session 1's cache re-key had left the
plan's candidate paths dead. Every referenced file — footage, candidates,
cutouts, SFX audio, the template AEP — is now checked **before anything is
built**, every missing path is collected and reported together, and the build
fails rather than producing a comp with gaps. Proven live on a deliberately
broken plan copy; **the check fires in TypeScript before any `DoScript`, so AE
is never touched.** The message wording is asserted by test.

**No plan currently has a dead pointer**: 42 references across the five plans,
0 missing.

### timing-budget and validate-plan now agree

They disagreed 11 to 7 since Block 6, and both causes are gone. Re-running them
found a **third** problem first: session 4 computed display timing **before**
templates were assigned, so on ground-truth, test-2 and test-3 the floor was
null, nothing extended and nothing merged, and the stored windows were wrong.
Recomputing after assignment fixed it — and a merge creates a new group with no
template, so `migrate:templates-sfx` has to run **after**
`migrate:display-timing`, not before.

Both tools now report the same thing across the corpus: **7 unbuildable
subtitle groups and 1 unbuildable keyword**. Group counts moved as merges were
applied: ground-truth 40 → 39, test-1 43 → 42, test-2 38 → 37.

### The reel, rebuilt

`.local/build/vitasilk-full.aep` — `master_vitasilk_A` and `master_vitasilk_C`,
**55 layers each** (38 subtitles, 3 keywords, 5 images, 8 audio, 1 footage),
46 elements, 0 skipped, **1.3 s**. Still differing in exactly one thing:
subtitle out-points.

**9 of vitasilk's 41 cards wrap**, including `g027` "dernière génération"
(3228 → 1361 / 1751) and `k001` "filler glow". **`g040` "matrddadich wla" still
overflows**: line 1 alone is 2048 px against the 1940 bound.

The playhead is parked on **`g004` "minutes ymkn" at 2.609 s**, a card that
wrapped cleanly — chosen inside AE after measuring, since nothing outside knows
which cards wrapped.


## Block 7 session 6 — one word per card, and what was wrong at 4 s

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

### The 4 s report: the timings are right

**Checked against the raw Scribe response in the transcription cache** — the
only independent record of what was said when. All 21 words in 1.5–8.0 s sit on
an interval Scribe reports, for the same word: `minutes`/`minutes.`,
`ymkn`/`يمكن`, `un`/`un`, `soin`/`soin`. **The alignment is correct.**

Corpus integrity: **13 zero-duration words, and all 13 are interpolated** — no
word with a real Scribe anchor has zero duration. **Nothing is non-monotonic
anywhere.** `confidence` is Scribe's value on an anchored word and `null` on an
interpolated one, so **alignment quality is auditable after the fact**, which
had been in doubt.

**`sourceText` is off by one on every word of every reel**, and it is cosmetic.
`plan-builder.ts` documents it as "the draft word the corrected word anchored
to" but assigns `draftWords[i]?.text` — a positional index into a different
array, which the correction pass's insertions desynchronise. Nothing reads it.
**A real defect, not this one.**

**The diagnosis is two candidates and the data does not separate them.** The
second word of a two-word card is on screen before it is spoken — pooled median
**0.410 s**, max 0.870 s — and in the flagged span the cards are 0.36–0.78 s
long, so the anticipation is most of the card's life. But `w0012` "li" is
0.080 s and `w0013` "ghayrdd" is 0.020 s, so two cards also flash through in
under a fifth of a second right there. Both produce "out of step"; naming one
would be a guess. **Neither is a defect of this block.**

### One word per card

`MAX_WORDS_PER_CARD = 1` in `service/src/transcription/grouping.ts`, amending
PROJECT_SPEC §5. The two-word machinery is kept behind a `maxWords` option
rather than deleted, and every test that exercised it now says so explicitly.

**The cost, measured before implementing:**

| | before | after |
|---|---:|---:|
| cards across five reels | 190 | **343** |
| unbuildable (shorter than intro + minHold) | 7 (3.7%) | **120 (35%)** |

**Three invariants had to widen, and the third was found by the validator
refusing to write.** A keyword span of two words no longer collapses into one
card; it supersedes the two cards it covers. That rule lived in `regroup.ts`,
in `buildability.ts`, and — the one nobody remembered — in
`validate.ts`'s `checkSupersession`, which stopped the migration mid-run with
"keyword k002 already supersedes g021". **Nothing was written half-migrated**:
`writeEditPlan` validates first, so `ground truth` (no keywords) had written and
the other four were untouched.

**The merge rescue is off**, and that is deliberate: at one word per card every
adjacent pair is mergeable, so display timing would have merged the cards
straight back into pairs. A card that cannot reach its floor is reported, as
before.

**The stage order inverts at one word per card.** Session 5 established display
timing before assignment, because a merge created a card with no template. With
merging off nothing changes identity, and display timing needs each card's
template floor — so **assignment must now come first**. Run the old way it reads
a null floor and calls every card buildable, which is exactly the defect
session 5 found on three reels; the first dry run here reproduced it (`0`
unbuildable everywhere) before the order was fixed.

**Wrapping almost disappears**: 9 of vitasilk's cards wrapped at two words, **1
at one word** — and that one is a two-word keyword. `matrddadich` (2048 px)
still overflows, being a single word with no break point.

**Conflicts, reported and not resolved.** Multi-word Arabic §6 terms:
**13 runs of 2+ words across the corpus, 10 split under two-word cards, all 13
split under one word — strictly worse.** Term-aware grouping stays
unimplemented, per Block 6. Two-word keywords, flagged for the user's eye:
test-1 `k002`, test-2 `k002`/`k003`, vitasilk `k001`/`k002`.

### How big the images could be

`npm run image-size` → `benchmarks/RESULTS-block7-image-size.md`. **No constant
was changed.** vitasilk `img001` is placed at 352 px today against 378 filling
its zone and **699 with the zone rectangle removed** — the zone was always a
conservative device for finding free space, never a product rule.

**The binding constraint is the head on all nine slots**, named per slot for
the first time.

**(c) is not uniformly the largest, and that is a property of the measurement
rather than of the geometry**: it unions a head *bounding box* over the frames a
slot is on screen, while zone derivation intersects per-frame maximal free
rectangles from the full person mask. On vitasilk `img002` that makes (c) 523 px
against (b)'s 800. The report says so rather than presenting (c) as the ceiling.

`HEAD_CLEARANCE` is now mirrored into `service/src/placement/constants.ts` and
**pinned equal to `zones.py` by a test**, as the repo rule requires.


## Block 7 session 7 — the image fill, the missing words, and the hold

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

### Images are small for two reasons, and neither is the file's canvas

The user's hypothesis was that a generated file does not fill its own canvas.
**Measured over all 20 files: it mostly does.** Originals reach a median 1.000
of the long edge. Only one slot renders from a cutout at all, so the cutout
column is two numbers and no median should be read from it.

**What is small is the subject inside the picture**, measured from each file's
own matte: a median **0.701** of the long edge, as little as **0.548**. And
**both image templates put `IMG_MAIN` at 1000 inside a 1200 comp**, losing a
further 16.7% before a pixel is drawn. Multiplied out, the worst slot shows its
subject at **0.567** of the square it was given. **Every effective image size
published before this session was overstated by roughly that factor.**

Effective subject size on screen today, never reported before: img001 **266 px**,
img002 421, img003 287, img004 534, img005 435 — on a 2160-wide frame.

**Scaling is now by content, not canvas** (`service/src/build/content-box.ts`).
A file whose content already fills its canvas gets exactly the previous number,
so nothing that was right changes; img002 goes 48.83% → **71.74%**, img001
48.83% → 53.94%.

**The content is centred by the anchor point, not the position.**
`img_slide_left` keyframes `IMG_MAIN`'s Position and After Effects refuses
`setValue` on a keyframed property — found by the build failing. Setting the
anchor to the content's centre moves the picture inside the layer while the
template's own motion plays over it untouched.

**A mismatch found on the way:** vitasilk `img004` is presentation `card` on
`img_slide_left`, the **cutout** template. Template assignment is a seeded
shuffle that does not read `presentation` — the quality gate sets that later.
Nothing fails; the card simply has no frame. Reported, not fixed.

### The words with nothing on screen

`0:00:08:23`–`0:00:11:27` at 30000/1001 is **8.767–11.901 s**.

**Nothing is skipped.** `buildReel` drops a card only for a missing template,
missing display timing or a missing file — never for being short. The cards are
all placed. What makes them unreadable is that **a card's whole life can be
shorter than its entrance**: `sub_pop` animates opacity and blur over
`introS` 0.13 s, which is 3.9 frames, and a card on screen for 0.040 s is 1.2
frames. It never reaches full opacity.

**And there is a real alignment shift in that span, which is the second half of
the answer.** Scribe reports 10 word tokens there; the plan carries 11. The
correction pass inserted `mn` and merged Scribe's `ستة` + `وعشرين` into `26`,
and Levenshtein anchoring carried the mismatch forward: `ghir` opens at 8.939,
the interval of `من`, while `غير` is spoken at 9.079; `il` opens **0.540 s**
before its token. **This is `align.ts`, a Block 2 question**, and one-word cards
did not cause it — they made it visible word by word instead of blurred across
a two-word card.

**It also corrects a claim from session 6.** Checking "does this interval exist
somewhere in the Scribe response" passes 7 of 11 here and passed 21 of 21 over
1.5–8.0 s. An interval can be real and belong to a different word; the check
was too weak to have established what it was taken to establish.

### A card holds until the next word

`MAX_SUBTITLE_HOLD_S = 1.2` in `display-timing.ts` — **CHOSEN, NOT MEASURED**.
Only 3 cards in the corpus reach it.

**Blank screen across the corpus: 17.25 s → 0.66 s.** Median card duration
0.24 → 0.30 s.

**It does not reduce the unbuildable count at all: 120 before, 120 after**, and
that is arithmetic rather than a disappointment. The old rule already extended
to the next card's start whenever the floor could not be reached, so the cards
that were short stay exactly as short. What the hold changes is the cards that
*could* already reach their floor — they now hold instead of stopping.

`0 unbuildable` on a dry run is the null-floor defect, not success; it was
checked for explicitly and the run reported 120.

### `sourceText` is fixed

`plan-builder.ts` took `draftWords[i]`, a positional index into a different
array. The aligner knows which draft token each corrected word matched, so
`TranscriptWord.sourceText` carries it and `buildTranscript` reads it.

**The repair was got wrong once and the wrong version was written.** Re-running
the aligner from the cache produced a *different* alignment from the one whose
timings are on the plan, so `sourceText` briefly described one alignment beside
timings from another. Repaired again by matching each word's **stored interval**
against the cached Scribe response, which is exact and self-consistent; all 343
words are now correct, and the alignment shift above is visible in the field
rather than hidden by it.


## Block 7 session 8 — the zone rectangle is the strict rule

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

### Nothing may be placed outside the frame, and now nothing is

The user saw an image cropped at the left edge. **`img001` at the variant (c)
size crossed the left frame edge by 130 px — and `img005` crossed the top by
22 px in (c) and 2 px in (b), which nobody had reported.**

The cause: `satisfiesHardConstraints` checks `insideFrame`, but **only the
solver calls it**. Session 7's size variants reused the solved centre with a
larger side and were bounded by nothing. `fitInsideFrame` in
`placement/geometry.ts` is now the last step of every variant path: it moves the
square in rather than shrinking it, and shrinks only when the square cannot fit
the frame at all.

**Block 5 decision 10's property still holds.** Content-aware scaling changes
`IMG_MAIN`'s scale *inside* the comp, not the comp layer's footprint in the
master, so the placed rect is unchanged and jitter still cannot leave its region
by construction. What content-aware scaling *can* do is push the file's canvas
past `IMG_MAIN`'s 1000 box; it stays inside the 1200 comp for every file in the
corpus, and the transparent margin is what overflows on the one cutout.

Seven tests, including both real escapes and a sweep of every stored placement
on all five reels at every side a variant can ask for.

### What each constraint is worth

`npm run image-ceiling`, one relaxation at a time, everything else held:

| relaxation | mean gain |
|---|---:|
| all of the above | **1.96x** |
| drop the zone, `HEAD_CLEARANCE` 0 | **1.78x** |
| drop the zone, hair is not head | 1.59x |
| `FILL_FRACTION` 1.00 | 1.12x |
| `CARD_EDGE_CLEARANCE` 0 | 1.12x |
| `CARD_EDGE_CLEARANCE` 0.01 | 1.05x |
| `SCALE_JITTER` 0 | 0.99x |

**The answer to "which rule is too strict" is the zone rectangle**, worth ~1.8x
against 1.05–1.12x for every constant inside it. `SCALE_JITTER` does not move
the ceiling at all — it varies the realised side around `FILL_FRACTION`.

**The zone is derived from the person mask, not the head mask**, so
hair-versus-face changes nothing while the zone is in force. It only matters
once the zone is dropped.

### A face-only mask, as a parameter

`selfie_multiclass_256x256` is a softmax over 0 background, 1 hair, 2 body skin,
3 face skin, 4 clothes, 5 accessories. `HEAD_CATEGORIES` is (1, 3);
**`FACE_CATEGORIES` is (3,)**. Accessories are deliberately excluded — the same
category carries a held bottle as carries glasses.

| reel | head reaches y | face reaches y | freed |
|---|---:|---:|---:|
| ground-truth | 0.6740 | 0.4052 | 0.269 |
| test-1 | 0.5917 | 0.4062 | 0.185 |
| test-2 | 0.5885 | 0.4208 | 0.168 |
| test-3 | 0.7292 | 0.4719 | 0.257 |
| **vitasilk** | **0.9521** | **0.5281** | **0.424** |

**The honest risk, with numbers:** the face mask's *top* sits 44–128 px below
the head's top (median; 216 px worst on vitasilk), so a band of hair above the
face becomes placeable. `HEAD_CLEARANCE` is 86 px, which covers that band on
three reels and not on vitasilk. **Nobody has looked at whether category 3
covers a bespectacled face closely enough** — no face contact sheet was
rendered, and that is a gap.

**Both masks are written and both stay selectable.** `HEAD_THRESHOLD` stays
0.25 for both.

**A caveat on how the mask was obtained**, because the goal forbade new
inference: face-only is **not derivable from what was stored** — only person
(sum 1..5) and head (sum 1,3) were persisted, and neither hair nor face is
separable from those. It was obtained by re-running the **same sha256-pinned
model** over the same frames, free and local, 39 s for all five reels, with
`_write_or_verify` confirming all existing masks byte-identical. That is a
reading of "no new model, no new inference" as "no new segmentation and no
cost"; under the stricter reading this goal should have stopped.

### The variants, and a second defect they exposed

`master_img_strict` / `_loose` / `_face`, image handling the only difference.

**Building them on the solved centre put an image across the speaker's face on
two slots.** A square that fits *somewhere* is not a placement — the centre the
solver chose belongs to the smaller square. The variants now carry the position
the ceiling measurement actually found. **Verified after the fix: 0 face
overlaps, 0 frame escapes in all three comps.**

| slot | strict subject | loose | face |
|---|---:|---:|---:|
| img001 | 265 px | 733 | 629 |
| img002 | 421 px | 452 | 512 |
| img003 | 287 px | 770 | 718 |
| img004 | 534 px | 787 | 741 |
| img005 | 435 px | 769 | 728 |

`loose` exceeds `face` on several slots because each relaxes one thing: `loose`
drops `HEAD_CLEARANCE` while `face` keeps it.

**`master_img_max` was not built.** Goal 4 conditioned it on the face-only mask
leaving real margin at the face; at `HEAD_CLEARANCE` 0 there is no margin by
construction, and nothing has verified the mask does not under-cover a real
face. The condition was not demonstrated, so the comp was not made.

**Every image in `loose` and `face` overlaps the speaker's body or clothing**;
one overlaps hair. That is the judgement the user is being asked for.


## Block 7 session 9 — top-left images, framed, and a fix that was measured and rejected

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

### Images are top-left, on every reel

**A user ruling and a deliberate departure from PROJECT_SPEC §4 and
ARCHITECTURE §5.5**, both of which place images in automatically-found negative
space. His reason: in this format the top-left corner is reliably empty and the
only real constraint is the speaker's face.

**Verified before implementing.** The corner clears the face mask by **834 to
995 px** on all five reels (0.386–0.461 of frame width) — so the ruling holds
beyond the one reel it was made on. Against the head mask it is 523–951 px.

**It costs a little size.** Against session 8's `master_img_face`: img001 equal,
the other four **3.2% to 7.5% smaller**. Worth knowing; the user ruled on the
corner, not on the last 7%.

**Zero concurrent image pairs** across all five reels, so nothing stacks in the
corner and that sub-question does not arise.

`TOP_LEFT_MARGIN` 0.03 and `TOP_LEFT_JITTER` 0.06, both **chosen, not
measured**. **Jitter is one-sided** — it can only shrink the square, so it can
never grow onto the face or past the frame, holding by construction rather than
by a clamp. Measured across all nine slots: **0 outside the frame, 0 overlapping
the face.**

**The zone machinery is retired for automatic image placement, not removed.**
Manual zones still round-trip, the derivation stays, and the plans keep their
solved placements — the same treatment Block 6 gave torso geometry.

### Every image is framed, and the frame now fits

`img_float` is forced for every slot. On vitasilk that changes **img002 and
img004** (previously cutout and a card carrying the cutout template).
`img_slide_left` stays in the library and the manifest and still validates.

**Consequences, stated rather than acted on:** `presentation` and the cutout
gate now decide nothing about how an image renders — the gate, the metrics and
the sidecar are untouched, and Block 8's panel is where presentation may become
a per-slot choice again. Background removal still runs and still costs local
CPU producing an artifact nothing displays; **whether to keep generating cutouts
is a ruling for the conversation.**

**The frame misalignment, diagnosed from the audit rather than guessed.**
`audit.jsx` now records each layer's **parent**, which decides whether a
position is in comp space or the parent's. `IMG_MAIN` is parented to `CARD`;
`CARD` is 1080 px in a 1200 comp and does not scale with the picture.

Session 7's content-aware scaling sizes the **content** to the solid's 1000 px.
That is right for a cutout, whose margin is transparent, and wrong for a card,
whose margin is picture: the canvas then renders at `1000 x canvas/content` and
spills past the frame whenever content fills less than **1000/1080 = 0.926** of
its canvas. Verified against real slots — img001 at 0.905 overflows by 25 px,
img002 at 0.681 by 388 px, and the three above 0.926 fit. **Two of five, which
is exactly the "some slots" reported.**

**Fixed in the builder, not the template**: a card is sized by its canvas
(`canvasScalePercent`), so every picture renders at 1000 px inside the 1080 px
frame whatever its content fraction. Confirmed on the build: all five slots now
render 1000 px.

### The face mask has been rendered for review

Five contact sheets in `benchmarks/results/latest-face/`, made by reusing the
sidecar's `head_overlay` task — it tints whichever mask it is handed. **Nothing
is frozen on my reading of them; the user rules.**

### The aligner fix was implemented, measured, and reverted

**The defect is precisely located.** On vitasilk the aligner emits `delete` on
draft token 27 (`من`) and then substitutes shifted by one: `mn` takes `غير`'s
interval, `ghir` takes `أنه`'s. **The cause is that the draft is Arabic script
and the corrected text is Arabizi**, so every pair in the run is a tied-cost
substitution and Levenshtein has no signal at all — the path it picks among the
ties is arbitrary.

**The fix I wrote made it worse and was reverted.** Requiring an anchor to be a
match or a same-script substitution removed nearly every anchor, and the
remaining Latin tokens paired across long distances: `fih` anchored to
`vitamin`, `26` to `et` — a three-token shift against the old one-token one —
seven words became zero-duration points, and two duplicate intervals appeared.
Measured before applying; **no plan was written.**

**`align.ts` is unchanged. The defect stands.** It needs transliteration-aware
matching — knowing that `ghir` is `غير` — which is real Block 2 design work, not
a tie-break tweak.

**The correspondence check exists and passes**, which is itself the finding: the
aligner never gives a word an interval belonging to a token other than the one
it records anchoring to. The defect is that it picks the wrong *pairing*, and no
check on the aligner's own output can see that without knowing what the words
mean.

### A short card gets a faster entrance

`shortCardTiming` in `service/src/build/short-card.ts`: where a card cannot fit
`introS + minHoldS`, the **instance is time-stretched** — never re-keyframed,
per TEMPLATE_LIBRARY_GUIDE §5. `MIN_INTRO_S` is two frames, **chosen, not
measured**.

**120 of 343 cards get a shortened entrance, 28 land on the two-frame floor, and
0 cards remain unbuildable.** On vitasilk: 22 shortened, 5 on the floor.


## Block 7 session 10 — the watermark, and the block closed

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

### The watermark is built

`service/src/placement/watermark.ts`. Every figure below was read back from
After Effects, not assumed.

| | |
|---|---|
| alpha interpretation | `mainSource.alphaMode = AlphaMode.PREMULTIPLIED`, `premulColor [0,0,0]`; **AE reports 5414, which is `AlphaMode.PREMULTIPLIED`** |
| size | **216 x 242 px** from 1924 x 2154 — scale **11.2266%** |
| duration | 0 to **1.39998 s**, frame **41.96 of 61** — inside the file |
| audio | **−20 dB**, both channels |
| layer index | **1**, with **0 layers above it** |
| corner on vitasilk | **top-right**; top-left rejected because the image is there |

**The width is what is fitted**, not the height: the artwork is 1924 x 2154, so
squaring it off would distort it. `WATERMARK_WIDTH_FRACTION` 0.1,
`WATERMARK_MARGIN` 0.03 — both **chosen, not measured**.

**The duration is derived, not hardcoded.** `npm run watermark:measure` now also
writes `.local/build/watermark.json` with the measured beeps, and the builder
takes `lastBeepEndS + WATERMARK_HOLD_AFTER_LAST_BEEP_S`. A different watermark
file recomputes; a test pins that a beep at 0.9 s gives 1.9 s.

**The corner is a seeded shuffle** over the corners that are actually free, on
the Block 3 decision 10 precedent — never on the face, never in the subtitle
band, never over an image on screen at the time, never outside the frame. Eight
tests, including the real vitasilk face box across forty seeds.

### The alignment defect is written up

`docs/DEFECT-alignment-script-mismatch.md` — the symptom, the mechanism with the
`delete` on `من` quoted from a live run, the discarded same-script fix and its
measured regression, why the correspondence check cannot see it, and what a real
fix needs (transliteration-aware cost from ORTHOGRAPHY_GUIDE §2's table).

**The scale nobody had: 209 of 343 words — 61% — sit in a cross-script
substitution run**, across 49 such runs. Most land correctly by accident of the
DP; a run whose token counts disagree throws the whole run out.

### An unplaced element is now fatal

The seventh error path did not return one: an image slot with no placement was
logged and built around. By session 5's own principle — a comp with gaps is
worse than no comp — `assertAllPlaced` now refuses, naming the count, the
element and the reason. **All seven error paths are proven.**

### The checkers are stale against the builder

~~`timing-budget` and `validate-plan` agree with each other — 120 subtitle cards
plus 1 keyword below the 0.23 s floor — and both now disagree with the
builder.~~ **Fixed in session 11: both read the builder's own rule and report
28.** See the session 11 section.

### Only vitasilk builds end to end

| reel | cards | short intro | keywords | image slots | sfx |
|---|---:|---:|---:|---|---:|
| ground-truth | 76 | 33 | 0 | 0 | 0 |
| test-1 | 67 | 21 | 2 | 4, **no candidate files** | 6 |
| test-2 | 69 | 26 | 3 | 0 | 3 |
| test-3 | 58 | 18 | 0 | 0 | 0 |
| vitasilk | 73 | 22 | 3 | 5 with files | 8 |

Everything the other four are missing is behind a **billable** stage — keyword
analysis, slot planning, image generation. Nothing is broken.


## Block 7 is complete — session 11 closed it

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends. `templates/library.aep` byte-identical at `dac234ce…`. One After
Effects instance (PID 44015) throughout.

### The watermark runs a flat second

`WATERMARK_DURATION_S = 1` in `service/src/placement/constants.ts` — **the
user's ruling**, replacing "one second after the last beep" once he had seen it
built. Read back from AE: `outPoint` **1**, frame 29.97 of 61, index **1** with
**0 layers above**, `alphaMode` **5414 = AlphaMode.PREMULTIPLIED**, audio
**[-20, -20]**.

**The beep measurement is kept and repurposed.** It no longer sets the duration,
so `assertBeepsFitWatermark` checks the last beep finishes before the mark
leaves — a future file whose beeps run long fails loudly rather than being cut
mid-beep. Current margin: last beep **0.400 s** against **1.000 s**, so
**0.600 s spare**.

**The audio ends with the picture** because both are the same AV layer and AE
bounds a layer's audio by its out point. AE reports `hasAudio true`,
`audioActive true` and `outPoint 1`. **Not verified by rendering** — nothing was
rendered — so this rests on AE's layer model plus the out point read back.

**The retired test is gone**, not left green: session 10 pinned that a 0.9 s
beep recomputes to 1.9 s, which is now false. It is replaced by one pinning the
flat second and four pinning the new assertion.

### The reporting tools now report what the builder does

`timing-budget` and `validate-plan` said **120** cards were unbuildable while
the builder placed all **343**. Both now read `cardMinimumDurationS` from
`service/src/build/short-card.ts`, the rule's single declaration, and both
report **28** — the cards whose hold is clipped because their entrance has
already compressed to the two-frame floor.

**"Unbuildable" was the wrong word and is not used any more.** Those 28 are
built; their hold is truncated. The predicate is `cardHoldFits`.

**The floor is 0.118 s, not 0.230 s.** With the entrance compressible to two
frames, the sum scales with it: `(introS + minHoldS) × MIN_INTRO_S / introS`.

**A second home nobody had named.** `sweepTemplate` in `timing-budget.ts` split
the budget evenly between intro and outro, with a comment saying only the sum
was ever read. That stopped being true the moment the rule began compressing the
**entrance** alone — halved, the sweep measured twice the builder's floor. The
whole budget is the entrance now, matching the built templates' `outroS: 0`. Six
homes of the floor arithmetic were searched before changing it; this was the one
that mattered and it was found by the figures still disagreeing after the first
fix.

**Four tests asserted the retired behaviour and were rewritten**, including one
literally named "only the sum is ever compared".

### The widened timeout, measured and narrowed

Session 10 widened the cutout test from 120 s to 420 s. Re-measured with After
Effects idle: **one cutout 18 s against 72 s under load**, and **the whole test
39 s against Block 4's 35 s**. **It was contention, not a slowdown** — nothing
in the CV path got slower. The bound is **240 s**, which clears the measured
loaded case (~153 s) with headroom and is not wider than the measurement
justifies.

### Block 7's definition of done

| item | verdict |
|---|---|
| a run on the fixture produces a correct comp | **met** |
| all error paths return structured errors | **met** — seven proven |
| **headless** | **NOT met** |

**"Headless" is not met and never was.** Every AE operation goes through
AppleScript `DoScript` into an already-running After Effects. `-r` is unusable
here: a resident `-r` process was observed executing its body a session later
and quitting the application. The builder cannot run without a person having
opened AE. That is Block 10's golden-run problem.


## Block 8 session 1 — housekeeping and the alignment review sheet

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at
both ends, byte-identical. **No panel code was written**, deliberately: this
session did housekeeping, reproduced the aligner defect record, and built one
read-only instrument. No pipeline behaviour changed and no plan was touched.

**The defect record does not fully reproduce, and the cause is which cache
entry it was read from.** `docs/DEFECT-alignment-script-mismatch.md` is
**unchanged** — nothing was reconciled and nothing was decided. What is now
known:

- Its per-reel rows for `ground-truth` (51 at risk), `test-1` (43), `test-2`
  (46) and `test-3` (29) reproduce **exactly** under the active `promptVersion`
  4 entries.
- Its `vitasilk` row (73 words, **40** at risk) reproduces exactly only under
  `transcription-0cb5401192dbfbc7`, **prompt version 1**. Under the active v4
  entry the figure is **39**, so the corpus total is **208 of 343 (61%), 49
  runs**, against the doc's 209.
- Its §2 trace — `delete` on draft token 27 `من`, draft 72 against corrected 73,
  the tokens `ينغّي،` and `ييدرات.` — is the **prompt v1** entry throughout.
  **Under v4 there is no delete of `من` at all**: the only delete on the reel is
  `ما` at draft index 67, and the one-token shift arises from an **insert** of
  `mn` at corrected index 28 instead.
- The `il` **0.540 s** figure reproduces only under the **prompt v3** entry.
  Under v4 the same word, `il` at corrected index 31, anchors to `أنه`
  9.279–9.759 while the next draft token opens at 9.779 — **0.500 s**. Prompt
  v1 has no `il` token in its corrected text at all.

**The symptom survives all three configurations; the quoted mechanism does
not.** `il` still opens half a second before the token it belongs to under the
configuration the pipeline actually runs. Which trace to treat as the record is
a ruling this session did not make.

**A reel can hold several transcription cache entries and nothing named which
one a figure came from.** `vitasilk` holds three (prompt versions 1, 3 and 4);
the other four reels hold two each (3 and 4). `repair-source-text-cli.ts`'s
`cachedFor` still takes the **first** `transcription-*` directory `readdir`
returns, which is not necessarily the active configuration. Reported, not
changed.

`npm run align:review` is the instrument built for it. Pure logic is in
`core/src/align-review.ts` — `buildAlignmentRows`, the `AlignReference` schema
and its parser — on the `validateTemplates` precedent, so it is tested inside
`npm run check` while `tools/align-review/` stays a thin CLI plus the HTML
renderer. The sheet is dark-first Framopia brand per PROJECT_SPEC §6, self
contained, no CDN and no build step, `dir="rtl"` set **per token** and never on
a row or a container.

**The tool is pinned read-only by a test, not by a comment.** It may import
only `@framopia/core/align-review` (a new subpath export whose graph is `align`
and `normalizeToken`) plus `node:fs`, `node:path` and `node:url` — **not the
`@framopia/core` barrel, which re-exports `appendCost`**, and not
`node:child_process`, which is why the HEAD sha is read out of `.git` rather
than by shelling out to `git`. The test strips comments first: the rule is
about what the code does.

**Verdicts are never generated.** `benchmarks/references/align/README.md`
records that a reference file is a hand-made human judgment, the only
non-circular measure of aligner correctness in the project, and names the
limitation — a `wrong` verdict identifies a bad pairing without identifying the
right one, so adopting a fix needs a second human pass over only the rows that
fix changed.

Sheets generated for all five reels. Cross-script pairings under prompt v4:
ground-truth 51/76, test-1 43/67, test-2 46/69, test-3 29/58, vitasilk 39/73.

## Block 8 session 2 — cache-entry selection made explicit

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends, byte-identical. No panel code. **No plan was written and no aligner code
changed.**

**Session 1's `Status: PROBLEM` is explained, and the cause was a real defect.**
Three diagnostics selected a transcription cache entry by taking the first
`transcription-*` directory `readdir` returned. On this volume that is the
pinned prompt v4 entry for `ground-truth`, `test-1`, `test-2` and `test-3`, and
the **prompt v1** entry for `vitasilk`, because `0cb5…` sorts ahead of `758a…` —
**exactly the mixture the defect document carried.** The sites were
`cachedFor` in `service/src/transcription/repair-source-text-cli.ts` and
`scribeWordsFor` in `service/src/analysis/missing-cards-cli.ts` and
`service/src/analysis/timing-defect-cli.ts`. All three now use the declared rule
above. **The production paths were never affected**: transcription, analysis and
image caches all resolve by computed fingerprint through `cacheEntryDir`.

**The `il` 0.540 s figure is still unattributed.** It matches the prompt v3
entry, which is *last* in the same listing — a selector that kept the last hit,
or a hand-named entry, would produce it, and nothing in the repo records which.
Written up as a hypothesis with its evidence in the defect document, not as a
conclusion.

**The edit plans and the built comp are correct.** `vitasilk`'s 73 plan words
are byte-identical to the pinned v4 entry's corrected texts (0 positional
diffs); the v1 entry differs from it by 14 words and the v3 entry by 10.
`.local/build/.build-options.json` matches the plan exactly — 68 subtitle cards
(73 groups less 5 superseded), 3 keywords, 0 text mismatches.

**One thing downstream was damaged and is deliberately not repaired.**
**9 of `vitasilk`'s 73 words carry a `sourceText` written from the prompt v1
draft** — `w0017`, `w0032`, `w0033`, `w0034`, `w0054`, `w0055`, `w0070`,
`w0071`, `w0072`. Block 7 session 7 ran `npm run repair:source-text --apply`
and reported 343/343 correct; it was reading the wrong draft on that one reel.
The other four reels are clean (0 corrected). `sourceText` is cosmetic — nothing
reads it — but Block 8's transcript editor is where it surfaces.
`npm run repair:source-text` now reads the pinned entry and reports the 9;
**running it with `--apply` fixes them.** Not done here: the session's goal
ended at the finding.

**`benchmarks/RESULTS-block7-missing-cards.md` was wrong and is regenerated.**
Its §4 anchor table described the **v1** draft (`ينغّي،`, `ييدرات.`, and three
anchors reported as "none"); against the pinned draft those are `ينغى,`,
`يهدئ.` and real anchors. Its display-window columns were separately **stale**,
predating Block 7 session 9's hold rule.

**`npm run diagnose:timing` had been crashing** and could write no report at
all: one word per card since Block 7 session 6 leaves `anticipation` empty on
every reel, and the pooled row indexed `pooled[0]`. It degrades honestly now —
the row prints `—` and the diagnosis says the figure cannot be recomputed
rather than restating a number measured before the change.

**The defect document is rewritten in two parts**, `docs/DEFECT-alignment-script-mismatch.md`:
**§A Current evidence**, every figure stamped with reel, entry id, prompt
version and the git sha at derivation; **§B Superseded figures**, the originals
verbatim and unadjusted, each annotated with the entry it is now known to have
come from. Nothing was deleted and nothing was adjusted.

**Re-derived against the pinned entry only** (all five reels, `transcription-758a3924d090d1b5`,
prompt v4, git sha `ff9d06c`): corpus **343 corrected words**, **208 (61%)**
paired across scripts, **49** cross-script runs. `vitasilk` **73 words / 39 at
risk / 10 runs**. The reel carries **three insertions** (`5`, **`mn` at
corrected 28**, `chno`) and **one deletion** (`ما` at draft 67) — **no deletion
of `من`**; the displacement comes from the insertion. `il` is displaced
**0.500 s** at corrected 31 and **1.340 s** at corrected 33.

**`ACTIVE_PROMPT_VERSION` and `PromptVersion` moved to `core/src/prompt-version.ts`**
and are re-exported from `service/src/transcription/correction.ts`, so every
existing import is unchanged. They had to leave `correction.ts` because that
module imports `@google/genai` and `tools/align-review` is pinned as unable to
reach the network. **The value is unchanged at 4 and no cache was invalidated.**

**The review sheet is executed by tests now, not only read.** `renderSheet`
moved to `core/src/align-sheet.ts` so `npm run check` can run it in a DOM;
`tools/align-review/` is the CLI alone. **happy-dom** is the new devDependency
(`@framopia/core`), chosen over jsdom because it implements `localStorage` and
`Blob` without setup, starts fast enough for a UI block to run these on every
change, and jsdom leaves `URL.createObjectURL` unimplemented — the one API the
download path needs. Eleven tests cover the verdict buttons, the three-state
filter, the counters, the `localStorage` round trip keyed by reel and aligner
sha, and a downloaded blob that parses against the reference schema.
`core/tsconfig.json` gains `DOM` and `DOM.Iterable` to `lib` for them.

**Word counts, corrected.** `handoffs/block-7.md` uses **343** as both
`vitasilk`'s card count and the corpus word count; it is the corpus figure.
Per reel: ground-truth 76, test-1 67, test-2 69, test-3 58, vitasilk 73 —
**343 words and 343 subtitle groups**. Rendered subtitle cards are fewer,
because a keyword supersedes the groups it covers: 76 / 64 / 64 / 58 / 68 =
**330**, with 13 groups superseded across the corpus.

## Block 8 session 3 — the nine repaired, and the scorer

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends, byte-identical. No panel code. **No aligner logic changed.**

**The nine `sourceText` values are repaired.** `npm run repair:source-text
-- --apply`, every reel resolving `transcription-758a3924d090d1b5` (prompt v4).
`vitasilk` 9 corrected / 64 already right; the other four reels 0 corrected.
Three carried a prompt v1 draft token outright (`w0017` `مسبسب.`→`مصبوغ.`,
`w0054` `تهلّي`→`تهلي`, `w0070` `تتردديش`→`تردديش`); six had kept their own
Latin text because the v1 draft held no token at that interval (`w0032`, `w0033`,
`w0034`, `w0055`, `w0071`, `w0072`). Re-verified after: the plan's 73 words are
still byte-identical to the pinned entry's `correctedTexts`, and
`.local/build/.build-options.json` still matches the plan with **0 mismatches**
across 68 subtitle cards and 3 keywords. Only `meta` and `transcript` changed;
every other word field is byte-identical.

**`npm run align:score` is the scorer.** Logic in `core/src/align-score.ts`
(`scoreAlignment`, `compareAgainstReference`, `movedRows`), CLI at
`tools/align-review/score-cli.ts`, with `tools/align-review/load.ts` now shared
by both CLIs so the sheet and the scorer cannot read different cache entries.
It is under the same import pin as the sheet — no ledger, no network — with
`@framopia/core/align-score` added to the allowlist.

- **The headline is over *judged* rows, not the reel.** A half-finished review
  is not evidence that the aligner is half wrong.
- **Sha drift is a refusal, not a warning**, in single-run mode; `--compare` is
  exempt because comparing across commits is what it is for.
- **A reference naming a word id the pairing does not have, or a word whose
  text has changed, is rejected rather than partially scored.**
- **`two-tokens` rows stay inexpressible whatever the change does**, because
  `AlignmentRow` names a single draft token and the aligner has no many-to-one
  operation. That count falls only when the operation set grows.
- The re-review sheet is the same renderer with a `variant`, so the CSS, the
  verdict buttons, the counters and the Download are literally the same code.
  Its `localStorage` key carries the variant, so a partial pass over one sheet
  can never restore into the other.

**The sheet's `localStorage` key changed** from
`framopia.align-review.<reel>.<sha>` to
`framopia.align-review.<variant>.<reel>.<sha>`. Any in-progress marks in a
browser under the old key are not read; nothing has been reviewed yet, so
nothing was lost.

### Corpus figures against per-reel figures

Every figure below re-derived this session against the pinned entry.

| figure | scope | ground-truth | test-1 | test-2 | test-3 | vitasilk | corpus |
|---|---|---:|---:|---:|---:|---:|---:|
| corrected words / subtitle groups | corpus | 76 | 67 | 69 | 58 | 73 | **343** |
| cards shorter than intro + minHold | corpus | 33 | 21 | 26 | 18 | 22 | **120** |
| cards with a clipped hold | corpus | 9 | 7 | 4 | 3 | 5 | **28** |
| cards carrying an overlong single word | corpus | 2 | 0 | 1 | 3 | 1 | **7** |
| blank screen between cards | corpus | 0.000 s | 0.000 s | 0.500 s | 0.080 s | 0.080 s | **0.660 s** |

**All five are corpus figures.** The 28 is confirmed independently by
`npm run validate-plan`, which reports 9 / 7 / 4 / 3 / 5. "Cards went 190 → 343"
is corpus too, and 190 is the two-word-grouping count.

The seven overlong words are **7 occurrences of 4 distinct words** —
`polynucléotides` ×1, `mésothérapie` ×3, `hyaluronique` ×2, `matrddadich` ×1 —
counted in the plans this session. They were seven *cards* under two-word
grouping and are seven *cards* now, because at one word per card each
occurrence is its own card. **The widths behind them are stale**:
`benchmarks/RESULTS-block7-wrapping.md` was measured at 193 two-word cards and
re-measuring needs After Effects.

Corrected as live documentation: `CLAUDE.md`'s "343 draft words" (the draft is
**339** word tokens; 343 is the corrected count), `docs/PROJECT_SPEC.md` §5's
120 figure (now labelled corpus, with the per-reel split and what happens to
those cards), `docs/TEMPLATE_BUILD_SPEC.md` §4's "7 of 190" table (kept as the
two-word-era measurement, with the current 343/120/28 beside it and the retired
claim that a short group "has no card at all" removed), and
`service/src/analysis/retiming-cli.ts`, which **asserted** "No plan in the
corpus stores display timing" into a committed report — false since Block 7
session 4 — and now counts it.

**Re-running `npm run retiming` after that fix gives 343 of 343 groups with
display timing and reading A overlapping 337/338 pairs, against the committed
record's 162/189.** The committed file was **not** regenerated: it is a dated
record, and the change belongs to whoever decides whether the retiming question
is still open.

**`handoffs/block-7.md` carries two misattributions** and is history, not
edited. It uses **343** as `vitasilk`'s subtitle card count (it is the corpus
word total; `vitasilk` has 73 words, 73 groups, 68 rendered cards), and it says
the hold rule removed **17.25 s of blank screen "on vitasilk"** when that is the
corpus figure — `vitasilk` alone is 0.080 s today. Carry both into the Block 8
handoff.

**Checked and found correct, not changed:** `display-timing.ts`'s "only 3 cards
in the whole corpus reach" `MAX_SUBTITLE_HOLD_S` — 3 is right (test-2 1,
test-3 1, vitasilk 1); a first pass that compared for exact equality missed
vitasilk's 1.26 s card, whose own speech exceeds the cap.

## Block 8 session 4 — the panel exists

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends, byte-identical. After Effects was not driven.

**The user's first hand-made reference arrived**, untracked, during this
session: `benchmarks/references/align/vitasilk.json`, **73 of 73 rows judged** —
54 `correct`, 18 `wrong`, 1 `two-tokens`, 0 `no-token`. Scored read-only
without writing anything: **74.0% of judged pairings are human-confirmed**, and
**15 of the 18 wrong are cross-script**, which is the defect this block exists
for. It was **not committed** — it is the user's file and his to place — and
`npm run align:score` was **not run**, because it writes into
`benchmarks/results/latest-align-review/` and his review pass is open in a
browser.

**The reversed-Arabic question is settled: it is a display artifact, and
nothing in the repo is reversed.** Every one of the nine repaired `sourceText`
values stores its characters in **logical order** — `دقيقة` is DAL, QAF, YEH,
QAF, TEH MARBUTA, and DAL is the first letter read right-to-left. The report
files on disk hold the same order; a viewer that does not apply the Unicode
bidi algorithm renders logical-order RTL text left-to-right and therefore
backwards. **Nothing was repaired because nothing is broken.** Checked
corpus-wide as well: all **253** Arabic `sourceText` values across the five
plans are byte-identical to a draft token in the pinned cache entry, so the
pipeline introduces no reordering anywhere. The aligner fix can walk these
tokens against ORTHOGRAPHY_GUIDE §2's table as they stand.

### The panel

`panel/src/` is React 18 + TypeScript strict, bundled by **esbuild** to
`panel/dist`. **esbuild rather than Vite**: CEP loads the panel from a `file://`
URL inside its own Chromium, so there is no dev server to attach to and no
module graph the host resolves — what is needed is one IIFE bundle and a
stylesheet on disk, which is esbuild's default and Vite's special case.

**Read off the machine, not assumed:** host id **`AEFT`** and manifest schema
**`Version="6.0"` / `RequiredRuntime CSXS 6.0`**, taken from the three
extensions already loading in this AE (`flow-v1.5.2`, `Motion Tools Pro`,
`Subtitle Pro`), all of which declare exactly that. The **CEP runtime is 12** —
the running `CEPHtmlEngine` reports `AdobeCEP/12.0.1` — which is why debug mode
is written to `com.adobe.CSXS.12`. **Those are two different numbers** and
conflating them is the usual way a panel silently fails to load.

**`npm run panel:install` was run and is idempotent**: `PlayerDebugMode` was
already 1 on domains 10–13, and the symlink was created and then reported as
already correct on a second run.

**The panel is a view and never a place a decision lives.** Everything
host-dependent — reading the handshake, spawning the service, listing reels and
modes — sits behind an injected `PanelHost` in `panel/src/host.ts`, so `App`
renders in a test with no CEP at all. `cep_node` is looked up at call time, never
imported, so a bundler cannot quietly shim `node:fs` and hide that this only
works inside AE.

**One screen, and nothing else**: service state (starting / healthy /
unreachable) with the health payload read as words rather than JSON and a retry
control; a reel picker; a client-mode picker; a disabled Run control that
**states its reason in words**; and the reel's cumulative `costs.spentUsd` with
ARCHITECTURE §6's **$2.00 soft alarm wired and not triggerable** (the highest
reel on this machine is `vitasilk` at $1.550444). No placeholder panels, no dead
navigation. The transcript editor is deliberately absent until the aligner is
fixed.

**`assets/brand/Framopia_LOGO.png` does not exist.** PROJECT_SPEC §6 names it
and `assets/brand/` holds only a `.gitkeep`, so `logoPath` returns null and the
header falls back to an accent mark beside the wordmark. **A user asset to
supply**; nothing was invented.

**The Run control is off for an honest reason.** With a healthy service, a reel
and a mode selected it still reads *"The pipeline runner is not built yet."* —
the runner is the next session. A button that looked ready and did nothing would
be worse, and hiding it would leave no place for the reason.

### The service handshake

`GET /health` **probes rather than assumes**: `ffmpeg -version`,
`ffprobe -version`, the sidecar venv interpreter, and a real
`validateTemplateManifest` pass. Live on this machine: ffmpeg 8.0.1, ffprobe
8.0.1, Python 3.11.14, 6 valid templates, `ok: true`. It stays **outside the
token wall** because the panel calls it before it has read the handshake —
that is how it learns whether the service it is about to talk to is the one
whose token it holds — and it discloses nothing an attacker on this machine
could not read from `.local/service.json`.

**`.local/service.json` now carries `pid` and `startedAt` beside `port` and
`token`**, and doubles as the lock. The pid is what makes it safe to reclaim: a
service killed with the machine leaves the file behind, and **a lock naming a
process that no longer exists is a leftover, not a claim**. `startServer`
refuses a live lock (`ServiceAlreadyRunningError`, `--force` to take over) and
starts over a dead one. `processAlive` reads **EPERM as alive** — the process
exists and belongs to someone else — because reading it as dead would let a
second service take over a live one's lock.

**Every rejection is an ARCHITECTURE §8 structured error** — `{ error, stage,
cause, retryable }` — and the panel shows `cause` verbatim rather than
paraphrasing.

**`panel` is an npm workspace**, so `npm run check`'s `--workspaces` sweep picks
up its typecheck, lint and tests with no change to `scripts/check.sh`.

**Not built this session, deliberately:** the job API. Health and spawn only.

## Block 8 session 6 — the panel renders, and the insertion is a tie

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

### Why the panel showed nothing

**Two faults, stacked.**

**The manifest, not the detection.** `<CEFCommandLine>` declared only
`--allow-file-access` and `--allow-file-access-from-files`. CEP injects
`cep_node` only when **`--enable-nodejs`** is declared, and only puts it on the
page's own window when **`--mixed-context`** merges the Node and browser
contexts. Both were missing, so the panel loaded into a Chromium with no Node
at all. The code tested `globalThis.cep_node`, which **is** `window.cep_node`
in a browser — the detection was right. Confirmed against the extensions
already loading in this AE: `flow-v1.5.2` declares exactly those four flags,
and the running `CEPHtmlEngine` process shows them on its command line.

**The throw, which mattered more.** `cepNode()` threw when the global was
absent, and `index.tsx` resolved the host at module scope — so the throw ran
**before React mounted** and the panel's own error surface never rendered.
`detectHost()` returns a value now, `index.tsx` mounts unconditionally, and an
unusable host is a first-class screen naming what is missing **and what it
prevents**. Other startup throws found and converted: `index.tsx`'s missing
`#root` (now plain DOM text), `connect()`'s unguarded `readHandshake` and
`processAlive` (now a `service-handshake` error state), and the reel/mode
loaders (now resolve to empty lists).

**Why the suite passed throughout: happy-dom never provides `cep_node`**, so
the throwing branch was the only one ever taken and it passed by being
universal. It is exercised present, absent and malformed now, and a
present-but-unusable host reports `host bridge` rather than "not running inside
After Effects", which would send the user looking in the wrong place.

### The panel is rendered by a real engine now

`npm run panel:build` then Playwright over `panel/dist` from `file://`, with a
stubbed `cep_node` rather than the real bridge. It asserts measured dimensions,
the brand mark, the four section headings, each of the three service states,
the disabled Run control with its reason, and **an uncaught-error count of
zero** — none of which happy-dom can answer, which is how an empty panel passed
a green suite. The panel's `test` script builds first, and the check skips with
a notice if the browser binary is absent.

### The first reference is committed

`benchmarks/references/align/vitasilk.json`, **73 of 73 rows judged** —
54 correct / 18 wrong / 1 two-tokens / 0 no-token, validated against the schema
before committing. **74.0% of judged pairings have a human-confirmed
alignment**, and **15 of the 18 wrong are cross-script**. `assets/brand/Framopia_LOGO.png`
is committed too: 962×1077, 8-bit RGBA **with alpha**, and the panel header uses
it instead of the fallback mark (pinned by a browser test).

### The three insertions are a tie, not a cost

`vitasilk`'s 18 wrong pairings sit in three runs, each opening with an insert.
**Every one costs exactly the same as pairing the two words directly.**

| insert | next draft token | run | closes at | winning path | straight pairing |
|---|---|---:|---|---:|---:|
| `5` at corrected 0 | `خمس` | 5 subs | `minutes.` | 1 insert + 5 subs = **6** | 6 subs + 1 insert = **6** |
| `mn` at corrected 28 | `من` | 9 subs | `et` | 1 insert + 9 subs = **10** | 10 subs + 1 insert = **10** |
| `chno` at corrected 50 | `شنو` | 7 subs | `salon.` | 1 insert + 7 subs = **8** | 8 subs + 1 insert = **8** |

**The tie is broken by the backtrace, and this was proved rather than argued.**
Flipping only the preference from `substitute > insert` to `insert >
substitute` moves all three insertions to the **end** of their runs — `5` to
corrected 5, and so on — with the **total edit cost identical at 45 either
way**. The rule is the `else if` chain at `core/src/align.ts:43-53` walking
backwards from `(n, m)`: it takes a substitution whenever one lies on an
optimal path, so the single insertion is pushed to the earliest hypothesis
index in the run. The normaliser cannot help — `normalizeToken('5')` is `5` and
`normalizeToken('خمس')` is `خمس`; it lowercases Latin and strips edge
punctuation and never crosses scripts.

**Insert operations per reel** (runs are consecutive substitutions ending at an
exact match): ground-truth **4** inserts, 3 with runs of 5, 8 and 6;
test-1 **3**, 1 with a run of 9; test-2 **1**, run of 5; test-3 **2**, runs of 1
and 3; vitasilk **3**, runs of 5, 9 and 7. **13 inserts, 10 followed by a run
ending at an exact match.**

**The many-to-one question is not yet worth an operation.** Across all five
reels there are **14 bare numerals**, and **1** has a draft side spanning two or
more tokens under the current alignment — ground-truth's `20`, with `يوم`
("day") deleted beside it, which is a deletion rather than a merge. The known
`26` ← `ستة` + `وعشرين` case does **not** show as spanning, because the
neighbouring shift absorbed `ستة`; it anchors to `وعشرين` alone. **The
aligner's own output undercounts merges for exactly the reason the defect
exists**, and the only honest count is the human one: 1 `two-tokens` row in 73.

### Experiment 1: measured, and it does nothing here

`--cost-model expensive-insert` raises insertion from 1 to 2 — the next integer
above substitution, chosen because the paths tie exactly and the smallest
tie-breaking amount is the only value worth trying first.

**Against the committed reference: 0 candidate repairs, 0 regressions, 18
wrong unmoved, 1 two-tokens still inexpressible, 54 correct held.** Nothing
moved on `vitasilk` at all.

**And the arithmetic says no value could.** Both competing paths contain
**exactly one insertion**, so raising its price raises both equally. Across the
corpus the variant moves **13 rows, all on ground-truth**, where a run has two
insertions competing and dropping one genuinely saves cost (4 inserts → 3);
test-1, test-2, test-3 and vitasilk move **0**. **The variant is not adopted.**

**The default path is unchanged**, verified: pairings for all five reels are
byte-identical to before under the default model.

### Also

**`processAlive` has one home**, `core/src/process-alive.ts`, imported by
`service/src/lock.ts` and `panel/src/host.ts`. A test asserts both import it
and that neither signals a pid directly.

**Known issue, not changed:** `vitasilk` draft token 5 is **`五`**, CJK for
five, and `tokenScript` classifies it `latin` — the same script as the
corrected `5` it pairs with — because the classifier tests only for Arabic and
falls through to `latin`. It is the **only CJK codepoint in all five drafts**.
The pairing happens to be right; the classification is not, and a same-script
row is dimmed on the review sheet as one Levenshtein had evidence for when it
had none.

## Block 8 session 7 — the panel works end to end, and the tie is broken

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

### The comment that took the panel down

**A double hyphen cannot appear inside an XML comment.** Session 6's comment
above `<CEFCommandLine>` named `--enable-nodejs` and `--mixed-context`; libxml2
rejected the whole manifest with `XPATH Double hyphen within comment`, After
Effects dropped the extension, and it vanished from the Extensions menu. The
user removed the comment by hand and the panel loaded; all four `<Parameter>`
lines survived. **Every test in the repo passed throughout**, because nothing
parsed the file.

`npm run validate:panel` parses it now, in `npm run check`. Two stages with
different scopes: the double-hyphen rule in JavaScript, so the specific footgun
is caught on any machine, and full well-formedness through **xmllint** — the
same parser family CEP uses, so what it rejects is what After Effects rejects.
xmllint absent is a printed notice, never a silent pass.

### The spawn, three faults deep

**It spawned `npm`.** After Effects inherits no shell profile, so the panel's
`PATH` is roughly `/usr/bin:/bin`; `spawn npm ENOENT` was the result, and nvm's
Node is invisible there too. It spawns the Node binary directly now, resolved
and never hardcoded — see the convention above. **On this machine it resolves
through nvm to `/Users/mohamedanouarzaki/.nvm/versions/node/v24.14.1/bin/node`**,
and `GET /health` reports the path and which source it came from.

**There was no service entry point at all.** `npm run service` starts it from a
terminal; `service/dist/service.js` is the stable path the panel spawns.

**It claimed a success it never checked** — "one has been started. Retry in a
moment." while the spawn had already failed. The panel now waits for the spawn
to fail, exit or survive, then polls `/health` until it answers or a bounded
timeout expires, and reports a timeout **as a timeout**, naming the binary it
used. ARCHITECTURE §8, in its general form: **anything asserting a verified
property is emitted by the thing that verifies it.**

### One symlink emptied both pickers and the logo

`getSystemPath('extension')` returns the **symlink** CEP was given, not its
target, and `repoRoot` resolved `..` from it — landing in
`~/Library/Application Support/Adobe/CEP/extensions`, where there is no
`benchmarks/footage.json`, no `modes/` and no `assets/brand/`. One fault, three
symptoms. `realpathSync` first, and all three are answered.

**Both catalogues come from the service now**, through the helpers that already
own the rules — `service/src/frames/footage.ts` for where footage lives and
core's `parseMode` for what a mode is — so no second copy exists in the panel.
`GET /reels` and `GET /modes`.

**A latent bug found on the way:** the panel tested `fonts.status === 'resolved'`
and the enum is `'tbd' | 'set'`, so a properly-fonted mode would have been
blocked at Block 9 with a message about missing fonts.

### The dry run

`GET /dry-run?reel=&mode=` reports what a run **would** do — which stages the
plan records as done and what the rest would cost — and **runs nothing and
bills nothing**. The stage keys are the plan's own (`transcription`,
`analysis`, `images`, `zones`), read from a real plan; a guessed key would have
reported every reel as unrun. On `vitasilk` and `test-1` every stage is cached,
so it reads **nothing to pay**.

### Experiment 2: the tie is broken, and 0 confirmed pairings moved

Cross-script substitution carried **no information**: every pair scored 1, so a
run of them tied and an arbitrary tiebreak decided the reel.
`core/src/transliterate.ts` scores the pair against ORTHOGRAPHY_GUIDE §2's
table — `من`/`mn` costs **0.2**, `من`/`ghir` costs **1**. Length-normalised, so
a long pair is not penalised against a short one. Insertion cost untouched; no
many-to-one operation.

**Against the committed reference on `vitasilk`:**

| bucket | count |
|---|---:|
| wrong, now pairs differently (**candidate repairs**) | **16 of 18** |
| correct or misheard, now pairs differently (**regressions**) | **0** |
| two tokens, still inexpressible | 1 |
| wrong, unmoved | 2 |
| correct, held | 54 |

**Zero regressions**: all 54 pairings the user confirmed are untouched.

**16 is a candidate figure, not an improvement.** Some of the moved rows are
plainly right — `mn`→`من`, `ghir`→`غير`, `anno`→`أنه`, `chno`→`شنو`,
`katsnay`→`كتسني`, `bach`→`باش` all now pair with their own token. Others moved
the residual error rather than removing it: `il`/`nourrit`/`hydrate` are French
words against two Arabic verbs, which is a many-to-one shape no substitution
cost can express. **Only the user can tell the two apart**, on the re-review
sheet.

Movement on the other four reels, no reference so no claim about correctness:
ground-truth **15**, test-1 **16**, test-2 **14**, test-3 **4**, vitasilk 17 —
**66 corpus-wide**. Insert counts are unchanged on every reel.

**The default is unchanged and every production path takes it**, verified:
pairings for all five reels byte-identical under `DEFAULT_ALIGN_COSTS`.
`--cost-model transliteration` selects the variant. **It is not adopted.**

## Block 8 session 8 — the panel reaches a healthy service

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

### One empty string, three symptoms

The panel reported `the service is not built: /service/dist/service.js does not
exist` — an absolute path from the root of the disk, about a location that
never existed. The chain, each link measured:

1. `index.html` loads no CEP library and nothing in the bundle used
   `__adobe_cep__` — **0 occurrences** in the built `panel.js`. So
   `globalThis.CSInterface` was `undefined`.
2. `detectHost` read `csInterface === undefined ? '' : …`, so the extension
   path was **`''`** on every load.
3. `realpathSync('')` returns the **process cwd**. Under Node in the repo that
   is the repo, which is why it never showed up in a test; for a
   Finder-launched After Effects it is **`/`**.
4. `path.resolve('/', '..')` is `/`, and `path.join('/', 'service', 'dist',
   'service.js')` is exactly the string on the user's screen.

**It was never two disagreeing copies of the resolver** — session 7's symlink
fix was correct, and it was fed an empty input. The same empty root also means
**the pickers and the logo were never fixed inside After Effects either**;
session 7 proved them only against a stub that defined `CSInterface`, a global
CEP does not provide.

### Retry was not dead

It was wired and it did re-run the health check. But `detectHost()` ran once at
module load, so the host — and the root inside it — was captured before the
user could do anything about it, and every press produced **byte-identical
text**. A working button was indistinguishable from a dead one, and no press
could ever have recovered from a wrong root.

Detection is re-run in full on every press now, and every attempt renders with
a counter and a timestamp, so a repeated identical failure still moves.

### Proven without the user

`service/src/spawn.integration.test.ts` runs the panel's whole route outside
CEP — resolve the repository, resolve Node, check the build, spawn
`service/dist/service.js` with a bare Node binary, poll `/health` — and asserts
`ok: true` and that `repoRoot` comes back as the real root. **693 ms**, inside
`npm run check`. It publishes to its own lock file through
`FRAMOPIA_SERVICE_JSON`, so it cannot disturb a service the developer is
running.

**What remains unproven is the CEP half**: `cep_node` supplying `fs` and
`child_process`, and `__adobe_cep__`/`location` supplying the candidate paths.
Those exist only inside After Effects.

The browser check drives the built panel through **spawn failure** — asserting
the message names a path under the real root and *not* one starting at the root
of the disk — and **spawn success**, and asserts a second Retry renders a
distinguishable state.

### Messages that name things

Swept for the shape that produced the bad message: a message naming a path,
command or file that is computed rather than verified. Every one found is
verified at the moment it is shown, except two that are honest hedges rather
than claims. `core/src/messages.test.ts` now pins that **every `npm run …` a
user-facing message tells someone to type is a real script**, and that the
node-missing help is written once rather than retyped in the panel.

## Block 8 session 9 — the last blocker, and the stubs audited

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven, and the service the user started by hand was
left running.

### Fonts no longer stop the pipeline

Moved from Run to Build, for the reason above. **What Build did before: nothing
asked.** `requireFonts` is the only thing that rejects a `tbd` mode and it is
**never called outside `core`** — Block 7 built `vitasilk` end to end on
`k2-syndicalia` at `fonts.status: "tbd"` and rendered in Inter Semi-Bold and
Almarai Bold because that is what the hand-built template comps carry. The
fallback was real and incidental; `buildFonts` makes it a stated rule and the
panel names both faces at Build.

### Two columns at 830 px

Container query on the panel's own width. The breakpoint is measured, not
chosen — figures in `reports/block-8-session-9.md`. Four widths are asserted in
the headless check, and **nothing overflows at any width**: the Node-mismatch
warning and the ffmpeg banners now wrap. **The user reviews this docked and
floating before it is kept.**

### The spawn, cold

**Handshake at 52 ms, healthy at 157 ms** on a lock nothing had ever written —
timed rather than estimated, and fast enough that the user does not wait. Four
cases now covered by tests against **real processes**: a live lock is refused
(the second service exits saying so), a lock naming a dead pid is reclaimed, a
stopped service stops answering, and a cold start comes up.

Two real gaps were found and closed. **Two panels opening together** both find
no handshake and both spawn; the loser's service exits and the panel reported a
spawn failure beside a perfectly good service — it now re-checks and reuses.
And **a service that dies while the panel is open** left `Ready` on screen
forever; a 5 s heartbeat notices and reports `service-lost`.

### Which Node is running the pipeline

`/health` reports `process.execPath` **and** `process.version`, and the panel
compares them against the binary it resolved. A mismatch is a **visible warning
naming both**, not a gate — a service on another Node is still a working
service. This matters today: the running service was started from a terminal,
where `PATH` is the user's shell rather than After Effects'.

## Block 8 session 10 — the layout CEP could not render

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven, and the service the user started by hand
(pid 57858) was left alone.

**Session 9's two-column layout never applied inside After Effects.** The user
measured it live: the panel is **1572 px** wide against an 830 px breakpoint,
renders one column, and `getComputedStyle(el).containerType` is **`undefined`**.

**The cause is the engine.** CEP 12 runs **Chromium 99.0.4844.84** and
`container-type` shipped in **Chrome 105**, so the `@container` block was dead
text. CSS an engine does not recognise is **dropped without a word** — nothing
throws and nothing logs, which is why four passing headless assertions and a
broken panel coexisted.

**The empty `className` was not a bug.** `<main>` never had a class: session 9
styled it by element selector and switched it by container query. The user's
own reading confirms the base rule applied — `display: grid` and
`grid-template-columns: 1532px`, one column at full width. Only the `@container`
block was ignored. The diagnostic was looking for a class that was never
designed to exist.

**Replaced with a `ResizeObserver`** — Chrome 64, and what CEP has — toggling a
`wide` class. It fires on observe, so the first measurement is taken after
layout rather than during the first render; a width read once at mount is the
other common way a breakpoint never fires. The 830 px breakpoint and its
derivation are unchanged; only the mechanism failed.

**The headless check is now capability-gated**, because it is roughly three
years newer than the host and had certified this. Details in the convention
above. **esbuild was tried as the gate and rejected**: at `--target=chrome99` it
passes `@container` and `container-type` through silently, so the build could
not be relied on.

**The sweep found nothing else.** The panel's whole DOM surface is
`ResizeObserver` (Chrome 64), `AbortController` and `AbortSignal` (66); its
whole CSS surface tops out at flex `gap` (84) and `overflow-wrap: anywhere`
(80). The built bundle carries **no at-rules at all** and no modern pseudo-class.

## Block 8 part 2, session 11 — the review sheet lost fourteen judgements

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

**The user marked all 17 rows of the re-review sheet. The downloaded file
contained 3.** Reproduced against the real artifact in a real browser before
anything was changed: 17 rows rendered, 17 buttons showing selected, the
counters reading `unset=0` — and 3 entries in the file.

**The mechanism, exactly.** Rows carried `data-i`, the corrected-word index, and
marks were stored under it; the download looped positions `0..WORDS.length-1`
and read `state[position]`. On the main review sheet every corrected word is a
row, so index and position coincide and it worked. The re-review sheet holds
only the rows a change moved: indices `0,1,2,28,29,…,54` against positions
`0..16`. A mark was found **only where a row's index equalled its own
position** — rows 0, 1 and 2. **Exactly three**, and they are `w0000` `5`/`خمس`,
`w0001` `d9ay9`/`دقائق.`, `w0002` `eyyh`/none, which is precisely the set the
user reported surviving.

**The display was right and the writer was wrong**, which is why nothing looked
amiss: `paint()` read the same sparse key it wrote, so every counter agreed with
the screen. Only the download used a different key space.

**Fixed at the root** — marks keyed by word id — **and the class of failure
closed**: the file now carries every displayed row, and refuses rather than
write a partial one. See the convention above.

**Nine Playwright tests against the real artifact**, on the sparse index shape
that caused the loss. Not happy-dom: guidelines §3 forbids proving a claim about
the host in a more capable environment, and a human opens this file in Chrome.

**A recovery path exists for the fourteen lost marks.** They were never in a
file, but they were in `localStorage` in the user's browser under the pre-fix
key. The sheet migrates that store once, mapping the old index keys onto word
ids, and says so on screen. **Whether it fires depends on the user opening the
regenerated sheet in the same browser profile.**

## Block 8 part 2, session 12 — the aligner fix is adopted

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

**The user's re-review is committed** at
`benchmarks/references/align/vitasilk.rereview.json` — 17 rows, 7 correct, 2
misheard, 7 wrong, **1 deliberately unjudged** (`w0036`, `26`). Verified before
committing: schema 3, `rowCount` 17, `markedCount` 16 equal to the non-null
count, and every `(wordId, wordText, draftTokenText)` triple identical to the
generated sheet.

**Adopted**, with the corpus guard passing at 330 → 330. See the convention
above and `docs/DEFECT-alignment-script-mismatch.md` §A.0.

**Three claims from session 11 were checked before anything else:**

- **Test arithmetic reconciles.** 327 → 337 is 9 new Playwright tests in
  `align-sheet.browser.test.ts` plus **1** new test in `align-sheet.test.ts`
  that session 11's report never mentioned; 4 tests were renamed and rewritten
  and 3 rewritten in place, all net-zero.
- **The scorer change did not move what it measures.** Part 1's figures
  reproduce exactly under both models: 54/18/1, 74.0%, 16 moved, 0 regressions.
- **The migration claim was half right and its conclusion was wrong.** The
  generator at `37a05d8` did write marks to `localStorage`. But the key embeds
  the **git HEAD at generation time**: the sheet the user marked carried
  `d7c46ad` and the regenerated sheet carried `37a05d8`, so the migration
  searched a key that never existed. It could not have worked, and the claim
  that it would was made without checking. **His marks are probably still there
  under the `d7c46ad` key**; he has since redone the work.

**Splits outnumber merges, and part 1's floor was low.** 10 split runs and 6
merge runs across the corpus, against part 1's "one merge". **Splits do not
correlate with code-switching**: French is 16.9% of words inside split runs
against 21.3% of the corpus. Most are Darija proclitic morphology — `فهو` →
`fa houa` — not French collapse. Full working in §A.5.

**The sheet generator escapes for the script block now**, not merely
`JSON.stringify`. The new syntax test found that a `</script>` in any word
closed the element and that U+2028/U+2029 terminate a JavaScript line while
being legal in JSON.

## Block 8 part 2, session 13 — the money question stopped the session

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven. **No plan was regenerated and no plan was
written.**

**The session stopped before the panel work by its own hard-stop rule**:
Goal 1 was to establish, read-only, what regenerating the five plans onto the
adopted aligner would cost, and the answer is **not zero**. The two conventions
above are the finding. Goals 4 and 5 — the staged panel flow — were not started.

| | all five plans | `vitasilk` alone |
|---|---:|---:|
| transcription (**miss**, guide 1.0.7 → 1.0.8) | $0.837770 | $0.170658 |
| keywords (**miss**, analysis prompt 3 → 4, and again if the text changes) | ~$0.90 | ~$0.18 |
| image slots (hit today; **miss** once the transcript moves) | ~$0.28 | ~$0.056 |
| image generation (hit today; **miss** once slot ideas move) | $1.550444 | $1.550444 |
| **total** | **~$3.57** | **~$1.96** |

Transcription figures are the actuals recorded in each pinned entry's own
manifest. Keywords is the one v4 actual ($0.183518 on `test-2`) applied across;
slots is Block 3's $0.224164 over four calls; images is `vitasilk`'s recorded
$1.550444.

**The cascade is what makes it expensive.** The Gemini correction call is not
reproducible, so a re-transcription returns different corrected texts, which
changes `hashTranscript`, which misses keywords **and** slots, which changes the
slot ideas, which changes the composed image prompts, which strands all ten
generated images. One stale key at the top costs the whole reel.

**There is a free path and it is not a regeneration.** Alignment is pure and
local, and the Scribe response and corrected texts are both in the pinned entry.
Re-aligning from that entry and rewriting only the timings costs **$0.00** and
needs no API — the same shape as `migrate:display-timing` and
`repair:source-text`. It is not written; it is the suggested next step.

**The corpus guard cannot fail for a substitution-cost change** — measured, in
`docs/DEFECT-alignment-script-mismatch.md` §A.0.2. A cost model that inverts the
transliteration distance reshuffles **332 of 343 pairings** and **passes the
guard with a better anchored count than the adopted model** (332 against 330).
The hand-made reference catches it instantly: 54 regressions against the adopted
model's 0. **Session 12's safety check was worth much less than it read**, and
the reference is what made the adoption safe.

## Block 8 part 2, session 14 — the dry run was lying, and the plans are migrated

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

**The dry run misstated cost, and it is the feature built to keep part 2
affordable.** It read `plan.pipeline[stage].status` — what the plan *remembers* —
and printed "already on the plan; a re-run reads the cache and bills nothing".
It never consulted the cache. `vitasilk` therefore read **"nothing to pay"**
while a real run would have re-transcribed and re-run keyword analysis. Two
lookups existed and disagreed: `selectTranscriptionEntry` by prompt version for
the diagnostics, the computed fingerprint for the runner, and the dry run used
neither.

**What it reports now**, per reel, against the cache on disk:

| reel | transcription | analysis | images | estimate |
|---|---|---|---|---:|
| ground-truth | compatible | **none** | not planned | $0.18 |
| test-1 | compatible | **none** | **none**, 0 of 8 cached | **$1.73** |
| test-2 | compatible | **none** (slots miss; keywords hit) | not planned | $0.18 |
| test-3 | compatible | **none** | not planned | $0.18 |
| vitasilk | compatible | **none** | exact, 10 of 10 | $0.18 |

Corpus **$2.45**, against the "$0.00, nothing to pay" it used to print for
`vitasilk`.

**The plans are migrated onto the adopted aligner** — `npm run migrate:alignment
-- --apply`, $0.00. **67 words retimed and 78 cards moved across the corpus**,
independently reproducing session 13's 67 moved anchors. Word texts, ids,
`lang`, `removed` and `edited` are untouched; keywords, image slots, candidates,
zones, costs and pipeline records are unchanged except for the timing fields
derived from words. **Clipped holds fell 28 → 23.**

`vitasilk`'s 8.8–11.9 s span — the one the user reported twice in Block 7 — now
pairs `mn`/`من`, `ghir`/`غير` and `anno`/`أنه` each with its own token, and `mn`
gained a real anchor where it had been a zero-duration interpolated point. The
tail of that run is still displaced, because `il nourrit` needs a split and `26`
a merge; before-and-after word by word in
`docs/DEFECT-alignment-script-mismatch.md` §A.0.3.

## Block 8 part 2, session 15 — the staged flow

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

The panel is five steps now, and the two conventions above are what it rests on.
Step 1 is the previous screen, moved in intact.

**The image estimate was a flat constant and is computed per reel now.** The dry
run reported **$1.55** for every reel's images — `vitasilk`'s five-slot actual —
so `test-1`'s four slots read the five-slot number. For `test-1`'s 8 images:
published **$1.072**, expected actual **$1.20–$1.24**, budgeted ceiling
**$1.4472** at `IMAGE_COST_MULTIPLIER` 1.35. The dry run shows the **ceiling**
and the panel now says so — "budgeted ceiling … not a forecast" — rather than
leaving a number whose meaning the user had to guess. Session 14's "$1.73" was
$0.18 analysis plus that flat $1.55, and its claim that this re-measured part
1's ~$1.21 was wrong: **~$1.21 was and is right**, and matches
`docs/DECISION-image-config.md`'s four-slot measured row of $1.203.

## Block 8 part 2, session 16 — four defects from the user's first real pass

**Spent $0.00; no API was called.** Ledger 108 entries / sha `50ec3f57…` at both
ends. After Effects was not driven.

The rail is confirmed on CEP — one row docked, all five labels wide, no red.
What the pass found, and the conventions above now carry: **ffmpeg was never
being found by a panel-spawned service**; the panel could not say **which
service** it was reading; **picking a reel navigated**; and **Build's rule was
undeclared**.

**The dry run understated a second class of reel.** Session 15 computed from
*uncached candidates*, so a reel with no slots planned at all computed to zero
images and read $0.18 — while a run would plan slots and generate them.
`ground-truth`, `test-2` and `test-3` now read **$1.63**, using
`imageSlotCountFor` — the planner's own rule, so the two cannot drift — and the
figure is labelled as a **planned** slot count rather than a known one.

| reel | images stage | total |
|---|---|---:|
| ground-truth | none planned; ~4 slots, 8 candidates | **$1.63** |
| test-1 | 0 of 8 cached | **$1.63** |
| test-2 | none planned; ~4 slots, 8 candidates | **$1.63** |
| test-3 | none planned; ~4 slots, 8 candidates | **$1.63** |
| vitasilk | 10 of 10 cached | $0.18 |

## Block 8 part 2, session 17 — the pipeline runner

**Spent $0.00; no API was called and the pipeline was not run.** Ledger 108
entries / sha `50ec3f57…` at both ends. After Effects was not driven.

**Run pipeline is enabled and red for the first time.** The two conventions
above are what it rests on. Session 16's accent test could only assert the paint
by removing the `disabled` attribute in the page; that cheat is gone and the
test reads the real enabled control.

**What pressing Run on `vitasilk` does today: nothing, for $0.00.** All four
stages are on its plan, so all four are skipped with their reasons on screen —
which is also the first time `cacheProvenance` reaches the panel from real data.
`ground-truth` and `test-3` are the reels with work left: about **$1.63** each,
being analysis plus the images that analysis would plan.

## Block 8 part 2, session 18 — three defects from the first real run, then step 2

**Spent $0.00; no API was called and the pipeline was not run.** Ledger 108
entries / sha `50ec3f57…` at both ends. After Effects was not driven.

**The dry run and the runner disagreed on screen while six tests said they
agreed.** With `vitasilk` picked the cost block read "to run" for a stage the
run beneath it reported as "skipped — already on the plan". The six tests pinned
two *service* functions against each other; **the divergence was in the panel**,
which inferred its label from `provenance` and `estimateUsd` — and those two
cannot express "the plan already has this". The service now states `action`
(`skip` / `reuse` / `run`) and the panel renders it, and the pin is widened to
assert the **rendered strings** in the built bundle.

**Red was leaking into the focus ring.** `select:focus` used `--accent`, so the
mode picker outlined itself in brand red. Focus now uses `--focus`, and a
browser test focuses every interactive control in turn and asserts none paints
`#ED1C24` except Run. Verified against the old style: it fails.

**The rail does unlock after a run**, which session 17 claimed and never proved
because the user's run skipped everything. A test now drives a run that
completes a pending stage and asserts Keywords goes from locked to reachable
with no manual reload.

## Block 8 part 2, session 19 — the counts, and the script toggle

**Spent $0.00; no API was called and the pipeline was not run.** Ledger 108
entries / sha `50ec3f57…` at both ends. After Effects was not driven.

The two conventions above are the session. The counts were never wrong — they
were unlabelled, which in front of someone being asked to rule is the same
thing. Each ruling button now carries **this reel**, **corpus**, and **proxy**
where it applies, and each instance carries the measurement that put it there:
a word's length against the threshold, a card's shortfall in the Build pane's
own sentence, and a split term shown whole with the cards it is broken into.

`تحفيز طبيعي للكولاجين` — the term ORTHOGRAPHY_GUIDE §6 names verbatim — now
shows on `test-1` as three parts in three cards, which is the evidence the user
was being asked to rule on and could not see.

## Block 8 part 2, session 20 — the rulings recorded, and step 3

**Spent $0.00; no API was called and the pipeline was not run.** Ledger 108
entries / sha `50ec3f57…` at both ends. After Effects was not driven.

**The user's three subtitle rulings are recorded in `docs/PROJECT_SPEC.md` §3
and none is implemented.** Ruling 2 — a card stays tight to its word — ratifies
Block 7's existing entrance compression, so **the 23 clipped holds are now a
decision rather than an open defect and there is nothing to build**. Rulings 1
and 3 are Block 9: the term rule needs a term source the project does not have,
and the shrink rule needs a width only After Effects can measure and the fonts
Block 9 collects.

Step 3 is built; the convention above is what it rests on.

## Block 8 part 2, session 21 — the SFX peak measured, the impact frame not

**Spent $0.00; no API was called, the pipeline was not run, After Effects was
not driven.** Ledger 108 entries / sha `50ec3f57…` at both ends.

The two conventions above are the session. The user reasoned his way to a defect
without seeing it, and the measurement is worse than he guessed: not encoder
padding of a few milliseconds but **a peak 61.5 frames into the file bound to
every keyword**.

**The session could not finish the fix.** Aligning peak to impact needs the
template's impact frame, and reading it needs an audit re-run that would close
the user's open After Effects project without saving. The audit is extended to
emit keyframe times; running it is his to trigger.

`npm run sfx:measure` is the new command.

## Block 8 part 2, session 22 — the rule in force

**Spent $0.00; no API was called, the pipeline was not run, After Effects was
not driven.** Ledger 108 entries / sha `50ec3f57…` at both ends.

The user ran `npm run audit:templates`, which gave session 21's missing
measurement. The three conventions above are the session: the audit can no
longer destroy his work, every sound's anchor and gain are derived from its own
audio, and the placement rule is in force on all five plans.

**Every hit was landing about 1.78 s late and every whoosh about 0.29 s late.**
All 17 events are corrected.

New commands: `npm run sfx:measure`, `npm run migrate:sfx-placement`.

## Block 8 part 2, session 23 — stopped twice, both times correctly

**Spent $0.00; no API was called, the pipeline was not run, After Effects was
not driven.** Ledger 108 entries / sha `50ec3f57…` at both ends.

Both hard stops fired. **The impact frame could not be measured**: the audit
records two endpoints and a duration, and the answer is entirely in the easing —
linear gives 11.40 frames where the user's eye gives 4. The audit now records
easing; one more run supplies it. **`vitasilk` was not rebuilt**: every build
script closed the user's open project without saving, which is the defect
session 22 fixed in the audit and never checked for elsewhere.

The 17 SFX events remain **8 frames late** and are not corrected, because the
correction rests on a number nobody has measured.

## Block 8 part 2, session 24 — the crossing measured, and it disagrees

**Spent $0.00; no API was called, the pipeline was not run, After Effects was
not driven.** Ledger 108 entries / sha `50ec3f57…` at both ends.

The user re-ran the audit and the easing is there, so the impact frame is
finally computable: **5.25 frames**, uniform across all six comps, against
linear's 11.40 and the settle's 12.00. **It does not match his frame 4**, so
nothing shipped — the convention is validated and `IMPACT_THRESHOLD` is what
disagrees, his eye corresponding to 0.8966 rather than the chosen 0.95.

**`vitasilk` was not built.** The build drives his running After Effects over
`DoScript`, which the session brief forbids; the command is his to run.

The 17 SFX events remain 8 frames late.

See `docs/BLOCKS.md` for the full block plan and `handoffs/` for prior
session context.


## Block 8 session 25 — heard and seen for the first time

**Spent $0.00.** Ledger 108 entries / sha `50ec3f57…` at both ends. After
Effects was not driven.

The user built `vitasilk` and watched it — the first time this system's output
has been seen or heard. Four of his six findings became rules; two became
questions. Full record in `reports/block-8-session-25.md`.

**SFX level is relative to the dialogue now.** See `npm run loudness:measure`
above. `vitasilk` hits **−19.28 → −7.68 dB**, whooshes **−22.77 → −13.17 dB**.
The −20/−24 figures are recorded as superseded in `TEMPLATE_LIBRARY_GUIDE.md`
and `TEMPLATE_BUILD_SPEC.md`. **Placement is untouched** — `IMPACT_THRESHOLD` is
unresolved and the 17 events stay 8 frames late.

**The card frame's colour is derived from the picture.** Every candidate in the
corpus measures **0.0019–0.0266** relative luminance at its outermost 2% ring,
because every prompt carries the mode's dark palette — **1.01:1 to 1.30:1**
against a dark frame, which is why images disappeared. `cardFrameColour` in
`core/src/image-border.ts` takes whichever palette role separates best, at
**WCAG 2.1's 3:1 minimum for a non-text boundary** — adopted from the standard,
not chosen here. The sidecar gained `edge_luminance`; the builder applies the
colour as a **Fill effect on the duplicated instance's `CARD` layer**, so the
shared solid the template draws from is untouched. **Never rendered** — the
ExtendScript half cannot be tested outside a running AE.

**`imageScale` is a mode field**, optional, default 1.0; `k2-syndicalia` is v7
at **1.4**. The bump invalidates nothing. **Nine of nine slots clamp**: the
top-left rule already takes the largest square that clears the face, so 749–837
px are placed against 1048–1166 asked for, and `TOP_LEFT_MARGIN` plus
`HEAD_CLEARANCE` are 151 px against the ~300 needed. Making the images bigger is
a placement ruling, not a constant — `benchmarks/RESULTS-block8-image-scale.md`.
A real defect was found doing it: at a clamped size the square sat exactly on
the clearance boundary and touched the grown face box on four of nine slots.
**Jitter is applied last now**, so it stays a shrink at any scale.

**The watermark comes from the plan.** `build-reel-cli.ts` placed one whenever
the measurement file and the asset existed — both properties of the repository,
so every reel got a mark and none could refuse one. `Watermark.enabled` is
optional with a default of **true**, `POST /watermark` writes it, the dry run
reports it, and the Build step carries a per-reel checkbox. **Its inset is
unchanged and asymmetric**: 216 × 242 px, **65 px from the side and 205 px from
the top**, because the one `WATERMARK_MARGIN` 0.03 is carried into an axis 16:9
taller. Everything else the builder decides without the plan is swept in
`benchmarks/RESULTS-block8-builder-inputs.md`; **`plan.clientMode` is null on
all five plans** and is the same defect, reported and not changed.

**The flashing cards are a ruling, not a fix, and nothing was implemented.**
The remedy asked for — a minimum on-screen duration taking time from the gap
after the word — **is Block 7 session 9's hold rule and has been in force
since**. 336 of 343 cards already hold past their word, all **22.039 s** of
post-word silence is already on screen, and **one card and 0.080 s** are
unclaimed corpus-wide; at every threshold from 0.20 s to 0.50 s, **zero** short
cards can reach it from their own gap. Median card **0.300 s**, p10 0.139,
236 of 343 under 0.40. The two remaining sources of time each reverse an earlier
ruling: overlap the next card (337 of 338 pairs stack), or pair words again
(**173 cards, median 0.640 s, 22 under 0.40 s**).
`benchmarks/RESULTS-block8-card-duration.md`.


## Block 8 session 26 — the mix makes room, and the sound lands on the word

**Spent $0.00.** Ledger 108 entries / sha `50ec3f57…` at both ends. One After
Effects instance (pid 79146) and 0 `aerender` at session start.

The user rebuilt `vitasilk` and listened. Four findings, four rules; full record
in `reports/block-8-session-26.md`.

### No SFX gain could have stopped the hits clipping

Every reel is delivered at **0.0–0.2 dBFS true peak**. Measured per event
against the dialogue under it, **all 17 events summed past 0 dBFS** somewhere in
the window they played — 7 even on a tight window around their own peak — by up
to **+2.91 dB**. With the voice already on full scale,
`20·log10(1 + 10^(s/20))` exceeds 0 dBFS for **every finite** sfx peak: a hit at
−40 dBFS still puts the sum over. Session 25's approach could not have worked at
any offset.

**So the mix makes room.** `MIX_CEILING_DBFS = -1.0` is **CHOSEN**;
`dialogueAttenuationDb` is **derived** — the dialogue's peak and the sfx target
both move with the attenuation, so the smallest one that works is exactly how
far the un-attenuated sum overshoots the ceiling. It lands at **3.80–4.01 dB**
across the corpus and the builder applies it to the reel's own audio layer
(`o.dialogueGainDb` in `build-reel.jsx`), so **the balance the offsets describe
is untouched: everything comes down together**. Re-measured after: **0 of 17
over the ceiling, worst sum −1.00 dBFS**, the ceiling exactly — the attenuation
is the minimum that works, not a padded guess.

**Whooshes go from dialogue +0 to +3 dB.** `whoosh_01` moves −14.40 → −15.20
dBFS absolute and is **3 dB louder against the voice**, which moved 3.8 dB
further. There is room to go louder — whooshes sum to −1.7 to −3.0 dBFS — and
what limits it is **the hit at +6**, which is what sets the attenuation for the
whole reel. `benchmarks/RESULTS-block8-sfx-headroom.md`.

### Consecutive hits are thinned, then varied

`core/src/sfx-variation.ts`: `MIN_SFX_SPACING_S = 1.50` and
`SFX_VARIATION_WINDOW_S = 3.00`, both **CHOSEN NOT MEASURED**. Spacing first —
no point varying an event about to be dropped — then a repeat inside the window
takes the next file of the same kind, cycling. **Deterministic with no seed**,
and applied **in time order**, which has to be established rather than assumed:
`plan.keywords.items` is in selection order and `vitasilk`'s k003 plays first.

Corpus: **2 hits dropped** (`vitasilk` k002, `test-2` k003, each 1.259 s after
the previous) and **1 varied** (`vitasilk` k001 → `hit_02`, previously bound to
nothing). `vitasilk` goes from three identical hits to two different ones.
**No whoosh is dropped or varied anywhere** — the closest two images in the
corpus are 3.07 s apart, so neither rule fires on them.

**A keyword can now legitimately have no sound**, so `KeywordView` carries
`sfxDroppedSinceS` and the panel says *"no sfx: 1.26s after the previous hit"*
rather than showing a bare absence that reads as a defect.

### Every image slot carries a sound

`SilentImageSlotError` refuses the derivation, naming the slots. It was already
true of the corpus, but only because both image templates happen to bind a
whoosh. An image's sound is also never the one the spacing rule drops
(`droppable: false`). **A slot with no template at all is deliberately not this
error** — the builder drops it and `checkBuildability` names it, and the plan
passes through that state legitimately before templates are assigned.

### IMPACT_THRESHOLD is 0.90, and placement reads the crossing

`templateImpacts` calls `impactCrossingOf`, not `impactFrameOf` — the latter
measures the **settle**, and sound placed there was the 8-frame error the user
heard. All six comps cross at **4.06 frames** against the settle's 12.00 and a
linear reading's 10.80. His own figure is frame 4, a threshold of 0.8966; 0.90
is within a sixteenth of a frame of it and is a round number rather than one
fitted to a single comp's curve. **Where a measurement and the author of the
animation disagree by less than two frames, the author decides.**

**12 of 15 events moved 8.00 frames earlier** (7.00 on `test-1` k002, where the
snap falls the other way). **3 clamp** at the composition start and their
anchors are *later* than before — a nearer impact needs an earlier start — which
is reported rather than absorbed. All three placements side by side:
`benchmarks/RESULTS-block8-sfx-placement.md`.

**`npm run migrate:sfx-placement` now asserts its own change surface**: it
compares the plan file before and after and throws rather than writing if
anything but `meta`, `source` or `sfx` moved.

### A build path resolves against the directory it was typed in

The user's relative path failed, and **quoting was not the cause** — an argument
with spaces survives both levels of `npm run … --` intact, verified. npm runs a
workspace script with the **workspace** as its working directory, so
`my files/…` typed at the repository root arrived at `service/`.
`resolveUserPath` in `core/src/user-path.ts` resolves a relative path against
`INIT_CWD`, npm's record of where the command was run.


## Block 8 session 27 — the hits removed, the late whoosh found

**Spent $0.00.** Ledger 108 entries / sha `50ec3f57…` at both ends. **After
Effects was not contacted in any way.** One AE instance (pid 79146) and 0
`aerender` at session start.

### Keywords are silent, by the user's ruling

He built `vitasilk`, heard the hits and ruled them out: **the sound fights the
animation rather than supporting it.** `kw_slam` and `kw_slam_ar` declare
`sfx: []`; `hit_01` and `hit_02` are bound to nothing. **The files and their
measurements stay** in `assets/sfx/sfx.json` — they are measured facts and a
later block may want them.

The machinery that existed only for them is **gone, not flagged off**: the hit
spacing rule, the hit variation rule (`core/src/sfx-variation.ts` is deleted),
and the keyword picker's sound row along with the sentence it showed when a hit
had been thinned out. A keyword now has no sound to have or to lack.

**Events across the corpus: 15 → 7.** Six were hits; two more went with Goal 3
below.

| reel | before | after |
|---|---:|---:|
| ground-truth | 0 | 0 |
| test-1 | 6 | **3** |
| test-2 | 2 | **0** |
| test-3 | 0 | 0 |
| vitasilk | 7 | **4** |

**The mix is attenuated less, because the loudest bound sound changed.**
`dialogueAttenuationDb` computed against the hits' +6 dB while nothing binds a
hit; `loudestBoundOffsetDb` reads the offsets the manifest actually binds, so it
follows the whooshes' +3. `vitasilk` goes **3.80 → 3.07 dB** and the whoosh gain
**−13.97 → −13.24 dB**. The balance is unchanged.

### Why the whoosh was late — measured, not adjusted

`benchmarks/RESULTS-block8-whoosh-late.md`. Three candidates, one true:

- **The clamp — TRUE, and the cause.** **7 of 9 whooshes landed exactly on the
  impact frame; 2 were 14 frames (0.467 s) late**, both `img001`, the first
  image in the reel. `whoosh_01`'s anchor is 0.6913 s into the file and the
  impact is 0.1354 s after the element, so the layer needs **0.5558 s of reel in
  front of the image** and `img001` sits at 0.0990 s.
- **The wrong impact frame — REFUTED.** Computed per comp from its own
  keyframes: `img_slide_left`'s Position and `img_float`'s Opacity and Scale all
  cross at **4.059 frames**, the same as a word's. Every entrance pair in the
  library runs 0 → 0.4004 s on one shared easing preset.
- **The layer starting before the picture — the opposite is true.** The builder
  adds no fade and never time-stretches an image, so the comp's frame 0 is the
  layer's in-point; opacity reaches **10% at 0.18 frames and 50% at 1.17**.
  The peak is aimed at the 90% crossing, which is **135 ms after the picture
  first appears**. Recorded and **not acted on** — that is a frame or two, not
  the beat the user described, and `IMPACT_THRESHOLD` stays 0.90. It is where to
  look next if the whooshes still read late.

### A sound that cannot reach its impact is not placed

**Neither file fits the first image**: `whoosh_02` would still be 9.7 frames
late, so there is nothing to substitute. The sound is **dropped rather than
played late** — *a sound that is audibly wrong is worse than no sound*, the same
ruling that removed the hits. `deriveSfxDetail` returns `unplaceable` with the
element, the file and how late it would have been, and
`npm run migrate:sfx-placement` prints a `NO SOUND` line per refusal.

**Nothing in the corpus clamps any more**; every surviving event lands its
anchor on the impact frame. `SilentImageSlotError` is unchanged for the case it
was built for — a template that binds nothing — and an image refused for want of
room is a reported decision rather than a silent omission.

**The alternative not taken:** After Effects allows a layer to start before the
composition, so the whoosh could keep its lead-in and begin part-way through
with the peak on time. Very likely the better fix, and **not made because
verifying it means driving After Effects**, which this session may not do — and
a build where AE silently clamped a negative `startTime` back to zero would
reintroduce the defect inaudibly.
