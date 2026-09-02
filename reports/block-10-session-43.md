# Block 10 session 43 — the audit that ran the product

**Status: PROBLEM — seven of eight new videos reached a built comp, and the
eighth was refused correctly, but four settings the panel collects when a client
is created reach nothing, one of them putting a watermark on a client who
switched it off.**

## How many new videos reached a built comp

**Eight videos that had never existed. Seven reached a saved `.aep`. One was
refused at Browse, correctly and with a message a motion designer can act on.**

| shape | why it is not in the corpus | got to |
|---|---|---|
| 3 seconds | shorter than any corpus reel (22.0 s is the shortest) | **built** |
| 90 seconds | longer than any corpus reel (40.5 s is the longest) | **built** |
| 1920×1080 landscape | every constant is written against 2160×3840 | **refused at Browse** |
| silent for the first 6.5 s | no corpus reel opens on silence | **built** |
| words 0.01 s apart | no corpus reel is that dense | **built** |
| one word | grouping and keyword selection have nothing to work with | **built** |
| no pictures at all | `test-2`/`test-3` have none, but they were never *planned* to have none | **built** |
| no keywords at all | every corpus reel has keywords | **built** |

The landscape refusal is the product working: *"this video is 1920 x 1080, and
this tool only builds 2160 x 3840 upright video. Everything it places — the
subtitles, the pictures, the watermark — is measured against that frame."* No
command, no jargon, and it says why.

**No request left the machine and nothing billed.** `globalThis.fetch` was
replaced with a function that records the URL and throws, so an un-stubbed call
would have been loud rather than silent: **0 attempts**. Every billable seam was
given a local substitute as well, the ledger was pointed at a scratch file, and
the real one is byte-identical at 145 lines. Each video was cut to its own
length with its own words, because the slot cache keys on the word *text* and
not the timings — session 41 caught two throwaway videos sharing an answer that
way, and each of these eight has its own transcript hash.

## The worst thing found

**A client created with the watermark switched off gets a watermark on every
reel.** `watermarkByDefault: false` is written to the client file, validated,
and shown back in the panel — and nothing in the pipeline or the build ever
reads it. The only writer of `plan.watermark` is the panel's per-reel watermark
toggle, and `watermarkEnabled(null)` returns **true** by design, because absent
was made to mean "nobody has said otherwise" for plans written before the field
existed. A new client's "no watermark" is exactly that absence.

Measured, not read: a scratch client with `watermarkByDefault: false` produced a
plan with `watermark: null`, and the built comp's layer 2 is `intro.mov` — the
mark, medium, top-left, out at 1.000 s. It reaches the delivered video.

**It is not alone.** Of the eleven things the New Client screen collects, four
reach nothing that builds a reel:

| setting | reaches a built reel? |
|---|---|
| `watermarkByDefault` | **no** — and it shows on the delivered video |
| `subtitleBaselineY` | **no** — `reel-plan.ts:152` uses the `SUBTITLE_ANCHOR_BASELINE_Y` constant |
| `videoShape` | **no** — read only by `clientDefaults` for display |
| `language` | **no** — templates are chosen from each word's script |
| palette, fonts, name, pictures, videoFolder | yes |
| `logoPath`, `about` | panel display only (session 40 found the logo) |

All four are written, validated, and echoed back in the catalogue as "client"
rather than "standard", so the panel tells the user their choice was recorded.

## Done

### A — eight new videos through the product

Driven through `runPipeline` and the build with every network seam substituted.
That is the panel's own path minus the HTTP hop: `POST /jobs` with
`type: pipeline` calls `runPipeline` with the real stages, and the build job
calls the same `build:reel` entry point used here.

What each reel came out with, and what the panel would say about it:

| shape | words | cards | keywords | slots | sfx | built |
|---|---:|---:|---:|---:|---:|---|
| 3 s | 3 | 3 (1 rendered) | 1 | 1 | 1 | 2 comps |
| 90 s | 24 | 24 (22 rendered) | 1 | 12 | 12 | 23 comps |
| silent open | 5 | 5 (3 rendered) | 1 | 2 | 2 | 4 comps |
| dense | 14 | 14 | 0 | 2 | 2 | 14 comps |
| one word | 1 | 1 | 0 | 1 | 1 | 1 comp |
| no pictures | 5 | 5 | 0 | 0 | 0 | 5 comps |
| no keywords | 4 | 4 | 0 | 1 | 1 | 4 comps |

**Two things I checked and found working**, having expected otherwise: one word
per card is the design, not a dense-reel defect — `vitasilk` is 73 words in 73
cards; and a reel with no pictures gets zero SFX because only the image
templates carry sound bindings, which is what `test-2` does too.

**A 90-second reel holds one picture on screen for 7.00 s.** That is session
40's sparse-reel hold, now measured past the length any corpus reel reaches. It
was not capped, per §7.

### B — the controls, and the states nobody prepared

**The keywords step lies about a stage that ran.** A reel where the model
returns no keywords shows *"Keyword analysis has not run for this reel."* while
the plan records `pipeline.analysis.status: "done"`. `steps.ts:245` makes
"done" conditional on `items.length > 0`, so "found none" is reported as "never
ran". The obvious response is to press Run pipeline again, which is billable —
**keyword calls in this project's own ledger cost $0.05 to $0.21, eighteen of
them, mean $0.09.** The images step two lines below gets the same situation
right: *"No image slots have been planned for this reel."*

**The four gaps already on the record:**

| claim | verdict |
|---|---|
| Session 40: a client's colours can only be set at creation | **confirmed** — `POST /client` only assigns a client to a plan; no route edits a client's fields |
| Session 40: two of four colour captions omit the picture role | **confirmed** — `light` and `accent` both carry the subject of every generated picture and neither caption says so |
| Session 27: can a client photograph be removed? | **yes** — `DELETE /clients/pictures` exists and works |
| Session 35: a missing candidate file fails inside After Effects | **refuted** — `assertPathsPresent` refuses first, with *"1 file(s) the plan references are not on disk; refusing to build a comp with gaps"* |

That last one is only half good. With a chosen candidate's file deleted, the
panel's images step says **"1 slots, 2 candidates, 1 on disk"** — it counts the
missing file — and then offers **Build available, "1 image"**. The refusal is
correct but it arrives as a failed job after the press, not as a disabled
control with a reason, which is how every other missing input is handled. The
message a user would see also carries a raw array dump and the phrase "file(s)".

**A new client starts as K2 Syndicalia.** `NewClient.tsx:50` hard-codes
`#F8F6F2`, `#C9A96E`, `#1A0000`, `#820000` — K2's exact four — as the palette a
new client opens with, and `create.ts:59` falls back to the same file
server-side. A user who accepts the defaults gets K2's brand in their subtitles
and in every generated picture, and cannot change it afterwards.

**What a user cannot do at all:** edit any client setting after creation —
colours, fonts, name, folder, logo, watermark. Only photographs can be added and
removed.

### C — a second client

A scratch client with a different palette, different colour roles, `imageScale`
0.8 and the watermark off, taken through a video and built beside the same video
built for K2.

**What carried correctly**, read out of the comp: the subtitle fill is
`#5FD0F0`, the client's own accent, and the shadow is `#06131F`, its background —
so session 19's shadow-was-K2's-red is genuinely fixed and the `textColours`
roles work for a client whose roles differ from K2's. The image prompt carried
the client's four greens and none of K2's. `imageScale: 0.8` drew the picture at
**717 px against K2's 897** on the same frame, confirming session 38's reading
that a value below 1 is live.

**What did not:** the watermark, above.

**Two videos in a row, and the same video twice**, both worked — the second run
of the same reel skipped the stages the plan already records as done and cost
nothing, and the plan is what carried the state.

### D — every number in front of the user

Verified against the plan and against a built comp rather than read:

| number | claims to count | actually counts |
|---|---|---|
| transcript step "N words in M cards, K rendered" | plan groups, minus superseded | correct — 3 words/3 cards/1 rendered on the 3 s reel |
| build preview "N subtitle cards" | cards the build places | **correct** — 1, and the build made 1 subtitle comp plus 1 keyword comp |
| build preview keywords / images / sfx | plan items | correct on all seven reels |
| images step "N slots, M candidates, P on disk" | files present | **correct, including when one is missing** |
| images view `reelSpentUsd` | cumulative money on this reel's pictures | agrees with the plan's `costs.spentUsd` and with the sum of the per-candidate figures |
| dry-run `spentUsd` | the same | agrees with both |

**No disagreement found among the cost figures.** Session 15's card promise is
fixed and I confirmed it by building the reel and counting the comps. The one
number that is wrong is not a count but a state: the keywords step's "has not
run".

The build preview also reads **"Would contain 1 subtitle cards"** — the only
part of that sentence that is not pluralised.

### E — what only breaks later

**The panel image-picker fixtures are missing again, and the test says in
writing that they are not.** `render.browser.test.ts:763` points `CUTOUTS` at
`my files/test videos/cutouts/`, and the three files it names —
`img001-c1.cutout.png`, `img001-c2.cutout.png`, `img002-c1.cutout.png` — are not
there; that directory now holds only the per-reel subdirectories `ground truth`,
`test 1` and `vitasilk`, and the files are inside those. The comment above them
reads *"These are files that exist, so the error never fires and the ready
branch is what is under test."* **That sentence is false.** Session 35's fix has
decayed exactly the way it was applied.

The tests nonetheless **passed in all three runs this session**, and I can say
why: the assertions read the `src` attribute, not whether the picture decoded.
The logo test one screen away does check `naturalWidth`; these do not. So the
suite is not currently red, and it is also no longer testing the thing its
comment claims. `align-sheet.browser.test.ts` passed both times it ran.

**Session 41's bill-then-crash is still there**, unchanged:
`cached.ts` calls `runAnalysis` (which bills), then `writeSlotCache`, then
`finish`, which runs `planSlots` — and `planSlots` throws
`MultiSubjectIdeaError` if any one of the model's ideas names a set rather than
a subject. A user pressing Run pipeline on such a reel pays for the call, sees a
crash, and is not told that the answer is cached and a retry is free. **At the
ledger's own rate that is about $0.09 per occurrence**, out of $2.71.

**`AeDriveError`: zero occurrences.** Twelve builds and four censuses this
session, including seven consecutive builds in one loop, and every `DoScript`
answered first time. Sessions 38 to 41 each saw at least one. Nothing this
session correlates with it because nothing happened; I cannot say it is fixed,
only that it did not occur in sixteen consecutive drives.

**What would differ on another machine that `npm run doctor` does not check:**
it checks After Effects, its version, scripting preferences, the fonts probe and
the modes — it does not check that the CV sidecar's two models are present
(`npm run check` does), nor ffmpeg/ffprobe, nor that `my files/test videos/`
exists, which `place:images` and the browser fixtures both read from.

### F — the shape, named

| # | finding | corpus-fitted? | reaches a client's video? | what would catch it |
|---|---|---|---|---|
| 1 | `watermarkByDefault` never reaches a plan | **yes** — K2 wants a mark | **yes, visibly** | a test that builds a reel for a client with it off and asserts no watermark layer |
| 2 | keywords step says "has not run" when it ran and found none | **yes** — every corpus reel has keywords | no, but it costs ~$0.09 a press | `new-video.test.ts` asserting the step text for a zero-keyword reel |
| 3 | `subtitleBaselineY`, `videoShape`, `language` inert | **yes** — K2 uses the standard for all three | baseline would move type | a test that a client's own value changes the built comp |
| 4 | Build offered, and a picture promised, when the file is gone | no — a general gap | no; the build refuses | `buildRequirements` covering candidate files |
| 5 | a new client is pre-filled with K2's four colours | **yes** | **yes** if accepted | nothing automatic; it is a ruling |
| 6 | picker fixtures missing; the comment says otherwise | no | no | a test asserting its own fixtures exist |
| 7 | slot planning bills, writes, then can crash | no | no; costs money | a test that a multi-subject idea in the pool does not throw the stage |
| 8 | "1 subtitle cards" | no | no | nothing worth building |

**What `new-video.test.ts` still does not assert**, and each is a finding above:
that a client's settings reach the comp (1, 3); that a step's own text is true
for a reel with none of something (2); that every file the plan names is
checked before Build is offered (4). It drives three videos, all vertical, all
K2, all with keywords and pictures.

## Deviations

**Twelve reels were built and four comps censused**, which §7 expects. Three
scratch source files were written under `service/src/`, one scratch client under
`modes/`, and eight scratch plans — all removed; the tree is clean and `modes/`
holds only `k2-syndicalia.json`.

**One thing was edited to reach a state**: a scratch plan's
`chosenCandidateId`, to test the missing-file case. It was a plan created by
this session and deleted with the rest. No real plan, cache entry, image or
reference was touched.

**I could not exercise the panel's controls through the panel itself.** The
panel is a CEP extension inside After Effects; driving its buttons means the
browser suite or the HTTP routes behind them. What is reported above is the
service side of every control — the routes, the messages and the numbers — and
the browser suite's own 213 passing assertions. A click-through of the rendered
panel is not something this session did, and findings 5 and 8 are the two that
would most benefit from one.

## Failures & open problems

Ranked worst first, one sentence each, in the *ranked list* at the end.

## Repo state

Branch `main`, tree clean. **Ledger 145 lines / `d4fe2de37f5eb0c8…` at both
ends, $0.00 spent**, so **$2.71** of credit remains. `templates/library.aep`
`4b0cf05a8f5d4775…` at both ends, never opened for writing.
`benchmarks/references/golden/census.json` `74436a960706fecd…` at both ends,
**not re-recorded**.

**`npm run golden`: PASS, 4 of 4, 17,174 fields, field for field** — the audit
changed nothing. `npm run check`: **PASS, exit 0** on the run after the scratch
files were removed (core 51/757, service 97/1263, benchmarks 17/173, panel
11/213 with 2 skipped, 0 failed); an earlier run failed on lint against my own
scratch files and is not a product result.

The hand-made references, byte-identical at both ends:

| file | sha256 |
|---|---|
| `benchmarks/references/align/vitasilk.json` | `f32e12dcfad55899…` |
| `benchmarks/references/align/vitasilk.rereview.json` | `10a2e5c2971ed27f…` |
| `.local/ground-truth/ground-truth.txt` / `.json` | `1fbbe2190d734db8…` / `64eebfd7374f93d2…` |
| `.local/ground-truth/test-1.txt` / `.json` | `b59a6270c3f704bc…` / `1394f8e863b72aa9…` |
| `.local/ground-truth/test-2.txt` / `.json` | `9ceea1c47ee94a8a…` / `183ba7b05392afaf…` |
| `.local/ground-truth/test-3.txt` / `.json` | `b5413c215ff32fec…` / `5ad64557cd2cd0fa…` |

`.local/plans/sora-995f2d27.editplan.json` `6eb6c995171c584e…`, unchanged. The
five corpus plans were rewritten by golden's own builds recording themselves, as
they are every run. Cache **72 entries / 129 files / 106 MB** at both ends.
`sora.mov` `344265a032513979…` at both ends. `.local/videos.json` still lists
only `sora`. One After Effects instance throughout, **no `AeDriveError`**, and
no project of the user's own was saved. Free space 157 GB.

## Suggested next step

Rule on finding 1. It is one line — read `watermarkByDefault` where the plan is
first written — and it is the only finding here that puts something on a
client's delivered video without anyone choosing it.

---

## Everything found, worst first

1. **A client created with the watermark switched off is watermarked anyway**, on
   every reel, because nothing reads `watermarkByDefault`.
2. **The panel tells a user that keyword analysis has not run when it ran and
   found nothing**, inviting a re-run that costs about $0.09 each time.
3. **Three more client settings — the subtitle baseline, the video shape and the
   language — are collected, validated, echoed back, and read by nothing that
   builds a reel.**
4. **A new client opens pre-filled with K2 Syndicalia's four brand colours**, and
   once saved there is no way to change them.
5. **Build is offered, and a picture promised, for a reel whose picture file is
   missing** — the build refuses correctly, but only after the press.
6. **The panel image-picker tests name three fixture files that no longer
   exist**, and their own comment states that they do.
7. **A slot-planning run bills, writes its cache entry, and can then crash** on a
   single multi-subject idea, telling the user nothing about the answer being
   paid for and cached.
8. **A 90-second reel holds one picture motionless for 7.0 s**, longer than
   anything session 40 measured, because the hold is the gap the planner left.
9. **The build preview says "1 subtitle cards".**
10. **`npm run doctor` does not check ffmpeg, the CV sidecar's models, or the
    test-footage folder**, all of which a second machine needs.

---

**The one file, and the one moment**

There is no file to open this time. The moment is the New Client screen: the
four colour swatches it opens with are K2 Syndicalia's, and the watermark switch
below them does nothing.
