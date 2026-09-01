Status: OK

# Block 10 session 32 — what crashed, and why the tool said done

**Spent $0.00. Ledger 144 lines, `d88659660ca3fa372d473e5d65c7d9d0dc27dd690b1ab69fe9687cc4824e1e59`, byte-identical at both ends.** `templates/library.aep` `d2bbb6b7…`. The six hand-made references byte-identical. Cache unchanged at 71 entries / 128 files / 108,256 KB. **`sora.mov` byte-identical — `344265a0…` at both ends — and nothing was written beside it.** The 11 pictures and their plan are untouched. After Effects one instance, 0 `aerender`, nothing saved. Free space **246 GiB**.

**`npm run check` PASS; `npm run golden` PASS, 4 of 4 reels, 17,174 fields.**

---

## What actually happened

**Two separate things, and only one of them is the crash.**

**The mask stage did not fail.** It ran, it wrote **82 face masks, 82 head masks, 82 binary and 82 confidence masks, `zones.json` and its manifest**, and re-running it tonight answers *"already done: 82 frames, 28 zones"*. "Looking at the video: done" was **true**.

**What was wrong was the build's refusal.** The check that asks *"are this reel's masks on disk"* built the directory name from the **plan's filename** — `sora-995f2d27` — while everything that writes masks builds it from the **video's** — `sora`. Two rules for one path. They agreed for months because every plan sat beside its video; session 30 ended that when it stopped writing a JSON file into a client's own folder and moved a browsed video's plan to `.local/plans/<name>-<hash>.editplan.json`. From that moment the build looked in `.local/cv/sora-995f2d27/`, which has never existed, and reported the masks missing while 328 mask files sat in `.local/cv/sora/`.

**The Python crashes are real, old, and did not cause this.** They are onnxruntime aborting *on the way out of a process that had already finished its work* — in every one of the 29 reports the main thread is inside `exit()`. They cost nothing tonight: the 11 pictures are all there.

**And `npm run check` was already red when this session started** — not from the crash, from two tests that count things across "every reel the tool knows" and were written when that meant exactly the five test reels.

---

## Done

### 1. What crashed

**Both reports from tonight, and all 27 before them, are the same crash.**

| | |
|---|---|
| signal | **SIGABRT** (Abort trap: 6); one of the 29 is SIGSEGV with the same stack |
| process | Python **3.11.14**, Homebrew, macOS 26.6.2 |
| library | **`onnxruntime_pybind11_state.so`** — onnxruntime **1.29.0** |
| faulting thread | **1**, an onnxruntime telemetry worker |
| main thread | **inside `exit()`** in all 29 |

The mechanism, read off the two stacks:

- **Thread 0** is shutting down: `exit()` → `__cxa_finalize_ranges` → `PosixEnv::~PosixEnv()` → `PosixTelemetry::~PosixTelemetry()` → `PosixTelemetry::Shutdown()` → `LogManagerImpl::FlushAndTeardown()` → `HttpClientManager::cancelAllRequests()`, sleeping.
- **Thread 1** is a telemetry worker still handling an HTTP response: `HttpClientManager::onHttpResponse` → `HttpResponseDecoder::handleDecode` → `DispatchEvent` → `std::recursive_mutex::lock()`, which throws `std::system_error` on a mutex whose storage the main thread has already destroyed. Nothing catches it, so `terminate()` → `abort()`.

**onnxruntime bundles Microsoft's 1DS telemetry and it phones home.** The crash is the race between its uploader and its own static destruction.

**Twenty-nine reports, not thirteen** — the directory holds more than the brief counted:

| 25 Aug | 28 Aug | 29 Aug | 30 Aug | 31 Aug | 1 Sep |
|---:|---:|---:|---:|---:|---:|
| 2 | 11 | 9 | 3 | 2 | 2 |

**Which command.** onnxruntime is loaded by **rembg** (`remove_bg`, the cutouts) and **RapidOCR** (`detect_text`), which run together in the image stage. The mask stage uses MediaPipe, which is TFLite and never loads onnxruntime. So these are the picture stage's crashes, and 27 of the 29 predate `sora` entirely.

**Not deterministic.** It is a thread race. Tonight it fired **twice across 22 candidate images**. Probed directly with six `remove_bg` runs on a cached image, **1 of the 3 that completed exited 134** and two exited 0.

**Not size, not length, not the model.** The reports start 25 August, on 21–26 second corpus reels; nothing in either stack touches image data, a model file or memory. `sora` being 4.46 GB and 41 s is not implicated.

**The work always finished.** The main thread is in `exit()` in all 29, which means Python had run to completion and the JSON was already on stdout. That is why the 11 pictures are correct despite two aborts.

### 2. A stage that fails must not report done

**Where the exit status was read: nowhere.** `runSidecar` in `service/src/images/sidecar.ts` had `child.on('close', () => …)` — **no arguments**. A process killed by a signal was indistinguishable from one that returned 0. That is how 29 crashes accumulated on the user's machine with nothing in this project ever mentioning one.

**What it did decide on** was stdout: unparseable → reject, `ok !== true` → reject, otherwise resolve. So a crash *before* the answer already failed the stage — with the message *"sidecar stdout was not JSON: "*, which names the symptom and not the cause. **A crash did not produce a false "done"**; it produced an unreadable failure. The false "done" was §3's directory mismatch, and the brief's premise is corrected here rather than left standing.

**The fix reads `(code, signal)` and lets the answer decide.**

- Died before answering → refuse, naming how: *"the picture tools stopped during `segment_person` — it was killed by SIGABRT, and wrote nothing"*.
- Answered, then died → **use the answer and report the death**, because that is the shape this project actually has and failing on the exit status alone would break the working image stage.
- Answered and exited cleanly → unchanged.

**Every sidecar command goes through that one function** — `remove_bg`, `edge_luminance`, `flatten_cutout`, `segment_person`, `segment_overlay`, `compute_zones`, `component_stats` — so all seven are covered by one change. The one other path that spawns Python is `faceBoxesFor`, which runs `head_boxes.py` (no onnxruntime) inside a `try/catch` that returns an empty map; that is safe only because session 38 made `placementIsSafe` take a required `Rect`, so a caller with no face box cannot reach it. Checked, unchanged.

**Proven, on a scratch sidecar, twice over.** A scratch package whose CLI aborts — the real one never touched, `FRAMOPIA_SIDECAR_DIR` re-points it:

- **Through the real pipeline**: `runPipeline({ only: ['zones'], redo: ['zones'] })` on a scratch reel fails with stage `zones`, cause *"the picture tools stopped during segment_person — it was killed by SIGABRT, and wrote nothing"*, retryable false.
- **In the panel**, in a real browser: the run section shows that sentence, and contains none of `sidecar`, `npm run`, `terminal`, `Quit After Effects` or `restart` — session 30's rule holds.
- Both unit tests **fail against the old behaviour**, checked by putting `child.on('close', () => …)` back.

### 3. One rule for where a reel's masks are

`reelMasksDir(videoPath)` in `service/src/frames/segment.ts` is now the only place that path is decided. It had **three** implementations and five more spellings:

| where | was | now |
|---|---|---|
| `build/requirements.ts` | from the plan's filename | `reelMasksDir` |
| `build/build-reel-cli.ts` | from the plan's filename | `reelMasksDir` |
| `placement/face-boxes.ts` | built from the video path by hand | `reelMasksDir` |
| `frames/face-sheets-cli.ts`, `placement/image-size-cli.ts`, `image-ceiling-cli.ts`, `place-images-cli.ts` | built from the reel label by hand | `reelMasksDir` |

`readBuildDisk` takes the plan rather than a path, so it can ask the video. **A test fails on any module under `service/src` that spells `masks-2fps` itself**, which is `CLAUDE_CODE_GUIDELINES.md` §3's rule that a shared rule is pinned rather than commented.

**The old test asserted the retired behaviour and was rewritten.** It copied a plan to a new *filename* and expected no masks — which passed only because of the bug. It now changes the plan's **video** and expects no masks, which is the real question.

### 4. The crash itself

**The cause is outside this project.** It is onnxruntime's bundled telemetry racing its own destructor. Nothing this repository does provokes it and nothing it can do fixes it.

**One workaround was tried and it does not work.** `onnxruntime.disable_telemetry_events()` exists in 1.29.0 and was called at sidecar start; a `remove_bg` probe **still exited 134 on 1 of 3 completed runs**. A comment claiming it prevents the abort would have been false, so the change was reverted rather than kept — the revert commit records that it was tried and measured.

**What would work, and what it costs.** The crash is at exit, so the answer is on stdout by then and the process could be allowed to die: that is what the §2 fix does. A stronger workaround would be `os._exit(0)` in the sidecar after the JSON is flushed, skipping static destruction entirely. It would remove the crash reports; it also skips every other destructor and every atexit handler, which for a process that has already written its file is probably safe and is **not** something to do without deciding it deliberately. Pinning an older onnxruntime is the other route and would need measuring against the two models.

**The stage was not disabled, not skipped, and the build still refuses without masks.**

### 5. The user's reel

**The mask stage was re-run and reports "already done: 82 frames, 28 zones", $0.00.** Nothing was regenerated.

**The build is no longer blocked.** `readBuildDisk` now answers `{"faceMasks":true,"cvPython":true,"watermarkFacts":true}` and the requirement list is **empty**.

**What the panel now shows for `sora`:**

| | |
|---|---|
| reel | `sora` — 40.5 s |
| words | 93 words in 93 cards, 83 rendered |
| emphasis | 5 keywords, 5 approved |
| pictures | 11 slots, 22 candidates, 22 on disk |
| build | **open** — *"Would contain 83 subtitle cards, 5 emphasised keywords, 11 images, 11 sfx events. Fonts: Inter Semi-Bold and Almarai Bold."* |
| client | K2 Syndicalia, from the plan, not behind |
| output | `.local/build/sora-995f2d27-full.aep` |
| watermark | medium, 324 × 363 px |
| missing | **none** |

**One issue remains, and it is reported rather than gated.** `checkBuildability` lists:

> `subtitles.groups[73]`: 0.08s long but `sub_pop_ar` needs 0.12s (intro 0.13 + hold 0.1 + outro 0) — short by 0.038s

Precisely: card **`g074`**, one word, **`من`** in Arabic script, confidence 0.99999, **spoken 30.359 → 30.420 s (0.061 s)**, displayed 30.359 → 30.439 s (0.080 s). The next card starts at 30.439 s, so there is **0.019 s** of silence to extend into. The build places it — the short-card rule compresses its entrance — and the card is simply on screen briefly. **Nothing was changed**: no timing constant, no stretch, no weakened check.

**And the headline from his own speech: 88 of `sora`'s 93 words — 94.6% — came back in Arabic script.** Session 29 reversed the orthography rules eight days ago and nothing had ever been transcribed under them. This is the first evidence they work on real speech.

**The composition was not built.**

---

## Deviations

**I started a billable stage by mistake and stopped it.** Proving the panel surfaces a sidecar failure, I pressed **Run pipeline** on a scratch reel rather than driving the zones stage alone, and the transcription stage began. I killed the service about five seconds later. **The ledger is unchanged at 144 lines and the same sha256**, no cache entry was created and no audio was extracted, so no billable call completed or recorded. I cannot rule out that a Scribe request was issued and abandoned in flight; on a 3-second clip the maximum exposure is a small fraction of a cent. The proof was then done correctly, through `runPipeline` with `only: ['zones']`.

**A workaround was committed and then reverted** — see §4. Both commits are kept, because "it was tried and measured and did not work" is worth more than a clean history.

**Two tests were red before this session touched anything**, and they are fixed here:

- `transcript-view.test.ts` summed five hardcoded per-reel figures to the corpus figure; the corpus count is over every reel the tool knows, and the user's own reel joined it. It now asserts that the two scopes **agree over whatever the tool knows**, with the five recorded reels as a floor.
- `backup/set.test.ts` expected **exactly** 11 transcription cache entries; the five corpus reels hold 11 and every video he transcribes adds more. It now asserts **at least** 11.

Both were tests about the machine rather than about the project — the same lesson session 30 learned when a browsed video broke `clients/videos.test.ts`.

**22 Python crash reports on this machine are mine**, from the deliberate aborts in §2's proof (`Python-2026-09-01-0055*` onwards). The 29 that predate this session are the user's.

**No corpus plan, cache entry, mode file, generated image or hand-made reference was touched**, no ruled constant moved, and `sora`'s plan changed only by `npm run golden`'s builds of the four corpus reels — not `sora`'s.

## Failures & open problems

**How many sessions reported a green pipeline while this was crashing: every session since 25 August.** The reports run from 25 August to 1 September and cover sessions 12 through 31 — roughly twenty session reports, each stating a clean run, over a sidecar that had aborted. None of them was wrong about the *work*: the crash is at exit and the results were always complete. All of them were blind to it, because the exit status was never read.

**Unproven, by name:**

- **The crash is not fixed and cannot be, here.** It will keep happening; what changed is that it will be said out loud when it does.
- **`os._exit(0)` was not tried.** It is the workaround most likely to remove the reports, and it skips every destructor in the process — a decision, not a patch.
- **The "answered then died" path has been seen only with a scratch sidecar.** The real onnxruntime abort has never been observed *through* the new code, because it is intermittent.
- **The panel's failure sentence was rendered in Playwright's Chromium**, not inside CEP.
- **`sora` has not been built.** The mask blocker is gone and the requirement list is empty; whether After Effects produces a correct comp from 83 cards, 5 keywords and 11 pictures is unobserved.
- **The 0.019 s of silence after `g074`** is measured from the plan, not from the audio.

**Open, and untouched:** the `pipeline.images` double-write; `preflight.ts` not checking a client picture's file; the client photographs and `.local/plans/` missing from the backup set; the three false-premise tests; `build-reel.jsx`'s guard.

**The panel's image-picker tests flaked once**, one test in the first full check after the revert, passing in the next. Sessions 24, 25 and 31 recorded the same; the cause is still unknown.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `a77950c` *revert: the telemetry call did not stop the abort* (this report follows) |
| ledger | **144 lines**, `d88659660ca3fa372d473e5d65c7d9d0dc27dd690b1ab69fe9687cc4824e1e59` — identical at both ends, and $3.8221 of it is the user's `sora` run before this session |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c` |
| cache | **71 entries / 128 files / 108,256 KB** at both ends |
| `sora.mov` | **`344265a032513979f101133e68622adf95f001844def480cbeaf3bd9b297bd85`, identical at both ends**; its folder holds the two files it held before |
| `sora`'s plan and pictures | 11 slots, 22 candidates, 22 cutouts — untouched |
| After Effects | one instance, 0 `aerender`; nothing saved |
| free space | **246 GiB** |

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
fd051c79…  test 1         →  1a54db70…  (golden's builtAt)
0f43cc9a…  test 2         →  31be0f3b…  (golden's builtAt)
3135d4a7…  test 3         →  b3013a28…  (golden's builtAt)
ef69a2ea…  vitasilk       →  fc865afe…  (golden's builtAt)
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 757 | 757 |
| service | 1218 (**2 failing on arrival**) | **1218, all passing** |
| benchmarks | 173 | 173 |
| panel | 212 + 2 skipped | **213 + 2 skipped** |
| pytest | 149 | 149 |
| claude-md | `8,790 of 20,000 characters` | unchanged |
| modes / templates / ExtendScript / panel manifest | unchanged | unchanged |
| references | `6 hand-made reference file(s)` · `PASS` | unchanged |
| attribution | `PASS` | `780 tracked text file(s), 753 commit message(s)` · `PASS` |

Service is 1218 both ways: two new sidecar tests, two removed with the reverted workaround's absence of any, and two that were failing now pass. Panel **+1**: the dead-sidecar message.

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field: test-1 4415, test-2 4280, test-3 3709, vitasilk 4770, **17,174 fields**. The reference was **not re-recorded**.

## Suggested next step

**Build `sora` and look at it.** Everything it needs is on the plan and the panel says so: 83 subtitle cards, 5 emphasised keywords, 11 pictures, 11 sounds and the watermark, in Inter Semi-Bold and Almarai Bold. It costs nothing and it is the first composition this tool will have made from a real client reel — and from 94.6% Arabic-script speech, which no comp has ever carried.

The two things to look at first are the two nothing here can answer: whether Arabic subtitle cards read correctly at speed, and whether `من` at 30.36 s — on screen for 0.08 s — is legible or should be ruled on. That second one is a judgement about how short a card may be, not a number to change quietly.

---

## What to do next

1. **Window → Extensions → Framopia Studio**, pick the client and pick **sora**.
2. Press **Build the composition**. It is free and it takes a few seconds.
3. Open `.local/build/sora-995f2d27-full.aep` and watch it.

The mask refusal is gone. If the picture tools crash again during a picture run, the panel will now say so in words instead of going quiet.
