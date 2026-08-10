# Handoff — Foundation Conversation
Date: 2026-08-10 · Model: Claude Fable 5 · Scope: foundation documents only (no code)

## Status
All Section-8 deliverables produced: PROJECT_SPEC.md, ARCHITECTURE.md, BLOCKS.md, HANDOFF_PROTOCOL.md, CLAUDE_CODE_GUIDELINES.md, TEMPLATE_LIBRARY_GUIDE.md, ORTHOGRAPHY_GUIDE.md (draft v0.9). No additional documents were judged necessary. All are to be (a) added to the Claude Project knowledge files and (b) committed to the repo under `docs/` in Block 1 session 1.

## Decisions made this conversation (with user input)
1. **Ground truth**: the user has real edited reels but no manual transcript yet → writing a ~1–2 min ground-truth transcript is an explicit **user task inside Block 1**, guided, before benchmark scoring. Block 1's DoD depends on it.
2. **API keys**: user has none (consumer Gemini Pro subscription is not API access). Block 1 opens with guided acquisition: ElevenLabs (paid Scribe) + Google AI Studio key with billing enabled.
3. **Repo**: private `framopia-studio` under the user's personal GitHub account; Claude Code creates it in Block 1. Org migration possible later, consequence-free.
4. **Watermark corrected**: it is a **QuickTime file with alpha**, not MP4. Exact codec, alpha interpretation, and duration are confirmed from the user's file-details screenshot **at the start of Block 7** (marked TODO in PROJECT_SPEC §5 and BLOCKS Block 7).
5. **Subtitle fonts**: Latin = **Inter Semi-Bold** (locked). Arabic companion font exists but its name is uncollected → placeholder `TBD_ARABIC_FONT`, collected at Block 6 start, recorded by amendment.
6. **K2 Syndicalia**: palette locked (`#1A0000`, `#820000`, `#C9A96E`, `#F8F6F2`); fonts and further visual identity are **not to be invented** — the user provides them at Block 9.
7. **Your-call resolutions** (revisitable with evidence): person segmentation = MediaPipe Image Segmenter with YOLO11-seg as assessed fallback (Block 5 decision point); background removal = rembg + BiRefNet-general; sidecar = stateless subprocess with JSON stdin/stdout; service↔panel = localhost HTTP with job polling, loopback-only + shared token.
8. **Edit Plan schema v1** defined field-by-field in ARCHITECTURE §3; SFX events are always derived from template manifests, never hand-authored; human-edited items are flagged and protected from automated overwrite.
9. **Block plan refined** (BLOCKS.md v1.0): 10 blocks kept in spirit; regression rule active from Block 2 (`npm run check`), golden sample from Block 10; Block 8 pre-authorized to split across two conversations.

## Deviations from the master prompt
None of substance. Two corrections absorbed: watermark container (MP4 → QuickTime+alpha, per user) and the addition of key-acquisition + ground-truth-writing as Block 1 user tasks (the master prompt assumed both existed).

## Known issues / risks
- Ground truth quality gates the entire transcription decision; the user should write it carefully with ORTHOGRAPHY_GUIDE at hand (its §9 open questions get resolved in the same sitting).
- Watermark alpha interpretation unverified until Block 7 — do not let ExtendScript work start before the screenshot is collected.
- Whisper large-v3 baseline runs locally on Apple Silicon (whisper.cpp or mlx-whisper); Block 1 must pick one pragmatically — it is only a baseline, not a candidate.
- Real-footage benchmark cost is trivial (<$1) but Gemini image pricing for Block 4 should be re-checked against current paid-tier pricing at that block.

## Exact next steps (Block 1)
1. Guided API-key acquisition (both providers) → `.local/config.json`.
2. Claude Code prompt #1: create repo + layout + CLAUDE.md + commit docs + service skeleton + ffmpeg extraction.
3. User provides 5–10 min of reels; guided ground-truth writing (~1–2 min) resolving ORTHOGRAPHY_GUIDE §9.
4. Benchmark harness; run all four configurations; score; freeze the winner; finalize ORTHOGRAPHY_GUIDE v1.0; handoff.
