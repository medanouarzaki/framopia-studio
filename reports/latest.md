Status: OK — a build now writes itself onto the plan, the stale branch runs for the first time, and both gates are green

**What changed, in short.** Until today, building a reel left no trace on it. You
could build `vitasilk` ten times and its plan would look exactly as it did before
the first one — so nothing in the system could tell a reel that had been built
from one that never had. Now, when a build finishes, the plan records three
things: that it was built, which `.aep` file it produced, and when. And because
of that, a rule that has been written into this project since its first week
finally does something: **if you edit the transcript of a reel you have already
built, the plan now marks itself out of date.** Nothing yet acts on that mark —
the panel does not mention it and the build does not refuse — and that is a
decision for you rather than something this session should have invented.

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. `templates/library.aep` untouched at
`d2bbb6b7…`, 552,745 bytes. The six hand-made references byte-identical. After
Effects pid 79146, 0 `aerender`, fonts 1198 → 1198.

## Done

### What was already there

**The field.** `Build` in `service/src/editplan/types.ts:545` — three properties,
none optional: `status: 'none' | 'built' | 'stale'`, `aepPath: string | null`,
`builtAt: string | null`. `docs/ARCHITECTURE.md` §3 line 172 shows the same shape.
`validate.ts:674` checks the enum and the two nullable strings.

**Every reader, before today — there were two, and one only creates it.**
`createEditPlan` (`io.ts:52`) writes `{ status: 'none', aepPath: null, builtAt:
null }` on every new plan. `mergeIntoExistingPlan` (`merge.ts:150`) is the only
other line in the repository that touches it. Nothing else reads it: not the
builder, not the panel, not `steps.ts`. The panel's `plan?.build` in `App.tsx` is
`steps.ts`'s build **preview**, a different field with the same name.

**The stale branch.** `merge.ts:150` reads
`if (plan.build.status === 'built') plan.build = { ...plan.build, status: 'stale' }`.
It fires only inside `if (cleared.length > 0)` — that is, only when a transcript
change has already cleared keywords, images or sfx. **It could never run**, because
no code path ever set `'built'`: every plan on disk read `none`, however many times
it had been built. Confirmed against all five plans at the start of this session.

**Where a build could write it.** Three places: `runBuildJob`
(`service/src/build/job.ts`), which spawns the CLI and parses its stdout; the CLI
`build-reel-cli.ts`, which does the building; and the panel's route, which only
polls a job. **The CLI is the right one** and the other two are wrappers. This
project already has the rule, for money: `appendCost` fires at the point of spend
and never in a wrapper, because a wrapper fabricates entries for calls that never
happened. `job.ts` would be writing `built` from a string it read out of stdout
rather than from a file it checked.

**What the panel says about a build today: nothing, and that is honest.** The only
built-related text is `Build.tsx:313`, *"Built in 3.4s"*, from the progress of the
run happening in front of you. There is no screen claiming a reel was built
earlier, so the panel is not reporting a state it cannot know — unlike session 15's
card count, which promised 73 and built 68.

### Writing it

`service/src/build/build-record.ts`. `buildRecordFor` returns the record;
`buildRecordAfterFailure` says what a failure leaves behind.

**Written at the end of the CLI, after every check that can still refuse.** Not
merely after the save: `assertEveryCardFits` and the audio-start comparison both
run *after* After Effects has saved the file, and both exit non-zero. Recording at
the save point would have put `built` on a plan the very same run then rejected.
The record is written at the one moment both facts are true — the build succeeded
and the file is there.

**The file is checked, not trusted.** `buildRecordFor` refuses when the build
reported no save path, when nothing is at that path, and when the file is empty.
The plan is left saying nothing rather than claiming a build, because the claim is
what a later session would act on.

**A failed build never writes a success, and never erases one.** It leaves the
previous record exactly as it was. A build that refuses did not un-build the last
one: its `.aep` is still on disk and the record still describes it truthfully.
Overwriting with `none` would erase a fact that is still true, and setting `stale`
would be taking a word that belongs to `mergeIntoExistingPlan` — there, it means
the plan has moved on from the comp, which a failed build says nothing about.

**`aepPath` goes through the same chokepoint as every other stored path.** It is
re-rooted at read time by `resolvePlanPaths` inside `readEditPlan`
(`service/src/editplan/io.ts:81`), beside `source.videoPath`,
`watermark.assetPath` and the image candidates. So a plan built here still resolves
on the partner's machine at a different absolute path. `stored-paths.test.ts` still
passes.

**No schema change was needed.** `build` has been required since the Edit Plan's
first version and every plan on disk already carries it, so nothing was invalidated
and no migration was written. All five plans open through `readEditPlan`.

**Fifteen new tests.** Twelve on the record itself — the happy path, the three
refusals, and what a failure leaves — and three on the chain below. Four of them
read the source with comments stripped and pin *where* the write lives: the CLI
contains it, `job.ts` does not, it sits inside the success guard, and it comes
after `assertEveryCardFits` and after the audio comparison. **Proven to fail**:
adding a line mentioning `buildRecordFor` to `job.ts` fails the wrapper test, and
`job.ts` was restored.

### The stale branch runs

Demonstrated on a scratch copy of `vitasilk`'s plan, outside the repository, so no
real reel lost its keywords or its ten generated images:

```
before: build.status = built   keywords = 3   images = 5
editing word w0010: "un" -> "unX"
transcriptChanged = true   cleared = ["keywords","images","sfx"]
after:  build.status = stale
aepPath kept = true   builtAt kept = true
```

**What you would see.** Nothing on screen. The plan on disk changes from `built` to
`stale` and keeps which file was built and when.

**Proven by test as well as by observation.** `merge.test.ts` already had a stale
test, but it set `status: 'built'` with a literal a test chose — the branch was
covered while the chain was impossible. Three new tests build the record with
`buildRecordFor`, the function the build itself calls, so the loop is closed: a
real record is what a transcript edit turns stale, the path and timestamp survive
because both are still true, and a plan that was never built is left alone.

### What "stale" means in the product: nothing yet

**Said plainly, because a reachable branch is not a working feature.** Nothing
reads `plan.build`. The panel does not mention it, the build does not refuse a
stale plan, the dry run does not report it, and no requirement checks it. What
exists now is an honest record and a mark that is kept up to date. **Whether a
stale reel should say so on screen, or should have to be rebuilt, is a ruling for
you** — and it is now possible to act on, which it was not this morning.

### Both gates

**All four reels build.** Each plan gained exactly three fields and nothing else —
not even `meta.updatedAt`, deliberately: a build does not change the plan's
content, only the record of what was made from it.

| plan | sha256 before → after | fields changed |
|---|---|---|
| ground truth | `0712e4124d8b` → `0712e4124d8b` | **0** — it cannot build, so it correctly still says `none` |
| test 1 | `1acf10bf0692` → `3278b48a24df` | 3, all under `build` |
| test 2 | `94da6dd60af1` → `9384daa6f691` | 3, all under `build` |
| test 3 | `dbf28f9bafb5` → `a5f9bcb07ca2` | 3, all under `build` |
| vitasilk | `c8501bcafc79` → `bf6a8fdd7f80` | 3, all under `build` |

**`npm run golden` passes, 4 of 4, field for field, at 17,174 fields — unchanged.**
The census reads built comps and never the plan, so the new field cannot reach it;
that was checked by running it rather than assumed, and **nothing was re-recorded**.

**One consequence worth knowing:** `npm run golden` builds the four reels, so every
golden run now updates four `builtAt` timestamps on disk. The reference is
unaffected and the ledger does not move.

## Deviations

None. Nothing outside the session's scope was changed, and no real plan was edited
to demonstrate the stale branch.

## Failures & open problems

**Nothing failed.**

**The panel's image-picker flake continues, and session 24's correction holds.**
It failed 4 under the first full check, then **failed 5 running the panel workspace
alone**, then passed 190/192 under a second full check. That is the third session
in a row where running it alone did not make it pass, so the old "parallel load"
explanation is still wrong and the cause is still unknown. The final
`npm run check` is a clean PASS.

**Still open, untouched:** `ground-truth` is unbuildable pending about $2.17 of
pictures; the framing and literal-versus-atmospheric prompt changes have never been
seen in a generated image; the three false-premise tests session 20 found; the
panel/service banner; client pictures; Arabic-first; and
`build-reel.jsx`'s unsaved-changes guard not recognising another checkout's output.

## Repo state

| | |
|---|---|
| branch | `main` |
| HEAD | `docs: say who writes the plan's build record` |
| `npm run check` | **exit 0, `check: PASS`** — core 743 passed (743), service **1202 passed (1202)**, benchmarks 173 passed (173), panel 190 passed / 2 skipped (192), pytest 149 |
| `npm run golden` | **PASS — 4 of 4 matched, field for field**, 17,174 fields (test-1 4415, test-2 4280, test-3 3709, vitasilk 4770) |
| ledger | 118 lines, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c`, 552,745 bytes |
| credit remaining | about **$6.64**, unchanged |

**Close-out**, start and end:

| | |
|---|---|
| Edit Plans | four gained a build record; `ground truth` byte-identical at `0712e4124d8b`. **Final shas differ from the table above** because `npm run golden` rebuilt all four afterwards and each build writes a fresh `builtAt` — that is the consequence noted under Both gates, not a second change: `test 1` `b518bf6156d6`, `test 2` `d945ce92f09a`, `test 3` `46704f5c4b43`, `vitasilk` `399b3377adf2` |
| references | all six byte-identical |
| cache | 46 entries, 80 files unchanged; the `.DS_Store` in `.local/cache/` is still there and was left alone |
| After Effects | pid 79146, 1 instance, 0 `aerender` |
| fonts | 1198 → 1198 |
| free space | 161 GB |
| secrets | none printed, logged or written |

**Commits:** the write, the stale-branch proof, the ARCHITECTURE correction, and
this report.

## Suggested next step

Take the project to the second machine. `docs/SECOND_MACHINE.md` is written and
none of its remedies has ever been run; `npm run doctor` names three checks —
`repo`, `node`, `dependencies` — that cannot be falsified from inside a working
checkout, and a cold machine tests all three at once. The last structural gap in
the pipeline is closed as of today.

If instead you want the stale mark to do something, that is one short session:
decide whether the panel should say a reel has moved on since it was built, and
whether Build should say so before it runs.
