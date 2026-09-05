# Block 10 session 54 — the panel catches up with the feature

**Status: OK.**

## Can a label be written in the panel?

**Yes.** There is a box under every photograph's description that says *"Use it
when someone says…"*, on both client screens — where a client is set up and on
the client card afterwards — and on the picture screen for a photo that belongs
to one video. Type the words that mean the picture and it is used automatically
whenever one of them is spoken. Leave it empty and the picture behaves exactly
as it always has: it waits to be chosen by hand.

## What the two buttons are called

**Make the subtitles — about $0.35** and **Make the pictures — about $3.98.**

Both are on screen at once with what each will cost. *Run pipeline* is gone: it
was the name of a mechanism, and it did everything in one press, so the only way
to read a transcript was to buy the pictures first. The second button is refused
until the subtitles exist and says why in plain words — *"The pictures are drawn
from the subtitles, so make those first."*

## Done

### 1. The client screen

| what he asked for | where it is now |
|---|---|
| a label beside each picture | `ClientPictures.tsx`, on the setup form and the client card |
| pictures added on creation and afterwards | **was already there** — see below |
| every other field editable | `POST /clients/details`, *Change their details* on the card |
| a client can be deleted | `DELETE /clients`, *Take them off the list*, with a confirmation |
| three faces | `createClient` takes `emphasis`; the setup screen has a third picker |
| Dr Loubna Kfafi's borrowed faces editable | yes, through the same control; her file is untouched |

**The brief's premise for the second row was out of date.** `ClientPictures.tsx`
was already rendered by `NewClient.tsx:307` and `ClientCard.tsx:105`, and the
card already called `addClientPicture` and `removeClientPicture` through the
native chooser. That was checked before anything was built and the effort went
elsewhere; it is now driven by clicking as well as read.

**Which fields had a route, and which did not.** Before this session:
`POST /clients` created one, `POST /clients/pictures` and its `DELETE` managed
photographs, `POST /clients/palette` corrected the four colours. **Nothing else
could be changed at all** — not the name, the note, the video folder, the logo,
the language, the video shape, the subtitle baseline, the watermark default or
the faces. All nine now go through `POST /clients/details`.

**Only what is sent is touched.** `null` clears a field, an absent key leaves it
exactly as it is — which is what keeps a blank meaning *standard* rather than
becoming a choice nobody made, and is asserted both in the service and by
clicking. **The version moves only when the look moves**: the name, the faces
and the subtitle baseline are in the snapshot a reel pins; the folder, the logo,
the language and the shape are about the client and not about a comp. **The id
never changes**, whatever the name becomes — it is the filename, the value on
every plan and the key every snapshot pins.

**A label has its own route** (`POST /clients/picture-label`) because a label is
corrected far more often than a photograph is replaced, and re-adding the file
to change one word would renumber it and orphan every plan naming it. It does
**not** bump the version: a label decides which picture answers a word next
time, and offering to move every reel forward because a label was corrected
would be noise.

**Deleting is safe, and that is measured rather than assumed.**
`service/src/clients/delete-is-safe.test.ts` pins a real corpus plan to a
scratch client, builds the whole reel — every element, every timing, every
colour and every face — deletes the client, builds again, and asserts the two
are the same string. It is not the `.aep`: After Effects embeds a timestamp, so
two builds of one comp never have the same bytes (session 52 measured that and
golden excludes it for the same reason). What the builder hands to After Effects
is deterministic and is what decides the comp.

**The file is moved aside, not destroyed** — `.local/deleted-clients/<id>-<when>.json`
— because a client is something the user made. The confirmation says what
removal does: reels already made keep the look they were made with and can still
be rebuilt; **a reel using one of that client's own photographs would no longer
find it**; their details are kept.

**Three faces.** `createClient` accepted two, which is why Dr Loubna Kfafi's
emphasis face had to be written into her file by hand in session 50. It now
takes `latin`, `emphasis` and `arabic`, each chosen from the list After Effects
itself reported — and **records the chosen name twice**, as the name a person
reads and as the `postScriptNames` entry a build writes, because After Effects
rejects any font name containing a space and the name from that list is the one
it accepts. Her file was not touched; the control that would change it exists.

### 2. Pictures for one video

They live on the plan as `plan.pictures`, the same shape as a client's, numbered
**`own001` upward** against a client's `pic001` — a slot records one id and both
lists are searched from it, so the two namespaces must not meet.

**What wins, and why.** A picture attached to this reel. It is the more specific
statement: it was chosen for this video, while a client's applies to everything
they will ever make. **The preference is expressed as search order and nothing
else** — `matchClientPicture` already takes the first picture whose label holds
the word, so putting the reel's list in front of the client's is the whole of
it. One matching rule, no second copy; session 4 lost four of five images to two
copies of one rule and session 53 extracted `build/client-picture.ts` for that
reason. A test asserts the answer is exactly what the matcher gives for the two
lists joined in that order.

**Forgetting one frees the slots that had chosen it**, because a slot naming a
picture nothing can resolve is a build that refuses at pre-flight — and the user
forgetting a picture is not asking for that.

**The never-sent tests are untouched and still pass.**
`service/src/clients/pictures.test.ts`, `git diff` empty, 7 tests:

- *"is not read by anything that can call the image model"* — reads every
  non-test `.ts` in `service/src/images/` and fails if one contains
  `clientPictures`, `chosenClientPictureId` or `client-pictures`.
- *"is not copied anywhere: the module that owns it writes nothing"* — reads
  `core/src/client-pictures.ts` with comments stripped and fails on `copyFile`,
  `writeFile`, `node:fs`, `cacheEntryDir` or `.local`.

Nothing added here weakens either: a video's pictures are written by
`service/src/video-pictures.ts`, which the image graph does not import, and the
path on the plan is the file where he put it — asserted, with the file's bytes
read back afterwards.

### 3. The two buttons

Named as he named them. Both always on screen, each with its own price. The
second is disabled until the subtitles exist, and the sentence beneath it
changes rather than the button disappearing.

**Whether the subtitles exist is `wordsDone`**, computed in the dry run beside
`wordsUsd`, for the reason that figure is computed there: which stages are "the
words" is `WORDS_STAGE_IDS`, and a second copy in a React bundle is a second
place for it to drift. **A price of zero is not the same answer** — the words
can be free because they are cached and still never have been written onto this
plan, and session 31's control read exactly that way.

**Nothing is re-billed, confirmed by clicking**: pressing the first posts
`only: ['transcription', 'analysis']` with no `redo`; pressing the second posts
`only: ['images'], redo: ['images']` and the screen says *"The subtitles are
done and are not charged for again."* `redo` is not optional — the slot stage
writes `pipeline.images.status = 'done'` when it plans the slots, so `only`
alone would skip the stage.

**He can correct the words in between**, on the transcript screen session 31
built. What an edit reaches: an edited word changes the transcript's content
hash, so **the keywords and the picture ideas are re-derived from the edited
words on the next run** rather than kept — that is what the merge's staleness
check is for, and it is why the order is subtitles first. Editing does not
re-bill anything already cached whose inputs did not change.

**The second button does not offer to buy a picture for a slot a label already
fills.** `picturesUsd` is the `images` stage estimate, and session 53 made that
estimate count only `slotsNeedingGeneration(slots)` — the same one declaration
the image stage itself uses. Its note names them: *"N slot(s) use one of the
client's own pictures and cost nothing."*

### 4. Driven by clicking

**Twelve new tests in `panel/src/client-editing.browser.test.ts`**, driving the
real built bundle in Chromium, in their own file and so their own browser for
session 47's reason.

| step | what happened |
|---|---|
| create a client with three faces | posts `fonts: {latin, emphasis, arabic}` — all three |
| create with a labelled picture | posts `pictures: [{path, description, label}]` |
| create with an unlabelled one | posts the picture with **no `label` key at all** |
| read what the screen says | *"used automatically whenever one of those words is spoken"*, and it never says *match* or *label* |
| write a label on a saved picture | posts to `/clients/picture-label` with the picture's id |
| edit two fields on the card | posts **only those two**; `language` and `videoShape` absent |
| change a face after creation | posts all three, the two stored plus the new one |
| take a client off the list | asks first, says what happens to reels and to photographs, then `DELETE /clients?client=…` |
| attach a picture to a video | posts to `/video/pictures` with the plan's path and the label |
| read the video-pictures wording | *"Pictures for this video… not for the client… before any of the client's own"* |
| forget a video picture | `DELETE /video/pictures?…picture=own001`, and the screen says the file is left where it is |
| press both run buttons | already driven in `render.browser.test.ts`: the first asks for the two word stages, the second for `images` with `redo` |

**No request left the machine: 0 attempts.** Every call goes through a recorder
that answers locally and throws on anything not addressed to `127.0.0.1` or
`file://`; the recorded list is asserted empty in every test that acts.

**What could not be exercised.** The native file chooser is `cep.fs.showOpenDialogEx`,
an OS window nothing on the page owns — it is stubbed to answer a fixed path, so
what is proved is that the panel asks for it and uses what it returns, not that
macOS draws it. The same is true of the OS colour picker (session 47's finding).
And the panel really runs in CEP's older Chromium; these tests use current
Playwright Chromium, so a syntax or API difference between the two would not
show here.

**Eight service mutations and four panel mutations, each restored:**

| mutation | result |
|---|---|
| an empty label written as an empty string | 2 red |
| a label bumps the client's version | 1 red |
| `setDetails` writes every field, sent or not | 6 red |
| `deleteClient` destroys the file | 1 red |
| the client's pictures searched before the video's | 1 red |
| forgetting a picture leaves the slot naming it | 1 red |
| the build ignores a picture on the plan | 1 red |
| a deleted client changes what a built reel says | 1 red |
| the label dropped on its way out of the panel | 2 red |
| the third face not sent | 1 red |
| the card sends every field, touched or not | 1 red |
| removal happens without asking | 1 red |

**Scratch clients, pictures and plans**: every one was made inside a temporary
directory that the test deletes, or written into `modes/` and removed in
`afterEach` whatever happened. `modes/` holds the two real clients and nothing
else at the end, and both are byte-identical.

## Deviations

**A test failure in the panel suite killed the run with an out-of-memory error,
and the cause is worth recording.** Two assertions in `render.browser.test.ts`
described the retired single-control behaviour and read
`expect(await page.$('.partrun')).toBeNull()`. When that fails, vitest
serialises the received value for its diff — and the received value is a live
Playwright `ElementHandle`, whose object graph reaches the whole browser. The
diff exhausted the heap and killed the worker, so **the run reported a fatal
error rather than the two failing assertions**. It was diagnosed by stashing the
panel changes and watching the same file pass, then bisecting to `App.tsx`. The
assertions were rewritten for the new behaviour; nothing was weakened. Two
speculative fixes made along the way — a `vitest.config.ts` and a split test
script — were removed once the real cause was found, and are not in the commits.

**`handoffs/block-10-opening-prompt.md` was renamed to `handoffs/block-10.md`
during this session, and not by this session.** The file timestamps are 00:14
and 00:15; nothing here reads or writes `handoffs/`. It is left exactly as it
is, uncommitted, rather than absorbed into a commit of this session's work or
reverted.

Nothing else. **$0.00 spent**, ledger unmoved.

## Failures & open problems

- **A picture attached to a video is not in the backup set either**, for the
  same reason a client's is not — it is a path to a file elsewhere.
- **Removing a client does not free the slots that used their photographs.**
  Forgetting a *video's* picture does; a client's does not, so a reel that had
  chosen one refuses at pre-flight until the choice is cleared by hand. The
  confirmation says so rather than the code hiding it, and closing it means
  walking every plan on the disk from a client route.
- **The label editor on the client card saves on a press, not per keystroke** —
  the button appears only once the draft differs from what is stored. That is
  deliberate; a label typed a word at a time would be one file write per letter.
- **The panel's own tests cannot exercise the native choosers**, as above.
- **`npm run check` is about a minute slower**: a third browser file.
- Everything else open at session 53 is untouched and still open: the
  image-picker fixtures, the scaled-up small picture, the backup set, and the
  `pipeline.images.status` double-write that makes `redo` necessary.

## Repo state

- `npm run golden` **PASS** — 4 of 4 reels field for field, **17,174 fields**
  (test-1 4415, test-2 4280, test-3 3709, vitasilk 4770). Reference
  `74436a960706fecd`, **not re-recorded**. Nothing moved; this was panel work.
- `npm run check` **PASS, exit 0** — core **777**, service **1358**, benchmarks
  **173**, panel **233** with 2 skipped. Service up 25 on session 53's 1333
  (15 in `edit.test.ts`, 9 in `video-pictures.test.ts`, 1 in
  `delete-is-safe.test.ts`); panel up 13 (12 new browser tests, 1 new
  run-control test). Two earlier runs failed — one on a stale bundle, one on the
  out-of-memory above — and both are reported rather than hidden.
- **Ledger unmoved**: 165 lines, `786497a5f371d179…` at both ends.
- `templates/library.aep` `4b0cf05a8f5d4775…`, `modes/k2-syndicalia.json`
  `c600905c5e36ecbc…`, `modes/dr-loubna-kfafi.json` `f60749f5629b2ced…` — all
  byte-identical at both ends. **Neither real client was edited.**
- **`.local/quarantine-session51/` (3 entries) and `-session53/` (11 entries)
  intact.** One scratch client the deletion test moved aside was found in
  `.local/deleted-clients/` at the end and went to `-session54/`; that directory
  is empty of anything real and was removed.
- Branch `main`. Four commits: the label and client editing, the video's own
  pictures, the two buttons, and the browser tests — plus this report. The
  handoff rename above is left in the tree, unstaged.

## Suggested next step

Removing a client leaves any slot that had chosen one of their photographs
naming a picture nothing can resolve, and the build refuses at pre-flight. It is
the last sharp edge in what this session added, and closing it means the client
route walking the plans on disk the way `migrate:cv-dirs` walks `.local/`.

## To give a client a labelled picture

Open the panel. Pick the client, press **Change their details**' neighbour on
the client card — the photographs are already listed there — press **Choose a
photo…**, say what it is, and in **Use it when someone says…** type the words
that mean it. Press **Add this photo**. From then on any video for that client
uses that photograph wherever one of those words is spoken, and pays nothing for
it.
