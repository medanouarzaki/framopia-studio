Status: OK

# Block 11 session 65 — the doctor tells the truth, and the partner needs 297 KB

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends. Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.**

**The footage false green is fixed. Looking for a second one found something
worse: the test suite was writing a fabricated charge into the machine's own
cost ledger, and on a fresh machine it stayed there.** That is this session's
most valuable finding and it is §2.

---

## 1. The footage check, before and after, where the drive cannot be seen

Both measured in the rehearsal clone at `from-github-2/framopia-studio`, which
holds no `my files/` directory at all — not simulated on this machine.

**Before**, at `3e1ecd0`:

```
  ok    the source reels, which are not in git
        5 of 5 present; not hashed (--hash-footage does that)
        note: checked against the sha256 in benchmarks/footage.json, which also carries the fetch note saying where the files come from; a reel’s own Edit Plan is the fallback
```

**After**, at `61a0099`, same clone, same empty directory:

```
  MISS  the source reels, which are not in git
        0 of 5 present; not hashed (--hash-footage does that); missing: test-1, test-2, test-3, ground-truth, vitasilk
        note: checked against the sha256 in benchmarks/footage.json, which also carries the fetch note saying where the files come from; a reel’s own Edit Plan is the fallback
        fix: copy the five reels into "my files/test videos/"; benchmarks/footage.json’s fetchNote says where they come from  (unverified remedy)
```

And it is counted absent: the summary moved from `19 present, 5 absent` to
`18 present, 6 absent`, and the reels now appear under *"this machine cannot run
the pipeline until these are fixed"*.

**The mechanism is the one already here.** `resolveStoredPath`, the read-time
resolution sessions 61 and 62 gave a client's photographs — not a second
mechanism. `my files` is a `REPO_ANCHOR`, so a catalogue path re-roots onto
whatever checkout is running.

**Nothing was rewritten and nothing re-recorded.** On this machine all five
resolve to exactly the strings already stored:

```
test-1         stored===resolved: true   exists: true
test-2         stored===resolved: true   exists: true
test-3         stored===resolved: true   exists: true
ground-truth   stored===resolved: true   exists: true
vitasilk       stored===resolved: true   exists: true
```

**`tools/` has no test suite**, which is how a check nobody had watched fail
stayed wrong for as long as it did. The two assertions live in `core`, where the
resolver is, and both were proved to fire by mutation:

- reading the stored path raw again → *"expected … not to contain
  `'dir === undefined ? reel.path'`"*
- a catalogue path moved outside any repository → *"expected `'test-1: false'` to
  be `'test-1: true'`"*

Both restored byte-identical from saved copies, green re-verified before
continuing. `benchmarks/footage.json` is byte-identical at both ends
(`f9bc8308f11f1e01…`).

**`leave-the-panel.test.ts` still passes**, 2 of 2. No message added here tells
anyone to leave the panel; `docs/SECOND_MACHINE.md` remains the one place a
terminal is named, because it is first-time setup.

## 2. All six re-checked by measurement — and a second false green, far worse

Measured on a genuinely fresh clone: `.local/` holding only `config.json` with
the example's placeholders, no cache, no ledger, no watermark measurement, no
loudness records, no video.

| what | doctor | does it stop work? | measured how |
|---|---|---|---|
| `api-keys` | MISS | **yes — but late** | see below |
| `footage` | MISS | **yes**, for the optional last section only | §1 |
| `panel-built` | MISS | **yes** | bundle moved aside: panel suite **exit 1** |
| `watermark-facts` | MISS | no | panel suite 244, exit 0, with it absent |
| `loudness-records` | MISS | no | same run |
| `cache` | MISS | no | same run |
| `ledger` | MISS | no — **and it must be absent**; see below | same run |

**Session 60's claim is confirmed with one correction and one addition.** Of the
things a fresh clone reports missing, `api-keys` is the only one that stops
ordinary work — but `footage` also blocks (session 64's finding, now correctly
reported rather than hidden), and `panel-built` blocks the panel itself.

### The second false green: a test was billing into the real ledger

A fresh clone reported `ok  the cost ledger — 1 lines`. That line was written by
the test suite:

```
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.13441999999999998,"timestamp":"2026-09-07T14:57:10.817Z"}
```

**No money was spent** — the clone holds placeholder keys and the client is a
fake that never reaches a network. The figure is the price table's, not a
charge. But it is a fabricated entry in an append-only record that every session
quotes as evidence, and `npm run doctor` then called the ledger present and
healthy on the strength of it.

**Reproduced, then bisected.** Moving the file aside and re-running the service
suite recreated it; narrowing by directory and then by file reached
`service/src/images/generate.test.ts`.

**The cause.** Two `describe` blocks called `generateImages` with `bill: true`
and no `costsPath`, so `appendCost` wrote to the real `COSTS_PATH`. An
`afterEach` put the file back:

```ts
afterEach(() => {
  if (before !== '') writeFileSync(COSTS_PATH, before, 'utf8');
});
```

**`if (before !== '')`.** On a machine whose ledger already existed the restore
always ran, which is why this went unseen here for months. On a machine whose
ledger did not exist yet, the restore was skipped and the line stayed for good —
so the first entry in the partner's ledger would have been a call nobody made.

**Fixed** by giving each `describe` a ledger under its own cache root, the way
the ceiling tests already did, and guarded by two assertions in
`core/src/costs.test.ts`. Both proved:

```
 FAIL  … > is never the real one, in any workspace
+   "service/src/images/generate.test.ts",

 FAIL  … > is never written to by name
+   "service/src/images/generate.test.ts",
```

After the fix, running the whole images directory on a clone with no ledger
leaves none behind. **This machine's ledger is untouched at 165 lines and the
same sha256 at both ends.**

Restoring afterwards was never enough in any case: a run killed midway leaves
the line.

### A third gap, reported and not fixed

`loadConfig` **accepts** the example's placeholder keys — they read as set
because they are non-empty strings, and only the doctor knows what they are:

```
api-keys  loadConfig ACCEPTED the placeholder config — elevenLabsApiKey=set, googleApiKey=set
```

So a partner who forgets §10 gets a normal startup and a failure at the first
paid call rather than a refusal. The doctor catches it and says so plainly, and
the rewritten document now warns about it. Closing it in the running path is a
change to config loading and is not this session's.

### A correction to my own reading

I first recorded the panel suite as green with the bundle absent, from its line
`Tests 101 passed | 21 skipped (122)`. **The exit status is 1** — it does fail.
`CLAUDE.md` says to read the exit status and never the output, and this is
exactly why. The suite is right; my reading of it was not.

### Also found, and left alone

`npm run doctor` writes `reports/doctor-<host>.json`, which is **tracked**.
Running it here overwrote a committed record of a measurement taken on
2026-08-30 on a different host. I restored that file from HEAD and changed
nothing. A read-only diagnostic clobbering a committed record is worth a
decision, and it is not mine.

## 3. What the counts depended on

`npm run check` now ends with one measured line before `check: PASS`. The same
commit, three states:

**This machine, corpus present:**
```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

**The clone, Edit Plans only:**
```
check: counted with 5/5 corpus Edit Plans and 0/5 reels (0.00 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

**The clone, nothing at all:**
```
check: counted with 0/5 corpus Edit Plans and 0/5 reels (0.00 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

Measured at run time, never asserted, and no test was changed to make a number
stable — that is a larger change and it is not this session's.

## 4. The document, and where the rehearsal stopped

`docs/SECOND_MACHINE.md` is rewritten around session 64's measurement. **The
default path needs no video.**

**§11 is now the five Edit Plans**, 297 KB in total — measured, and 11 KB less
than session 64's rounded 308 KB:

| file | size |
|---|---|
| `ground truth.editplan.json` | 59 KB |
| `test 1.editplan.json` | 64 KB |
| `test 2.editplan.json` | 50 KB |
| `test 3.editplan.json` | 39 KB |
| `vitasilk.editplan.json` | 85 KB |
| **total** | **297 KB** |

**`npm run golden` is now an optional last section**, plainly marked as the one
thing that needs the videos, with the four it needs — `test 1` 2.29, `test 2`
2.31, `test 3` 2.24, `vitasilk` 2.68, **9.51 GB** — and `ground truth.mov`
(2.42 GB) named as **never needed by anything**. The "do this first" instructions
now say not to run golden and not to copy any video.

**What the partner can do with no video**, stated from the rehearsal: the panel;
creating a client, correcting their details, giving them a photograph and brand
colours, removing them, attaching pictures to one video; and the panel's own
suite at **242 passed, 2 skipped, 244 in total, exit 0** — on a copy holding no
video, no cache, no ledger, no watermark measurement, no loudness records and
placeholder keys.

**Where the rehearsal stopped: §14.** The next step is §10, putting a real API
key in, and it cannot be rehearsed — the only key available is Mohamed's and it
must never be copied into a second checkout. Everything past that point costs
money. `npm run panel:install` was **not run**, deliberately: it rewrites the one
folder After Effects reads and would have pointed the working panel at the
rehearsal copy. Both are marked as unexercised in the document, with the reason.

**One thing the rehearsal found and the document now says:** after pulling new
code, run `npm run panel:build` again. The bundle records which build of the
service it was made from, and a stale one makes the panel report a different
build — it cost one red panel run before I recognised it.

## 5. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run with nothing else touching the tree. **No
workspace was built while a gate was in flight.** **`npm run golden`: PASS** —
4415 + 4280 + 3709 + 4770 = **17,174**, field for field, reference unchanged.

| suite | session 64 measured | measured now | difference |
|---|---|---|---|
| core | 786 | **790** | **+4** |
| service | 1397 (+1 skipped) | **1397** (+1 skipped) | — |
| benchmarks | 173 | **173** | — |
| panel | 242 (+2 skipped) | **242** (+2 skipped) | — |

**+4 in core**, every one named:

1. `the footage catalogue > asks about the repository running now, not the one it was written on`
2. `the footage catalogue > is read through the resolver by the doctor, not as it stands`
3. `the ledger a test writes to > is never the real one, in any workspace`
4. `the ledger a test writes to > is never written to by name`

Nothing removed or renamed. 786 + 4 = 790, exactly.

**One failed gate, reported rather than hidden.** The first `npm run check` exited
**1** on lint: `'afterEach' is defined but never used` in `generate.test.ts`,
left behind when I removed the `afterEach` that wrote the real ledger. Fixed and
re-run whole.

**Five panel runs, each with its exit status:**

| run | result | exit |
|---|---|---|
| 1 | 242 passed, 2 skipped (244) | 0 |
| 2 | 242 passed, 2 skipped (244) | 0 |
| 3 | 242 passed, 2 skipped (244) | 0 |
| 4 | 242 passed, 2 skipped (244) | 0 |
| 5 | 242 passed, 2 skipped (244) | 0 |

**Part 0, as found at both ends:**

| | at start | at end |
|---|---|---|
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/.gitkeep` | `e3b0c44298fc1c14…` (empty) | same |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | same |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | same |
| `assets/client-pictures/` | 0 files | 0 files |

**Every directory in `.local/`, by name and file count, unchanged at both ends:**
`audio` 27 · `bench-audio` 5 · `build` 70 · `cache` 159 · `cv` 1759 ·
`deleted-clients` 0 · `evidence` 3 · `ground-truth` 10 · `plans` 49 ·
`quarantine-session51` 363 · `quarantine-session53` 139 ·
`quarantine-session54` 1 · `transcripts` 1.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

`handoffs/block-10-opening-prompt.md` → `handoffs/block-10.md` is Mohamed's own
uncommitted rename, left exactly as it was.

## 6. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a path resolver, a directory count, a document, and a
test that no longer writes where it should never have written.
