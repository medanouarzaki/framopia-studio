Status: OK

# Block 11 session 60 — the warning proved on the route it exists for

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends. Golden did not move: 17,174 fields, 4 of 4.**

---

## 1. Does the warning reach a client's photograph? **Yes — and nothing had ever
proved it**

### The trace, from the file picker to the sentence

| step | where |
|---|---|
| the chooser | `panel/src/file-dialog.ts` → `cep.fs.showOpenDialogEx` |
| the format check | `panel/src/still-formats.ts` `judgeStill` — extension only |
| attached | `panel/src/ClientPictures.tsx` → `addClientPicture` |
| checked | `service/src/clients/create.ts:322` `checkPicture` — absolute, exists, described |
| stored | `addPicture` → `modes/<client>.json`, or `video-pictures.ts` → `plan.pictures` |
| chosen for a slot | `analysis/client-picture-slots.ts` by label, or `image-view.ts` `chooseCandidate` by hand |
| **resolved for the view** | `image-view.ts:231` `pictureSlotWillPlace` → **`clientPictureFileFor` first** |
| **measured** | `image-view.ts:253` `enlargementOf` → `imageSize` → `fitByLongEdge` |
| shown | `panel/src/Images.tsx` `TooSmall`, beside the slot |

**The two do not diverge.** `pictureSlotWillPlace` tries `clientPictureFileFor`
before it looks at any candidate — the same order the builder uses — so a
photograph and a generated candidate reach the same two lines. The wiring was
right when session 59 wrote it.

### What session 59 did not do

**It never proved it.** Both its browser tests set the value by hand:

```ts
(small.slots[0] as Record<string, unknown>)['enlargement'] = {
  percent: 500,
  tooEnlarged: true,
};
```

and every service-side test called `fitByLongEdge` directly. So what session 59
showed was **the panel drawing a number it was handed**, and **arithmetic in
isolation** — never that a photograph attached through the real route produces
that number. Nothing anywhere ran `image-view.ts` against a client picture.

**Said plainly: the warning did reach the photograph route before this session
touched anything, and no test covered the fact.** The gap session 59 left was
proof, not wiring — which is the finding of this session, and it is why session
59's warning had never been seen on the only route where the defect is
reachable.

---

## 2. Proved end to end

### Where the fixture photographs live

`panel/fixtures/client-photo-small.png` (320×320) and
`panel/fixtures/client-photo-large.png` (600×600), **both shrunk from
`vitasilk`'s `img002-c1`** — a picture this project already paid for in Block 4.
Nothing was generated. They are inside the repository, tracked, and are fixtures
rather than user assets — deliberately not in `/private/tmp`, where session 53's
scratch pictures sit waiting for a reboot to sweep them.

In the audited 1000 px box: **320 px → 312.5%, warns. 600 px → 166.7%, silent.**
The large one is *still an enlargement* and still silent, so what is tested is
the boundary and not merely "any enlargement".

### The service side — `service/src/clients/photograph-warning.test.ts`, 4 tests

A client made through `createClient`, photographs attached through `addPicture`,
a real corpus plan pinned to that client with a photograph chosen for a slot,
and `imagesViewForPlan` — the view the panel actually reads.

| test | what it pins |
|---|---|
| is measured by the view the panel reads, not only by the builder | 312.5%, `tooEnlarged` true |
| says nothing about a photograph that is big enough, though still enlarged | 166.7%, `tooEnlarged` false |
| leaves the generated slots on the same reel alone | only the photograph's slot warns; the rest read 48.83% |
| says nothing when the picture is not on the client any more | null, not a failure |

### The panel side — `panel/src/photograph-warning.browser.test.ts`, 5 tests

Its own file and its own browser, per session 47's rule. Both routes session 57
listed as uncovered:

- **chosen by a spoken word** — the slot carries `chosenClientPictureId` and
  `chosenClientPictureWord` before anyone opens the picker;
- **chosen by hand** — pressing *Use this* on the client's own pictures list,
  asserting the choice posts `slotId` and `clientPictureId`.

The photograph's `<img>` loads the real fixture, so *"it still drew"* is
`complete && naturalWidth > 0`, **extracted as values** — never a live handle.

### Every assertion, proved to fire

**Red 1 — the view stops looking at the client's photograph** (it falls back to
the generated candidate at 48.83%):

```
× a client’s own photograph, too small for the space > is measured by the view the panel reads, not only by the builder
  → expected 48.828125 to be close to 312.5, received difference is 263.671875, but expected 5e-7
× a client’s own photograph, too small for the space > says nothing about a photograph that is big enough, though still enlarged
  → expected 48.828125 to be close to 166.6667, received difference is 117.83857499999999, but expected 0.0005
× a client’s own photograph, too small for the space > leaves the generated slots on the same reel alone
  → expected [] to deeply equal [ 'img001' ]
× a client’s own photograph, too small for the space > says nothing when the picture is not on the client any more
  → expected { percent: 48.828125, …(1) } to be null
```

**This is the break that matters** — it is the exact defect the trace says
cannot happen, and all four tests catch it.

**Red 2 — the panel never says it:**

```
× a photograph a spoken word chose > says it will look soft, and still shows the photograph
  → expected 'BackPictures1 image slot, 0 with cand…' to contain 'small for the space it fills'
```

**Red 3 — the picker stops offering the client's own pictures:**

```
× a photograph a spoken word chose > says it will look soft, and still shows the photograph
  → expected 0 to be greater than 0
× a photograph chosen by hand from the picker > is offered, chosen, and asked for by id
  → Test timed out in 30000ms.
× a photograph chosen by hand from the picker > says the chosen photograph goes in the comp instead of a made one
  → Test timed out in 30000ms.
```

**Red 4 — the photograph itself replaced by bytes that are not a picture**, so
the load genuinely fails:

```
× a photograph a spoken word chose > says it will look soft, and still shows the photograph
  → expected false to be true // Object.is equality
```

All restored, and green again.

---

## 3. The build's warning, as actually printed

**It printed.** A scratch client with the 320 px photograph, a plan choosing it
for `img001`, and `npm run build:reel`:

```
img001: 320x320px, content 320px -> scale 312.5000% -> draws 1000x1000px inside a 1000px solid and an 1080px frame
warning [img001]: this picture is 320x320px and is being drawn at 1000px, so it is enlarged 313% and will look soft. It is still placed; a larger copy of the same picture would look sharper.
img002: 2048x2048px, content 1394px -> scale 48.8281% -> draws 1000x1000px inside a 1000px solid and an 1080px frame
```

**The build exited 0 and placed the picture.** `img002`, the 2048 px generated
one on the same reel, is silent. That is the ruling working: warn and continue.

**The sentence moved into `service/src/build/soft-picture.ts`** so it can be
asserted rather than quoted — a line nobody has seen printed is a line that
might not print. `soft-picture.test.ts` (4 tests) compares against the string
above, character for character, and the build was **re-run after the refactor**
and printed the identical line.

**Red 5 — the sentence changes:**

```
× what the build says about a picture too small for its space > is exactly what it printed on a real reel
  → expected 'warning [img001]: this picture is 320…' to be 'warning [img001]: this picture is 320…' // Object.is equality
× what the build says about a picture too small for its space > says the picture is still placed
  → expected 'warning [img001]: this picture is 320…' to contain 'It is still placed'
```

**Red 6 — the build stops printing it**, measured on a real run:

```
rc=0
warning lines printed: 0
```

### One deviation, stated plainly

**§0.2 says After Effects is driven only by `npm run golden`; §3 asks for a real
build. I ran the build.** It is local, free, single-instance, `DoScript` only,
and there is no other way to see a line the build prints. Two builds ran, plus
one with the emission disabled to prove Red 6. The scratch client, its plan and
its `.aep` were removed afterwards; `modes/` holds the two real clients and
nothing else.

---

## 4. The portability measurement — no code written

### Where a picture path is written

| | |
|---|---|
| `service/src/clients/create.ts:126` | `buildClient`, on create |
| `service/src/clients/create.ts:209` | `addPicture`, afterwards |
| `service/src/video-pictures.ts:65` | `addVideoPicture`, onto the plan |

All three store the string `checkPicture` was given, unchanged.

### Where it is read

| | |
|---|---|
| `service/src/build/client-picture.ts:46, 71` | resolving a slot's picture for the build |
| `service/src/image-view.ts:234` | the enlargement, and the picker's list |
| `panel/src/ClientPictures.tsx:95` | the thumbnail on the client screen |
| `panel/src/Images.tsx:254, 333` | the picture in the picker |
| `service/src/build/preflight.ts` | the existence check before a build |

**Nothing re-roots it.** `resolvePlanPaths` in `editplan/io.ts` runs
`resolveStoredPath` over `source.videoPath`, `source.audioPath`,
`clientMode.path`, `watermark.assetPath`, `build.aepPath` and every candidate's
`path` and `cutoutPath` — **and not over `plan.pictures`.** A client's
photographs are not in that function at all, and neither is `modes/*.json`.

### What happens on a machine without the drive — demonstrated

In the rehearsal clone at `~/Documents/framopia-second-machine-rehearsal/from-github-2/`,
with a **copy** of `k2-syndicalia.json` naming
`/Volumes/Some Other Drive/clients/k2/clinic.png`. The real client files were not
touched, and the probe was deleted afterwards.

| step | what it did |
|---|---|
| `loadMode` | **ok** — no error |
| `validateMode` | **`[]`** — no issues; it checks the path is *absolute*, not that it is there |
| `listModes` | hands the panel the picture with its dead path, as though it were fine |
| the panel's thumbnail | `<img>` with a `file://` URL that will not load → *"This photo could not be shown — has it moved?"* |
| pre-flight, at build | **refuses**: `image (the client's own) img001: /Volumes/Some Other Drive/clients/k2/clinic.png` |

**So nothing fails until a thumbnail does not appear, and nothing explains why
until a build refuses.** The one sentence a person could act on —
*"has it moved?"* — is the panel guessing from an `onError`, not the tool knowing
the drive is absent. A partner opening a client Mohamed made would see a list of
photographs, none of which draws, and no statement of the cause.

### What the backup carries — measured, and open item 5 is confirmed

`surveyGroups()`, measured this session:

| group | files | size |
|---|---:|---:|
| transcription-cache | 26 | 10.3 MB |
| analysis-cache | 20 | 0.1 MB |
| ground-truth | 8 | 0.0 MB |
| align-references | 3 | 0.0 MB |
| ledger | 1 | 0.0 MB |
| plans | 10 | 0.5 MB |
| images | 131 | 184.9 MB |
| config | 1 | 0.0 MB |
| footage (opt-in) | 5 | 12,805.9 MB |
| **total** | **205** | |

**75 of the 205 are still images, and every one is a generated picture or a
cutout. Not one is a client photograph.** Open item 5 is confirmed by
measurement, not by reading the code.

### Recommendation, and the rule it must not touch

**Store the path relative to something the repository already knows, and keep
the file where the client put it.**

`core/src/stored-path.ts` exists and already does this for footage, plans and
generated pictures: a path is written as given, and `resolveStoredPath` re-roots
it onto whatever repository is running. Client photographs were simply never
added to that list. The change is to run `plan.pictures[].path` and
`mode.pictures[].path` through the same resolver, and to record a form that
survives the move — the same mechanism, one more field.

**The trade-off.** It fixes a photograph that lives *inside* a folder the
repository can anchor to, and it does **not** fix one that lives anywhere else
on a drive the partner does not have. That second case cannot be fixed by
re-rooting at all — the bytes are not on their machine — so the honest second
half is that the tool should **say so**: a check that reports *"this client's
photographs are on a drive this Mac cannot see"* rather than leaving five
thumbnails blank. That is a doctor check and a sentence, not a path rule.

**The alternative — copying the photograph into the repository — I do not
recommend, and it is not mine to choose.** `core/src/client-pictures.ts` holds
two rules: a client's picture is **never sent anywhere** and is **never copied
into a cache**, and `service/src/clients/pictures.test.ts` asserts both. Copying
a photograph into the repository does not break the letter of the second — the
repository is not a cache — but it plainly breaks its spirit: a doctor's patient
results would become bytes this project stores, backs up and pushes to GitHub.
**That is Mohamed's ruling to make, not mine**, and it should be put to him as
what it is: a decision about where a client's photographs live, not a bug fix.

**No code was written for any of this.** Two changes in one session make the
result uninterpretable.

---

## 5. Gates, arithmetic and fingerprints

**`npm run check` — PASS, exit 0.** Measured:

| workspace | before | measured | change |
|---|---|---|---|
| core | 777 | **777** | none |
| service | 1366 (+1 skipped) | **1374** (+1 skipped) | **+8** |
| benchmarks | 173 | **173** | none |
| panel | 235 (2 skipped) | **240** (2 skipped) | **+5** |

**+8 in service, by name:**

`service/src/clients/photograph-warning.test.ts` (4)
1. is measured by the view the panel reads, not only by the builder
2. says nothing about a photograph that is big enough, though still enlarged
3. leaves the generated slots on the same reel alone
4. says nothing when the picture is not on the client any more

`service/src/build/soft-picture.test.ts` (4)
5. is exactly what it printed on a real reel
6. names the slot it is about
7. says the picture is still placed
8. is only reached past the ruling

**+5 in panel, by name** — all in `panel/src/photograph-warning.browser.test.ts`:
1. is there, or the reason is said out loud
2. says it will look soft, and still shows the photograph
3. says nothing about a photograph that is big enough
4. is offered, chosen, and asked for by id
5. says the chosen photograph goes in the comp instead of a made one

8 + 5 = 13. Nothing removed or renamed. The arithmetic closes exactly.

**Five panel runs, each one:**

| run | result |
|---|---|
| 1 | 240 passed, 2 skipped (242) |
| 2 | 240 passed, 2 skipped (242) |
| 3 | 240 passed, 2 skipped (242) |
| 4 | 240 passed, 2 skipped (242) |
| 5 | 240 passed, 2 skipped (242) |

No test failed on any of the five, with a fourth browser file now in the suite.

**`npm run golden` — PASS.** 4 of 4 field for field: test-1 4415, test-2 4280,
test-3 3709, vitasilk 4770 — **17,174 fields**, reference unchanged. Nothing this
session added is written into a plan.

| | at start | at end |
|---|---|---|
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | `c600905c5e36ecbc…` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | `f60749f5629b2ced…` |
| `.local/quarantine-session51/` | present | present |
| `.local/quarantine-session53/` | present | present |
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |

---

## 6. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: two photographs shrunk from one already paid for, three
local builds, and tests.
