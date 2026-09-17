Status: OK

# Block 15, session 118 — the walk finished, and the handover written down

**Every rehearsal since session 55 stopped at §10**, the API keys, because a real
key must never go into a rehearsal copy. Mohamed's partner uses his accounts, so
this session put a real key in, walked the rest, and took it out again.

**The last third of the document has now been executed.** It works. The one step
that cannot be rehearsed is named and still unexercised.

---

## 1. Every step past §10, walked

The clone at `~/Documents/framopia-second-machine-rehearsal/from-github-2/` was
pulled from `a9b4dc9` to **`e70aba2`**, session 117's report — the commit this
session started from.

### §10 — the API keys

Both real keys copied from his `.local/config.json` into the clone's own, by a
script that printed only lengths and hashes:

```
  googleApiKey:     his is 53 chars, sha256 23ed704d…; clone had 17 chars
  elevenLabsApiKey: his is 51 chars, sha256 24b816fd…; clone had 22 chars
```

**The doctor moved for the first time in the project's history:**

| | session 116 | now |
|---|---|---|
| present | 15 | **19** |
| absent | 6 | **5** |
| could not be determined | 3 | **0** |
| blockers | the keys **and** the reels | **the reels alone** |

The three that could not be determined — After Effects, its scripting setting,
the fonts — all resolved because After Effects is open. **The keys check passes
on a real key**, which is the thing session 116 could only describe.

### §11 — the Edit Plans

Five files copied into `my files/test videos/`:

```
  ground truth.editplan.json   60051 bytes
  test 1.editplan.json         65977
  test 2.editplan.json         51167
  test 3.editplan.json         39820
  vitasilk.editplan.json       86681
  total: 308 KB
```

**308 KB confirmed**, exactly as the document says.

### §12 — the saved work

Copied as written: `.local/cache/` and `my files/test videos/cutouts/`.

**One figure in the document was wrong and is corrected.** It said the cache is
**53 MB**; it is **362 MB**. That is a seven-fold understatement of the thing it
tells him to copy, and 362 MB is a different proposition from 53 MB when it has
to travel. The cut-outs it called 53 MB are **51 MB**, which is close enough to
leave.

### §13 — the two local measurements

Nothing to do, as written. The doctor reports the watermark facts and the
loudness records absent with the note *"expected absent on a machine that has
never run the pipeline"*. Confirmed on the clone.

### §14 — check everything

Ran. §3 below.

### The key, afterwards

Restored to the placeholders it had, byte for byte — the same sha256 prefixes as
before, `e43b7a742e44` and `2397997da350`. Then grepped for the literal key:

```
    googleApiKey in the clone:  0 files
    googleApiKey in docs:       0 files
    googleApiKey in reports:    0 files
    googleApiKey in panel/src:  0 files
    elevenLabsApiKey — the same four, 0 files
```

`.local/` is ignored at line 1 of the clone's `.gitignore`, and the clone's
`git status` showed nothing but a stray doctor report throughout. **The key is in
no file this session wrote, no commit, and not in this report.**

---

## 2. What the partner sees with nothing set up

Measured by driving a panel against a service that answers and holds nothing —
no videos, no plans, no client, no spending.

**Choose:**

> Client — **No clients set up yet** · Set up a new client… · Just this video…
> **Start by setting one up — their name, their colours, and the folder their
> videos are in.**
> Video — **No videos found** · Refresh · Browse…

**Make:**

> This video — Make this video — **Pick a video.**
> Make several videos — Add videos here and they will be made one after another,
> without you watching. The compositions are left for you to build yourself.
> **Choose a client first.**
> Cost — See everything spent — **$0.00 so far**

**Build:**

> **Choose a client and a video above, and this will say what the composition
> will contain.**

**Session 100's claim is confirmed**: the first screen says what to do first, in
those words. Nothing shows `undefined`, nothing names a command, nothing threw —
the test asserts all three.

**Can he create a client and pick a video with nothing set up? Yes, both.** The
client picker offers *Set up a new client…* with none saved, and the video picker
offers **Browse…**, so a video can be opened before any client folder exists.

**One caution about that measurement.** My first fixture had no file chooser, and
the panel correctly said *"This copy of After Effects offers no file dialog, so
videos can only come from a client's folder."* That is true of a host without a
dialog and is **not** what his partner meets inside After Effects. Stubbing the
chooser is what made this measure his first day rather than my harness — and
without it I would have reported a fixture artefact as a finding.

---

## 3. The 102 failures, grouped

**They are 70 now, not 102**, because §11 and §12 were walked: the Edit Plans and
the cache took the service's failures from 94 to 62. **The document's own steps
do that**, which is worth him knowing.

| | core | service | benchmarks | panel | total |
|---|---|---|---|---|---|
| session 116, before §11 | 2 | 94 | 0 | 6 | **102** |
| now, after §11 and §12 | 2 | 62 | 0 | 6 | **70** |

Every one of the 70 paired with its reason and grouped by root cause:

| | cause |
|---|---|
| **39** | **the five source videos are not on this machine** — 35 say so outright, 4 more expected a different error and met the catalogue's first |
| **18** | **no cost ledger** — the money screen, the ceiling's stage sums, the two-sources agreement |
| **5** | **the pipeline has never run here** — no sampled frames, no masks, no watermark facts |
| **4** | **the hand-made reference files**, which are gitignored and only exist on his Mac |
| **2** | **his seven newest photographs** — `expected 15 to be 22`, the clone having 15 of 22 |
| **2** | **his uncommitted edit to `modes/dr-loubna-kfafi.json`** |

**Nothing is unexplained, and nothing is a code fault.** Every failure traces to
something this machine does not have.

**Are the causes the same as session 65's?** No. Session 65 measured 230 service
failures and traced every one to a missing Edit Plan. Here the plans are present
— I copied them at §11 — so what is left is the videos themselves, the ledger,
and three smaller absences. The shape has moved down the chain as each step was
walked.

**What he should expect to see**, in one line, now in the document: *about
seventy tests fail on your first run and every one of them is a file this Mac
does not have; `npm run doctor` is the one that describes your machine.*

---

## 4. What Mohamed hands him, in order

**Now the first section of `docs/SECOND_MACHINE.md`**, before the steps, because
it is the first thing either of them reads. Re-measured today.

| # | what | size | where |
|---|---|---|---|
| **1** | **The two API keys** | — | The account pages, signed in, typed in by him. Never a message. |
| **2** | **The five Edit Plans** | **308 KB** | `my files/test videos/*.editplan.json`, gitignored |
| 3 | The saved answers from the paid services | **362 MB** | `.local/cache/` — optional; saves money, not correctness |
| 4 | The cut-out pictures | **51 MB** | `my files/test videos/cutouts/` — optional |
| 5 | His seven newest photographs | **8.9 MB** | `pic016`–`pic022`, not committed; the clone has 15 of 22 |
| 6 | The five source videos | **12 GB** | Only to make a video from scratch |

**Everything else arrives with `git clone`: 987 files, 66 MB** — the template
library, both client files, every document, 15 product pictures. Session 116
measured 985; two reports have been added since.

**Only 1 and 2 are needed to start.**

**What he can do the moment he is set up**, with the keys and the plans and no
video: build a composition from any of the five plans; create a client, correct
their details, set their colours, give them photographs, remove them; read and
edit the words, the emphasis and the pictures; see what each reel cost.

**What he cannot do**: make a *new* video without item 6 — the doctor names it as
its one remaining blocker — and spend anything at all today, with or without it.

---

## 5. Shared billing, and the first press that spends

**Each machine's cost screen sees only its own spending.** Re-confirmed: `.local/`
ignored at line 1, and **the clone has no `costs.jsonl` at all** after a full
`npm install`, a full gate run and a doctor run with real keys in place. It never
billed anything, and it never touched his ledger — 294 lines and the same sha256
at both ends.

**The Google prepayment is gone**: $40 in, $10.45 of it Moroccan VAT, so $29.55
of credit against $34.44 charged.

**What he sees on his first press that spends** — taken from the real refusal the
service recorded on 2026-09-14, not imagined:

```
analysis keywords failed: {"error":{"code":429,"message":"Your prepayment credits
are depleted. Please go to AI Studio at https://ai.studio/projects to manage your
project and billing…","status":"RESOURCE_EXHAUSTED"}}     retryable: false
```

and what the panel makes of it:

> **The paid service turned it away because the account has no credit left.
> Nothing was charged and nothing already paid for is lost. It will keep refusing
> until the account has credit again.**

One line in the document — §10a's *What you will see first, today*, added session
116. One line on the money screen — *"Anything spent on the other Mac. Each keeps
its own record, and the account page is the only place the two are added up."*
Both confirmed present; neither duplicated.

---

## 6. `npm run panel:install`, unexercised

**Not run, deliberately.** Read instead, in `panel/scripts/install.mjs`:

- `rmSync(LINK)` then `symlinkSync(PANEL, LINK)` on
  `~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio` —
  **it removes the existing symlink and points it at whatever repository it is
  run from.** That symlink currently points at Mohamed's working copy.
- `defaults write <domain> PlayerDebugMode 1`, which is what lets After Effects
  load a panel Adobe has not signed.

Running it in the clone would have repointed his After Effects at a rehearsal
copy. **It is the one step no rehearsal can perform**, and it stays unexercised
here as in every session before. The extensions symlink is unchanged at both
ends.

---

## 7. What held

| | expected | measured |
|---|---|---|
| golden | 17,174 fields, 4 of 4 | **PASS, 4 of 4, 17,174 identical** |
| `sora-3`, `sora-4`, `test` | identical | **IDENTICAL, field by field** |
| the type scale | 16 settings | **16**, the sweep reaching all of them since session 117 |
| every screen | inside 900 px | **all eleven inside 900 px**, every figure unchanged |
| control cells | 84 controls, 168 cells | **84 controls across 18 states**, state for state |
| his 22 photographs | byte-identical | **byte-identical, dimensions identical** |

---

## 8. What I am least sure about, and what remains unwalked

**`npm run panel:install` has still never been run by anyone rehearsing**, and it
is the step between a working checkout and a panel his partner can see. Its two
actions are read and understood; whether they work on a Mac that has never had
the panel is not established, and no rehearsal can establish it without
displacing Mohamed's own.

**Nor has the panel been loaded inside After Effects from the clone.** §2 drove
the built bundle in a browser, which is how every panel test in this project
works and is not the same as After Effects loading it.

**The 70 failures are grouped by reading each reason**, and four of the six
groups are single-cause and obvious. The two smallest — his photographs and his
uncommitted client edit — are inferred from the shape of the assertion rather
than from running them down individually.

**The empty states were measured against a stubbed service, not the clone's own.**
Starting the clone's service would have put a second Framopia service on this
machine, which session 79 built a guard against; I chose not to.

**I do not know whether 362 MB of cache is worth sending.** It is optional and it
saves money, and which of those wins is his call, not a measurement.

---

## 9. Measured

**Gate.** `npm run check`, run alone on `d2282fc`, allowed to finish: **exit 0**,
`check: PASS`.

```
core        846 passed (846)
service    1637 passed (1637)
benchmarks  173 passed (173)
panel       472 passed | 2 skipped (474)
pytest      149 passed in 13.54s
```

**Golden.** PASS, 4 of 4: 4415 + 4280 + 3709 + 4770 = **17,174 fields identical**.
After Effects 26.0x67, 1198 font names, driven through `DoScript` into the
instance that was already open. Ledger read by golden itself: 294 lines,
`77eaf6c9ca6b633e`.

**Test-name arithmetic**, against `e70aba2`:

```
panel:    422 -> 425  (+3)
core:     777 -> 777
service: 1590 -> 1590
```

Added, all in the new `a-fresh-machine.browser.test.ts`: *says what to do first,
on all three screens, and never crashes*; *offers him a way to make a client with
none on the list*; *says the video list is empty rather than looking broken*.
**Nothing removed, nothing renamed.** Panel 469 → 472 is +3 exactly.

**Five panel runs**, each exit 0:

```
run 1  exit 0   472 passed | 2 skipped   388.51s
run 2  exit 0   472 passed | 2 skipped   378.33s
run 3  exit 0   472 passed | 2 skipped   386.88s
run 4  exit 0   472 passed | 2 skipped   379.97s
run 5  exit 0   472 passed | 2 skipped   387.12s
```

A 10.2 s spread. Session 117's five were 367 to 380 s, so it is about 8 s
slower for three added browser tests — in proportion and not flakier.

**Bundle.** `npm run panel:build` → `panel/dist/panel.js`, **280,490
bytes**. Symlink intact and unchanged:

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
| `.local/queues/` | 0 | **0** |
| `.local/quarantine-session114/` | 4 | **4** |
| `.local/payments.json` | 6 entries | **6 entries** |
| `assets/client-pictures/` | 24 files, 35M | **24 files, 35M** |
| his 22 photographs | — | **byte-identical, dimensions identical** |
| After Effects | 1, pid 66090 | **1, pid 66090** |
| `aerender` | 0 | **0** |
| Framopia service listening | pid 21517 | **pid 21517** |
| extensions folder | one symlink | **one symlink, unchanged** |
| the clone's own ledger | none | **none** |

**After Effects has the same pid at both ends** — golden drove the instance that
was already open, through `DoScript` only, and no project of his was saved.

**No service was started by this session.** His own (pid 21517) was running at
both ends and was never stopped; the clone's was never started, which is why §2
measured the empty states against a stubbed service rather than a real one.
Session 79's second-service guard was never tested because nothing triggered it.

The clone's `.local/config.json` is back to its placeholders; its `git status`
shows only the stray doctor report it had before this session. The working tree
here holds `modes/dr-loubna-kfafi.json` modified, his seven untracked
photographs and `assets/client-pictures/k2-syndicalia/` — all there before — and
this report.

---

## 10. Money

**No ledger line was added.** Expected none, spent $0.00.

- 294 records at the start, sha256 `77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0`.
- 294 records at the end, the same sha256.
- `npm run golden` read it itself and printed `294 lines, 77eaf6c9ca6b633e`.
- **The clone has no ledger of its own either**, after `npm install`, a full gate
  and a doctor run with real keys in place. Nothing it did could bill: the doctor
  reads disk and never calls an API, and the gate's suites stub every paid call.
- The real keys were in the clone for the length of one doctor run and one gate
  run, neither of which makes a paid call, and were removed afterwards.
