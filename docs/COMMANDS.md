# Commands

Every command this repository has, what it costs, and what it reads and writes.
Moved verbatim from `CLAUDE.md` by Block 10 session 28; `CLAUDE.md` keeps the
handful used in an ordinary session and points here for the rest.

**Billable commands are marked.** Everything else is free and local.

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
- `npm run prompt-page [-- --new <reel> --old <reel> --out <dir>]` — free, local,
  **read-only**. Renders the before-and-after the image prompt is judged on into
  `benchmarks/results/latest-image-prompt/`: each slot's words, its idea and its
  candidates, with each picture's measured share of unlit frame beside it.
  Generates nothing. The two halves are **different reels** and the page says so
  in its own words — `test-1` under the new prompt against `vitasilk` under the
  old, because `vitasilk` is the only reel that ever had images under the old one
  and regenerating it would destroy the corpus every image measurement rests on.
  Reads its luminance figures from `.local/build/luminance-<reel>.json`.
- `tools/image-luminance/measure.py` — free, local, run by hand. Whole-frame
  relative luminance of generated images: mean, median, p90 and the share below
  0.05, which is how `docs/DECISION-image-config.md` quantifies "too dark to read
  at a glance". Luminance is the sidecar's own `relative_luminance` (WCAG 2.1),
  **imported rather than copied** so it cannot drift from `edge_luminance`.
  **It reproduces that document's published ten-row table exactly** before being
  used on anything new. `--json <path>` writes the figures for `prompt-page`.
  Uses `tools/cv/.venv`, so it is not part of `npm run check`.
- `npm run cutouts` — free, local. Runs the CV sidecar's cutout gate over
  `benchmarks/results/latest-imagebakeoff/` and writes cutouts, metrics and a
  review page to `benchmarks/results/latest-cutouts/`. Generates no images.
  Needs `tools/cv/setup.sh` first.
- `npm run recompose -- --plan <abs path.editplan.json> [--mode <id>]` — free.
  Re-composes an existing plan's image prompts against the current mode. No
  Gemini call and no analysis re-run. Paths must be absolute.
- `npm run frames`, `npm run segment` and `npm run zones` are also what the
  pipeline's `zones` stage runs for itself since Block 9 session 1; they remain
  the terminal path and are unchanged.
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
- `npm run loudness:measure` — free, local, **read-only**. **The pipeline drives
  this itself since Block 9 session 13**; this sweeps every reel at once. Measures every reel's
  integrated loudness, loudness range and true peak with ffmpeg's `ebur128` and
  writes `.local/build/loudness.json`. What the SFX levels are set against: the
  corpus runs −13.9 to −14.6 LUFS at **0.0–0.2 dBFS true peak**, so it has no
  headroom at all and every sound added to it clipped. Both figures go on the
  plan as `source.dialogueLufs` and `source.dialoguePeakDbfs`; absent means
  unmeasured, and the build then attenuates nothing and falls back to each
  file's absolute gain rather than to a guessed loudness.
- `npm run watermark:measure` — free, local. **The pipeline drives this itself
  since Block 9 session 13**, by spawning this same file. Measures
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
- `npm run place:images [-- --mode <id>]` — free, local, **read-only on the
  plan**. Reports each image slot's top-left placement: the size, the position,
  which bound decided it, and — asserted, not eyeballed — that it clears the
  face and sits inside the frame. Exits non-zero if either bound is broken.
  Writes `.local/build/image-placement-<reel>.json` as a record; **the builder
  derives the same placement itself**, so no build depends on this having been
  run. Replaces `npm run top-left`.
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
  Two diagnostic flags exist for looking at a reel rather than for building one,
  and absent, a build is byte for byte what it was:
  `--image-size <px|max>` draws the pictures at a size other than the rule's,
  and `--images-continuous <cut|dissolve>` makes each picture stay until the
  next one appears instead of ending with its own words — `cut` hands over on
  the frame, `dissolve` keeps the outgoing picture underneath until the incoming
  one has finished fading up. Under either, each picture is sized from the face
  mask over its **whole life** rather than over its words, which is what keeps
  it clear of the speaker; Block 10 session 39 measured what happens without
  that.
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
- `npm run probe:audio-start` — free, local. **Drives the already-running After
  Effects.** Asks one question and reports what AE answers: does a layer whose
  `startTime` is before the composition keep it? Four cases — a positive
  control, the negative start `vitasilk`'s first image actually needs, the same
  with the in-point pinned to zero, and a deep negative — with `startTime`,
  `inPoint`, `outPoint` and where the file's own time zero lands read back per
  case. The needed figure is derived from the plan and the audit through
  `placeSfx`, never typed. Starts a new project and **refuses if the open one
  has unsaved changes**, naming it.
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
- `npm run migrate:client-snapshot [-- --apply]` — free, local, one-shot. Pins
  every plan that names a client to that client's look as it stands now, so a
  build reads a copy rather than the mode file. Reads and writes plain JSON
  rather than going through `readEditPlan`, changes exactly `clientSnapshot`,
  and asserts it. Dry run by default.
- `npm run migrate:client-mode [-- --apply]` — free, local, one-shot. Gives an
  existing plan the client it was built for, **derived from the config label the
  analysis stage already wrote** (`keywords-prompt-v3-k2-syndicalia-v5`) rather
  than guessed. A plan whose analysis never ran is left null. Dry run by
  default; asserts it changed only `meta` and `clientMode`.
- `tools/ae/measure-widths.jsx` — free, local, driven over `DoScript`. How wide a
  given string sets in a given face at a given size, from `sourceRectAtTime`.
  Takes an options file and writes a result file; shows no dialog. Adds one
  temporary comp to the open project and removes it; **never saves**.
- `tools/font-metrics/measure.py` — free, local, run by hand when a face is
  added. Ink extents in font units from the font files themselves, through a
  pen rather than the OS/2 table. **It reproduces the two committed faces
  before reporting a third**; a tool that cannot reproduce a known answer has
  no business producing an unknown one. Uses fontTools out of `tools/cv/.venv`,
  which is an incidental of that stack rather than a declared dependency — so
  it is not part of `npm run check`.
- `tools/ae/measure-fonts.jsx` — free, local. A session drives it over
  AppleScript `DoScript` (`framopiaDriven` set, `quiet` true); a person can also
  run it from File > Scripts > Run Script File and gets a message box. Lists what After Effects has for each of the
  three K2 faces, writes `TextDocument.font` and reads it back to find which
  name form actually takes, records what an unresolvable name becomes, and
  measures cap height, an x-height proxy and advance width at 343 and 425 with
  `sourceRectAtTime`. Adds one temporary comp to the open project and removes
  it; **never saves**. Writes `.local/build/font-measurements.json`.
- `GET /fonts` — free, local, read-only. The faces the running After Effects can
  set, by its own names. Drives the instance; writes nothing. `GET
  /subtitle-preview` names a real frame to position the subtitle line against.
- `npm run golden [-- --record] [-- --reference <path>]` — free, local. Builds the
  four-reel golden set, censuses each in After Effects and compares ~17,000 fields
  per run against `benchmarks/references/golden/census.json`. Needs After Effects
  open. See *`npm run golden` is what the second machine is measured against*.
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
scripts above or by the pipeline's *Looking at the video* stage, never by a
cache miss. What that stage reads to decide whether to re-run is
`masks-2fps/frame-analysis.json`, which is a record of what was looked at and
not a cache key: it is compared field by field against the video as it is now,
and anything it cannot account for is a re-run.
