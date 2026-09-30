Status: PROBLEM — npm run check exits 1: repetition.browser.test.ts expects 22 photographs; his uncommitted client file lists 26

Block 15, session 119. **$0.00 spent. His paid run was not started.** The refusal
he met at *Make the pictures — about $6.87* was a $4.00 constant nobody had ever
put to him. It was put to him in one line this session; he ruled, and the
control exists. The gate is red for a reason that predates this session and is
in his work in progress, not in this change — §9 shows the same three failures
on the previous commit with his current file.

---

## 1. The limit that refused him

| | |
|---|---|
| name | `PIPELINE_CEILING_USD` |
| file | `service/src/pipeline.ts:99` at the start of this session (moved to `service/src/video-limit.ts`, re-exported from `pipeline.ts`) |
| value | **4** — dollars of ledger spend across every billable stage of one run |
| set by | commit `8fb6265`, 2026-08-28, *feat: add the pipeline runner* — Block 8, reported in session 17 |
| reached from the panel | **No.** A code constant. The panel's job runner passed no `ceilingUsd`, so every run took the default. |
| ever put to him | **No.** Session 30 predicted exactly this refusal; session 31's section is titled *"The ceiling, reported and not decided"* and calls it *"how much he is willing to spend on a reel"*. No ruling in `docs/PROJECT_SPEC.md`, no report records one. |

The reasoning recorded beside it, verbatim:

> CHOSEN, NOT MEASURED. A five-slot reel costs about $1.90 end to end
> (transcription ~$0.17, keywords ~$0.18, slots ~$0.06, images ~$1.55), so this
> leaves room for one regeneration and stops well short of a runaway.

**How it refused him.** The pipeline passes its ceiling down to the image stage
(`pipeline.ts`, since Block 10 session 7), whose pre-flight gate
`assertWithinCeiling` compares the billable estimate against it before the first
request. His video, `Documents/sora` (69.7 s, `.local/plans/sora-5971e819.editplan.json`,
client `dr-loubna-kfafi`): 25 slots, 6 filled by her own pictures, **38
candidates at the gate's $0.1809 = $6.8742 > $4.00** → `ImageBudgetExceededError`,
nothing requested.

**Is it the limit the message means?** One figure, three refusals wearing one
sentence. Session 95 (`6e42106`) wrote *"This would have cost more than the limit
set for one video, so nothing was spent. Raise the limit or use a shorter
video."* for any cause matching `/would be crossed|ceiling|budget exceeded/`. In a
panel run that regex catches three errors, all against the same `ceilingUsd`:
`ImageBudgetExceededError` (pre-flight — nothing spent, true),
`ImageCeilingReachedError` (before a later picture — **some already spent**) and
`PipelineCeilingError` (between stages — **some already spent**). So the phrase
did name the refusing value, but *"nothing was spent"* was false for two of the
three, and *"raise the limit"* named nothing he could raise.

**How a hard refusal came to exist beside session 69's cap.** It came first. The
gate is Block 8 (2026-08-28); the monthly cap is Block 12 session 69. Session 69
built a cap that only warns and asserted that *it* refuses nothing — correctly —
and the gate was never on that session's list. They are different code and
answer different questions; nothing ever connected them for him.

**What the brief called "Warn me past … soft alarm $2.00" is two things.**
*Warn me past* is session 69's monthly cap, on the money screen; `.local/cap.json`
read `{"monthlyUsd": null}` at the start of this session, so the 10 he typed was
not saved (or was saved and cleared — the file cannot say which). *soft alarm
$2.00* is a third figure — §5.

## 2. Every path that consults it, and what a person met

| path | where it checks | what he met |
|---|---|---|
| **Make the pictures** (`only: images, zones`, `redo: images`) | pipeline before images; the image stage pre-flight; again before every billable picture | the sentence in §1 |
| **Make the subtitles** | pipeline before transcription (run spend 0 — never fires) and before analysis (only if transcription alone reached the limit — never at $4.00) | nothing in practice |
| **Make this video** (fallback against a service older than the two buttons) | all of the above | the sentence in §1 |
| **Make several videos** (queue) | each video is its own `runPipeline`, same checks; a ceiling cause is terminal, never retried | *"It would have cost more than the limit set for one video, so nothing was spent."* (`queue.ts`, `whyItStopped`) |
| Build, build queue | none | — |
| `npm run images`, `npm run bakeoff` (terminal only) | their own figures — `DEFAULT_CEILING_USD = 3`, `--ceiling`; bakeoff `1.0` | not this limit, not the panel |

## 3. The control he has now

**His ruling, 2026-09-30, asked in one line this session:** *"Refuse, I set it."*
It stays a refusal; he sets it on Make; it starts at $4.00. Recorded in
`docs/PROJECT_SPEC.md`, *The most one video may cost is his to set, and it refuses*.

- **Most for one video** — a field and *Save*, on the **same row as *Make the
  pictures***, shown when the dry run says that video is over it, or when a run
  has just stopped at it. An ordinary day's Make is unchanged.
- The same control **always on the money screen**, under *The most for one
  video*, beside *A monthly cap*: *"Making one video that would cost more than
  this is refused before anything is spent. It is $4.00 now."*
- Kept in `.local/video-limit.json`, a file of its own — `setCap` writes
  `cap.json` whole, so a field there would be erased the first time he saved a
  cap. **Absent = $4.00.** Nobody's behaviour changes because it exists; the file
  does not exist on this machine now.
- Read by `readVideoLimitUsd()` when each run starts — the single-run job and
  every video of a queue. A run already going keeps the figure it started with.
- Saved through `POST /money/video-limit` (`{ usd }`, above zero, 400 otherwise).
- The dry run carries `videoLimitUsd` and `picturesOverLimit`, the latter asked
  of `exceedsCeiling` — the one comparison the gate itself makes.

**Before pressing, on Make, under the row:**

> About $6.87 is more than the $4.00 you allow for one video, so Make the
> pictures would be refused and nothing spent. It needs $6.88 or more.

**The refusal, before a cent is spent:**

> This would cost about $6.87, more than the $4.00 you allow for one video, so
> nothing was spent. Set "Most for one video", beside Make the pictures, to $6.88
> or more.

**The refusal part-way through** (something already made):

> It stopped at the $4.00 you allow for one video, before asking for anything
> more. What it made first is kept. Raise "Most for one video", beside Make the
> pictures, to let it finish.

**In a queue's summary:** *"It would cost about $6.87, more than the $4.00 you
allow for one video, so nothing was spent. Raise "Most for one video", beside
Make the pictures, to $6.88 or more."*

**$6.88, not $6.87.** The gate compares the unrounded $6.8742, so a limit typed
from the button's *about $6.87* is refused again — measured in §4. Every figure
he is told to type is rounded **up** to the cent.

## 4. His video is no longer refused — without running it

The dry run and the gate, on his real plan, from `service/src` with `tsx`.
Free; no request left the machine; no file was written.

```
his limit on this machine now: 4
limit (his, unset): pictures $6.8742, videoLimitUsd 4, picturesOverLimit true
limit 6.87: pictures $6.8742, videoLimitUsd 6.87, picturesOverLimit true
limit 6.88: pictures $6.8742, videoLimitUsd 6.88, picturesOverLimit false
limit 7: pictures $6.8742, videoLimitUsd 7, picturesOverLimit false
limit 10: pictures $6.8742, videoLimitUsd 10, picturesOverLimit false
gate at $4: REFUSED — Estimated $6.8742 for 38 images (19 slots x 2) on gemini-3-pro-image at 2K, over the $4.00 ceiling. Nothing was generated.
gate at $6.87: REFUSED — Estimated $6.8742 for 38 images (19 slots x 2) on gemini-3-pro-image at 2K, over the $6.87 ceiling. Nothing was generated.
gate at $6.88: passes (38 images, $6.8742)
gate at $7: passes (38 images, $6.8742)
```

**The paid stage was not run.** He presses it when he is ready.

**What he will see.** He opens Make on this video: *Make the pictures — about
$6.87* in red, beside it *Most for one video [$4.00] Save*, and under them the
sentence above. He types 7 and presses Save; the note goes, the row goes, and
*Make the pictures — about $6.87* is pressable and will not be refused.

**One condition first.** His running service (pid 11690, started 2026-09-21) is
older than this change: it sends neither figure and has no route to save one,
so until it is replaced the panel shows no control. The panel already replaces
a service built from other code by itself when it is opened (session 65's
repair, `App.tsx`), so opening the panel is what brings it in. It was not
stopped by this session.

## 5. The soft alarm

`SPEND_SOFT_ALARM_USD = 2`, `panel/src/spend.ts` — ARCHITECTURE §6. It is
**per video, cumulative**: what one video's plan records as spent. It is **not
monthly and not session 69's cap.** It shows as *soft alarm $2.00* beside *spent
on this video so far*, behind *What this video has cost so far* / *What it cost,
step by step* on Make, and it colours amounts and says *"This video is past the
expected envelope for a finished video."* It refuses nothing.

**Is it still doing anything useful?** Little. $2.00 is the top of PROJECT_SPEC's
envelope for a 20–30 s reel. Every full reel he now makes for a real client is
longer — this one alone will be about $7.50 when finished — so it will fire on
every one, and an alarm that always fires tells him nothing.

**Can the two be told apart?** Now, mostly: *Most for one video* stands beside
the button it refuses, and every sentence about it says *refused*. *soft alarm
$2.00* still does not say what it does or what it is per, and it sits in a fold
he rarely opens. **They were not merged**: one is his ceiling for a single video
and refuses; the other is an envelope that colours a record. Changing the alarm's
figure or words is a ruling, and was not made.

## 6. Every new assertion, red verbatim then green

**+14 service**, `service/src/video-limit.test.ts`: starts where it always was ·
reads back what he saved · refuses a figure that is not above zero and writes
nothing · falls back to the start when unreadable · lets his video through above
$6.87 and refuses it at $4.00 · is on the money screen beside the cap · lives in
a file of its own · `pipeline.ts` passes it to every run · `queue.ts` passes it
to every run · the dry run and the gate ask the same comparison · a reel owing
pictures is refused below its price and not above it · a reel owing nothing is
never over · the route refuses non-amounts and writes nothing · the route
rejects no token. **+2** in `queue.test.ts`.

**+4 panel** in `words.test.ts`; **+6** in the new `video-limit.browser.test.ts`
(absent on an ordinary Make · beside *Make the pictures*, with its sentence,
inside 900 px · sends once however fast Save is pressed · sends nothing that is
not an amount · present after a refusal, which names it, inside 900 px · on the
money screen beside the cap); **+4** in `every-control` (two new states × two
passes). The height ruler and the type sweep were extended to reach the new
states.

Mutations — each broken, run, restored, run again. Every restore was green.

```
M1 queue ignores his figure — exit 1
   × every run that can spend reads his figure > queue.ts passes it to every run it starts
     → expected '\n        reel: item.reel,\n        m…' to contain 'ceilingUsd: readVideoLimitUsd()'
M2 job runner ignores his figure — exit 1
   × every run that can spend reads his figure > pipeline.ts passes it to every run it starts
     → expected '\n    reel,\n    modeId,\n    redo,\n…' to contain 'ceilingUsd: readVideoLimitUsd()'
M3 dry run never says over — exit 1
   × … is asked of the same comparison by the dry run and the gate
     → expected 'import { existsSync, readFileSync } f…' to contain 'exceedsCeiling(picturesUsd, videoLimi…'
   × what the dry run says about the limit > says a reel that owes pictures is refused below its price and not above it
     → expected false to be true // Object.is equality
M4 his saved figure ignored — exit 1
   × the most for one video > reads back what he saved
     → expected 4 to be 8 // Object.is equality
M5 gate refuses at equal — exit 1
   × … is asked of the same comparison by the dry run and the gate
     → expected true to be false // Object.is equality
M6 default moved to 10 — exit 1
   × the most for one video > starts where it always was, so nobody’s run changes because it exists
     → expected 10 to be 4 // Object.is equality
M7 route takes a string — exit 1
   × POST /money/video-limit > refuses anything that is not an amount above zero, and writes nothing
     → Test timed out in 5000ms.
M8 queue sentence back to session 95 — exit 1
   × what he comes back to > names the control that refused a video, and how high it has to go
     → expected 'Did not finish, and trying it again w…' to contain '$6.88 or more'
M9 panel sentence back to the generic one — exit 1
   × what went wrong, in his words > names the control that refused him, where it is, and the figure that passes
     → expected 'It would have cost more than you allo…' to be 'This would cost about $6.87, more tha…'
M10 rounded to the nearest cent — exit 1
   × what went wrong, in his words > rounds the figure he is told to type up, never to the nearest
     → expected '$6.87' to be '$6.88' // Object.is equality
M11 one of Save's two guards removed — exit 0, 6 passed
M11b both guards removed — exit 1
   × the most for one video > sends his figure once, however fast Save is pressed
     → expected [ …(2) ] to deeply equal [ 'POST /money/video-limit {"usd":8}' ]
M12 control never shown on Make — exit 1
   × … is beside Make the pictures when the video is over it, and says what it needs
     → expected { said: null, label: null, …(4) } to deeply equal { …(6) }
   × … is there after a run it refused, and the refusal names it
     → expected null to be 'Most for one video' // Object.is equality
M13 control under the button, not beside it — exit 1
   × … is there after a run it refused, and the refusal names it
     → expected 938 to be less than or equal to 900
```

**M11 did not go red, and that is the instrument being honest**: Save has two
guards — `if (busy) return` and `disabled={busy}` — and either alone holds.
M11b removes both, and the test sees the second POST. **M7** went red by hanging
rather than by a 400: the thrown validation escapes the handler and the request
never answers. **None of the mutations wrote `.local/video-limit.json`** —
checked after the service set; it does not exist.

## 7. The figures, golden, the type scale, the heights, the cells

**Figures.** `sora-3`, `sora-4`, `test` through `dryRun` and `stepsFor`, before and
after: **IDENTICAL**, all 21 old fields of each dry run and every step, with two
fields added (`videoLimitUsd 4`, `picturesOverLimit false`). His `Documents/sora`
likewise, with `picturesOverLimit true`. The comparison was checked first: it
reports DIFFERENT for two different reels and for one changed character.

**Golden.** PASS, 4 of 4, **17,174 fields**.

**Heights**, at 1500 px, his data — every existing state unchanged:

| state | session 117 | now |
|---|---|---|
| Choose | 374 | 374 |
| Make, an ordinary day | 616 | 616 |
| Make, four in the list | 616 | 616 |
| Make, a run in progress | 896 | 896 |
| Make, a stage failed | 891 | 891 |
| Build, ready / nothing chosen / built once / twenty / no typefaces | 497 / 347 / 784 / 845 / 621 | 497 / 347 / 784 / 845 / 621 |
| **Make, over the most for one video** | — | **699** |
| **Make, refused at it** | — | **891** |

The first placement put the control under the button and the refused state
measured **960 px**; the control moved onto the button's row and the refusal was
shortened to wrap like the failure sentence 891 was measured with. M13 is that
mistake, kept as a test.

**Type scale: 16**, the same sweep as session 117. Extended to the new states it
reads **16 before any failed run, 19 with one, 19 with both limit states** — the
limit adds none. The first version added two (an 11.25 px label, a 13 px amber
note); both now use settings the scale already had. **The three the failed run
adds are not this session's**: the run card's stage words in amber and in red,
and its 17 px amount — any failed run shows them; the old sweep never visited a
failed run.

**Control cells: 90 controls, 180 cells, across 20 states.** Session 117's 84 +
**4 of his** (*Forget* for each photograph: his client file lists 26 today, 22 at
session 118 — choose-with-everything-open has 33 controls, 26 of them *Forget*)
+ **2 of this session's** (*Save*, beside the button and on the money screen,
each reached with a figure typed so the press sends something). Double-press:
empty. Pressed then closed: nothing thrown.

**Width** tests: 9 of 9. **His photographs**: 28 files byte- and
dimension-identical at both ends.

## 8. What I am least sure about

**That he will see the control on his first try.** It needs the service replaced;
the panel does that by itself on opening when the stamps differ, and I have
relied on that repair rather than watching it happen on his machine.

**The queue is refused per video, and the queue does not say so in advance.**
The dry run's verdict is on Make for the chosen video; a list of several is
priced, but whether any one of them is over his figure is only said when it is
refused.

**The failed-run card breaks a standing rule.** `.facts .v.bad { color:
var(--accent) }` (2026-08-27) draws a failed stage's word — *Stopped here* — in
the money red. The brief lists *a failure is not red* as something that must not
change; it was already true before this session and is visible in the refused
state this session makes reachable. Not changed.

**A throw inside a route handler hangs the request** (M7). Not this route's
defect alone — the handler has no catch — and not changed.

**Choose crosses 900 px with his 26 photographs** — 905 px, measured by the
failing test. Every other state holds.

**A limit set below about $0.25** would refuse the words part-way through
(pipeline checks before analysis). Nothing prevents it; the field accepts any
amount above zero.

## 9. Measured

**Gate.** `npm run check`, run alone on `aca2b73`, allowed to finish: **exit 1**,
984 s. Core **846** · service **1653** (1637 + 14 + 2) · benchmarks **173** ·
panel **483 passed, 3 failed, 2 skipped of 488** (472 + 4 + 6 + 4 = 486 = 483 + 3).
The gate stops at the panel suite; the steps after it were run by hand, each
**exit 0**: store empty, `validate:modes`, ExtendScript, `CLAUDE.md` limit,
templates, panel manifest, `verify-refs`, attribution. **pytest 149 passed.**

**The three failures**, `panel/src/repetition.browser.test.ts`, verbatim:

```
× says each sentence once, with all twenty-two photographs showing
  AssertionError: expected 26 to be 22 // Object.is equality
× keeps the label over the grid, and every field named
  - "distinct": 22,  + "distinct": 26,
× lays the photographs across the panel rather than down it
  AssertionError: expected '905px, under 900: false' to be '905px, under 900: true'
```

**Not this change**: the previous commit `771acd6`, in a scratch worktree, with
his current `modes/dr-loubna-kfafi.json` copied in, fails the same three with the
same values. His file is uncommitted and was not touched; the test was not
bent to fit it.

**Golden.** PASS, 4 of 4: 4415 + 4280 + 3709 + 4770 = **17,174**.

**Panel suite five times:**

| run | exit | time | result |
|---|---|---|---|
| 1 | 1 | 473 s | 3 failed · 483 passed · 2 skipped (488) |
| 2 | 1 | 399 s | 3 failed · 483 passed · 2 skipped (488) |
| 3 | 1 | 397 s | 3 failed · 483 passed · 2 skipped (488) |
| 4 | 1 | 398 s | 3 failed · 483 passed · 2 skipped (488) |
| 5 | 1 | 398 s | 3 failed · 483 passed · 2 skipped (488) |

The same three `repetition` tests every time, and nothing else.

**Part 0, at both ends — identical:**

- Mount: `/Volumes/T7 Shield` (apfs). Working copy only.
- After Effects: **1** main process, **0** `aerender`, both ends. Driven only by `npm run golden`.
- Ledger: **300** records, sha256 `4f46f7d2dd1c70cd4eeb63cac5908197a92a4878ecff6bfe7262e9336c902caf`, both ends.
- `templates/library.aep`: `4b0cf05a8f5d4775c03e8ebd86f713f0e7eb985d80e46f3874cb28eca6c22aba`, both ends.
- `modes/dr-loubna-kfafi.json` `dadeecf8a0cadd07…` 2026-09-30T20:03:57 · `modes/k2-syndicalia.json` `572e99bf890ceefb…` 2026-09-09T21:58:19, both ends.
- `.local/`: audio bench-audio build cache cv deleted-clients doctor evidence ground-truth plans quarantine-session114 quarantine-session51 quarantine-session53 quarantine-session54 quarantine-session69 quarantine-session71 queues transcripts — both ends. No `video-limit.json`.
- `assets/client-pictures/`: **28 files**, 46,076 KB, both ends (27 Dr Loubna, 1 K2).
- Service: pid **11690**, 127.0.0.1:65085 and :45871, started 2026-09-21 — his, both ends, not stopped.
- Extensions: `com.framopia.studio → …/framopia-studio/panel`, both ends.
- Working tree, found and left: ` M modes/dr-loubna-kfafi.json`; untracked `pic016`–`pic027` in `dr-loubna-kfafi/` and `assets/client-pictures/k2-syndicalia/`. Not staged, not committed.
- Remote: `origin/main..main` **0** after a fetch at the start.

**Bundle.** `npm run panel:build` at the end: `panel/dist/panel.js` **283,117
bytes**; the symlink as above.

## 10. Ledger lines added

**None.** 300 records and the same sha256 at both ends.
