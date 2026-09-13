Status: PROBLEM — the three-screen restructure was measured, built and then reverted; only the wording, the money and the colour shipped.

# Block 13, session 95 — rebuild the panel around what he is actually doing

**This session did not do the main thing it was asked to do, and section 7 is
why.** The restructure was built, measured working, and reverted when it became
clear it could not be finished safely in one sitting. What shipped is the half
that is contained and proved: the words, the money and the colour. The panel is
exactly as usable as it was, with better sentences in it.

## 1. Everything the panel can show, sorted into the three moments

**Choose** — the client picker and what it shows about a client (colours, type,
photographs, their folder); the video picker, Refresh, and the notice about a
missing file dialog.

**Run** — *See everything spent — $36.25 so far*; what this video has cost; the
soft alarm; the four stage rows and their verdicts; the two run buttons; the
other-service notice; the wrong-client notice; the live run report; *Make several
videos* and everything in it.

**Build** — the fonts warning; the watermark size control; what the composition
will contain; *Build the composition*; and *Change something first* — the
transcript, keyword and picture editors.

### How tall it is, measured

Measured in a real browser at 420 × 900, which is the panel's size, and kept as
`panel/src/measure-height.browser.test.ts` so the number can be checked rather
than remembered:

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

**The queue begins at 990 px in a 900 px panel.** He asked for it, and it is
ninety pixels below the fold. That is not an impression; it is the measurement.

### Logic and presentation, so the line is drawn before anything moves

**Presentation, and therefore this session's:** every string the panel renders,
the order and grouping of its sections, the CSS, which control is which colour,
and how a number is formatted for display.

**Logic, and therefore not:** `estimateUsd`, `action` and `provenance` in the dry
run; the stage list and its ids; what any button posts; every count and cost on a
plan; the ledger; anything in `core/` or `service/` that decides rather than
describes.

The translation lives in `panel/src/words.ts` for exactly this reason. Putting it
in the service would have moved strings the service's own tests assert on, which
is the line.

## 2. Every message in the tool's language, old and new

| old | new |
|---|---|
| `Transcribe and correct` | **Writing down the words** |
| `Keywords and image slots` | **Choosing what to emphasise and what to picture** |
| `Generate images` | **Drawing the pictures** |
| `Looking at the video` | **Finding you in the picture** |
| `waiting` | **Still to do** |
| `running…` | **Doing this now** |
| `done` | **Done** (kept — it is what he would say) |
| `failed` | **Stopped here** |
| `skipped` | *(never shown bare; see below)* |
| `not part of this run` | **Not needed this time** |
| `already on the plan` | **Already done — nothing to pay** |
| `cached` | **Already paid for — nothing to pay** |
| `no plan` / `no plan to analyse` / `no plan to illustrate` | **Nothing to do yet** |
| `no image slots on the plan` | **No pictures were wanted** |
| `already done` | **Already done — nothing to pay** |
| `free, already paid for` | **Already paid for — nothing to pay** |
| `free, reusing an earlier run` | **Already paid for — nothing to pay** |
| `will run` | **Free** |
| `will run, about $2.17` | **About $2.17** |
| `done, $3.4025` | **Done — $3.40** |
| `Make the subtitles again — about $0.00` | **Make the subtitles again — nothing to pay** |
| `1 slot idea(s) depict more than one subject: img007 ("…") — and. The mode asks for one subject, centred and unobstructed.` | **One of the picture ideas asked for two things in a single picture, so it was left out. The rest were made. Run the pictures again and a fresh idea is asked for.** |
| `fetch failed` | **The connection dropped. Nothing was lost and nothing extra was charged. Try it again.** |
| `the model returned 503 Service Unavailable` | **The service we use was busy and turned it away. Nothing was charged. Try it again shortly.** |
| `ENOENT: no such file or directory, open …` | **A file it needed was not where it expected. If the drive is unplugged, plug it in and press Refresh.** |
| `would discard editor work on 8 slot(s): img002 …` | **You have already chosen pictures for this video, and running it again would throw those choices away. Nothing was changed.** |
| *(a cause nobody has words for)* | **It stopped before finishing. Nothing you have already paid for is lost.** |
| *(no cause at all)* | **It stopped and did not say why. Nothing else was changed.** |

**`skipped` was the worst of them.** It means the work was already done and costs
nothing — good news — and it read like a fault.

**One message is deliberately left alone.** Block 7 session 32 wrote the
picture-tools crash for a person: *"the picture tools stopped during
segment_person — it was killed by SIGABRT, and wrote nothing"*. My first version
of `causeWords` swallowed it into the general apology, and **session 32's own
test caught me doing it**. It now passes through untouched, and a test pins that
so the next rewrite cannot lose it again. "Never raw" means never the *tool's*
language, not never the service's.

### Money, and colour

**Money to the cent.** `formatUsd` was `toFixed(4)` and is `toFixed(2)`:
`$3.4025` → `$3.40`, `$1.5504` → `$1.55`. The grand total on the money screen
keeps its full precision, in `Money.tsx`, because that figure reconciles with the
ledger.

**Colour carries one meaning.** `button.run` was the accent red whatever it did,
so *Make the pictures — about $2.17* and *Make the subtitles again — about $0.00*
were identical. A control that costs nothing is now the same shape and weight
without the colour: `button.run.free`, using tokens already in `panel.css`.

## 3. The three screens — built, measured, and not shipped

I built them: a `nav.moments` switcher of *1. Choose · 2. Make · 3. Build*, the
sections gated so only one renders, `Build` split into its own section, and the
queue moved up into *Make*. **Measured in the same browser:**

| screen | content ends at | of a 900 px panel |
|---|---|---|
| 1. Choose | **705 px** | fits |
| 2. Make | **781 px** | fits |
| 3. Build | **656 px** | fits |

**The queue moved from 990 px to 601 px** — from below the fold to plainly
visible, which was the point.

**And then I reverted it.** The panel's browser tests drive it by clicking real
controls, and every one that asserts on the cost, the run buttons, the editors or
the build step was suddenly looking at the wrong screen. I worked through four
rounds of it — teaching each loader to navigate — and the count went **24 → 20 →
58 → 51**. Each round is a twelve-minute run, each fix revealed the next file,
and it was not converging.

Section 7 of the brief is explicit: *"A half-finished screen he cannot work with
is worse than the scroll he has now."* Shipping a restructure whose test suite I
had not got green would have been exactly that. So it is out, and what is left is
the measurement — the 1288 px, the 990 px, the three heights above — so the next
session starts from numbers rather than from scratch.

**What I would do differently:** the three heights prove the design works. The
cost is not the panel, it is that ~24 browser tests encode "everything is on one
page" in their loaders. That is one session's work on its own, done first, before
the panel moves.

## 4. A queue of fifteen

**Not built, and not measured.** It belongs to the screens that were reverted:
with the queue at 990 px, fifteen rows would start below the fold and end around
1800 px. I am not going to describe how it would look, because I did not build it
and have not measured it.

## 5. The video list — the premise measured, and it does not hold

The brief expected the cost to be probing each video's duration and dimensions.
**Measured on Dr Loubna's real folder, 32 videos:**

| | |
|---|---|
| `listVideosFor('dr-loubna-kfafi')`, cold | **32.2 ms** |
| second call | 16.2 ms |
| third call | **8.6 ms** |

**Nothing is probed.** `listVideosFor` calls `describe(label, path, null)` — the
duration is passed as `null`, and `describe` opens no video: it reads the plan
JSON beside it, if there is one. Twenty-five large files could not be opened off
an external drive in 8.6 ms.

**So there is no probe to cache, and I did not add one**, because the brief says
not to fix what has not been measured. Session 81's 12 ms walk is still the walk;
the listing on top of it is another 20 ms cold.

**What "appears in stages" actually is:** the panel fires three fetches, in three
separate effects, and re-renders on each — `fetchVideos` when the client changes,
then `fetchDryRun` and `fetchSteps` when a video is picked. The list settling is
the panel reflowing as the second and third arrive, not the disk being slow. That
is a presentation fix, in the screens that were reverted, and it is listed as
open rather than guessed at.

## 6. The same video's figures, before and after

Captured before any change and again after, through the same routes the panel
uses — `dryRun` and `stepsFor` — for three videos that have been run:

| | `sora-3` | `sora-4` | `test` |
|---|---|---|---|
| estimate / words / pictures | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $0 |
| every stage | done / skip / 0 | done / skip / 0 | done / skip / 0 |
| cards | 90 | 69 | 56 |
| keywords | 4 | 4 | 3 |
| images | 7 | 6 | 6 |
| sfx | 7 | 6 | 6 |
| zones | 27 | 13 | 23 |
| spent | $0.4380424709133333 | $1.43523565 | $2.1998237744200004 |

```
diff before.json after.json  →  IDENTICAL
```

**Every cost, every count, every picture and every card is byte-identical**,
including the un-rounded spend figures, which are the plan's own numbers and are
not what the panel formats.

**Files touched:** `panel/src/words.ts` (new), `panel/src/words.test.ts` (new),
`panel/src/measure-height.browser.test.ts` (new), `panel/src/App.tsx`,
`panel/src/spend.ts`, `panel/src/panel.css`, `panel/src/App.test.tsx`,
`panel/src/render.browser.test.ts`. **Nothing in `core/`, nothing in `service/`,
no rule, no price, no count.**

## 7. What I am least sure about

**That reverting was right.** The three screens measured well — 705, 781 and
656 px, and the queue visible at last — and I threw that away over a test suite
rather than over the design. A reasonable person could say I should have pushed
through; the counter is that I could not show it green, and an unproved panel is
not a panel he can trust with his money.

**The generic fallback.** *"It stopped before finishing. Nothing you have already
paid for is lost."* is honest and nearly useless. Every cause I could name has
real words; the fallback is for causes I have not met, and the first time he hits
one he will learn nothing from it. I would rather it said *"and it said something
we have not written words for yet — tell us what it was"*, but that asks him to
copy a string out of a panel that no longer shows it.

**Stage names.** *Finding you in the picture* is right for Dr Loubna talking to
camera and wrong for a video with nobody in it. Nothing in this tool builds those
today, so it is right now and may not stay right.

**What I would change next, in order:** the browser-test loaders first, on their
own, until they can drive a panel with more than one screen; then the three
screens, which are already measured; then the queue's fifteen rows; then the
panel's three fetches, which is what "appears in stages" really is.

## 8. Every new assertion, red then green

Four mutations on the new module, each restored:

```
### M1 — money back to four decimals
   × what a run will do before it starts > says the money to the cent
     → expected 'About $2.1708' to be 'About $2.17' // Object.is equality
   × money > is to the cent
     → expected '$3.4025' to be '$3.40' // Object.is equality

### M2 — the raw cause reaches the screen again
   × what went wrong, in his words > does not repeat the raw text back to him, ever
     → expected 'a cause nobody has w: true' to be 'a cause nobody has w: false' // Object.is equality

### M3 — a written message is swallowed again
   × a cause that is already in his words > passes through untouched
     → expected 'It stopped before finishing. Nothing …' to be 'the picture tools stopped during segm…' // Object.is equality
   × a cause that is already in his words > keeps what it says about which half broke
     → expected 'It stopped before finishing. Nothing …' to contain 'segment_person'

### M4 — free is red again
   × colour carries one meaning > is true only when real money is about to be spent
     → expected true to be false // Object.is equality
```

Restored: **17 of 17 green.**

## 9. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1575 | 0 | 1575 |
| benchmarks | 173 | 0 | 173 |
| panel | 306 | 2 | 308 |
| pytest (CV sidecar) | 149 | 0 | 149 |

**It failed once before this, and passed on the re-run**, on three image-view
tests that timed out at 5 s and pass in 24-of-24 alone. After Effects was at 36%
of a core at the time. Reported rather than smoothed over.

**Arithmetic by name: 19 added, 1 rewritten, 0 deleted.** Panel 290 → 308 is +18;
the nineteenth added is the ruler, which lives in a new file and is counted in
that 18 as well — 17 in `words.test.ts` plus 1 ruler, and one rewrite in
`render.browser.test.ts` that is a rename rather than an addition.

The rewritten one: **`shows a failed stage's cause as it came, not a summary`** →
**`shows a failed stage's cause in his words, not as it came`**. It asserted the
raw cause must reach the screen. That is the behaviour Mohamed asked to be rid
of, so the test is reversed, not deleted, and says why in its own comment.

Fourteen more tests had their expected wording updated where this session retired
it — every one of them still asserts the same behaviour, and each carries a
comment naming the change.

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**. A panel change did not move it.

**Panel suite, five times: exit 0, 0, 0, 0, 0**, with the output of all five
captured and no failure in any of them.

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
| After Effects | 1 | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 6416 | pid 6416, never stopped |
| `origin/main..main` after fetch | 0 | 0 after push |

His seven photographs and his edit to `modes/dr-loubna-kfafi.json` are still
uncommitted, exactly as found. Every commit named its paths and none named his.

## 10. Every ledger line added

**None.** 294 records and sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing in this session could bill: no stage was run, and the only things executed
were tests, the gate, golden, and two read-only measurements.

## What is open

- **The three screens.** Measured at 705 / 781 / 656 px with the queue visible at
  601 px, and reverted (section 3). The browser-test loaders are the obstacle and
  are their own session.
- **The queue at 990 px** is still where he cannot find it.
- **"Appears in stages" is the panel's three fetches**, not the disk (section 5).
- **A queue of fifteen** is unbuilt and unmeasured.
- **The generic error fallback tells him nothing** (section 7).
- Everything carried from session 94 that this session did not touch.
