# FRAMOPIA STUDIO — Master Specification & Build Bible

> **Framopia Studio** turns a single-take talking-head video, spoken in Moroccan Darija code-switched with French and English, into a finished, on-brand vertical reel — captions, B-roll images, music, and motion — built automatically inside After Effects from hand-crafted templates, then handed back to a human for final tweaks and render.

**Document version:** 1.0
**Owner:** Mohamed Anouar Zaki
**Build partner:** Younes (Framopia)
**Status:** Approved for build
**Audience:** Every Claude Code session that touches this project, and any human reading in.

---

## 0. How to read and use this document

This is the single source of truth for the Framopia Studio project. It is deliberately exhaustive. Nothing here is optional context — it is the contract that every build session must obey.

There are three companion documents, produced from this one:

1. **`FRAMOPIA_STUDIO_MASTER_SPEC.md`** — this file. The *what* and the *why*. It rarely changes.
2. **`FRAMOPIA_STUDIO_TASKS.md`** — the *when and in what order*. The whole build sliced into small, verifiable tasks. Produced next.
3. **The per-session prompts** — the *do this now*. Each one is a self-contained brief pasted into Claude Code.

### The two-brain build model (read this carefully — it governs everything)

Framopia Studio is built by two different AIs, and **you are the courier between them**:

- **The Planner** is a Claude chat conversation living inside a Claude Project that contains this spec, `FRAMOPIA_STUDIO_TASKS.md`, and the repo files. The Planner never writes production code. Its only jobs are: read the current project state, pick the next task, and emit **one precise, self-contained prompt** for the Executor. When the Planner conversation grows long, it writes a handoff and a fresh Planner conversation continues from the repo's state files.
- **The Executor** is **Claude Code running in VS Code**. It receives one prompt, does the work **fully autonomously with no permission prompts**, runs its own checks, commits, pushes to GitHub, and prints a **completion report**.
- **The human (you)** pastes the Planner's prompt into the Executor, waits, then pastes the Executor's completion report back into the Planner. You also do the one thing no AI can: **look at the rendered video and judge whether it looks good.**

The reasons for this structure: it keeps each conversation short (cheaper, more coherent), it forces every task to be written down before it is done (so nothing is improvised), and it makes the true state of the project live in *files in the repo*, not in any one fragile conversation. If a laptop dies or a chat is lost, a new Planner reads the state files and continues without missing a beat.

### The four state files (the project's memory)

These live at the repo root and are the authoritative record. Every Executor session **must** update them as its final act, and every Planner session **must** read them first.

- **`CLAUDE.md`** — standing instructions for the Executor: coding standards, how to run tests, how to commit, the "never do" list, and a one-paragraph project summary. Read at the start of *every* Claude Code session automatically.
- **`PROGRESS.md`** — an append-only log. One dated entry per completed task: what was built, what was decided, what was learned, what the next session needs to know.
- **`TASKS.md`** — the master task list with checkboxes. The Executor ticks the task it finished and flags any newly-discovered work.
- **`DECISIONS.md`** — an append-only log of every non-trivial technical decision and its reason, so no future session re-litigates a settled choice.

**Rule:** the state files are the truth. A handoff prompt is a convenience. If a prompt and the state files ever disagree, the state files win, and the discrepancy is logged in `PROGRESS.md`.

---

## 1. Vision & product definition

Framopia shoots talking-head content for business clients. The bottleneck is *post*: captioning, finding or making B-roll, timing images to speech, laying music, and adding the small motion touches (punch-ins, transitions) that separate a professional reel from a clumsy one. Framopia Studio automates that post-production layer while keeping the two things humans are still better at — **the design of the templates** and **the final judgment call** — firmly in human hands.

Framopia Studio is an **internal tool for Mohamed and Younes only**. It is not a product for sale. This single fact simplifies a hundred downstream decisions: no multi-tenant accounts, no billing, no onboarding flows, no support burden, no need to defend against hostile users. Build for two trusted operators on two Macs. Optimize for output quality and for *their* speed, not for generality.

### What Framopia Studio is

A **decorator**, not an editor. It receives a video that is *already cut* — the speaker has already been trimmed, retakes removed, silences handled, by a human, before Framopia Studio ever sees it. Framopia Studio never cuts the speaker's footage. It **decorates** that finished cut with: word-by-word captions, AI-chosen or AI-generated B-roll images (or the client's own assets), background music and sound effects from a curated library, and motion — image swaps, zoom punch-ins, and transitions — all timed to land on the beat.

### What Framopia Studio is not

- Not a silence/filler/retake remover (Descript-style). The human does that first.
- Not a subtitle *translator*. Captions stay in the spoken language.
- Not a from-scratch animation generator. It never asks AI to invent motion design. It **fills** hand-built templates.
- Not a render farm. It builds the AE project and **stops** so a human reviews and renders.

### The quality bar

"Professional, not clumsy." Concretely: captions are perfectly synced word-by-word with tasteful emphasis on key words; images are relevant, on-brand, and appear/leave on musical beats; motion is subtle and purposeful; nothing looks template-default or auto-generated. The template library is where this bar is won or lost — which is why humans build it.

---

## 2. Glossary

- **Reel** — the output: a vertical 9:16 video, typically ~30 seconds, one speaker.
- **Take** — the raw, already-cut speaker footage that is the input.
- **Brand Kit** — a client's complete visual identity as consumed by Framopia Studio: logo, color palette, fonts, caption style, template set, and image-style config. v1 ships with exactly one.
- **Template** — a hand-authored After Effects composition with named placeholder layers that Framopia Studio fills (a caption style, an image-reveal, a lower-third, a transition, etc.).
- **Placeholder** — a named layer or control inside a template that the build script targets to inject text, an image, or a color.
- **Template Contract** — the naming convention and rules that couple the hand-built templates to the build script. The one interface both humans and code must honor.
- **Edit Plan** — the central JSON artifact. The complete, machine-readable description of the finished reel: every caption word with its timing and script, every image with its source and on-screen window, every music and SFX cue, every motion beat. The backend produces it; the AE script consumes it.
- **Segment** — a semantic chunk of the transcript (roughly a sentence or clause) that the understanding stage reasons about when deciding visuals.
- **Beat grid** — the list of musical beat timestamps extracted from the chosen track; visual events snap to it.
- **Planner / Executor** — the two build-time AIs (see §0).
- **Nano Banana 2 / Pro** — Google's Gemini image models (`gemini-3.1-flash-image` / `gemini-3-pro-image`) used for image generation.
- **CEP / ExtendScript** — the (2026-current) Adobe extension technology for an AE panel and its host-automation scripting.

---

## 3. Scope

### 3.1 In scope for v1

- Vertical 9:16 output only.
- Single-speaker talking-head takes, ~30s (design for up to ~90s without breaking).
- One Brand Kit, fully working end-to-end.
- Word-by-word "karaoke" captions with mixed Arabic/Latin script and automatic emphasis on key words.
- Captions authored as an AE template by the humans; Framopia Studio fills and times them.
- B-roll: a mix of AI-generated images (Gemini), the client's supplied assets, with client assets winning when relevant; animated-text fallback when no good image exists.
- Background music + SFX chosen from a **local folder** the user stocks once, picked by mood, synced to beats.
- Motion: image swaps, zoom punch-ins on the speaker, and transitions, all snapped to the beat grid.
- A transcript-correction step (text) before the AE build.
- A one-line **brief** box per video to steer visual choices.
- The tool builds the AE project and stops for human review/render inside AE.
- A CEP panel inside After Effects 2026 (macOS) as the operator UI, backed by a local Python service.
- Continuous push to a private GitHub repo; both operators can pull and push.

### 3.2 Explicitly out of scope for v1 (candidates for later)

- Horizontal/square formats.
- Multiple speakers, interviews, screen recordings.
- More than one Brand Kit (the system is *designed* for many; only one is *built and tuned* in v1).
- Caption translation / multi-language subtitles.
- Cutting/trimming the speaker footage.
- Auto-render to final MP4 (the human renders).
- Royalty-free music/SFX API integration (local folder only in v1).
- Cloud deployment, remote access, mobile.
- Any user other than Mohamed and Younes.

### 3.3 Non-goals (never)

- Never sell or expose Framopia Studio to third parties without a security review this spec does not cover.
- Never let AI generate motion design from scratch.
- Never auto-render and publish without human review.

---

## 4. End-to-end user experience (the happy path)

This is the concrete walkthrough of *using* Framopia Studio once built. Every stage below maps to a pipeline stage in §7.

1. **Open AE, open the Framopia Studio panel.** The panel shows: a file picker, a Brand Kit dropdown, a one-line brief field, and a "Process" button. A status light shows the backend is running.
2. **Pick the take**, choose the Brand Kit, type a brief ("new cold-brew launch, cozy autumn mood, mention 300 dirham promo"), click **Process**.
3. The panel hands the job to the local backend. A progress readout appears: *Extracting audio → Transcribing → (waiting for your review) → Aligning → Planning visuals → Generating images → Choosing music → Building Edit Plan → Building After Effects comp.*
4. **Transcript review.** The panel shows the transcript in an editable box, one line per segment, with confidence hints. The user fixes any wrong words (Darija ASR will make some), and clicks **Continue**. This is the only manual step during *use*, and it should take under a minute.
5. Framopia Studio finishes the plan, generates/collects images, picks a track, and drives After Effects to build the comp: speaker on a base layer, caption layers timed word-by-word, image layers dropped onto the beat grid with reveal templates, transitions, and an audio layer with the music.
6. **AE opens the finished comp and stops.** The user scrubs the timeline, nudges anything they dislike (captions are editable, images swappable, timings draggable), then renders through AE's normal queue.
7. Done. A polished reel, in a handful of minutes of mostly-waiting.

The design intent: the user's active attention is needed for ~90 seconds total (brief + transcript fix + final tweak), and everything else is the machine working.

---

## 5. System architecture

Framopia Studio is four cooperating parts. Keep them decoupled; each is independently testable.

```
┌──────────────────────────────────────────────────────────────────┐
│  AFTER EFFECTS 2026 (macOS)                                        │
│                                                                    │
│   ┌────────────────────┐         ┌──────────────────────────┐    │
│   │  CEP PANEL (UI)     │ evalJSX │  EXTENDSCRIPT (.jsx)      │    │
│   │  HTML/CSS/JS        │────────▶│  AE host automation:     │    │
│   │  file picker, brief │         │  reads Edit Plan JSON,   │    │
│   │  brand dropdown,    │         │  imports assets, fills   │    │
│   │  transcript editor, │         │  & times templates,      │    │
│   │  progress readout   │         │  assembles master comp   │    │
│   └─────────┬──────────┘         └──────────────────────────┘    │
│             │ HTTP (localhost)                                     │
└─────────────┼──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  FRAMOPIA STUDIO BACKEND  (local Python service, FastAPI on 127.0.0.1)      │
│                                                                    │
│   ingest → audio extract → ASR → (pause for correction) →         │
│   forced alignment → understanding/segmentation →                 │
│   visual planning → image gen/sourcing → music+SFX selection →    │
│   beat detection → EDIT PLAN (JSON) + assets on disk              │
│                                                                    │
│   Calls out to: Gemini (ASR + image gen), forced aligner (local), │
│   ffmpeg (local), beat detector (local)                           │
└──────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  PROJECT WORKSPACE (per job, on disk)                             │
│   /jobs/<job_id>/  input.mp4, audio.wav, transcript.json,         │
│   edit_plan.json, /assets/images/*, /assets/audio/*, log.txt      │
│                                                                    │
│  BRAND KITS   /brand_kits/<kit>/  config, fonts, logo, templates  │
│  MUSIC LIBRARY /music/  tracks + sfx with mood metadata           │
└──────────────────────────────────────────────────────────────────┘
```

**Why this split.** The AI/heavy lifting lives in Python, where the audio, ML, and API ecosystems are strongest. After Effects is treated as a *rendering target driven by data* — the ExtendScript layer is intentionally "dumb": it reads a fully-decided Edit Plan and executes it, containing no AI logic and no creative decisions. The CEP panel is a thin operator console. The Edit Plan JSON is the firm contract between the smart backend and the dumb AE script; either side can be developed and tested against a fixed example plan without the other.

**Communication.** The CEP panel talks to the backend over HTTP on `127.0.0.1:<port>` (CEP ships an embedded Node runtime and can `fetch`). When the plan and assets are ready, the panel triggers the ExtendScript via `CSInterface.evalScript()`, passing the path to `edit_plan.json`. ExtendScript reads the JSON from disk (with a bundled `json2.js` polyfill, since ExtendScript is ES3 and has no native `JSON`).

---

## 6. Technology stack & exact choices (with 2026 rationale)

Every choice below is deliberate and current as of July 2026. Do not substitute without logging a decision in `DECISIONS.md`.

### 6.1 Backend

- **Language:** Python 3.12+.
- **Web framework:** FastAPI (async, typed, trivial local server) + Uvicorn.
- **Media:** ffmpeg (audio extraction, format normalization) via `ffmpeg-python` or direct subprocess.
- **HTTP to APIs:** `httpx` (async).
- **Data validation:** Pydantic v2 — the Edit Plan schema is defined as Pydantic models so it is validated on the way out.
- **Config:** `pydantic-settings` reading a git-ignored `.env`.

### 6.2 Transcription (ASR) — the risk area

Moroccan Darija is severely under-resourced and the input is code-switched (Darija + French + English + technical terms), which is the single hardest case for any ASR. The design therefore separates **text accuracy** from **word timing** and adds a **human gate**:

- **Primary ASR:** **Gemini** multimodal (current Gemini flagship audio-capable model) transcribing the audio to text. It handles code-switching better than MSA-tuned engines and can output native Arabic script. It is prompted (see §11) to preserve French/English words in Latin script and Darija/Arabic words in Arabic script, matching the caption rule.
- **Fallback / cross-check ASR:** a second engine (ElevenLabs Scribe or a Whisper-large-v3 pass) is *optional* and used only if we later want confidence scoring by agreement. Not required for v1; note as a future hook.
- **Note for later:** dedicated fine-tuned Darija models exist (e.g. Qwen3-ASR fine-tunes like MoulSot, and DVoice datasets). Not integrated in v1, but flagged as the upgrade path if Gemini accuracy disappoints.
- **Human correction gate:** mandatory. The transcript is shown for editing before anything downstream runs. This converts "ASR is imperfect" from a quality problem into a 60-second chore.
- **Word-level timing (forced alignment):** After the transcript is corrected, run a **forced aligner** to snap each corrected word to precise audio timestamps. This is what makes karaoke captions tight. Use a local aligner that supports Arabic (e.g. an MFA Arabic model, `aeneas`, or a WhisperX alignment pass seeded with the corrected text). The aligner takes the *human-corrected* words as ground truth and only computes timings — so alignment quality does not depend on ASR having gotten the words right. This is the key architectural insight: **accuracy comes from Gemini+human; timing comes from the aligner.**

### 6.3 Understanding / creative decisions

- **LLM:** Gemini (reasoning-capable current model) for segmentation, emphasis-word selection, and visual planning. One model family (Gemini) for ASR + understanding + images keeps auth and billing simple and lets us pass audio, transcript, and brief together.

### 6.4 Image generation & sourcing

- **Default generator:** **Nano Banana 2** — `gemini-3.1-flash-image`. 4K capable, strong text rendering, good brand/character consistency, ~4¢/image, ~12s. This is the workhorse for B-roll.
- **Hero/brand-critical images:** **Nano Banana Pro** — `gemini-3-pro-image`. Higher fidelity, better brand consistency and localization, ~2× cost. Used sparingly (e.g., a product beauty shot).
- **Note:** all Gemini image output carries a SynthID watermark; acceptable for internal social content. Log it as a known property.
- **Client assets:** supplied at job start, stored per job; **always preferred** over generation when relevant to the current segment (product/logo/screenshot).
- **No manual stock downloading.** Stock APIs are out of scope for v1.

### 6.5 Music & SFX

- **Source:** a local, user-curated folder of licensed tracks and SFX. No API.
- **Mood metadata:** each track tagged (mood, energy, tempo/BPM, has-vocals) in a `music/library.json`. The backend picks by matching brief mood + energy.
- **Beat detection:** local audio analysis (e.g. `librosa` beat tracking) produces the beat grid for the chosen track. Visual events snap to it.

### 6.6 After Effects integration

- **Extension tech:** **CEP panel + ExtendScript**. UXP is *not* publicly available for After Effects in 2026 (Photoshop/InDesign only), so CEP is the correct, non-deprecated choice for an AE 2026 panel. CEP provides an embedded Chromium webview + Node runtime for the UI, and `evalScript` to run ExtendScript in AE's host engine.
- **AE version:** After Effects 2026, macOS (both operators on Mac).
- **JSON in ExtendScript:** bundle `json2.js` (ES3 JSON polyfill).
- **Template mechanism:** direct layer manipulation by naming convention (the Template Contract, §9), not `.mogrt`/Essential Graphics export (which targets Premiere). Templates are `.aep` compositions the humans author.

### 6.7 Build tooling

- **Executor:** Claude Code in VS Code, configured for autonomous operation (§17.5).
- **VCS:** Git + private GitHub repo. One commit per completed task; push every task.
- **Tests:** pytest (backend). AE/ExtendScript verified against a golden Edit Plan by a smoke script + human visual check.
- **Env management:** a documented setup script installs Python deps, ffmpeg, the aligner, and configures the CEP panel; because the operators may not have Node/Python/ffmpeg installed, setup is scripted and idempotent (§ Appendix D).

### 6.8 Cost posture

Per 30s reel, rough order of magnitude: 1 ASR call + 1 understanding call + ~4–8 image generations. With Nano Banana 2 at ~4¢/image and cheap text calls, a reel costs cents. A per-job cost ceiling and a "cheap mode" (fewer images, Flash-only) are enforced by the backend (§16.4). This is a rounding error for an agency, but the guardrail prevents a runaway loop from surprising anyone.

---

## 7. The pipeline — stage by stage

Each stage is a pure, independently-testable step: it takes files/objects in and produces files/objects out, written to the job workspace, so any stage can be re-run in isolation and any stage's output can be inspected. Stages never skip the workspace; intermediate artifacts are always written to disk (this is what makes debugging and re-running painless).

### Stage 1 — Ingest
Input: `input.mp4` (the already-cut take) + Brand Kit id + brief string + optional client asset files.
Actions: create `/jobs/<job_id>/`, copy input, copy client assets into `/jobs/<job_id>/assets/client/`, record job metadata (`job.json`: id, timestamps, brand kit, brief, source properties — duration, fps, resolution).
Output: initialized job workspace.
Validation: reject non-9:16 or wildly wrong durations with a clear message; warn (don't reject) on unusual fps.

### Stage 2 — Audio extraction
Input: `input.mp4`.
Actions: ffmpeg extracts mono 16 kHz WAV (`audio.wav`) — the normalized form all ASR/alignment/beat steps expect.
Output: `audio.wav`.

### Stage 3 — Transcription (ASR)
Input: `audio.wav` + brief (brief gives the model domain context — brand names, product terms — improving proper-noun accuracy).
Actions: call Gemini audio transcription with the §11 script-and-code-switch prompt. Return segments with rough timings and per-segment confidence if available.
Output: `transcript_raw.json` — array of segments `{index, text, start, end, confidence}`.
Notes: timings here are approximate; they are only used to lay out the review UI. Final timing comes from Stage 5.

### Stage 4 — Transcript correction gate (human)
Input: `transcript_raw.json`.
Actions: the panel renders the segments editably; low-confidence words hinted. User edits, confirms.
Output: `transcript_corrected.json` — same shape, human-approved text. **The pipeline blocks here until the user continues.**
Design rule: make this fast — segment-per-line, keyboard-friendly, no fussy UI. This gate is the quality keystone; never remove it, never auto-skip it.

### Stage 5 — Forced alignment (word timing)
Input: `audio.wav` + `transcript_corrected.json`.
Actions: run the forced aligner using the corrected text as ground truth; produce per-word start/end timestamps. Handle mixed-script text (align on the phonetic/word level; keep the original surface form and its script tag for each word).
Output: `words.json` — flat list `{word, script: "arabic"|"latin", start, end, segment_index}`.
Why separate from ASR: alignment quality is independent of whether ASR guessed words right, because it aligns the *corrected* words. This is how we get tight karaoke timing despite hard ASR.

### Stage 6 — Understanding & segmentation
Input: `transcript_corrected.json` + `words.json` + brief.
Actions: Gemini reasons over the full transcript to produce: (a) a one-paragraph summary of the reel's message; (b) semantic segments (clause/sentence level) with a short "visual intent" per segment — what the viewer should *see* there (a concept to illustrate, a product to show, a data point to emphasize, or "nothing, speaker only"); (c) the **emphasis words** per caption line (nouns, numbers, brand names, punchy verbs) flagged for bold/stylized treatment.
Output: `understanding.json` — `{summary, segments:[{index, text, start, end, visual_intent, emphasis_word_indices}], ...}`.

### Stage 7 — Visual planning
Input: `understanding.json` + Brand Kit image-style config + client asset manifest + beat grid (from Stage 9; see ordering note).
Actions: decide the concrete visual track: for each moment that warrants a visual, decide **client-asset vs generate**, choose the image-reveal template, and choose the on-screen window (start/end) snapped to the nearest beats. Enforce density sanity (roughly a new visual every ~5s or on key moments — never strobing). Decide speaker punch-ins and transitions, also snapped to beats. Where no good visual exists, mark the moment for the **animated-text fallback** template.
Output: a draft visual track that feeds the Edit Plan.
Ordering note: beat detection (Stage 9) is computed before final visual placement; the pipeline runs music selection + beat detection *before* finalizing visual windows so everything can snap to the grid. Implement Stages 7–9 as a small sub-pipeline that resolves in the order: pick music → detect beats → place visuals on beats.

### Stage 8 — Asset generation & sourcing
Input: the visual track's image requirements + Brand Kit style + client assets.
Actions: for each "generate" requirement, construct a prompt (§12) embedding the Brand Kit style and the segment's visual intent, call Nano Banana 2 (or Pro for hero shots), save to `/jobs/<job_id>/assets/images/`. For each "client asset" requirement, select and (if needed) reframe the client file to 9:16-safe dimensions. Cache by prompt hash to avoid regenerating identical images.
Output: image files on disk + an asset manifest mapping each visual to its file.
Cost control: obey the per-job image ceiling and cheap-mode toggle.

### Stage 9 — Music & SFX selection + beat detection
Input: brief mood/energy + `music/library.json` + reel duration.
Actions: pick the best-matching track (mood + energy + adequate length); run beat detection to produce the beat grid; optionally place a small number of SFX (whooshes on transitions, pops on emphasis) from the SFX set.
Output: chosen track reference + `beats.json` (array of beat timestamps) + SFX cue list.

### Stage 10 — Edit Plan assembly
Input: all of the above.
Actions: assemble and **validate** the complete `edit_plan.json` against the Pydantic schema (§8). Every timing is absolute (seconds from reel start). Every asset is referenced by relative path. Nothing is left for the AE script to decide.
Output: `edit_plan.json` — the contract handed to After Effects.
Validation: fail loudly if any referenced asset is missing, any window is out of range, or any template name is unknown to the Brand Kit's template set.

### Stage 11 — After Effects build
Input: `edit_plan.json` (+ Brand Kit templates on disk).
Actions: the panel triggers ExtendScript, which reads the plan, imports the take and all assets, builds the master 9:16 comp, drops in the base speaker layer, instantiates and times caption/image/transition templates per the plan, adds the audio layer, and leaves the comp open.
Output: a built AE project/comp, **not rendered**.

### Stage 12 — Human review & render
The user tweaks in the AE timeline and renders through AE's queue. Outside Framopia Studio's automation, by design.

---

## 8. The Edit Plan schema (the heart of the system)

The Edit Plan is the firm contract between the smart backend and the dumb AE script. Define it as Pydantic models; serialize to `edit_plan.json`. All times are **seconds, float, absolute from reel start**. All asset paths are **relative to the job folder**. All template names must exist in the Brand Kit's template registry.

Top-level shape:

```jsonc
{
  "schema_version": "1.0",
  "job_id": "2026xxxx-xxxx",
  "brand_kit": "framopia-clientA",
  "reel": {
    "width": 1080, "height": 1920, "fps": 30,
    "duration": 31.4
  },
  "source": {
    "video": "input.mp4",
    "audio": "audio.wav"
  },
  "captions": [
    {
      "segment_index": 0,
      "template": "caption_karaoke_default",
      "words": [
        { "text": "Salam", "script": "latin",  "start": 0.30, "end": 0.62, "emphasis": false },
        { "text": "بزاف",  "script": "arabic", "start": 0.62, "end": 0.95, "emphasis": true  }
      ]
    }
  ],
  "visuals": [
    {
      "id": "v1",
      "kind": "generated_image",          // or "client_asset" or "animated_text"
      "asset": "assets/images/v1.png",     // omitted for animated_text
      "text": null,                        // used only for animated_text fallback
      "template": "image_reveal_slideup",
      "start": 4.00,                       // snapped to a beat
      "end": 8.50,                         // snapped to a beat
      "beat_aligned": true
    }
  ],
  "motion": [
    { "kind": "punch_in", "target": "speaker", "at": 12.00, "amount": 1.08, "template": "punch_soft" },
    { "kind": "transition", "template": "whip_pan", "at": 8.50 }
  ],
  "audio": {
    "music": { "asset": "assets/audio/track_cozy_01.wav", "gain_db": -14.0, "start": 0.0 },
    "sfx": [ { "asset": "assets/audio/whoosh.wav", "at": 8.50, "gain_db": -10.0 } ]
  },
  "beats": [0.50, 1.02, 1.55, 2.07],
  "meta": {
    "summary": "…one-paragraph message…",
    "brief": "…user's brief…",
    "generated_at": "2026-…",
    "cost_estimate_usd": 0.31
  }
}
```

Rules enforced at assembly time:
- No two caption words overlap in time within a segment.
- Every `visuals[].start/end` lies within `[0, reel.duration]` and (when `beat_aligned`) matches a value in `beats` within a small epsilon.
- Every referenced `asset` file exists on disk.
- Every `template` string exists in the Brand Kit template registry (§10).
- `captions[].words[].script` is exactly `"arabic"` or `"latin"`.

The AE script must treat the plan as authoritative and never invent, reorder, or drop items. If it cannot honor an item (e.g. a template is missing in AE), it records the failure in a build report and continues with the rest, rather than aborting the whole build.

---

## 9. After Effects integration & the Template Contract

This is the most delicate coupling in the system, because it spans hand craft (humans in AE) and code (the build script). Get the contract right and both sides can evolve independently.

### 9.1 The two responsibilities

- **Humans (Mohamed + Younes)** author every template composition in After Effects by hand — the actual motion design, easing, look. This is where "professional, not clumsy" comes from. Each template is a comp with **named placeholder layers** following the naming convention below.
- **The build script (ExtendScript)** never designs anything. It imports the template comps, duplicates them, fills their placeholders with plan data, times them on the master timeline, and wires audio. It relies entirely on the naming convention to find placeholders.

### 9.2 Template categories (v1)

- **Caption template** (`caption_*`): renders a line of word-by-word karaoke captions. Exposes a text placeholder and a defined animation for word-pop + current-word highlight + emphasis styling. Because captions are highly dynamic (per-word timing), the caption template's exact fill mechanism is defined in §11.4.
- **Image-reveal templates** (`image_reveal_*`): a container that reveals an image with motion (slide-up, scale-in, mask-wipe…). Exposes one image placeholder layer and honors an in/out window.
- **Transition templates** (`transition_*`): whip pan, dip-to-color, glitch, etc. Self-contained; placed at a point in time.
- **Motion/punch templates** (`punch_*`): a scale/position emphasis applied to the speaker layer.
- **Animated-text fallback** (`animtext_*`): a full-frame branded text card used when no image fits; exposes a text placeholder.

### 9.3 The naming convention (the contract)

Every placeholder inside a template comp is a layer whose name begins with a sigil so the script can find it unambiguously:

- `#IMG` — an image placeholder (a solid/footage layer whose source the script replaces).
- `#TXT_MAIN` — the primary text placeholder (the script sets its Source Text).
- `#TXT_WORD` — (caption templates) the per-word text driver (see §11.4).
- `#COLOR_ACCENT`, `#COLOR_BG` — color-driven layers/controls the script tints from the Brand Kit palette.
- `#LOGO` — a placeholder whose source the script replaces with the Brand Kit logo.
- `#SAFE` — a non-rendering guide layer marking the caption safe-area; ignored by the script, used by designers.

Template comps themselves are named exactly as referenced in the Edit Plan (`caption_karaoke_default`, `image_reveal_slideup`, …). The **Template Registry** (`brand_kits/<kit>/templates/registry.json`) lists every template name, its category, its placeholder inventory, and any parameters — this is the machine-readable half of the contract, and the backend validates plan template names against it.

### 9.4 How the script builds the comp (algorithm)

1. Load `json2.js`; parse `edit_plan.json`.
2. Create (or clear) the master comp at `reel.width × height @ fps`, length `duration`.
3. Import `input.mp4`; add as the bottom **speaker** layer, full-frame.
4. Import all image and audio assets referenced by the plan.
5. For each `visuals[]` item: pull the matching image-reveal template comp, duplicate it, set its `#IMG` placeholder source to the asset (or set `#TXT_MAIN` for `animated_text`), trim the template layer to `[start, end]`, and place it above the speaker.
6. For each `captions[]` segment: instantiate the caption template and drive its words from the plan's word timings (§11.4).
7. For each `motion[]` item: apply the punch/transition template at its time.
8. Add the music as an audio layer at `audio.music.gain_db`; add SFX at their cue times.
9. Apply Brand Kit palette to any `#COLOR_*` and place the `#LOGO`.
10. Write a **build report** (`build_report.json`: what was placed, what failed) and leave the comp open. Do **not** render.

### 9.5 CEP panel responsibilities

- Render the operator UI (picker, brand dropdown, brief, progress, transcript editor).
- Talk to the backend over `127.0.0.1`.
- On plan-ready, call the ExtendScript entry point with the plan path via `evalScript`.
- Surface the build report to the user (e.g. "6 visuals placed, 1 template missing").
- Show backend health; offer a "restart backend" affordance.

Keep **all** logic that could live in the backend, in the backend. The panel is a console, not a brain. The ExtendScript is an assembler, not a brain.

---

## 10. The Brand Kit system

A Brand Kit is a self-contained folder describing one client's identity as Framopia Studio consumes it. The system is built to hold many; v1 tunes exactly one.

```
brand_kits/<kit_slug>/
  config.json          # palette, fonts, caption style, image-style config, defaults
  logo.png             # transparent logo for #LOGO placeholders
  fonts/               # the kit's fonts (must render Arabic + Latin)
  templates/
    registry.json      # machine-readable template inventory (the contract, §9.3)
    templates.aep      # the AE project holding all template comps (hand-authored)
  samples/             # optional reference reels for style
```

`config.json` (illustrative):

```jsonc
{
  "slug": "framopia-clientA",
  "display_name": "Client A",
  "palette": { "bg": "#0E0E10", "accent": "#F4B740", "text": "#FFFFFF", "muted": "#9A9A9A" },
  "fonts": {
    "caption": "TajawalOrDualScriptFont-Bold",   // MUST support Arabic + Latin
    "caption_emphasis": "…-Black"
  },
  "caption_style": {
    "position": "lower_third",        // where captions sit in the 9:16 frame
    "safe_margin_pct": 8,
    "word_pop": true,
    "current_word_highlight_color": "#F4B740",
    "emphasis_scale": 1.15
  },
  "image_style": {
    "default": "warm cinematic photography, shallow depth of field, soft autumn light",
    "negative": "no text, no watermark, no logos",
    "per_video_override_allowed": true
  },
  "music_defaults": { "gain_db": -14 }
}
```

**Font requirement (critical):** the caption font must cleanly render mixed Arabic + Latin in one text run. Pick a dual-script font (e.g. a Tajawal/IBM Plex Arabic-class family with matching Latin). The spec does not hard-pick the font — the designers choose it when authoring the caption template — but the requirement is non-negotiable and the template must be tested with a mixed-script line.

**Image style ↔ Brand Kit:** generated-image style is a **per-kit default** (so a client's reels stay visually consistent), with a **per-video override** available through the brief. This was the chosen resolution of "AI decides per video": consistency by default, freedom on demand.

---

## 11. Caption system

Captions are the highest-frequency, highest-visibility element. They must be perfectly timed, correctly scripted per word, and tastefully emphasized. **Note:** the caption *design/animation* itself is authored by the humans as a template; Framopia Studio's job is to fill and time it.

### 11.1 Behavior
Standard modern social style: words appear/pop one at a time in sync with speech; the current word is highlighted; emphasized words render larger/bolder. Lines correspond to segments; a line shows its words progressively and clears when the next line begins.

### 11.2 Mixed-script rule (locked)
- French / English / technical words → **Latin script** (e.g. *marketing, design, WhatsApp, promo*).
- Darija / Arabic words → **Arabic script** (e.g. سلام، بزاف).
Each word in `words.json`/the Edit Plan carries an explicit `script` tag decided at transcription time (Gemini is prompted to produce exactly this mixed output) and confirmed at the human correction gate. The caption template must handle both scripts in one line, including correct **RTL/LTR** shaping — Arabic words shape right-to-left, Latin words left-to-right, within the same line (bidi). This is a real implementation concern; test it explicitly with a line like `"Salam بزاف ديال promo"`.

### 11.3 Emphasis selection (locked)
The AI auto-selects emphasis words during understanding (Stage 6): nouns, numbers, brand/product names, and punchy verbs. Emphasis is a boolean per word in the plan. The human can override in AE afterward (captions are editable there), so the rule can be generous without being risky.

### 11.4 How the caption template is filled (mechanism)
Because per-word timing is dynamic, the caption template is designed so the script can drive it from data. Two acceptable mechanisms — the designers and the first caption-building task choose one and record it in `DECISIONS.md`:
- **(A) One text layer per word.** The script creates, from the plan, one short-lived text layer per word inside a caption container, each timed to its `[start, end]`, with the highlight/emphasis states baked by expressions reading a per-layer marker. Simple, robust, verbose.
- **(B) Single driven text layer.** One text layer whose Source Text is an expression that, given the current time and an embedded array of `{word, start, end, script, emphasis}`, renders the progressive line with styling. Elegant, but bidi + per-word styling in one expression-driven text layer is fiddly.
Recommendation: start with **(A)** for reliability; revisit (B) only if (A)'s layer count becomes unwieldy. Whichever is chosen, the *look* (font, pop animation, highlight, emphasis scale) comes from the hand-authored template and Brand Kit, not from code.

### 11.5 Positioning
Captions sit in the Brand Kit's configured position (default lower third) inside a safe margin so platform UI never covers them. The `#SAFE` guide layer in templates marks this for designers.

---

## 12. Image system

### 12.1 Decision order per visual moment
1. Is there a relevant **client asset** for what's being said (product, logo, screenshot)? → use it (reframe to 9:16-safe).
2. Else, is the moment worth a visual at all (key concept/point)? → **generate** an image.
3. Else → **animated-text fallback** template (branded text card), or simply keep the speaker full-frame.

### 12.2 Generation prompt construction
A generated-image prompt is assembled from: the Brand Kit `image_style.default` (+ any per-video override from the brief) + the segment's `visual_intent` + the kit `image_style.negative` + hard constraints (`vertical 9:16 composition, no on-image text, no watermark, subject centered with headroom for caption safe-area`). Keep on-image text out (captions live in AE, not baked into images). Use Nano Banana 2 by default; escalate to Nano Banana Pro only for flagged hero shots.

### 12.3 Consistency
Because style is a per-kit default and prompts embed it, a client's images stay coherent across reels. For within-reel character/product consistency, pass client asset(s) as reference images to the generator where supported.

### 12.4 Caching & cost
Hash each final prompt; cache results per job (and optionally per kit) to avoid paying twice for identical images. Respect the per-job image ceiling and cheap-mode.

---

## 13. Music & SFX system

### 13.1 Library
`music/` holds licensed tracks and SFX the user stocks once. `music/library.json` tags each: `{file, type:"music"|"sfx", mood:[...], energy:1-5, bpm, has_vocals, duration}`. No per-video downloading; no external API in v1.

### 13.2 Selection
Match the brief's mood/energy to tagged tracks; prefer instrumental (no vocals) so captions/speech stay clear; ensure the track is at least as long as the reel (loop/trim as needed). Set gain from the Brand Kit default (~-14 dB) so it sits under speech.

### 13.3 Beat sync
Run beat detection on the chosen track → `beats.json`. All visual swaps, image reveals, transitions, and speaker punch-ins snap to the nearest beat. This is the single biggest contributor to a reel feeling "edited" rather than "decorated." SFX (whoosh on transition, pop on emphasis) are optional and also beat/emphasis aligned, kept subtle.

---

## 14. Backend service design

A local FastAPI service on `127.0.0.1`. It exposes a small, explicit API the panel drives, and runs the pipeline as a background job with progress reporting.

### 14.1 Endpoints (v1)
- `GET  /health` → `{status, version, ffmpeg_ok, keys_ok}`.
- `GET  /brand_kits` → list of available kits.
- `POST /jobs` → start a job. Body: `{video_path, brand_kit, brief, client_asset_paths[]}`. Returns `{job_id}`. Runs Stages 1–3, then pauses at the correction gate.
- `GET  /jobs/{id}/status` → `{stage, progress_pct, state:"running"|"awaiting_correction"|"ready_for_ae"|"error", message}`.
- `GET  /jobs/{id}/transcript` → the raw transcript for the correction UI.
- `POST /jobs/{id}/transcript` → submit corrected transcript; resumes Stages 5–10.
- `GET  /jobs/{id}/edit_plan` → the final plan (also on disk).
- `GET  /jobs/{id}/build_report` → after AE build (panel posts it back, optional).
- `POST /jobs/{id}/cancel`.

### 14.2 Pipeline execution
- Jobs run as async background tasks; the panel polls `/status`.
- Every stage writes its artifact to the job folder before advancing (resumability + debuggability).
- The correction gate is a real pause: the job sits in `awaiting_correction` until the corrected transcript is posted.

### 14.3 Backend project layout
```
backend/
  app/
    main.py            # FastAPI app + routes
    config.py          # pydantic-settings, reads .env
    pipeline/
      ingest.py  audio.py  asr.py  align.py
      understand.py  plan_visuals.py  images.py  music.py
      assemble_plan.py
    models/            # Pydantic: EditPlan, Transcript, Understanding, etc.
    clients/           # gemini.py (asr+understand+images), aligner.py, ffmpeg.py, beats.py
    jobs/              # job manager, status, workspace paths
    util/              # logging, hashing, cost meter
  tests/
  pyproject.toml
```

### 14.4 Determinism & re-runs
Given the same inputs + corrected transcript, a re-run should reproduce the plan (modulo generative image variety). Seed generation where possible; cache by prompt hash. Store the exact model ids used per job in `job.json` for reproducibility.

---

## 15. Repository & workspace structure

```
framopia-studio/                         # git repo root
  README.md
  CLAUDE.md                    # standing Executor instructions (state file)
  PROGRESS.md                  # append-only build log (state file)
  TASKS.md                     # master task list (state file)
  DECISIONS.md                 # append-only decisions log (state file)
  .env.example                 # documents required keys; real .env is git-ignored
  .gitignore                   # ignores .env, /jobs, large media, caches
  setup/                       # scripted, idempotent environment setup (Appendix D)
  backend/                     # the Python service (§14)
  ae_panel/                    # CEP panel + ExtendScript
    CSXS/manifest.xml
    client/                    # HTML/CSS/JS UI
    host/                      # ExtendScript .jsx + json2.js
    lib/CSInterface.js
  brand_kits/
    framopia-clientA/          # the one v1 kit (§10)
  music/                       # library.json + tracks/sfx (large files git-ignored; library.json committed)
  jobs/                        # per-job workspaces (git-ignored)
  docs/
    FRAMOPIA_STUDIO_MASTER_SPEC.md       # this file
    edit_plan.example.json     # a golden plan for testing the AE side in isolation
```

**Git-ignored:** `.env`, `/jobs`, actual media in `/music` and `brand_kits/*/samples`, Python/npm caches, any API output. **Committed:** all code, `library.json`, brand kit `config.json`/`registry.json`, `.env.example`, the golden example plan, and all docs.

---

## 16. Configuration, secrets & cost control

### 16.1 Secrets
- All API keys in a git-ignored `.env`, documented in `.env.example`. Younes maintains his own local `.env`; keys are never committed, never printed in logs, never placed in the repo. The Executor is explicitly forbidden (in `CLAUDE.md`) from writing real keys anywhere tracked.

### 16.2 Config precedence
`.env` (secrets) → Brand Kit `config.json` (per-client) → per-video brief override (per-run). Later layers override earlier for the fields they touch.

### 16.3 Required keys (v1)
- `GEMINI_API_KEY` — ASR, understanding, image generation.
- (Optional/future) `ELEVENLABS_API_KEY` — fallback ASR.

### 16.4 Cost controls
- `MAX_IMAGES_PER_JOB` (default e.g. 8) — hard ceiling.
- `CHEAP_MODE` — Flash-only images, fewer visuals, no Pro escalation.
- Per-job **cost meter** accumulates estimated spend and is written to `edit_plan.json.meta.cost_estimate_usd`; a job exceeding a configurable ceiling pauses and asks for confirmation via the panel.

---

## 17. Build methodology — the Claude Code session chain

This section is the operating manual for actually building Framopia Studio with the two-brain model (§0). Follow it exactly; it is the antidote to the "errors in the middle" problem.

### 17.1 Roles recap
- **Planner** (Claude chat, in the Claude Project) — reads state, emits one Executor prompt, ingests the report, updates nothing itself in code but instructs the Executor to update state files.
- **Executor** (Claude Code, VS Code) — does exactly one task autonomously, runs checks, commits, pushes, updates the four state files, prints a report.
- **Human** — courier + visual tester.

### 17.2 The loop (per task)
1. Planner reads `TASKS.md` + `PROGRESS.md` + `DECISIONS.md`, selects the next unchecked task, and writes a **self-contained Executor prompt** (template in Appendix E) containing: the task, the exact files to touch, the acceptance criteria, the tests to write/run, and the required state-file updates.
2. Human pastes it into Claude Code.
3. Executor: implements → writes/updates tests → runs tests until green → updates `TASKS.md` (tick), appends to `PROGRESS.md`, appends any decisions to `DECISIONS.md`, updates `CLAUDE.md` if standing rules changed → `git add -A && git commit` with a conventional message → `git push` → prints a **completion report** (template in Appendix E) summarizing what changed, test results, decisions, and anything the next task needs.
4. Human pastes the completion report back to the Planner.
5. Planner verifies the report against the acceptance criteria, and either emits the next task's prompt or, if something is off, emits a corrective prompt. When the Planner conversation gets long, it emits a **Planner handoff** (a short prompt that tells a fresh Planner chat to read the state files and continue) — the true state is always in the repo, so this is lossless.

### 17.3 One task = one commit = one push
Tasks are small enough to complete and verify in a single Executor session. Every task ends pushed to GitHub so Younes can pull at any time. Never batch multiple tasks into one commit.

### 17.4 The verification gate (the anti-error mechanism)
No task is "done" until: its tests pass, the Executor's report explicitly maps each acceptance criterion to evidence, and (for anything visual) the human has eyeballed the result. The Planner refuses to advance if the report doesn't demonstrate the criteria. This gate — small tasks, written criteria, tests, and a report checked against the criteria — is precisely what prevents silent drift.

### 17.5 Claude Code autonomous configuration (no permission prompts)
The user requires zero "accept changes?" interruptions. Configure Claude Code so file edits and the project's normal commands run without prompting, using current (2026) mechanisms:

- **Recommended default: `acceptEdits` mode + an allowlist.** In the repo, create `.claude/settings.json`:
  ```jsonc
  {
    "permissions": {
      "defaultMode": "acceptEdits",
      "allow": [
        "Read", "Glob", "Grep",
        "Bash(python -m pytest:*)", "Bash(pytest:*)",
        "Bash(python:*)", "Bash(pip install:*)", "Bash(uv:*)",
        "Bash(npm run:*)", "Bash(npm install:*)",
        "Bash(git add:*)", "Bash(git commit:*)", "Bash(git push:*)",
        "Bash(git:*)", "Bash(gh:*)", "Bash(brew:*)", "Bash(ffmpeg:*)"
      ],
      "deny": [ "Bash(rm -rf:*)", "Bash(sudo:*)" ]
    }
  }
  ```
  In this mode file edits flow without prompts, and every whitelisted command runs without prompts — covering ~all normal work. Anything with side effects outside the allowlist still asks (a good safety net on a local machine, not a container).

- **Full hands-off option: bypass permissions.** For runs where you want literally no prompts, either set `"defaultMode": "bypassPermissions"` in `.claude/settings.json` or launch with `claude --dangerously-skip-permissions` (equivalent). Accept the one-time warning dialog on first use. In this mode every tool call runs unconfirmed — so **git is the safety net**: because every task commits and pushes, a bad run is always recoverable with `git reset --hard`.

- **Safety practice regardless of mode:** the Executor's first action in any session is to ensure a clean git state; its last action is commit+push. If a session goes wrong, roll back to the last task's commit.

The Planner-side prompts assume `acceptEdits`+allowlist by default and instruct the Executor accordingly; switch to bypass only if you want to stop touching the keyboard entirely and accept the git-rollback contract.

### 17.6 Git & GitHub workflow
- **Private repo**, both operators are collaborators with push access.
- **`main` is always working and pullable.** Small, safe tasks commit straight to `main`. Anything risky or exploratory uses a short-lived `feature/<name>` branch merged when green. (v1 default: straight to `main`, since tasks are small and tested.)
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:` + a scope, e.g. `feat(asr): add Gemini transcription client`.
- **Every task pushes.** Younes pulls `main` to stay current; if both work at once, pull-before-push and resolve in the Executor session.

---

## 18. Coding standards & conventions

- **Python:** 3.12+, type hints everywhere, Pydantic v2 models for all cross-boundary data, `ruff` for lint+format, docstrings on public functions. Small pure functions per pipeline stage; no hidden global state.
- **JS (panel):** modern vanilla or a tiny framework; no heavy build step; keep it a thin console.
- **ExtendScript:** ES3 constraints (no `let/const`, no arrow fns, no native JSON — use `json2.js`); defensive (AE scripting throws readily); wrap the whole build in `app.beginUndoGroup/endUndoGroup`; never assume a layer exists — check and log to the build report.
- **Naming:** the Template Contract sigils (§9.3) are sacred; changing them is a logged decision touching both templates and code.
- **No secrets in code or logs, ever.**
- **Every module has tests** (see §19). A stage without a test is not done.

---

## 19. Testing strategy

The point of tests here is not coverage vanity — it is to let each Executor session *prove* its task works before handoff, so errors never accumulate silently.

- **Unit tests (pytest):** each pipeline stage tested against fixed fixtures (a sample audio clip, a sample transcript, a sample understanding object). Mock external APIs (Gemini) with recorded responses so tests are fast, free, and deterministic.
- **Edit Plan schema tests:** the golden `edit_plan.example.json` validates against the Pydantic schema; malformed plans are rejected with clear errors. This golden plan also lets the AE side be built and tested with zero backend.
- **Contract tests:** the plan validator checks template names against a Brand Kit's `registry.json`; a test ensures unknown templates fail loudly.
- **Caption bidi test:** an explicit test that a mixed-script line (`"Salam بزاف ديال promo"`) produces correctly script-tagged, non-overlapping words.
- **AE smoke test:** a small ExtendScript harness that loads the golden plan against a stub template set and asserts the master comp is created with the expected number of caption/image/audio layers, writing a `build_report.json`. Run manually in AE during the AE tasks; the human confirms visually.
- **Live-API smoke (manual, occasional):** one script that runs a real 5-second clip end-to-end to sanity-check the real Gemini path, run by a human, not in CI.

CI (optional, later): run pytest on push. v1 minimum is local pytest green before each commit — enforced by the Executor as part of every task.

---

## 20. Error handling, logging, observability

- **Every stage** writes a structured line to the job's `log.txt` (stage, duration, key counts, cost).
- **Fail loud, fail local:** a stage that cannot proceed writes a clear error to status and stops the job in `error` state with a human-readable message surfaced in the panel — never a silent partial.
- **The AE build is the exception:** it degrades gracefully (skip a missing template, log it in `build_report.json`, keep going) because a half-built comp a human can finish beats an aborted build.
- **Cost meter** logged per job.
- **No PII/keys in logs.**

---

## 21. Security & privacy

- Internal, two-operator, local tool: the threat model is small, but discipline still matters.
- Keys only in git-ignored `.env`; `.env.example` documents names, never values.
- Backend binds to `127.0.0.1` only — never `0.0.0.0`; no remote exposure.
- Client footage and generated assets live in git-ignored `/jobs`; not committed.
- No telemetry, no third-party analytics.
- Gemini image outputs carry SynthID watermarks (a property, not a risk, for internal social use) — noted so no one is surprised.

---

## 22. Performance & cost budgets

- **Target wall-clock per 30s reel:** a few minutes, dominated by image generation (~12s each × several) and the correction pause (human). Nothing should hang; every long step reports progress.
- **Cost per reel:** cents (see §6.8). Guardrails in §16.4.
- **Determinism:** cache images by prompt hash; record model ids per job.

---

## 23. Risks & mitigations

- **R1 — Darija/code-switch ASR accuracy (highest).** Mitigation: strong multimodal ASR + **mandatory human correction gate** + **forced alignment on corrected text** (timing independent of ASR word accuracy). Upgrade path: fine-tuned Darija ASR. This is designed so the hard part can't sink quality — a human always confirms words, and timing is computed from the confirmed words.
- **R2 — Mixed-script (bidi) caption rendering.** Mitigation: dual-script font requirement, explicit bidi test line, human visual check on the caption template early.
- **R3 — Template/code contract drift.** Mitigation: the sigil naming convention + `registry.json` + plan validation against it + a contract test. Changes are logged decisions.
- **R4 — AE scripting fragility (ExtendScript throws, AE state).** Mitigation: dumb assembler design, defensive checks, undo groups, graceful degradation + build report, golden-plan smoke test.
- **R5 — Beat-sync feeling mechanical or off.** Mitigation: snap-with-tolerance, keep motion subtle, human final tweak; tune on the one v1 kit before generalizing.
- **R6 — Build drift across many Claude sessions (the reason for this whole methodology).** Mitigation: small tasks, four state files as source of truth, per-task tests + verification gate, one commit/push per task, lossless Planner handoffs.
- **R7 — Cost runaway.** Mitigation: per-job image ceiling, cost meter, cheap mode, pause-on-ceiling.

---

## 24. Roadmap & milestones

Phased so each milestone is independently useful and testable. `TASKS.md` expands these into small tasks.

- **M0 — Foundations.** Repo, state files, setup scripts, config/secrets scaffolding, CI-lite (local pytest), the golden Edit Plan + Pydantic schema. *Outcome:* the contract exists and validates.
- **M1 — Backend pipeline (no AE).** Ingest → audio → ASR → correction API → alignment → understanding → visual plan → images → music/beats → Edit Plan, all tested against fixtures with mocked APIs, plus a manual live smoke. *Outcome:* given a take + brief, the backend emits a valid `edit_plan.json` and assets.
- **M2 — Brand Kit + templates (human-authored) + registry.** The one v1 kit: palette, dual-script font, caption template (with bidi + karaoke), image-reveal templates, transitions, punch, animated-text fallback; `registry.json` written; plan validates against it. *Outcome:* a fillable template set exists.
- **M3 — AE build (ExtendScript).** Read plan → assemble master comp from templates → captions, images, motion, audio → build report → stop. Verified against the golden plan, then real plans. *Outcome:* a plan becomes a built comp.
- **M4 — CEP panel.** Operator UI: picker, brand dropdown, brief, progress, transcript editor, trigger AE build, show report, backend health. *Outcome:* the whole flow runs from inside AE.
- **M5 — End-to-end polish.** Real reels on the one kit; tune density, emphasis, beat snap, gain; the "professional not clumsy" pass. *Outcome:* reels good enough to ship to a client.
- **Later:** second Brand Kit, more formats, ASR upgrade, music API, optional auto-render.

---

## 25. Open decisions & assumptions log

Resolved (locked) decisions are recorded inline above and belong in `DECISIONS.md` at build start. Assumptions the build should surface if wrong:

- **A1** Input is always already-cut, single-speaker, 9:16, ~30s. (Locked.)
- **A2** Caption fill uses mechanism (A) one-layer-per-word initially (§11.4). Revisit if layer count is unwieldy.
- **A3** Tool name is **Framopia Studio**; repo/slug `framopia-studio`. (Locked.)
- **A4** Gemini is the single provider for ASR + understanding + images in v1. Fallback ASR is a future hook.
- **A5** Straight-to-`main` git flow for v1 (tasks small + tested); feature branches only for risky work.
- **A6** Claude Code runs `acceptEdits` + allowlist by default; bypass mode optional with git as safety net.

Anything an Executor discovers that contradicts an assumption is logged to `PROGRESS.md` and raised to the Planner before proceeding.

---

## Appendix A — Full Edit Plan example (golden)

This is the golden artifact committed at `docs/edit_plan.example.json`. It lets the AE side be built and tested with no backend, and anchors the schema. (Abbreviated for readability; the committed file is complete and validates.)

```jsonc
{
  "schema_version": "1.0",
  "job_id": "20260720-demo01",
  "brand_kit": "framopia-clientA",
  "reel": { "width": 1080, "height": 1920, "fps": 30, "duration": 12.0 },
  "source": { "video": "input.mp4", "audio": "audio.wav" },
  "captions": [
    {
      "segment_index": 0,
      "template": "caption_karaoke_default",
      "words": [
        { "text": "Salam", "script": "latin",  "start": 0.30, "end": 0.60, "emphasis": false },
        { "text": "بزاف",  "script": "arabic", "start": 0.60, "end": 0.95, "emphasis": true  },
        { "text": "ديال",  "script": "arabic", "start": 0.95, "end": 1.20, "emphasis": false },
        { "text": "promo", "script": "latin",  "start": 1.20, "end": 1.70, "emphasis": true  }
      ]
    }
  ],
  "visuals": [
    { "id": "v1", "kind": "generated_image", "asset": "assets/images/v1.png",
      "template": "image_reveal_slideup", "start": 2.02, "end": 6.05, "beat_aligned": true },
    { "id": "v2", "kind": "client_asset", "asset": "assets/client/product.png",
      "template": "image_reveal_scalein", "start": 6.05, "end": 9.10, "beat_aligned": true },
    { "id": "v3", "kind": "animated_text", "asset": null, "text": "300 DH",
      "template": "animtext_bold", "start": 9.10, "end": 11.5, "beat_aligned": true }
  ],
  "motion": [
    { "kind": "punch_in", "target": "speaker", "at": 4.00, "amount": 1.08, "template": "punch_soft" },
    { "kind": "transition", "template": "whip_pan", "at": 6.05 }
  ],
  "audio": {
    "music": { "asset": "assets/audio/track_cozy_01.wav", "gain_db": -14.0, "start": 0.0 },
    "sfx": [ { "asset": "assets/audio/whoosh.wav", "at": 6.05, "gain_db": -10.0 } ]
  },
  "beats": [0.50, 1.02, 1.55, 2.02, 2.55, 3.05, 3.55, 4.02, 6.05, 9.10],
  "meta": { "summary": "Client A announces a 300 DH promo.", "brief": "cozy promo",
            "generated_at": "2026-07-20T10:00:00Z", "cost_estimate_usd": 0.28 }
}
```

## Appendix B — ExtendScript / AE automation notes

- ExtendScript is ES3: no `let/const`, no arrow functions, no `JSON` (bundle `json2.js`), no `Array.forEach` reliance — use plain loops.
- Read the plan: `var plan = JSON.parse(readFile(planPath));`.
- Comp creation: `app.project.items.addComp(name, w, h, 1, duration, fps)`.
- Import footage: `app.project.importFile(new ImportOptions(File(path)))`.
- Duplicate a template comp, then find placeholders by name-sigil:
  ```javascript
  function findLayerBySigil(comp, sigil) {
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layer(i).name.indexOf(sigil) === 0) return comp.layer(i);
    }
    return null; // log to build report, degrade gracefully
  }
  ```
- Replace an image placeholder source: `imgLayer.replaceSource(footageItem, false)`.
- Set text: `textLayer.property("Source Text").setValue(str)`.
- Time a layer: `layer.startTime`, `layer.inPoint`, `layer.outPoint`.
- Always wrap in `app.beginUndoGroup("Framopia Studio build")` / `app.endUndoGroup()`.
- Never render here. Leave the comp open; write `build_report.json`.
- Enable in AE: Preferences → Scripting & Expressions → "Allow Scripts to Write Files and Access Network".

## Appendix C — CEP panel setup

- Structure: `CSXS/manifest.xml` (declares the extension + AE host + version), `client/` (HTML/CSS/JS UI + `CSInterface.js`), `host/` (`.jsx` + `json2.js`).
- Dev: enable unsigned extensions (macOS): `defaults write com.adobe.CSXS.<ver> PlayerDebugMode 1`, then restart AE. (`<ver>` matches the CEP version AE 2026 ships.)
- Install location (macOS): `~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio/`.
- Panel ↔ host: `new CSInterface().evalScript("fsBuild('" + planPath + "')", cb)`.
- Panel ↔ backend: `fetch("http://127.0.0.1:<port>/...")` from the panel JS (CEP allows Node/network).
- The setup script (Appendix D) symlinks or copies the panel into the extensions folder and sets the debug flag.

## Appendix D — Environment setup (scripted, idempotent)

Because the operators may not have the toolchain installed, `setup/` provides scripts that are safe to run repeatedly:

- `setup/mac_setup.sh`:
  - Install Homebrew if missing; `brew install python@3.12 ffmpeg node`.
  - Create a Python venv; `pip install -e backend` (or `uv`).
  - Install the forced aligner and its Arabic model.
  - Copy/symlink `ae_panel/` into the CEP extensions folder; set `PlayerDebugMode`.
  - Create `.env` from `.env.example` if absent (prompt the operator to fill keys).
  - Verify: run `GET /health` and print a readiness checklist.
- The script prints a clear ✅/❌ readiness report; the first M0 task builds this so nothing else is blocked by "it's not installed."

## Appendix E — Prompt templates for the session chain

### E.1 Planner → Executor task prompt (template)
```
CONTEXT
You are the Executor (Claude Code) for the Framopia Studio project. Before anything:
1) Read CLAUDE.md, PROGRESS.md (latest entries), DECISIONS.md, and TASKS.md.
2) Confirm a clean git working tree.

TASK  (id: <T-XX>, milestone: <Mn>)
<one precise task, scoped to complete in this session>

FILES YOU MAY TOUCH
<explicit list / directory>

ACCEPTANCE CRITERIA  (each must be provably met)
- <criterion 1>
- <criterion 2>
- Tests: <which tests to add/run; must be green>

CONSTRAINTS
- Obey the Master Spec (docs/FRAMOPIA_STUDIO_MASTER_SPEC.md). Do not invent scope.
- No secrets in code/logs. Respect the Template Contract sigils.
- If you discover a contradiction with the spec/assumptions, STOP, log it to
  PROGRESS.md, and report it instead of guessing.

DONE MEANS
- Code + tests written; pytest green (run it, paste results).
- TASKS.md: tick <T-XX> and add any newly discovered tasks.
- PROGRESS.md: append a dated entry (what/why/learned/next).
- DECISIONS.md: append any non-trivial decision + reason.
- CLAUDE.md: update if standing rules changed.
- git add -A && commit (conventional message) && push.
- Print the COMPLETION REPORT (template E.2).
```

### E.2 Executor → Planner completion report (template)
```
COMPLETION REPORT — Task <T-XX> (<Mn>)
Summary: <what was built, 2-4 lines>
Files changed: <list>
Acceptance criteria:
  - <criterion 1> → <evidence: test name / output>
  - <criterion 2> → <evidence>
Tests: <command> → <pass count / results>
Decisions logged: <DECISIONS.md entries, or none>
Assumptions/contradictions found: <or none>
State files updated: TASKS ✔  PROGRESS ✔  DECISIONS ✔  CLAUDE (✔/n/a)
Commit: <hash + message>   Pushed: <yes>
Next task suggestion: <T-YY> — <why>
Human visual check needed?: <yes/no; if yes, exactly what to look at>
```

### E.3 Planner handoff (when a Planner chat gets long)
```
You are a fresh Planner for Framopia Studio. The Claude Project already contains the
Master Spec and the repo. Do this:
1) Read TASKS.md, the last 3 PROGRESS.md entries, and DECISIONS.md.
2) Identify the next unchecked task and any open flags.
3) Resume the loop: emit the next Executor prompt (template E.1).
Do not re-decide settled items in DECISIONS.md.
```

## Appendix F — Template layer naming quick reference (the contract)

| Sigil (layer-name prefix) | Meaning | Script action |
|---|---|---|
| `#IMG` | image placeholder | replace source with asset |
| `#TXT_MAIN` | main text | set Source Text |
| `#TXT_WORD` | per-word caption driver | drive per §11.4 |
| `#COLOR_ACCENT` / `#COLOR_BG` | palette-driven | tint from Brand Kit |
| `#LOGO` | logo placeholder | replace source with kit logo |
| `#SAFE` | caption safe-area guide | ignored (designer aid) |

Template comp names (must match Edit Plan + `registry.json`): `caption_*`, `image_reveal_*`, `transition_*`, `punch_*`, `animtext_*`.

---

*End of Framopia Studio Master Specification v1.0. The next document, `FRAMOPIA_STUDIO_TASKS.md`, slices milestones M0–M5 into small, individually-verifiable tasks in build order, each ready to become an Executor prompt via Appendix E.1.*
