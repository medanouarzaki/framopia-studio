Status: OK

# Block 13, session 96 — free the browser tests from the one-page assumption

**The three screens pass.** With Choose, Make and Build switched on, the panel
suite is **306 passed, 2 skipped, 0 failed** — where session 95's four rounds
went 24 → 20 → 58 → 51 and did not converge. The switch is reverted and the panel
is byte-identical to how this session found it. Session 97 is a short session.

## 1. Any orphaned process from session 95

**None.** Session 95 ended with five shells still running, and session 93 found an
`esbuild` helper burning 270% CPU for eighteen hours, so this was checked first:
no `vitest`, `esbuild`, `chromium` or `playwright` process was alive. The only
node process on the T7 was **pid 34159** — Mohamed's own companion service, two
minutes old with a live parent and holding the listening port. It was left alone.

The difference from session 93 is that session 95 let every suite finish rather
than killing runs mid-flight, which is what leaked the orphan then.

## 2. Every test that assumed one page

Counted rather than estimated. Every browser and jsdom test was parsed, its body
separated from its file's shared loader, and each classified by the selectors it
actually touches:

| | |
|---|---|
| tests in the nine files | **220** |
| tests whose own body names a screen | **58** |
| of those: Build only | 19 |
| Make only | 18 |
| Build + Choose | 10 |
| Choose only | 8 |
| straddling all three, or two others | 3 |

By file: `render.browser.test.ts` 37, `client-colours` 5, `wrong-client` 5,
`money` 4, `other-service` 3, `client-editing` 2, `photograph-warning` 2.

**Session 95's ~24 was the count of what failed first, not the count of what
assumes one page.** The static figure of 58 is larger, and the empirical figure
turned out larger still — **the first run with three screens on failed 25**, and
those 25 were not all in the 58, because a test can break through its *loader*
without naming a screen itself.

### What the loaders do, which is the machinery that changed

A browser test does not assert on a fresh panel. Each file has a loader that
stubs the CEP host and the service routes, opens the built bundle, and then walks
it into a state: `loadFlow` picks a video and a client and waits for
`section.change .opener`; `loadRun` goes further and presses a run button;
`openBuild` waits for `.buildpane`; `loadImages`, `loadTranscript` and
`loadKeywords` click an opener and wait for `main.editor`.

**Every one of those waits names a selector that is on exactly one screen.** That
is the assumption, and it is in the shared machinery rather than in the tests —
which is why teaching tests to navigate one at a time did not converge.

### What needed no change

**123 of the 220 name no screen at all** and needed nothing: they test pure
functions, the harness itself, or content that is on every screen — the brand
header, the service dot, the build stamp. `words.test.ts`, `spend.test.ts` and
the rest of the jsdom unit files are untouched.

## 3. The mechanism

**`onScreen(page, screen)`** in `browser-harness.ts`, and **`goTo(screen)`** for
the jsdom tests in `App.test.tsx`.

```ts
const ANCHOR = { choose: 'section.video', run: 'section.cost', build: 'section.change' };
```

**Why these three anchors:** each exists in both panels. `section.video` is the
video picker, `section.cost` is the money and the run buttons, `section.change`
is the editors. None of them moves when the screens land — only which of them is
rendered at a time does.

**Why it works under both panels**, which is the whole point of doing this
separately from session 97:

- one page: there is no `nav.moments` to press, and the anchor is already
  rendered — so the call is a visibility assertion and nothing else;
- three screens: there is one, it is pressed, and the anchor is on screen because
  pressing it put it there.

**It proves it got there.** It does not merely wait for the anchor to exist — it
asks the browser `checkVisibility()`, because Block 11 session 69 shipped a test
that passed over hidden text, `textContent` returning what `display: none` hides.
The jsdom twin walks the ancestor chain with `getComputedStyle`, since
`offsetParent` is always null under jsdom and would have called everything
invisible.

**Its timeout is 4 s, shorter than a test's 5 s default, on purpose.** At 10 s the
helper outlived the test and a wrong declaration reported only `Test timed out`,
which says nothing. At 4 s the helper fails first and names the screen and the
anchor.

### The two proof tests, green then red

Converted first, before anything else moved, and run:

```
      Tests  1 passed | 124 skipped (125)     keeps the Run control disabled with its reason on screen
      Tests  1 passed | 124 skipped (125)     disables Build while anything is missing
```

Then the panel was broken in the way each should catch — the screen's own anchor
hidden — and each went red:

```
### MUTATION A — section.cost hidden
   × the built panel in a real browser > keeps the Run control disabled with its reason on screen
     → the panel is not showing the run screen: section.cost never became visible

### MUTATION B — section.change hidden
   × a reel that is not ready to build > disables Build while anything is missing
     → page.waitForSelector: Timeout 10000ms exceeded.
```

Mutation A is the helper's own sentence. Mutation B was taken before the timeout
was tightened and shows Playwright's; both restored, both green again.

## 4. The conversion, group by group

**The count never rose.** Session 95's rounds went 24 → 20 → 58 → 51; these went:

| group | what | panel suite after |
|---|---|---|
| baseline, two proof tests converted | — | **306 passed, 2 skipped, 0 failed** |
| 1 — loaders reaching an editor or a run button | 18 declarations | **306 passed, 0 failed** |
| 2 — loaders waiting on run-screen elements | 6 declarations | **306 passed, 0 failed** |
| 3 — `App.test.tsx`, the jsdom twin | 11 declarations | **306 passed, 0 failed** |

Every group stayed green because on a one-page panel a declaration is a
visibility assertion, and the sections were visible. **The declarations only
start doing work when the screens land**, which is what section 7 measured.

## 5. Every test rewritten

**One.** No test was added, removed or renamed — verified by diffing test names,
not by subtracting totals: `+0 it(`, `−0 it(`, and 306 passed / 2 skipped / 308
before and after.

**`the built panel in a real browser > renders the brand mark and one screen, top
to bottom`**

Old:

```ts
const headings = await page.locator('section > h2').allTextContents();
expect(headings).toEqual(['Client', 'Video', 'Cost', 'Make several videos', 'Change something first']);
```

New — it reads the same whether the switcher is there or not, so it does not move
again in session 97:

```ts
const switcher = await page.locator('nav.moments button.moment').allTextContents();
if (switcher.length === 0) {
  expect(headings).toEqual(['Client', 'Video', 'Cost', 'Make several videos', 'Change something first']);
} else {
  expect(switcher).toEqual(['1. Choose', '2. Make', '3. Build']);
  expect(headings).toEqual(['Client', 'Video']);
  await onScreen(page, 'run');
  expect(await page.locator('section > h2').allTextContents()).toEqual(['Cost', 'Make several videos']);
  await onScreen(page, 'build');
  expect(await page.locator('section > h2').allTextContents()).toEqual(['Build', 'Change something first']);
}
```

**Nothing was weakened.** Two assertions were made *narrower* rather than looser,
and both because the three-screen layout puts the queue's controls beside the run
buttons: `textContent('button.run')` became `textContent('section.do button.run')`,
and `waitForSelector('button.run')` became `waitForSelector('.partrun button.run')`.
Reading the first `button.run` on the page would otherwise have read *"Add
vitasilk to the list"* — a real ambiguity the layout introduces, not a test made
to pass.

## 6. Proof the panel did not change

**The measured height and every section position, before and after:**

```
  == the one scroll — content ends at 1288px of a 900px panel
     (no heading)               top    75px  height   211px
     Client                     top   308px  height    66px
     Video                      top   395px  height   225px
     Cost                       top   643px  height    75px
     (no heading)               top   740px  height   228px
     Make several videos        top   990px  height   180px
     Change something first     top  1191px  height    97px
```

Identical at both ends, to the pixel. The queue is still at 990 px, still below
the fold — this session did not fix that and was not meant to.

**No non-test file under `panel/src` changed**, with one named exception:
`browser-harness.ts`, which is the shared machinery every browser test loads and
is where one mechanism has to live if it is to be one mechanism. `App.tsx`,
`panel.css`, `Queue.tsx`, `words.ts`, `spend.ts` and every other source file have
**no diff at all** — `git diff --stat` on them is empty.

**`core/` and `service/` are untouched** — `git status` on both is empty.

**Every message on screen is unchanged.** Session 95's wording is in `words.ts`
and `App.tsx`, neither of which this session edited.

**A video that has already been run:**

```
diff before.json after.json  →  IDENTICAL
```

`sora-3`, `sora-4` and `test`, through the same `dryRun` and `stepsFor` the panel
uses — every estimate, every stage verdict, cards, keywords, images, sfx, zones
and the un-rounded spend, compared against the file session 95 captured before
any of its own changes.

## 7. Whether session 97 can land

**Yes.** The three screens from session 95 were rebuilt — the switcher, the three
gates, Build split into its own section with the fonts note, and the queue moved
up into Make — and the panel suite run with them on:

| attempt | what was wrong | panel suite |
|---|---|---|
| 1 | as converted | 25 failed, 281 passed |
| 2 | `goTo` placed before the video was picked, in 7 jsdom tests | 11 failed, 295 passed |
| 3 | eleven loaders and tests still reading another screen | 2 failed, 304 passed |
| 4 | the queue sat *between* the gates, so it rendered on every screen | **0 failed, 306 passed, 2 skipped** |

**Green**, and converging every round — the opposite of session 95.

The heights, measured again independently and matching session 95 exactly:

| screen | content ends at | of a 900 px panel |
|---|---|---|
| 1. Choose | **705 px** | fits |
| 2. Make | **781 px** | fits — **the queue at 601 px** |
| 3. Build | **656 px** | fits |

**The switch is reverted.** `App.tsx` and `panel.css` have no diff. What session
97 has to do is re-apply the four edits above — and the fourth is the one to get
right first, because putting the queue outside a gate is what made it render on
every screen.

**What is still in the way, and it is small:** two of the four rounds were my own
wiring rather than the tests. The tests themselves cost one round — the eleven in
attempt 3 — and are now declared.

## 8. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1575 | 0 | 1575 |
| benchmarks | 173 | 0 | 173 |
| panel | 306 | 2 | 308 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured from the passing run, not carried. **Identical to session 95's figures in
every suite**, which is what a test-harness session should do to them.

**Arithmetic by name: 0 added, 0 removed, 0 renamed.** Verified by diffing test
names — `grep '^+  it('` and `'^-  it('` on the whole diff both return **0**. What
changed is **59 navigation declarations** across nine files, and one rewritten
assertion (section 5).

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**. A test-only session did not move it.

**Panel suite, five times: exit 0, 0, 0, 0, 0.** All five captured, 306 passed and
2 skipped each, and **no failure in any of them** — `grep '×'` across the five
output files returns nothing. Every suite was allowed to finish; nothing was
killed mid-flight.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9…6c1a84d0` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…`, 2026-09-12T20:52:03 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 36M | 22 files, 36M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 6741) | 1 (pid 6741), never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 34159 | pid 34159, never stopped |
| `origin/main..main` after fetch | 0 | 0 after push |

His seven photographs and his edit to `modes/dr-loubna-kfafi.json` are exactly as
found. Every commit named its paths; none named his.

## 9. Every ledger line added

**None.** 294 records and sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing here could bill: no stage was run, and everything executed was a test, the
gate, golden, or a read-only measurement.

## What is open

- **The three screens are not on.** They pass, they are measured, and re-applying
  them is session 97's job.
- **The queue is still at 990 px**, below the fold, until then.
- **`.buildpane` is a div inside `Build.tsx`, not a section**, so the Build screen
  needs a section wrapper of its own — session 97 adds one, as the trial did.
- **Two assertions were narrowed** because the queue's buttons sit beside the run
  buttons on the Make screen (section 5). That ambiguity is real and session 97
  inherits it.
- Everything carried from session 95 that this session did not touch.
