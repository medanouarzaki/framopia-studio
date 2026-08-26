# Framopia Studio — Project Specification

Status: locked. Changes require an explicit amendment recorded in a handoff document.
Version: 1.0 (Foundation conversation, 2026-08-10)

## 1. What this is

Framopia Studio is an internal After Effects automation tool for Framopia, a two-person Moroccan video agency. It takes a finished talking-head reel (already cut, cleaned, color-graded) and performs the motion-design pass currently done by hand:

1. Transcribe the speech (code-switched Moroccan Darija, Modern Standard Arabic, French, English). Transcription accuracy is the single highest priority of the project.
2. Generate animated, styled subtitles, correctly placed.
3. Detect and emphasize important words with punchier dedicated animations.
4. Generate contextual images (Nano Banana / Gemini image API) for key ideas and place them in the frame's negative space.
5. Place sound effects from a small local library, deterministically bound to template animations.
6. Overlay the Framopia watermark intro at t=0.

The output is **not a rendered video**. It is a fully built After Effects composition, assembled from hand-made animation templates, that the editors review, adjust, and render themselves. Framopia Studio is a first-pass assistant. The humans always have the last word.

**Invisible-AI requirement:** everything placed must look hand-edited by a professional motion designer. No generic AI look in images, no visible watermark from the image model, no robotic uniformity in placement or timing. Per-client style prompts and hand-made templates are the main instruments for this.

## 2. Users and environment

- Exactly two users, both on Apple Silicon MacBooks, both running After Effects 2026. Adobe suite available: AE, Photoshop, Media Encoder.
- Development is executed by Claude Code on the user's machine, orchestrated by Claude Project conversations (one per block — see BLOCKS.md and HANDOFF_PROTOCOL.md).
- The GitHub repo is the single source of truth. Client modes and the template library are shared between machines through the repo. Machines are otherwise independent (own API keys, cache, AE install).
- Repo default: private repository `framopia-studio` under the user's personal GitHub account (Claude Code creates it in Block 1; an org can be adopted later without consequence).

## 3. Hard constraints

- **No AI fingerprints in the repo.** No "Generated with Claude Code" / "Co-Authored-By: Claude" trailers, no AI attribution anywhere, no emoji-saturated READMEs, no boilerplate AI-style comments, no excessive doc-comments on trivial code. Conventional-commit style, small commits, history reads like a competent human developer's. Full rules in CLAUDE_CODE_GUIDELINES.md; repeated in every Claude Code prompt.
- **Budget:** ~$0.50–2.00 API cost per reel. Accuracy wins over cost within that envelope. Aggressive caching (transcriptions, images, analysis) so re-runs are near-free.
- **Never** cut, retime, or grade the source footage.

## 4. Input / output (locked)

**Input:** one vertical 9:16 MP4, 4K (2160×3840), **29.97 fps (30000/1001)**, 30–90 s, one speaker, one angle, no cuts, audio embedded, already edited and graded. The "30 fps" this section carried until Block 7 predates anyone reading a file header: every reel the project has handled is 30000/1001, and Block 5's frame sampling reads real presentation timestamps that diverge from a nominal 30 fps grid from the second frame onward.

**Framing:** speaker usually centered; usable negative space above the head and left/right. Negative space is auto-detected, with a manual zone-adjust fallback in the panel.

**Output:** an AE project/composition containing: source footage layer; watermark overlay at t=0 (same file for all clients, fixed duration, overlaid — does not extend the video); subtitle template instances; keyword template instances; image template instances in negative zones; SFX audio layers. All timed, populated, positioned — ready for human review and manual render.

## 5. Locked product decisions

### Subtitles
- Script convention: Latin/Arabizi by default (3/7/9 conventions — see ORTHOGRAPHY_GUIDE.md); French and English inline as-is; genuinely classical/standard Arabic (quotes, religious phrases, formal terms) rendered in Arabic script. The pipeline tags each word's language/register; the Latin-vs-Arabic decision is editable per word in the review UI.
- Lightly cleaned verbatim: remove fillers, stutters, false starts. Never paraphrase.
- Display **one word per card** (fast reel style). Word-level timestamps are mandatory.
  Amended in Block 7 session 6 from "groups of 1–2 words": a two-word card puts its
  second word on screen when the first is spoken and holds it there until the second is
  said, so the eye reads ahead of the ear on every such card — measured across the corpus
  at a median of 0.410 s and a maximum of 0.870 s. No retiming fixes it, because the two
  words are one layer. The cost is recorded in `reports/block-7-session-6.md`: cards go
  190 → 343 across the five reels and 120 of them are shorter than a template's
  intro + minimum hold. Keyword spans stay at up to two words — a keyword is its own
  element and its templates are built for 1–2 words.
- Same language as speech; no translation.
- Subtitle visual style and position are global across all clients; per-client only font/palette applied through the template.
- Global subtitle fonts: **Inter Semi-Bold** for Latin script; Arabic companion font: **Almarai Bold**, set at **1.07x** the Latin size so the two faces read at the same optical weight.
- Global subtitle geometry, measured off a delivered reel by the user (Block 6 session 3): first-baseline anchor **(1080, 2480.4)** in the 2160x3840 frame — `y` is the text baseline, not the top of the type — subtitle size **343**, keyword size **425**, line spacing **323**. Both tracks may wrap to a second line. The user's comp reads 381.1 / 472.1 / 359 because its text layers run at 90% scale; the sizes above are the same type at 100%, which is what the templates are authored at. Declared once in `core/src/typography.ts`; the placement exclusion `SUBTITLE_BAND` is derived from them and from the fonts' own ink extents, never written by hand.

### Important words
- 3–5 emphasized words per 30 s.
- Two selection modes, both required, chosen per run in the panel: (a) fully automatic with post-hoc correction; (b) AI proposes → editor approves via checkboxes → build.
- Emphasized words use dedicated template animations chosen per client mode. Deterministic: no AI style-picking, no randomness.

### Images
- 5–6 images per 30 s reel, illustrating ideas/sentences. Independent of the emphasized words.
- Generated via Nano Banana (Gemini image API), one visual style per client mode (defined in the mode file). Paid API tier — no visible watermark (invisible SynthID is acceptable).
- **A slot idea depicts one subject.** The planner may not write a multi-subject idea — no shelves, displays, ranges, collections or plural product nouns. It contradicts the mode's own `one subject, centred and unobstructed` and the image negatives' *nothing in frame that is not carrying the idea*, and it fails in three ways at once: the cutout gate reports the extra objects as matte noise, the model fills the frame with invented labels, and the matte is unusable. Enforced at plan time as a hard failure naming the slot (`checkSlotIdea`, Block 4 session 7); never silently rewritten, because the planner is what needs to change.
- **The image config is frozen: `gemini-3-pro-image` at 2K, 1:1, 2 candidates per slot.** Evidence, costs and caveats in `docs/DECISION-image-config.md`. The candidate count is 2 rather than §5.4's 3 because pro's measured cost puts three on a five-slot reel outside the budget envelope below.
- Background removal to transparent cutouts only when clean: quality gate (alpha-edge heuristics + editor preview), fallback to full-frame image in a framed/card template when doubtful.
- Panel shows 2–4 candidates per slot with pick / regenerate-with-tweak / write-own-prompt controls before placement. Editor approval is part of the standard flow. The generated default is 2 (`DECISION-image-config.md`); a mode may raise it via `imageCandidates`.

### SFX
- ~5 local files (hits, whooshes) in a repo folder. Mapping is deterministic: each template's manifest declares which SFX fires at which offset. No AI at runtime. SFX set is global, not per-mode.

### Watermark
- One QuickTime file **with an alpha channel** (not MP4 — corrected during foundation), same for all clients, stored in the repo, overlaid starting at frame 0, fixed duration.
- TODO (Block 7 start): confirm exact codec (ProRes 4444 / Animation), alpha interpretation (straight vs premultiplied), and duration from the file the user provides. ExtendScript must set alpha interpretation accordingly on import.

### Client modes
- A mode is a versioned JSON file in the repo: client name, color palette, fonts, image-generation style (style prompt fragments + negative prompts), allowed template variants per element type, logo asset path, client-specific vocabulary (fed to transcription as key terms).
- Global (not per-mode): subtitle position, subtitle base style, SFX set.
- First mode: **K2 Syndicalia** — palette `#1A0000`, `#820000`, `#C9A96E`, `#F8F6F2`. Fonts and further visual identity: provided by the user at Block 9; do not invent them.

## 6. Architecture (summary — full detail in ARCHITECTURE.md)

Three cooperating pieces, one repo:

1. **CEP panel** in AE (CEP, not UXP — UXP is not production-ready for AE in 2026; CEP runs natively on Apple Silicon). React + TypeScript. The panel is the entire UX: pick video, pick mode, run pipeline, edit transcript, toggle keywords, review image candidates, adjust zones, Build comp.
   Branding: the panel is **Framopia Studio**, dark-first (charcoal/near-black), brand red `#ED1C24` as the single accent, white/neutral grays for text, logo at `assets/brand/Framopia_LOGO.png` (white with red accent, 962×1077, transparent). Clean modern typography, generous spacing, clear pipeline-progress states, RTL-aware Arabic rendering in the transcript editor. Visual polish is a deliverable of the CEP block, not a nice-to-have. The brand palette styles the tool's UI; client-mode palettes style the video content. Never mix the two.
2. **ExtendScript layer** (`.jsx`, ES3) — the only code that touches the AE DOM. Imports assets, duplicates template comps, populates placeholders, positions instances, lays SFX and watermark layers. Thin and dumb: it executes a fully resolved build plan JSON; all intelligence lives outside.
3. **Local companion service** — Node.js/TypeScript over localhost HTTP: ffmpeg audio extraction, transcription API calls, LLM analysis, image generation, caching, cost tracking. CV tasks (person segmentation, background removal) run in a Python sidecar (repo venv, subprocess).

The central artifact is the **Edit Plan** — one JSON per video, schema-versioned, enriched by every stage, edited by the review UI, consumed (as a resolved build plan) by ExtendScript. Schema in ARCHITECTURE.md.

## 7. Transcription strategy (highest stakes)

**Resolved 2026-08-24: the config is frozen per `docs/DECISION-transcription-config.md` (hybrid Scribe + Gemini correction). The research findings below are kept as the record of what was believed before the benchmark ran; where they disagree with the decision document, the decision document wins.**

Prior research findings (binding as starting point, not as final choice):

- Whisper large-v3 is disqualified as primary: on code-switched Arabic+European audio it transliterates/translates, ~50% WER on code-switched segments.
- ElevenLabs Scribe v2 (Batch) is the strongest dedicated ASR candidate: top accuracy, automatic code-switching, word-level timestamps, diarization, keyterm prompting (~100 terms) for client vocabulary and recurring Darija spellings. ~$0.40/audio-hour.
- Gemini 2.5/3 Pro as an LLM transcriber dramatically outperforms dedicated ASR on code-switched content (2–3% WER on a closely analogous task) because it is promptable (language mix, Arabizi convention, client vocab). Weakness: less reliable word timestamps.
- Presumed production pipeline: **hybrid** — Scribe v2 for timestamps + raw pass; Gemini pass (audio + Scribe draft + client vocab + orthography rules) for corrected text, language tags, script decisions; alignment merge of corrected text onto Scribe timings; per-word confidence kept for review-UI highlighting.

**The choice is not locked on published benchmarks.** Block 1 builds a benchmark harness and runs at minimum: Scribe v2 alone, Gemini alone, Whisper large-v3 (baseline), and the hybrid — on 5–10 minutes of real Framopia footage, scored against a ground-truth transcript the user writes for a ~1–2 minute subset (a user task inside Block 1). Compared on: WER on code-switched segments, orthography quality, timestamp precision, cost. The winner is frozen and documented.

**API keys:** the user currently has none (a consumer Gemini Pro subscription is not API access). Block 1 begins with guided acquisition of an ElevenLabs key (paid Scribe access) and a Google AI Studio API key with billing enabled. One key set per machine eventually; a single set is acceptable during development.

## 8. Template library (hand-made; system contract)

Animations are hand-made by the editors. The system's contract: template AEP files in the repo; each variant is a comp with named placeholder layers; each template has a JSON manifest entry (id, element type, placeholders, intro/outro durations, anchor behavior, SFX binding, notes). The build step duplicates, swaps placeholder content, retimes, positions — it never edits animation keyframes. A validation script checks every template before build. Full conventions in TEMPLATE_LIBRARY_GUIDE.md.

## 9. Quality bar

This tool processes real client work. Precision over speed, explicitness over cleverness, and the editors always keep final control.
