Status: OK

# Block 13, session 106 — stop repeating, and use the whole panel

Two findings outrank the brief's own list.

**Session 105's width query asks the window, and a docked CEP panel's window is
the size of the screen.** `docs/ARCHITECTURE.md` records exactly this: *"a media
query lays out for the wrong thing. Any future responsive rule has to measure the
panel, not the viewport."* Docked at 420 px on a 1920 px screen that query is
**true**, so session 105 would have paired two 460 px fields inside a 420 px column
— on his machine, and on no test, because a test's viewport and its panel are the
same thing. The panel measures itself now.

**And the ruler was still at 420 px.** Session 105 taught the block ruler to render
at 1500 and left the screen ruler at 420, then printed figures from both in one
table — *Choose 545* and *Build 589* were 420 px readings beside a 1500 px one.
Sixth session running that a reported figure described something other than his
screen. Both rulers render at his width now, and every before/after below was
re-measured against the session-105 build.

The brief's work is done: **the photographs section is 2851 px → 670 px**, Make's
empty half is used, Build's four sentences are two pairs, and **every state of
every screen now fits inside 900 px** — the first time in this block.

Panel **388 passed**, gate green, golden 17,174.

## 1. Every repeated line

Measured in the browser, all three screens, every disclosure open, with his 22
photographs showing. Controls are excluded: a button's own label is not
boilerplate, because each one acts on its own item.

| said | times | verdict |
|---|---|---|
| **Use it when someone says…** | **22×** | a label belonging to the group |
| **Used whenever one of these is spoken.** | **22×** | a hint belonging to the group |
| *Forget this* | 22× | **twenty-two controls**, each forgetting a different photograph — kept |
| *Already done — nothing to pay* | 4× | a per-stage value; four stages happen to be in the same state |
| *Inter Semi-Bold*, *Almarai Bold* | 2× each | the card's specimen and Build's *Type set in…* — different facts |
| *K2 Syndicalia* | 2× | a client's name where a client is named |

**Two sentences, forty-four renderings, and that is the whole of it.** The brief
counted sixty-six lines including *Forget this*; removing that would remove a
control, so it stays and the difference is reported rather than quietly taken.

**Height saved: `.ownphotos` 2851 px → 670 px**, and one card 313 px → 188 px.

**Nothing he can learn was deleted.** The label is said once over the grid it
names. The hint restated a paragraph already at the head of the section — *"Give a
photo the words that mean it … it is used automatically whenever one of those words
is spoken … Leave that empty and the photo waits for you to pick it by hand."* — and
a test asserts that paragraph is still on screen. Every field keeps its own
`aria-label` — *Use ejal40 when someone says…*, twenty-two distinct ones — which is
more than the repeated visible label ever gave a screen reader.

**Nothing was reworded.** `words.ts` and `spend.ts` are byte-identical; the two
removed strings are the repeats themselves.

## 2. The photographs section, with all 22 showing

| | before | after |
|---|---|---|
| `.ownphotos` | **2851 px** | **670 px** |
| one card | 313 px | 188 px |
| the grid | 460 px wide, **3 across, 8 rows** | **1460 px wide, 11 across, 2 rows** |
| Choose with the card open | **3509 px** | **1459 px** |

Two things did that. The repeats went — two lines off every card. And the card
stopped being confined to the picker's column: session 105 capped the whole
`<details>` at the prose measure, so the largest block in the tool was drawn 622 px
wide with the rest of the panel empty beside it. **The cap belongs on the
disclosure row, which is a line of text, not on what is under it** — a grid of
photographs is not prose. Open, the card takes the whole panel.

The list is also a grid now rather than a flex wrap: `flex: 0 1 120px` let the last
row stretch two leftover cards to twice the size of the twenty above them. Every
card is the same width, asserted.

## 3. The right half

Rightmost pixel any ink reached, measured over text ranges and drawn elements —
not over wrappers, which span the width and say nothing:

| screen | before | after |
|---|---|---|
| Choose | 1194 of 1480 — 286 empty | 1194 of 1480 — 286 empty |
| **Make** | **738 of 1480 — 742 px empty** | **1459 of 1480 — 21 px empty** |
| Build | 1289 of 1480 — 191 empty | 1319 of 1480 — 161 empty |

**Make was the empty half**, exactly as described. What sits beside what now:

| screen | left | right | across both |
|---|---|---|---|
| **Choose** | the client picker | the video picker | the client card when it is open |
| **Make** | *This video* — the sentence and the two run buttons | *Make several videos* | *Cost* |
| **Build** | the composition and the button | *Change something first* | — |

**Nothing that belongs together was separated to fill space.** *This video* and
*Make several videos* are two independent groups — session 98 gave each its own
heading for that reason — and the accounting stays underneath both where session 98
put it. Session 105's own failure was putting the two pickers 284 px apart to fill
two equal halves; the first column is still exactly a field wide, so they stay
**28 px apart**, asserted exactly.

| distance | s103 | s105 | now |
|---|---|---|---|
| the two decisions, Choose, at 420 px | 101 px | 88 px | **88 px** |
| run button → the list, at 420 px | 190 px | 190 px | **190 px** |
| the two pickers at his width | — | 28 px | **28 px** |

## 4. Build's four sentences

They were a 2×2 grid, which paired the video's name with what it will contain and
the output path with the word *free* — four things sharing a space rather than a
layout. They are **two pairs now, by what they are**:

- **What this composition is** — *sora-1, for Dr Loubna Kfafi — the client recorded
  on the plan.* and *Will contain 26 subtitle cards, 1 emphasised keyword, 9
  pictures, 9 sounds.* These lead.
- **What pressing the button does** — *Writes … , replacing what is there.* and
  *Building is free. It calls nothing and bills nothing.* These sit next to the
  button.

**The warning is kept and the path is not printed.** It read *Writes /Volumes/T7
Shield/INSEA/Projects/framopia-studio/.local/build/sora-1-8bcbfc38-full.aep,
replacing what is there.* — ninety characters wrapping to two lines to deliver four
words of warning. It now reads **Writes sora-1-8bcbfc38-full.aep, replacing what is
there.** The sentence is unchanged, the file is named, and the folders are on the
element's `title` — which is where session 102 already keeps a video's full label,
and session 102 shortened names from 44 characters to 9 by the same reasoning.

The test that asserted the whole path was rewritten to assert both halves: the
short sentence is drawn, `/repo/.local/build/` is not, and the full path is on the
title. That is more than it asserted before.

## 5. The three smaller things

**`Ready` and `Details` at opposite ends.** `margin-left: auto` pushed the control
to the far end of the line, so the word and the way to its detail were as far apart
as the line was wide with nothing between them. Both the ghost button and
`button.link` lost it; they sit one gap after the word, at the left, where the eye
already is.

**The four colour swatches.** A flex row sized each column to what was left, so the
descriptions ran four, two, four and four lines. Four equal tracks give every
description the same measure, and the rows align to the top rather than stretching,
so the block reads as one whatever the text does.

**The typeface specimens.** *Inter Semi-Bold* large on the left and *Almarai Bold*
large and right-aligned read as two unrelated headings. They are one strip now — on
the panel's quiet ground, inside a border, two equal columns, each still set in the
face it names because that is the point of a specimen. The note that they are the
standard pair runs under both rather than beside one.

## 6. Every screen's height, at his width

Session 105's table mixed a 420 px ruler with a 1500 px one. These are the
session-105 build and this one, both measured at 1500 px by the same ruler:

| state | s105 (re-measured) | **now** |
|---|---|---|
| **Choose, daily** | 374 px | **374 px** |
| **Choose, card open** | 3509 px | **1459 px** |
| **Make, daily** | 782 px | **616 px** |
| Make, four videos in the list | 907 px | **616 px** |
| Make, a run in progress | **1062 px** | **896 px** |
| Make, a stage failed | **1057 px** | **891 px** |
| **Build, ready** | 589 px | **497 px** |
| Build, nothing chosen | 464 px | **347 px** |
| Build, already built once | 845 px | **784 px** |
| Build, a client with no typefaces | 690 px | **621 px** |

**Every state of every screen is now inside the 900 px window** — the first time in
this block. The two that were past the fold since session 103, a run in progress and
a failed stage, came in at 896 and 891 because *Cost* and the list now sit beside
the progress card rather than under it.

The one state still taller than the window is Choose with the client card open, at
1459 px — twenty-two photographs, down from 3509.

## 7. What is unchanged

```
git status --porcelain -- core service panel/src/words.ts panel/src/spend.ts   → empty
```

**`core/`, `service/`, `words.ts`, `spend.ts`: byte-identical.**

**Distinct readable strings: 1073 → 1074**, and every difference is accounted for:

| change | what it is |
|---|---|
| − *Used whenever one of these is spoken.* | part 1's repeat |
| − *No words yet, so this photo is chosen by hand.* | its other branch, same repeat |
| + `client${cardOpen ? ' open' : ''}` | a className, not text |
| + `on-${moment}…' wide'` | a className, not text |
| + `colourhead photoshead` | a className, not text |

**No user-visible sentence was added, and the two removed are the ones part 1
names.** Both explanations still exist once, at the head of the section, asserted
by a test.

**Session 104's type scale: 16 distinct settings, unchanged**, on the same four
sizes, two weights and three greys. The scale's own six tests pass untouched, and
the spacing rhythm still measures 28 / 16 / 8 off the live page.

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL**, reproduced before and after.

### The harness, verified first

- **It renders all 22 photographs**: `realClients()` gives 22, the card draws 22.
- **It renders at his width**: both rulers now create a 1500 px page. The one that
  did not is section 0 of this report.
- `realClients()` still matches `listModes()` key for key.
- **A test file was exporting a helper**, and importing it re-registered nine width
  tests in a second file — the suite ran them twice and its own count was inflated
  by nine. `hisPanelAt` and `WIDTHS` live in the harness now; a test file exports
  nothing.

## 8. What he will see

### 1. Choose — 374 px, or 1459 with the card open

The red bar and *Framopia **Studio***, three 220 px tabs, then `CLIENT` and `VIDEO`
**side by side**, 28 px apart. Under the left, one row: *Dr Loubna Kfafi's colours,
type, photographs and details*. Open it and the card takes the whole panel: four
swatches in four equal columns, the two typefaces in one bordered strip, and
**twenty-two photographs eleven across in two rows** — each card a thumbnail, its
name, one field, and *Forget this*, with *Use it when someone says…* said once above
them all.

### 2. Make — 616 px

Left: `THIS VIDEO`, the sentence with **Go to Build** in it, and the two red buttons
8 px apart. Right, level with them: `MAKE SEVERAL VIDEOS`. Across both, underneath:
`COST`. Ink reaches 1459 px of 1480 — the half that was empty is the list.

### 3. Build — 497 px

Left: the card — *what this composition is* above, *what pressing it does* below
with **Writes sora-1-8bcbfc38-full.aep, replacing what is there** — the two
disclosure rows, and *Build the composition*. Right, level with it: `CHANGE
SOMETHING FIRST` and its three openers.

## 9. What I am least sure about

**I destroyed the stylesheet mid-session and did not notice for a full test run.**
An `index()` on a comment fragment matched near the top of the file, and
`s[:start] + new` threw away a thousand lines; the suite came back with 25 failures
reading like browser defaults, which is what they were. It was restored from the
saved copy and redone by locating the at-rule and walking its braces. The lesson is
the ordinary one — the save/restore discipline caught it — but a `python` edit that
silently truncates a file is a sharper tool than it looks.

**The `ResizeObserver` is new runtime code in a session restricted to layout.** It
is presentational and it is the only correct implementation available — a container
query is on the capability denylist for Chromium 99 — but it is a hook, not a rule,
and it is the one thing here that could fail at runtime rather than merely look
wrong.

**`on-choose` / `on-run` / `on-build` put the screen's name in the stylesheet.** Two
related choices and two independent groups genuinely do not want the same grid, so
the alternative was `:has()`, which CEP cannot run. But a layout keyed to a screen's
name is a layout that has to be revisited every time a screen is added.

**I did not verify the docked-panel claim on his machine.** It is recorded in
`docs/ARCHITECTURE.md` from a prior session's measurement and the fix is required
either way, but I am asserting a defect in session 105 on the strength of a document
rather than a measurement I took.

**What I would change next:** the client card open is the only thing left past the
fold, and its four parts — colours, type, photographs, details — have never been
laid out against each other, only stacked. And *Forget this* on twenty-two cards is
twenty-two words that could be a mark.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1577 | 0 | 1577 |
| benchmarks | 173 | 0 | 173 |
| panel | **388** | 2 | 390 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, service, benchmarks and pytest identical to session 105; panel **384 → 388**.

**The first run of the gate failed**, exit 1, on four `no-unused-vars` errors left
by moving `hisPanelAt` into the harness. The imports were dropped, committed
separately, and the gate re-run alone from a clean commit. Reported because the
panel suite was green while the gate was not.

**Arithmetic: 4 added, 0 renamed, 0 removed.** By name, extracted from `panel/src`
at `fd88eba` and now: 380 → 384 names, 384 → 388 runs.

| added | where |
|---|---|
| `says each sentence once, with all twenty-two photographs showing` | `repetition.browser.test.ts` |
| `keeps the label over the grid, and every field named` | same |
| `lays the photographs across the panel rather than down it` | same |
| `ships no width media query in the built stylesheet` | same |

**The last of those is the one that matters most and the only one that is not a
browser test.** A browser test cannot catch a window query, because a test's
viewport and its panel are the same thing — which is precisely how session 105's
query passed everything while being wrong on his machine. It reads the built CSS.

**Two tests asserting retired behaviour were rewritten, never deleted:**

- *is one column when docked, one pair when wide* read `width < 820` off the
  **viewport**. It measures the panel now, and a ninth width, 860, was added — at a
  viewport of 820 the panel is 780 and one column is the right answer.
- *says what will be built, where it goes, and that it is free* asserted the whole
  output path. It asserts the short sentence, the absence of the folders, and the
  full path on the title.

`npm run golden`: **PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0**, 388 passed and 2 skipped each.

**The panel was rebuilt.** `panel/dist/panel.js` **268,096 bytes**. The extensions
folder holds one entry, `com.framopia.studio`, a symlink to
`…/framopia-studio/panel`.

### Three mutations, each red, each restored from a saved copy

**M1 — the label back on every card.**

```
× nothing that belongs to a group is said per member > says each sentence once, with all twenty-two photographs showing
  → expected [ …(5) ] to deeply equal [ …(4) ]
+   "23× Use it when someone says…",
```

**M2 — a width query on the window, the way session 105 wrote it.**

```
× no layout rule asks the window how wide the panel is > ships no width media query in the built stylesheet
  → expected [ '@media (min-width: 820px)' ] to deeply equal []
```

**M3 — the whole path back in the sentence.**

```
× the Build step > says what will be built, where it goes, and that it is free
  → expected 'vitasilk, for K2 Syndicalia — the cli…' to contain 'Writes vitasilk-full.aep, replacing w…'
```

Restored from the saved copies, hashes verified equal: `panel.css 4ecbc4b0…`,
`ClientPictures.tsx b5d95665…`, `Build.tsx c6e63e75…`. **No `git checkout`,
`restore` or `stash` was used to undo a mutation.** Every assertion added reads an
extracted value and uses `checkVisibility()`; the width, column and gap assertions
are exact integers, not ranges.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9…6c1a84d0` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…`, 2026-09-12T20:52:03 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 35M | 22 files, 35M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 89430) | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 34423 | pid 34423, never stopped |
| `origin/main..main` | 0 | 0 after push |

His seven photographs and his client-file edit are exactly as found; no commit
names his paths. Nothing was saved in his After Effects.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing this session made a billable call.

## What is open

- **Session 105's width query was wrong on his machine and right on every test.**
  Fixed here; the guard is a CSS scan, because no browser test can catch it.
- **Choose with the card open is 1459 px** — the only state past the fold.
- **The client card's four parts have never been laid out against each other.**
- **The docked-panel claim is documented, not re-measured** by me.
- **`Forget this` is twenty-two words that could be a mark.**
- The 2026-08-29 one-column ruling stays narrowed, not withdrawn — session 105.
- `logoPath()` in `host.ts` is read by nothing — session 104.
- The list is called *the list* and his own word is *queue* — session 103.
- Nothing says the list kept going while he was away — sessions 101–105.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
