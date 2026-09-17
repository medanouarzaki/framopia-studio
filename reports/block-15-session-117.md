Status: OK

# Block 15, session 117 — golden run, and the figures nobody could reproduce settled

A verification session, and it behaved like one: **golden passed field for field,
nothing drifted, and the only behaviour change is the one sentence part 3 asked
for.** Both figures session 116 reported as unreproducible are settled — neither
was ever wrong, and both had been restated in the other's words.

**It also found one thing that was quietly broken**: the type-scale sweep had
been clicking a control session 114 removed, so it had stopped measuring two of
the sixteen settings it exists to count, without a test going red.

---

## 1. Golden, measured

```
  ok    test-1    4415 fields identical
  ok    test-2    4280 fields identical
  ok    test-3    3709 fields identical
  ok    vitasilk  4770 fields identical

golden: 4 of 4 reels matched, field for field
ledger:    294 lines, 77eaf6c9ca6b633e
golden: PASS
```

**PASS, 4 of 4, 4415 + 4280 + 3709 + 4770 = 17,174 fields.** Exit 0.

**Nothing to reconcile.** After Effects 26.0x67 with 1198 font names, against the
reference recorded 2026-09-01 on the same version. **No `DoScript` returned 1**,
so no retry was needed and the five-attempt bound was never approached. After
Effects was open at the start (pid 66090), was driven only through `DoScript`,
and is open with the same pid at the end.

So sessions 108 and 114 — the crop and the build queue — touched no corpus reel,
which is what this run existed to check.

---

## 2. The unattributed percentage: both right, different questions

**Session 68's 45.1% is not the ledger's unattributed share. It is what the
*cache* could not recover.**

From `reports/block-12-session-68.md` §2, the table the figure sits in:

| | amount | share |
|---|---|---|
| recoverable from `.local/cache/` | $10.344745 | 54.9% |
| **attributable to nothing** | **$8.487384** | **45.1%** |

```
  session 68:   8.487384 / 18.832129 = 45.1%   (the cache could not recover it)
  session 116: 19.6795  / 36.2496    = 54.3%   (the ledger line has no client field)
```

**At session 68 the ledger held 165 lines and not one carried a client**, so by
session 116's method the figure that day was **100.0%**. The two never measured
the same thing.

**Why session 116 could not reconcile them**: it assumed the numerator was
$18.83 — the whole ledger — and concluded the total must once have been $41.75,
larger than the ledger has ever been. The numerator is **$8.487384**. The
reasoning was sound and the premise was wrong.

**Which is right?** Both, for their own question. The one the screen shows is
**54.3%**, and it is the right one to show: it answers *how much of this total
can I break down by client*, which is what a person reading the screen is asking.

**`docs/MONEY_SCREEN.md` already stated session 68's figure correctly and in
context** — *"the cache reconstruction session 46 used now recovers $10.344745 of
$18.832129 — 54.9%"*. The document did not need correcting; it needed the
distinction written down so a fifth session does not restate it again. That is
added.

---

## 3. The per-video understatement: stale, not wrong

**It is session 71, not session 72**, and it is a different measurement again.
From `reports/block-12-session-71.md` §2 — the ledger by stage against what every
plan claims:

| stage | ledger | plans claim | unaccounted |
|---|---:|---:|---:|
| images | $9.436246 | $7.371076 | $2.065170 |
| **total** | | | **$5.594404** |

**Recomputed today by session 71's own method**, over the same 19 plans and the
same four stages:

| stage | ledger | plans claim | unaccounted |
|---|---:|---:|---:|
| images | **$24.123426** | **$12.388962** | **$11.734464** |
| transcription | $3.052430 | $2.043812 | $1.008617 |
| analysis | $2.894372 | $1.212680 | $1.681692 |
| imageSlots | $1.677088 | $0.616738 | $1.060350 |
| **total** | | | **$15.485123** |

**The ledger has grown — images from $9.44 to $24.12 — and the gap grew with
it.** Session 71's figure was right on the day and is stale now. Nothing about
the method changed.

**And it is not the per-video understatement.** Session 71's is a whole-history
figure over every stage and every plan, including the benchmarks and prompt
experiments that no plan should ever claim. Session 116 measured something
narrower and more useful: **for the seven reels the ledger can name, plans claim
$16.7988 against the ledger's $17.4175 — $0.62, and $2.08 on the four where the
plan claims less.**

Both true. The screen's caveat is about the second, and it is the second that
belongs there.

---

## 4. Why "building the tool" is $0.00

**Checked, not assumed, and there is no defect. One sentence changed.**

**Does the rule fire?** `spendPurposeFor`, against the real catalogue:

```
    test-1         -> building
    test-2         -> building
    test-3         -> building
    ground-truth   -> building
    vitasilk       -> building
    a client video -> client-work
    null           -> building
    empty          -> building
```

All five corpus reels carry a `sha256` in `benchmarks/footage.json` and all five
resolve. A call with no video at all resolves to `building` too, which is the
safe direction.

**Does every spend point pass it?** All five, read one by one:
`analysis/keywords.ts:343`, `analysis/slots.ts:277` and `:374`,
`transcription/hybrid.ts:114` and `:123`, `images/generate.ts:280` — each
`purpose: spendPurposeFor(videoSha256)`.

**Has any line ever been tagged `building`?** No:

```
  (no purpose field): 165 lines
  client-work:        129 lines
```

**Why the bucket is empty:** the 129 tagged lines name **seven distinct videos,
and not one of them is a corpus reel.** Since session 68 introduced the field,
every billable call has been on one of his client videos. The roughly $19 spent
on benchmarks and prompt experiments in sessions 1 to 83 is in the 165 untagged
lines, which the screen already shows as **$19.68 from before this was
recorded** — exactly where session 116 said it was.

**So no ledger line was backfilled and no rule was changed.** What changed is the
sentence. It read:

> $0.00 went on building the tool

which invites precisely the reading session 116 gave it. It now reads:

> **Nothing has been charged to a test reel since September**

---

## 5. Three load-bearing behaviours, broken and restored

Each mutated in the source, watched go red, restored from the saved bytes, and
watched go green. `git diff` on all four touched files is empty afterwards.

**M1 — a failure does not stop the queue** (session 94). A failed video now
`break`s instead of carrying on:

```
 FAIL  service/src/queue.test.ts > a video that fails > does not stop the queue
AssertionError: expected [ 'done', 'failed', 'not-reached' ] to deeply equal
[ 'done', 'failed', 'done' ]

  Array [
    "done",
    "failed",
-   "done",
+   "not-reached",
  ]
```

**M2 — a resume does not re-buy what was paid for** (sessions 111, 113). Both
halves of the analysis stage forced to look unfinished:

```
 FAIL  service/src/what-a-failure-costs.test.ts > … > what a failure between the
 keywords and the slots leaves behind
AssertionError: expected 1 to be +0

 ❯ service/src/what-a-failure-costs.test.ts:331:27
    330|     /* The keywords are already bought. Buying them again is session 9…
    331|     expect(keywordsAgain).toBe(0);
```

A second test went red with it — *keeps every slot when the picture stage fails
part-way*.

**M3 — a duplicate add is refused** (session 109, re-earned 114). The toggle
replaced by a plain append:

```
 FAIL  panel/src/building-them-all.browser.test.ts > choosing several videos >
 cannot put the same video in the list twice
AssertionError: expected 5 to be 1
```

Restored: **42 tests pass** across the three files.

---

## 6. Everything else, confirmed

| | expected | measured |
|---|---|---|
| `sora-3`, `sora-4`, `test` through `dryRun`/`stepsFor` | identical | **IDENTICAL, field by field** |
| Choose | 374 px | 374 px |
| Make, an ordinary day | 616 px | 616 px |
| Make, four videos in the list | 616 px | 616 px |
| Make, a run in progress | 896 px | 896 px |
| Make, a stage failed | 891 px | 891 px |
| Build, ready | 497 px | 497 px |
| Build, nothing chosen | 347 px | 347 px |
| Build, built once | 784 px | 784 px |
| Build, twenty ready to build | 845 px | 845 px |
| Build, no typefaces | 621 px | 621 px |
| spacing | 28 / 16 / 8 | 28 / 16 / 8 |
| control cells | 84 controls, 168 cells | **84 controls, 168 cells**, state for state |
| his 22 photographs | byte-identical | **byte-identical, dimensions identical** |
| queue behaviours | all holding | 42 tests across the three files, plus the whole gate |

Every screen is inside 900 px in every state.

### The type scale, and the instrument that had stopped looking

**It measured 14 settings where sessions 112, 113 and 114 all measured 16.**

Not drift. The sweep's second pass puts videos in the queue list and re-measures,
because a list with items in it renders rows, hints and reasons the daily states
never show. It did that by clicking `section.pane button.run` — *Add X to the
list* — which **session 114 removed**. `page.$` answers null for a selector that
matches nothing, the sweep carried on, and two settings stopped being counted.
No test went red, because the count is a console figure and the assertion is
`toBeGreaterThan(0)`.

It ticks a `.pickseveral` row now, and the count is **16 again**. Session 104's
scale never moved; the ruler had.

This is the third instrument in four sessions to be caught reporting a number
that was not true — session 114 caught two of its own, and this is one that had
been wrong since session 114 shipped.

---

## 7. What I am least sure about

**That 16 is the right number and not 17 or 18.** The sweep now reaches the
states it was written for, but it was blind for three sessions and I have only
today's reading to compare against sessions 112–114's. If something was added to
a list-with-items state in 115 or 116, it would show as one of the sixteen and I
could not tell it from the original fourteen.

**That the type-scale count is the only thing that selector broke.** I checked
this one because the number moved. A selector matching nothing fails silently by
design, and other tests written before session 114 may be reaching less than they
claim without a number to give them away.

**Session 71's method is reproducible but its scope is odd** — it sums plan
claims across all 19 plans, including five scratch ones and his clients', against
a ledger that includes benchmarks. The $15.49 it now yields is arithmetic, not a
defect, and I would not put it on a screen.

**Nothing was measured about the $19 of pre-session-68 building spend beyond its
total.** The claim that it was benchmarks and corpus reels rests on session 68's
own account of those 165 lines, not on anything I recomputed.

---

## 8. Measured

**Gate.** `npm run check`, run alone on `6fc9199`, allowed to finish:
**exit 0**, `check: PASS`.

```
core        846 passed (846)
service    1637 passed (1637)
benchmarks  173 passed (173)
panel       469 passed | 2 skipped (471)
pytest      149 passed in 9.86s
```

**Every count identical to session 116's**, which is what a session that added no
test should produce.

**Golden.** PASS, 4 of 4, **17,174 fields identical**. §1.

**Test-name arithmetic**, against `1e824e3`:

```
panel:    422 -> 422
core:     777 -> 777
service: 1590 -> 1590
```

**Nothing added, nothing removed, nothing renamed** — which is what a
verification session should show. The two changes inside existing tests are
assertions added to *puts what he paid, what he spent and what it went on at the
top*, and the selector fix inside *counts every size, weight, colour and
leading on screen*.

**Five panel runs**, each exit 0:

```
run 1  exit 0   469 passed | 2 skipped   367.65s
run 2  exit 0   469 passed | 2 skipped   370.45s
run 3  exit 0   469 passed | 2 skipped   370.71s
run 4  exit 0   469 passed | 2 skipped   376.73s
run 5  exit 0   469 passed | 2 skipped   380.26s
```

A 12.6 s spread. Session 116's five were 373.89, 373.65, 373.64, 376.83 and
371.99 s, so it has not moved.

**The `image-view` flake did not return** — and the five panel runs are not
evidence of that, because `image-view.test.ts` is a service test and never runs
in them. The evidence is the gate: session 116 raised its three describes to
15,000 ms, and **this session's `npm run check` ran once, finished, and passed**,
where session 115's had to be run twice for exactly this file.

**Bundle.** `npm run panel:build` → `panel/dist/panel.js`, **280,490
bytes**. Symlink intact:

```
com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel
```

**Part 0, as found at both ends:**

| | start | end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9ca6b633e…6c1a84d0` | **the same** |
| `templates/library.aep` | `4b0cf05a8f5d4775` | **the same** |
| `modes/dr-loubna-kfafi.json` | `f2fa926e14953b6a`, 2026-09-12T20:52:03 | **the same, same mtime** |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, 2026-09-09T21:58:19 | **the same, same mtime** |
| `.local/` directories | 18 | **18** |
| `.local/queues/` | 0 records | **0** |
| `.local/quarantine-session114/` | 4 records | **4** |
| `.local/payments.json` | 6 entries, $52.00 | **6 entries** |
| `assets/client-pictures/` | 24 files, 35M | **24 files, 35M** |
| his 22 photographs | — | **byte-identical, dimensions identical** |
| **After Effects** | **1, pid 66090** | **1, pid 66090** |
| `aerender` | 0 | **0** |
| Framopia service listening | pid 21517 | **pid 21517** |
| extensions folder | one symlink | **one symlink, unchanged** |

**After Effects has the same pid at both ends**: golden drove the instance that
was already open, through `DoScript` only. None was launched, none was quit, no
`aerender` ran and no project of his was saved. **The service he started was not
stopped** — pid 21517 throughout.

The drive did not unmount this session. The working tree at the end holds
`modes/dr-loubna-kfafi.json` modified, his seven untracked photographs and
`assets/client-pictures/k2-syndicalia/` — all there before this session — and
this report.

---

## 9. Money

**No ledger line was added.** Expected none, spent $0.00.

- 294 records at the start, sha256 `77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0`.
- 294 records at the end, the same sha256.
- `npm run golden` read the ledger itself and printed `294 lines, 77eaf6c9ca6b633e`.
- Nothing this session could bill: golden builds from plans already on disk and
  calls no API, every figure in §2 to §4 is arithmetic over lines already
  written, and the three mutations ran against injected stage functions.
