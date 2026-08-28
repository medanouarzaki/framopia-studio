Status: OK

Block 8 part 2, session 17. **$0.00 spent, no API was called, the pipeline was
not run, After Effects was not driven, no plan was regenerated.** The pipeline
runner exists and Run pipeline is enabled and red.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `2db4126` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`correction.ts`, `align.ts`, `templates/library.aep` and both hand-made
reference files are untouched. The corpus stays pinned at guide v1.0.7.

## Done

### Goal 1 — the runner

`service/src/pipeline.ts`. `POST /jobs {type:"pipeline", params:{reel, mode}}`
returns a job id; the panel polls `GET /jobs/:id`, whose `detail` carries the
per-stage report. No websockets.

**The plan is the source of truth, not the runner.** Each stage writes its own
result and provenance into the Edit Plan, so a stage the plan records as `done`
is skipped with its reason said out loud — "already on the plan", "reusing an
older guide", "no image slots on the plan". `redo: [stageId]` runs one again
deliberately. An interrupted run resumes because the next run reads the plan and
finds the work already there; that is not a feature the runner implements, it is
what falls out of the plan being authoritative.

**The runner never spends.** Every billable call is made by the stage function,
which writes its own ledger line at the point of spend. The ledger writer is not
imported into `pipeline.ts` and **a test asserts it stays that way** — a wrapper
that bills is how eight fabricated ledger lines were written in Block 3.

**Two ceilings, and the report owes the distinction plainly:**

- **The hard gate is `PIPELINE_CEILING_USD = 4`**, in `service/src/pipeline.ts`.
  It is a **running check against the ledger before each billable request**, not
  a pre-flight estimate: it re-reads the ledger, compares this run's spend
  against the ceiling, and refuses — the run is **aborted, not truncated**, and
  nothing is requested once it refuses. CHOSEN, NOT MEASURED.
- **The $2.00 figure is ARCHITECTURE §6's soft alarm**, a warning against a
  reel's cumulative `costs.spentUsd` shown in the panel. It refuses nothing. The
  hard gate sits above it deliberately: a reel legitimately crossing $2.00
  should warn, not fail.

The alarm renders rather than being computed and dropped: the run panel carries
the same `alarm` class the spend block does, driven by the plan's cumulative
figure, and a test asserts the runner reports `planSpentUsd` as $1.550444 for
`vitasilk`.

**A failed stage stops the run and surfaces §8's structured error** — stage,
cause, retry-ability. Retry-ability is decided from the error rather than
assumed: a ceiling refusal, a blocked merge and a missing file are terminal; a
5xx, a reset socket or a failed fetch are retryable.

**Frame analysis is reported, not driven.** Zones need sampled frames and the
Python sidecar, which take minutes and have their own commands. The stage
reports what the plan already carries, or names the commands to run. Claiming to
have run it would be worse than saying so.

### Goal 2 — staged progress in the panel

Step 1's Run starts the job; the panel polls it once a second and renders the
stage list **in the same order and the same words the dry run uses**, because
both import `PIPELINE_STAGES` from one declaration.

Each stage shows waiting, running, done (with what it billed), skipped with its
reason, or failed. A failed stage shows the cause **as it came**, with
"(worth retrying)" when the error says so — the panel does not summarise it.
Running cost and the reel's cumulative total both appear, against the $2.00
alarm.

**The run survives leaving step 1.** The job lives in the service; the panel is
a viewer, and the polling picks up again on return. Asserted in a browser test
that navigates to Keywords and back and finds the run still going.

**`cacheProvenance` reaching the screen is checked**, in the test where the
transcription stage is skipped as `compatible` with "reusing an older guide"
rendered beside it.

### Goal 3 — Run enabled, and the cheat dropped

With a healthy service, a reel and a mode, Run is enabled. The browser test now
reads the **real enabled control** — `disabled: false`, label `Run pipeline`,
background `rgb(237, 28, 36)` — and a second test asserts the **disabled**
control is not red. Nothing else inside `nav.rail` or `main` uses the accent.

**Every remaining reason Run can be disabled states itself** in the line
beneath: the service starting or unreachable, a missing tool named, no reel, no
mode, a run already going ("It continues if you leave this step"), and — new
this session, found because a test fixture lacked the field — a reel the
catalogue lists whose file is not on this machine.

### Goal 4 — proven without spending

`service/src/pipeline.test.ts`, 17 tests, every stage injected so no test can
reach an API:

- a full run over `vitasilk`, every stage skipped, **ledger asserted
  byte-identical afterwards** rather than assumed;
- a `compatible` transcription resolution **never reaching `runHybrid`**, driven
  through the real `transcribeHybridCached` against the real cache entry;
- an interrupted run resuming and not repeating a completed stage, and `redo`
  running one again;
- the per-request ceiling refusing a billable stage, with the stage function
  asserted **not called** and the ledger unchanged;
- a failing stage stopping the run, and retry-ability classified correctly.

`service/src/pipeline-stages.test.ts`, 6 tests, pins the shared rule: the dry run
and the runner report the same stages, in the same order, in the same words,
agree on which can bill, and neither file may carry its own label table.

**That pin immediately found two real disagreements, and both were the dry run's
fault** — the mirror of the defect session 14 fixed:

- **A stage the plan records as done was still priced.** `vitasilk` read $0.18
  for analysis, because its keyword entry sits at an older analysis prompt
  version — while a run skips the stage entirely. The dry run answers "what will
  happen if I press Run", so a skipped stage is now priced at nothing, with the
  cache state kept in the note because a deliberate `redo` *would* bill.
- **Images were priced for a reel where no slot can ever exist.** `test-2` read
  $1.45 while its analysis had already run and planned no slots, so a run
  reaches no image call at all.

| reel | before | after | why |
|---|---:|---:|---|
| ground-truth | $1.63 | **$1.63** | analysis pending; it will plan slots and fill them |
| test-1 | $1.63 | **$0.00** | every stage on the plan; a run skips all four |
| test-2 | $1.45 | **$0.00** | analysis done, no slots planned, so no images follow |
| test-3 | $1.63 | **$1.63** | analysis pending |
| vitasilk | $0.18 | **$0.00** | every stage on the plan |

### Goal 5 — handed back, unrun

**`npm run service:build` and `npm run panel:build` both ran.**
`service/dist/service.js` and `panel/dist/panel.js` are current.

**Capability denylist: the built bundle passes**, and a raw grep of
`panel/dist` returns zero matches for every denylisted feature.

**What pressing Run on `vitasilk` will do, stage by stage:**

| stage | what happens | cost |
|---|---|---:|
| Transcribe and correct | skipped — already on the plan | $0.00 |
| Keywords and image slots | skipped — already on the plan | $0.00 |
| Generate images | skipped — already on the plan | $0.00 |
| Frame analysis | skipped — already on the plan (20 zones) | $0.00 |
| **total** | | **$0.00** |

**The session brief expected ~$0.18 for keywords, and that is not what happens.**
The premise was the cache reading — `vitasilk`'s keyword entry *is* at analysis
prompt v3 against an active v4, so the entry would miss — but the plan records
the analysis stage as done, and the runner skips a completed stage by design.
Re-running it is a deliberate act (`redo: ['analysis']`), and only then does it
cost about $0.18.

## Deviations

- **Goal 2 landed across two commits, not one.** The panel's job client and
  types are separable from the UI that uses them and went first; Goals 1, 2 and
  3 are each in their own commit as required.
- **The dry run changed**, which no goal asked for. Goal 4's shared-rule pin
  required the two to agree, and they did not; the dry run was the side that was
  wrong. The alternative was a test asserting a disagreement.
- **`asStageError` classifies retry-ability by matching the message text.** That
  is weaker than an error type and it is what the stage functions give it; a
  cause that says "503" in prose would be read as transient. Recorded rather
  than hidden.
- **Two scripted edits duplicated a block in `render.browser.test.ts`.** Both
  were caught by the compiler in the same minute and removed; the final file is
  the intended one. It is the second session running that this has happened with
  that file.

## Failures & open problems

- **Nothing was lost or destroyed.** No cache entry, ledger line, reference,
  plan, template or image file was modified. The ledger is byte-identical.
- **The runner has never run.** Every stage is exercised through an injected
  fake; the real `transcribeVideo`, `analyseKeywordsForPlan`,
  `planImageSlotsForPlan` and `generateImagesForPlan` are never called by any
  test. That is what the brief required, and it means the first real run is the
  first time the orchestration meets the stage functions.
- **`test-1`'s plan records images as done while zero candidate files exist.**
  Sessions past have noted the missing files; what is new is that the runner
  will therefore **skip** the stage rather than generate them. Getting `test-1`'s
  images needs `redo: ['images']`, which the panel has no control for yet.
- **Frame analysis is never driven by a run.** A reel with no zones gets a
  skipped stage naming the commands to run by hand. That is honest, and it means
  a first-time reel is not taken end to end by pressing Run.
- **`redo` is reachable only over HTTP**, not from the panel. There is no way in
  the UI to re-run a completed stage, so a user who wants fresh keywords cannot
  ask for them.
- **The retry policy is classified but not implemented.** `retryable` is
  reported; the runner does not itself retry, so ARCHITECTURE §8's "bounded,
  jittered retries" are not yet in place. The stage functions retry their own
  network calls where they already did.
- Carried forward: headless AE is not met; `vitasilk` is the only reel ever
  built; the CJK `五` is classified Latin; 23 cards carry a clipped hold; 13
  multi-word Arabic §6 terms split across cards; splits and merges need an
  aligner operation that does not exist.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`a725df7` `feat: enable run pipeline and show
  its progress`**, preceded by `feat: follow a pipeline run in the panel` and
  `feat: add the pipeline runner`, on session 16's `2db4126`. **This report's own
  commit follows it.**
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — `@framopia/core` **364** (22
  files), `framopia-service` **827** (60 files), `framopia-benchmarks` **166**
  (16 files), `framopia-panel` **104** passed + 2 skipped (5 files), **1461 TS
  total** against session 16's 1427; pytest **141**, unchanged.
- New files: `service/src/pipeline.ts`, `service/src/pipeline-stages.ts` and
  both test files. Changed: `service/src/dry-run.ts`, `service/src/jobs.ts`,
  `service/src/server.ts`, `panel/src/App.tsx`, `panel/src/service.ts`,
  `panel/src/types.ts`, `panel/src/run-gate.ts`.
- Both `service/dist` and `panel/dist` rebuilt this session.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Have the user press Run on `vitasilk` first, because it costs nothing and proves
the orchestration meets the stage functions — four skips, four reasons, and
`cacheProvenance` on screen from real data for the first time. Then `test-3`,
which is the cheapest reel with real work in it: analysis plus the images
analysis will plan, about $1.63 against a $4.00 hard gate. After that the gap
worth closing is `redo` having no control in the panel — a completed stage
cannot be re-run from the UI, which is what `test-1`'s missing image files need.

## What the user does next

**Restart the service, then the panel.** Both were rebuilt.

1. In a terminal: `kill 52201` (that is the service currently registered;
   `cat .local/service.json` names it if it has changed).
2. In After Effects: Window → Extensions → untick **Framopia Studio**, then open
   it again from the same menu.

**Let the panel start the service, not a terminal.** A terminal gives it your
shell's `PATH`; After Effects does not, and that difference is what hid the
ffmpeg problem for a whole session.

**Run pipeline is finally enabled.** With a reel and a mode picked it should be
the one red control on screen. Press it on **`vitasilk`** first.

**What you will see, and what it will cost: nothing, $0.00.** All four stages
are already on that reel's plan, so all four will be skipped, each saying why —
including "reusing an older guide" on the transcription, which is the first time
that fact reaches the screen from a real run rather than a test. It is a free
way to watch the whole thing work.

**Two things I should correct about what you were told to expect.** The brief
said a run on `vitasilk` would add about $0.18 for keywords. It will not: the
keyword *cache* would indeed miss, but the *plan* already records that stage as
done, and a run skips a stage that is already done. You would have to ask for it
to be redone, and there is no button for that yet. And the cost screen was
overstating two reels — it was pricing work a run would skip. `test-1` and
`test-2` now correctly read $0.00.

**If you want to see it actually do something**, run `test-3`: about **$1.63**,
which is keyword analysis plus the images that analysis will plan. The hard stop
is $4.00, and it is checked before every paid request rather than estimated once
at the start.
