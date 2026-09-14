Status: OK

# Block 13, session 104 — make it look designed

Mohamed: **it is not beautiful to see. Underlined text at many sizes, reading like
a paragraph in Word.**

Measured in the browser that draws it, the three screens rendered **23 distinct
type settings across eleven sizes** — 8.96, 9.39, 10.4, 10.54, 10.84, 11.05, 11.56,
13.26, 14.45, 15.17 and 17 px. Three of them sat within half a pixel of each other
doing three different jobs, and one control drew at 17 px in one place and 11.56 px
in another. **Every size in the stylesheet was written in `em`, so it compounded
through nesting and no one could tell from the source what anything was set in.**

Now: **four sizes, six steps, 16 settings, nothing underlined at rest.** Every
screen got shorter — Choose 619 → **589**, Make 867 → **849**, Build 780 → **750** —
and the worst state on Make fell from 1523 px to 1184 px.

**No word changed: 1,321 readable strings are identical.** `words.ts`, `spend.ts`,
`core/` and `service/` are byte-identical.

## 1. What the type was

Measured on all three screens with his real data, in both the daily state and with
every disclosure open and videos in the list — because what is behind a press is
still type he reads.

| count | size / weight / colour / leading | what |
|---:|---|---|
| 28 | 10.4px / 400 / faint / 16px | `p.hint`, `em.hint` |
| 23 | 8.96px / 600 / faint / 13px / UPPER | `span.colourhead` |
| 22 | **17px** / 400 / text / 26px | `button.ghost`, `p.faint`, `p.detail` |
| 22 | 10.84px / 400 / muted / 16px | `span.what` |
| 22 | 10.4px / 400 / muted / 16px | `button.chip` |
| 16 | 14.45px / 400 / muted / 22px | `summary` |
| 14 | 10.54px / 600 / faint / 16px / UPPER | `h2` |
| 12 | 13.26px / 600 / muted / 20px | `button.moment` |
| 10 | 17px / 600 / text / 26px | `span.word` |
| 6 | 14.45px / 600 / text / 22px | `div.name` |
| 6 | 14.45px / 600 / **accent** / 22px | `em` |
| 6 | 11.05px / 400 / faint / 17px | `div.version` |
| 6 | 14.45px / 400 / muted / 22px / **underline** | `button.link` |
| 6 | 13.26px / 600 / text / 20px | `button.moment` |
| 4 | 17px / 400 / muted / 26px | `p.say` |
| 4 | 9.39px / 400 / faint / 13px | `span.what` |
| 2 | 17px / 400 / text / 26px / **underline** | `button.linky` |
| 2 | 17px / 600 / white / 26px | `button.run` |
| 2 | 14.45px / 400 / text / 22px | `button.ghost` |
| 2 | 15.17px / 400 / text / 23px | `p` |
| 2 | 17px / 400 / faint / 26px | `span.k` |
| 2 | **11.56px** / 400 / text / 17px / **underline** | `button.linky` |
| 1 | 17px / 600 / faint / 26px | `button.run` |

**Eleven sizes**, and the crowding is where the eye fails: 10.4 / 10.54 / 10.84
within half a pixel across three different jobs; 11.05 / 11.56; 14.45 / 15.17.
`button.linky` — one control — at **17 px and 11.56 px**. In the stylesheet:
**17 distinct `em` values and 7 line-heights**, and twenty-two elements that
declared no size at all and simply inherited the document's 17 px.

## 2. The type scale after

**Six steps on four sizes.** The panel is 420 px wide and dense; more than four
sizes at this width is what produced eleven. Weight, colour, case and tracking
carry the rest, which is what the three greys were already there for.

| step | size | weight | colour | what uses it |
|---|---|---|---|---|
| `--t-label` | 11px | 600 | `--faint`, UPPER, 0.1em tracked | every `section > h2`, field labels, column heads |
| `--t-micro` | 11px | 400 | `--faint` | the version, timestamps, monospace values, swatch names |
| `--t-second` | 13px | 400 | `--muted` | hints, notes, offers, everything behind a press |
| `--t-body` | 15px | 400 | `--text` | sentences meant to be read |
| `--t-action` | 15px | 600 | `--text` | every control's own text |
| `--t-title` | 17px | 600 | `--text` | the one strongest line on a card |

Label and micro share a size deliberately: a tracked uppercase label and a micro
value at 11 px are a standard pair, told apart by case, tracking and weight rather
than by a sixth size.

**All 58 non-cost-screen rules map onto a step**, and the 23 cost-screen rules were
not touched — the full cost screen sits outside `<main>`, so the document stays at
17 px and its `em` sizes compute exactly as they did.

**The result: 23 settings → 16, eleven sizes → four.**

**Two elements sit on a step's size but not its weight, and both are right:**

- `.clientcard .typesample p` at **17px / 400** — a specimen of the client's own
  typeface. Forcing it to 600 would show him a weight the build will not use.
- `button.linky` inside a `.facts` row at **11px / 600** — it inherits the row it
  sits in, which is what an inline phrase should do. It is one *treatment* in every
  place, not one size; the size is its sentence's.

**Two things were mismatched and are fixed:** `.facts .k` drew at the body step
beside a `.facts .v` at the micro step — four pixels apart on the same line — and
the label step had two different leadings depending on where it appeared.

## 3. A pressable phrase, and a disclosure row

**There were five underlines.** `.linky` in two places, `button.link` in one, at
three different sizes. An underline through the middle of a sentence is the single
thing that made the panel read like a page of Word.

**A pressable phrase** now carries its affordance in **weight and contrast**: 600 in
the full `--text` colour, inside prose that is `--muted` and 400 — at exactly its
sentence's size, so it never becomes a control that shouts. The underline returns on
**hover and on keyboard focus**, where it confirms rather than decorates. Applied to
`.linky` and to `button.link` alike, so they are one thing.

**A disclosure row** is now a control and looks like one, identically in all the
places it appears — the client card on Choose, *What these two make* and *What it
cost, step by step* on Make, *What else it will use* and *The watermark on this
video* on Build:

- a **rule above it**, so it reads as the lid of something rather than as more prose
- the secondary step at **600** with a little tracking, in `--muted`, going to
  `--text` on hover
- a **caret drawn in CSS**, not the browser's triangle, so it is the same mark
  everywhere; it turns when the row opens, with **no transition** — nothing in this
  panel animates
- a focus ring in `--focus`, which is deliberately not the accent

A test reads all of them on all three screens and asserts they draw **one** way:
same size, weight, colour, cursor and rule, the native marker suppressed, and a
caret present on every one.

## 4. The spacing rhythm

Three values, and they are a rhythm rather than three numbers that differ:

| value | px | where |
|---|---|---|
| `--s-tight` | **8** | inside a group: the two run buttons; a section label to the group it labels; a disclosure row to what is above it |
| `--s-group` | **16** | between groups inside a section; a card's padding; the editors' gap |
| `--s-section` | **28** | between sections, in `main` |

**A section label sits tight to what it labels.** It was 10 px under every heading
and 22 px between sections — nearly the same, so a heading floated between two
groups and belonged to neither. At 8 / 16 / 28 the grouping session 98 built with
headings now reads before the words are read.

A test measures all three off the live page and asserts `28 > 16 > 8`.

## 5. The mark

The header drew the full Framopia logo when `assets/brand/Framopia_LOGO.png` was on
disk and a 14 px red square when it was not — **two different identities depending
on the machine**. What stands beside the words now, on every machine, is the one red
element out of that logo: **a short rounded bar, 7 × 22 px, radius 3.5 px**.

**The colour is `var(--accent)`** — `#ed1c24`, the accent `panel.css` has always
had. No new colour is introduced.

**How it stays unmistakable for a control**, given that the accent means *this
spends money* everywhere else:

- it is a `div`, not a button or a link, and `aria-hidden="true"`
- `pointer-events: none` — it cannot be pressed or even hovered
- no cursor, no hover state, no focus ring
- it sits in `header.brand`, outside `main`, where the only other thing is the
  version number; every control in this panel lives in `main`
- every other red thing is a **full-width padded button** with white text

The test that used to decode the PNG's real pixel dimensions now asserts all of
that: the colour, both dimensions, the tag, the `aria-hidden`, that no ancestor is a
button or link, that the cursor is `auto` and that pointer events are off.

## 6. Every screen's height after

| screen | before (s103) | **daily now** | worst state now |
|---|---|---|---|
| 1. Choose | 619 px | **589 px** | 589 px |
| 2. Make | 867 px | **849 px** | **1184 px** — a run in progress *(was 1523)* |
| 3. Build | 759/780 px | **750 px** | **1067 px** — already built once *(was 1083)* |

Every state got shorter, including the three that did not fit:

| state | before | after |
|---|---|---|
| Make, four videos in the list | 1023 px | **974 px** |
| Make, a run in progress | 1523 px | **1184 px** |
| Make, a stage failed | 1396 px | **1169 px** |
| Build, already built once | 1083 px | **1067 px** |
| Build, a client with no typefaces | 964 px | **918 px** |

**Spacing cost nothing, because the type paid for it.** The section gap went 22 → 28
and the card padding 14/15 → 16, and the screens still shrank: twenty-two elements
came down from 17 px to 15 px, the hints from 14.45 to 13, and the label sits 8 px
from its group instead of 10.

**Session 103's pointer distances held, and both shrank:**

| distance | session 103 | now |
|---|---|---|
| client picker → video picker, Choose | 101 px | **88 px** |
| run button → the list's first control | 190 px | **190 px** |

Both bounds were **tightened** to session 103's measured figures — from `< 200` and
`<= 220` to `<= 101` and `<= 190` — so growth now fails rather than passing under a
round number.

## 7. What is byte-identical

```
git status --porcelain -- core service panel/src/words.ts panel/src/spend.ts   → empty
```

**`core/`, `service/`, `words.ts` and `spend.ts`: unchanged, not one byte.** The
full cost screen was not opened, and none of its 23 `em` rules was touched.

**No word changed anywhere.** Every readable string — quoted text and JSX text node
— was extracted from every non-test source before and after: **1,321 strings, diff
empty.**

**Five files changed and one added:**

| file | removed lines | what |
|---|---|---|
| `panel/src/panel.css` | 82 | the scale, the rhythm, the two controls, the mark |
| `panel/src/render.browser.test.ts` | 18 | the logo test, rewritten |
| `panel/src/App.tsx` | 13 | **the `Brand` component only** — every line is the mark |
| `panel/src/near-the-last-one.browser.test.ts` | 6 | the underline assertion, rewritten; two bounds tightened |
| `panel/src/browser-harness.ts` | 1 | a dead key (below) |
| `panel/src/type-scale.browser.test.ts` | new | the ruler and the five rules |

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL.** Session 102's reading reproduced a third time, before and after the
work.

### The harness was verified before anything was measured

Sessions 102 and 103 each measured a screen against data he does not have. Before
trusting a figure this session, `realClients()` was compared key by key against what
the service's own `listModes()` returns: **identical, but for one extra key**,
`fontsStatus`, which the route does not send and nothing reads. Removed, so the
harness sends exactly what the panel is really handed.

## 8. What the eye meets, screen by screen

### 1. Choose — 589 px

**First**, the red bar and *Framopia **Studio*** — the only red on the screen.
**Second**, the three steps, with *1. Choose* in full white against two muted.
**Third**, the label `CLIENT` in tracked 11 px faint, and immediately under it — 8 px
— the client dropdown at 15 px. Then a ruled disclosure row: *Dr Loubna Kfafi's
colours, type, photographs and details*. Twenty-eight pixels of air, then `VIDEO`,
and the two decisions **88 px apart**.

### 2. Make — 849 px

**First**, *THIS VIDEO*, then the sentence *Everything for this video is made. **Go
to Build** to put the composition together* — the phrase in white 600 inside muted
prose, with no underline anywhere. **Second**, the two red buttons, 8 px apart, one
above the other, reading as one pair. **Third**, a ruled row: *What these two make*.
Then 28 px, and `MAKE SEVERAL VIDEOS`. Then 28 px, and `COST` with one button and one
ruled row.

The three sizes on this screen are 11 (labels), 13 (the rows), 15 (sentences and
buttons) — and one strong line at 17 only when the service has something to say.

### 3. Build — 750 px

**First**, `BUILD`. **Second**, the card: the video and client, what it will contain,
that it replaces what is there, that it is free — all at 15 px body. **Third**, two
ruled rows, *What else it will use* and *The watermark on this video*, then *Build
the composition* in red. Below, 28 px of air and `CHANGE SOMETHING FIRST` with its
three openers.

## 9. What I am least sure about

**A visual rule I could not pin: whether it is beautiful.** Everything below is a
number a test can fail on — a size, a weight, a colour, a gap, an underline. None of
them says the panel looks good, and Mohamed's complaint was that it does not. What
these tests protect is that it does not drift back.

**My own test nearly missed my own mutation.** M2 put an `em` back on the disclosure
rows; at `0.85em` of a 15 px parent that is 12.75 px, which **rounded to 13 and
passed** a test written minutes earlier to catch exactly that. The assertion is now
exact rather than rounded — but it is a reminder that a test written for a rule can
be written loosely enough to agree with its violation.

**`logoPath()` in `host.ts` is now computed and read by nothing.** Removing the logo
from the header made it dead, and pulling it out of `HostEnvironment` is host
detection with its own tests — logic, in a session forbidden from touching any. It is
named below rather than left silent.

**Label and micro share a size.** It is a defensible pairing and it is also the one
place a seventh step might genuinely be needed; I would rather find that out by
looking than argue it.

**The two weights do a lot of work.** 400 and 600 carry the hierarchy across four
sizes, and on a screen with many muted 13 px rows — the client card opened, the
photographs — the difference between a hint and a pressable row is weight alone.

**What I would change next:** let Make's *Cost* and the list fold while a run is in
progress, which is the last thing keeping that state at 1184 px; and look at the
client card with its twenty-two photographs, which is the densest 13 px in the panel
and was never designed, only collapsed.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1577 | 0 | 1577 |
| benchmarks | 173 | 0 | 173 |
| panel | **375** | 2 | 377 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, service, benchmarks and pytest identical to session 103; panel **369 → 375**.

**Arithmetic by name: 6 added, 1 renamed, 0 removed.** Verified by extracting every
`it(…)` name from `panel/src` at `93ce943` and now — 369 before, 375 after.

| added | where |
|---|---|
| `counts every size, weight, colour and leading on screen` | `type-scale.browser.test.ts` |
| `draws every word at one of the four steps` | same |
| `uses two weights and the panel’s own greys, and no other` | same |
| `underlines nothing until it is hovered or focused` | same |
| `draws every disclosure row identically, with a caret of its own` | same |
| `spaces a section, a group and a pair at three measured distances` | same |

| renamed | to |
|---|---|
| `loads the real logo, not merely an <img> element` | `draws the mark, and nothing about it can be pressed` |

**Two tests asserted retired behaviour and were rewritten, never deleted:**

- the logo test decoded `Framopia_LOGO.png` and asserted its real 962 × 1077 pixels.
  Mohamed's ruling removes the logo, so there is no file to decode. It asserts the
  harder half instead — the mark's colour and size, **and that it is not a
  control** — which matters more than the logo ever did.
- *gives the way there no colour of its own* asserted `.linky` is underlined. It now
  asserts the rule that carries the affordance, and is stronger: the phrase must
  differ from its prose in **both** weight and contrast, and must **not** differ in
  size.

`npm run golden`: **PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0**, 375 passed and 2 skipped each, no
failure and no hook timeout.

**The panel was rebuilt.** `panel/dist/panel.js` **267,553 bytes**. The extensions
folder holds one entry, `com.framopia.studio`, a symlink to
`…/framopia-studio/panel` — this working copy.

### Three mutations, each red, each restored from a saved copy

**M1 — the underline back on a pressable phrase.**

```
× the type scale holds > underlines nothing until it is hovered or focused
  → expected [ 'button.linky' ] to deeply equal []
× a sentence that names a place takes him there > gives the way there no colour of its own
  → expected 'underline' to be 'none'
```

**M2 — a size drifts off the scale, the way an `em` used to.** First run: **green**,
because 12.75 px rounded to 13. The assertion was made exact, and then:

```
× the type scale holds > draws every word at one of the four steps
  → expected [ 'summary. at 12.75px' ] to deeply equal []
```

**M3 — the mark takes a pointer cursor.**

```
× the built panel in a real browser > draws the mark, and nothing about it can be pressed
  → expected 'pointer' to be 'auto'
```

Restored from the saved copies, hashes verified equal: `panel.css 9fc6eb60…`,
`App.tsx e0ba6ed6…`. **No `git checkout`, `restore` or `stash` at any point.**

Every assertion added this session reads an **extracted value** — a computed style, a
bounding box, a row-gap — and uses `checkVisibility()`; none holds a live Playwright
handle, and none reads a whole screen's `textContent`.

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
| listening service | pid 3965 | pid 3965, never stopped |
| `origin/main..main` | 0 | 0 after push |

His seven photographs and his edit to `modes/dr-loubna-kfafi.json` are exactly as
found; no commit names his paths. Nothing was saved in his After Effects.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing this session made a billable call.

## What is open

- **`logoPath()` in `host.ts` is read by nothing** now that the header carries the
  mark. It is host detection with its own tests, so it was left standing.
- **Make is 1184 px while a run is in progress** — the last state past the fold, and
  the fix is folding *Cost* and the list during a run, which is state-dependent
  layout.
- **The client card with twenty-two photographs** is the densest type in the panel
  and has never been designed, only collapsed behind a press.
- **Nothing pins that the panel is beautiful**, only that it does not drift.
- The list is called *the list* and his own word is *queue* — session 103.
- Nothing says the list kept going while he was away — sessions 101–103.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
