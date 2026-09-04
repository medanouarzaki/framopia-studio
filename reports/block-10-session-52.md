# Block 10 session 52 — the second name collision, closed

**Status: OK.**

## The two answers

1. **Four places were keyed by a video's filename. Three were still open; all
   four are now fixed** — sampled frames, face masks (with the zones and the
   frame-analysis manifest inside them) and the loudness record. The fourth,
   extracted audio, was closed by session 51. Six further places name a video
   but cannot collide, and each is listed below with why.
2. **Both `sora.mov` files now coexist safely.** They were taken through
   sampling, segmentation and zones together and landed in
   `.local/cv/sora-619b8eaecae4/` (28 frames, 18 zones) and
   `.local/cv/sora-344265a03251/` (82 frames, 28 zones), and both reels rebuilt
   from their own footage.

Both gates are green: **`npm run golden` PASS, 17,174 fields, 4 of 4 reels
identical, nothing re-recorded**; **`npm run check` PASS, exit 0**.

## Done

### Every place keyed by a filename, and what each one broke

| where | what it names | what two `sora.mov` did to it |
|---|---|---|
| `frames/sample.ts:80` `reelFramesDir` | `.local/cv/<name>/frames-2fps/` | **wrong data, silently.** Session 50 sampled her 28 frames straight into the other reel's directory. |
| `frames/segment.ts:69` `reelMasksDir` | `.local/cv/<name>/masks-2fps/`, and `zones.json` and `frame-analysis.json` inside it | **wrong data, and work skipped as done.** The zones stage reported *already done: 28 frames, 18 zones* over 81 masks belonging to a different recording. |
| `build/measurements.ts:180` `loudnessRecordPath` | `.local/build/loudness/<name>.json` | **a harmless clash that threw work away.** The record carries `sourceSha256` and `loudnessIsFresh` checks it, so nothing was ever mixed — but each build of one reel measured over the other's answer, and `.local/build/loudness/sora.json` was hers, not his. |
| `transcription/media.ts:96` `extractedAudioPath` | `.local/audio/<name>.wav` | **wrong data.** Cost $1.01 in session 50. Fixed in session 51; unchanged here. |

Six more places take a name from a video and **cannot** collide. They are
recorded so the next session does not have to look again:

- `videos.ts:112` `labelFor` — deliberately disambiguates: a second file with
  the same name gets its folder in front of it, a third a hash of its path.
- `editplan/io.ts:38` — a plan outside the repo is
  `<stem>-<hash of its full path>.editplan.json`; this is what made
  `sora-6a60ced1` and `sora-995f2d27` distinct in the first place.
- `images/job.ts:116` `cutoutDirFor`, `steps.ts:31` `buildOutputPath` and
  `build-reel-cli.ts:873` (`-shrink.json`) — all keyed on the **plan's**
  filename, which the line above has already made unique.
- `benchmarks/src/audio.ts:37` — the benchmark harness, which only ever sees
  the five corpus reels named in `benchmarks/footage.json`, whose names differ.
  Left as it is and noted rather than changed: it is not on any client path.

### The fix

`service/src/video-identity.ts` is new and holds the one rule:

```
videoDirName({ path, sha256 }) -> "sora-619b8eaecae4"
```

The name he gave the file, then the first twelve hex of its sha256 — so
`.local/` still reads as *sora* to a person looking in it. It **refuses** a
value that is not a sha256 rather than filing under a guess.

`reelFramesDir`, `reelMasksDir` and `loudnessRecordPath` now take that pair
instead of a path, so no caller can name a directory without knowing which
recording it belongs to. Fourteen call sites were changed. The hash is never
computed for this: callers holding a plan pass `videoOf(plan.source)`, and the
research CLIs that take a corpus label resolve it through `reelVideo`, which
reads `source.sha256` from the plan beside the video. `analyseFrames` was
already hashing the file for its freshness check; the hash now simply happens
before the directory name rather than after it.

The panel is unaffected in what it says: `videoNameFromDirName` gives the name
back, so the subtitle preview still reads *a real frame from ground truth*.

### The tests, and the proof they fire

`service/src/video-identity.test.ts` — 18 tests. Nine of them call a live path
helper twice, once for each real `sora.mov`, and fail if the two answers are
equal; one asserts each answer still contains `sora`. A tenth reads every
non-test source in `service/src` and fails if a module names a per-video
directory without going through `videoDirName`.

Four mutations, each restored afterwards:

| mutation | result |
|---|---|
| `reelMasksDir` back to `path.basename` | 2 red — *do not share face masks*, *the frame-analysis manifest* |
| `reelFramesDir` back to `path.basename` | 2 red — *do not share sampled frames*, *the frames manifest* |
| `loudnessRecordPath` back to `path.basename` | 3 red, including two in `measurements.test.ts` |
| a new module keying `LOCAL_DIR, 'cv'` without the helper | 1 red — the source guard named the file |

### The migration: nothing recomputed

**Renamed, not regenerated.** Every one of those directories already records
which video it describes — the masks in `masks-2fps/frame-analysis.json`, each
loudness record in its own `sourceSha256` — so `npm run migrate:cv-dirs` reads
the hash that is on disk and moves the directory to the name that hash gives
it. It also repoints the absolute paths inside the manifests it moved: a rename
without that would leave `segmentation.json` naming files that no longer exist,
which is the same silent wrongness one directory over.

**22 moved, 0 recomputed, 0 refused**, and running it again reports
*already named 22*. A directory with no readable hash would be left where it is
and reported. `.local/quarantine-session51/` is outside the walk and was not
touched.

That the migration preserved the masks exactly is not an assertion — golden
compared 17,174 fields afterwards and every one was identical.

## The two files, taken through together

| | hers | the other |
|---|---|---|
| video | `…/Framopia Studio Inputs/Footages/sora.mov` | `…/September Content/Exports/Work in Progress/sora.mov` |
| sha256 | `619b8eaecae4…` | `344265a03251…` |
| length | 13.514 s | 40.541 s |
| directory | `.local/cv/sora-619b8eaecae4/` | `.local/cv/sora-344265a03251/` |
| frames / masks / zones | 28 / 112 / 18 | 82 / 328 / 28 |
| loudness record | `sora-619b8eaecae4.json` | reads the level already on its plan |
| comp | 31 elements, 4 pictures, 4 sounds | 99 elements, 11 pictures, 11 sounds |

Neither directory contains a file belonging to the other; each
`frame-analysis.json` names its own video and its own hash.

**Her reel is unchanged.** Session 51 measured four pictures at 989, 1017, 1013
and 1017 px, every gap 0.000, all inside 13.514 s. This build reports the same
four sizes, the same 31 elements, the same watermark (medium, top-right, 324 x
363 px) and the same dialogue level (-14 LUFS, peak 0.1 dBFS).

**The other reel's masks are its own.** They had to be made again — session 51
quarantined the mixed directory, so the 40.5-second reel had none on disk. That
is a recomputation, and it is reported as one: 82 frames, 328 masks, 43.6 s of
local work, $0.00. It is also the strongest evidence available that nothing
moved, because the 28 zones it derived are **bit-identical** to the 28 the plan
already carried; only `meta.updatedAt` and the pipeline timestamps changed. Its
comp built with the same 99 elements and 11 pictures as before.

## Deviations

**One thing outside this session's brief had to be fixed, or nothing could be
built at all.** Every `npm run build:reel` failed — both reels, five
consecutive attempts thirty seconds apart on hers — with
*SyntaxError: Unexpected end of JSON input*, leaving a zero-byte
`.build-result.json`. After Effects was running, single-instance, and answered
a trivial `DoScript` correctly, so this was not the unresponsive-host case.

The cause is in `panel/jsx/json2.jsx`, which supplies `JSON.stringify` where
the host has none — and every result comes back through it. Its `quote()` asked
`ESCAPES[c]` with no `hasOwnProperty` guard. **Every ExtendScript object
inherits the operator methods the language overloads**, so `ESCAPES['-']` and
`ESCAPES['/']` are truthy *native functions*; concatenating one raises *Object
of type Function found where a Number, Array, or Property is needed*, `out.open`
has already truncated the file, and `out.write` never runs. Measured in the live
host:

```
lookup dash  = function -() {    [native code]}
lookup slash = function /() {    [native code]}
```

Two file paths and the font name `Almarai-Bold` each carry one of those
characters, which is why it caught every build and no earlier one.

The guard fixes it, and the `typeof JSON.stringify !== 'function'` test was
replaced by a usability probe, so a host whose stringify cannot serialise an
ordinary string is replaced rather than trusted. **A host with a working one
keeps it**, so nothing that already agrees with After Effects' own output moves.
Its output was compared field by field against Node's for objects, arrays,
nulls, dropped `undefined` keys, escapes and two-space indentation, and is
identical in every case; golden then confirmed it across 17,174 fields.

No other deviation. Nothing billable ran. **$0.00 spent.**

## Failures & open problems

- **The 40.5-second reel's face masks were recomputed, not migrated**, because
  session 51 had quarantined the mixed directory and it had none. Free and
  local, and its zones came out bit-identical, but it is a recomputation and is
  named as one.
- **`benchmarks/src/audio.ts:37` still keys bench audio on a basename.** It is
  corpus-only and cannot collide today; it is the last instance of the pattern
  anywhere in the repository.
- **Sixteen orphaned `.wav` files sit in `.local/audio/`** under the old
  un-suffixed names, left by session 51's fix. They are extraction output,
  regenerable for free, and nothing reads them. Nothing was deleted.
- Everything else open at session 51 is untouched and still open: the
  `ground-truth` reel cannot build until its six image slots are generated; a
  client's photograph is not in the pre-flight or the backup set; the panel's
  image-picker tests pass by winning a race with fixtures that name moved files;
  a client saved with no colours still inherits K2's four; `test-1` holds one
  picture motionless for 6.78 s.

## Repo state

- `npm run golden` **PASS** — 4 of 4 reels matched field for field, 17,174
  fields (test-1 4415, test-2 4280, test-3 3709, vitasilk 4770). Reference
  `74436a960706fecd`, unchanged and **not re-recorded**.
- `npm run check` **PASS, exit 0** — core 758, service 1312, benchmarks 173,
  panel 220 with 2 skipped. Service is up 19 from session 51's 1293: 18 new in
  `video-identity.test.ts` and one new loudness test.
- **Ledger unmoved**: 165 lines, `786497a5f371d179…` at both ends.
- `templates/library.aep` `4b0cf05a8f5d4775…`, `modes/k2-syndicalia.json`
  `c600905c5e36ecbc…` and `modes/dr-loubna-kfafi.json` `f60749f5629b2ced…` —
  all byte-identical at both ends.
- **`.local/quarantine-session51/` intact**, all three entries, untouched and
  outside the migration's walk.
- Both `sora.mov` files were read and never written; neither was moved, copied,
  renamed or re-encoded.
- Branch `main`, tree clean. Four commits: the fix, the migration, the
  ExtendScript fix, and this report.

## Suggested next step

`benchmarks/src/audio.ts:37` is the last basename-keyed path in the repository.
It is corpus-only and safe today, and closing it would let the rule be stated
without an exception. After that, the client photograph — it is still neither
checked at pre-flight nor in the backup set — is the largest thing standing
between the product and a second client.
