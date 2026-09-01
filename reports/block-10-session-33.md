Status: OK

# Block 10 session 33 — a video the tool has never seen now reaches a comp

**Spent $0.00. Ledger 144 lines, `d88659660ca3fa372d473e5d65c7d9d0dc27dd690b1ab69fe9687cc4824e1e59`, byte-identical at both ends.** `templates/library.aep` `d2bbb6b7…`. The six hand-made references byte-identical. Cache unchanged at 71 entries / 128 files / 108,256 KB. **`sora.mov` byte-identical — `344265a0…` — and its plan `dc545304…` and 11 pictures untouched.** After Effects one instance, 0 `aerender`, nothing saved. Free space **206 GiB**.

**`npm run check` PASS; `npm run golden` PASS, 4 of 4 reels, 17,174 fields.**

---

## What a new video was missing, and where it gets to now

**Two things, and they were both invisible because the five corpus reels were given them by hand months ago.**

1. **Where each picture goes.** `images.slots[].position` and `.scale` are written by `npm run place` — a terminal command that **no pipeline stage has ever run**. The corpus reels have them because a session typed that command in Block 5. `sora` has never had them and never could.
2. **The pictures themselves, on a first run.** The *slot* stage marks the image stage `done` when it plans the slots, so a run on a new video planned eleven slots, skipped the pictures with *"already on the plan"*, and reported all four stages green. `sora` only has its 11 pictures because the user pressed the panel's **Make the pictures**, which sends `redo`.

**Both are now produced by the pipeline, and neither can silently report done again.**

**A video that had never existed went from Browse to a built composition tonight** — six seconds trimmed out of a corpus reel into a new file with a new hash, through every stage with only the three network calls replaced, into After Effects, censused clean: two masters, one picture placed 949 px in the top-left corner clear of the speaker, the watermark, five text cards, **0 placeholder words surviving and 0 mismatches against the plan**.

**`sora` itself gets one step further than before and stops.** After Effects builds it — 99 elements, all 11 pictures placed, the watermark — and the build then refuses because one keyword card is **32.3 px taller than its comp**. That is a typography ruling the user has not made and this session was told not to make for him. §3.4 below has the exact figures.

---

## Done

### 1. The whole gap, found before anything was fixed

**Every field a build reads, and where it comes from.** Diffed `vitasilk`'s plan against `sora`'s, field by field, and then checked each against what the pipeline writes:

| what the build reads | who writes it | does a new video get it? |
|---|---|---|
| `source.videoPath/sha256/durationS/fps/width/height` | transcription stage | **yes** |
| `source.dialogueLufs` / `dialoguePeakDbfs` | the transcription stage's measurements (Block 9 session 13) | **yes** — `sora` reads −14.8 / 0.1 |
| `transcript.words`, `subtitles.groups` | transcription stage | **yes** — 93 words, 93 cards |
| `groups[].templateId`, `displayStart/End` | analysis stage | **yes** — 93 of 93 |
| `keywords.items[].templateId` | analysis stage | **yes** — 5 of 5 |
| `sfx.events` | analysis stage | **yes** — 11 |
| `images.slots[].candidates[].path` | image stage | **only if it runs** — see gap 2 |
| **`images.slots[].position` / `.scale`** | **`npm run place`, a terminal command** | **no** — gap 1 |
| `zones.zones` | zones stage | **yes** — 28 |
| `clientMode`, `clientSnapshot` | analysis stage | **yes** |
| face masks under `.local/cv/` | zones stage | **yes** — 82 frames |
| `.local/build/watermark.json` | the transcription stage's measurements | **yes** |
| `templates/library.audit.json` | committed, `npm run audit:templates` | always there |

**Everything present on a corpus reel and absent on `sora`**, in full — nothing else:

```
images.slots[].position      absent on sora   ← npm run place
images.slots[].scale         absent on sora   ← npm run place
images.slots[].zoneId        null on sora     ← npm run place; unread since Block 7 s9
images.slots[].promptModeVersion  absent      ← npm run recompose; unread by the build
watermark                    null on sora     ← defaults to on/medium; harmless
build.aepPath / builtAt      null on sora     ← written by a build
```

And three fields present on `sora` and absent on `vitasilk` (`transcript.terms`, `pipeline.transcription.cacheEntryId`, `cacheProvenance`) — newer fields, read by nothing in the build.

**So the count is two.** One from the diff — the placement — and one the diff could not show, because a plan cannot record a stage that never ran: the pictures. The second was found by driving a video that had never existed, which is the only way it could have been.

### 2. The placement, and why the gate was the defect

**The builder already computes the placement itself.** `build-reel-cli.ts` derives every slot's top-left rect from that reel's own face masks — Block 7 session 9's ruling — and passes it to the planner as `topLeftFor`. `slot.position`/`slot.scale` are used **only** as a fallback for a reel with no masks: read `reel-plan.ts`'s arithmetic and `placed === undefined` is the only branch that touches them.

**And the planner refused for want of exactly that fallback.** A hundred lines after computing all eleven placements, it asked whether the *stored* ones existed and skipped every slot that had none — `UnplaceableElementsError: 11 element(s) have no placement`, on a reel whose placements it was holding.

The rule now: **a slot is unplaceable when neither source can say where it goes**, and not before. The refusal is kept in full — a slot with no masks and no stored placement is still skipped, and the build still stops rather than putting a picture somewhere arbitrary.

**Writing the placements from the pipeline instead would have been wrong.** `npm run place` writes the *zone-solved* position, and zones were retired for image placement in Block 7 session 9; persisting them would put a stale number on the plan that contradicts what the builder does.

### 3. The pictures, and a stage that said done without doing anything

**Found by driving a video that had never existed**, which no session in this block had done. The first run planned 11 slots, then:

```
images   skipped   already on the plan
```

with **zero candidates on the plan**. The *slot* stage writes `pipeline.images.status = 'done'` when it plans the slots (`analysis/job.ts:425`), and the runner read that record. Every stage reported green and the reel had no pictures.

**The pictures decide now, not the record**: a stage that has produced no candidate has not been done. Same correction session 32 made to the dry run's reading of the same defect, and the same reasoning as `appendCost` firing at the point of spend — a record written by something other than the work is not evidence the work happened. **The double-write itself is untouched and still open**; it is now harmless in both readers.

**Which stages were checked against that standard**, all four:

| stage | what it claims | how it is checked |
|---|---|---|
| `transcription` | words on the plan | already: the stage writes the plan and throws on failure; `runSidecar`'s exit status added in session 32 |
| `analysis` | keywords, slots, sfx | the stage writes them and throws; nothing else marks it done |
| `images` | candidates on disk | **fixed here** — the candidates decide |
| `zones` | masks and zones | already: `analyseFrames` refuses by name when a mask cannot be made |

### 4. Two more messages that sent the user to a terminal

Found while reading the placement path, both in `build-reel-cli.ts`, both reachable by any reel:

- *"Re-sample the reel with `npm run frames -- --reel <label> --force`, then `npm run segment`"* → now names the times the masks cover no frame and says to run the pipeline again, which is the thing that re-samples.
- *"placement leaves the frame / overlaps the speaker's face"* → now *"this picture would cover the speaker's face, so nothing was built"*.

`leave-the-panel.test.ts` covers the panel's own strings; these are the build's, and they reach the user through the panel's failure line.

### 5. `sora`, driven as far as it goes

**After Effects built it.** The driven run reports `ok: true`, `elementsBuilt: 99` — 83 subtitle cards, 5 keywords, 11 images — two masters, the watermark placed top-left at 324 × 363 px, and **all 11 pictures at 669 px in the top-left corner**, each with the reason it is that size (*"bounded by the space above the speaker"*, *"beside the speaker"*). `placementIsSafe` passed for every one, which is the assertion that each picture is inside the frame and clear of the face — the thing the refusal existed to protect.

**Then the build refused, correctly.** `assertEveryCardFits`:

> `k001` — **`الجمال` / `الطبيعي`**, Almarai-Bold at 455, broken onto two lines — reaches **374.2 px to 1267.3 px, and its shadow to 1282.3 px**, in a comp **1250 px** tall. **32.3 px outside**, and that comp does not collapse, so nothing outside it is drawn.

All five of `sora`'s keywords break onto two lines and the other four fit, but not by much:

| keyword | reaches | comp | spare |
|---|---:|---:|---:|
| `الجمال` / `الطبيعي` | **1282.3** | 1250 | **−32.3** |
| `Lobna` / `Kfafi` | 1224.1 | 1250 | 25.9 |
| `طب` / `التجميل` | 1196.7 | 1250 | 53.3 |
| `صحة` / `البشرة` | 1195.8 | 1250 | 54.2 |
| `وثقة` / `جديدة` | 1180.4 | 1250 | 69.6 |

**Nothing was changed.** The height check, the card-fit rule and the comp heights are all as they were. What this measures is that the **53.3 px of headroom session 24 recorded was the corpus's luck, not a margin**: a two-line Arabic keyword whose second line ends in a deep-descending letter does not fit, and with 94.6% of `sora`'s words in Arabic script two-line Arabic keywords are now the normal case rather than the exception.

**The short card `g074` did not block anything.** `checkBuildability` reports it as an issue — the word **`من`**, spoken 30.359–30.420 s, 0.080 s on screen where `sub_pop_ar` wants 0.12 s — and the build places it with a compressed entrance, as the short-card rule intends.

**The composition was not opened and `sora`'s plan was not written to** — it is byte-identical, and the build recorded nothing because it exited non-zero.

### 6. Proven on a video that had never existed

**Six seconds trimmed out of `vitasilk.mov` and re-encoded** into a scratch directory: a new file, a new hash, nothing in this repository had ever been run against it. The source was read only.

**Browse → the whole pipeline → a built comp:**

| | |
|---|---|
| opened | 6.01 s, 2160 × 3840, registered by `rememberVideo` |
| transcription | **done**, $0.0000 |
| analysis | **done**, $0.0000 |
| images | **done** — 1 slot, 2 candidates, cut out and gated by the real sidecar |
| zones | **done** — 6 zones from its own frames |
| build | **exit 0**, `master_final` and `master_subs_only` |

**Censused inside After Effects**: `master_final` 2160 × 3840, 6.006 s @ 29.9700317, **9 layers** (footage, watermark, sfx, image, 5 text); 14 comps; 5 text comps, 10 text layers; **0 placeholder words surviving, 0 comps missing a declared layer, 0 undeclared text layers, 0 comps where placeholder and shadow differ**; 5 cards compared against the plan, **0 mismatched**; fonts **Almarai-Bold and Inter-SemiBold**, none outside the client's set. The picture landed at **949 px in the top-left corner**, and its frame colour was chosen from its own measured edge at 4.54:1.

**No request could leave the machine, by construction.** `transcribeVideo`, `analyseKeywordsCached`, `planSlotsCached` and `generateImagesForPlan` each take the one function that would make the call as an argument — `runTranscription`, `runAnalysis`, `runAnalysis`, `client` — and every one was given a local substitute. **No API key was read and no network client was constructed.** The ledger was pointed at a scratch file, so even a fabricated cost could not reach the real one; it did not move, and that is asserted inside the test as well as measured here.

**`service/src/new-video.test.ts` keeps it fixed**, and runs in `npm run check`. It makes the video, runs the pipeline with those four substitutes and nothing else stubbed, then asks the builder to plan the reel and asserts **nothing is skipped**. It would have failed on both of tonight's gaps. It **stops short of driving After Effects**, because the gate has to pass on a machine that has none — what it pins is that everything a build reads is on the plan when the pipeline finishes, which is exactly what was missing. It skips with a notice when ffmpeg, the corpus footage or the CV venv is absent.

**It cleans up after itself** — the plan, the frames, the masks and the cutouts all live outside its temp directory, by the rules that decide where each goes, and it removes each one. Session 30's `job.test.ts` left 65 stray plans by not doing this; a run of the new test leaves `.local/plans/` and `.local/cv/` exactly as it found them, measured.

---

## Deviations

**`sora` was not carried all the way to a comp**, because the last thing in the way is a ruling rather than a defect: a keyword card 32.3 px taller than the comp it is drawn in. §5 forbids changing the height check, the card-fit rule and any ruled constant, and §3.4's instruction for a card that needs the user's judgement is to report it precisely and stop. Status is `OK` because a never-seen video did reach a built comp, which is what §6 asks; `sora` needs one decision from him first.

**The scratch video was made from `vitasilk.mov` by trimming and re-encoding.** The source was opened read-only; the result is a different file with a different hash in a temp directory, deleted afterwards.

**The new test adds about 60 seconds to `npm run check`** — most of it ffmpeg decoding a 2.4 GB ProRes source and the real segmentation model. The suite already carries a 125-second image integration test; this is the second-slowest thing in it.

**No corpus plan, cache entry, mode file, generated image, hand-made reference or ruled constant was touched**; `sora`'s plan and its 11 pictures are byte-identical; the corpus plans moved only through `npm run golden`'s four builds writing a fresh `builtAt`.

## Failures & open problems

**Every distinct failure hit while driving, in order:**

1. `UnplaceableElementsError: 11 element(s) have no placement` — the planner asking for a fallback the builder does not use. **Fixed.**
2. `CardClippedError` on `sora` `k001` — a real overflow, **not fixed**, the user's ruling.
3. On the never-seen video: the image stage skipping with *"already on the plan"* and producing nothing. **Fixed.**

That is **two more behind the user's four**, and the third could only have been found by running a video from nothing — which is why the test now does.

**Unproven, by name:**

- **`sora` has not been built end to end.** After Effects builds it; the CLI then refuses. Nothing here has seen its 99 elements as a finished comp.
- **The never-seen video's transcript was six canned words.** Grouping, templates, display timing, keywords, slots, sfx and placement all ran on it, but its cards are short and it has one picture; it does not exercise long Arabic keywords, wrapping or the height check.
- **The test does not drive After Effects.** That the plan is buildable is asserted; that AE builds it was done by hand this session, once.
- **The 949 px placement of the scratch reel's picture was not eyeballed**, only asserted by `placementIsSafe`.
- **`npm run place` still exists and still writes the zone-solved placement.** Nothing calls it and nothing needs it; it is now a report that can also write, which is the shape `CLAUDE_CODE_GUIDELINES.md` §3 warns about.

**Open, and untouched:** the `pipeline.images` double-write itself; the onnxruntime abort at exit; `preflight.ts` not checking a client picture's file; the client photographs and `.local/plans/` missing from the backup set; the three false-premise tests; `build-reel.jsx`'s guard.

**The panel's image-picker tests did not flake** in this session's full check.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `17fc8cf` *test: drive a never-seen video to a buildable plan* (this report follows) |
| ledger | **144 lines**, `d88659660ca3fa372d473e5d65c7d9d0dc27dd690b1ab69fe9687cc4824e1e59` — identical at both ends |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c` |
| cache | **71 entries / 128 files / 108,256 KB** at both ends |
| `sora.mov` | **`344265a032513979f101133e68622adf95f001844def480cbeaf3bd9b297bd85`** at both ends; its folder holds the two files it held before |
| `sora`'s plan | **`dc5453040180050fe589d10d253ffa24b07dd957fb4bb97eee7f6f824baed0bf`** at both ends; 11 slots, 22 candidates untouched |
| After Effects | one instance, 0 `aerender`; nothing saved |
| free space | **206 GiB** |

**Hand-made references, sha256, identical at both ends:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Corpus Edit Plans, sha256.** `ground truth` unchanged; the other four moved for one reason only — `npm run golden` builds all four and each build writes a fresh `builtAt`.

```
start                                                             end
0712e412…  ground truth   →  0712e412…  (unchanged)
1a54db70…  test 1         →  04b4d135…  (golden's builtAt)
31be0f3b…  test 2         →  fb92c917…  (golden's builtAt)
b3013a28…  test 3         →  c6e51e5b…  (golden's builtAt)
fc865afe…  vitasilk       →  4507de1c…  (golden's builtAt)
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 757 | 757 |
| service | 1218 | **1219** |
| benchmarks | 173 | 173 |
| panel | 213 + 2 skipped | 213 + 2 skipped |
| pytest | 149 | 149 |
| claude-md | `8,790 of 20,000 characters` | unchanged |
| modes / templates / ExtendScript / panel manifest | unchanged | unchanged |
| references | `6 hand-made reference file(s)` · `PASS` | unchanged |
| attribution | `PASS` | `782 tracked text file(s), 756 commit message(s)` · `PASS` |

Service **+1**: the new-video test, which is one test doing a great deal.

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field: test-1 4415, test-2 4280, test-3 3709, vitasilk 4770, **17,174 fields**. The reference was **not re-recorded**, which is the evidence that none of tonight's changes moved a corpus build.

## Suggested next step

**The keyword card that does not fit is the only thing between `sora` and a comp, and it is his call.** `الجمال` / `الطبيعي` needs **1282.3 px** and the comps are **1250**. Three ways out, and they are different decisions rather than different patches:

- **Grow the four text comps to 1300 px** — his file, the same edit as sessions 22–24, and it leaves 17.7 px on this card. It moves nothing else: session 23 measured that growing a comp re-centres its type, and putting the baseline back is the second half of that edit.
- **Let a card that has broken and still does not fit shrink**, as an overlong single word already does. That is a third card-fitting rule and he has ruled on this twice.
- **Emphasise fewer or shorter words** — the keyword layer already narrows a long term, and this is two whole words.

The first is the smallest and the most likely to be right for a reel that is 94.6% Arabic, because two-line Arabic keywords are now the normal case and the corpus's 53 px of headroom was luck.

---

## What to do next

1. **Decide the keyword card.** Growing the four text comps in `templates/library.aep` from 1250 to 1300 px, with the first baseline put back at 700, is the edit that unblocks it.
2. Then **Window → Extensions → Framopia Studio**, pick the client, pick **sora**, and press **Build the composition**. Everything else it needs is on the plan.

Nothing is owed. The words, the keywords and the 11 pictures are paid for and cached, and the build costs nothing.
