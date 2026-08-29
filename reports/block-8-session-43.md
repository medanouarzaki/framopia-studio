Status: OK

Session 43. HEAD at the time of writing `0f8ed27`; this report's own commit
follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no build, and After Effects was not
contacted.** One After Effects instance and zero `aerender` at session start;
unchanged at the end. Working tree clean at start. **`footage.json`, every Edit
Plan, every cache entry, mask and image are untouched.**

## Done

### Goal 1 — a client is a person you can set up from the panel

`ClientMode` gains seven fields, **every one optional with a default**, so
`k2-syndicalia` loads unchanged and `vitasilk` builds identically — asserted,
not assumed.

| field | blank means | which is |
|---|---|---|
| `videoFolder` | `benchmarks/footage.json` | the list the five corpus reels come from |
| `logoPath` | none | nothing has ever read a client logo |
| `pictures` | none | see Goal 3 |
| `language` | `mixed` | what every corpus reel is |
| `subtitleBaselineY` | `SUBTITLE_ANCHOR_BASELINE_Y` (2480.4) | where every build has put it |
| `videoShape` | `vertical` | 2160 × 3840, what everything assumes |
| `watermarkByDefault` | `true` | what every build has done |
| fonts | the standard pair | Inter Semi-Bold and Almarai Bold |

`core/src/client-defaults.ts` is the one declaration of those defaults and says
**which values the client chose and which are the standard ones**, so the panel
can tell him rather than leaving a blank to mean something silently.

**`videoShape` is recorded and not yet acted on**, said plainly here because it
would otherwise read as done: placement, watermark inset and safe width are all
derived from a vertical frame, and a square client changes all three. That is
its own piece of work.

**`POST /clients` writes the file**, through `validateMode` before it reaches
disk, so the panel cannot make a client `npm run validate:modes` would reject. A
new client inherits the **style half** of `k2-syndicalia` — palette, prompt
fragments, variation axes — because it is the only set of fragments that has
ever produced an image and PROJECT_SPEC §5 forbids inventing a client's
identity.

**A defect the tests caught immediately:** the first version spread the template
client, which carried **K2 Syndicalia's own `note` onto every new client**.
Named fields now, not a spread: the style is inherited, everything about the
*person* starts blank.

**The form** is reached from two entries at the foot of the Client picker — "Set
up a new client…" and "Just this video…". A **one-off** is the same form with
the client-only fields hidden and **is not added to the client list**. Colours
and pictures are deliberately not on the way in: a colour is chosen by looking
at it and a picture by pointing at a file, so both are edits to a client that
exists.

### Goal 2 — Client, then Video, from the folder

**Client is now the first section**, because it decides which videos there are;
asking for the video first asked a question out of order.

- `GET /reels?client=` lists the client's folder. **Refresh re-reads it**;
  nothing watches the disk.
- **Browse** is a path field and an Open button (`GET /video?path=`), for
  footage outside any client's folder.
- **A missing folder reads as a fact about the disk**: *"…is not there. If it is
  on an external disk, plug it in and press Refresh."* An empty one says it is
  empty; an unreadable one says what the disk said.

**`footage.json` still works, and here is where each corpus reel comes from
after this change:**

| reel | source now |
|---|---|
| ground-truth, test-1, test-2, test-3, vitasilk | **`benchmarks/footage.json`**, unchanged |

All five, because `k2-syndicalia` has no `videoFolder` — and neither does any
client written before this session. A test asserts the five list exactly as they
did, with and without a client chosen.

**What a video needs**, and what happens when it does not have it:

| requirement | a file that fails it |
|---|---|
| extension in `.mov .mp4 .m4v .avi .mkv` | listed as skipped with the reason, when it looks like video (`.wmv`, `.mpg`, `.mts`, `.webm`…) |
| not empty | listed as skipped: *"the file is empty"* |
| readable | listed as skipped: *"the file could not be read"* |
| not a dotfile or a directory | passed over silently |

**A file it cannot use says so rather than being hidden**, which is the point:
a video that vanishes from a list is a video he goes looking for. **ffprobe is
deliberately not run on the listing** — it costs a process per file and the
pipeline runs it on the one video he picks; a file that ffprobe later rejects
fails there, loudly, rather than making the picker slow.

**The file dialog, and what I could not establish.** A browser `<input
type="file">` gives a sandboxed `File`, not a path — useless here, since every
stage needs an absolute path. CEP's own `window.cep.fs.showOpenDialogEx` returns
one, but **this extension loads no CEP library and nothing in the bundle has
ever touched `window.cep`**, so whether it is present is a claim about the host I
cannot test from here. Browse is therefore a **path field**, which works in any
engine. If `window.cep.fs` turns out to be there, a real dialog is a small
addition on top; **only his machine can settle it.**

### Goal 3 — the client's own pictures

`ClientMode.pictures` is `{ id, path, description }` in his words. They appear in
the picture editor beside the generated candidates, marked as his.
`ImageSlot.chosenClientPictureId` is a **schema addition, optional with a
default**, a **human-flagged marker** so a re-run cannot discard it, and **wins
over `chosenCandidateId`** — he pointed at a photograph, and a square from a
model is not what he asked for. Choosing one costs nothing.

**Automatic matching is not attempted.** Deciding that "the clinic exterior" is
what a moment wants is the same judgement as knowing a clock reads quarter past
rather than five minutes — the open image-prompt defect, and Block 9. Recorded
in `CLAUDE.md` as waiting on it.

**The two non-negotiable properties, both asserted rather than described:**

1. **Never sent anywhere.** A test reads every non-test file in
   `service/src/images/` and fails if one mentions `clientPictures`,
   `chosenClientPictureId` or the module — because a doctor's patient
   photographs must not reach an image model.
2. **Never copied.** `core/src/client-pictures.ts` writes no file and names no
   cache path, checked with comments stripped so the rule is about what the code
   does.

**What arbitrary dimensions actually broke, measured:** every generated image is
2048 × 2048, so the builder scaled by **width** and the height followed for
free. A phone's 3024 × 4032 at a 1000 px width draws **1333 px tall inside a
1200 px comp** — 133 px over the top and the bottom, and far outside the 1080 px
card frame behind it. `fitByLongEdge` fits the long edge instead:

| picture | drawn |
|---|---|
| 2048 × 2048 (generated) | 1000 × 1000 — identical to before |
| 3024 × 4032 (upright phone) | 750 × 1000 |
| 4032 × 3024 (wide) | 1000 × 750 |
| 100 × 4000 (extreme) | 25 × 1000 |

**Nothing is cropped.** Cropping a photograph a doctor chose is the tool
deciding which half of her results matter. The cost is that a tall picture
leaves the card frame wider than the picture on two sides; that is visible and
correct, where a crop would be invisible and wrong.

**What the cutout path does with one: nothing.** Background removal runs during
image *generation*, which a client's picture never goes through, so there is no
matte, no gate and no verdict — and the picker already says "shown whole, inside
a frame" for a slot with no cutout. A client picture is a card, always.

### Goal 4 — handed back

`npm run service:build` and `npm run panel:build` both ran; both changed.

**Driven in Playwright against the built bundle**: the section order with Client
first, the four client-picker entries including the two ways into the form, the
client's pictures shown with the words he described them in, and that a service
too old to send them shows nothing rather than claiming he has none.

**What only his machine can confirm**: whether `window.cep.fs` exists for a real
file dialog; how the form reads at his docked width; and whether a client folder
on the T7 lists the way he expects, since the only folders I could test against
were temporary ones I made.

## Deviations

**Goals 1 and 2 share `service/src/server.ts` and `service/src/catalogue.ts`**,
so the routes for both landed across two commits rather than cleanly in one
each: `dd28f5e` carries the client model and the form, `ac892c5` the video
listing and the picker. Goal 3 is its own commit.

**Colours and picture-adding are not in the form.** Both are in the schema, both
have working service routes (`POST`/`DELETE /clients/pictures`), and neither has
a control on the way in — a colour is chosen by looking at it and a picture by
pointing at a file, which is an edit to a client that exists rather than a
question on a form. Said here rather than left to be discovered.

## Failures & open problems

**None from this session.** `npm run check` passes.

Named rather than fixed:

- **`videoShape` is recorded and not acted on.** A square or 16:9 client would
  still be placed as if vertical.
- **Automatic picture matching waits on the image-prompt defect** (Block 9).
- **The file dialog is a path field** until someone can check `window.cep.fs`
  inside After Effects.

Unchanged and still open: frame analysis is reported rather than driven, so
Block 8's definition of done is not met; `dialogueLufs` reaches a plan only
through a migration; `IMPACT_THRESHOLD` is unresolved and the 17 SFX events
remain 8 frames late.

## Repo state

HEAD `0f8ed27`, working tree clean. Four commits this session:

- `dd28f5e feat: a client is a person, and can be set up from the panel`
- `ac892c5 feat: pick the client first, then a video from their folder`
- `5afa7ce feat: use the client's own pictures, chosen by hand`
- `0f8ed27 docs: record the client model and its own pictures`
- (this report's commit follows)

`npm run check` **passes**, counts measured per workspace: core **469**, service
**1078**, benchmarks **166**, panel **135 passed / 2 skipped** — **1848
TypeScript tests** — plus **149 pytest**, the mode validator, the panel manifest
parse, the template validator and both model checksums. The Chromium 99
capability denylist passes against the built `panel/dist`.

New: `core/src/client-defaults.ts`, `core/src/client-pictures.ts`,
`service/src/clients/`, `panel/src/NewClient.tsx`. `modes/k2-syndicalia.json`
was not edited and is asserted to carry none of the new fields. No plan, cache
entry, mask or image was written. Nothing was staged with `git add -A`.
`git log` carries no AI attribution.

## Suggested next step

Reload first:

```
pkill -f "service/dist/service.js"
```

Then close and reopen the panel in After Effects.

**Nothing about `vitasilk` or K2 Syndicalia changes.** The client file is
untouched, the five test videos still come from the old list, and a build
produces the same comp. That is asserted by tests, not hoped for.

**To set up a real client:** open the Client picker, choose **Set up a new
client…**, and fill in as little as you like. Only the name is required.
The two that matter are:

- **Name** and **Note** — "Dr Jenna", "Dermatologist, Casablanca". The note is
  what makes the name mean something in a year.
- **Video folder** — the full path to where their footage lives, e.g.
  `/Volumes/T7 Shield/clients/jenna`. Choose that client afterwards and the
  video list is what is in that folder. **Refresh** re-reads it; if the T7 is
  unplugged it tells you so rather than showing an empty list.

Everything else — fonts, language, video shape, subtitle height, your watermark
— can be left alone and takes exactly what the tool does today.

**For a video you are doing once**, choose **Just this video…** instead. It is
the same form, shorter, and does not put anyone in your client list.

**Their own pictures**: the schema and the service take them, and the picture
editor offers them beside the generated ones with the description you gave.
There is no control to add one from the panel yet — that and the colour picker
are the two obvious next pieces. Tell me if adding pictures is the one you want
first; it is a smaller job than the colours.

One thing worth knowing before you rely on it: **Browse is a path field, not a
file dialog.** A browser file input hands over a sandboxed file rather than a
path, which is no use here. CEP has its own dialog, but this extension has never
loaded a CEP library and I cannot check from outside After Effects whether it is
available. If you would rather click than paste, say so and I will find out.
