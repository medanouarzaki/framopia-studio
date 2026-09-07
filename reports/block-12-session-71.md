Status: OK

# Block 12 session 71 — money in, and two sources that now check each other

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — at the start, after both `npm run check` runs, after `npm run golden`,
and at the end.** Golden did not move: 17,174 fields, 4 of 4.

**One gate failed and is reported in §7 rather than hidden.** `npm run check`
never rebuilds `service/dist`, so a rename in `core` left the compiled service
importing a symbol that no longer existed, and only the five integration tests
saw it.

---

## 1. Where payments are stored, and how they stay apart from credit

**`.local/payments.json`**, beside `credit.json`, and **never the ledger**.

The ledger is an append-only record of calls this tool made, written at the point
of spend. A payment is a fact about a bank that nothing here can verify, and it
has to be corrigible — an append-only record is not. A test holds every write in
`money.ts` to naming one of its own three files and never `COSTS_PATH`.

**He may remove a payment; he may not remove a ledger line.** The difference is
what each one is: a ledger line is evidence that a call was billed, and a payment
is his own typing. The reply names what went — *"Removed $23.40 to ElevenLabs on
2026-09-08. It was your own note, so nothing else changed."* — so nothing goes
quietly.

**Credit and a payment are different things and the screen never mixes them.**

| | credit | a payment |
|---|---|---|
| what it is | what an account has **left today** | money that went **in on a date** |
| where it lives | the banner, at the top | its own block, *Money you have paid in* |
| do two of them add? | **no** — two readings of the same account | **yes** |

The banner holds *Credit left* and the paid-in block holds no such words; a test
asserts the phrase appears in one and not the other, and that the paid-in block
exists exactly once.

The difference between paid in and spent is labelled **"Subtraction from what you
typed, not a reading of any account"** — the same standing as the credit wording,
which session 46 earned by carrying a balance forward and finding a $0.20 gap it
could not explain.

## 2. The measured gap between the two sources

| | |
|---|---:|
| **the ledger holds** | **$18.832129** |
| — benchmarks and prompt experiments, belonging to no video | $4.502282 |
| — production stages | $14.329847 |
| **the six videos account for** | **$8.733979** |
| **gap** | **$10.098150** |
| of which: production spend no plan claims | **$5.595868** |

The $4.502282 is the same figure session 46 measured from the same stages.

**The $5.59 is reported, not explained away.** By stage:

| stage | ledger | plans claim | unaccounted |
|---|---:|---:|---:|
| images | $9.436246 | $7.371076 | $2.065170 |
| transcription | $2.205013 | $0.289663 | $1.915350 |
| analysis | $1.933828 | $0.815612 | $1.118216 |
| imageSlots | $0.754760 | $0.259092 | $0.495668 |
| **total** | | | **$5.594404** |

That total is computed over every plan; against the six real reels alone it is
$5.595868, the $0.001464 difference being the five scratch plans session 70 stopped
listing. **What is outside any video** is the $4.502282 of benchmarks and prompt
experiments — comparing transcription engines, measuring the orthography rules,
validating a prompt version — none of which was about one client's reel.

**No plan was edited and no `spentUsd` was touched.** This session read.

## 3. The agreement check

**It is directional, and that is the point.** The ledger is written at the point
of spend, so it cannot hold *less* than was really spent on a reel. A gap in the
ledger's favour is expected — experiments, and history. **A plan claiming more
than the ledger ever recorded is a plan asserting money nothing billed**, and
that is shown rather than averaged away.

On the real data: `agrees: true`, `overclaimedUsd: $0.000000`.

Mutating it to average the defect away:

```
 FAIL  src/money.test.ts > the two sources > says so when a plan claims a spend the ledger never recorded
AssertionError: expected true to be false // Object.is equality
- false
+ true
 ❯ src/money.test.ts:243:22
```

Restored byte-identical, green re-verified.

On screen, when it does not agree:

> A video claims $4.00 more than was ever charged. One of the two records is
> wrong and nothing here has changed either.

## 4. What the screen now says it cannot see

> **What this cannot see**
> - Anything spent outside Framopia — a subscription, a tool bought elsewhere.
> - Money you paid into an account, until you add it above.
> - What an account has left today, until you type it at the top.
>
> None of this is broken. It is what a record of this tool's own spending can and
> cannot reach.

A test asserts three items, that the words *error* and *failed* appear nowhere in
it, and that it names no command. Mutating the heading to *"Error: incomplete"*:

```
 FAIL  src/money.browser.test.ts > the money screen > says what it cannot see, and names no command
AssertionError: expected 'error: true' to be 'error: false' // Object.is equality
```

**`leave-the-panel.test.ts` passes unchanged**: nothing added here names a command
and no second exemption was created.

## 5. The suites' own directory, proved by killing a run

**It was two leaks, not one**, and the second only appeared because the first was
fixed and the kill repeated.

**The plans.** A video outside the repository sends its Edit Plan to
`.local/plans/`, where a client's own plans live. `browsedPlansDir()` now reads
`FRAMOPIA_PLANS_DIR`, the way `videoRegistryPath()` beside it already did.

```
BEFORE  plans: 7      → killed mid-run →  AFTER  plans: 7
```

**The clients, which the first fix did not touch.** With the plans fixed, the same
kill still left three scratch clients in `modes/`. The cause: the suite
**hardcodes `path.join(REPO_ROOT, 'modes', …)` and never calls `modePathFor`**, so
making that overridable changed nothing for it. `MODES_DIR` became `modesDir()`
reading `FRAMOPIA_MODES_DIR` — four call sites — and the suite's three client
paths now point at a scratch directory **made while the test file loads**, because
they are module-level constants computed before any hook can run.

**With both in place, killed mid-run:**

```
BEFORE  modes/: dr-loubna-kfafi.json k2-syndicalia.json   plans: 7
--- killed mid-run ---
AFTER   modes/: dr-loubna-kfafi.json k2-syndicalia.json   plans: 7
```

And after a full `npm run check`, both are still exactly that.

**Where a test points, never a special case in production.** `editPlanPathFor` and
`modePathFor` ask a function and learn nothing about tests; with no variable set
both answer what they always answered.

**Nothing quarantined was deleted.** Session 69's three clients and session 70's
five plans are where they were. The three clients my own deliberate kill created
before the second fix went to `.local/quarantine-session71/` — moved, not deleted.

## 6. Every new assertion, red then green

Beyond §3 and §4, both verbatim above:

- **payments are not ledger lines** — every write in `money.ts` must name
  `CREDIT_PATH`, `CAP_PATH` or `PAYMENTS_PATH`. Mutated to write `COSTS_PATH`:

```
 FAIL  src/money.test.ts > the money view > never writes to the ledger
+ Received: "writeFileSync(COSTS_PATH, `${JSON.stringify(payments, null, 2)}\n`, 'utf8');"
```

- **a payment is an amount, a day and an account** — zero, negative, *"yesterday"*
  and a blank account are each refused by name.
- **a payment that is not there is named** rather than silently doing nothing.

All restored byte-identical from saved copies, green re-verified between each.
**No panel assertion reads the whole screen's `textContent`** and none holds a live
Playwright handle.

## 7. Gates, arithmetic and fingerprints

**The first `npm run check` after committing failed, exit 1, five service tests.**

```
 FAIL  src/spawn.integration.test.ts > spawns it with a bare node binary and reaches a healthy /health
SyntaxError: The requested module '@framopia/core' does not provide an export named 'MODES_DIR'
```

**`npm run check` runs `build:core` and never rebuilds `service/dist`.** So
typecheck, lint and every unit test passed against source while the compiled
service — which the five integration tests actually spawn — still imported the
symbol my rename removed. It is the same class as the stale panel bundle of
sessions 65 to 67: an artefact the gate executes but does not build. Rebuilding
`service/dist` and re-running passed whole. **This is a gap in the gate, not in
the change, and it is left as a finding.**

**`npm run check`: PASS**, exit 0, run after committing. **`npm run golden`: PASS**
— 4415 + 4280 + 3709 + 4770 = **17,174**, field for field.

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

| suite | passed | skipped | total | session 70 |
|---|---|---|---|---|
| core | **813** | 0 | **813** | 813 — unchanged |
| service | **1416** | 1 | **1417** | 1410 passed |
| benchmarks | 173 | 0 | 173 | 173 |
| panel | **269** | 2 | **271** | 266 passed, 268 total |

**+6 in service**, all in `money.test.ts`, read by name:

1. `money paid in > is not a ledger line, and does not live in the ledger`
2. `… > refuses what is not a payment`
3. `… > names a payment that could not be found rather than doing nothing`
4. `the two sources > separates what belongs to no video from what no plan claims`
5. `… > says so when a plan claims a spend the ledger never recorded`
6. `… > agrees on the real ledger and the real plans`

**+3 in panel**, all in `money.browser.test.ts`:

7. `the money screen > keeps money paid in apart from credit`
8. `the money screen > says where the total comes from, line by line`
9. `the money screen > says what it cannot see, and names no command`

1410 + 6 = 1416 and 266 + 3 = 269. Both close exactly, and **core did not move**.

**Five panel runs, each with its exit status:** 269 passed, 2 skipped (271),
exit 0 — five times.

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

The ledger was re-checked after **both** `npm run check` runs and after
`npm run golden`: 165 lines, `786497a5f371d179…`, unchanged at every one.

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**`.local/` at the start:** `audio` 27 · `bench-audio` 5 · `build` 70 · `cache`
159 · `cv` 1759 · `deleted-clients` 0 · `doctor` 1 · `evidence` 3 ·
`ground-truth` 10 · `plans` 66 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `quarantine-session69` 3
· `transcripts` 1. At the end, one directory is new: **`quarantine-session71` 3**,
holding the scratch clients the deliberate kill created before the second fix.
**No `payments.json`, `credit.json` or `cap.json` was written** — none was set,
and the refusal tests never reached a write.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 8. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after both
gate runs, after golden, and at the end. Nothing here could bill: a file of his
own typing, a subtraction, and where a test points.
