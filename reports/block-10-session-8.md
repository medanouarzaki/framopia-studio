Status: PROBLEM — the retry shipped and worked, but the 503 outlasted it and no picture was generated; nothing was billed

# Block 10 session 8 — the retry is in, the pictures are not

**Spent $0.00.** The first half shipped: `service/src/images/gemini-client.ts` now
retries a transient failure through a shared helper, and `runPipeline`'s ceiling
reaches the image stage. The gate passed. **The spend then failed again — three
attempts, all 503, and the retry absorbed nothing because the outage is longer
than a bounded backoff.**

**Ledger unchanged: 118 lines, sha256
`3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`.** Cache
identical at 46 entries / 55,363,681 bytes / 79 files. All five Edit Plans
byte-identical. All seven hand-made references identical.
`templates/library.aep` identical. `app.fonts.allFonts` **1198 → 1198**.

Per §2.6 the stage was run once and not retried.

## 1. Done

### Preconditions (all ten pass)

Repo, one After Effects instance, no `aerender`, ledger **118 lines /
`3f657131…`**, library `1d7553e8…`, branch `main` clean at `7ec766c`, open
project `.local/build/test_3-full.aep` inside `.local/build/`, seven references
recorded, fonts 1198. **Precondition 9 checked field by field** — 6 slots, 3
keywords, **0 candidates**, client v12 with a v12 snapshot, `spentUsd`
0.176484, and all six ideas compared string by string. Every one passed.

No API key was printed, logged or written anywhere.

### A. The retry — one shared helper, not a fourth private copy

`core/src/transient-failure.ts` and `core/src/transient-failure.test.ts`,
commit `88fb91e`.

**Three private copies already existed and were identical.**
`analysis/keywords.ts`, `analysis/slots.ts` and `transcription/correction.ts`
each declared `const OVERLOAD_MARKERS = ['503', 'UNAVAILABLE', 'high demand',
'overloaded']` and a matching `isTransientOverload`. All three are **deleted**
and now import the shared predicate; a test reads all four files and fails if
any private copy comes back.

| | |
|---|---|
| retryable | `status >= 500`, `status === 429`, and a network failure carrying no status |
| **never retried** | any other 4xx — 400, 401, 403, 404, 422 — and a content refusal |
| attempts | **`RETRY_MAX_ATTEMPTS = 3`** in total, not three retries |
| backoff | exponential from **`RETRY_BASE_DELAY_MS = 1000`**, capped at **`RETRY_MAX_DELAY_MS = 8000`** |
| jitter | **full jitter** — a uniform draw over the whole interval |

**Where the numbers came from.** The three existing clients do **one** extra
attempt with **no** backoff and **no** jitter, so there was no schedule to copy —
ARCHITECTURE §8 requires "bounded, jittered" and the existing clients do not
provide it. Three attempts and 1 s / 2 s capped at 8 s are chosen, and they are
**recorded as chosen rather than measured**. Full jitter rather than a fixed
delay because twelve image requests hitting one demand spike would otherwise
retry in lockstep and arrive together.

**One improvement over the copies it replaces, stated because it is a behaviour
change.** The old predicate matched message substrings only, so **a 400 whose
body happened to contain "503" was retryable**. A readable status now decides on
its own and the markers are the fallback for when no status can be read — which
is the Google SDK's case, since it throws an `ApiError` whose message carries the
JSON body. `statusOf` reads a `status`/`statusCode`/`code` property, a nested
`response.status`, or `"code": NNN` out of that message. A test pins each.

**A successful call is never repeated, structurally.** `await attempt()` returns
straight out of `withTransientRetry`; the loop body is reachable only from the
`catch`, so there is no path from a returned value to another request. This is
the money-losing case — a request the server completed and billed, sent again —
and it is asserted by a test that calls five times and expects five attempts, not
by a comment.

**`appendCost` fires once per image, not once per attempt.** The retry lives
inside `client.generate`, so one successful generate is one image and one ledger
line. A `FlakyClient` that fails twice then succeeds is asserted to produce
`attempts = 3`, `billedImages = 1`, and **exactly one added ledger line**. A
third test asserts that giving up after the bound appends nothing.

**No test can reach a network, and here is how that was verified.**
`GeminiImageClient` is **never constructed in any test** — grepped across all
four workspaces, the only match is the word inside a comment. The retry tests
drive an injected `attempt` double; the generation tests drive `FakeClient` and
`FlakyClient`, neither of which imports `fetch`, `GoogleGenAI` or anything
network-bearing. Every test injects `sleep`, so a retry costs no wall clock.

**Per-candidate failure is still fatal.** A candidate that exhausts its attempts
throws, the stage stops, and the cache keeps whatever succeeded. No error
swallowing was added — that would produce a comp with gaps.

### B. The ceiling now reaches the stage

Commit `84842f1`. `runPipeline` passes `ceilingUsd` into `impl.images`. Session 7
had to inject the real stage function through the `stages` hook — documented for
fakes — because the stage otherwise fell back to `DEFAULT_CEILING_USD` of $3.
`DEFAULT_CEILING_USD` itself is unchanged.

The test asserts a ceiling given to `runPipeline` is the one the image stage
receives, and that it is **not** the stage's own default.

### C. The gate

**`npm run check` exit 0, `check: PASS`**, run before a cent was spent. Counts in
§4.

## 2. The spend

Projection recomputed from config, nothing typed:

| | |
|---|---|
| model | `gemini-3-pro-image` |
| resolution / aspect | `2K` / `1:1` |
| candidates per slot | **2** (`mode.imageCandidates`) |
| slots on the plan | **6** |
| candidates | **12** |
| published per image | **$0.1340** |
| `IMAGE_COST_MULTIPLIER` | **1.35** |
| budgeted per image | **$0.1809** |
| **projection** | **$2.1708** — under the $2.60 ceiling |

`runPipeline` with `only: ['images']`, `redo: ['images']`, `ceilingUsd: 2.60`
passed through properly. The only injection was a retry **reporter**, so every
attempt is on the record.

### Every retry that happened

| attempt | status | waited |
|---:|---:|---:|
| 1 | **503** | 517 ms |
| 2 | **503** | 1371 ms |
| 3 | **503** | — (bound reached, rethrown) |

Both waits are jittered draws over [0, 1000] and [0, 2000] as designed — 517 and
1371, not 1000 and 2000. **The retry did exactly what §1.A specified. It did not
help**, because the model was unavailable for the whole of a ~1.9-second backoff
budget rather than for a moment.

The error, unchanged from session 7:

```
503 UNAVAILABLE — "This model is currently experiencing high demand.
                   Spikes in demand are usually temporary. Please try again later."
```

**It failed on the first candidate.** The ledger did not move.

### What was and was not generated

| | |
|---|---|
| candidates generated | **0 of 12** |
| **billed** | **$0.00** — ledger byte-identical, 118 lines, `3f657131…` |
| ledger lines added | **none** |
| plan | `0712e412…` → **identical**, 0 candidates, `pipeline.images` untouched |
| cache | 46 entries → **identical**, none created, none evicted |

**A restart costs the full $2.1708.** Nothing was banked, because nothing
completed. Session 7 established — and the dry run still shows — that the cache
*would* bank a partial run: `test-1` reads *8 of 8 cached, a run would bill
nothing* and `vitasilk` *10 of 10 cached*, because the image is written before
its manifest. This run banked nothing only because it never got past request one.

## 3. Deviations

1. **The three private `isTransientOverload` copies were deleted**, not left
   beside the shared one. §1.A.1 asked for extraction rather than a fifth
   implementation; leaving three would have kept the drift the rule exists to
   prevent. Their behaviour changes in one direction only — strictly fewer
   retries, on a 4xx that merely mentions 503.
2. **A retry reporter was injected into the client.** `GeminiImageClient` gained
   an optional second constructor argument so this session could record every
   attempt. Nothing else about the run was injected; the ceiling reaches the
   stage on its own now.
3. **§4's free work was not done.** It is conditional on the spend succeeding.
   No cutouts, no placement, no build, no census. `ground-truth` remains
   unbuildable.
4. **No test asserted `ground-truth` having images**, so none needed rewriting —
   nothing about the corpus changed.

## 4. Failures & open problems

**Nothing was destroyed or lost.** Ledger, all five plans, the cache, the seven
references and the library are byte-identical. The only artefact from session 7's
attempt, the empty `my files/test videos/cutouts/ground truth/`, is still there
and still empty.

### 1. The retry is correct and too short for this outage

Three attempts spanning **under two seconds** of backoff. A demand spike that
lasted across two sessions is not what a 1 s / 2 s schedule is for. The policy
matches what ARCHITECTURE §8 asks for and what the other clients do in spirit,
and it will absorb a momentary blip — **but it did not absorb this one, and
saying it "works" without saying that would be the defect shape this project
keeps paying for.**

What would actually survive this is a different thing from a retry: resuming the
batch later. The cache already supports it — completed candidates are banked and
a re-run pays only for the rest — so the missing piece is a decision about when
to come back, not more code inside the client. Not attempted; it is a design
question and it did not belong beside a spend.

### 2. Two sessions have now been spent on an outage nobody can time

Session 7 hit it, session 8 hit it. **Nothing here can say whether it is minutes
or days**, and no further probing was done because §2.6 says stop. The model's
own message is the only evidence and it says "usually temporary".

### 3. The retry schedule is CHOSEN, not measured

`RETRY_MAX_ATTEMPTS` 3, `RETRY_BASE_DELAY_MS` 1000, `RETRY_MAX_DELAY_MS` 8000.
There was no existing schedule to copy — the three clients that retry do so once
with no backoff at all — so these are judgement, recorded as such in the module.

### 4. The three existing clients still retry only once, with no backoff

They now share the predicate but not the loop; converting their call sites to
`withTransientRetry` would give them backoff and jitter and change the behaviour
of three billable paths, which did not belong in a session that then spends. The
shared helper is there when someone wants to.

### 5. Everything the brief asked about the pictures is unanswered

No gate results, no luminance figures against
`.local/build/luminance-test-1.json` and `luminance-vitasilk.json`, no verdict on
whether `img002`'s "two open doors" and `img006`'s "four cards" produce
multi-subject pictures, nothing on `img005`'s microneedling-for-mesotherapy, and
**the framing change is still confirmed only as text** — session 5 proved the
axis, session 6 proved the six draws, and no picture has ever been seen.

### 6. `ground-truth` is still unbuildable

Six slots with `position: null`, `scale: null` and zero candidates.
`assertAllPlaced` refuses. No other reel is affected.

### 7. Untested

The panel, CEP `evalScript`, the service's HTTP layer, the second machine. The
only `DoScript` calls were two read-only state probes, both returning `0` first
time.

## 5. Repo state

- Branch **`main`**. Commits this session: `88fb91e` *fix: retry a transient
  failure in the image client*, `84842f1` *fix: pass the run ceiling through to
  the image stage*, then the reports.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 42 | **630** |
| `framopia-service` | 90 | **1163** |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Core went 605 → 630 (25 retry tests), service 1159 → 1163 (3 retry-billing
  tests, 1 ceiling passthrough). Gates: `mode k2-syndicalia v12: ok (fonts set)`
  · `templates: 6 entries, ok` · `extendscript: 13 .jsx file(s) ok` ·
  `validate-templates: 6 template(s) ok` · `validate:panel: ok` ·
  `references: PASS` · both model pins ok.
- **Ledger: 118 lines, sha256
  `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`** — the same
  value sessions 6 and 7 closed at, and what the next session should assert.
- All-time ledger spend **$12.365734**. **About $6.64 of credit remains**,
  unchanged for the third session running.

## 6. Suggested next step

The retry is shipped and tested and the ceiling reaches the stage, so the code
half of this is finished and the next session's only job is to try the same
$2.1708 purchase again — nothing was banked, nothing was lost, and the run is now
better protected than it was. What is worth deciding first is what to do if the
503 is still there: a bounded two-second backoff plainly does not cover an
outage that has now spanned two sessions, and the cheap answer is not more
retrying inside the client but coming back to the batch later, which the cache
already makes free because completed candidates are banked and only the rest are
paid for. Whether that becomes a resumable stage, a scheduled retry, or simply a
human deciding when to press the button is a design question rather than a bug,
and it is the one thing standing between `ground-truth` and being buildable.
