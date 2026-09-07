Status: OK

# Block 12 session 70 — the money screen, made readable

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — at the start, after `npm run check`, after `npm run golden`, and at the
end.** Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.

**Nothing about the money changed.** `core/` was not touched at all, and the
totals are identical before and after. §1.

---

## 1. The totals, before and after

Measured through the real `moneyView` against the real ledger, before any change
and after all of them:

| | before | after |
|---|---|---|
| **grand total** | **$18.832129** | **$18.832129** |
| lines / unreadable | 165 / 0 | 165 / 0 |
| unattributable | $18.832129 | $18.832129 |
| 2026-08 | $16.187847, 144 charges | $16.187847, 144 charges |
| 2026-09 | $2.644282, 21 charges | $2.644282, 21 charges |
| sora-995f2d27 | $3.822113 | $3.822113 |
| sora-6a60ced1 | $1.551460 | $1.551460 |
| vitasilk | $1.550444 | $1.550444 |
| test 1 | $1.220660 | $1.220660 |
| test 2 | $0.412818 | $0.412818 |
| ground truth | $0.176484 | $0.176484 |

`diff` of the two captures reports **only deletions**, and every one is a scratch
reel:

```
< REEL 0.000488 :: a third video whose pictures run into each other-34b6d02a
< REEL 0.000488 :: another video with its pictures far apart-fd2b30ee
< REEL 0.000244 :: a video this tool has never seen-3678b7a4
< REEL 0.000244 :: a video whose client has pictures of his own-7a133407
< REEL 0.000000 :: a video whose client has no pictures at all-ef3d1ca9
```

No line was added, no figure moved.

**`core/src/ledger-read.ts` did not change**, and neither did anything else in
`core/`. Shown rather than asserted: `git status --porcelain core/` prints
nothing, and `git diff --stat core/src/ledger-read.ts` prints nothing. The
reader, the rounding and the grouping are exactly what session 69 committed.

**A correction to the brief's count.** It described nine scratch reels; this
machine held **five** when the session started, listed among eleven rows. The
number moves as suites run and are interrupted — §3.

## 2. The rule that keeps scratch reels out

**Decided by what the video is.** Every scratch plan names a video inside the
directory the operating system owns and deletes. A client's footage is in their
folder or on the drive and is never there.

```
a third video whose pictures run into each other   path=/var/folders/41/…/T/…
a video this tool has never seen                   path=/var/folders/41/…/T/…
sora-995f2d27                                      path=/Volumes/T7 Shield/Framopia/Clients/…
```

**The name plays no part**, which is what makes it work for a reel called *"a
video this tool has never seen"*: such a reel whose footage sits somewhere real
is listed like any other, and a test proves exactly that.

**Spend is not the test, and measuring is what showed why.** Four of the five
carry a figure the suites wrote — $0.000488, $0.000488, $0.000244, $0.000244 —
so filtering on *no spend* would have hidden **one of five and left four**. And a
real reel can legitimately have spent nothing yet, which a third test pins.

Mutating the filter to do it by spend instead:

```
 FAIL  src/money.test.ts > which reels are his > leaves out a reel whose video the operating system owns
+   Object {
+     "reel": "a video this tool has never seen",
+     "spentUsd": 0.000488,
```

**What this gives up, stated rather than hidden:** a video someone genuinely kept
in the temporary directory would not be listed. A folder the operating system
deletes without warning is not where a person keeps work they were paid for, so
that is the right way round — but it is a limit, and it is written in the code.

**A bug my own test caught.** `tmpdir()` is a symlink on macOS — `/var/folders/…`
to `/private/var/folders/…` — and a video the tests have already removed cannot
be resolved at all. Resolving the *file* therefore compared `/var/…` against
`/private/var/…` and matched nothing, so the first version of this filter
excluded nothing whatsoever. It now resolves the nearest directory that exists
and joins the rest back on.

## 3. Where the scratch plans come from — reported, not fixed

`service/src/new-video.test.ts` writes **real Edit Plans** into `.local/plans/`,
because `editPlanPathFor` sends a video outside the repository there — and that
is the same directory a client's own plans live in.

**The suite is not leaving them; a killed run is.** Its `afterAll` removes every
plan, cutout, frame and mask it made. The five on this disk are dated
**20:01–20:06 on 2026-09-07**, which is when session 69 let a service run hit a
ten-minute timeout while capturing test names. Session 69 reported the same cause
for three scratch clients in `modes/`.

**The reportable design point**, which is a decision and not this session's: a
test suite writing into the directory a client's plans live in means any
interrupted run pollutes the real one, and the money screen is only the first
place that became visible. A scratch plans directory for the suites would end it.

**Nothing was cleaned up.** The five plans, `.local/plans/cutouts/`, and the
grown `.local/cv` are exactly as found.

## 4. What the screen looks like now

Measured by rendering the built panel at 420×900 and reading the geometry:

```
.moneyback .ghost: 68x40 at y=69
.moneybanner:     380x146 at y=108
.moneyfilters:     380x70 at y=348
.moneygroups:      380x76 at y=432
  figure: [Spent since the beginning] [$18.832129] [165 charges] [since 2026-08-24]
  figure: [Credit left] [not entered] [Framopia cannot see your account.]
rows: 2026-08 = $16.19 | 2026-09 = $2.64
```

- **Back is a 68×40 button**, not a full-width band.
- **The six groupings are one 70px row of pills**, not six pages of navigation.
- **Real figures are above the fold** — the first amounts sit at y=432 of 900.
- **Every label, value and sentence is its own element**, as the figure dumps show.
- **Amounts share a right edge** and are read down a column, in tabular numerals.
- **To the cent everywhere — `$16.19`, `$2.64` — except the grand total**, which
  keeps `$18.832129`, because that is the figure that reconciles with the record.
- **Long names are clipped, never allowed to push a number off the edge**; the
  stage list moved under the table for the same reason, since a fourth column
  did exactly that on a panel this narrow.

**Nothing new was invented.** The cards, the 1px `--line` borders, the 9px
radius, `--panel`/`--panel-2`, `--muted`/`--faint`/`--warn` and
`font-variant-numeric: tabular-nums` are all read out of `panel/src/panel.css`,
which already used every one of them. No styling library was added and no setting
for sizes or weights exists.

**The credit block is now the parts it is** — the label, the figure, when he
entered it, what has been spent since, and the caveat on its own line:

> **Credit left** · $4.18
> You entered $6.82 on 2026-09-08
> $2.64 spent since then
> **Subtraction, not a reading of your account**

The ruled meaning survives: session 46 carried a balance forward and got $2.91
where a later report said $2.71, a $0.20 gap the repository could not explain.

**The unattributable row keeps its explanation and keeps being shown** — today
the whole $18.83 of $18.83. **`leave-the-panel.test.ts` passes unchanged, 2 of
2**: nothing here names a command, and no second exemption was added.

## 5. Every new assertion, red then green

**The defect Mohamed actually saw.** Reverting the banner to a single flow
reproduces it exactly:

```
 FAIL  src/money.browser.test.ts > the money screen > never runs two pieces of text together
+ Array [
+   "Spent since the beginning | $18.832129",
+   "$18.832129 | 165 charges",
+   "165 charges | since 2026-08-24",
+   "Credit left | not entered",
+   "not entered | Framopia cannot see your account.",
+ ]
```

It measures the way an eye does — for each adjacent pair, either they are on
different lines or there is real space between them. **A string test could never
have caught this**: the text was always correct, and it was the boxes that ran
together.

**The reel rule**, mutated to filter by spend — verbatim in §2, three tests red.

Both restored byte-identical from saved copies, green re-verified.

**No assertion reads `textContent` of the whole screen.** Session 69 caught its
own test passing with the row deleted and the sentence hidden, because
`textContent` returns hidden text. The new assertions read geometry and table
rows. **No live Playwright handle is held** — session 54 lost a run to vitest
serialising one into a diff.

## 6. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, **run after committing**. **No workspace was
built while a gate was in flight.** **`npm run golden`: PASS** — 4415 + 4280 +
3709 + 4770 = **17,174**, field for field.

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

| suite | passed | skipped | total | session 69 |
|---|---|---|---|---|
| core | **813** | 0 | **813** | 813 — **unchanged, as required** |
| service | **1410** | 1 | **1411** | 1406 passed |
| benchmarks | 173 | 0 | 173 | 173 |
| panel | **266** | 2 | **268** | 263 passed, 265 total |

**+4 in service**, all in `money.test.ts`, verified by name:

1. `which reels are his > leaves out a reel whose video the operating system owns`
2. `… > shows a reel that carries money however scratch its name looks`
3. `… > keeps a real reel that has spent nothing yet`
4. `… > lists only the six reels that were really paid for`

**+3 in panel**, all in `money.browser.test.ts`, verified by diffing the full
list of test names:

5. `the money screen > never runs two pieces of text together`
6. `the money screen > lines the amounts up in a column`
7. `the money screen > keeps every row inside the panel`

1406 + 4 = 1410 and 263 + 3 = 266. Both close exactly, and **core did not move**,
which is what part 4 required.

**Five panel runs, each with its exit status:** 266 passed, 2 skipped (268),
exit 0 — five times.

**Every suite was allowed to finish.** The service run captured for the name diff
exceeded a foreground timeout and was moved to the background rather than killed,
so its `afterAll` ran. `modes/` holds exactly `.gitkeep`,
`dr-loubna-kfafi.json` and `k2-syndicalia.json` at the end.

**Part 0, as found at both ends:**

| | at start | at end |
|---|---|---|
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |
| **ledger lines** | **165** | **165** |
| **ledger sha256** | **`786497a5f371d179…`** | **`786497a5f371d179…`** |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/.gitkeep` | `e3b0c44298fc1c14…` | same |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | same |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | same |
| `assets/client-pictures/` | 0 files | 0 files |

The ledger was re-checked **after `npm run check` and again after
`npm run golden`**: 165 lines, `786497a5f371d179…`, unchanged at both.

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**`.local/` at the start:** `audio` 27 · `bench-audio` 5 · `build` 70 · `cache`
159 · `cv` 2155 · `deleted-clients` 0 · `doctor` 1 · `evidence` 3 ·
`ground-truth` 10 · `plans` 66 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `quarantine-session69` 3
· `transcripts` 1. Session 69's three quarantined scratch clients were left where
they are, as instructed.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 7. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after the
gate, after golden, and at the end. Nothing here could bill: a filter on where a
video lives, and how a screen is laid out.
