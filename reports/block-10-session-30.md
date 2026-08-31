Status: OK

# Block 10 session 30 — the tool refused a real client video

**Spent $0.00. No API was called, and nothing was transcribed, analysed or
generated — on `sora.mov` or on anything else.** Ledger **118 lines,
`3f657131…`, byte-identical at both ends**. `templates/library.aep`
`d2bbb6b7…`. The six hand-made references byte-identical. Cache unchanged at 46
entries / 80 files / 54,256 KB. **`sora.mov` is byte-identical —
`344265a032513979f101133e68622adf95f001844def480cbeaf3bd9b297bd85` at both ends
— and nothing was written beside it.** After Effects one instance, 0
`aerender`. Free space **291 GiB**.

**`npm run check` PASS; `npm run golden` PASS, 4 of 4 reels, 17,174 fields.**

---

## Why a real client video was refused

**The tool was looking his video up in the list of its own test reels.**

`benchmarks/footage.json` describes the five reels this project was built and
measured against. It is a benchmark fixture. But every stage of the product
found a video by looking its **name** up in that file, so the moment he browsed
to `sora.mov` — a real file, on a real disk, that the panel had just opened for
him — the service answered `no reel labelled "sora" in benchmarks/footage.json`.
There was nothing wrong with his video. The tool simply had one list of videos
and it was the wrong list.

**The second message was the same failure wearing a different face.** With the
lookup refused there was nothing to say about the build, so the Build pane
printed *"The companion service did not say what this build would contain. Quit
After Effects and open it again."* Nothing was wrong with the service either. A
video that has never been run has no plan and therefore nothing to preview, and
the panel read that silence as a fault and told him to quit the application —
which session 26 had spent a whole session making unnecessary.

Both are fixed. He can browse to any video on his disk, and the panel now
prices it end to end before he spends anything.

---

## Done

### 1. Every place the corpus gated real work

**Six product lookups, all through `listReels()`, all refusing by the same
sentence:**

| file | line | what it wanted the list for |
|---|---:|---|
| `service/src/pipeline.ts` | 289 | the video's path, to run the pipeline |
| `service/src/dry-run.ts` | 166 | the plan path, to price a run |
| `service/src/steps.ts` | 184 | the plan path, to describe the build |
| `service/src/transcript-view.ts` | 115 | the plan, for the word editor |
| `service/src/keyword-view.ts` | 82 | the plan, for the keyword picker |
| `service/src/image-view.ts` | 153 | the plan, for the picture picker |

Every one answered `no reel labelled "<x>" in benchmarks/footage.json` when the
video was absent, and **a real client video could never be in that list**: it is
a committed file describing five gitignored test reels, with a fetch note saying
they are the agency's own footage and have no download.

Four command-line tools also read it — `frames`, `segment`, `zones`, `place`,
`components` — and those are corpus tools by definition. They are unchanged.

**What the catalogue legitimately provides**, and is still the only thing it
provides: the five reels' labels and paths, a `durationS` per reel, and — since
session 10 — a `sha256`, a byte count and a fetch note that `npm run doctor`
verifies. All of that is a **test-corpus** concern. **What the product needs**
is narrower: a path, a duration, a frame size, an audio track and a hash, and
every one of those can be read from the file.

**What a video needs before it can run**, derived from the code:

| | corpus reel | browsed video, now |
|---|---|---|
| path | `footage.json`, re-rooted | the dialog, used as given |
| duration | `footage.json` | ffprobe, at open |
| frame rate | never read at run time | ffprobe, at open (recorded) |
| dimensions | assumed 2160 x 3840 | ffprobe, at open — **and refused if it is anything else** |
| sha256 | the plan's `source.sha256` | streamed once at open, kept in the registry |
| a plan | beside the video | `.local/plans/`, written by the first run |
| a client | picked in the panel | picked in the panel |
| a label | `footage.json` | the file's own name |

**Where the "did not say what this build would contain" message came from:**
`panel/src/Build.tsx:103`. It fires when `preview === undefined` and a video and
a client are both picked. `preview` is `plan.build` from `GET /steps`, and
`stepsFor` returns **no build preview at all** for a reel with no plan — it
returns early with the build step's own reason, *"Nothing has been transcribed
yet."* So the state was legitimate, the service had answered, and the panel
blamed it and named a restart.

**Why session 26's test did not catch it.** It asserts that no screen contains
`npm run` and none contains *terminal*. Neither string appears in *"Quit After
Effects and open it again."* **The rule had been written as two examples of
itself.**

**Every other message that sends the user outside the panel**, found by reading
the source rather than waiting for a screenshot:

| where | what it said |
|---|---|
| `panel/src/Build.tsx:103` | *Quit After Effects and open it again.* |
| `panel/src/service.ts:81` | *close the panel and open it again* (on a 401/403) |
| `panel/src/Images.tsx:288` | *restart the service* |
| `panel/src/index.tsx:20` | *run `npm run panel:build`* — the pre-React fallback |
| `service/src/build/requirements.ts:170,182` | bare `npm run watermark:measure` and `npm run loudness:measure` |

The last two are **stale**: Block 9 session 13 made the pipeline take both
measurements itself, and the sentences were never brought forward.

### 2. Browse accepts any video

**`service/src/videos.ts`** is the registry. Opening a video through
`GET /video?path=` now **writes it down** in `.local/videos.json` with its
duration, frame rate, dimensions and sha256, read from the file itself. That is
the whole of the fix: the panel sends a label on every later call, and there is
now something on the service side that knows what a browsed label means.
`listReels()` is the corpus plus the registry, deduplicated by path.

**The label is the file's own name without its extension** — `sora.mov` is
`sora`. It is what he called it and what he will look for in the picker; any
name this tool invented would be one more thing to learn. **A second file
wanting the same name gets its folder in front of it** (`Work in Progress/sora`)
and a third a short hash of its full path, because the label is what every later
call sends and two files sharing one would silently caption the wrong video.
**It is not editable**: a name the user can change is a second identifier to
keep in step with the plan, the cache and the build, and nothing needs one.

**Where his video's things go.** The plan is
`.local/plans/sora-<8 hex of its path>.editplan.json`; cache entries and cutouts
were already keyed by video hash under `.local/`; the built comp was already
`.local/build/sora-full.aep`. **`editPlanPathFor` is the one declaration** and
it branches on `classifyStoredPath`: inside the repository a plan still sits
beside its video — the five corpus reels, and every path in every report depends
on that — and outside it does not. Writing a JSON file into a client's *Work in
Progress* folder is this tool leaving something behind in work that is not its
own.

**The resolver returns his path unchanged, and it was run rather than assumed**:
`classifyStoredPath` answers **`outside-the-repo`** for `sora.mov` and
`resolveStoredPath` returns the identical string. That is the branch session 11
wrote for exactly this case, and it is the branch taken.

**A video the tool cannot use is refused the moment it is opened**, before any
money can move, each refusal naming which one it is: not a video file, nothing
at that path, no readable video stream, no duration, **no audio track** (*"there
is nothing to transcribe. Export it with its sound and try again."*), or **not
2160 x 3840** (*"this tool only builds 2160 x 3840 upright video. Everything it
places — the subtitles, the pictures, the watermark — is measured against that
frame."*). The last is a product limitation PROJECT_SPEC §4 already records, and
refusing by name is the alternative to a comp that looks built and is wrong
everywhere.

### 3. No message sends the user out of the panel

- **`Build.tsx`** now says the service's own reason when there is one —
  *"Nothing has been transcribed yet. Press Run pipeline above, and this will
  say what the composition will contain."* — the staleness sentence when the
  service really is behind, and *"There is nothing to build for this video
  yet."* when it answered nothing at all. **No restart, in any branch.**
- **`service.ts`** 401/403 → *"the panel is using an old connection to the
  companion service — use Try again in the line at the top"*, which is a control
  on the readiness line.
- **`Images.tsx`** → *"the panel could not work out which picture this is — the
  companion service is older than this panel"*, which is the fact; session 26's
  repair is what acts on it.
- **`index.tsx`** → names the broken bundle and stops. The command it gave is
  one the user has no way to run, and React never mounted, so no repair
  machinery exists on that screen.
- **`requirements.ts`** → the watermark and loudness remedies now name **Run
  pipeline first**, with the terminal command after it, exactly as `face-masks`
  has since Block 9. `tools/cv/setup.sh` keeps its bare command: installing the
  picture tools is a machine setup step no panel can do.

**`panel/src/leave-the-panel.test.ts` is the strengthened check**, and it reads
the source the way `path-fields.test.ts` pins that no path is typed. It fails on
any instruction to quit, restart, reopen or relaunch anything, and on `npm run`
or *terminal*.

**Run against the messages as they were before this session, it names all
four:**

```
Build.tsx: "Quit After Effects"
Images.tsx: "restart the service"
index.tsx: "npm run"
service.ts: "close the panel and open it again"
```

It found `index.tsx`, which the reading above had not. Against the fixed
messages it passes. **`host.ts` is the one exemption and it is stated in the
test**: a panel loaded without CEP's Node bridge has no service to repair and no
bundle to rebuild, and After Effects reads its extensions folder at launch, so
naming the restart is the only true sentence available there.

### 4. His own video, taken as far as it goes without spending

**Driven through the built panel bundle against a real service**, with only
CEP's bridge and the native file dialog stubbed — the dialog because no
automated run can click one. Every line below is what the page did.

| | |
|---|---|
| pressed **Browse…** | the panel opened `sora.mov` and the video picker changed to **sora** |
| what it read from the file | 40.5405 s, 29.97002997 fps, **2160 x 3840**, ProRes 422 HQ, PCM stereo 48 kHz |
| sha256 | `344265a0…`, streamed once and kept |
| plan | none yet — `.local/plans/sora-<hash>.editplan.json` when it is first run |
| uncaught page errors | **0** |

**What the panel now shows**, verbatim from the page:

- **Cost** — *"No edit plan yet. No client saved for this video yet. Run the
  pipeline and it is saved for you."* then per stage: **Transcribe and correct
  — will run, about $0.17**; **Keywords and image slots — will run, about
  $0.18**; **Generate images — will run, about $3.98**; **Looking at the video —
  will run**, free, *"it can take a few minutes the first time for a video"*.
  Total **about $4.33**, labelled *"the most it could cost, not what it will"*.
- **Run pipeline** — **enabled**.
- **Build** — *"Nothing has been transcribed yet. Press Run pipeline above, and
  this will say what the composition will contain."*
- **On screen, none of**: `Quit After Effects`, `open it again`, `npm run`,
  `terminal`, `footage.json`, `no reel labelled`.

**Where it stops, and what the first billable call is.** Nothing was run. The
first call would be **ElevenLabs Scribe**, then the Gemini correction pass —
together the transcription stage, **about $0.17** and priced pessimistically;
the ledger's twelve production transcriptions average **$0.148**.

**One thing he needs to know before pressing Run**, and it is arithmetic rather
than a defect: **`PIPELINE_CEILING_USD` is $4.00** and this reel is budgeted at
**$4.33**. The ceiling is a running check against the ledger before each
billable request, so transcription and analysis would complete for about $0.35
and **the images stage would refuse before generating anything**, naming the
ceiling. That is the gate working — a run is aborted, never truncated — but on
this reel it means the pictures need either a raised ceiling or fewer slots. At
40.5 s and `IMAGE_SLOTS_PER_30S` = 8 the planner wants **11 slots, 22
candidates**; the five corpus reels are 21–26 s and want 6.

**What had to be invented, because a browsed video does not have it** — and this
is where the next defect lives:

- **the label**, from the filename, with a collision rule nothing has yet
  exercised;
- **the plan's location**, `.local/plans/`, which no report or migration knows
  about;
- **the frame-size refusal**, chosen from PROJECT_SPEC §4 rather than measured
  — a 1080 x 1920 client video is refused today and nobody has decided that is
  right;
- **the audio check**, which asks only whether a stream exists, not whether it
  carries speech.

---

## Deviations

**A fourth commit was needed.** `job.test.ts` writes plans for a video in a
temporary directory, which is *outside the repository* and therefore now routes
to `.local/plans/` — 65 stray files were left there by the first full test run.
The tests clean up what they write now, and a full `npm run check` leaves the
directory empty. That is a defect this session introduced and closed inside it.

**`FRAMOPIA_VIDEO_REGISTRY` was added** so a test's answer does not depend on
which videos the machine has opened. Without it, `clients/videos.test.ts`
started failing the moment a real client reel was browsed — a test depending on
the tester.

**Two build requirements were reworded**, which is service code rather than a
panel message. They tell the user to run terminal commands for measurements the
pipeline has taken itself since Block 9 session 13, and §1.5 asked for all of
them.

**No corpus plan, cache entry, mode file, template, generated image or hand-made
reference was touched**, `benchmarks/footage.json` is unchanged and the doctor's
footage check is untouched.

## Failures & open problems

**Unproven, by name:**

- **Nothing has been transcribed under any of this.** The whole path is proven
  up to the first billable call and no further. Whether a 40.5 s ProRes file
  extracts audio cleanly, whether Scribe handles it, and whether the new
  orthography rules hold on real client speech are all unanswered.
- **The label collision rule has never fired.** One browsed video exists. The
  folder-prefix and hash branches are unit-reasoned, not observed.
- **The frame-size refusal has never been seen.** `sora.mov` is exactly
  2160 x 3840; no video of another size has been offered to it.
- **The audio refusal has never been seen** either, for the same reason.
- **None of this has been seen inside After Effects.** The panel was driven in
  Playwright's Chromium with the host's file and cross-origin allowances; CEP
  itself was not used.
- **`.local/plans/` is new and nothing else knows about it** — no migration, no
  backup group, no report generator walks it. A browsed video's plan is
  therefore **not in the backup set**, which is the same finding session 27
  recorded for a client's photographs.

**Open, and untouched as the brief required:** `preflight.ts` not checking a
client picture's file; the client photographs missing from the backup set; the
three false-premise tests; `build-reel.jsx`'s guard; `ground-truth`'s
unbuildability. **The panel's image-picker tests did not flake** in either full
`npm run check` run.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `b710733` *docs: record where a browsed video lives* (this report follows) |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at both ends |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c` |
| cache | **46 entries / 80 files / 54,256 KB** at both ends |
| **`sora.mov`** | **`344265a032513979f101133e68622adf95f001844def480cbeaf3bd9b297bd85`, identical at both ends**; its folder holds the two files it held before |
| After Effects | one instance, 0 `aerender`; nothing saved |
| free space | **291 GiB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references, sha256, identical at both ends:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Corpus Edit Plans, sha256.** `ground truth` unchanged; the other four moved
for one reason only — `npm run golden` builds all four and each build writes a
fresh `builtAt`.

```
start                                                             end
0712e412…  ground truth   →  0712e412…  (unchanged)
77ae4a26…  test 1         →  2e2a7ae7…  (golden's builtAt)
403e942f…  test 2         →  159e0db5…  (golden's builtAt)
9515b3f6…  test 3         →  be8e3f40…  (golden's builtAt)
7563523d…  vitasilk       →  0cfce227…  (golden's builtAt)
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 751 | 751 |
| service | 1209 | **1211** |
| benchmarks | 173 | 173 |
| panel | 204 + 2 skipped | **207 + 2 skipped** |
| pytest | 149 | 149 |
| claude-md | `8,625 of 20,000` | `8,790 of 20,000` |
| modes / templates / ExtendScript / panel manifest | unchanged | unchanged |
| references | `6 hand-made reference file(s)` · `PASS` | unchanged |
| attribution | `PASS` | `773 tracked text file(s), 740 commit message(s)` · `PASS` |

Service **+2**: two new `editPlanPathFor` cases for a video outside the
repository. Panel **+3**: two in `leave-the-panel.test.ts` and one splitting the
Build pane's no-preview cases in two.

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field: test-1 4415,
test-2 4280, test-3 3709, vitasilk 4770, **17,174 fields**. The reference was
**not re-recorded**.

## Suggested next step

**Transcribe `sora.mov` and read the words.** It is the first real client video
this tool has ever been given and the first speech it will have transcribed
under the Arabic-first rules session 29 wrote, and neither has been observed.
Everything downstream — the keywords, the pictures, the cards — is built on the
transcript, so a bad one is worth finding for $0.17 rather than after $4.

The one thing to decide before the pictures: **11 image slots on a 41-second
reel costs $3.98 and the pipeline's own ceiling is $4.00**, so a full run stops
before them by design. Either the ceiling moves or the reel gets fewer pictures,
and that is a judgement about how a 41-second reel should look rather than a
number to raise quietly.

---

## What to do to run his own video

1. **Window → Extensions → Framopia Studio.**
2. Choose the client, then press **Browse…** under Video and pick
   `sora.mov`. It takes a moment — the tool reads the file and hashes it once.
3. Read the **Cost** block. It will say **about $4.33**, which is the most it
   could cost.
4. Press **Run pipeline**.

**What it will actually cost:** transcription **about $0.17**, then keywords and
image slots **about $0.18**. The pictures — budgeted $3.98 — will be **refused
by the $4.00 ceiling** before any are made, so the run stops there having spent
about **$0.35**. Nothing is lost: the words, the keywords and the image slots
are all on the plan, and the pictures are a separate decision once he has seen
them.

## Commits

| | |
|---|---|
| `dcd7b8b` | `fix: let the panel open any video, not only the test corpus` |
| `afb53e5` | `fix: stop every message that sends the user out of the panel` |
| `d1fa319` | `test: clean up the plan a transcription test writes` |
| `b710733` | `docs: record where a browsed video lives` |
| this one | these reports |
