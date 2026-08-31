Status: OK

# Block 10 session 27 — a client's own photographs, on the client screen

**Spent $0.00; no API was called and no image was generated.** Ledger **118
lines, `3f657131…`, byte-identical at both ends**. `templates/library.aep`
`d2bbb6b7…` and **never opened for writing**. The six hand-made references,
`modes/k2-syndicalia.json` (`c600905c…`) and the cache (46 entries / 80 files /
54,256 KB) all byte-identical at both ends. After Effects **pid 983**, one
instance, 0 `aerender`, **1198 font names at both ends**. Free space **161 GiB**.

**`npm run check` PASS on its first run; `npm run golden` PASS, 4 of 4 reels,
17,174 fields identical.**

**What changed.** The panel can now add a client's own photographs, which was the
last thing in ordinary use it could not do. Everything else had existed since
Block 9 — the routes, the schema, the picture editor offering them per slot — and
the only missing piece was a control that called them. It is on **both** client
screens, from one component: the setup form, where the photographs travel with
the new client, and the client card, where each change goes straight to the
service. Alongside it, the rule that these photographs never leave the machine is
now guarded where it can actually be observed — at the last point before an image
request is sent — rather than only by a scan for three words in one directory.

---

## Done

### 1. What already existed, before anything was built

The whole path, with the file and line for each.

| | |
|---|---|
| schema | `core/src/mode.ts:246` `ClientMode.pictures?`, `:285` `ClientPicture { id, path, description }` |
| the rule | `core/src/client-pictures.ts` — `clientPictures`, `clientPictureById`, `fitByLongEdge` |
| where the bytes live | **wherever he put them.** Only the `{ id, path, description }` triple is written, into `modes/<id>.json` |
| add / remove | `service/src/clients/create.ts:154` `addPicture`, `:172` `removePicture` |
| routes | `service/src/server.ts:186` `POST /clients/pictures`, `:210` `DELETE /clients/pictures?client=&picture=` |
| offered per slot | `service/src/image-view.ts:239` builds `clientPictures` from the plan's client; `panel/src/Images.tsx:204` renders them beside the generated candidates |
| chosen | `POST /images/choose` with `clientPictureId` → `image-view.ts:329` writes `ImageSlot.chosenClientPictureId` |
| **it wins** | `service/src/build/build-reel-cli.ts:105` — the chosen picture is returned **before** `buildChoiceFor` is ever called, so a generated candidate cannot beat it |
| protected | `service/src/editplan/merge.ts:66` reports it as human-flagged, so a re-run refuses to discard it |

**`addClientPicture` in the panel** (`panel/src/service.ts`): takes the
connection and `{ client, path, description }`, POSTs that JSON to
`/clients/pictures` with the service token, resolves `void`, and throws the
service's own `error` sentence on anything but 200. **No component called it**
until this session — that was the whole of what was missing.

### 2. Nothing is copied, and what that means if he moves the file

**Adding a photograph copies nothing.** `addPicture` checks the path is absolute
and the file is there, then writes the triple into the client's JSON and returns.
No `copyFileSync`, no cache directory, no `.local`. The bytes stay in his own
folder and belong to him.

**So deleting or moving his original does break the client**, and the two ways it
breaks are worth separating:

- If the **picture is removed from the client**, a plan that chose it fails the
  build by name — `build-reel-cli.ts:112`, *"the client picture pic001 is not on
  this client any more"*, exit 1.
- If the **file is deleted while the client still names it**, nothing catches it
  early: `service/src/build/preflight.ts` checks footage, candidates, cutouts,
  SFX and the template library, and **does not check a chosen client picture**.
  The build would reach After Effects and fail there. Reported, not fixed — it is
  a requirement question rather than a bug in this session's work.

### 3. The two tests that hold the never-sent rule, and the hole in them

`service/src/clients/pictures.test.ts`, **untouched this session** (`git diff`
over it is empty) and **7 tests passing**.

- It reads every non-test `.ts` in `service/src/images/` — nine files — and fails
  if any of them contains `clientPictures`, `chosenClientPictureId` or
  `client-pictures`.
- It reads `core/src/client-pictures.ts` with comments stripped and fails on
  `copyFile`, `writeFile`, `node:fs`, `cacheEntryDir` or `.local`.

**What they would catch:** an image-generation file importing the picture helpers
under any of those names, including through the `@framopia/core` barrel; and the
module that owns pictures growing the ability to write a file.

**What they would not catch, and this is the part that matters now that there is
a way in:**

- A file in `service/src/images/` reading **`mode.pictures`** directly. The word
  `pictures` alone is not on the list, and adding it would be a name check again.
- A path reaching `slot.prompt` from **anywhere upstream** — the analysis stage,
  a migration, a hand edit of a plan. The image graph would then send it while
  never having named a picture at all.
- Anything **indirect**: `service/src/images/` imports `@framopia/core`, whose
  barrel re-exports `clientPictures`, so a transitive-import test cannot be
  written against that boundary at all.

### 4. The guard, at the point where a picture could actually leave

`core/src/outgoing-text.ts` — `assertSendsNoLocalPath`, `localPathIn`,
`OutgoingPathError` — called from `generateImages`
(`service/src/images/generate.ts`) on **the prompt and the negative prompt**,
immediately before `client.generate`. Those two strings are the whole of what the
image client sends, so a photograph could only leave as a path in one of them.

**It looks for a path, not for a photograph, deliberately.** A guard that had to
know which paths were photographs would have to read the client's pictures, which
is precisely what the source scan forbids the image graph from doing.

**It does not fire on real prompts.** All **30** prompt and negative-prompt
strings stored across the five corpus plans were run through `localPathIn`: **0
flagged.** The pattern needs an absolute POSIX path with a directory in it, a
`~/…`, or a Windows drive path; `3/4`, `and/or`, `f/2.8` and `2026-08-31` all
pass.

**Proven to fail, twice.**

- Deleting the two `assertSendsNoLocalPath` calls from `generate.ts` turns both
  new tests in `service/src/images/generate.test.ts` red — *"refuses to send a
  prompt naming a file on this machine, before any request"* and *"refuses the
  same in a negative prompt"* — and restoring them turns all 33 green. Each test
  also asserts `client.requests` is **empty**, so the refusal happens before the
  request rather than after it.
- Four unit tests in `core/src/outgoing-text.test.ts` cover the path forms, the
  message naming which string it was, and the ordinary prompts that must pass.

### 5. The control

`panel/src/ClientPictures.tsx`, **one component on both client screens**, because
two would drift.

- **The setup form** (`NewClient.tsx`). The client does not exist yet, so there
  is no `/clients/pictures` to call: the list is held on the form and sent as
  `pictures` with `POST /clients`. `buildClient` now numbers them with the same
  `nextPictureId` `addPicture` uses and runs the same new `checkPicture` —
  absolute path, file really there, a description. **A setup screen accepting
  what the client card refuses would write a client file the panel could not have
  made twice.**
- **The client card** (`ClientCard.tsx`), for a client already saved. Each change
  calls the service and then **re-reads the client list from it**.
  `CatalogueMode.pictures` carries them; **absent means a service older than this
  panel**, which is not the same as a client with none, so the editor is not
  rendered at all rather than offering a route that is not there — session 32's
  rule.

**The photo is chosen, never typed.** `pickImageFile`, the same
`showOpenDialogEx` the video and logo pickers have used since Block 8 session 44.
A cancel leaves what he had. **A host with no chooser gets a sentence saying so
and no Add control** — not a typed path field, which would work around the ruling
rather than honour it. The existing list is still shown and still removable there.

**A description is required** by the service and by the screen: Add stays
disabled until there is one. It is the only thing that will tell him which
photograph is which a month later.

**Format**: `panel/src/still-formats.ts` — the module was `logo-formats.ts` and is
renamed, because a client's photograph is judged against the **same** set and a
list borrowed from the logo under the logo's name is a second declaration waiting
to happen. Narrowing it for photographs would refuse a file the build can place,
on no evidence. A `.mov` is refused by name — *"A .mov cannot be used as a
photo"* — before Add is possible; a `.psd` is accepted, and the thumbnail says
*"This panel cannot show a preview of this kind of file"* rather than leaving a
broken image. A file that has moved says *"has it moved?"* from the image's own
`onError`, which is a different thing again.

**Removing says what it does, above the button**: *"Forgetting a photo leaves the
file itself exactly where it is."* It forgets; it never deletes.

### 6. Driven end to end, against the real service

**Not a fixture.** The service was rebuilt at this session's code and restarted
(the one running was from before it and correctly reported no `pictures`), and
the **built panel bundle** was driven in Chromium against it over real HTTP. Only
two things are stubbed: CEP's `cep_node` bridge and the native file dialog, which
no automated run can click. Every step below is what the page did.

| | |
|---|---|
| 1 | panel loaded, `section.video` present |
| 2 | picked **K2 Syndicalia**; the card showed **Their own photographs** and *"None yet."* |
| 3 | Choose a photo… → `/Volumes/T7 Shield/…/assets/brand/Framopia_LOGO.png` shown under the button |
| 4 | described it, Add → listed, and the thumbnail **decoded at 962x1077** — the real file, drawn |
| 5 | `modes/k2-syndicalia.json` on disk really carried it |
| 6 | picked video **vitasilk**, opened **Pictures**: the photograph is offered on **all five** slots, *"Or use one of the client's own pictures"*, with a **Use this** control. **Nothing was chosen** |
| 7 | Back, then **Forget this** → gone from the screen and from the file |
| 8 | **`modes/k2-syndicalia.json` byte-identical to its start sha, `c600905c…`**, and no Edit Plan touched |

**0 uncaught page errors** throughout.

**The test picture is `assets/brand/Framopia_LOGO.png`** — a real file already
committed to this repository, read only. Nothing was created, copied or moved,
and the driver script lives in the session scratchpad, not in the repo.

### 7. A client's photographs are not in the backup set

Measured against `surveyGroups` rather than reasoned about: **126 files across
nine groups**, and **no still image under the footage directory is swept** —
`plans` filters `.editplan.json`, `images` walks `cutouts/`, `footage` takes video
extensions only. The test photograph appeared in **no** group.

**Reported, not fixed**, as the brief asks. The client's file names the path and
is in git, so the *reference* survives; the photograph itself is wherever he put
it and `npm run backup` will not save it. Whether a client's own photographs
belong in the backup set is a decision — they are his originals, they may be
large, and he may already have them backed up somewhere else.

### 8. Tests

**New:** 4 in `core/src/outgoing-text.test.ts`, 2 in
`service/src/images/generate.test.ts`, 4 in `service/src/clients/create.test.ts`,
1 in `panel/src/still-formats.test.ts`, 6 browser tests in
`panel/src/render.browser.test.ts` (4 on the setup screen, 2 on the client card).

**Retired rather than left green:** the browser assertion *"Adding their own
photographs is not built yet"* became false the moment the control landed. It is
replaced by its negation plus an assertion that the section is there, with a
comment saying what it used to say and why it went.

**One of the new browser tests was passing for the wrong reason and was fixed
before being kept.** The route stub mutated the very object React was holding —
the `/modes` fixture is returned by reference — so the list appeared to update
even with the client card's `fetchModes` refresh deleted. The stub now returns a
fresh clone per request, and with the refresh deleted the test times out and
fails, as it should.

---

## Deviations

**The control is on both client screens, not only the setup form.** The ruling
says the photographs belong on the client screen; `addPicture` needs the client
to exist on disk, so the setup form alone would have left the one real client —
K2 Syndicalia, and every client saved before today — permanently unable to have
any. One component serves both, and the setup form's list travels with the new
client instead of calling a route that cannot yet exist.

**`panel/src/logo-formats.ts` was renamed to `still-formats.ts`.** The brief said
to reuse the declaration if it fits, and it fits exactly; keeping the logo's name
on a set that also governs photographs is how a second copy gets written later.
`judgeLogo` → `judgeStill`, `logoVerdictSentence` → `stillVerdictSentence` with
the noun as an argument. No value in either list changed.

**The end-to-end run used a real service and a stubbed CEP bridge.** A person
clicking inside After Effects is the thing this does not reproduce; see below.

**A photograph was added to a real client's mode file and then removed through
the panel.** The brief forbids changing a mode file and also asks for the feature
to be seen working on a real client; the round trip satisfies both, and the file
is byte-identical at both ends. Removing it was also the only way to exercise the
DELETE route.

**The background service was rebuilt and restarted.** The one running (pid 1214)
predated this session's service code and would have answered without `pictures`.
The new one is pid 65295, and its source hash `08e8463f34d2f91c` is **identical**
to the panel bundle's, so the two match.

---

## Failures & open problems

**Unproven, by name:**

- **None of this has been seen inside After Effects.** The panel was driven in
  Playwright's Chromium, launched with `--allow-file-access-from-files` and
  `--disable-web-security` so that a `file://` page may reach the service on
  `127.0.0.1` — the service sets no CORS headers and CEP evidently relaxes this
  itself. That is a claim about the host taken on the evidence that the panel
  works there, not on an observation. CEP 12 is Chromium 99; nothing new here uses
  anything past `ResizeObserver`-era features, and the capability gate over the
  built bundle passes.
- **The no-chooser branch has not been seen.** A host with `cep.fs` but no
  `showOpenDialogEx` gets a sentence and no Add control; that path is rendered by
  no test, only reasoned from `fileDialogSupport`.
- **No client picture has ever been built into a comp.** `fitByLongEdge` and
  `build-reel-cli.ts`'s precedence are unit-tested and have never run on a real
  plan, because choosing one would change a golden reel. The photograph reaching
  the picture editor with a working Use control is as far as this session went.
- **The `.psd` and moved-file thumbnails** are covered by browser tests against
  invented paths, not by a real `.psd` or a real deletion.

**Open:**

- **`preflight.ts` does not check a chosen client picture's file.** A photograph
  deleted after being chosen fails inside After Effects rather than before the
  build starts, which is the opposite of what every other referenced file gets.
- **A client's photographs are not backed up** (§7). A decision, not a bug.
- **A client's photographs cannot be edited except by adding and forgetting** —
  no way to change a description, and no ordering.
- Unchanged and untouched: `ground truth`'s unbuildability, `build-reel.jsx`'s
  unsaved-changes guard across two checkouts, the three false-premise tests from
  session 20, and the 14 historical attribution commits.

**The panel's image-picker tests did not flake**, in three full `npm run check`
runs and several targeted runs of the browser file.

---

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `1c8c850` *docs: record the client photographs control and the outgoing-path guard* (this report follows) |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at both ends |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c`, 552,745 bytes, never opened for writing |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc03426d6474904020b80848fa09f3d29876c48a0aa5d4c00f` — identical at both ends, across an add and a remove |
| cache | **46 entries / 80 files / 54,256 KB** at both ends |
| After Effects | pid **983**, one instance, 0 `aerender`; **1198 font names** at both ends; the project open at the start was empty, untitled and clean |
| service | rebuilt and restarted, pid **65295**, source hash `08e8463f34d2f91c` — the same as the panel bundle's |
| free space | **161 GiB** |
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

**Edit Plans, sha256.** `ground truth` is unchanged; the other four moved for one
reason only — `npm run golden` builds all four and each build writes a fresh
`builtAt`.

```
start                                                             end
0712e412…  ground truth   →  0712e412…  (unchanged)
431b6564…  test 1         →  dbe14b78…  (golden's builtAt)
de5e8fad…  test 2         →  289e4403…  (golden's builtAt)
d26b42ea…  test 3         →  6847e16b…  (golden's builtAt)
1c340f4f…  vitasilk       →  bd0f00d9…  (golden's builtAt)
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

The "after" column is read from the run's own output. The "before" column is
derived from it by subtracting the tests this session added — core +4, service
+6, panel +7 — rather than re-run against the previous commit.

| workspace / gate | before | after |
|---|---:|---:|
| core | 747 | **751** |
| service | 1202 | **1208** |
| benchmarks | 173 | 173 |
| panel | 197 + 2 skipped | **204 + 2 skipped** |
| modes | `mode k2-syndicalia v12: ok (fonts set)` | unchanged |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| ExtendScript | 15 `.jsx` ok | unchanged |
| references | `6 hand-made reference file(s)` · `PASS` | unchanged |
| attribution | `PASS` | `764 tracked text file(s), 727 commit message(s)` · `PASS` |
| pytest | 149 | 149 |

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field:
test-1 4415, test-2 4280, test-3 3709, vitasilk 4770, **17,174 fields**, against
the reference recorded 2026-08-31, After Effects 26.0x67, 1198 font names. The
reference was **not re-recorded**.

## Suggested next step

**A client picture has never been built into a comp**, and that is now the only
untried link in the chain. It cannot be tried on a golden reel without moving the
reference, so the honest way is a scratch plan outside the repository — the way
session 19 proved the shadow colour adapts — choosing a photograph of a
deliberately non-square shape and reading back what After Effects placed:
`fitByLongEdge` says the long edge lands on 1000 px inside the 1200 px comp and
nothing is cropped, and no build has ever confirmed it. `preflight.ts` gaining a
check on the chosen picture's file belongs in the same session, since a missing
photograph is exactly what such a build would hit first.

---

## What to open, and what to do

**To add a photograph to a client who already exists** — Window → Extensions →
Framopia Studio, choose the client, and under **Their own photographs** on the
client card: **Choose a photo…**, type what it is, **Add this photo**. Three
controls, no path typed, nothing copied.

**When setting a new client up**, the same section is at the bottom of the setup
form, under their colours.

Either way the photograph is then offered for **every** picture in **every** video
of that client's, in **Pictures**, beside the generated candidates — pick **Use
this** on the slot you want it in. **Forget this** on the client screen takes it
off the client and leaves your file exactly where it is.

## Commits

| | |
|---|---|
| `59e105c` | `refactor: name the still-image formats for what they are` |
| `4b5f630` | `feat: add a client's own photographs on the client screen` |
| `56d7173` | `fix: refuse to send a prompt naming a file on this machine` |
| `1c8c850` | `docs: record the client photographs control and the outgoing-path guard` |
| this one | these reports |
