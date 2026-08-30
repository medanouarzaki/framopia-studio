Status: OK

# Block 10 session 1 — ground state, measured dry-run costs, the first observed build

**Spent $0.00; no API was called.** Ledger **116 lines, sha256
`e5e0a6e9…c132cb`, byte-identical at both ends.** `templates/library.aep`
sha256 `1d7553e894…2dc4a5d8` at both ends. The cache is **byte-identical**
before and after: 44 entries, 55,355,647 bytes, 77 files, no entry created,
none evicted, none renamed. After Effects: one instance (pid 79146) and zero
`aerender` at both ends; it was neither launched nor quit.

Machine-readable companion: `reports/block-10-ground-state.json`.

## 1. Done

### Preconditions (all six pass)

| | measured |
|---|---|
| mount and repo | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `package.json` name `framopia-studio` |
| After Effects instances | **1** |
| `aerender` processes | **0** |
| ledger | **116 lines**, sha256 `e5e0a6e9d6735188065fdbcb33bb9211cf1fc95a5cbc23b192ad246299c132cb` |
| `templates/library.aep` | sha256 `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| git | branch `main`, working tree clean, HEAD `f1ab167` *docs: report block 9 session 14* |

### Machine and toolchain

| | |
|---|---|
| macOS | 26.6.2 (25G83), Apple M3, arm64 |
| computer name | MacBook Air (2) |
| machine label (`.local/config.json`) | `anouar-mbp` |
| config keys present | `elevenLabsApiKey`, `googleApiKey`, `machineLabel`, `backupDir` — values not read or logged |
| node / npm | v24.14.1 / 11.11.0, `.nvmrc` = `24` |
| python (`tools/cv/.venv`) | 3.11.14, venv present |
| ffmpeg / ffprobe | 8.0.1, both at `/opt/homebrew/bin` |
| git | 2.50.1 (Apple Git-155) |

### After Effects

Read over `DoScript` into the running instance.

| | |
|---|---|
| `app.version` / `app.buildName` | **26.0x67** |
| process started | Thu 2026-08-27 21:00:05, uptime 2d 18h 19m at census |
| project open at census | **none** — no file, `dirty: false`, `numItems: 0` |
| `app.fonts.allFonts` name count | **1198** |

**All three K2 faces the mode declares are installed**, checked before anything
in this session wrote to After Effects: `Inter-SemiBold`,
`CormorantGaramondItalic-SemiBoldItalic`, `Almarai-Bold` — `missingFonts` is
empty. The names checked are `fonts.postScriptNames` read out of
`modes/k2-syndicalia.json`, not assumed. The check runs through
`panel/jsx/fonts.jsx`, the same reader `build-reel.jsx` uses.

**On whether that check is suspect** — see *Failures & open problems* §3.1. The
short answer is that the pollution sentinel is absent and the recorded claim
does not reproduce, so the result cannot be dismissed *or* fully trusted.

### Docs on disk

| file | stated version | `##` sections |
|---|---|---|
| `docs/PROJECT_SPEC.md` | Version: 1.0 (Foundation conversation, 2026-08-10) | 9: What this is · Users and environment · Hard constraints · Input / output (locked) · Locked product decisions · Architecture (summary) · Transcription strategy · Template library · Quality bar |
| `docs/ARCHITECTURE.md` | Version: 1.0 (Foundation) | 8: The three pieces · Repo layout · The Edit Plan (schema v1) · Data flow · Stage notes · Caching & costs · Dev environment · Error philosophy |
| `docs/CLAUDE_CODE_GUIDELINES.md` | Version: 1.0 | 6: No AI fingerprints · Stack conventions · Testing expectations · Session report · CLAUDE.md maintenance · Safety rails |
| `docs/ORTHOGRAPHY_GUIDE.md` | **v1.0.8**, frozen (title line and Status paragraph; no `Version:` line) | 10: Scope · Arabizi character conventions · Vowels · 3a Numbers · Freeze list · Code-switch boundaries · Latin vs Arabic script · Cleaning rules · Punctuation & casing · Resolved decisions |
| `docs/DECISION-image-config.md` | no version line; **Status: frozen**, settled 2026-08-25 | 9: The frozen config · The evidence · Known caveats · six dated amendments (gate advises · cutout metrics scoped · nothing measures fidelity · pictures too dark · literal or atmospheric · fragments applied · framing axis loses wide) · References |
| `docs/DECISION-transcription-config.md` | no version line; dated 2026-08-24 | 10: The frozen config · Run C · Why not the alternatives · Known caveats · prompt v2 reverted · v3 activated · v4 activated · transliteration cost adopted · References · corpus pinned at guide v1.0.7 |

The conversation's copies were not stale on any point checked.

### Corpus

Every figure read out of the plan on disk this session.

| | ground-truth | test-1 | test-2 | test-3 | vitasilk |
|---|---:|---:|---:|---:|---:|
| video sha256 (16) | `2b3957559a491ee9` | `365967c9fd2c82f7` | `c3a2ac59de3dc1ec` | `20f8c61d4f01f867` | `99dfe0e530ab85d1` |
| duration s | 23.2566 | 21.9886 | 22.3223 | 21.1878 | 25.6923 |
| fps | 29.97003 | 29.97003 | 29.97003 | 29.97003 | 29.97003 |
| frame | 2160x3840 | 2160x3840 | 2160x3840 | 2160x3840 | 2160x3840 |
| words | 76 | 67 | 69 | 58 | 73 |
| subtitle groups | 76 | 67 | 69 | 58 | 73 |
| superseded | 0 | 3 | 5 | 0 | 5 |
| **rendered cards** | **76** | **64** | **64** | **58** | **68** |
| keywords | 0 | 2 | 3 | 0 | 3 |
| image slots | 0 | 4 | 0 | 0 | 5 |
| candidates | 0 | 8 | 0 | 0 | 10 |
| **chosen candidates** | **0** | **0** | **0** | **0** | **0** |
| sfx events | 0 | 4 | 0 | 0 | 5 |
| zones | 7 | 18 | 19 | 7 | 20 |
| dialogue LUFS / peak dBFS | −13.9 / 0.1 | −14.0 / 0.1 | −14.6 / 0.2 | −14.6 / 0.1 | −14.4 / 0.0 |
| `clientMode` | **null** | k2-syndicalia v5 | k2-syndicalia v5 | **null** | k2-syndicalia v5 |
| `clientSnapshot` | absent | k2-syndicalia **v10** | k2-syndicalia **v10** | absent | k2-syndicalia **v10** |
| `watermark` on plan | null | null | null | null | enabled, **medium** |
| `build.status` | none | none | none | none | **none** |
| `build.aepPath` / `builtAt` | null | null | null | null | **null** |
| `costs.spentUsd` | absent | 1.22066 | 0.412818 | absent | 1.550444 |

Corpus totals: **343 words, 343 groups, 13 superseded, 330 rendered cards,
8 keywords, 9 image slots, 18 candidates, 0 chosen, 9 sfx events, 71 zones.**
`clientMode.version` reads 5 on three plans, `clientSnapshot.version` reads 10,
and the mode file is at **12** — three different numbers, none of them a
defect, all recorded provenance.

### Cache census

| video sha256 (16) | reel | analysis | imageslots | images | transcription | entries | bytes |
|---|---|---:|---:|---:|---:|---:|---:|
| `20f8c61d4f01f867` | test-3 | — | — | — | 2 | 2 | 1,409,998 |
| `2b3957559a491ee9` | ground-truth | — | — | — | 2 | 2 | 1,560,036 |
| `365967c9fd2c82f7` | test-1 | 3 | 2 | 8 | 2 | 15 | 21,326,116 |
| `99dfe0e530ab85d1` | vitasilk | 3 | 2 | 14 | 3 | 22 | 29,561,902 |
| `c3a2ac59de3dc1ec` | test-2 | 1 | — | — | 2 | 3 | 1,497,595 |
| **totals** | 5 videos | 7 | 4 | 22 | 11 | **44** | **55,355,647** (77 files) |

Identical after the build — byte-for-byte, established by diffing the two
census dumps rather than by re-reading the totals.

### Watermark facts

`.local/build/watermark.json` **exists**, schema 1, measured
2026-08-30T13:09:41Z against `assets/watermark/intro.mov` sha256
`99edc649…11886e`: 1924x2154, 2.035367 s = **61 frames** at 30000/1001,
alpha plane present and **premultiplied**, three beeps ending at **0.400 s**,
audio mean −18.3 dB / max −0.5 dB.

`.local/build/loudness/` holds **one** record, `vitasilk.json` (−14.4 LUFS,
LRA 1.2, true peak 0.0 dBFS, measured 2026-08-30T13:09:41Z, carrying the source
path and sha256). The other four reels carry their loudness on the plan but
have **no per-reel record on disk** — see §3.4.

Both directories are gitignored, so a second machine starts with neither. That
is the Block 10 path and it is untested.

### `npm run check`

**Exit code 0, `check: PASS`.** Counts read out of the run's own output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 39 | 547 |
| `framopia-service` | 90 | 1146 |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

Gates: `mode k2-syndicalia v12: ok (fonts set)` · `templates: 6 entries, ok` ·
`extendscript: 12 .jsx file(s) ok` · `validate-templates: 6 template(s) ok,
audited against library.aep` · `validate:panel: panel/CSXS/manifest.xml ok` ·
`references: PASS` · model pins `birefnet-general ok`,
`selfie-multiclass-256x256 ok`.

Every count matches what `handoffs/block-9.md` implies (it quotes 1146 for the
service). The one figure that does **not** match a claim carried in `CLAUDE.md`
is the reference version — see §3.5.

## 2. Measured dry-run cost for every reel

Through `dryRun(reel, 'k2-syndicalia')` — the function `GET /dry-run` calls.
It bills nothing and it called nothing.

| reel | transcription | analysis | images | zones | **total** |
|---|---|---|---|---|---:|
| ground-truth | skip (compatible) | **run, $0.18** | **run, $2.1708** | skip | **$2.3508** |
| test-1 | skip (compatible) | skip | skip (exact, 8/8 cached) | skip | **$0.0000** |
| test-2 | skip (compatible) | skip | run, no estimate | skip | **$0.0000** |
| test-3 | skip (compatible) | **run, $0.18** | **run, $2.1708** | skip | **$2.3508** |
| vitasilk | skip (compatible) | skip | skip (exact, 10/10 cached) | skip | **$0.0000** |

**The three analysed reels read $0.00, as expected.** Nothing to escalate.

Two notes on what the table means rather than what it says:

- **Every reel resolves transcription `compatible`**, reusing
  `transcription-758a3924d090d1b5` (prompt v4, orthography guide v1.0.7) while
  the guide file is at v1.0.8. That is the recorded pin, said out loud by the
  tool rather than silently.
- **`test-2`'s images stage reads `run` with no estimate** — "no image slots on
  the plan, and analysis has already run without planning any". A run reaches
  the stage and finds nothing to generate. $0.00 is correct and the action is
  not `skip`, which is honest.
- `ground-truth` and `test-3` are the two reels that would exercise both
  unobserved prompt changes. $2.3508 each reproduces the handoff's $2.35
  exactly, and the two together are **$4.70 of the ~$6.82 remaining**.

Written into `reports/block-10-ground-state.json` in full, per-stage, with each
stage's fingerprint and note.

## 3. The build of `vitasilk`

### What was driven

`runBuildJob({reel: 'vitasilk', planPath, onProgress})` from
`service/dist/build/job.js` — **the function `POST /jobs {type:"build"}` calls,
not a reimplementation.** It spawned `service/dist/build/build-reel-cli.js`
with `FRAMOPIA_BUILD_STAGES=1`, exactly as the job does, and the three declared
stages reported in order: `prepare` → `after-effects` → `check`.

**Wall clock 5.091 s. `done: true`, `error: null`, `savePath` reported.**
Nothing billed: the ledger is byte-identical.

### Which surfaces this exercised, and which it did not

Exercised: `runBuildJob`, the spawn of the build CLI, the stage-marker
protocol, `readSavePath`, the whole TypeScript build path, `build-reel.jsx`
under `DoScript`, and After Effects itself.

**Not exercised, and each is a real gap:**

- **The panel's Build button was not pressed.** Nothing went through React,
  through the panel's job polling, or through the panel's rendering of
  `BuildProgress`.
- **Nothing went through CEP's `evalScript`.** The panel's own route to
  ExtendScript is untouched by this session; the build reaches After Effects
  over AppleScript from a spawned Node process, which is a different path.
- **The service's HTTP layer was not used.** `runBuildJob` was called in
  process; `POST /jobs`, the token wall and `GET /jobs/:id` were not.
- **`GET /dry-run` was likewise called as a function, not over HTTP.**

A claim about the host made from outside the host is not evidence, so: this
session establishes that the build code path works when driven from Node on
this machine. It establishes nothing about the panel.

### Read back out of After Effects and off the disk

Not from the build's success report — from a read-only `DoScript` census of the
project After Effects is holding, and from `stat`/`shasum` on the file.

**The file.** `/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/vitasilk-full.aep`,
**9,190,491 bytes**, mtime 2026-08-30 15:20:41, inside `.local/build/` — the
project's own working area, over the build's previous output and over no user
asset. sha256 moved `6d685924…` → `d8bdf144…` at identical byte length.

**The project.** After Effects holds that exact file, **`dirty: false`**,
97 items, **84 comps**.

| | |
|---|---|
| `master_final` | 2160x3840, 25.6923590 s, 29.9700317 fps, **83 layers** |
| `master_subs_only` | 2160x3840, 25.6923590 s, 29.9700317 fps, **72 layers** |
| element comps | 82 — 68 `sub_pop`, 3 `kw_slam`, 5 `img_float`, plus the 6 imported library templates |

83 = 68 subtitles + 3 keywords + 5 images + 5 sfx + 1 watermark + 1 footage.
72 = 68 + 3 + 1 footage.

**Every text comp, checked rather than sampled.** 71 text comps, **142 text
layers read**:

- every one carries exactly `TXT_MAIN` and `TXT_MAIN_SHADOW` — **0 comps with
  an unexpected layer set**, so no duplicated or undeclared text layer exists;
- **0 placeholder words survive anywhere** — none of `kan9olo`, `Booster`,
  `المنطقة`, `شد طبيعي` appears on any layer;
- `TXT_MAIN` and `TXT_MAIN_SHADOW` carry the identical string in all 71, and
  that string equals what the Edit Plan says the element reads (whitespace
  normalised, so a wrapped card still matches). **0 mismatches.**

**Fonts, read back from After Effects and compared against
`fonts.postScriptNames`:**

| template | layer | font | comps |
|---|---|---|---:|
| `sub_pop` | `TXT_MAIN` | `Inter-SemiBold` | 68 |
| `sub_pop` | `TXT_MAIN_SHADOW` | `Inter-SemiBold` | 68 |
| `kw_slam` | `TXT_MAIN` | `CormorantGaramondItalic-SemiBoldItalic` | 3 |
| `kw_slam` | `TXT_MAIN_SHADOW` | `CormorantGaramondItalic-SemiBoldItalic` | 3 |

**0 mismatches.** `vitasilk` is all-Latin, so no `_ar` variant and no
`Almarai-Bold` appears — correct for this reel and the reason the Arabic face
is unexercised by this build.

Fill colours: 68 `TXT_MAIN` at (0.9725, 0.9647, 0.9490) = crème `#F8F6F2`,
3 at (0.7882, 0.6628, 0.4314) = Or Signature `#C9A96E`, and all 71
`TXT_MAIN_SHADOW` at (0.5098, 0, 0) = Rouge K2 `#820000`.

**The other layers of `master_final`:**

| | |
|---|---|
| footage | `vitasilk.mov`, in 0 → out 25.6924, position [1080, 1920], audio **−3.07 dB** — the derived dialogue attenuation |
| watermark | `assets/watermark/intro.mov`, **layer index 6**, in 0 → **out 1.000** (the flat second), `alphaMode` **5414 = PREMULTIPLIED**, audio **−20 dB**, scale 16.8399% → **324.0 px wide** = `medium`, position [1890, 289.366] → **108 px from the right edge and 108 px from the top** |
| images | 5 × `img_float`, all at scale 69.7333% → **836.8 px**, the reel's one common size; positions x 483–525, y 483–514 — the top-left corner |
| sfx | 5 × `whoosh_01.wav`, all at **−13.24 dB**; starts 19.4528, 16.3830, 11.0777, 5.7057 and **−0.46713** — the last with `inPoint` 0, the negative-`startTime` case, honoured |

Every image comp's `IMG_MAIN` points at a file that **exists on disk**: four at
the generated JPEG in the image cache, `img002` at
`cutouts/vitasilk/img002-c1.cutout.on-fill.png`. Each is the `-c1` candidate of
its slot, which is right: **no slot carries a `chosenCandidateId`**, so
`buildChoiceFor` takes the first. All five element comps are `img_float` even
where the plan's `templateId` is `img_slide_left`, which is Block 7 session 9's
card-for-every-slot rule working as recorded.

### `build.status` was not written back — see §3.2

## 4. Deviations

1. **The dry run and the build were called as functions, not over HTTP.**
   `dryRun()` and `runBuildJob()` are the exact functions `GET /dry-run` and
   `POST /jobs {type:"build"}` call, and `runBuildJob` spawns the same CLI file
   a terminal runs, so no logic was substituted. What was skipped is the
   service's HTTP and token layer and the panel above it. Starting a service
   would have taken the handshake lock; the prompt forbids approximating the
   build path but says nothing about the transport, and naming what was not
   exercised is more useful than a claim that it was. Listed under §3.
2. **The two `.jsx` instruments this session used live in the session
   scratchpad, not in the repo**, because the prompt says nothing but the two
   reports, the JSON and `CLAUDE.md` may change. Both were run through
   `scripts/check-extendscript.mjs` before reaching After Effects, both are
   ES3, and both are strictly read-only: they open nothing, set nothing, save
   nothing, and in particular never write `TextDocument.font`.
3. **`.local/build/vitasilk-full.aep` was overwritten.** It is the build's own
   previous output and the build's declared save path; the previous file's
   size, mtime and sha256 are recorded above and in the JSON.

## 5. Failures & open problems

### 5.1 The font check cannot be certified either way, and the recorded reason for that does not reproduce

The prompt asks whether After Effects has been restarted since a script last
set a font name, because a name set but not installed pollutes
`app.fonts.allFonts` for the rest of the application session and then reports
itself installed.

**It has not been restarted.** The process started 2026-08-27 21:00:05 and has
been up 2d 18h; `tools/ae/measure-fonts.jsx` wrote `FramopiaNoSuchFaceZZQX` on
2026-08-30 00:14:15 — inside this same process, per its own
`.local/build/font-measurements.json`. So on the record the list should be
polluted.

**It is not.** Probing for the sentinel by name returns it as **missing**. And
the name count is **1198** now against **1200** recorded at that measurement —
two fewer, not one more. Neither figure is explained.

Three readings, and nothing here separates them: the pollution does not
persist as recorded; or it persists somewhere `framopiaInstalledFontNames` does
not look (it splits each `allFonts` entry on commas, so a lone synthetic name
should appear as its own entry, which argues against this); or the list was
rebuilt by something between then and now. **The consequence is that "all three
faces are installed" is reported here as an observation and not as a
certification.** The one thing that would settle it is a restart of After
Effects, which this session may not do.

The build itself is unaffected — it wrote no font name that is not installed,
and the count is unchanged at 1198 across the build.

### 5.2 Nothing ever writes `build.status`, `build.aepPath` or `build.builtAt`

**`vitasilk`'s Edit Plan is byte-identical before and after a successful
build** — sha256 `c8501bca…63c20` both times — and its `build` block still
reads `{"status": "none", "aepPath": null, "builtAt": null}`. All five plans
read the same.

ARCHITECTURE §3 defines the field and `service/src/editplan/merge.ts` acts on
it: a transcript change marks a `built` plan **`stale`**. **That branch can
never fire**, because no plan ever reaches `built`. So a reel that was built
and then edited is indistinguishable from one that was never built, and the
panel has no way to say "this comp is older than the plan it came from".

This is the sibling of the defect Block 9 session 14 fixed one layer up: the
build knew its own save path and did not report it. It now reports it to the
caller, and the caller does not persist it. Not fixed here — the session's job
is the "before" — and it is a candidate for the next session, being small and
entirely local.

### 5.3 The watermark is layer 6, not layer 1

Block 7 session 10 recorded the mark at **index 1 with 0 layers above it**.
Read back today it is **index 6**, with the five SFX layers above it.

Not a defect: an audio layer has no video and occludes nothing, and the five
above it are all `whoosh_01.wav`. But "0 layers above it" is no longer a true
description of the built comp, and a future check written against that sentence
would fail on a correct build. The property that actually matters — no visible
layer above the mark — held and was not asserted anywhere.

### 5.4 Only one reel has a loudness record on disk

`.local/build/loudness/` holds `vitasilk.json` alone, while all five plans
carry `dialogueLufs` and `dialoguePeakDbfs`. The other four got theirs from the
corpus sweep plus `migrate:sfx-placement`; only `vitasilk` has been through the
pipeline since the measurement became driven.

It costs nothing today — the build reads the plan, not the record — but it
means **the driven measurement path has been exercised on exactly one reel**,
and the freshness comparison (source path and sha256 against the video as it is
now) has one sample. A second machine has zero.

### 5.5 `CLAUDE.md` states a reference version the repo does not have

`CLAUDE.md` says *"All four references are versioned, and all four are now
`v1.0.6-conformant`"*. All four headers on disk read **`v1.0.8-conformant`**,
and `npm run bench:verify-refs` confirms them clean at that version inside
`npm run check`. Corrected in `CLAUDE.md` this session.

### 5.6 What remains untested

- **The panel.** Not opened, not driven, not observed. Everything in §3 was
  driven from Node.
- **CEP `evalScript`.** The panel's own route to ExtendScript is unexercised.
- **The second machine.** Nothing here says anything about it. The two
  gitignored inputs a fresh machine lacks — `.local/build/watermark.json` and
  `.local/build/loudness/` — both exist here, so the cold path was not walked.
- **`ground-truth` and `test-3`**, and with them both unobserved prompt
  changes. Priced at $2.3508 each and not run.
- **`Almarai-Bold` in a build.** `vitasilk` is all-Latin, so this build placed
  no Arabic type. `test-2` is the reel that would.
- **`DoScript` unresponsiveness.** Every call this session returned `0` on the
  first attempt; the retry path the prompt specifies was never entered, so the
  known several-minute refusal from Block 9 session 5 remains unreproduced and
  unexplained.

Nothing was destroyed or lost this session. No cache entry, plan, template,
generated image or ledger line changed.

## 6. Repo state

- Branch **`main`**, HEAD before this session's commit: **`docs: report block 9
  session 14`** (`f1ab167`). Working tree clean at the start.
- **`npm run check`: exit 0, `check: PASS`.** core 547 tests / 39 files ·
  service 1146 / 90 · benchmarks 166 / 16 · panel 159 passed + 2 skipped / 6 ·
  pytest 149. Modes, template manifest, ExtendScript gate (12 files),
  template validator against `library.aep`, panel manifest, reference versions
  and both model pins all pass.
- `.local/costs.jsonl` 116 lines, sha256 `e5e0a6e9…c132cb`, unchanged.
- `templates/library.aep` sha256 `1d7553e894…2dc4a5d8`, unchanged.
- Cache 44 entries / 55,355,647 bytes / 77 files, byte-identical before and
  after.

## 7. Suggested next step

The ground state is clean and the build path is confirmed from Node, so the
next session should write the second-machine install-and-setup doc and then
walk it on this machine against a deliberately cold `.local/build/` — moving
`watermark.json` and `loudness/` aside rather than deleting them — because that
is the only part of the second-machine path testable without the partner's
laptop, and it is exactly where §5.4 says the evidence is thinnest. Persisting
`build.status`/`aepPath`/`builtAt` (§5.2) is a small, free, entirely local fix
that belongs in the same session, since it is the one thing a golden run needs
in order to assert that a build happened rather than that a command exited
zero. Neither costs anything, which matters: $4.70 of the ~$6.82 remaining is
committed the moment `ground-truth` or `test-3` is run, and the golden run
draws on the same pot.
