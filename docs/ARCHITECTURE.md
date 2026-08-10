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
├── reports/                      # block-N-session-M.md Claude Code reports
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
Nano Banana, paid tier, 2–4 candidates/slot (default 3; mode-overridable). Cutout gate: rembg/BiRefNet → metrics (alpha edge noise, hole ratio, foreground area sanity, edge halo) → below threshold ⇒ `presentation:"card"` fallback. Editor sees both and can override either way.

### 5.5 Zones and placement
Sample frames at ~2 fps → person masks → per-frame free rectangles top/left/right → temporal intersection with hysteresis → stable zones + validity windows. Placement solver (service-side, deterministic): assign image slots to zones honoring validity windows, no overlap with subtitle band, keywords, or other concurrent images; deliberate slight jitter in offsets within safe bounds so placement doesn't look machine-uniform. Manual fallback: panel zone editor writes `manual:true` rects that the solver treats as ground truth.

## 6. Caching & costs

- Cache root `.local/cache/<video-sha256>/`. Keys: stage + config-fingerprint (model, prompt version, orthography version, mode version). Any fingerprint change ⇒ miss; identical re-runs are free.
- Cached artifacts: extracted audio, raw ASR JSON, Gemini correction output, analysis output, every generated image + cutout + metrics, zone masks/results.
- Cost ledger: every billable call appends `{ts, stage, model, unit, usd}` to `.local/costs.jsonl`; per-video totals aggregate into the Edit Plan; panel shows running cost per reel. Soft alarm in the panel when a reel crosses $2.00.

## 7. Dev environment

- **CEP debug:** `defaults write com.adobe.CSXS.12 PlayerDebugMode 1` (adjust CSXS version to AE 2026's), extension symlinked into `~/Library/Application Support/Adobe/CEP/extensions/`, panel served from `panel/dist` with a dev-reload flow; remote debugging via the `.debug` file + Chrome DevTools on the declared port.
- **ExtendScript debugging:** VS Code + ExtendScript Debugger extension, launch config committed in the repo.
- **Node:** LTS via nvm; version pinned in `.nvmrc`. **Python:** 3.11+ venv at `tools/cv/.venv`, `requirements.txt` pinned.
- **Keys/config:** `.local/config.json` per machine (gitignored): API keys, port file location, machine label. A `config.example.json` is committed.
- Exact bootstrap commands live in CLAUDE.md and the Block 1 report; second-machine install doc is a Block 10 deliverable.

## 8. Error philosophy

Every stage fails loudly with a structured error surfaced verbatim in the panel (stage, cause, retry-ability). Automatic retries only for transient network/5xx (bounded, jittered). Nothing ever silently degrades transcription quality; a degraded path (e.g., Scribe down) is an explicit user choice in the panel, never a default.
