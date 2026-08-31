Status: OK

# Block 10 session 18 — say what each colour actually does

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`**,
`templates/library.aep` `1d7553e894…`, cache **46 entries / 79 files /
55,363,681 bytes**, all five Edit Plans and all six hand-made references
byte-identical, **`modes/k2-syndicalia.json` untouched and no colour value
changed** — all at both ends. After Effects **pid 79146**, **445 families / 1198
raw face names** at both ends. The user's `.local/build/vitasilk-full.aep` open
and clean at both ends; **no reel was built and nothing was saved.** Free space
**173.1 GB**.

**He was right, and two of the four captions were factually wrong.**

---

## Done

### 1. Where each colour actually goes

**From the code, then from four real builds.** Every use, with the file that
decides it:

| role | hex | where it goes | decided at |
|---|---|---|---|
| **`light`** | `#F8F6F2` | **ordinary subtitle words** — the placeholder fill on every `sub_` card | `core/src/text-colours.ts:19` → `service/src/build/text-style.ts:74` |
| | | **the frame round a placed picture**, when it wins the contrast race | `core/src/image-border.ts:69` `cardFrameColour` |
| | | a candidate ground behind a cut-out | `core/src/image-border.ts:172` `cardColours` |
| | | named in the image prompt as a colour that carries the subject | `modes/k2-syndicalia.json` `imageStyle.stylePrompt` |
| **`accent`** | `#C9A96E` | **emphasised keyword words** — the placeholder fill on every `kw_` card | `text-colours.ts:20` → `text-style.ts:74` |
| | | named in the image prompt | `stylePrompt` |
| **`background`** | `#1A0000` | **the ground baked behind a cut-out** | `tools/cv/framopia_cv/cli.py:101` `flatten_cutout`, called from `build-reel-cli.ts:475` |
| | | the picture frame, on a picture bright enough | `cardFrameColour` |
| | | named in the image prompt as the ground behind the subject | `stylePrompt` |
| **`primary`** | `#820000` | **nothing in the built comp** | — |
| | | a candidate for frame and ground that **can never win** | `cardFrameColour` |
| | | named in the image prompt for depth | `stylePrompt` |

**Verified against real builds, not only the code.** Fill colours of every text
layer, from the golden reference recorded from four comps measured inside After
Effects:

| colour | count | on |
|---|---:|---|
| `#F8F6F2` | **254** | placeholder layers of `sub_` comps |
| `#C9A96E` | **8** | placeholder layers of `kw_` comps |
| `#820000` | **262** | shadow layers of every comp, `sub_` and `kw_` alike |
| `#1A0000` | **0** | — appears on no text layer at all |

Per reel: test-1 64 + 2, test-2 64 + 3, test-3 58 + 0, vitasilk 68 + 3.

**And from the open project itself**, a read-only pass over every solid and
effect colour in `vitasilk-full.aep`: `CARD` carries a **Fill effect set to
`#F8F6F2` on all five image comps**. So on that reel the picture frame is drawn
in `light` — the caption said the frame was `#C9A96E`.

**And from the flattened cut-out on disk**: `img002-c1.cutout.on-fill.png` reads
**`#1A0000` at all four corners**. That caption — *behind a cut-out picture* —
was the one of the four that was right.

### Three findings, in order of how much they matter

**1. The picture frame is not fixed to a role, and `accent` can never be one.**
`cardFrameColour` takes whichever role separates best from the picture's own
edge, so the frame is chosen per picture. Swept over 101 edge luminances from 0
to 1 against K2's palette, the winner is `light` 18 times and `background` 83
times — **`accent` and `primary` never win, at any luminance**. A mid-tone loses
to both extremes. So *"the frame around a picture"* on `#C9A96E` was wrong twice
over: the frame is not a fixed role, and that role can never be it.

**2. The 262 shadows are the templates', not the palette's.** `#820000` is baked
into all four text comps — `templates/library.audit.json` shows
`TXT_MAIN_SHADOW` at `#820000` in `sub_pop`, `sub_pop_ar`, `kw_slam` and
`kw_slam_ar` — and the build never sets it. `service/src/build/reel-plan.ts:45`:
the shadow is *"never given a colour — the shadow's own is the design."* It
equals K2's `primary` by coincidence of the brand. **A different client's
`primary` would not move it**, so a caption promising it would is a caption that
lies to the next client.

**3. A stale comment, and the code and the comp did disagree.**
`core/src/text-colours.ts` said **"Nothing reads this at build time yet"**. It is
read: `textStyleFor` calls `resolveTextColours` and sets `fillColor` on every
placeholder, which is exactly where the 254 and the 8 come from. Stale since
Block 9 session 6 wired it up. Corrected in place.

**Every colour has at least one use.** `primary` has none in the built comp,
which is worth saying plainly rather than leaving it to look like an oversight —
what it does is reach the image model, and the caption says so.

### 2. The labels, written from that

| | hex | caption |
|---|---|---|
| 1 | `#F8F6F2` | your ordinary subtitle words, and usually the frame round a picture |
| 2 | `#C9A96E` | the words you emphasise |
| 3 | `#1A0000` | behind a cut-out picture, and the ground the generated pictures are lit against |
| 4 | `#820000` | depth in the generated pictures — the shadow behind your words comes from the template, not from here |

- **A colour with more than one job says so.** `light` is words *and* frame;
  `background` is the cut-out ground *and* the ground in the picture itself.
  Neither picks one and hides the other.
- **The order is his, not the file's**: the two subtitle colours first, because
  they are on every card of every video; the two that only touch pictures after.
  `PALETTE_ROLES` order in the file is background, primary, accent, light — the
  screen no longer follows it.
- **`primary`'s caption carries its own caveat.** Saying only "depth in the
  generated pictures" would leave him wondering what draws the shadow he can
  plainly see; saying it comes from the template is the true and useful half.
- **No role was renamed and no value changed.** `modes/k2-syndicalia.json` is
  byte-identical and `git diff` over `modes/` is empty.

**§2.5 — the captions appeared in two places and had already drifted.**
`service/src/catalogue.ts` fed the client card and `panel/src/NewClient.tsx` fed
the setup screen, each with its own copy. Both now read
**`core/src/palette-meaning.ts`**, and a test fails if either grows a literal
caption of its own.

**One structural consequence, and the precedent for it.** `palette-meaning.ts`
imports nothing, and `PALETTE_ROLES` moved into it with `mode.ts` re-exporting
both it and `PaletteRole` — so every existing importer is unchanged. It had to
move: the panel reads these captions, `mode.ts` reaches `node:crypto` and
`node:fs`, and esbuild cannot resolve those for a browser target. That is the
same reason `build-stamp` is its own subpath, and the build failed exactly that
way before the inversion.

### 3. The last vague sentence

**What is actually true.** A client's own picture is `{ id, path, description }`
— his words, "the clinic exterior" — offered in the picture editor beside the
generated candidates, per slot. `ImageSlot.chosenClientPictureId` is a
human-flagged marker and **wins over `chosenCandidateId`**. It is **never sent
anywhere** and **never copied**: `service/src/clients/pictures.test.ts` reads
every file in `service/src/images/` and fails if one mentions it, and asserts
that `core/src/client-pictures.ts` writes no file and names no cache path.

**The sentence was wrong in both halves.** *"Their own pictures are added later,
once there are videos to use them in"* named a precondition that does not exist
and implied a place that does not. The service has taken them since Block 9 —
`POST /clients/pictures` and its DELETE, both wired in `server.ts` — and the
panel's own `addClientPicture` in `service.ts:376` calls that route.

**The only missing piece is a control that calls it.** `addClientPicture` is
declared and **no component invokes it**; a search across every `.tsx` returns
the declaration and nothing else. So nothing is waiting on videos; the screen has
not been built.

It now reads: **"Adding their own photographs is not built yet. When it is, it
will be here."**

*(I nearly reported the panel-side function as absent: my first grep was
truncated by a `head -8` and I read the silence as evidence. Caught by the
function turning up in the next search. The claim above rests on a complete
search, not that one.)*

---

## Deviations

**None.** The measurement, the labels and the documentation are three commits as
asked. No colour value or mode file changed, no client-picture work was started,
no font list was touched, no reel was built, no billable stage ran, and no ruled
constant, template, cache entry, Edit Plan, generated image or hand-made
reference changed.

**No build was needed.** §1's verification came from the golden reference, which
was recorded from four real builds measured inside After Effects, plus a
read-only pass over the project the user already had open. His
`vitasilk-full.aep` is open and clean, exactly as it was found.

## Failures & open problems

**Unproven, by name:**

- **The new captions have not been seen on screen by a person.** They are
  asserted in a browser test driving the real bundle, which is not his eye in
  After Effects.
- **The frame sweep is K2's palette only.** `accent` and `primary` can never be
  a frame *for these four colours*; a client with a different mid-tone
  distribution could produce a different answer, and the caption says "usually"
  for that reason.
- **`background` has never been observed as a picture frame.** The sweep says it
  wins on a bright picture; every picture in the corpus is dark, so `light` won
  all five. The caption does not claim otherwise.
- **The `#F8F6F2` frame and the template's own `CARD` solid are the same
  colour**, so the Fill effect being applied at all cannot be told apart from
  the solid showing through on this reel. The Fill effect is present and set —
  read from the project — but its visible effect is unobservable here.

**Open:**

- **`primary` does nothing in a built comp.** Reported, not acted on: whether
  the shadow should be client-driven rather than template-baked is a ruling, and
  `textColours.shadow` already exists as an unused optional role.
- **A client's own pictures still cannot be added from the panel** — everything
  but the control exists.
- The panel suite's 5000 ms timeout, the build guard, `ground-truth`'s
  unbuildability and the 14 historical attribution commits are all unchanged.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `d8fbb7f` *docs: record where each colour goes* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| cache | **46 entries / 79 files / 55,363,681 bytes** |
| fonts | **445 families / 1198 raw face names** at start and end |
| After Effects | pid **79146**, 0 `aerender`; `vitasilk-full.aep` open, clean, 97 items |
| free space | **173.1 GB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references, sha256, identical at start and end:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Edit Plans, sha256, identical at start and end:**

```
0712e4124d8b5f09641de4ed4276897f3c8cb6781e705df64d49c84dc5db7034  ground truth.editplan.json
1acf10bf06925473c501f30b8ebb290c5fa8f091fcc5ca32485e1ff316221e35  test 1.editplan.json
94da6dd60af1d138a87e1c8f2cc235f542014605d14c4795f165d35c11d27f0a  test 2.editplan.json
dbf28f9bafb55b126d97076b16df56baa1a2d7775343dc07ed6af83468302594  test 3.editplan.json
c8501bcafc79ed3bd74fec776a2401efa8e68caab41cea5b8d2d1ac221c63c20  vitasilk.editplan.json
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 720 | **728** |
| service | 1180 | **1180** |
| benchmarks | 173 | **173** |
| panel | 190 + 2 skipped | **190 + 2 skipped** |
| modes | `mode k2-syndicalia v12: ok (fonts set)` | unchanged |
| references | `6 hand-made reference file(s): 4 transcript, 2 alignment` · `PASS` | unchanged |
| attribution | `PASS` | `752 tracked text file(s), 685 commit message(s)` · `PASS` |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| ExtendScript | 15 `.jsx` ok | unchanged |

Core +8: `palette-meaning.test.ts` exactly. Panel unchanged at 190 — three
assertions there were rewritten rather than added, since they pinned the old
captions and the old order.

## Suggested next step

**Open the client setup screen and read the four lines.** Panel → client picker
→ **"Set up a new client…"**, then scroll to **Their colours** at the bottom. In
order:

1. **The first two swatches are now the subtitle colours** — crème `#F8F6F2`
   *"your ordinary subtitle words, and usually the frame round a picture"*, then
   gold `#C9A96E` *"the words you emphasise"*. Those are the two he sees on
   every card of every video and neither was mentioned before.
2. **The third**, `#1A0000`, keeps the one caption that was right and adds the
   other half — it is also the ground the generated pictures are lit against.
3. **The fourth**, `#820000`, is the one worth reading hardest: it says the
   shadow behind his words comes from the template rather than from that swatch.
   That is true, and it means changing this colour for a future client will not
   change their shadow — if that reads as wrong to him, the fix is a ruling on
   whether the shadow should be client-driven, not a rewording.
4. **The line under the swatches** now says adding their own photographs is not
   built yet, rather than implying it is waiting on videos.

The same four captions appear on the **client card on the main screen** once a
client is picked, and they should read identically — that is the point of their
being one declaration.

## Commits

| | |
|---|---|
| `3b26a0e` | `fix: say what each colour actually does` |
| `d8fbb7f` | `docs: record where each colour goes` |
| this one | these reports |
