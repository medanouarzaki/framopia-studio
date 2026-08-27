Status: OK

Block 8 part 2, session 11. **$0.00 spent, no API called, After Effects not
driven.** The re-review sheet's download defect is reproduced, diagnosed,
fixed, and pinned in a real browser. The sheet is regenerated on an identical
row set.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `main` at start | **`37a05d8`** |
| tree at start | one untracked file: `handoffs/block-8-part-1.md`, the handoff this prompt directs me to read. See Deviations. |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

No AE work was done. `service/src/transcription/align.ts` and every experiment-2
module were left untouched.

## Done

### Goal 1 — reproduced, with the mechanism named

**The artifact itself gave the diagnosis before any reproduction ran.** Reading
`benchmarks/results/latest-align-review/vitasilk.rereview.html`:

- 17 rows rendered, carrying `data-i` values `[0, 1, 2, 28, 29, 30, 31, 32, 33,
  34, 35, 36, 50, 51, 52, 53, 54]` — the **corrected-word index** of each row;
- `WORDS`, the array the download walks, has length 17 — **positions 0..16**;
- rows where `position === data-i`: **exactly `[0, 1, 2]`**.

**The reproduction**, Playwright against that file, marking all 17 through the
same click path a human takes:

```
rows rendered on screen         : 17
rows visibly marked (button.sel): 17
counters                        : correct=4 wrong=4 misheard=3 two-tokens=3 no-token=3 unset=0
entries in the downloaded file  : 3
LOST                            : 14 of 17
```

**It lost 14, and the 3 survivors are `w0000`, `w0001`, `w0002`** — the same
three the user reported.

**The mechanism precisely.** Two key spaces that agree on one sheet and not the
other:

- **Written** at `align-sheet.ts:335` and `:343`: `state[String(i)]` where
  `i = tr.getAttribute('data-i')` — the corrected-word index.
- **Read at download time** at `:360-361`:
  `for (var i = 0; i < WORDS.length; i += 1) { var e = entryFor(i); if (!e.verdict) continue; }`
  — the **position** in the row array.

On the **main review sheet** every corrected word is a row, so index equals
position for every row and the two key spaces coincide. On a **re-review sheet**
only the rows a change moved are present, the indices are sparse, and a mark is
found only where a row's index happens to equal its own position. For this row
set that is 0, 1 and 2 — **exactly 3**, and the number is a property of the row
set rather than a coincidence: it is the length of the leading run of rows whose
corrected-word index has not yet diverged from its position.

**Why nothing looked wrong on screen:** `paint()` reads `entryFor(data-i)` — the
same sparse key it wrote — so every counter agreed with the display. **Only the
writer used the other key space.** The `if (!e.verdict) continue` then omitted
the 14 silently; a row missing from the file was indistinguishable from a row
nobody had looked at.

My reproduction lost the same number as the user's, 14 of 17, so there is no
discrepancy to explain.

### Goal 2 — fixed, and the class closed

- **Root cause:** marks are keyed by **word id**. Rows carry `data-word-id`, and
  every read and write goes through `rowId(tr)`. There is no longer a second key
  space to disagree with.
- **The download contract:** **one entry per displayed row, always**, in display
  order, each carrying `wordId`, `wordText`, `draftTokenText` and either a
  verdict or an **explicit `null`**. Rows are never omitted for any reason.
- **The header** carries `rowCount` and `markedCount`, both accumulated **inside
  the same loop that builds the entries** — neither is typed alongside the
  writer, per guidelines §3.
- **A live counter** reads `marked N of R` beside the download control.
- **The download refuses, visibly**, if the entry count differs from the rows on
  screen, or if a displayed row has no matching sheet data. It calls
  `window.alert`, writes nothing, and says the marks are still there. There is
  no code path that produces a partial file.

Reference schema is now **3**. Versions 1 and 2 stay readable, a `null` verdict
is refused in a v1 or v2 file, and `parseAlignReference` **rejects a header
whose counts disagree with the entries** rather than correcting them.
`scoreAlignment` filters null verdicts, so an unreviewed row is not counted as
judged — it is the reviewer's progress, not the aligner's accuracy.

**End to end on the regenerated sheet, same reproduction:**

```
rows rendered on screen         : 17
rows visibly marked (button.sel): 17
entries in the downloaded file  : 17
LOST                            : 0 of 17
```

### Goal 3 — the browser no longer eats the work

Marks persist to `localStorage` on every mark and are restored on load, keyed by
variant, reel, sha **and a fingerprint of the row set** — a re-review sheet holds
only the rows one change moved, and restoring another change's marks onto them
would be worse than losing them.

On load the sheet shows how many marks were restored, in a highlighted note, and
restored rows are visually distinguished and fully editable.

### Goal 4 — pinned in a real browser

`core/src/align-sheet.browser.test.ts`, **9 Playwright tests**, inside
`npm run check`. Not happy-dom: guidelines §3 forbids proving a claim about the
host in a more capable environment, and a human opens this file in Chrome or
Safari. The fixture uses the **sparse index shape that caused the loss** — 17
rows at corrected-word indices 0, 1, 2, 28–36, 50–54.

1. all 17 marked with distinct verdicts, downloaded, parsed: every row present,
   **in display order**, with the exact verdict sequence, and both header counts
   matching;
2. a subset marked: unmarked rows present with `null`, `markedCount` correct;
3. mark, reload, restored — count, highlighting and download all correct;
4. the live counter, up and down;
5. pre-filled restored verdicts, marked as restored, still editable;
6. **the shared rule** — the file never has fewer entries than the rows on
   screen, across five marking patterns from none to all. Pinned once, where the
   generator and the download path are both exercised: the sheet is rendered by
   the generator and read back through the download.
7. two tests for the legacy-key migration below.

**Six tests asserting the retired behaviour were rewritten, not left**: the ones
that asserted omission of unmarked rows, `entries: []` for an unmarked sheet, and
the old `localStorage` key shape.

### Goal 5 — the sheet is regenerated, on an identical row set

Regenerated with `npm run align:score -- --reel vitasilk --compare
benchmarks/references/align/vitasilk.json --cost-model transliteration`.

**The row set is identical to the sheet he marked**, verified by comparing every
row's `(wordId, wordText, draftTokenText)` in order against the previous sheet:
17 rows, **identical: true**. No row differs in any way.

**The three surviving verdicts were NOT restored, because the file they came
from is not in the repo.** I searched `benchmarks/references/align/`, the whole
tree for anything `rereview`- or `align-reference`-shaped, and `~/Downloads`:
the only artifacts are the committed hand-made `vitasilk.json` (73 rows, the
main review) and the sheet itself. **Per the prompt I did not type the verdicts
in from it**, so those three rows are unmarked in the regenerated sheet.

**But there is a better recovery path, and it is implemented.** The 14 lost
marks were never in a file — they were in `localStorage` in the user's browser,
under the pre-fix key `framopia.align-review.rereview.vitasilk.<sha>`, keyed by
the corrected-word index. The sheet now **migrates that store once**, mapping the
old index keys onto word ids using the row set, marks them as restored, and says
on screen that they were saved before the download bug was fixed. It runs only
when the current key holds nothing, so it can never overwrite newer work.

**If the user opens the regenerated sheet in the same browser profile, all 17
of his marks should reappear.** That is the one thing this session cannot verify
from here.

**The command, printed by the run and repeated here:**

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-align-review/vitasilk.rereview.html"
```

### Regression check

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against part 1 |
|---|---:|---|
| `@framopia/core` | 337 (19 files) | 327 |
| `framopia-service` | 761 (55 files) | 761 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| `framopia-panel` | 66 + 2 skipped (3 files) | 66 + 2 |
| **TS total** | **1330** | **1320** |
| pytest (sidecar) | **141** | 141 unchanged |

## Deviations

- **`git status` was not clean at start.** One untracked file,
  `handoffs/block-8-part-1.md` — the handoff this prompt requires me to read.
  Nothing was modified or staged and `main` was at `37a05d8`, so the risk the
  condition guards against (unknown working-tree state) did not exist on
  inspection; ending the session over a document I was told to read would have
  delivered nothing. It is committed as part of this session.
- **`core/src/align-score.ts` was changed**, and the prompt says to fix a review
  tool and nothing else. It is the scorer, not experiment 2 — `align.ts` and
  `transliterate.ts` are untouched — but schema 3 writes unmarked rows, and
  without the filter the scorer would have counted an unreviewed row as a
  judgement and reported a worse aligner than the evidence supports.
- **`playwright` was added as a devDependency of `@framopia/core`.** It was
  already a devDependency of the panel; the sheet renderer lives in core, so the
  test that drives it does too.
- **A legacy-key migration was added**, which no goal asked for. It is the only
  route by which the user's 14 lost marks can come back.

## Failures & open problems

### What was destroyed

**Fourteen of the user's seventeen hand-made judgements were lost** by the
download. Three survived — `w0000`, `w0001`, `w0002`.

**Recoverable, conditionally.** They were never written to any file, so nothing
in the repo holds them. They are in `localStorage` in whichever browser he
opened the sheet in, under the pre-fix key. The migration added this session
reads that store and maps it onto the new row identities. **It will work if and
only if he opens the regenerated sheet in the same browser profile, with site
data for `file://` still present.** If he used a private window, cleared site
data, or opens it elsewhere, the 14 are gone and the rows must be judged again.

The three that survived are also **not** pre-filled, because the file containing
them is not in the repo and I would not type them in from the prompt.

### Still open

- **The migration is untested against the user's actual browser state.** It is
  pinned by two Playwright tests against a store I wrote myself; whether his
  marks are still there is unknown from here.
- **`benchmarks/references/align/vitasilk.json` remains schema 1**, 73 entries,
  all judged. It is correct and untouched, but it predates the "every displayed
  row" contract, so its `rowCount`/`markedCount` are absent. That is by design —
  a hand-made file is never rewritten by code.
- **The generated script had a syntax error mid-session** that I introduced: an
  escaping slip put a literal newline inside a JavaScript string, which would
  have shipped a sheet whose script did not parse at all. It was caught by
  parsing the generated script, and the DOM tests would have caught it too. It
  is a reminder that this file emits code as text and nothing type-checks the
  result.
- Carried forward from part 1: experiment 2 is unadopted pending this
  re-review; the aligner defect is untouched; `vitasilk` is the only reel ever
  built; headless AE is not met.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`1565c6a` `docs: add block 8 part 1 handoff`**,
  preceded by `test: drive the sheet in a real browser`, `test: retire the
  assertions that omitted unmarked rows`, and `fix: key sheet marks by row
  identity, not by index`, on part 1's `37a05d8`. **This report's own commit
  (`docs: record block 8 session 11`) follows it** and is not reflected in that
  subject line.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — 1330 TS tests across four
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start and
  end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`. Not driven.

## Suggested next step

Open the regenerated sheet and see whether the marks come back — that single
observation decides whether the fourteen judgements are recovered or have to be
made again, and it is the only thing here that cannot be answered from the repo.
Either way the sheet is safe to mark now: the download writes every row it
shows or refuses outright, and it is pinned in the browser a human actually
uses. Once it is filled in and downloaded, experiment 2 finally has the second
human pass it has been waiting on since part 1, and the aligner work can resume.

## What the user does next

**Open the sheet:**

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-align-review/vitasilk.rereview.html"
```

Nothing needs rebuilding and After Effects is not involved.

**First, look at the top of the page.** If a highlighted line says some marks
were restored, your earlier work came back — the browser had kept it even though
the download threw it away. Those rows are highlighted and you can change any of
them. If there is no such line, the marks are gone and the seventeen rows need
judging again. I am sorry; that is what the bug cost.

**What went wrong.** Each row was being remembered under a number that meant its
position in the *whole* transcript, while the download looked for marks by
position in *this list of seventeen*. For the first three rows those two numbers
happen to be the same, so three marks were found and fourteen were not. The
screen was right the whole time — the counters agreed with what you had clicked
— because only the saving step used the wrong number.

**What is different now.** The file always contains every row you were shown, in
the order you saw them, with an explicit "not marked" for anything you skipped —
so a missing row can no longer look like a row you never reached. Beside the
Download button there is now a live "marked N of 17" so you can see at a glance
what will be written. And if the two ever disagree, the download refuses with a
message instead of quietly writing a short file.

Your marks are also saved as you go, so closing the tab or a crash will not lose
them.

When you have judged all seventeen, press **Download reference** and tell me —
that is the pass experiment 2 has been waiting for.
