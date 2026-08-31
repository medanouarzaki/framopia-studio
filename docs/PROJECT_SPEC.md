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
3. **An overlong card is broken if it can be, and shrunk only if it cannot.**
   It never clips at the safe width. A card with a space to break at goes onto
   **two lines at its authored size**; a single word with nowhere to break has
   its type scaled down, on its own card, until the widest line fits.

   **Amended 2026-08-30 (user ruling), replacing "never wraps to a second
   line".** He saw a build made under the first reading, where every overlong
   card was forced onto one line and shrunk, and ruled against it on
   `test-1`'s keyword `محفزات الكولاجين`: at ×0.5589 it came out **56% the
   height of the ordinary cards around it**, wide and thin and smaller than the
   subtitle beside it. A keyword is meant to be the largest thing on screen, so
   shrinking one inverts what it is for. Breaking costs nothing, because
   `SUBTITLE_BAND` was always derived for `MAX_SUBTITLE_LINES` = 2 and the
   first baseline does not move.

   Measured across the corpus: 9 of 338 cards exceed `SUBTITLE_SAFE_WIDTH`.
   **Two have a break point** — both two-word Arabic keyword spans — and take
   two lines at full size; **seven are single words** and shrink, worst case
   ×0.9122. Implemented in `panel/jsx/text-fit.jsx` (`framopiaFitCard`, the
   measuring) and `core/src/card-fit.ts` (the policy and the refusal); every
   decision is taken on a width After Effects measured, and a card that cannot
   be brought under the bound fails the build by name.

   **A card must fit its card comp in both directions** (measured 2026-08-31,
   Block 10 session 21). The width half has been ruled since Block 8; its twin
   was never written down, and never checked — `assertEveryCardFits` asked
   `widthAfterPx <= safeWidthPx` and nothing asked anything about height. That
   is why a clipped card reached the user rather than a test, while 17,170
   golden fields matched.

   **The height rule, as measured.** A card comp is **2160 × 1100** and is
   rasterised at its own bounds, so anything outside them is not drawn. The
   first baseline rests at **y = 700** and the entrance animates Position from
   **750** down to it, so a card sits 50 px lower on its way in; the shadow copy
   is offset a further **+15** by its Transform effect, which `sourceRectAtTime`
   does not include at either `extents` setting. A card is cut when
   `750 + inkTop + inkHeight + 15` passes 1100.

   **Two lines cost `LINE_SPACING` = 323 px, and almost nothing has that much
   room.** Across the corpus's 262 cards: 260 are one line with **178.3 px of
   headroom at worst**, and the two that break are both `kw_slam_ar` — Almarai
   at 455 — reaching 1196.7 px and cut by **96.7 px**. Per template, the worst
   card's headroom if it were broken: `sub_pop_ar` at 367 −144.7, `kw_slam` at
   494.742 −127.0, `kw_slam_ar` at 455 −80.4, `sub_pop` at 343 −62.0. **One line
   never overruns in this corpus**; the shortest Latin words at 343 have 335 px
   and are the only cards with room for a second line at all.

   **The fix is the user's**: the card comps get taller in
   `templates/library.aep`, which only he edits. **Option D — letting the card
   draw outside its comp via the master layer's collapse — was tried and
   rejected on measurement**: it recovers the strip, and it also changes the
   card's whole body by up to 230 levels, so it does not preserve the look.

   **The comps are 1250 tall and the type is back at a first baseline of 700, and
   the cards fit** (2026-08-31). `test-1` `k002` and `test-2` `k002` each reach
   **1198.8 px in a 1250 comp — 51.2 px of headroom**; they are the corpus's only
   two-line cards and the next tightest card anywhere has 326.2 px. All four
   buildable reels build, 262 cards, none overrunning.

   It took two edits because **After Effects re-centres a comp's contents when the
   canvas grows**. Height alone moved the type down 75 px — half the 150 added —
   so 1250 left the same cards 23.8 px short; putting the baseline back at 700
   recovered exactly that 75.

   **The type has not moved on screen at any point**, measured rather than
   assumed: the builder places an instance as `target − (placeholder − anchor)`,
   and the baseline reads **2480.39990234375** inside After Effects in every
   state, exactly `SUBTITLE_ANCHOR_BASELINE_Y`. What did move is the comp layer's
   own Position, 2330.4 → 2405.4, because the comp's internal geometry changed —
   **all 524 differing golden fields are that one field and no other kind.**

   **The library is settled as of 2026-08-31.** Moving the text layer back had not
   undone AE's scaling of the *separate* Transform effect on `TXT_MAIN_SHADOW`;
   setting that effect's Position to **[1088, 640]** against its Anchor Point of
   [1080, 625] restored the ruled **[8, 15]** on all four comps. `SUBTITLE_BAND`'s
   bottom is 3012.57825 again, the three tests pass on their own with none edited,
   and the two-line cards' headroom went 51.2 → **53.3 px**. `npm run check` and
   `npm run golden` are both green.

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
- **Always at the top of the frame, never the bottom** (user ruling, 2026-08-31). Only the two top corners are candidates; the seeded draw still chooses between them, and the 108 px inset and the three sizes are unchanged. **This was not already true when the ruling was made.** Both bottom corners were candidates and nothing ruled them out — the subtitle band spans y 0.516–0.785 while a bottom corner sits at y 0.877–0.972, so a bottom corner was taken whenever the shuffle landed there: **93 of 200 seeds**, and in the corpus **`test-1` built its mark at y 3550.6 of 3840**. Guarded in two places, because a placement rule and a built comp are different claims: `watermark.test.ts` asserts no seed can produce a bottom corner, and the census derives `watermarksBelowMidFrame` from the built master so a low mark fails `npm run golden`.

### Client modes
- A mode is a versioned JSON file in the repo: client name, color palette, fonts, image-generation style (style prompt fragments + negative prompts), allowed template variants per element type, logo asset path, client-specific vocabulary (fed to transcription as key terms).
- **A client is a person the agency works for, not a palette** (user ruling, 2026-08-29). It also carries **`videoFolder`** — where their footage lives, which is what fills the video list — plus `about` (his one line about them), `logoPath`, `pictures`, `language`, `subtitleBaselineY`, `videoShape` and `watermarkByDefault`. **Every one is optional and every blank takes the value in force before the field existed**, declared once in `core/src/client-defaults.ts`, so a client with nothing but a name and a folder behaves exactly as `k2-syndicalia` does. **`videoShape` is recorded and not yet acted on**: placement, watermark inset and safe width are all derived from a vertical frame.
- **What a client's logo may be** (ruling, 2026-08-31; decision recorded here because **no authority for it existed anywhere in the repository** — the video list is mirrored from `service/src/clients/videos.ts` and pinned by a test, and nothing equivalent had been written down for still images). The intended logo is a **PNG with a transparent background**; the field also accepts `psd, ai, eps, tif, tiff, tga, jpg, jpeg, gif, bmp`. Declared once in `panel/src/still-formats.ts`, which is what the file dialog filters on. **A client's own photographs are judged against the same set** (2026-08-31): it is the same question — a still After Effects imports and the panel may have to draw — and narrowing it for photographs would refuse a file the build can place, on no evidence. **The panel can only draw png, jpg, jpeg, gif and bmp**, so a legitimate `.psd` is accepted and the screen says it cannot be previewed rather than showing a broken image — the distinction matters because **the only consumer of `logoPath` today is the panel's client card**; no build places it.
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


## 10. Rulings and product decisions, moved here from CLAUDE.md

The sections below were written one session at a time in `CLAUDE.md`, which
grew to 530,588 characters — three and a half times the size at which it is
read whole. Block 10 session 28 moved them here **verbatim**, wording and
figures untouched, so that a session looking for how something works finds it
in the document it would already open. Nothing was summarised and nothing was
dropped; `git show 1c8c850:CLAUDE.md` is the file as it stood before the move.


### K2 Syndicalia is a real client, and a reel is built against a copy of it

**The user supplied the brand document at Block 9 session 2 and the mode is
version 8.** Three faces, all installed on both machines: **Inter Semi-Bold**
for ordinary words, **Cormorant Garamond SemiBold Italic** for emphasized ones,
**Almarai Bold** for Arabic. `fonts.emphasis` is a **third, optional** face —
`buildFonts` returns the ordinary Latin one when a client has none, and reports
which in `emphasisSource`, so a two-face client builds exactly as before.

**The faces are recorded family-and-style as one string**, the representation
`LATIN_FONT` and `ARABIC_FONT` already use. **Not a PostScript name**: After
Effects reports its own as `Inter-SemiBold` and `Almarai-Bold`, and **nothing in
this project has ever written `TextDocument.font`**, so resolving one form to
the other is a measurement to take inside After Effects.

**`EMPHASIS_SIZE_RATIO` is 1.0 and is CHOSEN, NOT MEASURED — and near-certainly
wrong.** Cormorant is an old-style serif and sets optically much smaller than
Inter at the same nominal size. The right number comes from `sourceRectAtTime`,
which is the same measurement shrink-to-fit needs. `ARABIC_SIZE_RATIO` 1.07 was
measured against Inter and is now **unverified against Cormorant**; both facts
are stated where the constants are declared.

**`textColours` records which palette role carries which kind of word** —
`light` for ordinary, `accent` for emphasis, both **optional with a default**
that is what every build has drawn. It is the brand's own chart stated literally:
crème for body, Or Signature for the key figure of a sentence. **Nothing reads it
at build time yet**: a subtitle's colour lives in the template comp and
`framopiaSetText` sets only the string.

**The palette gained names, not values**: Noir Abyssal `#1A0000` the ground,
Blanc Cassé/Crème `#F8F6F2` text, Or Signature `#C9A96E` highlights and emphasis,
Rouge K2 `#820000` used sparingly. The four hexes are unchanged.

**`vocabulary` is deliberately still `[]`.** The brand document is full of terms
— Loi 18-00, CNDP, copropriété, syndic, assemblée générale, recouvrement — and
they key the keyword cache **and** reach Scribe as keyterms, so adding them is a
billable decision. `imageStyle` and `imageVariation` are untouched for the same
reason: editing either strands generated images.

**The 7 → 8 bump invalidated nothing, and that was measured before it was made.**
Transcription never reads the mode; keywords key on `contentHash([name,
vocabulary])`, slots on `contentHash([name])`, and images on the composed prompt
strings with **no mode version and no mode hash** since Block 7 session 1. All
three hashes, all 18 image keys and all five reels' dry runs were byte-identical
across the bump, and the 36-entry cache census was unchanged.

**A reel is built against a snapshot, not a pointer.** `plan.clientSnapshot` — a
**schema addition, optional with a default** — carries the client's palette,
faces, colour roles and `imageScale` as they stood when the video was attached.
`resolveClientIdentity` in `service/src/build/client-identity.ts` is the one
declaration of which look a build uses, read by the builder and by `steps.ts` so
the panel cannot say one thing while the build does another. The order is:
`--mode` wins because someone typed it, then the reel's own copy, then the live
mode file — **and the fallback is reported, never assumed**, because a build
quietly reading a mode file is the failure the copy exists to prevent.

A reel approved in March must rebuild in June as it was approved; of the two
possible failures, a rebuild that silently disagrees with what was approved
cannot be noticed, while one deliberately out of date can be, and can be moved
forward with one control. Block 10's golden run needs a fixed input for the same
reason. **Moving a reel forward is `POST /client-snapshot`, a control someone
presses — never automatic.** The panel says *"Built with K2 Syndicalia's look as
it was when this video was set up"* and, when the client has moved on, offers
*"Use the client's look as it is now"*. No version numbers on screen.

**A client's own pictures are deliberately not in the snapshot**: they are paths
to files chosen by hand, and a pinned path breaks the moment one is moved.

`npm run migrate:client-snapshot [-- --apply]` — free, local. Pins every plan
that names a client. **It does not read through `readEditPlan`**, per the
standing schema rule, changes exactly `clientSnapshot`, and asserts that by
comparing the file before and after. Run: **`test-1`, `test-2` and `vitasilk`
pinned to K2 Syndicalia v8; `ground-truth` and `test-3` left alone**, because
their analysis never ran and nothing on disk says which client they belong to.

### Nothing typed that can be chosen

**User ruling, 2026-08-31**, given while setting up a client for the first time
and stated for the **whole product**, not that screen: no path is ever typed or
pasted, every path is chosen through a macOS dialog. A path is something the
machine already knows how to find, and asking a person to reproduce one
character for character is asking him to do the machine's work and to get it
wrong.

**Two typed path fields existed** — the client setup screen's *Video folder* and
*Logo* — and both are choosers now. **The video picker was already right**: its
typed field went in Block 8 session 44, and its `showOpenDialogEx` is what both
new choosers call. `chooseDirectory` is that call's second argument, so a folder
chooser and a file chooser are one implementation; `pickFolder` and
`pickImageFile` join `pickVideoFile` in `panel/src/file-dialog.ts`.

**A cancel leaves the field alone.** All three return null both for a cancel and
for a host with no dialog, and null means *he chose nothing*, never *clear it*.
The path is still shown beneath the button, and the field falls back to text on
a host with no chooser — with a sentence saying why, because that host is a real
case for the second machine.

`panel/src/path-fields.test.ts` pins the rule by reading every `.tsx`: a text
input whose label names a path fails unless it is `PathField`'s own fallback.

### What each palette colour actually does

**The captions on the client screens described the picture frame and nothing
else, and two of the four were wrong.** They read *behind a cut-out picture* /
*the deeper of the two frame colours* / *the frame around a picture* / *the
lighter of the two frame colours* — while in every comp this system has built,
`light` is the colour of **ordinary subtitle words** and `accent` the colour of
**emphasised keywords**. Those are the two most visible uses of any colour in
the product and neither appeared in a caption.

Measured in Block 10 session 18, from the code and then from four real builds:

| role | hex | what it actually does |
|---|---|---|
| `light` | `#F8F6F2` | **254 ordinary subtitle words** across the corpus; the frame drawn round **all five** of `vitasilk`'s pictures |
| `accent` | `#C9A96E` | **8 emphasised keyword words**; **can never be a picture frame** |
| `background` | `#1A0000` | the ground **baked behind a cut-out** — `#1A0000` at all four corners of `img002-c1.cutout.on-fill.png`; the frame on a picture bright enough for the dark one to win |
| `primary` | `#820000` | **the shadow copy behind every word** — 262 layers across the corpus |

**The picture frame is not fixed to a role.** `cardFrameColour` takes whichever
role separates best from the picture's own edge, so the frame is chosen per
picture. Swept over every edge luminance against K2's palette, **only `light`
and `background` can ever win** — a mid-tone loses to both extremes, so `accent`
and `primary` can never be a frame at all.

**The 262 shadow layers took the templates' own `#820000` until 2026-08-31.**
The colour is baked into the four text comps, the build never set it, and it
equalled K2's `primary` only by coincidence of the brand — so every other client
got K2's red behind their words with nothing saying so. **See the section below**
for the ruling that fixed it. All four roles are also named in
`imageStyle.stylePrompt`, so all four shape the generated pictures.

**One stale comment found doing this**: `core/src/text-colours.ts` says "Nothing
reads this at build time yet". It is read — `textStyleFor` calls
`resolveTextColours` and sets `fillColor` on every placeholder, which is where
the 254 and the 8 come from. Corrected.

`core/src/palette-meaning.ts` is the one declaration of the captions and their
order, read by the client card and the setup screen, which were two copies. It
imports nothing, and `PALETTE_ROLES` moved into it with `mode.ts` re-exporting —
the panel reads it, and `mode.ts` reaches `node:crypto` and `node:fs`, which
esbuild cannot resolve for a browser target. Same reason `build-stamp` is its
own subpath.

**The two subtitle colours come first** on screen: they are on every card of
every video, and the other two only touch pictures.

### The shadow follows the client, not the template

**User ruling, 2026-08-31**, by the person who authored the templates: **the
shadow copy behind every word takes the client's deeper colour**, the `primary`
role. He chose it over a fifth swatch on the client screen and over leaving the
templates' fixed red.

**`textColours.shadow` already existed as an unused optional role** and is what
carries it — no parallel mechanism. What changed is its default: absent used to
mean *leave the template's colour alone*, and now means `primary`. K2 names the
role explicitly anyway, so all three pinned snapshots already carry
`shadow: 'primary'` and none reports itself behind.

`resolveTextColours` → `textStyleFor` → `TextStyle.shadowFillColor` → the
duplicated instance's shadow layer, which is the same route the placeholder's
own fill already took. **The library is never touched**: `build-reel.jsx` works
on `template.duplicate()`, and `templates/library.aep`'s sha256 is unchanged.

**The build reads the colour back and refuses if it did not take**, comparing
against what was asked and checking `applyFill` — a carried fill that is not
applied draws nothing. This is the pair of layers Block 9 session 8 found one
build away from carrying the template's placeholder word on every card, so a
property reaching one and not the other is a defect already paid for once.

**K2's output is byte-identical, and that is the check the ruling turns on.**
K2's `primary` is `#820000`, exactly what the templates carry, so `npm run
golden` passes with **4 of 4 reels matched and zero differing fields out of
17,170** — twice, before and after the caption change. The reference was not
re-recorded; if it had needed to be, the change would have been wrong.

**And it was shown adapting**, which passing an identical-value check does not
prove on its own: `test-2` built against a scratch client whose `primary` is
`#00A0FF` came out with **all 67 shadow layers in that colour** — `kw_slam` 1,
`kw_slam_ar` 2, `sub_pop` 59, `sub_pop_ar` 5 — while the placeholders kept crème
and gold. The scratch plan lived outside the repository and no real plan or mode
file was touched.

### A client's own photographs are on the client screen

**User ruling, 2026-08-31**: they are added where a client is set up, not in the
picture editor half-way through a video. Everything else had existed since Block
9 — `POST /clients/pictures` and its DELETE, the schema, and the picture editor
offering them per slot beside the generated candidates — and **the only missing
piece was a control that called it**. That was the last thing in ordinary use the
panel could not do.

`panel/src/ClientPictures.tsx` is the one component, on **both** client screens,
because two would drift:

- **The setup form**, where the client does not exist yet, so there is no
  `/clients/pictures` to call: the list is held on the form and travels with the
  client. `buildClient` numbers them with the same `nextPictureId` `addPicture`
  uses, and both go through one `checkPicture` — absolute path, file really
  there, a description. A setup screen accepting what the client card refuses
  would write a client file the panel could not have made twice.
- **The client card**, for a client already saved, where each change goes to the
  service and the client list is **re-read from it** afterwards.
  `CatalogueMode.pictures` carries them; **absent means a service older than the
  panel**, which is not a client with none, so the editor is not rendered at all
  rather than offering a route that is not there.

**The photograph is chosen, never typed** — `pickImageFile`, the same
`showOpenDialogEx` the video and logo pickers use — and judged against
`panel/src/still-formats.ts`, the one declaration of what a still may be, shared
with the logo. A `.psd` is accepted and reported as unpreviewable; a `.mov` is
refused by name before he can add it.

**Forgetting is forgetting, and the screen says so**: *"Forgetting a photo leaves
the file itself exactly where it is."* Nothing copies the file and nothing
deletes it.

**Driven end to end against the real service, 2026-08-31**: the built panel added
a photograph to **K2 Syndicalia**, the thumbnail drew from the file itself
(962x1077 decoded), the picture then appeared on **all five** of `vitasilk`'s
slots in the picture editor with a Use control, and Forget removed it —
`modes/k2-syndicalia.json` **byte-identical at both ends**, `sha c600905c…`, and
no plan touched. Observed in Playwright's Chromium launched with the host's own
file and cross-origin allowances, **not inside CEP**.

### What a client's logo may be

**Ruling, 2026-08-31**: a PNG with a transparent background is intended, and the
field also takes the other still-image formats After Effects imports.
**No authority for that set existed anywhere in the repository** — the video list
is mirrored from `service/src/clients/videos.ts` and pinned by a test, and
nothing equivalent had been written down for stills — so it is recorded as a
decision in `docs/PROJECT_SPEC.md` §5 and declared once in
`panel/src/still-formats.ts`, which the dialog filters on — the same set governs
a client's own photographs.

**The panel can draw only png, jpg, jpeg, gif and bmp.** A `.psd` is a
legitimate choice and still cannot be shown, so the screen says which of the two
happened the moment he picks — not at build time three steps later. That
distinction exists because **the only consumer of `logoPath` today is the panel's
client card**; no build places it.

### The client setup screen finishes a client

**Three more rulings from the same sitting**, all his, all built rather than
described because he judges by looking.

**Fonts are a list, and the names are After Effects' own.** `GET /fonts` drives
the running instance through `runFontList` — `panel/jsx/font-list.jsx`, which
reads `app.fonts.allFonts` and **never writes a font name**, because setting one
that is not installed pollutes that list for the rest of the application
session. **445 families, 1188 distinct names**, and a list built from macOS
would be wrong: it publishes `Inter-Regular_SemiBold` where After Effects wants
`Inter-SemiBold`. **A list that cannot be built is said out loud** and the field
falls back to text — an empty chooser and an unfillable one look identical and
mean opposite things.

**Subtitle height is a slider over a real frame** (he chose this over named
presets and over a typed number). `GET /subtitle-preview` finds a frame the
pipeline already extracted, and the line is drawn at `baselineY / 3840` of the
preview's height. **The preview says what it is showing** — the reel a real
frame came from, or that it is a plain frame when a client has no footage — and
states the scale, because a 2160 × 3840 frame drawn 216 px wide would otherwise
misrepresent a position silently. The number follows the slider, stays visible
and stays editable; blank still means `SUBTITLE_ANCHOR_BASELINE_Y`, read from
the constant.

**The four colours are on the screen.** *"Colours and their own pictures are
added afterwards, once the client exists"* made setting up a client take two
visits, which is a design mistake rather than a missing nicety. Each colour is a
swatch he picks with its hex beside it, labelled with the role in the words the
client card already uses. **The defaults are what a client with no colours gets
today** — the service inherits the template client's palette — so a client saved
without touching them is identical to one saved before, and this screen produces
K2's four ruled values exactly. Verified against `buildClient` both ways.
**Their own pictures genuinely do come later**: one is chosen per video, against
the moment it illustrates, and there is nothing to point at until a client has
footage.

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

### The emphasis ratio is ruled; the Arabic one is still the user's eye

**`EMPHASIS_SIZE_RATIO` is 1.1641, from cap height — RULED BY THE USER on
2026-08-30.** He was built `vitasilk` twice from one plan, once at 1.3479 and
once at 1.1641, differing in that number and nothing else, and he chose the
smaller. **Where a measurement and the user's eye disagree, his eye decides** —
the same principle that settled `IMPACT_THRESHOLD`.

Measured through `sourceRectAtTime`, Inter-SemiBold against
CormorantGaramondItalic-SemiBoldItalic. Every quantity is identical at 343 and
at 425 to five decimal places, so each is a property of the faces rather than of
a size.

| quantity | ratio | |
|---|---:|---|
| **cap height, rendered `H`** | **1.1641** | **ruled** |
| x-height, rendered `x` | 1.3479 | what the derivation preferred |
| advance width, one word / a phrase | 1.3562 / 1.3730 | |

**`chooseRatio` still refuses cap height** on the numbers alone, 16.5% from
advance, and is still right to: **the gate exists to stop an underived number
reaching the code, not to overrule a ruling.** `RULED_EMPHASIS_QUANTITY` is the
named way past it and nothing else has one; `font-ratios.test.ts` pins the
constant against a derivation from that quantity, so a re-measurement that moved
cap height fails rather than leaving a stale number.

**What the derivation preferred, and why it lost:**

x-height wins because **the corpus is lowercase** — one Arabizi or French word
per card — and advance width, an independent measure of the same thing, lands
within 1.2% of it. Cap height is the outlier because Cormorant is an old-style
face whose capitals are large against its lowercase. Two measures agreeing
against one is the reason.

**The gate is `chooseRatio` in `core/src/font-ratios.ts`, and it tests the
quantity that is written.** Session 5 reported "one word 1.35622 against phrase
1.37296, 1.234% apart, passed" beside a written value of 1.3479 — which lies
outside both, because those are **advance widths** and the value is an
**x-height**. The gate passed and had tested nothing about the number next to
it. What it checks now: the chosen quantity is the same at both sizes, and an
independent quantity agrees within 3%. x-height 1.34790 against advance 1.35622
is **0.617% apart**. The same gate **refuses cap height**, 16.5% from advance,
and refuses an advance corroboration taken on different strings — which is the
Arabic case, where Inter was measured on `glow` and Almarai on `شنو`.

**`ARABIC_SIZE_RATIO` stays 1.07 and was not overwritten.** The metrics do not
reproduce it — cap height gives 1.0161 and x-height 1.0300 — but 1.07 came from
the user's eye on a delivered reel, and a metric ratio is not evidence his eye
was wrong. Lowering every Arabic word on every build by 4% is a change he should
see before it happens. **Cormorant does not bear on it**: the Arabic companion
is sized against the ordinary Latin face, and an Arabic keyword takes
`kw_slam_ar`, which is Almarai again, so the emphasis face never sits beside
Arabic.

### The client's `note` is the maintainer's and never reaches the screen

The panel printed it under the client picker for a session: *"Stub. The palette
is locked (PROJECT_SPEC §5); vocabulary is deliberately empty…"* — developer
prose on a motion designer's screen. `note` stays in the file for whoever edits
it; **`about` is his line** — "Dr Jenna, dermatologist, Casablanca" — and is the
only text about a client the panel shows.

**What he sees instead is the client.** `ClientCard` paints the four palette
colours as swatches labelled by what each does in a build, the two fonts set in
their own face, the logo when there is one, and a line saying which values are
his and which are the standard ones — read from `clientDefaults`, which already
told them apart. It sits between two pickers, so it stays four swatches, two
lines of type and one line of text.

### A client is a person, and their folder is where the videos come from

**User ruling, 2026-08-29.** A client was a palette; it is now who the agency
works for. `ClientMode` gains **`videoFolder`, `logoPath`, `pictures`,
`language`, `subtitleBaselineY`, `videoShape` and `watermarkByDefault`**, every
one **optional with a default**, and `core/src/client-defaults.ts` is the one
declaration of what a blank means:

| field | blank means | which is |
|---|---|---|
| `language` | `mixed` | what every corpus reel is |
| `videoShape` | `vertical` | 2160 x 3840, what everything assumes — **recorded, not yet acted on** |
| `watermarkByDefault` | `true` | what every build has done; the per-video control still overrides |
| `subtitleBaselineY` | `SUBTITLE_ANCHOR_BASELINE_Y` | where every build has put it |
| `fonts` | the standard pair | Inter Semi-Bold and Almarai Bold |
| `videoFolder` | `benchmarks/footage.json` | so the five corpus reels list as they did |

`k2-syndicalia` carries **none** of them and is asserted unchanged at version 7,
so `vitasilk` builds identically.

**`POST /clients` makes one from the panel**, through `validateMode` before it
reaches disk. It inherits the **style half** of `k2-syndicalia` — the palette,
the prompt fragments, the variation axes — by named field and not by spread: a
spread carried K2's own `note` onto every new client. A **one-off** is the same
form with the client-only fields hidden.

**Client comes before Video on screen**, because the client decides which videos
exist. `GET /reels?client=` lists their folder; **Refresh re-reads it and
nothing watches the disk** — the T7 is not always plugged in, and a watcher
would have to decide what to do every time it vanished. A missing folder reads
as *"plug it in and press Refresh"*, a fact about the disk rather than a fault.
`GET /video?path=` opens one from anywhere. **A file the tool will not offer says
why** (`old.wmv — this tool does not open .wmv files`) rather than vanishing.

### The client's own pictures are chosen by hand, and never leave the machine

`ClientMode.pictures` is a list of `{ id, path, description }` — his words, "the
clinic exterior" — offered in the picture editor beside the generated
candidates. `ImageSlot.chosenClientPictureId` is a **schema addition, optional
with a default**, is a **human-flagged marker** so a re-run cannot discard it,
and **wins over `chosenCandidateId`**: he pointed at a photograph.

**Two properties, both asserted rather than described.** A client's picture is
**never sent anywhere** — a test reads every file in `service/src/images/` and
fails if one mentions it, because a doctor's patient results do not go to an
image model. And it is **never copied**: `core/src/client-pictures.ts` writes no
file and names no cache path, checked with the comments stripped.

**What actually broke was the shape.** Every generated image is 2048x2048, so
the builder scaled by width and the height followed for free; a phone's
3024x4032 at a 1000 px width draws **1333 px tall inside a 1200 px comp**, over
the top and the bottom and far outside the 1080 px frame. `fitByLongEdge` fits
the long edge instead, so the whole picture lands inside the box at any shape
and **nothing is cropped** — cropping a photograph a doctor chose is the tool
deciding which half of her results matter. On a square it is the same arithmetic
as before.

**Automatic matching is not attempted, and waits on Block 9.** Deciding that
"the clinic exterior" is what a moment wants is the same judgement as knowing a
clock reads quarter past rather than five minutes, which is the open
image-prompt defect in `docs/DECISION-image-config.md`.

### The panel is one screen, not a five-step form

**User ruling, 2026-08-29**, after session 41 rewrote the words and changed
nothing for him: *"You should reconsider everything... think about user
experience."* The decisive fact, which he gave when asked how he works: *"I will
click on Run and then Build and then see the results, and if there is a problem,
I will change it."*

**He is not filling in a form.** The five-step rail is gone. One screen, top to
bottom: the wordmark, **one readiness line**, Video, Client, Cost, **Run
pipeline**, **Build the composition** directly beneath it, and a row of three —
**Words**, **Emphasis**, **Pictures**, each with its count — under *Change
something first*. The three editors are unchanged in content and behaviour; only
how they are reached changed, and each opens over the main screen with Back.

**Readiness is one word.** ffmpeg, ffprobe, the picture tools, the Node path,
the template count, the service pid and who started it all moved behind
**Details** — none of them changes what he does next while everything works.
**A real problem comes forward** on the main screen as a sentence with what to
do about it, because then it is the only thing that matters.

**The type scale is 17px**, up from 13. Everything else is in `em`, so one
number moves the whole panel; headings are 0.62em uppercase, secondary text
0.72–0.85em, the spend figure 1.05em.

**The two-column layout above 830 px is retired** (supersedes the session 9
ruling): the screen is short enough not to need it and a docked panel is a
column. `panel/src/panel-width.ts` is deleted. One column at every width from
380 to 1920, with nothing overflowing, asserted in a real browser.

**Picking a video always shows the main screen.** `panel/src/steps.ts` — the
remembered-step store, `stepViews`, `reconcileStep`, `openingStep` and the
`framopia.panel.last-step` key — is deleted with its tests. The behaviour it
produced, landing on Build after choosing a video, must not come back in another
form.

**The Client picker is a `<select>`**, so the next session's "Set up a new
client…" entry is an added option and moves nothing else on the screen.

### The panel is written in his words, not the code's

**User ruling, 2026-08-29**, after he had used all five steps: the panel *"shows
so many technical words that are hard, that I don't know what he means by
them."* He named `alpha_edge_noise 0.0897 > 0.02`, `hole_ratio`, `edge_halo`,
`gate rejected`, `cacheProvenance`, `img003 11.62-13.96s card z_left_4
img_float`, `stage: service-lost`, `retryable: yes` and `HTTP 404 from
/images?reel=vitasilk`.

Four rules, in force for any string this project puts on screen:

- **A field name is not a label.** `cacheProvenance`, `k001`, `g022`,
  `kw_slam_ar`, `img003` are names from the code.
- **A number belongs on screen only if it changes a decision he could make.**
  `0.0897 > 0.02` does not; `912 px` does and stays.
- **Say the consequence, not the mechanism.** Not `HTTP 404 from /images` but
  "there is nothing here for this reel yet".
- **A string that answers no question he could ask is deleted, not reworded.**
  The keyword picker's source line carried five facts, four of them ids, and now
  says whether the words were chosen for him or are waiting on him.

Kept deliberately, because they are evidence a dozen sessions paid for: sizes in
pixels, costs in dollars, which service answered and when, the file a build
wrote, and every buildability issue by name.

### Every picture in a reel is one size, and the watermark has three

**A reel picks one image size and it is the smallest any of its slots can hold**
(user ruling, 2026-08-29). Session 36 removed size jitter and `vitasilk` still
came out 937/837/905/925/913 px, because `img002` is bounded by the space
*beside* the speaker where the other four are bounded by the space *above* him.
That is real geometry and it does not matter — on screen it reads as
inconsistency. `reelPlacements` in `service/src/placement/top-left.ts` is the one
declaration, read by the builder, `npm run place:images` and the panel's image
picker, so the three cannot disagree about the size a build will place.
**`vitasilk` is five pictures at 837 px; `test-1` is four at 917.** The risk is
that one tight slot shrinks the whole reel, so the report prints each slot's own
maximum beside the common size and what each gives up.

**Positional jitter is unchanged and still holds by construction** at the common
size: a slot bounded above may move right, one bounded beside may move down, and
the second axis is measured after the first.

**The watermark has three sizes — `small` 216 x 242 px, `medium` 324 x 363,
`large` 432 x 484 — and `medium` is the default.** `small` is what every build
before this ruling placed. `Watermark.size` is a **schema addition, optional
with a default**; `POST /watermark` takes `enabled`, `size`, or both, and the
panel's Build step shows three buttons beside the checkbox. **An existing plan
records no size, so its next build shows a mark 1.5x the last one.** The 108 px
inset is measured from the near edge and holds at every size in every corner,
asserted by test.

**Neither watermark field is a human-flagged item, and neither needs to be.**
`clearBlocks` clears keywords, images and sfx and never touches
`plan.watermark`, so a re-run cannot lose either setting. Flagging them would be
worse than useless: `PlanMergeBlockedError` throws whenever a flag is present,
so any reel whose watermark had been set would refuse an ordinary
re-transcription until it was forced. A merge test pins the survival.
