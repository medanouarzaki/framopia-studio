Status: OK

# Block 12 session 69 — the money screen

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — at the start, after `npm run check`, after `npm run golden`, and at the
end.** Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.

**Two things I got wrong and caught by measuring**: a rounding rule that put the
total $0.000002 out, and a screen test that passed with the thing it tested
deleted. Both are in §6.

---

## 1. The reader, and the proof it cannot write

`core/src/ledger-read.ts` is the whole back end. **No database, no cache, no
index** — session 68 measured 165 lines, and parsing them whole is instant and
would be at a hundred times the size. An index would be a second copy of the
money, and a second copy is a thing that can disagree.

**It is handed text and cannot open a file.** That is the proof: not a rule about
what it does, but the absence of anything it could do it with.

```
 FAIL  src/ledger-read.test.ts > the ledger reader > cannot write, because it imports nothing that can
AssertionError: expected 'node:fs: true' to be 'node:fs: false' // Object.is equality

Expected: "node:fs: false"
Received: "node:fs: true"
```

That is the mutation: giving it `appendFileSync`. A second assertion pins the
shape — `readLedger(text: string)`, never a path, and no mention of `COSTS_PATH`.

**A line it cannot parse is shown, not dropped:**

```
 FAIL  src/ledger-read.test.ts > the ledger reader > shows a line it cannot parse rather than dropping it
AssertionError: expected [] to have a length of 1 but got +0
```

**And an old line is never guessed at.** Mutating the grouping to borrow the
client from a neighbouring line:

```
 FAIL  src/ledger-read.test.ts > the ledger reader > calls a line without a client what it is, and does not guess
AssertionError: expected [ 'k2-syndicalia' ] to deeply equal [ 'before this was recorded', …(1) ]
-   "before this was recorded",
    "k2-syndicalia",
```

`service/src/money.ts` is the only thing that opens the file, and opens it to
read. Mutating it to write the ledger:

```
 FAIL  src/money.test.ts > the money view > never writes to the ledger
+ Received: "export function tidyLedger(text: string): void { writeFileSync(COSTS_PATH, text, 'utf8'); }"
```

All restored byte-identical from saved copies, green re-verified between each.

## 2. The screen, and the real totals it produces

Live from `/money`, against the real ledger — nothing seeded:

```
total       : $18.832129 | exact: true
lines       : 165 | unreadable: 0
unattributed: $18.832129
cap         : {"monthlyUsd":null,"monthSoFarUsd":2.644282}
```

**What each video cost**, from its own plan:

| reel | spent | a second | stages that actually billed |
|---|---:|---:|---|
| sora-995f2d27 | $3.822113 | $0.0943 | analysis, imageSlots, images, transcription |
| sora-6a60ced1 | $1.551460 | $0.1148 | analysis, imageSlots, images, transcription |
| vitasilk | $1.550444 | $0.0603 | images |
| test 1 | $1.220660 | $0.0555 | images |
| test 2 | $0.412818 | $0.0185 | analysis |
| ground truth | $0.176484 | $0.0076 | analysis, imageSlots |

The stage list is there because **four of the six are partial runs** — a reel
that only ever had its pictures made must not read as a whole one.

**Grouping** by day, month, client, video, what it was for, and building against
client work. Client, video and purpose carry a sentence saying they only cover
spending since September, with the amount that cannot be attributed named —
today **$18.83 of $18.83**, because every one of the 165 lines predates session
68's fields. It is a row of its own, marked, never omitted.

**What it never does:** it writes nothing to the ledger, edits nothing, hides no
line, and attributes no old line to a client. A line written in a shape it does
not recognise is counted in the total and said to be there.

## 3. The credit wording

**Never a reading of his account.** Block 10 session 46 carried a balance forward
by subtracting ledger spend and got $2.91 where a later report said $2.71 — a
$0.20 gap the repository could not explain.

Before he enters anything:

> **Credit left — not entered.**
> Framopia cannot see your account. Type what your billing page says.

After he enters it:

> You entered $6.82 on 2026-09-08, and $2.64 has been spent since. **This is that
> subtraction, not a reading of your account.**

The figure and its date are stored in `.local/credit.json`, not in the ledger: a
credit balance is not a payment and has no business in an append-only record of
what was spent.

## 4. The cap, and the proof the button still works

Beside each button that spends, before it is pressed:

> This takes the month to $12.40, past the $10.00 you asked to be warned about.
> **The button still works — this is only so you know.**

**Proved by mutation.** Wiring the cap into a run button's `disabled`:

```
 FAIL  src/cap.test.ts > the monthly cap > is not among the reasons a run button is disabled
Expected: "cap in "disabled={!enabled || !subtitlesDone || (money?.capUsd ?? Infinity) < pictures}": false"
Received: "cap in "disabled={!enabled || !subtitlesDone || (money?.capUsd ?? Infinity) < pictures}": true"
```

The test reads **every** `disabled=` line in `App.tsx` and requires none to
mention money. A rendering test could only show that today's numbers leave the
button alive; this shows no arrangement of numbers could kill it.

The cap defaults to none and is a figure he sets.

### The second rule was not built, and why

The brief allowed a warning for a video costing far more than anything before,
**derived from the history and not from a number chosen today**. Measured:

| reels with any spend | 6 |
| reels with a complete run | **2** |

Both complete runs are the same client's footage, at 13.5 s and 40.5 s, and they
differ 2.5× largely because one is three times longer. **A threshold from two
points is a number chosen today and justified by pointing at an existing reel.**
So only the cap was built, and a test asserts no such rule crept in.

## 5. How he opens it, and what he sees

**No terminal.** On the screen where a video is made, under **Cost**, there is a
button reading **"See everything spent — $18.83 so far"**. Pressing it replaces
the screen with the money view; **Back** returns.

What he sees, from the real ledger: **$18.83 spent since the beginning, 165
charges, from 2026-08-24**; credit *not entered* with a line telling him to type
what his billing page says; the six grouping buttons, opening on **Month** —
2026-08 $16.19, 2026-09 $2.64; the per-video table above; and a cap section
saying no cap is set and that a cap only warns.

## 6. Every new assertion, and two things I got wrong

**The rounding was wrong, and the real total caught it.** My first `sumUsd`
rounded each line to millionths and added those, giving **$18.832131** against
the $18.832129 on record. **77 of the 165 lines carry a `usd` with more than six
decimal places** — `0.13441999999999998` is what the usage figures multiply out
to — so rounding per line discards real precision. Rounding once at the end gives
$18.832129 exactly, and a test pins that figure.

**My first screen test was vacuous, and the mutation is what showed it.** It
asserted `textContent` of the whole screen contained the label, the amount and
the explanation. I then deleted the unattributable table row **and** hid the
explanatory sentence — **and it still passed**: `textContent` returns hidden
text, and the hint alone carried all three strings. That is the shape session 57
spent a session removing. Rewritten to read the table rows and to check the hint
is genuinely visible, the same mutation now fails:

```
 FAIL  src/money.browser.test.ts > the money screen > names what it cannot attribute rather than leaving it out
AssertionError: expected undefined to be '$18.83' // Object.is equality
```

Every panel assertion reads an extracted value. **No live Playwright handle is
held** — session 54 lost a run to vitest serialising one into a diff.

`leave-the-panel.test.ts` passes unchanged, 2 of 2: **no second exemption was
added**, and nothing on the money screen names a command.

## 7. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, **run after committing**, so the generated-case
count belongs to this commit. **No workspace was built while a gate was in
flight.** **`npm run golden`: PASS** — 4415 + 4280 + 3709 + 4770 = **17,174**.

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

| suite | passed | skipped | total | session 68 |
|---|---|---|---|---|
| core | **813** | 0 | **813** | 803 |
| service | **1406** | 1 | **1407** | 1400 passed |
| benchmarks | 173 | 0 | 173 | 173 |
| panel | **263** | 2 | **265** | 254 passed, 256 total |

**Verified by diffing test names against a worktree at session 68's commit
`f4ee700`, not by subtracting totals.**

**+10 in core**, all in the new `ledger-read.test.ts`:

1. `the ledger reader > cannot write, because it imports nothing that can`
2. `… > takes text, not a path, so it has nothing to open`
3. `… > shows a line it cannot parse rather than dropping it`
4. `… > keeps a field it does not recognise instead of discarding it`
5. `… > shows a stage it has no category for under its own name`
6. `… > calls a line without a client what it is, and does not guess`
7. `… > adds up without drifting, rounding once at the end`
8. `the real ledger, read > reconciles to the cent`
9. `… > parses every line`
10. `… > groups the whole total, losing nothing to rounding`

**+6 in service**, all in the new `money.test.ts`: never writes to the ledger ·
opens it only to read · reads the real ledger and reconciles to the cent · says
what it cannot attribute rather than dropping it · says which stages a reel
actually paid for · has no cap and no credit until they are set.

**+9 in panel**, five in `money.browser.test.ts` and four in `cap.test.ts`:
shows what has been spent, to the same figure the ledger holds · says the credit
is not known until he enters it · groups the spending, and every group adds to
the whole · names what it cannot attribute rather than leaving it out · offers a
cap and says it only warns · disables nothing and refuses nothing · is not among
the reasons a run button is disabled · says what the spend takes the month to,
and that the button still works · has no second rule invented from too little
history.

803 + 10 = 813, 1400 + 6 = 1406, 256 + 9 = 265. Each closes exactly.

**Five panel runs, each with its exit status:** 263 passed, 2 skipped (265),
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

The ledger was re-checked **after `npm run check` and again after
`npm run golden`**: 165 lines, `786497a5f371d179…`, unchanged at both.

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**`.local/` directories at the end:** `audio` 27 · `bench-audio` 5 · `build` 70 ·
`cache` 159 · `cv` 1759 · `deleted-clients` 0 · `doctor` 1 · `evidence` 3 ·
`ground-truth` 10 · `plans` 49 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `transcripts` 1 —
unchanged from the start. **No `credit.json` or `cap.json` was written**: neither
was set, and the defaults are none.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 8. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after the
gate, after golden, and at the end. Nothing here could bill: a reader that cannot
write, a screen, and a warning.
