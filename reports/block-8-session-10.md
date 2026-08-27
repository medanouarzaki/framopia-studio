Status: OK

Block 8, session 10. **$0.00 spent, no API called, After Effects not driven.**
The two-column layout now works in CEP, and the headless check can no longer
certify something CEP cannot do.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `main` / `origin/main` at start | `9cf942b` / `9cf942b` |
| tree at start | clean |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start / end | **1 / 1**, left open and untouched |
| `aerender` processes at start / end | **0 / 0** |
| companion service | pid **57858** running at start and end, untouched |

## Done

### Goal 1 — what CEP's engine actually is

**CEP 12, in After Effects 2026, runs Chromium 99.0.4844.84.** Established from
the machine, twice and independently:

- the running `CEPHtmlEngine` process carries
  `--user-agent-product=Chrome/99.0.4844.84` on its command line;
- the bundled `Chromium Embedded Framework.framework` declares
  `CFBundleShortVersionString = 99.2.15.0`, with
  `SCMRevision = …refs/branch-heads/4844_74`.

That is roughly **three years behind** the Chromium a current Playwright ships.

The capability list, and how each was established:

| feature | in Chromium 99? | shipped in | how established |
|---|---|---|---|
| CSS container queries (`@container`, `container-type`, `container-name`) | **no** | Chrome 105 | **measured in the running panel** — `getComputedStyle(el).containerType` is `undefined`, and the layout demonstrably did not switch at 1572 px |
| `ResizeObserver` | **yes** | Chrome 64 | version table; well below 99, and the new layout works in the headless check |
| CSS `:has()` | **no** | Chrome 105 | version table; not used |
| CSS nesting | **no** | Chrome 112 | version table; the stylesheet contains no nesting — verified, **no at-rules at all** |
| `structuredClone` | yes | Chrome 98 | version table; **0 occurrences in the bundle** |
| `AbortController` / `AbortSignal` | **yes** | Chrome 66 | version table; used in `service.ts` for the health timeout |
| flex/grid `gap` | **yes** | Chrome 84 | version table; used throughout |
| `overflow-wrap: anywhere` | **yes** | Chrome 80 | version table; used for the paths and banners |
| CSS custom properties | **yes** | Chrome 49 | version table; the whole palette |

**Only the container query is measured directly**; the rest rest on Chromium's
version history, which is why the durable answer is the denylist below rather
than my reading of a feature table.

**Every other place the panel relied on something the headless check would
support and CEP might not:** swept, and there is nothing else. The panel's
entire DOM surface is `ResizeObserver`, `AbortController` and `AbortSignal`. Its
entire CSS property surface is: `align-content align-items background border
border-bottom border-color border-radius box-sizing color cursor display flex
flex-direction font font-family font-size font-style font-variant-numeric
font-weight gap grid-column grid-row grid-template-columns height
justify-content letter-spacing list-style margin min-width outline
overflow-wrap overflow-y padding text-transform width` plus
`-webkit-font-smoothing`. The newest is `gap` in flex at Chrome 84.

### Goal 2 — the class was empty because there was never a class

**Not a bug, and the diagnostic was looking for something that was never
designed to exist.** Session 9 styled the grid by **element selector** —
`main { display: grid }` — and switched it with a container query. `<main>`
carries no `className` in the markup, so an empty one is correct.

The user's own reading proves the base rule applied: `display: "grid"` and
`gridTemplateColumns: "1532px"` — a single column at full width. So the
stylesheet loaded, the grid was created, and **only the `@container` block was
ignored**.

**The width source:** there was none. Session 9 read no width at all; the switch
was entirely CSS, which is why nothing fired. There was no `ResizeObserver`, so
the question of whether it fires in CEP did not arise then — it does now, and it
is the mechanism the layout uses.

### Goal 3 — rebuilt on what CEP has

`panel/src/panel-width.ts`. A **`ResizeObserver`** (Chrome 64) on the `.app`
element toggles a `wide` class. Two properties that matter:

- **It fires on observe**, so the first measurement is taken *after* layout
  rather than during the first render. A width read once at mount is the other
  common way a breakpoint never fires.
- **It re-evaluates on resize**, so docking, floating or dragging the panel edge
  switches the layout live.

A `window.resize` fallback exists for an engine without the observer; CEP has
it, so the fallback is untested against a real host and is named here as such.

**The breakpoint is unchanged at 830 px** with session 9's derivation intact: a
column must never be narrower than the single column already is when docked at
the manifest's 420 px, where the value side of a fact row is 242 px; two columns
reach 241 px at 820 and 246 px at 830. Only the mechanism failed.

**Verified from 380 px to 1920 px, with both pickers populated and the Node
mismatch warning showing — zero overflow at every width:**

| width | columns | class |
|---:|---:|---|
| 380 | 1 | `app` |
| 420 (docked) | 1 | `app` |
| 700 | 1 | `app` |
| 829 | 1 | `app` |
| **830** | **2** | **`app wide`** |
| 900 | 2 | `app wide` |
| **1572** (the user's width) | **2** | **`app wide`** |
| 1920 | 2 | `app wide` |

The headless check now asserts the **class itself** at both widths — the thing
that never appeared — and drives a **live resize in both directions**, so a
breakpoint evaluated once at mount would fail there.

### Goal 4 — the browser check is capability-gated

**The choice: a declared denylist asserted against the built bundle.** Pinning
Playwright to Chromium 99 is not available — Playwright ships only recent
builds — and the alternative I tried first does not work either: **esbuild at
`--target=chrome99` passes `@container` and `container-type` through without a
warning**, verified by running it. The build could not be the gate.

So `core/src/cep-capabilities.ts` holds the engine version and a list of
features newer than it, and `panel/src/capabilities.test.ts` asserts them
against **`panel/dist`**, not `panel/src`, because the bundler sits between the
two. Comments are stripped first — this file's own explanation names
`@container`, and so does the stylesheet's, and a gate that flagged the note
describing the removal would be unusable.

A denylist rather than an allowlist, and the reason is stated in the module:
enumerating everything Chromium 99 *can* do would be a bigger claim than the
file can support, while each entry is a specific checkable fact.

**A test fails if the panel uses a container query**, named separately from the
general scan because it is the one that actually happened. Twelve tests in all,
including that the list contains nothing already in Chromium 99, that a feature
named only in a comment is ignored, and that `dist` matches `src` so a stale
bundle cannot pass the gate over something nobody ships.

The rule is in `docs/CLAUDE_CODE_GUIDELINES.md` §3: **a test environment more
capable than the host proves nothing about the host**, citing both incidents —
the `CSInterface` stub that supplied a global CEP does not provide, and the
container query a modern Chromium honoured and CEP ignored.

### Goal 5 — the sweep

| finding | file | reachable? | at runtime |
|---|---|---|---|
| `@container` block and `container-type` / `container-name` | `panel/src/panel.css` (session 9) | **yes, every render** | **silently ignored** — the layout stayed one column at any width. **Fixed** |
| `ResizeObserver` | `panel/src/panel-width.ts:11` | yes | supported (Chrome 64) |
| `AbortSignal` | `panel/src/service.ts:41` | yes | supported (Chrome 66) |
| `AbortController` | `panel/src/service.ts:198` | yes | supported (Chrome 66) |
| `queueMicrotask` (1 occurrence, inside React) | `panel/dist/panel.js` | yes | supported (Chrome 71) |

**Nothing else.** Scanned the built bundle for `structuredClone`,
`Object.groupBy`, `Array.fromAsync`, `toSorted`, `toReversed`, `.at(`,
`findLast`, `replaceAll`, `Object.hasOwn`, `requestIdleCallback`,
`IntersectionObserver`, `AbortSignal.timeout`, `navigator.clipboard`,
`Promise.any`, `WeakRef` and `flatMap` — **zero occurrences of any**. Scanned
the built CSS for `:has()`, `@layer`, `@scope`, `color-mix()`, `text-wrap`,
`accent-color` and `aspect-ratio` — **none present**, and the stylesheet has no
at-rules at all.

JavaScript **syntax** is not a risk: esbuild already targets `chrome99` and
down-levels it. **APIs are not transpiled**, which is why the scan is for APIs
rather than syntax.

### Goal 6 — CLAUDE.md and the gate

CLAUDE.md carries the Chromium version and how it was read, the denylist and
where it is enforced, why the build cannot be the gate, the `ResizeObserver`
mechanism and the 830 px breakpoint, and a session section.

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against session 9 |
|---|---:|---|
| `@framopia/core` | 327 (18 files) | 319 |
| `framopia-service` | 761 (55 files) | 761 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| `framopia-panel` | 66 + 2 skipped (3 files) | 59 + 1 |
| **TS total** | **1320** | **1305** |
| pytest (sidecar) | **141** | 141 unchanged |

## Deviations

- **No new dependency was added to constrain Playwright.** Pinning it to
  Chromium 99 is not possible — Playwright does not publish builds that old —
  so the gate is the denylist instead. Stated rather than worked around.
- **The denylist is a denylist.** An allowlist of everything Chromium 99
  supports would be a claim I cannot substantiate; each denylist entry is one
  checkable fact.
- **`window.resize` fallback in `observeWidth` is untested against a real
  host**, because CEP has `ResizeObserver` and the fallback never runs there.

## Failures & open problems

- **Nothing was lost or corrupted.** No plan, cache entry, ledger line or
  template was written. The user's service was not touched.
- **The fixed layout has not been seen inside After Effects.** It is asserted at
  eight widths in a real browser engine, including a live resize and the user's
  own 1572 px — but the engine doing the asserting is the one that got this
  wrong last time. The class toggle is JavaScript rather than CSS, which is the
  half the headless check models faithfully; that is the reason for confidence,
  not the passing test.
- **The capability list rests on Chromium version history** for everything
  except the container query, which was measured. If an entry is wrong in either
  direction the gate is wrong with it.
- **The denylist is not exhaustive** and cannot be. It covers what the panel
  might plausibly reach for; a feature nobody thought of would pass.
- **Only the panel is gated.** The ExtendScript layer is ES3 and separately
  constrained; the service runs on Node and is not affected.
- Carried forward: experiment 2 unadopted pending the user's pass over 17 rows,
  headless AE not met, `vitasilk` the only reel ever built, 28 cards with a
  clipped hold, the CJK `五` classified Latin.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`b43b9a3` `docs: record that a richer test host
  proves nothing`**, preceded by `test: assert the layout class, not just the
  column count`, `test: gate the bundle against CEP's Chromium 99`, and
  `fix: switch columns from a measured width, not a container query`, on session
  9's `9cf942b`. **This report's own commit (`docs: record block 8 session 10`)
  follows it** and is not reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — 1320 TS tests across four
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at start and
  end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** at start and end, **0** `aerender`. Left open,
  never driven. Companion service pid 57858 left running.

## Suggested next step

Reload the panel and check the layout at the width you already measured — 1572
px should now give two columns, and dragging the panel narrower should collapse
it live rather than needing a reload. That is the claim this session makes and
the only one that still needs your eyes. After that the panel is done for this
block and the work returns to the aligner: seventeen rows are waiting on the
re-review sheet, and experiment 2 stays unadopted until they are judged.

## What the user does next

**Rebuild the panel:**

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run panel:build
```

**After Effects does not need restarting** — nothing in the extension manifest
changed.

**But reopening the panel from the menu is not enough.** CEP serves a cached
page. The reliable way:

1. Leave the panel open.
2. In Chrome, go to `http://localhost:8099`.
3. Click the Framopia Studio entry, then press **Cmd-R** in that window.

If you would rather not use Chrome, quitting and reopening After Effects always
works.

**What was wrong.** The two-column layout was written with a CSS feature called
a container query — the correct tool for asking "how wide is this panel", and
one that After Effects cannot understand. The browser inside After Effects is
Chromium 99, from early 2022; container queries arrived in Chromium 105. When a
browser meets a CSS rule it does not recognise it **throws it away without
saying anything**, so the panel quietly ignored the whole two-column block and
drew one column at 1572 pixels. Nothing was broken and nothing complained; the
instruction was simply never read.

The empty class you found was not a fault either — there was never meant to be
a class. The old approach did it entirely in CSS.

**It now measures the panel's width in JavaScript** and puts a class on the page
when there is room, which is something Chromium 99 has done since 2018. It also
watches for changes, so dragging the panel wider or narrower switches the layout
immediately rather than only when it is reopened.

**And I have stopped the tests from lying about this.** The test browser is
about three years newer than the one inside After Effects, so it happily
rendered a layout your copy could not. There is now a list of everything that
browser is too old for, checked against the finished panel every time the tests
run, and a test that fails outright if a container query ever comes back.

Please look at it docked and floating. Two columns above roughly 830 pixels of
panel width, one below — and if it still looks wrong, the width and class are
now visible with `document.querySelector('div.app').className` in that same
Chrome window.
