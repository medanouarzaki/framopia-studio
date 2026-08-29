# Framopia Studio — Block Plan

Version: 1.0. The plan is versioned, not sacred: divergence is recorded in handoffs with a proposed amendment.

One block = one Claude Project conversation (Claude Opus) driving several Claude Code sessions. "Sessions" below are estimates, not quotas. Every block ends with its definition of done (DoD) verified and a handoff written.

**Regression rule:** from Block 2 onward, every block's final Claude Code session re-runs the current end-to-end check: initially `npm run check` (typecheck + lint + unit tests + template validation once it exists); from Block 10 onward, the golden-sample pipeline run. Regressions block the handoff.

---

## Block 1 — Repo foundation + transcription benchmark
**Goal:** a working skeleton and a frozen, evidence-based transcription configuration.
**Deliverables:**
- Private GitHub repo `framopia-studio` created and laid out per ARCHITECTURE §2; CLAUDE.md written; foundation docs committed under `docs/`.
- Guided API-key acquisition (user task, step-by-step): ElevenLabs key with paid Scribe access; Google AI Studio key with billing enabled (note: consumer Gemini Pro subscription ≠ API). Keys land in `.local/config.json`.
- Companion service skeleton (health endpoint, job framework, config loading, cost ledger).
- ffmpeg audio extraction working on real footage.
- Benchmark harness: runs Scribe v2 alone, Gemini alone, Whisper large-v3 (local baseline), hybrid; scores WER overall and on code-switched segments, orthography conformance, timestamp deviation, cost — against ground truth.
- **User tasks inside this block:** provide 5–10 min of real reels; hand-write ground truth for a ~1–2 min subset (guided, using the orthography draft).
- ORTHOGRAPHY_GUIDE.md refined with the user against real transcripts and finalized (v1.0).
- Decision record: winning transcription config frozen, documented in `docs/` amendment + benchmark results committed (numbers, not footage).
**DoD:** benchmark ran on real footage; a configuration is frozen with recorded evidence; repo builds/checks green.
**Depends on:** foundation docs. **Sessions:** 4–6.

## Block 2 — Transcription production pipeline
**Goal:** the frozen config wired for production; Edit Plan v1 emitted.
**Deliverables:** hybrid merge implementation (or winner as frozen); language/script tagging; cleaning rules (fillers/stutters/false starts as `removed` flags); subtitle grouping (1–2 words, timing-aware); per-word confidence; caching per ARCHITECTURE §6; Edit Plan schema v1 implemented with validation; CLI entry (`service` job) to run transcription on a video end-to-end.
**DoD:** a real reel produces a correct, cached, validated Edit Plan with transcript + groups; re-run hits cache; unit tests on merge/grouping/cleaning.
**Depends on:** 1. **Sessions:** 3–5.

## Block 3 — Semantic analysis
**Goal:** keywords + image-slot planning + template/SFX assignment in the Edit Plan.
**Deliverables:** keyword detection (auto + propose modes, scores + reasons); image slot planner (5–6/30 s, spread, prompts composed from mode style fragments + global negatives); deterministic template assignment from mode's allowed variants; SFX event derivation from template manifests (against a stub manifest until Block 6); Edit Plan enrichment + tests.
**DoD:** analysis on the Block 2 fixture yields sensible keywords/slots (user eyeballs once); deterministic given same inputs; cached.
**Depends on:** 2. **Sessions:** 2–4.

## Block 4 — Image generation service
**Goal:** Nano Banana integration with candidates, cutouts, quality gate, costs.
**Deliverables:** paid-tier Gemini image calls; per-mode style prompting; 2–4 candidates/slot; Python sidecar `remove_bg` (rembg/BiRefNet) + quality metrics + gate + card fallback; caching keyed on prompt fingerprint; cost tracking per image; regenerate-with-tweak and own-prompt service endpoints.
**DoD:** for a fixture Edit Plan, all slots get candidates + gated cutouts on disk with metrics; costs recorded; cache prevents regeneration.
**Depends on:** 3 (slots), 1 (keys). **Sessions:** 3–4.

## Block 5 — Frame analysis & placement
**Goal:** negative zones + deterministic placement.
**Deliverables:** sidecar `segment_person` (MediaPipe; YOLO11-seg fallback assessed on real frames — decision recorded) and `compute_zones` (stability + validity windows); placement solver (zones × slots, subtitle-band and concurrency constraints, bounded human-feel jitter); manual-zone data model + service endpoints; visual debug output (frames with overlaid masks/zones) for verification.
**DoD:** on real footage, computed zones visibly avoid the speaker; solver places all fixture slots without overlaps; manual override round-trips.
**Depends on:** 2 (timing), 3 (slots). **Sessions:** 3–4.

## Block 6 — Template library
**Goal:** first hand-made template set, manifest, validation.
**Deliverables:** user builds (guided step-by-step from TEMPLATE_LIBRARY_GUIDE.md): 1 subtitle style, 1 keyword style, 2 image styles in `templates/library.aep`; manifest.json filled; validation script (`tools/validate-templates`) checking placeholders, naming, manifest completeness, comp settings — wired into `npm run check`; **collect and record the global Arabic subtitle font name** (amend PROJECT_SPEC).
**DoD:** validation passes on the committed AEP; a deliberately broken copy fails loudly with a precise message.
**Depends on:** none technically (parallel-safe), but scheduled here so Block 7 has real templates. **Sessions:** 2–3 (plus user hands-on time).

## Block 7 — ExtendScript comp builder
**Goal:** build plan → built comp, headlessly testable.
**Deliverables:** build plan schema (derived from Edit Plan, documented next to the code); `.jsx` builder: import (incl. watermark with **confirmed alpha interpretation — collect the user's file-details screenshot at block start**, record codec/duration in PROJECT_SPEC amendment), duplicate, populate text/images, retime, position, SFX layers, watermark at t=0, save `.aep`; structured JSON error reporting; headless test runner against the Block 6 AEP + a fixture build plan.
**DoD:** headless run on the fixture produces a correct comp (user opens and verifies once); all error paths return structured errors.
**Depends on:** 6. **Sessions:** 3–5.

## Block 8 — CEP panel
**Goal:** the complete branded UI and workflow, wired end-to-end.
**Deliverables:** CEP scaffold + debug setup; service spawn/health; pipeline runner with staged progress; transcript editor (word edit, script toggle with RTL-aware rendering, group adjust, confidence highlighting, removed-word restore); keyword mode picker + checkboxes; image candidate picker (pick/regenerate-with-tweak/own prompt, cutout-vs-card override); zone editor (view + manual adjust); Build button wiring panel ↔ service ↔ ExtendScript; **visual polish pass as a distinct deliverable** (Framopia dark-first branding per PROJECT_SPEC §6).
**DoD:** a full reel goes video-in → built comp entirely from the panel with no terminal involvement; UI passes the user's eye for "polished product".
**Depends on:** 2,3,4,5,7. **Sessions:** planned 5–7; **ran 45 across two conversations.**

**State at close (2026-08-29): one half met, one half not, and the split is exact.**

- **"UI passes the user's eye" — MET.** He has used every part of it and approved the one-screen layout, its order, its type size, its words, the client card and the file dialog.
- **"Video-in → built comp entirely from the panel with no terminal" — NOT MET.** Frame analysis is reported, never driven: `npm run frames`, `npm run segment` and `npm run zones` run the Python sidecar and take minutes, and the pipeline runner names them rather than running them. A video that has never been through the sidecar therefore cannot be taken end to end from the panel. It no longer *silently* builds a wrong comp — since session 39 the build refuses and names the command — but refusing is not driving.
- Also terminal-only: `npm run watermark:measure` (without it no watermark is placed at all) and `plan.source.dialogueLufs`, which only `npm run migrate:sfx-placement` writes.
- **Everything else in the deliverable list exists**, including the zone editor, which was answered rather than built: automatic image placement stopped reading zones in Block 7 session 9, so a list of them would have been a control over a decision nobody makes. What replaced it is the picture editor's size and limit line.

**The handoff is `handoffs/block-8.md`** (part 2, sessions 11–45) and `handoffs/block-8-part-1.md` (sessions 1–10).

## Block 9 — Client modes + K2 Syndicalia
**Goal:** mode system for real; first client mode; two-machine sharing.
**Deliverables:** mode JSON schema + loader + validation; K2 mode built with locked palette + fonts/identity the user provides at this block (do not invent); mode vocabulary → keyterm wiring verified; documented GitHub workflow for sharing modes/templates between the two machines (pull-before-run, conflict rules).
**DoD:** switching modes changes fonts/palette/image style/template variants end-to-end on the fixture; second-machine sharing doc reviewed by the user.
**Depends on:** 8 (UI selection), 4 (style prompting). **Sessions:** 2–3.

## Block 10 — Hardening & golden sample
**Goal:** production confidence.
**Deliverables:** one real reel processed end-to-end committed as the permanent regression fixture (golden sample: pinned inputs, expected artifact shapes/checks — footage itself stays out of git, referenced by hash + a fetch note); `npm run golden` executing the full pipeline against it with assertions; error handling + bounded retries audited across stages; per-reel cost report surfaced; second-MacBook install/setup doc written and executed for real on machine #2.
**DoD:** golden run green on both machines; a second real reel processed by the partner without developer help.
**Depends on:** all. **Sessions:** 3–4.

---

## Dependency sketch

```
1 → 2 → 3 → 4 ─┐
        └→ 5 ──┼→ 8 → 9 → 10
6 → 7 ─────────┘
```
Block 6 can start any time after Block 1; scheduling it before 7 is the only hard ordering.
