# Framopia Studio — Architecture

Version: 1.0 (Foundation). The Edit Plan schema is versioned independently (`schemaVersion` field); breaking changes require a migration note in a handoff.

## 1. The three pieces

```
┌────────────────────────────  After Effects 2026  ───────────────────────────┐
│  ┌─────────────────────┐        evalScript / CSInterface        ┌─────────┐ │
│  │  CEP panel          │ ─────────────────────────────────────▶ │ Extend- │ │
│  │  React + TypeScript │                                        │ Script  │ │
│  │  (entire UX)        │                                        │ (.jsx)  │ │
│  └─────────┬───────────┘                                        └─────────┘ │
└────────────┼────────────────────────────────────────────────────────────────┘
             │ localhost HTTP (JSON)
   ┌─────────▼──────────────┐        subprocess (stdin/stdout JSON)
   │  Companion service     │ ─────────────────────────────▶ ┌──────────────┐
   │  Node.js + TypeScript  │                                │ Python       │
   │  ffmpeg, ASR, LLM,     │                                │ sidecar (CV) │
   │  images, cache, costs  │                                └──────────────┘
   └────────────────────────┘
```

### 1.1 CEP panel (React + TypeScript)
- The only user-facing surface. Workflow: select video → select client mode → run pipeline (staged progress) → review/edit transcript (word edit, script toggle, group adjust) → keyword mode + checkboxes → image candidate picker (pick / regenerate-with-tweak / own prompt) → zone review/manual adjust → Build.
- Talks to the companion service over localhost HTTP; talks to ExtendScript via `CSInterface.evalScript` with JSON strings (always JSON-in/JSON-out, never ad-hoc string parsing).
- Spawns the companion service on panel load if not running (health-check endpoint; pid/lock file to avoid duplicates).
- Dark-first Framopia branding as specified in PROJECT_SPEC.md §6. RTL-aware rendering for Arabic-script words in the transcript editor (per-word `dir` attribute; never force a whole line RTL).

### 1.2 ExtendScript layer (ES3 .jsx)
- The only code touching the AE DOM. Stateless executor of a **build plan** (a fully resolved projection of the Edit Plan: absolute file paths, absolute times in seconds, resolved template comp names, resolved positions in pixels, SFX events with file paths).
- Operations: open/create project; import footage, watermark, images, SFX, template AEP; duplicate template comps; set placeholder text/source; retime instance in/out; position by anchor rules; set watermark alpha interpretation; assemble master comp; save `.aep`.
- No network, no decisions, no fallbacks beyond "fail loudly with a structured error". Errors return as JSON to the panel.
- Testable headlessly: a runner script executes the builder against the test AEP + a fixture build plan via `aerender`/`osascript`-driven AE without the panel (established in Block 7).

### 1.3 Companion service (Node.js + TypeScript)
- Localhost HTTP (bind 127.0.0.1 only; random free port written to a well-known file the panel reads; simple shared token in the same file to reject foreign requests).
- Responsibilities: audio extraction (bundled/checked `ffmpeg`), Scribe v2 calls, Gemini calls (transcription-correction pass, semantic analysis, image prompt planning), Nano Banana generation, cache, cost ledger, Edit Plan persistence, invoking the Python sidecar, producing the resolved build plan.
- Long operations are jobs: `POST /jobs` → job id → panel polls `GET /jobs/:id` (status, stage, percent, partial results). No websockets needed.

### 1.4 Python sidecar (CV)
- Repo-local venv (`tools/cv/.venv`), invoked as a subprocess per task with JSON on stdin/stdout. No server, no state.
- **Chosen libraries (your-call decisions, revisitable with evidence in Block 5):**
  - Person segmentation for negative-space detection: **MediaPipe Image Segmenter** (fast, robust for a single centered person, Apple Silicon friendly). Fallback if quality disappoints on real footage: **ultralytics YOLO11-seg**. Block 5 validates on real frames before freezing.
  - Background removal for image cutouts: **rembg** with the **BiRefNet-general** model (current best open cutout quality), alpha-matting post-pass optional. Quality gate implemented on top (see §5.4).
- Tasks: `segment_person` (sampled frames → person masks), `compute_zones` (masks → stable negative zones), `remove_bg` (image → cutout + quality metrics).

## 2. Repo layout

```
framopia-studio/
├── CLAUDE.md                     # Claude Code operating memory (kept current; see guidelines)
├── README.md                     # human tone, short
├── docs/                         # the 7 foundation docs + amendments
├── reports/                      # block-N-session-M.md per-session reports
├── handoffs/                     # conversation handoff documents
├── panel/                        # CEP extension (React+TS, bundled to panel/dist)
│   ├── src/
│   ├── CSXS/manifest.xml
│   └── jsx/                      # ExtendScript sources (.jsx, ES3)
├── service/                      # Node companion service (TS)
│   └── src/
├── tools/
│   ├── cv/                       # Python sidecar (+ .venv, requirements.txt)
│   └── validate-templates/       # template validation script
├── templates/
│   ├── library.aep               # template comps (may split into multiple AEPs later)
│   └── manifest.json             # template manifest (schema in TEMPLATE_LIBRARY_GUIDE.md)
├── modes/
│   └── k2-syndicalia.json        # client modes (versioned JSON)
├── assets/
│   ├── brand/Framopia_LOGO.png
│   ├── watermark/intro.mov       # QuickTime with alpha
│   └── sfx/                      # ~5 files + sfx.json (id → file, default gain)
├── benchmarks/                   # Block 1 harness + results (footage stays out of git)
└── .local/                       # gitignored: cache, keys, per-machine config, working files
```

Git rules: source footage, generated images, caches, `.env`/keys, venv, node_modules, AE autosaves are **gitignored**. Templates AEP, watermark, SFX, logo, modes, docs are **committed** (binary assets are small and shared state — this is the sharing mechanism between the two machines).

## 3. The Edit Plan (schema v1)

One JSON per video, at `<video-dir>/<video-name>.editplan.json` (plus copies in `.local/cache`). Every stage reads and enriches it; the panel edits it; the build step projects it into a build plan.

Field-by-field:

```jsonc
{
  "schemaVersion": 1,
  "meta": {
    "id": "uuid",                       // stable per source video
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "appVersion": "semver of framopia-studio"
  },
  "source": {
    "videoPath": "/abs/path.mp4",
    "sha256": "…",                      // cache key root
    "durationS": 62.4, "fps": 30, "width": 2160, "height": 3840,
    "audioPath": "/abs/extracted.wav"   // 16-bit PCM mono 16 kHz for ASR
  },
  "clientMode": { "id": "k2-syndicalia", "version": 3, "path": "modes/k2-syndicalia.json" },

  "pipeline": {                          // stage bookkeeping; drives panel progress UI
    "transcription": { "status": "done|running|error|pending", "config": "hybrid-v1",
                        "costUsd": 0.03, "cached": true, "completedAt": "…", "error": null },
    "analysis": { "…": "same shape" },
    "images": { }, "zones": { }, "build": { }
  },

  "transcript": {
    "words": [{
      "id": "w0041",
      "start": 12.34, "end": 12.61,      // seconds, from ASR timing authority
      "text": "kan9olo",                 // display form (post-correction, post-orthography)
      "sourceText": "كنقولو",            // raw ASR form, kept for audit/diff
      "lang": "darija|msa|fr|en|mixed",
      "script": "latin|arabic",          // current rendering decision, per-word editable
      "confidence": 0.92,                // for review-UI highlighting
      "removed": false,                  // filler/stutter cleaning marks, never deletes
      "removedReason": "filler|stutter|falseStart|null",
      "edited": false                    // true once a human touched it
    }]
  },

  "subtitles": {
    "groups": [{ "id": "g012", "wordIds": ["w0041","w0042"],
                 "start": 12.34, "end": 12.98,       // derived, re-derivable
                 "templateId": "sub_pop" }]           // from mode's allowed variants
  },

  "keywords": {
    "mode": "auto|propose",
    "items": [{ "id": "k03", "wordIds": ["w0055"], "text": "flous",
                "score": 0.87, "reason": "…",         // short model rationale
                "approved": true,                     // auto mode: true by default
                "templateId": "kw_slam", "start": 18.2, "end": 19.0 }]
  },

  "images": {
    "slots": [{
      "id": "img02", "start": 21.0, "end": 24.5,
      "contextText": "…transcript span…", "idea": "one-line concept",
      "prompt": "final composed prompt", "negativePrompt": "…",
      "candidates": [{ "id": "c1", "path": "/abs/gen1.png",
                       "cutoutPath": "/abs/gen1_cut.png",
                       "cutoutQuality": 0.81 }],
      "chosenCandidateId": "c1",
      "presentation": "cutout|card",     // quality-gate outcome, editor-overridable
      "zoneId": "z_top", "templateId": "img_float",
      "status": "pending|generated|approved"
    }]
  },

  "zones": {
    "sampleFps": 2,                       // analysis sampling rate
    "zones": [{ "id": "z_top", "kind": "top|left|right",
                "rect": { "x": 0.1, "y": 0.05, "w": 0.8, "h": 0.18 },  // normalized 0–1
                "valid": [[0.0, 62.4]],   // time windows where the zone is actually free
                "manual": false }]        // true when editor adjusted it
  },

  "sfx": {
    "events": [{ "id": "s07", "sourceElementId": "k03",  // element that triggered it
                 "sfxId": "hit_01", "timeS": 18.2, "gainDb": -6 }]
  },

  "watermark": { "assetPath": "assets/watermark/intro.mov", "startS": 0, "durationS": null },
                                          // durationS filled at Block 7 from the real file

  "costs": { "totalUsd": 0.74, "byStage": { "transcription": 0.05, "images": 0.62 } },
  "build": { "status": "none|built|stale", "aepPath": null, "builtAt": null }
}
```

Rules:
- Word timings are the single timing authority; groups/keywords derive from wordIds and are re-derived after transcript edits.
- SFX events are **generated**, never hand-authored: recomputed from element templateIds + template manifest bindings on every build. They live in the plan only for preview/inspection.
- Any human edit sets `edited`/`manual` flags; automated re-runs must never overwrite flagged items without explicit confirmation.
- `build` is written by the build itself, in `build-reel-cli.ts`, once the `.aep` is known to be saved **and** every post-build check has passed — never by the job that spawns it, on the same reasoning as `appendCost`: a wrapper cannot know whether the thing it wraps really happened. A build that reports no save path, or names a file that is not on disk, records nothing rather than claiming a build. A failed build leaves an earlier record alone, because its `.aep` still exists and the record is still true. `aepPath` is re-rooted on read by `resolvePlanPaths`, like every other stored path. **Nothing reads `build` yet**: `mergeIntoExistingPlan` marks a built plan `stale` when the transcript changes, and no code acts on `stale`.
- The **build plan** is a derived, throwaway JSON (absolute everything, no nulls, validated against templates manifest) produced by the service at Build time. Its shape is defined in Block 7 and documented next to the ExtendScript.

## 4. Data flow (happy path)

1. Panel: user picks video + mode → `POST /jobs {type:"pipeline"}`.
2. Service: hash video → cache lookup → extract audio (ffmpeg) → transcription (frozen Block 1 config) → clean/tag/group → Edit Plan written.
3. Panel: transcript review/edit → keyword stage (per selected mode) → analysis job (keywords + image slots) → user approves/edits.
4. Service: image generation job (per-slot candidates, style from mode) → sidecar cutouts + quality gate.
5. Panel: candidate picking, zone review (zones computed by sidecar during step 2–4, in parallel).
6. Build: service validates plan completeness + templates manifest → emits build plan → panel calls ExtendScript with its path → comp built → `.aep` saved → status reported.

## 5. Stage notes

### 5.1 Audio extraction
`ffmpeg -i in.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le out.wav`. ffmpeg presence checked at service start; install guidance surfaced in the panel if missing (Homebrew).

### 5.2 Transcription (see PROJECT_SPEC §7)
Config frozen in Block 1. Hybrid presumption: Scribe v2 (timestamps, raw text, keyterms from mode vocab) → Gemini correction pass (audio + draft + ORTHOGRAPHY_GUIDE + vocab → corrected words, lang tags, script decisions) → alignment merge onto Scribe timings (anchor-based token alignment; unmatched corrected tokens interpolate between anchors) → confidence propagation.

### 5.3 Semantic analysis
One structured Gemini call over the corrected transcript + mode context → keyword candidates (scored, reasoned) and image slots (5–6/30 s, spread, non-overlapping windows, prompts composed from idea + mode style fragments + global negative prompts including "no text, no watermark, no logo").

### 5.4 Image generation + quality gate
Nano Banana, paid tier, 2–4 candidates/slot (**default 2** since Block 4 session 5; mode-overridable via `imageCandidates`).

Cutout gate: rembg/BiRefNet → metrics (alpha edge noise, hole ratio, foreground area sanity, edge halo) → below threshold ⇒ `presentation:"card"` fallback. Editor sees both and can override either way.

**Amendment (2026-08-25) — single-subject ideas.** A planned slot's `idea` must depict one subject. `planSlots` throws `MultiSubjectIdeaError` naming the slot and the offending phrase; it does not rewrite. Block 4 session 6 generated `A salon shelf displaying premium hair care products`, which produced an `alpha_edge_noise` failure the gate reported as a matte defect, 47 invented label words, and an unusable matte — one idea contradicting the mode's own invariant in three ways. See PROJECT_SPEC §5.

**Amendment (2026-08-25) — candidate default.** The default was 3. `gemini-3-pro-image` bills ~$0.151 per 2K image against a published $0.134, so three candidates on a five-slot reel is $2.26 — outside PROJECT_SPEC §5's $0.50–2.00 envelope before a single retry. Two puts the same reel at $1.50. The band is unchanged. Frozen config, evidence and caveats: `docs/DECISION-image-config.md`.

**Amendment (2026-08-25) — `edge_halo` compares against the original.** The metric measured alpha outside the subject and could not tell a rim the model rendered from background the remover retained, so a correct render under a rim-light prompt scored like a bad matte. It now excludes ring pixels that are bright in the source. The threshold is unchanged, and on the Block 4 footage the fix changes no verdict: the measured ring sits over #1A0000 and the rendered rim is inside the solid mask. See `benchmarks/RESULTS-block4-halo.md`.

**Amendment (2026-08-25) — cost fields.** `costs.byStage` holds what the **most recent** run of a stage cost, zero on a cached run so the key stays diffable. `costs.spentUsd` and `costs.spentByStage` hold **cumulative money actually spent on the reel**, accumulated across runs: a cached run adds nothing, a regenerated slot adds rather than replaces, so the figure can exceed one clean run. Block 8's spend alarm reads the cumulative one. Both optional with a default; absent means unknown, not zero. Slot planning writes `imageSlots`, not `images`, so the two stages do not share a bucket.

### 5.5 Zones and placement
Sample frames at ~2 fps → person masks → per-frame free rectangles top/left/right → temporal intersection with hysteresis → stable zones + validity windows. Placement solver (service-side, deterministic): assign image slots to zones honoring validity windows, no overlap with subtitle band, keywords, or other concurrent images; deliberate slight jitter in offsets within safe bounds so placement doesn't look machine-uniform. Manual fallback: panel zone editor writes `manual:true` rects that the solver treats as ground truth.

### How long a picture is on screen

**A picture's window and its life are two different things**, and
`service/src/build/picture-life.ts` is the one declaration of the second. It is
read by two callers that must not disagree: `build-reel-cli` sizes each picture
from the face mask over the span it returns, and `reel-plan` sets the layer's
out point from it.

**A picture arrives at the word it is about** — the user's ruling of
1 September. It was placed across the whole span it was given, so it appeared
where the sentence begins rather than where the thing it depicts is named.
Nothing on disk can identify that word: the transcript is Arabic, the idea is
English, and Block 10 session 40 measured a text match firing on 1 of 26 slots.
So **slot prompt v3 asks the model**, which chose the span and wrote the idea in
the same breath, and the answer rides on the slot as `nameWordId` — optional
with a default, absent meaning the span's start. A picture may start later
inside its own span and nowhere else, and never so late that its entrance could
not finish inside its own words.

**A picture stays until the next one appears** — the user's ruling of
1 September, given after looking at his own reel built two ways. A picture leaves
on the frame the next one arrives; the alternative he was shown, where the
outgoing picture stayed underneath for the length of the incoming one's 0.4004 s
fade, was rejected. There is no option and nothing to select between. **The
hand-over is to the next picture's arrival**, so a picture that now arrives later
also leaves later and there is still no gap.

**A picture's sound follows the picture.** The whoosh leads it by about 17
frames, so `analysis/sfx` places it from the same `pictureStartOf` the builder
lays the layer from; taking the span's start there would land the sound before
anything appeared.

**A picture is measured against the whole of its life, never against its words
alone.** Sizing a picture over its words and then holding it past them is unsafe
by construction: the speaker keeps moving, and Block 10 session 39 measured 13 of
26 slots across four reels landing over her that way, `sora`'s `img002` by
376 px.

**And it is measured against each frame of that life, never against their
union.** A union is a box the speaker is never inside — it pairs the leftmost she
reaches in one frame with the highest she reaches in another. A square is clear
at one frame if it stops before her left edge **or** above her head, either
separation being enough on its own, so the largest square safe for a whole life
is the smallest, over the frames, of each frame's own better bound. Taking the
union first and the better bound second is a different and always smaller number.

Block 10 session 42 measured what that cost. `sora`'s `img002` came out at
669 px where every single frame of its life allowed at least 941, because its
life spans a **cut** — from a standing shot in a corridor to a seated one on a
sofa — and the union of the two framings is larger than either. Per frame the
reel goes from 669–1073 px to **881–1073**, and 19 of the project's 26 slots do
not move at all: the rule only gives back what the union invented.

**The nudge is bounded by the union even though the size is not.** Jitter is only
ever offered a move one bound already guarantees, and a move that must be safe at
every frame has to clear the extreme of every frame. Two different questions,
two different boxes.

`placementIsSafe` is asserted **per frame** for the same reason: a picture that
clears the union says nothing that was not already known, and what has to be true
is that it is clear in every frame it is actually on screen.

**The last picture in a reel ends with its own words.** The ruling names the next
picture as what a picture waits for; where there is none there is nothing to wait
for, and holding it to the end of the reel would be a second ruling nobody has
given.

**Where it breaks: a reel with few pictures gets long ones.** The hold is the gap
the planner left, and the planner leaves gaps in proportion to how few slots
survived. `test-1` has four pictures over 22 s, so one of them sits motionless
for 7.2 s and outlives its own sentence by the same. There is no maximum, and one
taken from these reels would be a number fitted to them.

### Where a picture's prompt comes from, and when

The four brand colours reach the image model through **one sentence** in the
client's own `imageStyle.stylePrompt`, with `{{palette.*}}` substituted by
`renderStylePrompt` (`core/src/mode.ts:880`) — all four roles, each with a
distinct job. `composePrompt` (`service/src/analysis/slot-select.ts:149`) joins
the idea, those fragments and the drawn variation axes.

**That happens once, when the slots are planned**, and the result is frozen onto
the plan as `slot.prompt`. `planImageSlotsForPlan` reads the **live mode file**,
so a new reel gets whatever the client's colours are at that moment. Image
generation then sends `slot.prompt` **verbatim** (`service/src/images/generate.ts:247`)
and never re-reads the palette — so editing a colour afterwards changes nothing
about an existing reel's pictures. `npm run recompose` re-composes a plan's
prompts from the stored ideas and the current mode with no model call, and it is
a terminal command that no panel control calls. `slotsReplacementFlags` and
`imagesReplacementFlags` then block a re-plan and a regeneration respectively
once candidates exist, so the pictures themselves only move under `--force`,
which is billable.

**The panel can only set the colours when a client is created.** `POST /clients`
is the one route that writes a palette; there is no route that edits one.

## 6. Caching & costs

- Cache root `.local/cache/<video-sha256>/`. Keys: stage + config-fingerprint. Any fingerprint change ⇒ miss; identical re-runs are free. **No key contains the mode version** — see below.
- **Amended (Block 9 session 14): a cache key never contains `mode.version`.** This section said it did, and the code stopped doing it twice, both times after a bump stranded work that had been paid for. What each stage actually keys on, read from the code:
  - **transcription** — prompt version, Gemini model, ORTHOGRAPHY_GUIDE version, Scribe model, keyterms. The mode is not an input at all: transcription runs before a client is chosen.
  - **keywords and image slots** — prompt version, Gemini model, mode **id**, a **content hash of the mode fields that call actually reads** (`[name, vocabulary]` for keywords, `[name]` for slots), the transcript hash, and the candidate count. Block 4 session 4 replaced the version with the content hash after a v3 bump invalidated four entries for an edit the model never saw.
  - **images** — the composed prompt, the negative prompt, the model id, the resolution, the aspect ratio, the candidate index and the mode **id**. Block 7 session 1 removed the version after a v6 bump added two template ids no image call reads and stranded 14 generated images, $2.06 of billed spend. Every mode field an image request carries reaches the model only through the two prompt strings, and both are hashed verbatim, so a mode edit that changes the request invalidates on its own and one that does not, cannot have.
  - The general rule: **key on what the call actually sends, never on a number that moves for unrelated reasons.** K2 Syndicalia went v10 → v12 during Block 9 and no cached entry moved.
- Cached artifacts: extracted audio, raw ASR JSON, Gemini correction output, analysis output, every generated image + cutout + metrics, zone masks/results.
- Cost ledger: every billable call appends `{ts, stage, model, unit, usd}` to `.local/costs.jsonl`; per-video totals aggregate into the Edit Plan; panel shows running cost per reel. Soft alarm in the panel when a reel crosses $2.00.

## 7. Dev environment

- **CEP debug:** `defaults write com.adobe.CSXS.12 PlayerDebugMode 1` (adjust CSXS version to AE 2026's), extension symlinked into `~/Library/Application Support/Adobe/CEP/extensions/`, panel served from `panel/dist` with a dev-reload flow; remote debugging via the `.debug` file + Chrome DevTools on the declared port.
- **ExtendScript debugging:** VS Code + ExtendScript Debugger extension, launch config committed in the repo.
- **Node:** LTS via nvm; version pinned in `.nvmrc`. **Python:** 3.11+ venv at `tools/cv/.venv`, `requirements.txt` pinned.
- **Keys/config:** `.local/config.json` per machine (gitignored): API keys, port file location, machine label. A `config.example.json` is committed.
- Exact bootstrap commands live in CLAUDE.md and the Block 1 report; the second-machine install doc is `docs/SECOND_MACHINE.md`.

### 7.1 The check surface

Three commands, answering three different questions, and none substitutes for another.

- **`npm run check`** — is the code correct here. Typecheck, lint and tests across every workspace, plus the gates that read real artifacts: the client modes, the template manifest against the audited `library.aep`, the CEP manifest, every `.jsx` against ES3 and ExtendScript's reserved words, and the hand-made references (present, readable, parseable, then each transcript's declared orthography version). It builds nothing and needs no After Effects.
- **`npm run doctor`** — is *this machine* able to run the pipeline at all. 24 checks, each reporting `present`, `absent` or **`unknown`** — never folding "cannot tell" into "fine" — with the measured value beside each verdict, and exiting non-zero only for an absent `run` or `build` requirement. Read-only; it reports and never repairs.
- **`npm run golden`** — does *this machine* build the same thing. It builds the four reels of the golden set, censuses each in After Effects, and compares roughly 17,000 fields per run against `benchmarks/references/golden/census.json`: every card's text, face, size and shrink factor, every placement and scale, every audio level, every layer count, and the file behind every picture. A difference fails the run naming the field and both values. Free by construction — it builds and never runs a billable stage — and it reports the ledger at both ends. Recording a reference is `--record`, a separate and explicit action.

`ground-truth` is outside the golden set until its images exist. Only two fields are excluded from the comparison, `measuredAt` and `aepSha256`, each measured to vary across 24 builds; absolute paths are made repo-relative rather than excluded, so the repository can live anywhere and a path differing in any other way still fails.

## 8. Error philosophy

Every stage fails loudly with a structured error surfaced verbatim in the panel (stage, cause, retry-ability). Automatic retries only for transient network/5xx (bounded, jittered). Nothing ever silently degrades transcription quality; a degraded path (e.g., Scribe down) is an explicit user choice in the panel, never a default.


## 9. Operating knowledge, moved here from CLAUDE.md

The sections below were written one session at a time in `CLAUDE.md`, which
grew to 530,588 characters — three and a half times the size at which it is
read whole. Block 10 session 28 moved them here **verbatim**, wording and
figures untouched, so that a session looking for how something works finds it
in the document it would already open. Nothing was summarised and nothing was
dropped; `git show 1c8c850:CLAUDE.md` is the file as it stood before the move.


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

### Nothing in the panel's startup path may throw

There is no error surface before React mounts, so anything thrown at module
load reaches the user as a blank panel — which is exactly what happened when
`cep_node` was missing. **A missing capability is a state the app renders, not
an exception.** `detectHost()` returns a discriminated union and never throws;
`index.tsx` mounts unconditionally; every `loadX` rejection resolves to an
empty list. The panel is a view over the service and the ExtendScript layer and
is never the place a decision lives.

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

**`k2-syndicalia` stopped being the mode that exercises that fallback at Block 9
session 2** — the user supplied its real faces. The fallback is not retired; it
is what every client yet to be made still gets, and `build-fonts.test.ts`
exercises it against a client that really has none.

### Nothing that names a file on this machine is sent to a model

`core/src/outgoing-text.ts`, called from `generateImages` immediately before
`client.generate` on both the prompt and the negative prompt.

**The rule it guards is `client-pictures.ts`'s first one** — a client's own
photograph never leaves this machine — and until now that rule was held only by a
source scan over `service/src/images/` for the words `clientPictures`,
`chosenClientPictureId` and `client-pictures`. **That catches the obvious mistake
and nothing else**: a file reading `mode.pictures` directly, or a path reaching a
prompt from anywhere upstream, passes it in silence. Now that there is a control
that adds photographs, that gap matters more than it did when nothing could.

It looks for **a path, not for a photograph**, deliberately: a guard that had to
know which paths were photographs would have to read the client's pictures, which
is exactly what the source scan forbids the image graph from doing. **All 30
prompt and negative-prompt strings stored across the five plans pass it**, and
`generate.test.ts` proves it refuses before any request reaches the client —
demonstrated failing by deleting the two calls.

**A client's photographs are not in the backup set, and that is a finding rather
than a fix.** Measured against `surveyGroups` this session: 126 files across nine
groups, none of them a photograph, and **no still under the footage directory is
swept** — `plans` filters `.editplan.json`, `images` walks `cutouts/`, `footage`
takes video extensions only. The client file names the path and is in git; the
photograph itself is wherever he put it, and `npm run backup` will not save it.

### The font sample draws the real face, or says it cannot

**Session 16's sample was a silent substitution.** It set `font-family` to After
Effects' name and let the browser resolve it, so choosing the *italic*
`AdobeClean-It` drew upright text in a plain sans — a face nobody picked,
presented as the sample. That is the same shape as the defect PROJECT_SPEC
guards against in the build, where After Effects accepts a name it cannot
resolve and quietly sets something else. **A plain name is honest; a wrong
sample is not.**

**The panel is a browser and can only draw a face it can load as a file**, so
the name has to become a path. `tools/font-resolve/resolve.py` asks **CoreText**
through `ctypes` — stdlib only, no venv — because CoreText is the thing that
owns After Effects' naming for a variable font's instance. Measured this
session: matching on the PostScript name macOS publishes resolves **900 of
1188** and **misses two of the three faces this studio uses**; CoreText resolves
**1164 of 1188 with zero substitutions**, including both.

**The 24 that resolve to no file are Adobe's own application faces**
(`AdobeClean`, `AdobeCleanUX`, `AdobeCleanHanSC`, `SourceCodePro` — 14), **Skia's
nine named instances**, and `EmojiOneColor`. An application registers them
without a file another process can read. **A face with no file is reported as
unpreviewable, never approximated.**

**A substitution is rejected rather than returned.** CoreText answers a
descriptor for a name it does not have, so the resolver compares the name it got
back against the name asked for and calls a mismatch unresolvable.

**The variation axes come back with the file, and they are load-bearing.** The
file behind `Inter-SemiBold` is `Inter-VariableFont`, whose default instance is
Regular — measured in Chromium, the same file renders **366.89 px at `wght 600`
against 352.89 at its default and 325.63 at `wght 100`** for one string. Without
`font-variation-settings` the sample would be the wrong weight and still look
plausible. CoreText gives `wght: 600` exactly, so nothing is inferred from a
weight name.

**Verified by measurement, not by asserting the CSS**: all four real font files
load from `file://` under CEP's own manifest flags, and each draws at a width
distinct from the sans-serif fallback — Cormorant italic 289.97, Almarai on
Arabic 218.64 against a 169.75 fallback. **Observed in Playwright's Chromium,
not in CEP**; `FontFace` (Chrome 35) and `font-variation-settings` (62) are both
well inside CEP 12's Chromium 99, but it has not been seen there.

**The Arabic field samples with Arabic** — `شنو كتعرفي`, from the corpus's own
speech, short enough for the field and exercising initial, medial and final
forms. Arabic has no conventional pangram and a made-up string would show
nothing about a face.

### The font list narrows and hides nothing

**1,188 names is not a list you can scroll**: finding `Inter-SemiBold` meant
passing every Adobe UI face on the machine. The field filters as he types and
reports `N of 1188`. **Nothing is ever removed** — a hidden font is a font he
cannot choose, and this is his tool for his clients' brands — so clearing the
box gives the whole list back, and a test asserts it. *The standard one* stays
first. **The order is untouched**: the alphabetical order the service already
returns is defensible, and no rule for promoting faces was found that was better
than arbitrary.

### 1198 and 1188 are one reading counted two ways

Session 12 measured **1198**, session 16 reported **1188** without remarking on
it. Both are right and **no font appeared or disappeared**: 1198 is the raw
comma-split count and 1188 the distinct one. The difference is **10 duplicate
occurrences across 6 names** — `PingFangHK-Medium`, `PingFangMO-Medium`,
`PingFangSC-Medium`, `PingFangTC-Medium`, `Helvetica-Light` and
`HalyardMicro-BoldItalic` — each listed under more than one family entry.
`framopiaInstalledFontNames` does not dedupe; `fontListView` does. Measured
again this session on the same unrestarted instance: **445 / 1198 / 1188**.

### The pre-build figure is the build's own

`plannedCards` in `service/src/build/planned-cards.ts` is the one declaration of
which groups become cards, read by `buildReel` and by `steps.ts`. A group is a
card unless a keyword superseded it, it carries no template, or it has no
display timing — the three reasons the builder skips one.

The panel had been reporting `plan.subtitles.groups.length`, which is the right
number for validating a plan and the wrong one for telling someone what they are
about to get. Per reel, groups against cards: ground-truth 76 → **71**, test-1
67 → **64**, test-2 69 → **64**, test-3 58 → **58**, vitasilk 73 → **68**. All
four buildable ones are confirmed against the golden reference, which was
measured inside After Effects from real comps.

**`BuildPreview.words` is a schema addition, optional with a default**, because
the Words opener's badge was reading `subtitleCards` and was right only by
coincidence — a card is one word today and nothing superseded is listed, so the
two numbers happened to agree until a keyword superseded a group.

### `npm run golden` is what the second machine is measured against

`-- [--record] [--reference <path>]` — free, local. Builds each reel of the
**golden set** — `test-1`, `test-2`, `test-3`, `vitasilk` — censuses each in
After Effects immediately after its own build, and compares roughly **17,000
fields per run** against `benchmarks/references/golden/census.json`. A
difference fails the run **naming the reel, the field path, the expected value
and the actual one**; a count is not a finding.

**`ground-truth` is deliberately out of the set**: its six image slots were
planned and never generated, so it refuses at pre-flight with
`UnplaceableElementsError` and there is no comp to census. It joins when the
pictures exist, which is a spending decision.

**Exactly two fields are excluded, and only because they were measured to
vary.** Twenty-four builds — three of each reel, twice, the second pass after
the census learned to record image sources — moved `measuredAt` and
`aepSha256` and nothing else, on every reel: 51,558 field readings, 8 varying.
Everything else is compared, including every card's text, face, size and shrink
factor, every position and scale, every audio level and every layer count.
**Nothing is excluded because another machine might differ** — that is the
difference this exists to find. Each exclusion carries its evidence in
`GOLDEN_EXCLUDED_FIELDS`, and a test pins the list at those two.

**Absolute paths are made repo-relative, not excluded**, so a repository in
another folder compares equal while a path differing in any other way still
fails.

**It is free by construction, not by sampling.** It builds and censuses;
neither reaches a paid API, and `golden.test.ts` pins that by reading the CLI's
own source for `appendCost`, `generateImages`, `runPipeline`, `transcribeHybrid`
and the Gemini SDK. The ledger is reported at both ends and a move fails the run.
The pipeline's own dry-run cost is printed beside each reel as information —
`test-3` would cost $2.3508 if anyone ran its analysis — and is deliberately not
a refusal, because `test-3` builds perfectly well from what is already on disk.

**Recording is `--record`, a separate and explicit action.** A command that
quietly rewrites what it checks against is a check that cannot fail. A missing,
unparseable or reel-short reference is a stated failure naming the file.

**The census records which picture each slot places, since this session.** A
master's image layers are *comp* layers and carry no `sourceFile`, so a census
recorded nothing about the pictures at all and a build that placed the wrong one
matched a reference perfectly. Found by trying to perturb an image path and
discovering there was none. `imageComps` is a **schema addition, optional with a
default**, and it is where a partly-copied cache would show up.

### A stored path is re-rooted onto the repository running now

**The Edit Plans store absolute paths — 52 across the five plans — and every one
was written on the drive this project grew up on.** That made the plans
unusable on a second machine, which is the whole of why
`docs/SECOND_MACHINE.md` used to say the repository had to sit at one exact
path. The partner clones from GitHub onto his own disk and cannot.

`resolveStoredPath` in `core/src/stored-path.ts` is the one resolver and it
**does not guess**: a path already inside this repository is returned unchanged,
a path carrying a repository anchor (`my files`, `.local`, `benchmarks`, …) is
re-rooted onto this repository, an absolute path inside no repository is
returned unchanged because it really does point somewhere else, and an empty or
relative one **throws `StoredPathError` naming the field**. "Already here" is
tested first, so a legitimate path that happens to contain an anchor word deeper
down is never split at the wrong segment. `REPO_ANCHORS` is pinned against
`readdirSync(REPO_ROOT)`, so a new top-level directory cannot silently become
the one thing that will not resolve on the other machine.

**Three read sites, not twenty call sites**: `readEditPlan`, `loadReels` and
`countCandidatesOnDisk` — the last because it parses a plan directly.
`service/src/editplan/stored-paths.test.ts` fails on any module under
`service/src` or `tools` that parses a plan and reads a path field without going
through one of them, comments stripped first; proven to fail by reverting
`steps.ts`.

**The same shape as `readTranscriptionCache`**, which has always recomputed
`audioPath` from the entry's own directory rather than believing the manifest —
which is why a cache entry was already portable. **The file keeps what it says;
the reader gets a path that works here**, and a read-modify-write cycle persists
the resolved form, which is self-healing rather than a migration.

**Proven by running the whole corpus from a second copy** at a different
absolute path (Block 10 session 11): four reels built from each checkout and
censused in After Effects, and **every census field identical once the root is
normalised** — only `measuredAt` and `aepSha256` differ, and After Effects
embeds a timestamp so two builds of one comp never match byte for byte. The
sandbox's dry run read `$0.0000` with every stage skipped and every candidate
cached, and its ledger was byte-identical.

**`.local/audio/` is not in the transfer set and a build does not want it.**
Deleted from the second copy, the build still succeeded and the dry run still
resolved the transcription entry as `compatible` at $0.00; the build's
pre-flight lists `source.videoPath` and never `source.audioPath`. That a
transcription run would recreate it is **read from `job.ts`, not run** — running
one is billable.

**`build-reel.jsx`'s unsaved-changes guard cannot recognise another checkout's
output.** It tests `openFile.fsName.indexOf(o.buildDir) === 0`, so each checkout
recognises only its own `.local/build` and two checkouts refuse each other's.
Known, **not fixed** — what that rule should say when two checkouts exist is a
question, not a bug to patch past.

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

**Frame analysis is driven** (Block 9 session 1). The `zones` stage — *Looking
at the video* on screen — samples the reel, segments every frame and derives the
zones itself, through the same `sampleFrames`, `segmentPerson` and `computeZones`
the three CLIs call. See *Looking at the video is a stage now* below.

`only: [stageId]` runs one stage and skips the rest with the reason *not part of
this run*, so re-doing the free frame analysis never walks past a billable stage
and hopes its cache still hits.

### Looking at the video is a stage now

**The `zones` stage drives the sidecar.** `analyseFrames` in
`service/src/frames/analyse.ts` samples the reel, segments every frame and
derives the zones, writing them onto the plan — the work `npm run frames`,
`npm run segment` and `npm run zones` do, called through the same functions in
the same order with the same parameters, so the driven path and the terminal
path cannot produce different masks. **Measured, not asserted: after driving all
five reels through the runner, every one of the 1180 frame and mask PNGs was
byte-identical to what was already on disk**, and each plan changed in `meta` and
`pipeline` only, its zones byte-identical.

**Progress is batched on this side, never parsed out of stderr.** The sidecar's
contract is one JSON request in and one JSON result out, so there is no progress
channel; `SEGMENT_BATCH_SIZE` = 8 frames per call, and each batch that returns is
a percentage. `StageReport.detail` carries the line — *"Finding you in the
picture — frame 24 of 53"* — and is a **schema addition, optional with a
default**, so a panel older than the service reads it as absent rather than
empty. A whole reel is **25–31 s** on this corpus, not the "minutes" the Block 8
handoff estimated; the panel still warns it can take a few minutes the first
time, because that is a claim about an unknown video rather than about these five.

**Freshness is decided by a manifest, and it is the artifact.**
`.local/cv/<stem>/masks-2fps/frame-analysis.json` records the source path and
**sha256**, the sample fps, the frame count, the sidecar task, the model and its
path, the threshold, the zone method and count, the wall-clock seconds and the
code version. Any mismatch, or no manifest, is a re-run — masks are reproducible,
so being wrong in that direction costs half a minute and being wrong the other
way builds a comp against another video's face. Nothing about the selection lives
only on stdout.

**A missing input refuses; it never returns nothing.** `FrameAnalysisUnavailableError`
names ffmpeg, the venv or the model, what the pipeline would otherwise do, and
the command that fixes it. An empty result is exactly the shape that put a
2030 px picture across the speaker while every check reported success.

**The build's refusal stays.** `buildRequirements`' face-mask requirement is
unchanged; what changed is that its command now names **Run pipeline** first,
with the two terminal commands after it, because the panel is where that sentence
is read and they are still what a terminal runs.

**A stale mask is replaced, not trusted.** The sidecar never rewrites a mask it
finds — every mask on disk has been measured, and re-encoding one to prove it is
unchanged is the one action that could change it — so a mask left over from a
different cut of the same video survives a re-run and reports itself as changed.
`analyseFrames` deletes exactly those and asks again, and reports the count.

### The build sets the face and the colour on the placeholder

**Since Block 9 session 6.** `textStyleFor` in `service/src/build/text-style.ts`
is the one declaration; `framopiaSetText` in `panel/jsx/text-fit.jsx` writes
`font`, `fontSize` and `fillColor` **in the same `setValue`** — a TextDocument
read from a property is a copy, so writing it back twice discards the first
write — and `applyFill` must be true or the colour is carried and not drawn.

Populating a placeholder is what the ExtendScript contract already covers. The
alternative is a hand-made copy of six comps per client, which is six chances
for them to differ.

| card | face | size | colour |
|---|---|---|---|
| ordinary Latin | `Inter-SemiBold` | the template's | crème `#F8F6F2` |
| emphasized Latin | `CormorantGaramondItalic-SemiBoldItalic` | **template × `EMPHASIS_SIZE_RATIO`** | gold `#C9A96E` |
| ordinary Arabic | `Almarai-Bold` | the template's | crème |
| emphasized Arabic | `Almarai-Bold` | the template's | gold |

**A size only travels when it has to.** The comps already carry 343 and 425, and
367 and 455 for the `_ar` variants — which is `ARABIC_SIZE_RATIO` applied by
hand when they were authored. The emphasis face is the one nothing anticipated,
so it is the only case where the build overrides the size; without it Cormorant
would render at Inter's nominal size and read smaller than the words around it.

**The emphasis face is Latin and has no Arabic**, so an emphasized Arabic word
is gold Almarai rather than gold Cormorant.

**A client with no measured font names gets no style at all** and its templates'
own type is left exactly as it was. Never a guessed name: After Effects accepts
one it cannot resolve and substitutes silently, so a guess would not fail — it
would set the wrong type. Pinned by `text-style.test.ts`.

`--emphasis-ratio` on `npm run build:reel` overrides the ratio for one build, so
one reel can be built at two of them and looked at side by side. Nothing in the
pipeline passes it.

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

### What cannot be got back, and `npm run backup`

**The test is not "expensive" — it is "no amount of money reproduces this
file".** Almost everything here rebuilds from the repository: masks are
bit-identical across runs, extracted audio is ffmpeg, every report regenerates
from disk. What fails the test, measured 2026-08-29:

| | files | size | in git |
|---|---:|---:|---|
| transcription cache entries | 22 | 8.1 MB | no |
| keyword and slot analysis entries | 11 | 42 KB | no |
| **hand-written ground truth** | 8 | 30 KB | **no** |
| hand-made alignment references | 3 | 15 KB | **yes** |
| the cost ledger | 1 | 16 KB | no |
| Edit Plans and their backups | 10 | 487 KB | no |
| generated images and cutouts | 39 | 44.6 MB | no |
| machine-local config (API keys) | 1 | 187 B | no |
| source video (opt-in) | 5 | 11.9 GB | no |

**The finding was `.local/ground-truth/`.** A person transcribed four reels by
ear and it is the WER baseline for the whole project; `.local/` is gitignored,
so this disk was the only copy and nothing had ever said so. The alignment
references were the only irreplaceable thing already safe.

`npm run backup` with no destination **prints the survey and copies nothing**.
`npm run backup -- --to <dir>` copies into `<dir>/framopia-studio/`, preserving
repo-relative paths; `--with-video` adds the 11.9 GB of footage. **Every file is
re-read from the destination and hashed after writing**, and a mismatch fails
the run — a copy that silently truncated is worse than no copy, because it is a
backup you would trust. It **never deletes anything at the destination**: a file
already there whose hash matches is left alone. A missing destination directory
is an error, never created, because a typo would otherwise make one and report a
successful backup into it. The default destination is `backupDir` in
`.local/config.json`, machine-local like every other per-machine setting.

53.3 MB without video, and it took **1.5 s** to a local disk.

**A cloud destination is refused when nothing is syncing it.** Session 40 copied
94 files into `~/Library/CloudStorage/GoogleDrive-…`, verified every hash and
confirmed every byte was local — all true, and none of it a backup: Google Drive
was not installed and macOS had left the mount point behind. **Nothing on the
filesystem separates a live provider folder from that leftover**, measured: same
device id as the home directory, same filesystem in `df`, and permissions
persist so the root is `dr-x------` either way. `checkSyncClient` reads the app
out of the folder name (`GoogleDrive-…` → Google Drive) and looks for a running
process from that app bundle. **What it cannot tell you**: whether this exact
folder is the one being served, whether the account is signed in, whether syncing
is paused, or whether the upload has finished.

**A cloud destination refuses to receive a credential.** `secrets.ts` classifies
each file by its **bytes**, not its name — a field whose name *ends* with
`apiKey`/`token`/`secret`/`password`/`credential` **and** whose value is 16+
unbroken characters of a credential alphabet, or a value in a shape a provider
publishes (`AIza…`, `sk_…`, a PRIVATE KEY block). Only the first 64 KB is read
and only if the bytes are valid UTF-8, so a key past that point in a binary
would be missed. **A looser first draft flagged the hand-made alignment
references**, which carry `draftTokenText` — the most irreplaceable file in the
set would have been left out of the cloud copy. Exactly one file in the set is
secret: `.local/config.json`. It is **named on screen when skipped**, never
silently omitted.

**Cloud is a path heuristic and `unknown` is a real answer.** `df` reports
`~/Library/CloudStorage/GoogleDrive-…` as `/dev/disk3s1`, the machine's own data
volume — a macOS FileProvider is not a mount — so **no filesystem fact separates
a sync folder from a plain one before writing**. Known roots
(`~/Library/CloudStorage`, `~/Library/Mobile Documents`, `~/Dropbox`,
`~/Google Drive`, `~/OneDrive`) are cloud, `/Volumes/*` is local, and anything
else **refuses and asks for `--cloud` or `--local`** rather than guessing local
and copying a key into a shared folder.

**Drive streams, so a cloud copy is verified as present locally.** Measured on
this mount: an undownloaded Drive file reports `st_blocks` **0** against a
6,298,543-byte size and carries macOS's `dataless` flag, while a file written
into the same folder reports **3912** blocks for 2,000,000 bytes. `isMaterialised`
reads `stats.blocks`, and the run fails if any copied file's bytes are not here.
**It says the bytes are here now, not that Drive will keep them** — Drive evicts
local copies to reclaim space. **Whether Google has finished uploading them is a
separate claim this cannot check.**

**The writable folder is found, not assumed.** Drive's account root is
`dr-x------`; the tool looks inside for a writable directory, uses it when there
is exactly one, and names the candidates when there is more than one. On this
machine that is `My Drive`.

**Run of record, 2026-08-29:** `backupDir` in `.local/config.json` is the Drive
account root, so `npm run backup` alone repeats it. **94 files, 53.3 MB, 0.2 s
of copying inside a 1.7 s run, every hash verified, every file materialised
locally, `.local/config.json` skipped**, at
`.../My Drive/framopia-studio/`.

### Staleness is a fact about code, never about clocks

**Four sessions lost time to a stale service and nothing could see it**:
`serviceVersion` and `appVersion` both come **from the service**, so they agree
by construction and say nothing about the bundle. Block 8 session 32's answer
was to stamp the bundle with its **build time** and compare it against the
service's `process.startedAt`. That answers a different question, and Block 9
session 3 is the session it cost: **a service running exactly the right code was
accused of being behind because it had started first, and no amount of
restarting anything cleared the banner** — nothing about the code was being
measured. `handoffs/block-8.md` §9 had already recorded both limits.

**Both artifacts carry one build stamp now** — `scripts/build-stamp.mjs`,
`<short commit>+<content hash>`. The commit is for a human; the content hash is
what decides, over every source file that is compiled or evaluated
(`core/src`, `service/src`, `panel/src`, `panel/jsx`, `index.html`, the CSXS
manifest), **tests excluded** because they are in neither artifact. One stamp
for the whole build, not one per side, so the two can be compared directly.

`panel/scripts/build.mjs` defines `__PANEL_BUILD_STAMP__`; the service build
writes `service/dist/build-stamp.json` and `/health` reports it. **The service
reads it once, at startup** — re-reading per request would report a rebuild the
running process has not loaded, which is the whole failure again.

**`compareBuildStamps` in `core/src/build-stamp.ts` is the one rule, read by
both sides** and imported by the panel through the `@framopia/core/build-stamp`
subpath — the barrel reaches `node:fs` through the config loader and esbuild
cannot resolve that for a browser target.

**Behind, unknown and down are three different states.** Equal stamps say
nothing, whoever started first. Different stamps name it with a remedy. A
service too old to send a stamp is **`unknown` — not an accusation**; the main
screen stays quiet and the details pane says *"this service does not say which
build it is, so the two cannot be compared"*, so silence and ignorance do not
look alike. `buildStamp` is optional-with-default for exactly that.

**`__PANEL_BUILT_AT__` and the start-time comparison are deleted**, with the
tests that asserted them.

### A file dialog is looked for, never assumed

A browser `<input type="file">` yields a sandboxed `File` with no path, and
every stage here needs an absolute one. CEP's own
`window.cep.fs.showOpenDialogEx` returns one — and `window.cep` is injected by
CEP itself, **not** `CSInterface`, which this extension has never loaded.
`fileDialogSupport()` looks for it and reports what it found in the readiness
details; **Browse renders only when the call is really there**, because a button
that opens nothing is worse than no button. The path field stays either way.
`panel/src/video-extensions.ts` mirrors the service's accepted list and a test
pins them equal — a dialog offering a file the folder listing would refuse is a
dialog that hands him an error.

### Build runs from the panel, through the same CLI a terminal runs

`POST /jobs {type:"build", params:{reel, planPath, mode}}`, polled like the
pipeline. `service/src/build/job.ts` **spawns
`service/dist/build/build-reel-cli.js`** rather than importing it: `runBuildReel`
blocks synchronously on AppleScript, so running it in-process would freeze the
service's event loop for the whole build and `GET /jobs/:id` could not be
answered until it finished. Spawning also settles the drift question — the panel
and the terminal do not run equivalent code, they run **the same file**.

**Progress comes from the build's own output, not from matching its prose.**
`service/src/build/stages.ts` declares three stages — `prepare`,
`after-effects`, `check` — and the CLI emits a marker per stage **only when
`FRAMOPIA_BUILD_STAGES=1`**, which the job sets and a terminal does not, so
stdout in a terminal is unchanged. A test pins that the CLI emits every declared
stage in order.

**A failure reaches the user as the sentence the build meant him to read.** The
CLI now prints `build refused at <stage>: <message>` to stderr as well as the
JSON; `failureMessage` prefers that, then a thrown error's message, and only
then the last line — because an uncaught throw ends with a stack and a Node
version banner, and taking the last line would put `Node.js v24.14.1` on screen
as the reason a build failed.

**The reentrancy question is settled, by the user's own hands on 2026-08-31.**
He drove the panel for the first time in the project's life: picked `vitasilk`,
pressed Build, and **After Effects accepted the `DoScript` while the CEP
extension was open** — comp built in 5.7 s, path reported, nothing rendered.
The reasoning had said it should work — the panel's JS is in `CEPHtmlEngine`,
the service is a separate Node process, and the blocking `execFileSync` is in a
spawned child, so nothing the panel depends on waits on AE's main thread — and
it is now an observation rather than an argument. **The panel, CEP `evalScript`
and the service's HTTP layer are no longer untested.** If a build ever hangs,
`pkill -f build-reel-cli` frees the service without touching After Effects.

**The build-stamp banner earned its keep in that same run.** The panel detected
that the service was a different build from the bundle, named the cause and gave
the command; the user ran it, reopened the panel, and the banner cleared. That
is the first time the staleness check has fired against a real mismatch.

`plan.build` on `GET /steps` is the **build preview**: reel, client and where it
came from, the output path, what the comp will contain, the watermark and its
size, the fonts, and that building is free. `buildOutputPath` in `steps.ts` is a
second copy of the builder's own naming rule and is pinned equal to it by a test.

### A missing input refuses; it never degrades

**Session 38's defect, and the general rule it produced.** Image placement reads
the **face masks**; with none on disk `faceBoxesFor` returned an empty map,
placement fell back to the frame alone, and a slot landed at **2030 px on a
2160 px frame** — across the speaker. `placementIsSafe` **passed it**, because
with no face box there was no face to clear. **A check that cannot fail is not a
check**, so `placementIsSafe` now takes a **required** `Rect`: a caller with no
face box cannot reach it, and the type says so.

`service/src/build/requirements.ts` is the one declaration of what a correct
build needs, read by `build-reel-cli.ts` before it places anything and by
`steps.ts` so the panel shows the same sentence and disables Build. Each
requirement names itself, what the build would otherwise do, and the command
that produces it. **Every one is conditional on what the comp actually
contains** — a check that always fires is as wrong as one that never can:

| requirement | needed when | without it |
|---|---|---|
| face masks | the reel has image slots | a 2030 px picture across the speaker |
| the CV sidecar venv | the reel has image slots | masks unreadable, frame colour chosen from nothing |
| `.local/build/watermark.json` | the plan asks for the mark | no watermark at all, and the comp looks like one that has none |
| `dialogueLufs`/`dialoguePeakDbfs` | the reel has sounds | no attenuation, and every sound sums past 0 dBFS |
| a client mode | the reel has image slots | the template's own frame colour, 1.03:1 against the pictures |
| every `templateId` in the manifest | any element carries an unknown one | an entrance budget of zero |

**No reel in the corpus refuses**, so the refusals stand on synthetic cases plus
one real-absence test: a plan copied to a stem nothing has sampled resolves to a
mask directory that genuinely is not there. All five reels build exactly as
before — `vitasilk` five pictures at 837 px, `test-1` four at 917.

**Frame analysis was still reported, not driven** at that session, and is
**driven since Block 9 session 1** — `zonesNotDriven` is gone. `dialogueLufs`
still reaches a plan only through `npm run migrate:sfx-placement`. What that
session changed is that a build no longer proceeds without them.

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

### The five-step rail and the two-column layout are retired

Both were true and are not. **Session 42 made the panel one screen** — the rail,
the remembered step, `stepsFor`'s navigation role and the 830 px two-column
switch went with it, along with `panel/src/steps.ts` and
`panel/src/panel-width.ts`. What replaced them is above, under *The panel is one
screen*.

Three things from that period are worth keeping, because they are lessons about
the host rather than about the layout:

- **A docked CEP panel's window is the size of the screen while its panel is a
  column wide**, so a media query lays out for the wrong thing. Any future
  responsive rule has to measure the panel, not the viewport.
- **A container query lays out for nothing at all**: `container-type` shipped in
  Chrome 105 and CEP 12 runs Chromium 99, so the whole at-rule block was dead
  text and the panel silently rendered one column at 1572 px. That is why the
  capability denylist gates the built bundle.
- **`GET /steps` still exists and is still the plan's own view of itself.** The
  panel reads it for what a video supports and for the build preview; it no
  longer reads it for where to navigate.

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

## 10. Any video, not only the corpus

**`benchmarks/footage.json` is the catalogue of the five test reels. It was
never a list of what the product may open**, and until Block 10 session 30 it
was one: every stage looked a reel up by label in that file alone, so the first
real client video picked through Browse was refused with `no reel labelled
"sora" in benchmarks/footage.json` — a sentence about a benchmark fixture, on
the screen of someone trying to caption a client's reel. Six call sites did it
(`pipeline.ts`, `dry-run.ts`, `steps.ts`, `transcript-view.ts`,
`keyword-view.ts`, `image-view.ts`), all through `listReels()`.

**The panel sends a label on every call**, and nothing on the service side
remembered what a browsed label meant. So a browsed video is written down:

- **`service/src/videos.ts`** holds the registry, `.local/videos.json`. Opening
  a video through `GET /video?path=` reads its duration, frame rate, dimensions
  and sha256 from the file itself and records them with a label. Nothing is
  copied and nothing is written beside the file.
- **`listReels()` is the corpus plus the registry**, deduplicated by path. The
  corpus catalogue keeps its own job — the fetch note, the sha256 and the byte
  count `npm run doctor` verifies are still only about those five reels.
- **`FRAMOPIA_VIDEO_REGISTRY`** re-points the registry, so a test's answer does
  not depend on which videos the machine happens to have opened.

**What a corpus reel takes from the catalogue, a browsed video takes from the
file.** Duration and frame rate from ffprobe; dimensions from ffprobe; the
sha256 by streaming the file once, at open time, so the dry run never has to
hash 4.5 GB again; the label from the file's own name.

**The label is the file's name without its extension.** A second file wanting
the same name gets its folder in front of it (`Work in Progress/sora`), and a
third a short hash of its full path. Two different files may never share a
label, because the label is what every later call sends. It is not editable: a
name the user can change is a second identifier to keep in step with the plan,
the cache and the build.

**A browsed video's plan does not sit beside it.** `editPlanPathFor` is the one
declaration and it branches on `classifyStoredPath`: a video inside the
repository keeps its plan beside it — that is the five corpus reels, and every
path in every report depends on it — while a video outside gets
`.local/plans/<name>-<hash of its path>.editplan.json`. Writing a JSON file
into a client's *Work in Progress* folder is this tool leaving something behind
in work that is not its own. Cache entries and cutouts were already keyed by
video hash under `.local/`, and the built `.aep` was already
`.local/build/<reel>-full.aep`.

**A video the tool cannot use is refused at the moment it is opened**, before
any money can move, each refusal naming which: not a video file, no duration,
no audio track, or not 2160 x 3840 — the one frame size every placement
constant, the subtitle band and the watermark inset are derived from
(PROJECT_SPEC §4).

### No message sends the user out of the panel

Session 26 made the panel start, prepare and restart the companion service
itself and pinned it with two assertions: no screen contains `npm run`, and none
contains *terminal*. **Both passed while the Build pane was telling a user to
quit After Effects**, because neither word appears in that sentence — the rule
had been written as two examples of itself.

`panel/src/leave-the-panel.test.ts` reads the source instead, the way
`path-fields.test.ts` pins that no path is typed, and fails on any instruction
to quit, restart, reopen or relaunch anything, or on any command to type.
**`host.ts` is the one exemption and it is a real one**: a panel loaded without
CEP's Node bridge has no service to repair and no bundle to rebuild, and After
Effects reads its extensions folder at launch, so naming the restart is the only
true sentence available.
