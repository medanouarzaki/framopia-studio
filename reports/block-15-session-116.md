Status: OK

# Block 15, session 116 — the money screen says three things, and the partner gets set up

Two parts, both done. **Part A**: he asked how much he had paid in and had to be
told by hand; the three figures he comes to this screen for are now the first
thing on it, each saying what it is not. **Part B**: the second-machine document
had never been walked by anyone and was 61 commits stale; it has been walked
literally, every figure in it re-measured, and it stops exactly where every
rehearsal has stopped.

**Golden did not run: After Effects was not open at any point in this session,
and launching it is forbidden.** §10 says so plainly rather than claiming a pass.

---

## 1. The three figures the screen now shows

Measured from the real ledger — 294 lines, `77eaf6c9…`, unchanged all session.

| | | |
|---|---|---|
| **Spent since the beginning** | **$36.249598** | *Framopia's own count, not your invoice* |
| **Paid in** | **$52.00** | *Your figures, not a reading of any account* |
| **Making his videos** | **$17.42** | *$19.68 is from before this was recorded* |
| Credit left | not entered | (kept; nothing was deleted) |

**Paid in was $0.00 before this session**, because `.local/payments.json` did not
exist — the figure the brief states as $52 had never been entered on this
machine. The six payments it names are now recorded:

```
  2026-08-10  $ 10.00  Google
  2026-08-25  $ 10.00  Google
  2026-09-03  $ 10.00  Google
  2026-09-12  $ 10.00  Google
  2026-08-01  $  6.00  ElevenLabs
  2026-09-01  $  6.00  ElevenLabs
  total paid in: $52.00
```

**Two ElevenLabs dates are mine and not his.** The brief gave "two months at $6"
and no dates; the first of each month is what was recorded. They are the only
figures on this screen I supplied rather than measured, and each row has a
*Remove* control already, so correcting them is one press.

**"Building the tool" is $0.00, and that is the finding.** `byPurpose` splits
into exactly two buckets on his ledger:

| | | |
|---|---|---|
| client work | **$17.4175** | 48.0% |
| before this was recorded | **$18.8321** | 52.0% |
| building the tool | **$0.00** | no lines at all |

So **every dollar the tool can attribute to a purpose went on his clients' work**.
Nothing since session 68 gave a line its purpose was spent on a corpus reel. The
figure at the top is client work; the sentence under it names the $19.68 that
predates the field, because a figure that quietly means less than it appears is
this project's oldest defect shape.

---

## 2. Paid in and spent, per account

Never netted into one number, and side by side:

| account | paid in | used | left | calls |
|---|---|---|---|---|
| **Google** | $40.00 | $35.02 | $4.98 | 255 |
| **ElevenLabs** | **$12.00** | **$0.04** | **$11.96** | 30 |
| more than one | $0.00 | $1.19 | — | 9 |

**What it says about the subscription, plainly: he has paid $12 for two months
and the tool has billed four cents against it.** Thirty calls, $0.0431. If the
subscription is $6 a month, the second month cost 150 times what it bought.

Framopia uses ElevenLabs for one thing — Scribe, the first transcription pass —
and a 25-second reel is about a tenth of a cent. **Nothing in this repository can
tell him whether the subscription buys anything else he wants**, and it does not
pretend to; what it can say is what this tool has taken, and it has taken almost
nothing.

**The third row is not an error.** Nine benchmark runs were each a Scribe pass
*and* a Gemini correction billed as one figure. Splitting them on screen would be
inventing a number, so they get a row named for what they are.

**A payment is matched to an account by the name he typed**, and only when it
plainly says so. One naming neither provider is not forced into a bucket — it
comes back as its own figure and is shown.

---

## 3. What the screen says it cannot know

Three facts, each beside the figure it qualifies rather than collected out of the
way:

> **Framopia's own count, not your invoice**
> — beside the total, from session 115. Measured at **+$1.75, +5.1%** against
> Google's real billing.

> **$19.68 is from before this was recorded**
> — beside *Making his videos*.

> **A video's figure is whichever is larger: what was charged against it, or what
> its own record claims. For anything made before September there is only the
> record, and a record can only count what it saw.**
> — above *What each video cost*.

And a fourth, from Part B, in *What this cannot see*:

> **Anything spent on the other Mac. Each keeps its own record, and the account
> page is the only place the two are added up.**

**Two of the brief's three figures did not reproduce, and I am reporting what I
measured rather than what was carried:**

- **Unattributed is 54.3% ($19.6795), not 45.1%.** I could not derive 45.1% from
  today's ledger by any reading: $18.83 of it is the 165 lines written before the
  fields existed, and $0.85 more is later lines carrying no client. 45.1% would
  need a total of $41.75, which is larger than the ledger has ever been.
- **The per-video understatement is $0.62 across the seven reels the ledger
  knows** — plans claim $16.7988 against $17.4175 — **and $2.08 on the four where
  the plan claims less.** Session 72's $9.44-against-$7.37 for images is not
  reproducible as stated today. The direction of the claim is right and the
  magnitude is smaller.

---

## 4. The screen, before and after

| | before | after |
|---|---|---|
| height | **1443 px** | **1565 px** |
| visible elements | **104** | **129** |
| distinct size/weight settings | **10** | **12** |

It grew, and that is honest: the six payments he had never entered are real rows,
and *Each account* is a new block of 232 px. Without folding it would have been
**2068 px** — the payments table alone went 266 → 546 px once it had payments in
it — so the table was folded behind the panel's one disclosure, its total having
moved to the top. **Nothing was deleted; every figure is one press away.**

**Session 104's type scale was never applied to this screen, and still is not.**
Measured: the sizes on it are **25.5, 17, 14.45, 13.6, 13.26, 12.75, 12.24,
11.9 px** — `em` fractions of a 17 px root, not the panel's six steps on 4 px
sizes (11 / 13 / 15 / 17). The two settings I added are on the scale (13 px/400
and 13 px/600); the other ten are session 70's and predate the rule. **Bringing
the whole screen onto the scale is not done and is named in §11.**

**Session 105's caps were partly applied.** The banner was two fixed columns,
which wrapped four figures onto two rows and cost 139 px; it is `auto-fit` now, so
it is one row at his width and stacks when the panel is narrow.

---

## 5. Every step of the document, walked

The rehearsal clone at `~/Documents/framopia-second-machine-rehearsal/from-github-2/`
was at **`cf152bb`, session 92's report — 61 commits behind.** Pulled to
`a9b4dc9` and walked literally.

| § | what it does now |
|---|---|
| **1. The repository** | Pulls clean. **985 tracked files** (the document said 929), **66 MB** of files and **50 MB** of `.git`, including the 15 product pictures at 26 MB. |
| **2. Homebrew** | `Homebrew 6.0.22` — the document's own last reading. |
| **3. Node** | `.nvmrc` says `24`; `node --version` is `v24.14.1`. Matches. |
| **4. Dependencies** | `npm install` exit 0. **165 entries, 168 MB** — exactly what the document states. |
| **5. ffmpeg** | `ffmpeg version 8.0.1`, as written. |
| **6. The picture tools** | `verify-models.sh` reports `birefnet-general ok` and `selfie-multiclass-256x256 ok`. |
| **7. The fonts** | All three families present on this Mac. |
| **8. Let After Effects write files** | **Not checkable this session — After Effects was not open.** The doctor reports it as *could not be determined*, which is the honest answer and not a pass. |
| **9. The panel** | **Deliberately not run.** `npm run panel:install` against a rehearsal copy is forbidden by this session's own rules — it would re-point After Effects at the clone. |
| **10. The API keys** | **This is where it stops.** |
| 11–14 | Not reached. |

### Where it stops, and what the next step would have been

**§10, the API keys.** `npm run doctor` on the clone:

```
15 present, 6 absent, 3 could not be determined, of 24

this machine cannot run the pipeline until these are fixed:
  the API keys, by presence and shape — open .local/config.json and replace the
    two placeholder values with your own keys
  the source reels, which are not in git — copy the five reels into
    "my files/test videos/"
```

The clone's `.local/config.json` holds placeholders — **22 and 17 characters**,
against a real Google key's ~39. I checked the field names and lengths and read
no value; **no real key was written into the clone, and none ever should be.**

**The next step would have been §11, the Edit Plans** — copying five files into
`my files/test videos/`. Everything from §11 to §14 is untested by this walk.

**Mohamed's partner is the thing that changes this.** He uses the same two
accounts, so §10 for him is not "sign up" but "open the account page and type
today's key in" — which is the one step this walk cannot stand in for.

---

## 6. What a clone gives, and what he must be handed

### What a clone gives him — 985 files, 66 MB

| | files | size |
|---|---|---|
| `assets/` (incl. 15 product pictures at 26 MB) | 25 | **52 MB** |
| `reports/` | 231 | 4.7 MB |
| `service/` | 309 | 2.8 MB |
| `panel/` | 94 | 1.7 MB |
| `benchmarks/` | 103 | 1.4 MB |
| `core/` | 117 | 1.0 MB |
| **`templates/`** (incl. `library.aep`, 540 KB) | 4 | 612 KB |
| `docs/` | 17 | 556 KB |
| `tools/` | 53 | 476 KB |
| `handoffs/` | 12 | 220 KB |
| `scripts/` | 10 | 52 KB |
| **`modes/`** — both clients | 3 | 20 KB |

The template library and both client files come with the clone. So does every
document, every report and 15 of his 22 product pictures.

### What Mohamed must hand him

| | size | where it comes from |
|---|---|---|
| **The two API keys** | — | **The account pages, typed in. Never a message.** §10 already says this in full and it did not need changing. |
| **The five Edit Plans** | **308 KB** | `my files/test videos/*.editplan.json`, gitignored with the footage they describe. Small enough to send. |
| **The seven newer product pictures** | **8.9 MB** | `assets/client-pictures/dr-loubna-kfafi/pic016–pic022`, untracked on his machine — the clone has 15 of 22. |
| His edit to `modes/dr-loubna-kfafi.json` | — | Uncommitted on his machine, so a clone gets the older version. |
| *Optionally* the five source reels | **12 GB** | Only for the optional last section. **Not needed.** |
| *Optionally* the caches | ~2.1 GB | Makes re-work free rather than possible. |

**The 297 KB in the document was stale.** The five plans measure **308 KB**
today; the heading and the table said 297 while six other places in the same
document already said 308. Corrected, with a line saying why it moved.

**And a figure I nearly got wrong.** I first wrote 1.1 MB into that heading —
which is all *nineteen* plans on his disk, including his clients'. The five the
partner needs are 308 KB; his clients' fourteen are 812 KB and are no part of
setting a Mac up. Counted before writing, on the second attempt.

---

## 7. Shared billing, measured

**Each machine's cost screen sees only that machine's spending. Confirmed by
measurement, not assumed:**

```
.gitignore:1:.local/        .local/costs.jsonl   -> ignored by line 1
tracked by git:             0 files
his ledger:                 294 lines, $36.2496
the rehearsal clone's:      no file at all
```

The clone has been through a full `npm install` and a full gate run and still has
no ledger, because only a billable call creates one. **So the partner's spending
will never appear in Mohamed's total, and neither figure is wrong — neither is
the total.** That is in `docs/SECOND_MACHINE.md` §10a at length, and now in one
line on the money screen.

### What the partner sees when he first tries to make pictures

```
  paid to Google        $40.00
  Moroccan VAT          -$10.45
  credit it bought       $29.55
  Google has charged    -$34.44
  left                   $-4.89
```

**There is nothing left to spend.** The first press of *Make the subtitles* or
*Make the pictures* will stop, and the panel will say — session 113's sentence,
already built and tested:

> The paid service turned it away because the account has no credit left. Nothing
> was charged and nothing already paid for is lost. It will keep refusing until
> the account has credit again.

The document now says this before he meets it, and says the two things that
follow from it: **it is not his setup being wrong**, and **building still works**,
because building calls nothing.

---

## 8. The three things most likely to stop him

Re-measured today, not carried. **Running out of disk was first and is not any
more** — the doctor reports 32.8 GB free and passes it — so it moves to third and
the two the doctor actually named take its place.

**1. He has not put his own keys in yet.** He sees:

```
  MISS  the API keys, by presence and shape
        googleApiKey is still the example's placeholder, not a key; …
        fix: open .local/config.json and replace the two placeholder values
```

**What to do:** §10. Off the account page, signed in, typed in. Never a message.

**2. His first `npm run check` fails, in large numbers — 102 today, not the 98
recorded.** Measured on the clone: **2 in core, 94 in the service, 6 in the
panel**, benchmarks clean. He sees:

```
   × the hand-made reference declaration > every declared reference is on this disk
 FAIL  src/ledger-read.test.ts [ src/ledger-read.test.ts ]
Error: ENOENT: no such file or directory, open '.../.local/costs.jsonl'
```

**What to do: nothing.** It is our gate on our machine. One of the 102 is not a
failing test but a whole file that will not load, because it reads the ledger at
the top rather than inside a test — **ours to fix, and not fixed this session.**

**3. The panel shows the wrong build after his first `git pull`.** Unchanged and
still right: pulling does not rebuild the panel, and it will happen every time.

---

## 9. The flaking test

**Fixed, and the bound was the right thing to move.**

`image-view.test.ts > clears the choice and the override together` timed out at
the 5,000 ms default during session 115's gate and forced a second run. Measured
unloaded: **991 ms**, the slowest in the file — it copies an 88 KB Edit Plan and
then chooses and unchooses a candidate, two full read-validate-write cycles.

A default leaving five times the unloaded cost is not margin when `check` runs
five vitest projects and pytest at once, which is exactly when it failed. All
three describes in the file now carry **15,000 ms**, named `A_REAL_PLAN_EDIT`.

**The work was not reduced.** The work is the point — these prove a real plan
survives a real edit. A hang still fails, ten seconds later than before.

**This session's gate ran once and passed.**

---

## 10. What held

| | before | now |
|---|---|---|
| `sora-3`, `sora-4`, `test` through `dryRun`/`stepsFor` | session 114's reading | **IDENTICAL, field by field** |
| golden | 17,174 fields | **NOT RUN — see below** |
| the three screens' heights | session 114 | unchanged; the money screen is an overlay and is measured in §4 |

**Golden was not run, and this is not a pass being implied.** After Effects was
not running at the start of this session, was not running at the end, and
launching it is forbidden by the standing rules. Golden needs it. Every other
gate ran. **The last golden reading stands from session 114: PASS, 4 of 4,
17,174 fields** — and it is carried, not measured, which is exactly the thing
this project says not to do, so it is flagged here rather than folded into a
table of green ticks.

Nothing in this session touched the build, the templates, placement or any
figure a reel is made from; the changes are the money screen, the ledger
reader's provider split, one test's timeout and a document.

---

## 11. What I am least sure about, and what remains

**The two ElevenLabs payment dates are mine.** The brief gave amounts and no
dates. They are on his financial record now and each has a Remove control; if
the subscription renews on a different day, both rows are wrong by a few days and
nothing downstream reads the date except the display order.

**The 45.1% could not be reproduced and I do not know what it was.** I measured
54.3% three ways and report that. If session 68's figure counted something else,
the difference is unexplained rather than resolved.

**The money screen is still not on session 104's type scale.** Ten of its twelve
settings are `em` fractions from session 70. Putting it on the scale means
touching every block on it and I did not have the session for it after Part B.

**The walk did not reach §11 to §14.** Everything about the Edit Plans, the saved
work, the two local measurements and *Check everything* is described by the
document and untested by this walk. §9 was skipped deliberately and §8 could not
be checked with After Effects closed.

**A whole test file fails to load on a fresh machine** — `ledger-read.test.ts`
reads the ledger at module scope. It is one of the 102 and it is ours; naming it
is all this session did about it.

**Golden is carried, not measured.**

---

## 12. Measured

**Gate.** `npm run check`, run alone on `ae43948`, allowed to finish, **once**:
**exit 0**, `check: PASS`.

```
core        846 passed (846)
service    1637 passed (1637)
benchmarks  173 passed (173)
panel       469 passed | 2 skipped (471)
pytest      149 passed in 11.60s
```

**Golden.** Not run; After Effects was not open. §10.

**Test-name arithmetic**, against `1e2cf7e`:

```
panel:    418 -> 422  (+4)
core:     777 -> 777
service: 1590 -> 1590
```

Added, all in the new `money-shape.browser.test.ts`: *says how tall it is and how
much is on it*; *puts what he paid, what he spent and what it went on at the
top*; *shows what each account was paid and what it has used*; *counts the type
settings on it, against the six the panel has*.

**Nothing removed and nothing renamed.** One test — *keeps money paid in apart
from credit* — had its wording assumption rewritten: it asserted the empty-state
heading, which is only true when no payments are entered. The rule it protects is
untouched and now asserted under both states.

Panel 465 → 469 is +4 names exactly.

**Five panel runs**, each exit 0:

```
run 1  exit 0   469 passed | 2 skipped   373.89s
run 2  exit 0   469 passed | 2 skipped   373.65s
run 3  exit 0   469 passed | 2 skipped   373.64s
run 4  exit 0   469 passed | 2 skipped   376.83s
run 5  exit 0   469 passed | 2 skipped   371.99s
```

**A 4.8 s spread across five runs**, the tightest this suite has measured —
session 114's five spanned 29 s. Session 115's figures were 401, 375, 372, 374,
381 s, so it has not moved: the four tests added are browser tests but short
ones, and the timeout raised in §9 costs nothing unless something hangs.

**Bundle.** `npm run panel:build` → `panel/dist/panel.js`, **280,423
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
| `.local/payments.json` | **did not exist** | **6 payments, $52.00** — §1 |
| `assets/client-pictures/` | 24 files, 35M | **24 files, 35M** |
| his 22 photographs | — | **byte-identical, dimensions identical** |
| After Effects | **0 running** | **0 running** |
| `aerender` | 0 | **0** |
| Framopia service listening | pid 21517 | **pid 21517** |
| extensions folder | one symlink | **one symlink, unchanged** |

**After Effects was never running**, so none was launched, none was quit and no
project was saved — and golden could not run, §10. **The service Mohamed started
was not stopped**: pid 21517 at both ends, unchanged.

The one addition to `.local/` is `payments.json`, which §1 and §13 both name. The
working tree at the end holds `modes/dr-loubna-kfafi.json` modified, his seven
untracked photographs and `assets/client-pictures/k2-syndicalia/` — all there
before this session — and this report.

**The rehearsal clone** was pulled from `cf152bb` to `a9b4dc9` and had
`npm install` and `npm run check` run in it. Nothing was written into it beyond
that: no key, no plan, no photograph, and `npm run panel:install` was never run.

---

## 13. Money

**No ledger line was added.** Expected none, spent $0.00.

- 294 records at the start, sha256 `77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0`.
- 294 records at the end, the same sha256.
- Nothing this session could bill: the money screen reads the ledger, the
  provider split is arithmetic over lines already written, the second-machine
  walk made no API call, and the clone has no key and no credit to spend.
- **`.local/payments.json` was created**, holding the six payments §1 lists. A
  payment is not a spend and is not a ledger line — it is his own entry about a
  bank, corrigible from the screen.
