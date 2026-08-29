# Handoff — Block 8, part 2: the CEP panel

Date: 2026-08-29 · Conversation model: Claude Opus · Sessions run: 11–45 (35)

Part 1 is `handoffs/block-8-part-1.md` (sessions 1–10: the alignment defect, the
review sheet, the aligner fix, the panel scaffold and the service handshake).
This document covers part 2 and closes the block.

---

## 1. Status vs BLOCKS.md

**Block 8's definition of done had two halves. One is met and one is not.**

### "UI passes the user's eye for a polished product" — **MET**

He has used every part of it and ruled on it. Approved: the one-screen layout
and the order of it, the 17px type, the words on screen, the client card, the
file dialog, and every editor behind it.

### "A full reel goes video-in → built comp entirely from the panel with no terminal involvement" — **NOT MET**

**Frame analysis is reported, never driven.** Image placement reads the face
masks, and producing them means `npm run frames` and `npm run segment` — the
Python sidecar, minutes per reel. The pipeline runner names those commands
rather than running them (`zonesNotDriven`), a decision taken deliberately in
session 17 and never revisited. **So a video that has never been through the
sidecar cannot be taken end to end from the panel.**

Since session 39 it no longer *silently* builds a wrong comp — the build refuses
and names the command — but refusing is not driving, and the DoD says driving.

Two more inputs are terminal-only for the same reason:

- **`npm run watermark:measure`** → `.local/build/watermark.json`. Without it the
  builder places **no watermark at all**. It is gitignored, so a fresh clone
  starts in that state.
- **`plan.source.dialogueLufs`**, written only by
  `npm run migrate:sfx-placement`. A newly transcribed video has none, so the
  mix attenuates nothing and every sound clips.

**Everything else in the deliverable list exists.** The zone editor is the one
item answered rather than built, and deliberately: automatic image placement
stopped reading zones in Block 7 session 9, so a list of zones would have been a
control over a decision nobody makes. What replaced it is the picture editor's
line saying how large each picture is and what limits it.

---

## 2. What the panel is now

One screen. He does not fill in a form: **he presses Run, presses Build, watches
the comp, and comes back to change the one thing that bothered him.** That
sentence is the whole design and it was only learned in session 42, after a
five-step rail had been built and rejected.

| | |
|---|---|
| header | wordmark and version |
| **readiness** | a dot and one word — *Ready* — with **Details** holding ffmpeg, ffprobe, the picture tools, the Node path, the template count, which service answered and when, and whether this host has a file dialog. A real problem comes forward as a sentence with what to do about it. |
| **Client** | the picker, with *Set up a new client…* and *Just this video…* at its foot, and a card below showing the palette as swatches, both fonts set in their own face, the logo, and one line of his own |
| **Video** | the client's folder, with **Refresh** and **Browse…** |
| **Cost** | what this video has cost, and what a run would cost |
| **Run pipeline** | the one red control |
| **Build the composition** | beneath it, outlined, with the watermark switch and its three sizes, the fonts a build will use, what the comp will contain, and what happened after |
| **Change something first** | Words · Emphasis · Pictures, each with its count, opening the three editors over the main screen |

**Client comes before Video** because the client's folder is what fills the video
list. **Refresh is a button and nothing watches the disk**: the T7 is not always
plugged in, and a watcher would have to decide what to do every time it vanished
— a class of behaviour worth getting right for something more than one click.

Base type 17px, one column at every width from 380 to 1920 px, nothing
overflowing. `#ED1C24` is spent on Run pipeline alone, focus rings included.

---

## 3. Every ruling the user made, with its reason

A ruling without its reason is a ruling someone will reverse. In date order.

### Alignment and text

1. **Adopt the transliteration-aware aligner** (2026-08-28, session 12). Under a
   flat cost every cross-script pair scores exactly 1, so a run of them ties and
   the backtrace's arbitrary preference decided the reel. Scoring `من`/`mn` at
   0.2 against `من`/`ghir` at 1 moved **16 of the 18 pairings he had marked
   wrong and none of the 54 he had marked correct**. `ACTIVE_ALIGN_COST_MODEL`
   is `transliteration`; the flat model stays selectable because every figure
   recorded before that date was measured with it.
   *Superseded: the flat cost model, and Block 7's discarded same-script fix.*

2. **A multi-word §6 term occupies one card together** (session 20). Recorded in
   PROJECT_SPEC §3 and **not implemented**: it needs a term source the project
   does not have. Three identical analysis calls returned three different term
   sets and two of them broke a term the orthography guide names verbatim.

3. **A card stays tight to its word; the animation compresses** (session 20).
   This *ratifies* Block 7's entrance compression, so **the 23 clipped holds are
   a decision and not an open defect. There is nothing to build.**

4. **An overlong word shrinks to fit** (session 20) — never clipped, never
   wrapped. Not implemented: it needs `sourceRectAtTime` inside After Effects,
   and the fonts Block 9 collects. The panel's character count at
   `OVERLONG_WORD_CHARS = 11` is a proxy and says so.

### Sound

5. **`IMPACT_THRESHOLD` is 0.90** (session 26). All six comps cross at **4.06
   frames** against the settle's 12.00 and a linear reading's 10.80. His own
   figure was frame 4, a threshold of 0.8966; 0.90 is within a sixteenth of a
   frame and is a round number rather than one fitted to a single curve. **Where
   a measurement and the author of the animation disagree by less than two
   frames, the author decides.**
   *Superseded: placing sound on the settle frame, which was 8 frames late.*

6. **The hits are removed entirely** (session 27). He built a reel, heard them,
   and ruled that the sound fought the animation rather than supporting it.
   Keywords are silent; only images make a sound. The files and their
   measurements stay in the index — they are measured facts and a later block
   may want them. **Events across the corpus went 15 → 7.**
   *Superseded: hit variation and hit spacing, both deleted rather than flagged off.*

7. **A sound that would arrive late is dropped, then un-dropped.** Session 27
   dropped a whoosh that could not reach its impact frame — *a sound that is
   audibly wrong is worse than no sound*. Session 29 established that **After
   Effects honours a negative layer `startTime`**, observed rather than assumed,
   so the sound keeps its lead-in outside the composition and the refusal path
   was **retired rather than left guarding a case that cannot arise**.

8. **The mix makes room; the sounds are not turned down** (session 26). Every
   reel is delivered at 0.0–0.2 dBFS true peak, so `20·log10(1 + 10^(s/20))`
   exceeds 0 dBFS for **every finite** sfx level — a hit 40 dB down still clips.
   The dialogue comes down by the smallest amount that works, 3.1–4.0 dB.

### Images

9. **Images sit in the top-left corner** (Block 7 session 9, ruled again in
   session 34). Session 33 moved them to the largest free band around the face
   and he reverted it: *he asked for them bigger, not moved*. And the move
   bought nothing — the corner rule had a units bug understating the room above
   his head by **327 px**, and with it fixed the corner holds the same sizes the
   band did.
   *Superseded: the band placement, kept in `RESULTS-block8-image-placement.md`
   so nobody repeats it.*

10. **Jitter varies position, not size** (session 36). Five pictures at 912,
    801, 852, 917 and 871 px read as a mistake rather than as variation. Up to
    43 px of movement, one-sided and inward, holding by construction.

11. **Every picture in a video is one size, the smallest any slot can hold**
    (session 37). Removing size jitter was not enough: geometry still spread
    them, because one slot is bounded by the space *beside* him where the rest
    are bounded by the space *above*. **Consistent is worth more than
    marginally larger.** `vitasilk` is five pictures at 837 px.

12. **The frame contrasts with what actually meets it** (sessions 25 and 34).
    Every generated picture measures 0.0019–0.0266 luminance at its edge, so a
    dark frame vanished — 1.03:1. The colour is derived at WCAG 2.1's 3:1
    minimum for a non-text boundary, **adopted from the standard, not chosen
    here**. For a cut-out it is measured against the *lit part of the subject*,
    because a cut-out's own edge is transparent.

13. **A cut-out gets a ground of its own** (session 35). `img_float` has two
    layers, and on a cut-out the card showed through the whole square: frame and
    fill were the same layer at 1.00:1 by construction. Two contrasts hold now.

14. **Eight images per thirty seconds** (session 35), up from 5.5.

15. **A client's own pictures are chosen by hand** (session 43), never sent
    anywhere and never copied. **Automatic matching is not attempted** and waits
    on the image-prompt defect.

### The watermark

16. **A flat second** (session 11), replacing "one second after the last beep",
    once he had seen it built.
17. **Inset 108 px from both edges** (session 40), from 65 px at the side and
    205 px at the top.
18. **Three sizes, medium the default** (session 37): 216 × 242, 324 × 363,
    432 × 484. `small` is what every build before that date placed.
19. **On or off per video** (session 25), because the builder placed one
    whenever the asset was on disk — the same answer for every video.

### The panel

20. **One screen, not a five-step rail** (session 42). *"You should reconsider
    everything… think about user experience."* The decisive fact was how he
    works: Run, Build, watch, fix one thing.
    *Superseded: the rail, the remembered step, and the two-column layout above
    830 px, which was his own session 9 ruling.*
21. **A field name is not a label** (session 41), and **a number belongs on
    screen only if it changes a decision he could make**.
22. **Client before Video** (session 43), because the client decides which
    videos exist.
23. **Show the client, do not describe it** (session 44) — swatches and type
    samples, not the mode file's maintainer note.
24. **Browse only, no path field** (session 45), once the dialog was known to
    exist.

---

## 4. Constants that were chosen, not measured

**Twenty-eight sites carry the marker.** Every one is a judgement someone may
revisit; none is a measurement. The ones that decide something visible:

| constant | value | where |
|---|---|---|
| `IMPACT_THRESHOLD` | 0.90 | `core/src/impact-frame.ts` |
| `MIX_CEILING_DBFS` | −1.0 dBFS | `core/src/sfx-level.ts` |
| `SUBTITLE_SAFE_WIDTH` | 1940 px | `core/src/typography.ts` |
| `MAX_SUBTITLE_HOLD_S` | 1.2 s | `service/src/analysis/display-timing.ts` |
| `MIN_INTRO_S` | 2 frames | `service/src/build/short-card-constants.ts` |
| `TOP_LEFT_MARGIN` | 0.03 (65 px) | `service/src/placement/constants.ts` |
| `TOP_LEFT_POSITION_JITTER` | 0.02 (43 px) | same |
| `MIN_PLACED_SHORT_EDGE` | 0.15 (324 px) | same |
| `WATERMARK_WIDTH_FRACTION` | 0.1, × {1, 1.5, 2} | same |
| `WATERMARK_MARGIN_X/Y` | 108 px both | same |
| `CARD_EDGE_CLEARANCE`, `FILL_FRACTION`, `SCALE_JITTER` | | same |
| `PIPELINE_CEILING_USD` | $4 hard gate | `service/src/pipeline.ts` |
| `DEFAULT_CEILING_USD` | $3 | `service/src/images/config.ts` |
| `MAX_ENTRIES_PER_VIDEO` | 3 | `service/src/transcription/cache.ts` |
| `HEAD_THRESHOLD`, `HEAD_CLEARANCE`, `MIN_ZONE_SHORT_EDGE`, `BOTTOM_EXCLUSION` | | `tools/cv/framopia_cv/zones.py` |
| `GRID_DOWNSAMPLE`, `MAX_ZONES_PER_FRAME`, `MATCH_MIN_IOU` | | `tools/cv/framopia_cv/rects.py` |
| `SUBJECT_LIT_PERCENTILE` | 75th | `tools/cv/framopia_cv/edge_luminance.py` |
| `OVERLONG_WORD_CHARS` | 11 | a **proxy** for a width only AE can measure |

**`MIN_IMAGE_EDGE_CONTRAST = 3` is the exception**: adopted from WCAG 2.1, not
chosen here, and marked as such.

---

## 5. The defects that cost a session each, and what they share

This is the most valuable thing the block learned. Four shapes, and each one
cost a whole session — sometimes two.

### A check that cannot fail is not a check

`placementIsSafe(rect, faceBox)` took a nullable face box and answered
`clearsFace: true` when it was null. A video with no masks on disk therefore got
a **2030 px picture placed across the speaker's face on a 2160 px frame**, and
the check said it was safe. Found in session 38, fixed in 39 by making the face
box a **required** parameter, so it cannot be written that way again.

Its sibling: `expectedDimensions` returned null for a pair it could not derive,
and the caller read null as "no expectation" — silently disabling the check that
proved a paid image was the size it was paid for.

### A number typed rather than measured

Session reports carried **1775** TypeScript tests for two sessions running,
because each read it from the previous brief instead of the check output; the
real figure was 1778. The same shape produced the **166 pytest** figure quoted
for several sessions when pytest was 149 and 166 was the benchmarks workspace's
TypeScript count. And `docs/DEFECT-alignment-script-mismatch.md` carried figures
from three different cache entries for a whole block, because no artifact said
which entry produced which — one of them is still unattributable.

**The rule that came out of it:** every tool that selects among several possible
inputs prints what it selected *and writes it into whatever artifact it
produces*. Terminal output does not count; it scrolls away and is not committed.

### A claim about the host, made from a test engine

The panel's container query was dead text — `container-type` shipped in Chrome
105 and CEP runs **Chromium 99.0.4844.84** — while four headless assertions
passed, because Playwright's Chromium is three years newer than the host. The
capability denylist now gates the **built bundle**, not the source, because
esbuild at `--target=chrome99` passes an unsupported at-rule through without a
word.

The same shape, twice more: a test stubbed `window.CSInterface`, which CEP does
not provide, and the panel's pickers and logo were broken in After Effects while
the suite was green. And in session 44 the panel was told to look for
`window.cep.fs` rather than reason about it — because stubbing it here proves
nothing about his machine.

### An input whose absence produced a plausible wrong output

Six of them, found by walking the builder in session 39. Face masks absent →
a picture across the speaker. The watermark measurement absent → **no watermark
at all**, on a video whose plan asked for one. `dialogueLufs` absent → no
attenuation, and every sound clips. A `templateId` the manifest does not define
→ an entrance budget of **zero**.

All six refuse now, each naming itself, what the build would otherwise do, and
the command that produces it — and each is conditional on the thing it protects
actually being in the comp, because **a check that always fires is as wrong as
one that never can**.

### What they share

**Every one of them reported success.** None threw, none logged an error, and
in each case a green test suite stood behind a wrong result. The common cause is
a *default that stands in for an absent fact*: null read as "fine", a version
carried forward, a stub standing in for a host, a missing file read as "nothing
to do". The habit that catches them is to make the absent case **loud and
typed** — a required parameter, an emitted artifact, a denylist against the real
target, a refusal that names a command.

---

## 6. What is irreplaceable, and where it lives

**The test is not "expensive" — it is "no amount of money reproduces this
file".** Almost everything rebuilds: masks are bit-identical across runs,
extracted audio is ffmpeg, every report regenerates from disk.

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

**The finding was `.local/ground-truth/`** — four reels he transcribed by ear,
the WER baseline for the whole project, gitignored and therefore on one disk
with nothing anywhere saying so. The alignment references were the only
irreplaceable thing already safe.

**`npm run backup`** copies the lot into `My Drive/framopia-studio/`, re-reads
every file from the destination and hashes it, and fails the run on a mismatch.
It ran for real on 2026-08-29: **94 files, 53.3 MB, every hash verified**.

**`.local/config.json` is deliberately not in it.** It holds the ElevenLabs and
Gemini keys, and a cloud folder is a different risk from a dead disk — a key can
be reissued and the transcripts cannot. **He must keep that one file, 187 bytes,
wherever he keeps passwords.** The backup names it on screen every run rather
than omitting it quietly.

**Two limits it cannot see past:** Drive may evict the local bytes later, and
whether Google has finished *uploading* is not a filesystem fact. It refuses
outright when the sync client is not running — which is what happened the first
night, when 94 files went into a folder macOS had left behind from an uninstall
and nothing was syncing it.

---

## 7. The money

**The ledger did not move once in thirty-five sessions.** 108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`, byte-identical
at the start of session 11 and at the end of session 45. Every figure in this
block is measured from files already on disk.

All-time: **$10.968590** over 108 entries. Roughly **$8.04 of Gemini prepayment
credit remains**.

**`test-1`'s images — about $1.24 for 8 pictures — are approved in principle and
deliberately unspent.** The image prompt changes in Block 9: fidelity (the
picture is not what was asked for), darkness (87.4% of the average frame below
0.05 luminance) and literalness (five of nine moments call for the concrete
thing; three do not get it). Generating now means generating twice.

The cost of regenerating the corpus, if it is ever needed: **~$3.57 for all five
plans, ~$1.96 for `vitasilk` alone**, and the cascade is what makes it
expensive — a re-transcription returns different words, which misses keywords
and slots, which changes the slot ideas, which strands every generated image.

**The corpus is pinned at ORTHOGRAPHY_GUIDE v1.0.7 and correction prompt v4**
for exactly that reason. Re-transcribing is not reproducible, so it would
invalidate both hand-made references — the project's only non-circular measure
of aligner correctness, and impossible to regenerate at any price.

---

## 8. Repo state

`main`, HEAD at the time of writing is the commit before this handoff's own.
**566 commits**, all pushed.

**The corpus, measured today:**

| video | words | keywords | images | sounds | client |
|---|---:|---:|---:|---:|---|
| ground-truth | 76 | 0 | 0 | 0 | none recorded |
| test-1 | 67 | 2 | 4 | 4 | k2-syndicalia |
| test-2 | 69 | 3 | 0 | 0 | k2-syndicalia |
| test-3 | 58 | 0 | 0 | 0 | none recorded |
| vitasilk | 73 | 3 | 5 | 5 | k2-syndicalia |
| **corpus** | **343** | **8** | **9** | **9** | |

343 words, 343 cards, 23 with a clipped hold — which is a ruling, not a defect.

**`npm run check`**: core 469, service 1079, benchmarks 166, panel 154 (+2
skipped) — **1868 TypeScript tests** — plus **149 pytest**, the mode validator,
the panel manifest parse, the template validator and both pinned model
checksums. The Chromium 99 capability denylist passes against `panel/dist`.

**New top-level paths this block:** `panel/src/` grew from four modules to
nineteen; `service/src/clients/`, `service/src/backup/`,
`service/src/build/requirements.ts`, `core/src/client-defaults.ts`,
`core/src/client-pictures.ts`, `core/src/sfx-level.ts`,
`core/src/impact-crossing.ts`, `core/src/image-border.ts`.

**Deleted, with their tests, rather than left unreferenced:**
`panel/src/steps.ts`, `panel/src/panel-width.ts`, `core/src/sfx-variation.ts`.

---

## 9. Known issues and risks

In the order they should be picked up.

1. **Frame analysis is not driven from the panel.** This is the unmet half of
   the DoD. The smallest honest step is already done — the build refuses and
   names the commands; driving the sidecar from the runner is the rest, and it
   is minutes of wall clock per video with its own progress to report.
   *Cost: $0.00, one session.*

2. **`dialogueLufs` reaches a plan only through a migration.** It should be
   measured where the transcript is written. *Cost: $0.00, small.*

3. **The image prompt has three defects and they are one problem** — fidelity,
   darkness, literalness, all in `docs/DECISION-image-config.md` with a
   pasteable replacement written. **Test all three together**, because a prompt
   change is a billable regeneration. *Cost: ~$1.24 for `test-1`'s 8 images.*

4. **`videoShape` is recorded and not acted on.** A square or 16:9 client is
   still placed as vertical. *Cost: $0.00, but it touches placement, watermark
   inset and safe width.*

5. **Automatic matching of a client's own pictures** waits on (3).

6. **The three subtitle rulings are unimplemented**, all needing something the
   project does not have: a trustworthy term source, and `sourceRectAtTime` with
   the Block 9 fonts.

7. **`.local/build/watermark.json` is gitignored**, so a second machine starts
   with no watermark. Block 10.

8. **Headless building does not work on this machine.** Every AE operation goes
   through AppleScript `DoScript` into an already-running After Effects; a
   resident `-r` process was once observed executing its body a session later
   and quitting the application. That is Block 10's golden-run problem.

9. **The staleness check cannot see a service that started before the panel was
   ever built**, and cannot tell a service that is behind from one that is
   broken.

---

## 10. User inputs collected this block

- **Two hand-made alignment references**, `benchmarks/references/align/vitasilk.json`
  (73 rows judged) and `vitasilk.rereview.json` (17 rows). **The only
  non-circular measure of aligner correctness in the project**, and the reason
  the corpus is pinned.
- **`templates/library.audit.json`**, re-run twice at his hand — once for
  keyframe times, once for temporal easing. Without the second the impact frame
  was uncomputable.
- **`assets/sfx/`** — four audio files, and his gain targets.
- **`assets/watermark/intro.mov`** and `assets/brand/Framopia_LOGO.png`.
- **Every ruling in §3**, each recorded where the code that obeys it lives.

---

## 11. Exact next steps

1. **Open the next conversation on Block 9 — client modes for real.** Its first
   session should collect the K2 Syndicalia fonts and visual identity, which
   PROJECT_SPEC §5 has reserved for this block since the foundation and forbids
   inventing. The client schema is ready for them: `fonts` takes a real pair and
   `buildFonts` stops falling back.

2. **Then the image prompt**, all three defects at once, on `test-1`'s eight
   images for about $1.24.

3. **Frame analysis from the panel** closes Block 8's DoD and can be done in
   either order relative to (2); it costs nothing.

4. **Before any of it, `npm run backup`.** Google Drive was not running when
   this was written, and the tool refuses rather than pretending — which is
   itself the fix from session 40 doing its job.
