Status: OK

# Block 13, session 105 — use the width

**Every ruler this project has written renders at 420 px.** Sixteen of the panel's
browser viewports say so, and the heights sessions 95 to 104 reported — 589, 849,
750 — are heights of a **420 px panel**. His window is roughly 1500 px. That is the
fourth session running in which a figure turned out to describe something other
than his screen, and it is the first thing this session measured.

At his width, `select, button { width: 100% }` drew **Build the composition
1460 px wide for 180 px of text**, a picker 1460 px for a 22 px value, and
*Details* 1460 px for 45 px — which is why it sat on a band of its own.

Now: controls, fields and prose are **capped**, the two pickers **pair above
820 px**, and every screen is shorter — Choose **545 px**, Make **782 px**, Build
**589 px**. Panel **384 passed**, gate green, golden 17,174.

**One thing needs his eye:** pairing the two pickers narrows a ruling he made on
2026-08-29. Section 2 says exactly what changed and why, and `docs/PROJECT_SPEC.md`
now records it.

## 1. The width, and what was done with it

`main` is **1460 px** of content inside a 1500 px window. Before:

| block | drawn | needs | wasted |
|---|---:|---:|---:|
| `button.build-now` — *Build the composition* | 1460 | 180 | **1280** |
| `button.run` — *Make the subtitles* | 1460 | 320 | **1140** |
| `button.run` — *Make the pictures* | 1460 | 273 | **1187** |
| `button.run` — *Add … to the list* | 1460 | 192 | **1268** |
| `select` — the client picker | 1460 | 22 | **1438** |
| `select` — the video picker | 1460 | 22 | **1438** |
| `button.link` — *Details* | 1460 | 45 | **1415** |
| `summary` — a disclosure row | 1460 | 138–363 | 1097–1322 |
| `p.detail` ×4 in Build's card | 1426 | 175 / 437 / 221 / 330 | 989–1251 |
| `button.moment` ×3 — the steps | 483 each | 60–73 | 410–423 |
| `button.opener` ×3 — the editors | 481 each | 70–93 | 388–411 |
| `p.say` — a sentence | 1460 | 1110 | 350 |

After, at the same width:

| block | drawn | needs | wasted |
|---|---:|---:|---:|
| `button.build-now` | **420** | 180 | 240 |
| `button.run` ×3 | **420** | 192–320 | 100–228 |
| `select` ×2 | **460** | 22 | 438 |
| `button.link` | **45** | 45 | **0** |
| `summary` | **622** | 128–363 | 259–494 |
| `p.detail` ×4 | **699** | 175–437 | 262–524 |
| `button.moment` ×3 | **220** | 60–73 | 147–160 |
| `button.opener` ×3 | **234** | 70–93 | 141–164 |
| `p.say` | **716** | 686 | 30 |

**Two figures in these tables are measurement artefacts, not waste**, and are
reported as they came rather than quietly dropped: `p.line` and `button.linky` are
laid out inline, so a bounding rectangle spans their whole line box — the readiness
line genuinely holds *Ready* at one end and *Details* at the other, and *Go to
Build* genuinely sits inside a sentence. Neither is a stretched control.

## 2. The rule

**One rule in two halves, and one breakpoint in the whole panel.**

**Half one — nothing stretches past what it is for.** Three caps, scoped to `main`
so the full cost screen outside it is untouched:

| token | value | on |
|---|---|---|
| `--w-control` | **420px** | `button.run`, `button.build-now`, `button.ghost`, `button.retry` |
| `--w-field` | **460px** | every `select` |
| `--w-prose` | **76ch** (≈716px) | `p.say`, `p.detail`, `p.faint`, `p.note`, `p.reason`, `p.hint`, the readiness line, a disclosure row |

`width: 100%` stays. **These are caps, not widths** — below them nothing behaves
differently at all, which is the whole of why the narrow case is unchanged: a
380 px panel reaches none of them. A test asserts exactly that, and it is the test
that mutation M3 exposed as too weak (section 10).

**Half two — above 820 px the things that belong together sit together.** That
breakpoint is written literally in the media query because a media query cannot
read a custom property, and it is the only one in the panel. Two pairings:

- **Client and Video.** `main` becomes `var(--w-field) minmax(0, 1fr)`; every
  section still spans both columns except those two.
- **Build's four sentences**, in two columns inside the card, with the disclosure
  rows spanning.

**Why it holds at other sizes:** everything except the pairings is a cap, so the
panel changes continuously with the window rather than jumping between two
layouts. Below 820 px the media query does not apply at all — the narrow panel is
not a second layout, it is the absence of this one.

**Two equal halves would have been worse than stacking.** The first attempt split
`main` into `1fr 1fr`; each picker sat at the left of its own 716 px half, **284 px
apart** — further than the 88 px they were when stacked, and the opposite of what
pairing is for. A field-wide first column puts them **28 px apart**, one section
gap, and a test asserts that exact number at both wide widths.

### The ruling this narrows

`docs/PROJECT_SPEC.md` has carried, since 2026-08-29: *"The two-column layout above
830 px is retired… a docked panel is a column. One column at every width from 380
to 1920."* This session's brief says: *"Client and Video are two stacked dropdowns,
each full width, with a heading and a disclosure between them — **two related
choices that could sit side by side**."*

I read the brief as the newer instruction about the specific case it names, and
**narrowed the ruling rather than keeping or dropping it**: those two sections pair,
every other section still spans, so the body of the panel is still a column read
downwards — the part of the ruling that was about reading rather than about width.
Nothing overflowing at any width is unchanged and is now asserted harder. The spec
records the narrowing with the brief's own words. **If he meant the ruling to stand
whole, this is the change to undo, and it is one line of CSS.**

## 3. What sits beside what

| screen | at his width | narrow |
|---|---|---|
| **1. Choose** | the client picker and the video picker side by side, **28 px apart**; the client card's disclosure under the first, Refresh and Browse under the second | stacked, 108 px apart, exactly as before |
| **2. Make** | nothing pairs — the two run buttons stay one above the other, 8 px apart, because *subtitles then pictures* is an order and a row would not say so | identical |
| **3. Build** | the four facts of the card in **two columns**; the disclosure rows and *Build the composition* across both | one column |

The three steps are **220 px tabs** instead of 483 px banners, and the three editor
openers **234 px** instead of 481.

## 4. Three widths

| | **his window, 1500** | **middle, 900** | **narrow, 380** |
|---|---|---|---|
| pickers | side by side, 28 px apart | side by side, 28 px apart | stacked, 108 px apart |
| run button → the list | 167 px | 167 px | 190 px |
| editor openers | 234 px each | 234 px each | 108 px each |
| Build's four facts | two columns | two columns | one column |
| controls | capped at 420 / 460 | capped at 420 / 460 | full width, no cap reached |

**What is pinned:** every screen at all three widths, with every disclosure
**opened** as well as closed, asserted to have nothing scrolling sideways, nothing
drawn outside the panel, and nothing collapsed to no width while still carrying
words. Plus the breakpoint itself — **819 and 820 px are both tested**, because a
breakpoint is where a layout is most likely to be wrong and a test that steps over
it never looks at it.

**What I could not pin:** that it is legible — a line can be within its parent, not
overflowing and still too cramped to read, and no assertion here would notice.

**One thing the probe reports that is not a fault:** a text `<input>` scrolls its
own value at every width, including 380 px before this session touched anything, so
inputs are excluded from the cut-off check and the exclusion is written down where
it is made.

## 5. Where the vertical space goes

At his width, before: the steps carried `margin-bottom: 14px` **and**
`padding-bottom: 10px` on top of `main`'s 28 px grid gap — **52 px under the steps
against 28 px above them**, for no reason anyone chose. That is the only place the
space was empty for nothing, and it is gone: the rule under the steps keeps the
inside-a-group step, and the grid does the separating once.

**Session 104's 8 / 16 / 28 rhythm is untouched** — the test that measures it off
the live page still reads `section 28px, group 16px, tight 8px`. Nothing that
separates two groups was tightened.

| screen | 104 (at 420px) | **105, his width** | worst state, his width |
|---|---|---|---|
| 1. Choose | 589 | **545** | 545 |
| 2. Make | 849 | **782** | **1062** — a run in progress |
| 3. Build | 750 | **589** | **845** — already built once |

Every state is shorter, and **two states that did not fit now do**: Build after a
build (1083 → **845**) and Build for a client with no typefaces (985 → **690**).
Make with four videos in the list is **907 px**, inside the window for the first
time. Only a run in progress and a failed stage remain past the fold, at 1062 and
1057.

Part of that is the width — less text wraps at 1460 px than at 420 — and part is
the 16 px recovered under the steps. The honest split: at 420 px the panel measures
**Choose 571 / Make 833 / Build 734** after this session, against 589 / 849 / 750
before, so 16–18 px is the spacing and the rest is the width.

## 6. Session 104's type scale, unchanged

Re-measured across all three screens, closed and opened: **16 distinct type
settings**, the same sixteen, on the same four sizes — 11, 13, 15 and 17 px — in
the same two weights and the same greys. At his width the daily screens draw seven
size/weight/colour combinations, all of them from that set.

Nothing in this session touched a font size, a weight, a colour or a line-height.
The scale's own tests — four steps, two weights, the panel's greys, nothing
underlined at rest, one disclosure appearance, the three spacing values — all pass
unchanged.

## 7. What is byte-identical

```
git status --porcelain -- core service panel/src/words.ts panel/src/spend.ts   → empty
```

**No `.tsx` file was touched at all.** Three files changed and one added:

| file | what |
|---|---|
| `panel/src/panel.css` | the caps, the one breakpoint, the two pairings, the double spacing |
| `panel/src/render.browser.test.ts` | the one-column test, rewritten |
| `panel/src/measure-height.browser.test.ts` | the ruler renders at 1500 px, not 420 |
| `panel/src/width.browser.test.ts` | new — the width ruler and six rules |
| `docs/PROJECT_SPEC.md` | records the narrowing of the 2026-08-29 ruling |

**No word changed.** Every readable string in every non-test source, before and
after: **1,321, diff empty.**

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL**, reproduced twice against session 102's reading.

**Session 103's pointer distances held**, measured where they were set, at 420 px:

| distance | s103 | s104 | now |
|---|---|---|---|
| the two decisions, Choose | 101 px | 88 px | **88 px** |
| run button → the list | 190 px | 190 px | **190 px** |

At his width both are better still: **28 px** and **167 px**.

### The harness was verified before any figure was trusted

Sessions 102 and 103 each measured against data he does not have; session 104 found
a dead key. This session checked the thing none of them did: **what width the
harness renders at**. Sixteen viewports say 420 px. The block ruler now renders at
1500, and the new width ruler at 1500, 900 and 380. `realClients()` was re-checked
against `listModes()` and still matches key for key.

## 8. What the eye meets first

### At his width

**Choose (545 px).** The red bar and *Framopia **Studio***, then the steps as three
220 px tabs. Then `CLIENT` and `VIDEO` **beside each other**, each a 460 px picker,
28 px apart — the two questions the screen exists to ask, in one glance. Under the
left, the client card's disclosure row; under the right, *Refresh* and *Browse…*.

**Make (782 px).** `THIS VIDEO`, then *Everything for this video is made. **Go to
Build**…* on a 716 px measure rather than a 1460 px one. Then two 420 px red buttons,
one above the other, 8 px apart — a pair, not two banners. Then the list, 167 px
below. Then `COST`, one button and one row.

**Build (589 px).** The card, and its four facts **in two columns** — what it will
contain and where it writes on the left, that it replaces what is there and that it
is free on the right. Then the two disclosure rows across both, *Build the
composition* at 420 px, and three 234 px openers.

### Narrow (380 px)

Exactly the panel that has always been there: one column, every control full width,
the pickers stacked, Build's four facts one under another. Nothing is cut off, at
any of the three screens, with every disclosure open or closed. The only difference
from before this session is the 16 px recovered under the steps.

## 9. What I am least sure about

**Narrowing a recorded ruling.** The spec said one column at every width and I made
an exception for two sections on the strength of one sentence in a brief. I think it
is what he asked for and I have written down exactly what changed — but it is the
one thing here that is a judgement about his intent rather than a measurement.

**`--w-prose: 76ch` is the one cap I cannot defend with a number from his screen.**
420 and 460 come from what the controls actually need; 76ch is a typographic
convention. It measures 716 px at the body step, and I would not be surprised if he
wants it narrower.

**Where rounding could hide a failure.** Every assertion added this session is an
exact integer — `dx: 28`, `field 460`, `control 420`, `columnCount 2` — because
session 104's own mutation passed once on a browser rounding 12.75 px to 13. The
places still exposed: the *prose* cap is asserted as a range (480–760) because `ch`
resolves against a font metric, so a 10 % drift would pass; and the overflow probe
uses a **1 px tolerance** on `scrollWidth > clientWidth`, so something clipped by a
single pixel would not be reported. Both are deliberate and both are named here.

**Make's two run buttons stayed stacked.** At 1500 px there is room to put them side
by side and I did not, because *subtitles then pictures* is an order and a row reads
as a choice between two things. That is a judgement, not a measurement.

**What I would change next:** let *Cost* and the list fold while a run is in
progress — the last state past the fold, at 1062 px; and look at the client card,
which is still the densest thing in the panel and has only ever been collapsed,
never designed.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1577 | 0 | 1577 |
| benchmarks | 173 | 0 | 173 |
| panel | **384** | 2 | 386 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, service, benchmarks and pytest identical to session 104; panel **375 → 384**.

**Arithmetic: 6 added, 1 renamed, 0 removed — 9 more runs.** By name, extracted from
`panel/src` at `f2a0bc0` and now: 375 → 380 names. Two of the six are `it.each`, so
the run count rises by 9 rather than 6.

| added | runs | where |
|---|---|---|
| `measures every control and block against the space it is given` | 1 | `width.browser.test.ts` |
| `draws every screen without cutting anything off — %s` | **3** | same |
| `reaches none of its own caps when the panel is narrow` | 1 | same |
| `caps a control, a field and a line of prose at his width` | 1 | same |
| `puts the pickers one gap apart — %s` | **2** | same |
| `leaves them stacked when the panel is narrow` | 1 | same |

| renamed | to |
|---|---|
| `is one column and never overflows, from docked to full screen` | `is one column when docked, one pair when wide, and never overflows` |

**That rename is a test asserting retired behaviour, rewritten and not deleted.** It
asserted strictly one column from 380 to 1920. It now asserts one column below the
breakpoint, exactly two above it, **that only the two pickers pair and every other
section still spans**, and that nothing overflows — at eight widths including 819
and 820.

`npm run golden`: **PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0**, 384 passed and 2 skipped each, no
failure and no hook timeout.

**The panel was rebuilt.** `panel/dist/panel.js` **267,553 bytes** — unchanged from
session 104, because no TypeScript changed. The extensions folder holds one entry,
`com.framopia.studio`, a symlink to `…/framopia-studio/panel`.

### Three mutations, each red, each restored from a saved copy

**M1 — the cap comes off the run button.**

```
× the panel survives every width > caps a control, a field and a line of prose at his width
  → expected 1460 to be 420
```

**M2 — the pair stops pairing.**

```
× pairing brings the two decisions closer, not further > puts the pickers one gap apart — his window
  → expected { dx: -460, sameRow: false } to deeply equal { dx: 28, sameRow: true }
× the layout > is one column when docked, one pair when wide, and never overflows
  → at 820px: expected 1 to be 2
```

**M3 — a cap a 380 px panel can reach**, which is a second layout in disguise. It
went red on two tests — and **not on the one written to catch exactly it**:

```
× the panel survives every width > caps a control, a field and a line of prose at his width
  → expected 300 to be 460
```

*reaches none of its own caps when the panel is narrow* looked only at buttons and
prose, never at a field. With the field added it reports itself:

```
× the panel survives every width > reaches none of its own caps when the panel is narrow
  → expected [ 300 ] to deeply equal [ 340 ]
```

That is the second session running in which a mutation found a hole in the test
written for it, and both times the test was made stronger before the mutation was
restored.

Restored from the saved copy, hash verified equal: `panel.css baf829f8…`. **No `git
checkout`, `restore` or `stash` at any point.** Every assertion added reads an
extracted value — a bounding rectangle, a computed style, a column count — and uses
`checkVisibility()`; none holds a live Playwright handle.

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
| listening service | pid 71807 | pid 71807, never stopped |
| `origin/main..main` | 0 | 0 after push |

His seven photographs and his edit to `modes/dr-loubna-kfafi.json` are exactly as
found; no commit names his paths. Nothing was saved in his After Effects.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing this session made a billable call.

## What is open

- **The 2026-08-29 one-column ruling is narrowed, not withdrawn** — two sections
  pair above 820 px. Section 2 and `docs/PROJECT_SPEC.md` say what and why.
- **`--w-prose: 76ch` is a convention, not a measurement.**
- **Make is 1062 px while a run is in progress** — the last state past the fold.
- **The client card has only ever been collapsed, never designed.**
- **Nothing pins that a line is legible**, only that it is inside its parent.
- `logoPath()` in `host.ts` is read by nothing — session 104.
- The list is called *the list* and his own word is *queue* — session 103.
- Nothing says the list kept going while he was away — sessions 101–104.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
