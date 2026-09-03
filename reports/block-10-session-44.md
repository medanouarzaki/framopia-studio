# Block 10 session 44 — four things the client screen collects, and a fifth

**Status: OK.** Two of the four now reach the build, two are reported impossible
with reasons, and the panel no longer claims any of them was applied when it was
not. $0.00 spent; the ledger did not move.

## Does a client who turns the watermark off now get no watermark?

**Yes, and it is read out of the built comps rather than reasoned about.** Two
clients differing in that one setting, each taken through the whole pipeline on
its own throwaway video and built:

| client | `plan.watermark.enabled` | the build said | watermark layers in the comp |
|---|---|---|---:|
| watermark **off** | `false` | *"watermark: off for this reel"* | **0** of 7 layers |
| watermark **on** | `true` | *"medium, top-left, 324 x 363 px"* | **1** of 8 layers |

Before this session both comps carried the mark. Session 43 measured that on a
client who had said no and found it on layer 2.

**The other three, one line each:**

- **Subtitle baseline — now reaches the build.** A client's own value moves
  every card in the master, pinned on the reel's snapshot like the palette.
- **Video shape — cannot work and should not pretend to.** Browse refuses
  anything but 2160×3840, so the setting contradicts the product rather than
  configuring it.
- **Language — cannot work as designed.** The orthography guide is global and
  versioned, and transcription deliberately runs before a client is chosen.

**And a fifth, found by the new test rather than by looking.** The four colour
swatches on the New Client screen are **collected and never sent**: `save()`
never puts `palette` in the request body, so `createClient` falls back to
`k2-syndicalia`'s palette. A user who picks four colours gets K2's four. It was
not fixed — this session was authorised for the four session 43 measured — and
it is pinned by a test so it cannot drift quietly.

## Done

### A — all eleven fields traced before anything was changed

| field | collected | stored | validated | echoed | read by a build? |
|---|---|---|---|---|---|
| `name` | `NewClient.tsx:68` | `create.ts:84` | `mode.ts` | client card | yes |
| `palette` | `NewClient.tsx:78` | `create.ts:95` | `mode.ts` | client card | **never sent** |
| `fonts` | `NewClient.tsx:80` | `create.ts:96` | `mode.ts` | client card | yes |
| `pictures` | `NewClient.tsx:79` | `create.ts:109` | `mode.ts` | picker | yes |
| `videoFolder` | `NewClient.tsx:70` | `create.ts:105` | `mode.ts:791` | catalogue | runs Browse |
| `about` | `NewClient.tsx:69` | `create.ts:104` | `mode.ts:742` | catalogue | display only |
| `logoPath` | `NewClient.tsx:73` | `create.ts:108` | `mode.ts:797` | client card | display only |
| **`watermarkByDefault`** | `NewClient.tsx:77` | `create.ts:124` | `mode.ts:809` | client card | **was: no → now yes** |
| **`subtitleBaselineY`** | `NewClient.tsx:76` | `create.ts:122` | `mode.ts:812` | client card | **was: no → now yes** |
| **`videoShape`** | `NewClient.tsx:75` | `create.ts:123` | `mode.ts:806` | client card | **no, and cannot** |
| **`language`** | `NewClient.tsx:74` | `create.ts:121` | `mode.ts:803` | client card | **no, and cannot** |

**What read them instead.** The watermark: `plan.watermark`, written only by the
panel's per-reel toggle, and `watermarkEnabled(null)` returns true. The
baseline: the `SUBTITLE_ANCHOR_BASELINE_Y` constant at `reel-plan.ts:152`. The
shape and the language: `clientDefaults` alone, for display.

**What the user got, measured.** Session 43 built a comp for a
`watermarkByDefault: false` client and found the mark on layer 2. This session
reproduced it, fixed it, and re-measured both directions above.

**Whether fixing it moves the six existing plans: no, and by design.** The
watermark is written **only when the plan has recorded none**, so a reel that
has decided keeps its decision and no existing plan changes. The baseline joins
the pinned snapshot as **optional with no default** — absent means the standard
anchor. Writing the standard value instead would put a key on every fresh
snapshot that no pinned one has, and `snapshotsAgree` is a string comparison, so
all six plans would report themselves *behind* for a look that had not moved.
`textColours.shadow` beside it is absent for the same reason. **Golden passed 4
of 4 with zero differing fields**, which is that promise checked.

### B — the watermark

`applyClientDefaultsToPlan` is the one declaration, called where a client is
first attached to a reel: the analysis job (both entry points) and
`POST /client`.

**How "not set" was made different from "set to no."** Not by changing what
`null` means — that back-compatibility is load-bearing and untouched. The client
choice is resolved into `plan.watermark.enabled` **at the moment the client is
chosen**, so an explicit no becomes a `false` on the plan while an absence stays
an absence. No schema change was needed: `enabled` has been optional-with-a-
default-of-true since it was added, and every existing plan still validates.

**A per-reel decision always wins.** The function returns early when the plan
has a watermark, so pressing the panel's control is never undone by a later
pipeline run. `server.test.ts` gained a case for exactly that, and its sibling —
which asserted that `POST /client` changes *nothing* but the client and the
timestamp — was rewritten rather than left asserting retired behaviour, because
`watermark` is now legitimately in that list.

### C — the other three

**The subtitle baseline reaches the build.** `textCompPosition` takes it as an
argument defaulting to the standard anchor, and `buildReel` passes the reel's
pinned value. It moves **the card in the master and nothing inside the card**:
the comps are still 1300 px tall with a first baseline at 700, so the height
rules and the two-line check are untouched, which is what §3.2 required. Today a
non-default value did nothing at all; now it moves the type.

**The video shape cannot work, and is worse than merely unused.** Browse refuses
any video that is not 2160×3840 — session 43's landscape clip was rejected with
*"this tool only builds 2160 x 3840 upright video"* — so a client set to "wide"
is contradicted by the product the moment they open a wide video. Permitting
other shapes is not a setting but a rebuild: the four text templates are
authored at 2160×1300, the two image templates at 1200×1200, and fourteen source
files read `FRAME_WIDTH`/`FRAME_HEIGHT`. **Beyond this session, and the honest
options are to remove the control or to leave it recorded and say so.**

**The language cannot work as designed.** `ORTHOGRAPHY_GUIDE.md` is injected
verbatim into every transcription and correction prompt, it is versioned, the
transcription cache keys on that version, and v2.0.0 is a ruling the user made
for **all** clients on 2026-08-31. Transcription also runs *before* a client is
chosen — it is not given a mode at all. A per-client language would mean forking
the guide per client and keying the cache on which fork, which is a different
product decision. **What it could honestly become is a hint to the keyword and
slot prompts**, which do see the mode; that is a ruling, not something to invent.

**So the panel stops claiming they were applied.** The client card now separates
what decides a build from what is merely recorded:

> no watermark · subtitles at 2480px
> Mostly a mix of languages, upright video — noted, neither changes what is built.

Before, all four sat in one line of facts and a client card could read *"no
watermark"* over a reel that carried one.

### D — what stops this happening to an eleventh field

**`every-field-is-read.test.ts` pins the defect class, not its instances.** It
reads the panel's own `save()` for every `body['x'] = …`, and fails when the
screen sends a field the inventory does not name, or names one it no longer
sends. A grep cannot tell "read" from "read by something that matters", so it
does not pretend to: the inventory records what each field is *for*, and adding
a field to the screen forces someone to write down which column it belongs in —
at the moment they add it, which is the only moment anyone has the context.

The half a grep can check, it checks: every field the inventory says builds a
reel must be read somewhere outside the four files that only store, validate and
display it.

**That test found the fifth defect on its first run.** `palette` was in the
inventory as "builds a reel" and the panel turned out never to send it.

**Proof the new assertions fire.** `applyClientDefaultsToPlan` was mutated to do
nothing and the suite re-run: **four of the five unit cases went red**, and the
fifth — "never overwrites a decision the reel already carries" — correctly
stayed green, because it does not depend on the write path. Then
`new-video.test.ts` alone, mutated the same way: **all three videos went red on
exactly the watermark assertion.** The file was restored from a copy taken
before the edit and confirmed clean both times.

**A second client, end to end.** `new-video.test.ts` now writes a client that
shares nothing with K2 — its own four colours, its own colour roles, the
standard faces instead of K2's measured ones, `imageScale` 0.8, watermark off —
takes the first throwaway video through with it, and asserts the snapshot
carries all of it and that **none of K2's four hex values appears in any image
prompt**. Session 19 found the card shadow was K2's red by coincidence; that is
the assertion which would now catch it. The client is deleted in `afterAll`.

**No request left the machine: 0 attempts**, with `globalThis.fetch` replaced by
a recorder that throws, on top of substituting every billable seam. The real
ledger is byte-identical at 21,055 bytes.

### E — the gates

**`npm run golden`: PASS, 4 of 4, 17,174 fields, and zero differing fields.**
Nothing was re-recorded. That is the check that the six existing plans did not
move, and it is the reason the snapshot addition is optional rather than
defaulted.

**`npm run check`: PASS, exit 0**, on the second of two runs. Per workspace:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **757 passed** |
| benchmarks | 17 passed (17) | **173 passed** |
| service | 99 passed (99) | **1273 passed** |
| panel | 11 passed (11) | **213 passed**, 2 skipped, 0 failed |

**The first run failed, and it was a real failure of mine**: `POST /client >
changes nothing but the client and the timestamp` — a test asserting behaviour
this session deliberately changed. It was rewritten to assert what is now true
and given a sibling for the case it did not cover. Reporting both runs because
session 43 found the panel's picker tests passing while their fixtures do not
exist; **one pass is not a fix**, and those tests still pass for that reason —
untouched here, they are session 43's finding 6.

**`sora` rebuilt and unchanged**: 112 layers, 11 pictures at 1037/941/893/881/
917/1061/1061/1073/1061/1049/1049 px, in-points 0.959 to 37.340, watermark
present. Its plan still records `watermark: null`, so it takes the default it
always had — the back-compatibility path, exercised on the reel that matters.

**`sora.mov`, its candidates and every cache entry are untouched** — cache **72
entries / 129 files** at both ends, `sora.mov` `344265a032513979…` at both ends,
ledger **145 lines / `d4fe2de3…`, $0.00 spent**.

## Deviations

**A `/login` interrupted a mutation run mid-flight**, leaving the mutation in the
working tree, a scratch client in `modes/`, and a stray plan from the crashed
test. All three were found and removed; the mutation was then re-run cleanly and
is the result reported above. **The interrupted run also produced two failures
that are not product findings** — a `SIGBUS` in the cut-out sidecar and an
`ENOENT` on `benchmarks/footage.json`, a file which exists and is intact. Both
are I/O on the external drive under load, and I have not counted them as
anything else.

**It is worth naming that a crashed test run leaves artefacts.**
`new-video.test.ts` cleans up in `afterAll`, which does not run when the process
dies; session 30's `job.test.ts` left 65 stray plans the same way.

**Three scratch files and two scratch clients were written and removed.**
`modes/` holds only `k2-syndicalia.json`, `.local/plans/` only `sora`'s, and the
tree is clean.

**Zero `AeDriveError`** across four builds and three censuses.

## Failures & open problems

1. **The palette is collected and never sent** — a user who picks four colours
   gets K2's. Found here, not fixed here, pinned by a test.
2. **The video shape is a control that cannot be honoured.** Recorded, said to
   be noted, and contradicted by Browse.
3. **The language is a control that cannot be honoured as designed.** The guide
   is global and transcription never sees a client.
4. **A client's settings still cannot be edited after creation** — session 43's
   finding 4, untouched, and it now matters more: the watermark and the baseline
   do something, and a mistake at creation is permanent.
5. **The subtitle baseline is unexercised on a real reel.** No client in this
   project sets one, so its path is covered by construction and by the standard
   default, not by a built comp with a moved baseline.
6. Session 43's findings 2, 5, 6, 7, 8, 9 and 10 are untouched, as instructed.

## Repo state

Branch `main`, tree clean. **Ledger 145 lines / `d4fe2de37f5eb0c8…` at both
ends, $0.00 spent**, so **$2.71** of credit remains. `templates/library.aep`
`4b0cf05a8f5d4775…` at both ends, never opened for writing.
`benchmarks/references/golden/census.json` `74436a960706fecd…` at both ends,
**not re-recorded**.

The hand-made references, byte-identical at both ends:

| file | sha256 |
|---|---|
| `benchmarks/references/align/vitasilk.json` | `f32e12dcfad55899…` |
| `benchmarks/references/align/vitasilk.rereview.json` | `10a2e5c2971ed27f…` |
| `.local/ground-truth/ground-truth.txt` / `.json` | `1fbbe2190d734db8…` / `64eebfd7374f93d2…` |
| `.local/ground-truth/test-1.txt` / `.json` | `b59a6270c3f704bc…` / `1394f8e863b72aa9…` |
| `.local/ground-truth/test-2.txt` / `.json` | `9ceea1c47ee94a8a…` / `183ba7b05392afaf…` |
| `.local/ground-truth/test-3.txt` / `.json` | `b5413c215ff32fec…` / `5ad64557cd2cd0fa…` |

`.local/plans/sora-995f2d27.editplan.json` moved to `0dcc5064ab28153b…` by the
rebuild recording itself; its content is otherwise unchanged and its watermark
is still `null`. The five corpus plans were rewritten by golden's own builds, as
they are every run. Cache **72 entries / 129 files / 107,420 kB** at both ends —
`du -sh` rounds it to 105M against 106M, and the counts are identical.
`sora.mov` `344265a032513979…`. One After Effects instance throughout; no
project of the user's own was saved. Free space 157 GB. `modes/` holds only
`k2-syndicalia.json`.

## Suggested next step

Rule on the palette. It is the same shape as the watermark — collected,
validated, echoed back, and silently replaced by K2's — and it is more visible
than any of the four this session fixed, because it colours every subtitle card
and every generated picture. The fix is one line in `NewClient.tsx`'s `save()`.

---

**The one file, and the one moment**

`.local/build/sora-995f2d27-full.aep`, unchanged, to confirm nothing moved. The
moment worth looking at is not in a comp: it is the New Client screen, where the
watermark switch and the subtitle-baseline slider now do what they say, and the
line beneath the language and shape now admits that they do not.
