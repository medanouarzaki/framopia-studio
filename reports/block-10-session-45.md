# Block 10 session 45 — a client's colours reach the video

**Status: OK.** A second client's four colours reach the built comp, proven by
reading the comp; a saved client's colours can now be corrected. $0.00 spent;
the ledger did not move.

## Do a client's own four colours now reach the built comp?

**Yes.** A client created the way the panel creates one, corrected through the
new route, taken through the whole pipeline on its own throwaway video, built,
and the comp read back out of After Effects:

| comp | layer | face | colour | whose |
|---|---|---|---|---|
| g001__sub_pop_ar | TXT_MAIN | Almarai-Bold | **#F2FBFF** | theirs, `light` |
| g001__sub_pop_ar | TXT_MAIN_SHADOW | Almarai-Bold | **#12507A** | theirs, `primary` |
| g003__sub_pop_ar | TXT_MAIN / SHADOW | Almarai-Bold | **#F2FBFF / #12507A** | theirs |
| g004__sub_pop_ar | TXT_MAIN / SHADOW | Almarai-Bold | **#F2FBFF / #12507A** | theirs |
| k001__kw_slam | TXT_MAIN | Inter-SemiBold | **#5FD0F0** | theirs, `accent` |
| k001__kw_slam | TXT_MAIN_SHADOW | Inter-SemiBold | **#12507A** | theirs, `primary` |

**Layers still in any K2 colour: zero.** Before this session every one of them
would have been K2's, and the shadow would have been K2's Rouge `#820000`.

The image prompt too, re-proved read-only with no model call: *"the brighter end
of the palette leads: **#5FD0F0** and **#F2FBFF** carry the subject, with
**#12507A** for depth and **#06131F** kept to the ground behind it."* None of
K2's four appears.

**And a saved client's colours can be corrected** — `POST /clients/palette`, with
a control on the client card. A reel already built is untouched: it rebuilds from
the snapshot it pinned, and the edit bumps the client's version so the panel can
*offer* to move a reel forward rather than moving it.

## What was wrong, and the second thing found on the way

**The palette never left the panel.** `save()` in `NewClient.tsx` built its
request body field by field and simply had no line for the colours, so
`createClient` fell back to the template client's palette — `k2-syndicalia` —
and every client came out in K2's four.

**Fixing that was not enough, and the second defect is the sharper one.** With
the palette sent, the cards were *still* K2's. `textStyleFor` returned `null` for
any client with no measured font names, and the colours travelled inside that
same style — so a client with their own colours and no fonts got no style at all
and was drawn in the template's own, whose shadow is `#820000`, **K2's Rouge**.
A client created through the panel has no measured fonts until someone measures
them, so **that was every new client.** Session 19 found the shadow was K2's red
by coincidence of the brand and fixed it for clients with fonts; this is the same
coincidence surviving for clients without.

A face and a colour are different things. A guessed font renders the wrong type
silently, which is why one is never guessed; a colour the client chose has
nothing to guess about. `textStyleFor` now always returns the colours and omits
only the face. **No ExtendScript change was needed** — `framopiaSetText` already
writes `font` only when it is there, because shrink-to-fit had always sent a
size-only style.

## Done

### A — the palette is sent

**`NewClient.tsx:115`** was the gap: the body was assembled from `note`,
`videoFolder`, `logoPath`, `videoShape`, `subtitleBaselineY`, `fonts`,
`language`, `watermarkByDefault` and `pictures`, and the palette was collected
into React state and never read again.

**Every field the same function collects, and whether it arrives:**

| collected | reaches the request | when |
|---|---|---|
| `name` | yes | always |
| `about` | yes | non-blank |
| `videoFolder` | yes | permanent client, non-blank |
| `logoPath` | yes | permanent client, non-blank |
| `videoShape` | yes | permanent client, chosen |
| `subtitleBaselineY` | yes | permanent client, non-blank |
| `fonts` | yes | **only when both Latin and Arabic are filled** |
| `language` | yes | chosen |
| `watermarkByDefault` | yes | only when switched off, which is correct — absent means on |
| `pictures` | yes | permanent client, at least one |
| **`palette`** | **no → now yes** | permanent client, all four set |

**One more asymmetry, reported not fixed:** `fonts` is sent only when *both*
faces are filled, so a user who types one and leaves the other silently sends
neither. It is not the palette defect — nothing is substituted, the client simply
keeps the standard pair — but it is the same shape, and it is listed under
*Failures*.

**Why all four or none.** The palette is one object on the mode and
`renderStylePrompt` substitutes every role into the image prompt, so a
three-colour palette would reach the model as the word "undefined". The send and
the route both require the four.

**A client saved without touching the colours** still inherits the template
client's palette, which is `k2-syndicalia`'s. **That did not change**, and it is
the remaining half of this defect — see *Failures*.

### B — the screen no longer starts as K2

`NewClient.tsx:50` pre-filled K2's four exact hexes, so a second client opened as
K2 and stayed K2 unless someone noticed.

**There is no honest palette to open with instead, and I did not invent one.**
The four roles are a *brand*, and this project has no brand that is not a
client's. The one measurable source — the template library — supplies only two of
the four roles, and the one it gives for `primary` is `#820000`, which is K2's
own Rouge:

| template layer | colour |
|---|---|
| `TXT_MAIN` on all four text comps | `#F4F4F4` |
| `TXT_MAIN_SHADOW` on all four | **`#820000` — K2's Rouge** |

So the swatches now start on a **grey ramp that reads as unset**, and an
untouched colour is never sent. A colour input always has a value and cannot be
empty, so the swatch itself cannot say "not set" — the word beside it does,
literally `not set` until one is chosen. The caption underneath says what happens
if they are left alone:

> Set all four to give them their own look. Left alone, this client is built in
> the standard one.

and changes, once all four are set, to what they will actually do.

The browser test that asserted the four K2 hexes was rewritten rather than left
asserting retired behaviour, and now also asserts that **none of K2's four
appears anywhere in that panel**.

### C — a saved client's colours can be corrected

`POST /clients/palette`, mirroring `POST /clients/pictures` beside it rather than
inventing a shape: name the client, send the whole palette, get the modes back so
every screen re-reads from the service. `setPalette` re-reads, edits and writes
the file back the way `addPicture` does, so a note or a font someone typed in by
hand survives.

**No reel already built changes, and that is proven rather than argued.** A test
takes a snapshot of the client, edits the palette, and asserts the snapshot is
byte-identical afterwards and that `snapshotIsBehind` now returns true — the reel
is *offered* the move, and moving it stays a control someone presses. The
corpus's own proof is `npm run golden`: **4 of 4, zero differing fields.**

The panel says so before he presses, on the card itself:

> New colours apply to videos you make from now on. Videos already made keep the
> look they were made with, until you move them forward yourself.

The edit bumps the client's version, which is what makes that offer possible.

### D — what stops this happening again

**Session 44's class test caught the palette on its first run, and it caught this
session's fix too.** When the palette started being sent, the test failed twice —
once because a field was sent that the inventory listed as never-sent, once
because the inventory did not name it as a builder — and named exactly where the
entry had to move. That is the test working as designed rather than needing
maintenance.

**Where it still has holes**, named rather than claimed closed:

1. It reads `body['x'] = …` literals, so a field sent through a spread or a
   computed key would be invisible to it.
2. It cannot tell "read" from "read by something that matters" — the palette was
   *listed* as building a reel while never being sent, which is why the
   never-sent list exists beside it.
3. It says nothing about **whether a field's value survives to the comp**. The
   palette reached `createClient` and still did not reach the cards, because the
   fonts gate swallowed it. Only `new-video.test.ts` catches that class.

So `new-video.test.ts` now asserts the comp-level fact: a client whose palette
shares nothing with K2 gets **every card in its own colours, no face it never
named, and no layer in K2's Rouge**. It also had to be wired to pass
`textStyleFor` the way `build-reel-cli` does — it was calling `buildReel` without
it, so every card came back with no style and the colour assertions would have
passed on nothing. That was caught by the assertion failing on `g001 got no style
at all` rather than by inspection.

**Proof the assertions fire.** `textStyleFor` was mutated to return an empty
style for a client without fonts — the defect restored — and the suite re-run:
**the second client's video went red on the colour assertion, and two cases in
`text-style.test.ts` went red**; the two K2 videos correctly stayed green,
because K2 has measured fonts and never reaches that branch. The file was
restored from a copy taken before the edit and confirmed clean.

**A second client end to end, and what still behaves as K2.** The client was
created with no colours, corrected through the new route, and built. Everything
that reaches the comp is its own. What is still K2's, measured:

- **The fallback palette a colour-less client inherits** — `createClient` copies
  `k2-syndicalia`'s, printed in the run: `#1A0000 #820000 #C9A96E #F8F6F2`.
- **The templates' own authored shadow**, `#820000`, which is what a reel with
  no client snapshot at all still shows.

**No request left the machine: 0 attempts**, with `globalThis.fetch` replaced by
a recorder that throws, on top of substituting every billable seam. The real
ledger is byte-identical at 21,055 bytes. Every scratch client, video, plan and
build was removed; `modes/` holds only `k2-syndicalia.json`.

### E — the gates

**`npm run golden`: PASS, 4 of 4, 17,174 fields, zero differing fields.** Nothing
re-recorded. The six existing plans did not move, which is the pinned-snapshot
promise checked.

**`npm run check`: PASS, exit 0, on its first run.** Per workspace:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **757 passed** |
| service | 100 passed (100) | **1287 passed** |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 11 passed (11) | **213 passed**, 2 skipped, 0 failed |

Then modes ok, templates 6 entries ok, ExtendScript 15 files ok, CLAUDE.md
10,297 of 20,000, `validate-templates` 6 ok, panel manifest ok, references PASS,
`check: PASS`.

**Two panel runs failed before that and neither was a product fault**: one was a
stale bundle — the build-stamp check comparing a rebuilt service against an
unrebuilt panel — and one was the browser test asserting K2's four hexes, which
is the behaviour this session retired and which was rewritten. Reporting both
because session 43 found the picker tests passing while their fixtures do not
exist; **one pass is not a fix**, and those tests still pass for that reason,
untouched here.

**`sora` rebuilt and unchanged**: 112 layers, 11 pictures at 1037/941/893/881/
917/1061/1061/1073/1061/1049/1049 px, in-points 0.959 to 37.340, watermark
present, and its cards still in K2's own `#F8F6F2`, `#C9A96E` and `#820000` —
which is the point, because K2 is its client.

**`sora.mov`, its candidates and every cache entry are untouched** — cache **72
entries / 129 files** at both ends, `sora.mov` `344265a032513979…` at both ends,
ledger **145 lines / `d4fe2de3…`, $0.00 spent**.

## Deviations

**One change beyond the three asked for**, and it is the reason the first is
worth anything: `textStyleFor` now returns a client's colours whether or not
their faces have been measured. Without it the palette reached the plan and the
image prompt but not a single card, so "a client's colours reach the built comp"
would have been false for every client made through the panel. It is reported
above rather than folded in silently.

**Four tests were rewritten rather than left asserting retired behaviour**:
three in `text-style.test.ts` that asserted no style at all for a fontless
client, one shadow case, and the browser test asserting K2's pre-filled hexes.

**Scratch artefacts**: two scratch clients, one throwaway video, one plan, one
comp and two scratch source files were written and removed. `modes/` holds only
`k2-syndicalia.json` and the tree is clean.

**Zero `AeDriveError`** across four builds and three censuses.

## Failures & open problems

1. **A client saved without setting colours still inherits K2's four.**
   `createClient` copies the template client's palette. Not changed, because any
   replacement would be a value chosen rather than derived, and the only
   measurable source gives two of four roles with K2's Rouge among them. **The
   honest options are a neutral palette the user rules on, or refusing to save a
   permanent client without colours.**
2. **The templates themselves carry K2's Rouge** as the authored shadow, so a
   reel with no client snapshot at all is still drawn in it.
3. **`fonts` is sent only when both faces are filled** — one alone is silently
   dropped.
4. **A client's fonts, name, folder and logo still cannot be edited after
   creation.** Only the palette and the photographs can.
5. **`every-field-is-read.test.ts` has the three holes named above**, the third
   being that it cannot see a value swallowed between the request and the comp.
6. Session 43's findings 2, 5, 6, 7, 8, 9, 10 and session 44's video-shape and
   language conclusions are untouched, as instructed.

## Repo state

Branch `main`, tree clean. **Ledger 145 lines / `d4fe2de37f5eb0c8…` at both
ends, $0.00 spent**, so **$2.71** of credit remains. `templates/library.aep`
`4b0cf05a8f5d4775…` at both ends, never opened for writing.
`benchmarks/references/golden/census.json` `74436a960706fecd…` at both ends,
**not re-recorded**. `modes/k2-syndicalia.json` unchanged, its four ruled colours
exactly as they were.

The hand-made references, byte-identical at both ends:

| file | sha256 |
|---|---|
| `benchmarks/references/align/vitasilk.json` | `f32e12dcfad55899…` |
| `benchmarks/references/align/vitasilk.rereview.json` | `10a2e5c2971ed27f…` |
| `.local/ground-truth/ground-truth.txt` / `.json` | `1fbbe2190d734db8…` / `64eebfd7374f93d2…` |
| `.local/ground-truth/test-1.txt` / `.json` | `b59a6270c3f704bc…` / `1394f8e863b72aa9…` |
| `.local/ground-truth/test-2.txt` / `.json` | `9ceea1c47ee94a8a…` / `183ba7b05392afaf…` |
| `.local/ground-truth/test-3.txt` / `.json` | `b5413c215ff32fec…` / `5ad64557cd2cd0fa…` |

`.local/plans/sora-995f2d27.editplan.json` moved by the rebuild recording itself
and is otherwise unchanged. The five corpus plans were rewritten by golden's own
builds, as they are every run. Cache **72 entries / 129 files** at both ends.
`sora.mov` `344265a032513979…`. One After Effects instance throughout; no project
of the user's own was saved. Free space 157 GB.

## Suggested next step

Rule on what a client with no colours should be built in. It is the last piece of
this defect: the mechanism now carries whatever a client has, but a client who
gives nothing still silently becomes K2. The two honest answers are a neutral
palette he picks once — which then belongs to the tool rather than to a client —
or refusing to save a permanent client until its four colours are set.

---

**The one file, and the one moment**

`.local/build/sora-995f2d27-full.aep`, unchanged, to confirm K2's own reel still
looks exactly as it did. The moment is on the New Client screen: four swatches
that no longer open as somebody else's brand, and say `not set` until they are
this client's.
