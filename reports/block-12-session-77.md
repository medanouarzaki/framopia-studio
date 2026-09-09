# Block 12, session 77 — check the notice works on the real clients

## The brief's premise is false, and that is the session's main finding

The brief says Mohamed **has now declared a video folder for both clients,
through the panel**, and that **both client files will have changed**, so their
sha256 will no longer match session 76's figures.

Neither is true. Measured at the start of this session and again at the end:

| file | version | `videoFolder` | sha256 | modified |
|---|---|---|---|---|
| `modes/dr-loubna-kfafi.json` | 1 | **not set** | `f60749f5629b2ced…` | 2026-09-04 00:05:37 |
| `modes/k2-syndicalia.json` | 12 | **not set** | `c600905c5e36ecbc…` | 2026-08-31 19:33:57 |

Both sha256 are **identical to the ones session 76 asserted**. `git status
--porcelain modes/` is empty. No client file anywhere on this machine — including
`.local/deleted-clients/` — carries a `videoFolder` key at all. The two mtimes
predate this session by five and nine days.

So whatever was done in the panel, **it did not reach either client file**. The
declaration either was not saved, was made somewhere this repository cannot see,
or was not made. This session could not tell which, and did not write to a
client file to find out.

## 1. The rule over every plan, for real

Ran `whoseVideo`/`mismatchedClient` over all 12 plans in `.local/plans/`,
against the two real clients as they are on disk.

**0 of 12 warn. All 12 answer "cannot tell".**

That includes `sora-995f2d27`, which the brief expected to warn. The reason is
not a defect in the rule: **the rule rests entirely on a client having declared
a folder**, and neither has. `whoseVideo` filters clients to those with a
non-empty `videoFolder` before it tests containment, so with no declarations the
holder list is empty for every video and the answer is `null` — no owner, and
therefore no mismatch — for `sora-995f2d27`, for `sora-6a60ced1`, and for the
five corpus reels alike.

The five corpus reels and `sora-6a60ced1` stay silent as required. They stay
silent for the same reason `sora-995f2d27` does, which means **their silence is
not yet evidence the rule is discriminating.** Session 76's unit tests are what
show it discriminates; this run shows only that it says nothing when it knows
nothing, which is the correct behaviour for an undeclared machine.

## 2. What the rule still cannot see

Every video the tool has a record of — 12 in `.local/videos.json` — by where it
sits:

| where | how many |
|---|---|
| inside a client's own folder (Dr Loubna Kfafi) | 2 |
| the corpus, inside this repository (`my files/test videos/`) | 5 |
| the operating system's temporary directory | 5 |

**Yes — a video of Mohamed's can sit outside his client's declared folder and go
unnoticed.** Three places where it happens, all visible in the figures above:

1. **A folder declared too deep.** Dr Loubna's two videos are both under
   `…/Clients/Dr Loubna Kfafi/`, but in two unrelated sub-trees:
   `Framopia Studio Inputs/Footages/` and
   `September Content/Exports/Work in Progress/`. A folder declared at either
   sub-tree — the natural thing to pick when browsing to the footage you are
   working on — leaves the other one owned by nobody. Only a declaration at the
   client root covers both, and nothing tells him that.

2. **Footage that never lived in the client's tree.** A reel handed over on a
   different drive, downloaded, or exported to the Desktop is outside any
   declared folder by construction. The five corpus reels are exactly this shape:
   they sit inside the repository, and no client folder will ever contain them.

3. **A client with no declaration at all** — which is the state of both real
   clients today. Such a client can never be named as an owner, so a video of
   theirs attached to the wrong client is silently built in the wrong brand,
   which is the session-75 failure the rule exists to catch.

**No second rule was added.** This is reported, not fixed, per the brief.

## 3. The notice on the screen, from the real rule

`panel/src/wrong-client.browser.test.ts` — six tests, a real Chromium, the real
bundle.

**The real client files were not written to.** A browser test cannot make the
service produce a mismatch today, because neither client declares a folder. So
the harness's `realMismatch()` **loads both real clients from disk and gives Dr
Loubna, in memory only, the folder her footage actually sits in**, then calls
the same `mismatchedClient` the service calls. Nothing is written to a client
file; both are byte identical at the end of the session, and the table above is
the proof. The names in the sentence are the clients' real names, read from
their real files.

What it draws, produced by the rule and asserted character for character:

> This video is in Dr Loubna Kfafi's folder, but it is set up as K2 Syndicalia.
> It will be built in K2 Syndicalia's colours and type unless you change it.

> Use Dr Loubna Kfafi instead — their colours, their type, and the shadow behind
> the words. Nothing already built changes, and the old setting is kept.

The six tests: the mismatch exists at all; the sentence is on screen with both
names; the offer says what pressing it changes; every run button stays pressable;
no `/clients/attach` request is made until it is pressed; and the notice sits
above the buttons that spend.

Two things this test does that earlier screen tests got wrong:

- **The mismatch's existence is asserted, not used as a `skipIf`.** With a skip
  condition, `whoseVideo` breaking would have turned the whole file green-by-
  absence. Session 73's rule.
- **Both sentences are read with `checkVisibility()`.** Session 69 shipped a
  screen test that passed over hidden text because `textContent` returns it.

### Mutations

Saved bytes first, restored from the saved copy, never with git.

| mutation | result |
|---|---|
| `.wrongclient` given `hidden` | **6 passed — invalid mutation.** `.wrongclient { display: grid }` overrides the UA `[hidden]` rule, so nothing was hidden. Not a blind test; a mutation that did not mutate. |
| `WrongClient` returns `null` | **5 red** |
| the rule never finds an owner (`whoseVideo` → `null`) | **4 red**, the existence assertion first |
| "Nothing already built changes" dropped from the offer | **1 red** |

Both mutated files restored to their saved sha256 (`eba32269…`, `9e870280…`),
`git status` clean.

## 4. Close-out

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4 reels, **17,174 fields**, ledger 165 lines `786497a5f371d179` |
| `npm run check` | **exit 0** |
| suites | core **823** · service **1428** · benchmarks **173** · panel **282 + 2 skipped** |
| panel suite ×5 | exit 0 every time, **282 passed + 2 skipped**, identical five times |

Panel went 276 → 282: the six tests added here, and no flake across five runs.

## What is open

- **Neither real client declares a video folder**, so the rule is inert on this
  machine. It is proved correct and proved to reach the screen, but it will
  warn about nothing until a folder is declared and **lands in the client file**.
  Whether the panel's declaration saves at all is untested by this session.
- **A folder declared below the client root leaves sibling footage unowned**, and
  nothing warns him. Reported only, not fixed.
- A `hidden` attribute does not hide the notice, because its `display` is set in
  the stylesheet. Nothing sets `hidden` on it today; noted so a future session
  does not mistake it for a working switch.
