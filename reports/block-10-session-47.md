# Block 10 session 47 — a colour can now be typed

**Status: OK.** Each of the four colour fields now takes a typed or pasted code,
in both places they appear. $0.00 spent; the ledger did not move.

## Can a hex be typed and pasted?

**Yes, and the swatch follows it.** Driven in the real built panel in a browser:
typing `#E8873A` into the emphasis field moves that swatch to `#E8873A`, and
pasting `  #e8873a  ` — with the spaces, lower case, straight out of a clipboard
— does the same. All four codes typed and posted come out as exactly

```
{"light":"#FFF4E8","accent":"#E8873A","primary":"#123448","background":"#1C1210"}
```

and reading the client back off disk after `createClient` gives those four
byte for byte.

## What was actually wrong

**There was nothing on the screen to type into.** Each row rendered as:

```html
<label class="colour">
  <input type="color" aria-label="the words you emphasise" value="#B0B0B0">
  <span class="what">the words you emphasise</span>
  <code>not set</code>
</label>
```

Measured in the rendered DOM, not read from the source: the only input is the
native `type="color"`, and the hex beside it is a **`<code>` element with
`contentEditable` false that cannot even take focus** — the probe reported
`code focusable=false`.

**Why a keypress closed the picker.** Nothing in the panel does that. A native
`<input type="color">` opens the operating system's own colour window, which is
not part of the page; keystrokes go to that window and macOS dismisses it. There
is no key handler, no blur handler and no focus handler in the panel to fix,
because the panel does not own that window. **The only repair is a field of our
own**, which is what this session added.

**He would have hit it twice.** The same two elements are the client card's
palette editor, added at session 45 — so a colour could not be typed when
creating a client, and could not be typed when correcting one either.

## Done

### A — what the field was

| | |
|---|---|
| the swatch | `<input type="color">`, the OS picker — `NewClient.tsx:279`, `ClientCard.tsx:228` |
| the hex | `<code>`, not an input — `NewClient.tsx:294`, and the card's own row |
| editable in the DOM? | **no** — `contentEditable=false`, `focusable=false`, measured |
| what closes the picker | the OS window, not the page |

**Every other field on that screen was checked, and every one takes typing.**
Name, note, video folder, logo path, both font boxes, the font search, the
subtitle-height slider and its number box, the language and shape menus, the
watermark switch, the photograph description — all are real inputs with a wired
`onChange`. **The colour row was the only control of its kind in the panel**;
the one other `<code>` (`Build.tsx:132`) shows a missing-requirement command and
is display, correctly.

### B — a colour can be typed, pasted and read back

`normaliseHexColour` in `core/src/palette-meaning.ts` is the one declaration,
so the New Client screen and the client card cannot disagree about what a colour
is.

**Accepted** — `#E8873A`, `E8873A`, `#e8873a`, `e8873a`, the three-digit short
form `#E83` → `#EE8833`, and whitespace around any of it. **Refused** — anything
else: `#12345`, `#E8873A7`, `zzzzzz`, `#GGGGGG`, `rgb(232, 135, 58)`, `orange`,
`0xE8873A`, a hash on its own, an empty box. It returns the uppercase `#RRGGBB`
that `mode.ts` validates a stored palette against, and it is idempotent, so a
value read back and re-entered does not drift.

**Refused visibly, never repaired.** A bad code leaves the swatch on the last
good colour, outlines the box, and says *"not a colour code"* beside it. Turning
`#12345` into black would be a wrong colour nobody notices; a refusal is one
they cannot miss.

**What is typed is held as typed until it parses**, which matters more than it
looks: the first three characters of `#E8873A` are themselves a valid short
form, so a field that rewrote every keystroke would jump to `#EE8833` mid-word
and make the real code impossible to enter.

**The picker still works** — dragging the swatch sets the code box, and typing
in the box moves the swatch. Two views of one value.

**Session 45's rule survives.** An untouched colour is still never sent: the
palette leaves the screen only when all four are set, and emptying a box puts
that role back to unset. Both are asserted — a client saved with nothing typed
posts no `palette` key at all, and one with only two of the four posts none
either, because a palette is all four or nothing.

### C — proved where he will use it

Session 43 named the gap it could not close: it exercised the service behind
every control and never clicked the rendered panel. **These tests click it.**

In the real built bundle, in a browser: open the New Client screen, `fill` each
of the four code boxes, read the four `type="color"` values back — they are
`#FFF4E8`, `#E8873A`, `#123448`, `#1C1210` in display order. A separate test
dispatches a genuine `ClipboardEvent` carrying `  #e8873a  ` and reads the
swatch back at `#E8873A`. A third walks the accepted forms and then feeds
`#12345`, asserting the swatch is unchanged and the refusal is on screen. A
fourth captures the POST body and asserts the four codes arrive.

**Proof the tests fire.** The field was reverted to the old `<code>` label and
the suite re-run: **six went red.** After the tests were moved to their own file
the mutation was repeated with the input hidden instead: **four went red**, and
the two that did not are explainable — the paste test drives the element
directly through `querySelector`, so it proves the parser wiring rather than the
visibility, and the "left alone" test posts no palette either way. Both
mutations were reverted and the file confirmed clean.

**What could still differ inside After Effects.** The panel runs in CEP's own
Chromium, which is older than the test browser. Nothing here depends on a recent
feature — it is a plain `<input type="text">` and a string function — so it
should behave identically, and the swatch is the same native control as before.
**What cannot be reproduced here is the OS colour window itself**, so if
pressing a key while that window is open still closes it, that is unchanged and
expected: **the code box is the way in, and it does not open that window.**

### D — the binding condition

Nothing is fitted to a client: the parser takes any colour and the field is the
same for all four roles.

**Every typed input in the panel was enumerated** and each has a wired
`onChange` — the twelve listed under A, plus the transcript's word editor, which
also handles Enter and Escape. The colour row was the only one that could not be
typed into.

**`new-video.test.ts` still asserts a client's colours reach the comp** —
session 45's second client, `#F2FBFF` / `#5FD0F0` / `#12507A`, zero K2 layers.
It passes: the service suite is 1287 tests green, 100 files.

### E — the gates

**`npm run check`: PASS, exit 0.** Per workspace:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **758 passed** |
| service | 100 passed (100) | **1287 passed** |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 12 passed (12) | **220 passed**, 2 skipped, 0 failed |

Then modes ok, templates 6 ok, ExtendScript 15 files ok, CLAUDE.md 10,782 of
20,000, `validate-templates` 6 ok, panel manifest ok, references PASS, both
sidecar models ok.

**`npm run golden`: PASS, 4 of 4, 17,174 fields, zero differing fields.** This
session touched the panel only and nothing moved.

## Deviations

**The first `check` was red, and it was my doing.** Adding six browser tests to
`render.browser.test.ts` made the image-picker tests start failing — one to
three of them, a different subset each run, always `waitForSelector` timing out.

**Measured rather than assumed.** The picker tests wait for an `img` that exists
only while its file loads, and their three fixture files have been missing since
the cut-outs moved into per-reel folders — session 35 found the cause, session
43 confirmed the files are still absent and listed it as finding 6. They pass by
winning a race. With my six skipped that file passed twice; with them active it
failed three runs running; on a stashed clean tree the suite passed 213/213.
**More work in the same file, against the same browser, makes them lose.**

Fixing those tests is outside this session, so **the six moved to
`client-colours.browser.test.ts`, which gets its own browser**, and the shared
setup moved to `browser-harness.ts` rather than being duplicated. The panel
suite then passed **three runs running, 220 tests each**. The picker tests are
untouched and still rest on a race — that is session 43's finding 6, not this
session's, and it is worth saying that it is now a little more visible than it
was.

**A test asserting retired behaviour was rewritten**: the one checking that the
word `not set` appears in the colour block. It now lives in the code box's
placeholder rather than in a `<code>` label, and the test asserts the four boxes
exist, are empty, and carry that placeholder — which is a stronger claim than
the old one.

**Two scratch files** were written and removed — a DOM probe inside the browser
test file, and a service script that created a client with the four codes and
read it back. `modes/` holds only `k2-syndicalia.json`.

## Failures & open problems

1. **The image-picker tests still pass by winning a race**, and their three
   fixtures are still missing — session 43's finding 6, untouched here and now
   demonstrably sensitive to how much else runs in its file.
2. **The OS colour window still closes on a keypress.** Nothing can change that
   from inside the panel; the code box is the answer, not a repair to the picker.
3. **A client saved with no colours still inherits K2's four** — session 45 left
   that open deliberately and §6 forbids touching it.
4. **The code box was not exercised inside After Effects' own Chromium**, only
   in the test browser. Nothing it uses is recent, but it has not been seen there.

## Repo state

Branch `main`, tree clean at the close.

| | at start | at end |
|---|---|---|
| `.local/costs.jsonl` | **145 lines**, `d4fe2de37f5eb0c8553423b744bc5010be80738a611cd6cb065a008104b14ab1` | **identical** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e8ebd86f713f0e7eb985d80e46f3874cb28eca6c22aba` | identical |
| `benchmarks/references/golden/census.json` | `74436a960706fecd…` | identical, **not re-recorded** |

The six hand-made references, byte-identical at both ends:
`align/vitasilk.json` `f32e12dcfad55899…`, `align/vitasilk.rereview.json`
`10a2e5c2971ed27f…`, and the four ground-truth pairs `1fbbe2190d734db8…` /
`64eebfd7374f93d2…`, `b59a6270c3f704bc…` / `1394f8e863b72aa9…`,
`9ceea1c47ee94a8a…` / `183ba7b05392afaf…`, `b5413c215ff32fec…` /
`5ad64557cd2cd0fa…`.

`modes/k2-syndicalia.json` unchanged, its four ruled colours exactly as they
were. Every plan, every cache entry (**72 entries / 129 files**), `sora.mov` and
its eleven candidates untouched — this session ran no pipeline stage and opened
no plan for writing. One After Effects instance throughout; no project of the
user's own was saved. Free space 157 GB. **About $1.19 of Google credit remains
and nothing billed.**

## Suggested next step

Enter the four colours and look at the client card afterwards — that is the
screen where a wrong one would show, and it is now editable too. The picker
tests' missing fixtures are the next thing worth an hour: they are the only part
of the suite that passes for a reason unrelated to what it claims to test.

---

## Entering the four colours

1. Open the panel, choose **New client** from the client menu, and type her name.
2. In **Their colours**, click the code box beside each caption and type or
   paste the code. The box is the one that says `not set`; the round swatch
   beside it is the picker and will follow.

   | the caption | the code |
   |---|---|
   | your ordinary subtitle words, and usually the frame round a picture | `#FFF4E8` |
   | the words you emphasise | `#E8873A` |
   | the shadow behind every word, and depth in the generated pictures | `#123448` |
   | behind a cut-out picture, and the ground the generated pictures are lit against | `#1C1210` |

   With or without the `#`, upper or lower case — all four forms are accepted.
   A code it will not take says **not a colour code** beside the box.
3. Save. All four must be set for them to be sent; the line under the swatches
   says which state it is in.

To change them later, open the client card and press **Change their colours** —
the same boxes, and videos already made keep the look they were made with.
