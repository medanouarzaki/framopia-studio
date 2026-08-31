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
