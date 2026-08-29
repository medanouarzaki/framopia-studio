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

### Subtitle rulings (2026-08-28)

Three questions the transcript editor put in front of the user, with the
instances on screen. All three are **rulings, not proposals**, and all three are
implemented in Block 9 — they change the subtitle builder, and the shrink rule
depends on the client fonts Block 9 collects.

1. **A multi-word §6 term occupies one card together.** One word per card
   (`MAX_WORDS_PER_CARD` = 1) stands for ordinary speech; a term named by
   ORTHOGRAPHY_GUIDE §6 is the case that overrides it, and §6c's rule that a
   term is never broken in the subtitle track is what it serves. 13 runs across
   the corpus are affected today.
2. **A card stays tight to its word; the animation compresses.** A subtitle must
   not outlive the word it transcribes. This **ratifies the behaviour already
   shipped** — Block 7's short-card entrance stretching, which compresses the
   entrance to `MIN_INTRO_S` and clips the hold rather than extending the card —
   so the 23 clipped holds are a recorded decision and not an open defect.
   **Nothing to build.**
3. **An overlong word shrinks to fit.** It never clips at the safe width and
   never wraps to a second line: the type scales down just enough for that word,
   on its own card. 7 words across the corpus are affected today.

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
  190 → 343 across the five reels and 120 of those 343 are shorter than a template's
  intro + minimum hold. Both are corpus figures: per reel the shortened cards are
  ground-truth 33, test-1 21, test-2 26, test-3 18, vitasilk 22. **None of them is
  dropped** — Block 7 session 9 time-stretches the instance so the entrance fits,
  floored at two frames (`MIN_INTRO_S` in `service/src/build/short-card.ts`) — and **28 of the 343 still have their hold clipped**: ground-truth 9,
  test-1 7, test-2 4, test-3 3, vitasilk 5. Keyword spans stay at up to two words — a
  keyword is its own element and its templates are built for 1–2 words.
- Same language as speech; no translation.
- Subtitle visual style and position are global across all clients; per-client only font/palette applied through the template.
- Global subtitle fonts: **Inter Semi-Bold** for Latin script; Arabic companion font: **Almarai Bold**, set at **1.07x** the Latin size so the two faces read at the same optical weight.
- Global subtitle geometry, measured off a delivered reel by the user (Block 6 session 3): first-baseline anchor **(1080, 2480.4)** in the 2160x3840 frame — `y` is the text baseline, not the top of the type — subtitle size **343**, keyword size **425**, line spacing **323**. Both tracks may wrap to a second line. The user's comp reads 381.1 / 472.1 / 359 because its text layers run at 90% scale; the sizes above are the same type at 100%, which is what the templates are authored at. Declared once in `core/src/typography.ts`; the placement exclusion `SUBTITLE_BAND` is derived from them and from the fonts' own ink extents, never written by hand.

### Important words
- 3–5 emphasized words per 30 s.
- Two selection modes, both required, chosen per run in the panel: (a) fully automatic with post-hoc correction; (b) AI proposes → editor approves via checkboxes → build.
- Emphasized words use dedicated template animations chosen per client mode. Deterministic: no AI style-picking, no randomness.

### Images
- **8 images per 30 s reel** (user ruling, 2026-08-29, amending the 5–6 band this line used to state), illustrating ideas/sentences. Independent of the emphasized words. He watched a built reel and asked for more: at 5.5 per 30 s a 25.7-second reel got five, and at 8 it gets seven. It is `IMAGE_SLOTS_PER_30S` in `service/src/analysis/count.ts`, read by the planner and by the dry run so what a run would plan and what it is priced at cannot drift; a mode may set its own `imageSlotsPer30s`.
- Generated via Nano Banana (Gemini image API), one visual style per client mode (defined in the mode file). Paid API tier — no visible watermark (invisible SynthID is acceptable).
- **A slot idea depicts one subject.** The planner may not write a multi-subject idea — no shelves, displays, ranges, collections or plural product nouns. It contradicts the mode's own `one subject, centred and unobstructed` and the image negatives' *nothing in frame that is not carrying the idea*, and it fails in three ways at once: the cutout gate reports the extra objects as matte noise, the model fills the frame with invented labels, and the matte is unusable. Enforced at plan time as a hard failure naming the slot (`checkSlotIdea`, Block 4 session 7); never silently rewritten, because the planner is what needs to change.
- **The image config is frozen: `gemini-3-pro-image` at 2K, 1:1, 2 candidates per slot.** Evidence, costs and caveats in `docs/DECISION-image-config.md`. The candidate count is 2 rather than §5.4's 3 because pro's measured cost puts three on a five-slot reel outside the budget envelope below.
- Background removal to transparent cutouts only when clean: quality gate (alpha-edge heuristics + editor preview), fallback to full-frame image in a framed/card template when doubtful.
- Panel shows 2–4 candidates per slot with pick / regenerate-with-tweak / write-own-prompt controls before placement. Editor approval is part of the standard flow. The generated default is 2 (`DECISION-image-config.md`); a mode may raise it via `imageCandidates`.
- **Images sit in the top-left corner** (user ruling, Block 7 session 9 and again 2026-08-29). In a vertical talking-head reel the corner is reliably empty and the only thing an image must avoid is the speaker's face. The square is anchored at `TOP_LEFT_MARGIN` and grows until it meets either the speaker's left edge or the top of his head, whichever leaves the larger picture. **Every slot takes that whole size.** Two bounds hold by construction and are asserted per slot, by the builder and by `npm run place:images`: it never touches the face mask plus `HEAD_CLEARANCE`, and never leaves the frame.
- **Every picture in a reel is the same size, and that size is the smallest any of its slots can hold** (user ruling, 2026-08-29). Removing size jitter was not enough: `vitasilk` still came out **937, 837, 905, 925 and 913 px**, because one slot is bounded by the space *beside* the speaker where the other four are bounded by the space *above* him. That difference is real geometry rather than a defect, and it does not matter — on screen it reads as inconsistency. **A consistent set is worth more than a marginally larger one**, the same judgement behind the corner ruling and behind positional jitter, and adjudicating between geometry and jitter is not the user's job. `reelPlacements` is the one declaration, read by the builder, by `npm run place:images` and by the panel's image picker, so the three cannot disagree about the size a build will place. `vitasilk` is **five pictures at 837 px**; `test-1` is four at 917.
- **The risk is that one tight slot shrinks the whole reel**, and it is reported rather than hidden: `npm run place:images` prints each slot's own maximum beside the common size and what each gives up. On the corpus today nothing comes out small — 837 px and 917 px against a `MIN_PLACED_SHORT_EDGE` floor of 324 — but `vitasilk` gives up 68 to 100 px on four of five slots to match `img002`. The three reels with no slots planned yet have no common size until they have slots.
- **Jitter varies position, not size** (user ruling, 2026-08-29, replacing Block 7 session 9's size jitter). He watched a build whose five pictures came out **912, 801, 852, 917 and 871 px** and read it as a mistake: **sizes varying between consecutive images read as inconsistency, not as variation.** A picture nudged a few pixels reads as variation instead. `TOP_LEFT_POSITION_JITTER` is 0.02 of frame width — up to **43 px**, small against the 65 px margin so the image still reads as being in the corner. **The move holds by construction rather than by a clamp**: a square bounded above the speaker may only move right, because sliding it sideways cannot change that it sits above him, and one bounded beside him may only move down; the second axis is measured after the first has been applied. Sizes are now **905–937 px on four of `vitasilk`'s five slots**, with `img002` at 837 because the space beside the speaker is genuinely smaller than the space above him — a real difference in the footage, not jitter.
- **Placing images in the largest free band around the face was tried and rejected** (2026-08-29). Block 8 session 33 moved them off the corner on the strength of `benchmarks/RESULTS-block8-image-placement.md`; the user saw the build and ruled the corner back. **The measurement is kept and is not wrong** — it is why the next person should not repeat the move: the band's advantage was **not the reposition**. The corner rule was converting a width fraction to a height fraction by multiplying by the frame's aspect ratio instead of dividing, which understated the room above the speaker's head by **327 px** and held the corner to 749–818 px. With the conversion corrected the corner holds **837–937 px** — the same figures the band measurement reported — so the size the move was made for was available in the corner all along. He asked for the pictures bigger, not moved.
- **`imageScale` 1.4 is not reachable and the shortfall is not the placement's.** It asks for 1076–1172 px; the largest face-clearing square anywhere on the frame is 765–937. Past this, size costs something a rule cannot decide: letting a picture bleed off the frame edge, spending `HEAD_CLEARANCE`, or overlapping the speaker. `imageScale` stays a client-mode value and clamps rather than overlapping anything.

### SFX
- ~5 local files in a repo folder. Mapping is deterministic: each template's manifest declares which SFX fires at which offset. No AI at runtime. SFX set is global, not per-mode.
- **Keywords are silent** (user ruling, 2026-08-29). He built a reel, heard the hits on the emphasised words and ruled them out: the sound fought the animation rather than supporting it. `kw_slam` and `kw_slam_ar` declare `sfx: []`; `hit_01` and `hit_02` stay in the index as measured files a later block may want. **Only images make a sound**, and it is a whoosh.
- **A sound's peak lands on the template's impact frame**, not its first sample. `hit_01`'s peak is 2.05 s into the file, so the old rule — start the file at the card plus 0.13 s — put its impact about two seconds late on every build. Every anchor and gain is measured from the audio by `npm run sfx:measure` and written back into `assets/sfx/sfx.json`; nothing about a sound's timing is typed by hand.
- **The mix makes room; the sounds are not turned down.** Every reel is delivered at 0.0–0.2 dBFS true peak, so *any* finite sfx level sums past 0 dBFS — a hit 40 dB down still clips. The dialogue is attenuated by the smallest amount that keeps the sum under `MIX_CEILING_DBFS` (−1.0 dBFS, chosen), which lands at 3.1–4.0 dB across the corpus, and the balance the offsets describe is untouched because everything comes down together.
- **A sound that cannot reach its impact frame in time is placed anyway**, because After Effects honours a layer starting before the composition — observed, not assumed. The lead-in outside the comp costs 31.2 dB below the sound's own peak on the one case that needs it, so no transient is lost.

### Watermark
- One QuickTime file **with an alpha channel** (not MP4 — corrected during foundation), same for all clients, stored in the repo, overlaid starting at frame 0, fixed duration.
- **Three sizes, picked per reel: `small` 216 x 242 px, `medium` 324 x 363, `large` 432 x 484** on a 2160 x 3840 frame (user ruling, 2026-08-29). `small` is the width every build before that date placed, so the size he has already seen is the one he can go back to; **`medium` is the default**, which means a plan written before the choice existed shows a mark half again as large on its next build. It is a per-reel field on the Edit Plan beside the on/off control, surfaced in the panel's Build step. The 108 px inset is measured from the near edge, so it holds at every size in every corner — asserted, not assumed.
- **Measured, Block 7 session 1**, and the TODO this line used to carry is closed: `assets/watermark/intro.mov` is **ProRes 4444 (`ap4h`), `yuva444p12le`**, 1924 × 2154 with square pixels, **2.035367 s = 61 frames at 30000/1001**, bt709 throughout, with **premultiplied-against-black alpha** — established by measuring 439,105 partial-alpha pixels against both hypotheses, where 0.0000% violate premultiplied and 100% violate straight. It carries **audio that is not silent** (three beeps, the last ending at 0.400 s). ExtendScript sets `AlphaMode.PREMULTIPLIED` on import, verified by reading it back from After Effects.
- **It runs a flat second** (user ruling, after seeing it built), not "one second after the last beep". The beep measurement is kept and repurposed: a future file whose beeps run past the mark fails loudly rather than being cut mid-beep.
- **Inset 108 px from both edges** (user ruling, 2026-08-29), measured from the near edge so it holds in whichever corner the seeded draw lands on.

### Client modes
- A mode is a versioned JSON file in the repo: client name, color palette, fonts, image-generation style (style prompt fragments + negative prompts), allowed template variants per element type, logo asset path, client-specific vocabulary (fed to transcription as key terms).
- **A client is a person the agency works for, not a palette** (user ruling, 2026-08-29). It also carries **`videoFolder`** — where their footage lives, which is what fills the video list — plus `about` (his one line about them), `logoPath`, `pictures`, `language`, `subtitleBaselineY`, `videoShape` and `watermarkByDefault`. **Every one is optional and every blank takes the value in force before the field existed**, declared once in `core/src/client-defaults.ts`, so a client with nothing but a name and a folder behaves exactly as `k2-syndicalia` does. **`videoShape` is recorded and not yet acted on**: placement, watermark inset and safe width are all derived from a vertical frame.
- **A client can be created from the panel** (`POST /clients`), through the same validator `npm run validate:modes` uses. A **one-off** — a video for someone he will not work with again — is the same form, shorter, and is not added to the client list.
- **A client's own pictures are chosen by hand and never leave the machine.** `pictures` is `{ id, path, description }` in his words; they appear in the picture editor beside the generated candidates, are **never sent to any model** and are **never copied into a cache**, both asserted by test. **Automatic matching is not attempted** — deciding that "the clinic exterior" is what a moment wants is the same judgement as knowing a clock reads quarter past, which is the open image-prompt defect.
- **The file's own `note` is the maintainer's and never reaches the screen.** What the panel shows about a client is `about`, plus the palette as swatches and the fonts set in their own face.
- Global (not per-mode): subtitle position, subtitle base style, SFX set.
- First mode: **K2 Syndicalia** — palette `#1A0000`, `#820000`, `#C9A96E`, `#F8F6F2`. Fonts and further visual identity: provided by the user at Block 9; do not invent them.

## 6. Architecture (summary — full detail in ARCHITECTURE.md)

Three cooperating pieces, one repo:

1. **CEP panel** in AE (CEP, not UXP — UXP is not production-ready for AE in 2026; CEP runs natively on Apple Silicon). React + TypeScript. The panel is the entire UX: pick video, pick mode, run pipeline, edit transcript, toggle keywords, review image candidates, adjust zones, Build comp.
   Branding: the panel is **Framopia Studio**, dark-first (charcoal/near-black), brand red `#ED1C24` as the single accent, white/neutral grays for text, logo at `assets/brand/Framopia_LOGO.png` (white with red accent, 962×1077, transparent). Clean modern typography, generous spacing, clear pipeline-progress states, RTL-aware Arabic rendering in the transcript editor. Visual polish is a deliverable of the CEP block, not a nice-to-have. The brand palette styles the tool's UI; client-mode palettes style the video content. Never mix the two.
   **The panel is one screen** (user ruling, 2026-08-29, replacing the five-step rail): the wordmark, one readiness line with the machine facts behind **Details**, **Client**, **Video** with Refresh and Browse, **Cost**, **Run pipeline** — the one red control — **Build the composition** beneath it, and three openers under *Change something first* leading to the transcript, keyword and picture editors. He does not fill in a form: he presses Run, presses Build, watches the comp and comes back to change the one thing that bothered him. Base type is **17px**; one column at every width.
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
