Status: OK

# Block 7 session 1 — housekeeping, the image cache fix, the watermark measured

Spent **$0.00**. No Gemini call, no ElevenLabs call, no billable request of any
kind. The cost ledger is byte-identical at both ends of the session:
**108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.

All four hard stop conditions passed before any work began: the T7 Shield was
mounted and the working directory confirmed at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`; the ledger matched on both
line count and hash; `main` and `origin/main` were both at `4608f84` with a
clean tree apart from the untracked `handoffs/block-6.md`.

## Done

### Goal 1 — the Block 6 handoff

`handoffs/block-6.md` existed on disk, 120 lines, untracked. Committed by
itself, no other file in the commit: `docs: add block 6 handoff` (`25ca3fa`).

### Goal 2 — the frame rate sweep

**The goal's premise was wrong and the sweep is what found it.** PROJECT_SPEC
§4 was *not* the last document carrying 30 fps. The repo-wide grep for
`30 fps` / `30fps` / `fps: 30` / `= 30` / `29.97` / `30000/1001` returned hits
in four categories.

**Wrong and fixed — live documents (4 sites, 3 files):**

| file | site | was | now |
|---|---|---|---|
| `docs/PROJECT_SPEC.md` | §4 Input | `30 fps` | `29.97 fps (30000/1001)` with the reason |
| `docs/TEMPLATE_BUILD_SPEC.md` | §2 comp settings | `30 fps` | `29.97 fps (30000/1001)` |
| `docs/TEMPLATE_BUILD_SPEC.md` | §2 frame-rate note | a paragraph reasoning *from* the pre-amendment guide | rewritten |
| `docs/TEMPLATE_LIBRARY_GUIDE.md` | §9 validation list | `comp fps ≠ 30` | `comp fps ≠ 29.97 (30 is rejected — see §3)` |
| `docs/TEMPLATE_LIBRARY_GUIDE.md` | §10 worked example | `2160×600, 30 fps` | `2160×1100, 29.97 fps` |

The build spec's paragraph is the one that mattered most. It read "The build
spec keeps 30 fps because that is what the guide fixes and what the comps are
authored at" — both halves false since Block 6: guide §3 was amended to 29.97,
and the six built comps are 29.97 (`templates/library.audit.json` records
29.9700012207031 on all six). Left as it was, it told the next person to build
a comp that `npm run validate:templates` rejects. Two of these sites also
carried `2160×600`, which guide §3 amended to `2160×1100` in Block 6 session 8;
corrected in the same pass, since both sites claim to restate §3 and were
misquoting it.

**Correct as written — code (no change made, and none needed):**
`core/src/templates.ts` declares `REQUIRED_FPS = 29.97` with a tolerance and
rejects 30 by name; `core/src/templates.test.ts` uses 30 only as the *rejected*
case. **No code constant asserts 30 anywhere.** The `fps: 30` occurrences in
`service/src/analysis/assign.test.ts` and `service/src/images/job*.test.ts` are
test fixtures whose value is arbitrary, not assertions about the footage. The
comment at `service/src/frames/sample.ts:218` ("Half a source frame at 30 fps")
is an approximation inside an epsilon argument and is not load-bearing;
reported here, not changed.

**Correct as written — measurements and generated output:**
`benchmarks/RESULTS-block2-robustness.md`, `RESULTS-block6-timing-budget.md`,
`templates/library.audit.json`, `service/src/analysis/timing-budget*.ts`,
`tools/cv/tests/test_zones.py` all state 29.97 or 30000/1001 correctly.

**Wrong and deliberately left — historical records:** every hit under
`handoffs/` and `reports/` (including `reports/latest.md`, which is a copy of
the Block 6 session 8 report). A handoff or a session report states what was
true when it was written; rewriting one would destroy the record of the error
being corrected. `benchmarks/RESULTS-block3-final.md:235`'s "at 30 fps" is a
past measurement and is left for the same reason.

Commits: `docs: correct the input frame rate in the project spec` (`0670aa8`),
`docs: align the guide and build spec with the built comps` (`d209e4f`).

### Goal 3 — the image cache fingerprint

**Step 1 — the current inputs, verbatim.**

`service/src/images/fingerprint.ts` hashed, in fixed order:
`prompt`, `negativePrompt`, `modelId`, `resolution`, `aspectRatio`,
`candidateIndex`, `modeId`, **`modeVersion`**.

`service/src/analysis/fingerprint.ts` hashes two sets, both in fixed order.
Keywords: `promptVersion`, `geminiModel`, `modeId`, `modeHash`
(`keywordModeContentHash` = `contentHash([mode.name, mode.vocabulary])`),
`transcriptHash`, `candidateCount`. Slots: the same six with `modeHash` =
`slotModeContentHash` = `contentHash([mode.name])`.

**Step 2 — what the image call actually reads from the mode.** Enumerated by
grepping every `mode.` reference under `service/src/images/`:

- `mode.imageStyle.stylePrompt`, `mode.palette`, `mode.imageVariation.axes` —
  reach the request **only** through `slot.prompt`, which is hashed verbatim.
- `mode.imageStyle.negativePrompt` — only through `slot.negativePrompt`, also
  hashed verbatim.
- `mode.imageCandidates` (`job.ts:87`) — sets *how many* candidates. Each entry
  already keys on `candidateIndex`, so changing the count cannot change
  candidate k's bytes.
- `mode.vocabulary` (`job.ts:165`) — read **after** generation, by the local
  OCR correctness check. Not a generation input.
- `mode.id` — kept, for namespacing.
- `mode.name`, `mode.fonts`, `mode.allowedTemplates` — never read by this path.

So the conclusion, and it is stronger than the analysis case: **a mode content
hash here would be redundant.** The analysis stages need one because their
prompts are assembled *inside* the call out of mode fields nothing else keys
on. This call's entire mode contribution is two strings that are already in the
key. Any mode edit capable of changing the generated bytes changes one of those
strings; one that changes neither cannot have changed the bytes. The key is now
the seven fields above with `modeVersion` removed.

The old comment's justification is also wrong on its own terms and is recorded
as such at the new one: "a mode bump that changes nothing in this slot's prompt
still has to invalidate, because it may have changed what the next slot draws"
— but that next slot's own prompt then changes, so it misses on its own key,
while this slot's cached bytes remain the right answer to this slot's unchanged
request.

**Step 3 — blast radius, counted before anything changed.** 14 image cache
entries, all under one video hash
(`99dfe0e530ab85d12e2c5e756dc907dca09c75f1257e2bdded28e32795327e72`, vitasilk).
Ten at `modeVersion` 5 (the Block 4 session 6 production run,
`gemini-3-pro-image`) and four at `modeVersion` 3 (the Block 4 session 3
bake-off, three flash and one pro). Summing the `costUsd` each manifest
records: **$2.064064** of billed API spend on disk. That is larger than the
~$1.55 the Block 6 handoff quoted, which counted only the ten production
images.

**Step 4 — migration.** The manifests record every fingerprint input **except
`aspectRatio`**, which is not stored. Rather than assume it, the migration
*recovers* it: it recomputes the pre-Block-7 key from the manifest plus each
value in `ALLOWED_ASPECT_RATIOS` and requires the result to reproduce the
directory name exactly. **14 of 14 reproduced at `1:1`**, so every input is
known rather than guessed, and the stop condition did not fire.

Dry run first, printing all 14 old→new mappings and refusing to write; then
`--apply`. All 14 renamed, **0 images regenerated, $0.00 billed**, no bytes
touched. `tools/migrate-image-cache/cli.ts`, wired to
`npm run migrate:image-cache`. It exits 1 without renaming anything if any
entry fails to reproduce, and refuses to overwrite an existing destination.

**Verified, not asserted:** recomputing the current fingerprint for all five
vitasilk slots × 2 candidates against mode **v6** finds **10 hit, 0 miss**. The
$1.550444 production run is recovered. The four bake-off entries still miss,
and correctly — their prompts were composed at mode v3 and the request has
genuinely changed.

**Step 5 — tests.** `service/src/images/fingerprint.test.ts` gained
`survives a mode version bump that changes nothing the call reads` (bump the
version *and* add a template id ⇒ **same** key — the assertion the whole fix
exists for) and `invalidates when a mode edit reaches the composed prompt`.
`service/src/images/generate.test.ts`'s
`regenerates when the mode version bumps` asserted the defect; it is inverted to
`serves the cache across a mode version bump the prompts do not see`, checking
0 client requests, 4 cached images and $0.00, and a new sibling test proves a
prompt change still regenerates all four.

**Step 6 — ledger after this goal: 108 lines, sha256 `50ec3f57…`. Unchanged.**

Commits: `fix: key the image cache on the request, not the mode version`
(`3f71c1e`), `chore: re-key existing image cache entries onto the new
fingerprint` (`24fd589`).

### Goal 4 — the watermark file

Source `/Volumes/T7 Shield/Framopia/Brand/Logos/Tititit.mov`: **22,969,368
bytes** as expected, sha256
`99edc6499392f2e72ce3df83b5a0f6a69246b7ab57f1b44c97092e8b8811886e`. **Read
only — never moved, renamed, modified or deleted.**

Copied to `assets/watermark/intro.mov`; the copy's sha256 matches the source
exactly. `.gitignore` already carried `!assets/watermark/*.mov` negating its
`*.mov` rule, so no ignore change was needed. **This puts 21.9 MiB of binary
into git in a single commit**, stated plainly rather than slipped in:
`chore: add the watermark intro asset (23 MB ProRes 4444)` (`68c56fa`).

`tools/measure-watermark/cli.ts` mirrors `tools/validate-templates/`'s
structure and is wired to `npm run watermark:measure`. It requires `ffprobe`
and `ffmpeg` on PATH and exits 1 naming the missing one. It **emits** every
claim into `benchmarks/RESULTS-block7-watermark.md`; nothing about this file is
hand-typed into a document. No new dependency was added.

Measured:

| | |
|---|---|
| container | QuickTime / MOV, 3 streams |
| codec | ProRes 4444 (`ap4h`), profile 4444 |
| size | 1924 × 2154 |
| duration | **2.035367 s**, **61 frames** |
| `r_frame_rate` / `avg_frame_rate` | **30000/1001** / 30000/1001 |
| `pix_fmt` | `yuva444p12le`, 12 bits per raw sample |
| alpha plane present | **yes** |
| SAR | 1:1 — pixels **are** square; DAR 962:1077 |
| colour primaries / transfer / matrix | bt709 / bt709 / bt709 |
| audio | pcm_s16le (`sowt`), 2ch stereo, 48000 Hz, s16 |
| timecode | one `tmcd` data stream |

Alpha-plane presence is taken from `ffprobe -show_pixel_formats`' explicit
`alpha` flag, not pattern-matched on the format name — a ProRes 4444 file can
be written without a plane and `4444` in the profile string proves nothing.

**Three findings that change what the builder does.**

**1. The frame rate is 30000/1001**, the same as every source reel. The overlay
lands on the timeline with no rate conversion. Finder's `00:02` hides 61
frames; the real length is 2.035367 s.

**2. The audio is NOT silent.** `volumedetect` reports **mean_volume −18.3 dB,
max_volume −0.5 dB** — a full-level stereo sound, not a stray DC offset. The
watermark carries audio and the build has to decide whether to keep it,
attenuate it, or drop it. Nothing in PROJECT_SPEC §4's output list or
ARCHITECTURE §2 anticipates watermark audio.

**3. The alpha is premultiplied against black — and the measurement separates
the hypotheses rather than assuming they separate.** Across all 61 frames:
137,068,362 fully transparent pixels (54.2196%), 112,775,460 fully opaque
(44.6102%), **2,958,234 partial** (1.1702%). So the alpha is *not* binary and
the straight-vs-premultiplied question is live and testable.

Over the 439,105 partial pixels on nine frames spanning the clip
(0, 8, 15, 23, 30, 38, 45, 53, 60), with a 2-level tolerance for the
12-bit→8-bit and YUV→RGB round trip: **0.0000% violate the premultiplied
prediction, 100.0000% violate the straight one; largest excess over alpha 0
levels of 255.**

That figure alone would not be evidence, and the tool says so. Dark colour
never exceeds its alpha under *either* reading, so a premultiplied verdict on
dark artwork would describe the artwork, not the file. The separation check:
mean max(r,g,b) over 16,774,277 fully opaque pixels is **252.7 of 255** — the
artwork is essentially white — so under a straight reading a half-transparent
edge pixel would still carry near-255 colour. It carries **0.9854** of its
alpha instead. The colour has been multiplied in. Below a chosen threshold of
128 mean opaque brightness (CHOSEN, NOT MEASURED — the midpoint, on the
`RENDERED_LIGHT_LUMA` precedent) the tool reports **undecided** rather than
taking the larger number.

Consequence: import as premultiplied. Reading it as straight would divide out
an alpha that was never multiplied in and brighten the logo edge.

**4. The artwork is full-bleed.** The union of the per-frame non-zero-alpha
bounding box over all 61 frames is x 0–1923, y 0–2153 — the whole 1924 × 2154
frame. It is not a centred lockup and the file carries no margin of its own to
crop to. The per-frame table is in the results file.

PROJECT_SPEC §5's watermark TODO was **not** amended, as instructed, and
nothing was imported into After Effects.

Commits: `feat: add a watermark measurement tool` (`b7c015d`),
`docs: record the measured watermark properties` (`3f99d8f`).

### Session end

`CLAUDE.md` updated in the same session: the two new npm scripts, the
`assets/watermark/` line changed from "not started" to record the asset, and a
new "Block 7 session 1" section.

## Deviations

1. **Goal 2 was widened from one document to four sites in three.** The goal
   said PROJECT_SPEC §4 "is believed to be the last document carrying the wrong
   figure" and asked me to verify the belief rather than assume it. Verifying
   it refuted it. Amending only PROJECT_SPEC would have satisfied the letter of
   the instruction while leaving a live build brief telling the user to author
   comps the validator rejects. Done as a **separate commit** from the named
   one so the record is clear.

2. **Two of those sites also carried the superseded comp size `2160×600`.** The
   instruction scoped goal 2 to the frame rate. I corrected the size in the same
   two sites because both explicitly claim to restate TEMPLATE_LIBRARY_GUIDE §3
   ("Per TEMPLATE_LIBRARY_GUIDE §3:") and were misquoting it — fixing a misquote
   is not a new ruling. It is called out here rather than left to be found.

3. **Goal 3's fix removes the mode from the key rather than replacing it with a
   content hash.** The instruction anticipated an `imageModeContentHash` on the
   analysis precedent and said to be conservative. Enumerating the read set
   showed every candidate field already in the key as prompt text, so a content
   hash could only ever differ when `prompt` or `negativePrompt` already differ
   — redundant at best, and actively harmful in one case: an axis value removed
   that *this* slot never drew would invalidate a still-correct image. Reasoning
   recorded in full at the top of `fingerprint.ts` and in Goal 3 step 2 above.
   Had a content hash over palette/style/axes been used instead, the four Block
   4 session 3 bake-off entries would have been unmigratable.

## Failures & open problems

- **No ExtendScript was written and nothing was built in After Effects.** By
  design — this session was scoped as housekeeping — but it means Block 6's
  largest gap is untouched: **nothing has ever retimed a comp.** `outroS: 0`,
  the 29.97 fps comp on a 29.97 fps timeline, the baseline anchor at y 2480.4
  and whether a solid `IMG_MAIN` accepts a replaced source are all still
  assertions, not observations.

- **The watermark's audio is an unanswered product question.** It is
  full-level (max −0.5 dB) and no document says what to do with it. Not a
  defect; a decision that does not exist yet.

- **The alpha verdict has not been checked visually.** It is a measurement over
  439,105 pixels on 9 of 61 frames with an explicit separation test, which is
  strong, but no one has composited the file over a light and a dark background
  and looked at the edge. The measurement predicts what that check will show;
  it does not substitute for it.

- **The migration is verified for vitasilk and only vitasilk.** Ten of ten
  entries hit under mode v6, proven by recomputing the fingerprint against the
  stored plan. The four bake-off entries miss by design. No other reel has any
  image cache entry, so there is nothing else to verify — but equally, the
  migration has only ever been exercised against one video hash.

- **`npm run images` was not re-run.** Re-running it would have proven the hits
  through the production path rather than by recomputation, but a miss would
  have billed, and this session was required to cost $0.00. The recomputation
  uses the same exported `imageFingerprintOf` the stage calls, so the risk is
  narrow, but it is not the same as having run it.

- **`tools/migrate-image-cache/` is one-shot code that has now run.** It is
  committed rather than discarded so that a migration which happened leaves a
  record, but it is not covered by `npm run check` and has no unit tests. Its
  safety comes from refusing to act unless the old key reproduces.

- **`tools/measure-watermark/` likewise has no unit tests** and is not run by
  `npm run check`. It is a measurement tool over a fixed committed asset; the
  asset's sha256 is emitted into its own output, so a changed file produces a
  visibly different report.

- Carried forward untouched from Block 6, none of them addressed here: whole-
  term grouping is unimplemented (11 §6 terms render split); the pipeline is
  4K-only; `assertRenderable` no longer guards anything and `assets/sfx/`
  is still a stub with no audio files; `npm run validate-plan` reports 11
  duration failures where `npm run timing-budget` reports 7 (**trust the 7**).

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing:
  `docs: record block 7 session 1 in the operating memory`.
  **This report's own commit follows it** — a report cannot name the commit
  that contains it.
- Commits this session, in order: `docs: add block 6 handoff`; `docs: correct
  the input frame rate in the project spec`; `docs: align the guide and build
  spec with the built comps`; `fix: key the image cache on the request, not the
  mode version`; `chore: re-key existing image cache entries onto the new
  fingerprint`; `feat: add a watermark measurement tool`; `chore: add the
  watermark intro asset (23 MB ProRes 4444)`; `docs: record the measured
  watermark properties`; `docs: record block 7 session 1 in the operating
  memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript tests **930 passed**
  across 65 files (core 145 / 6 files, service 619 / 43 files, benchmarks
  166 / 16 files); Python **141 passed**. Modes, templates manifest and
  `validate-templates` all ok; all four references verified
  `v1.0.8-conformant`; both model pins verified.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — identical
  to the start-of-session values. **Nothing billed.**
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

Build the smallest thing that turns an assertion into an observation: place one
`sub_pop` instance on one reel over `DoScript` into a running After Effects and
look at it. That single act settles four things this repo currently only
believes — that `outroS: 0` retimes correctly with no outro phase, that a 29.97
comp lands on a 29.97 timeline without drift, that the baseline anchor at
y 2480.4 puts type where Block 6 session 3's arithmetic says it does, and that a
solid `IMG_MAIN` accepts a replaced source. Do it before writing any more of the
builder, because each of those four is load-bearing for code that does not exist
yet, and `-r` is known not to work on this machine so the ExtendScript has to be
shaped around `DoScript` from the start. The watermark is ready to be placed
whenever the geometry ruling arrives; its audio needs a decision at the same
time.
