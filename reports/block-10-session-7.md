Status: PROBLEM — the image model returned HTTP 503 and no picture was generated; nothing was billed

# Block 10 session 7 — the picture half did not happen

**Spent $0.00.** The image stage was authorised, projected, launched, and **the
model refused the first request with a 503**. Nothing was billed, nothing was
written, nothing was lost.

**Ledger unchanged: 118 lines, sha256
`3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`** — identical
at both ends. Cache identical at 46 entries / 55,363,681 bytes / 79 files. All
five Edit Plans byte-identical, `ground-truth`'s included. All seven hand-made
references identical. `templates/library.aep` identical. `app.fonts.allFonts`
**1198 → 1198**.

**Per §1.7 the stage was run once and not retried.** A retry is the
conversation's decision, and the figures it needs are in §3.

## 1. Done

### Preconditions (all ten pass)

| | measured at start |
|---|---|
| repo | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, name `framopia-studio` |
| After Effects | **1** instance · `aerender` **0** |
| ledger | 118 lines, `3f657131e5cd…59a58c` |
| `templates/library.aep` | `1d7553e894e1…2dc4a5d8` |
| git | `main`, clean, HEAD `bf69e72` *docs: report block 10 session 6* |
| open project | `.local/build/test_3-full.aep` — inside `.local/build/` |
| references | seven files, sha256 recorded, all identical at end |
| fonts | 1198 |

**Precondition 9 checked field by field.** `ground-truth`'s plan is exactly as
session 6 left it: 6 slots, 3 keywords, `clientMode` k2-syndicalia **v12** with a
**v12** snapshot, `costs.spentUsd` **0.176484**, and **all six ideas verbatim
identical** to those reported — compared string by string, not by eye.

No API key was printed, logged or written anywhere.

### The projection, computed from config rather than typed

Read off `parseImageConfig` and the mode:

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
| **projected total** | **$2.1708** |
| authorised ceiling | **$2.30** — projection under it |

The stage printed the same figures before its first call:

```
Image generation estimate: gemini-3-pro-image at 2K, $0.1340 published per image,
budgeted at $0.1809 (x1.35).
  6 slots x 2 candidates = 12 images
  estimated cost: $2.1708
```

### What happened

`runPipeline` with `only: ['images']`, `redo: ['images']`, `ceilingUsd: 2.30`.
Transcription, analysis and zones all reported `skipped: not part of this run`.
The images stage reached its first request and threw:

```
PipelineError: Image generation failed for gemini-3-pro-image: ApiError:
{"error":{"code":503,
  "message":"This model is currently experiencing high demand. Spikes in demand
             are usually temporary. Please try again later.",
  "status":"UNAVAILABLE"}}
```

**It failed on the first candidate, not partway.** The stage log ends at the
estimate with no per-image line, and the ledger did not move.

### Two things the run needed that the brief did not anticipate

**1. `only: ['images']` alone would have skipped the stage.** The runner's images
block reads `existing.pipeline.images.status === 'done'` and skips — and
`pipeline.images` was already `done`, written by the **slot** stage in session 6
(`slots-prompt-v2-k2-syndicalia-v12`, $0.064822). **The plan has one record for
two different stages**, so it cannot distinguish "slots planned" from "images
generated". `redo: ['images']` was required. The same confusion is visible in the
dry run, which reports `ground-truth`'s images stage as `skip` while also saying
`0 of 12 candidate images are cached; a run would generate 12`.

**2. `runPipeline`'s `ceilingUsd` does not reach the image stage.** The runner
calls `impl.images({ planPath, modeId, cacheRoot, costsPath, log })` with no
ceiling, so `generateImagesForPlan` would have used its own
`DEFAULT_CEILING_USD` of **$3** — above the authorised $2.30. The authorised
figure was made binding by injecting the real `generateImagesForPlan` through the
runner's `stages` hook with `ceilingUsd: 2.30`, which leaves the runner in
control of everything else. Reported as a deviation in §2 and as a defect in §3.

**Ceiling checks, and what the running total was at each.** Two were reached
before the failure: `runPipeline`'s own `assertWithinCeiling('images')`, at a
running total of **$0.00** against $2.30; and the stage's pre-flight
`assertWithinCeiling` over the whole billable set, **12 × $0.1809 = $2.1708**
against **$2.30 − $0.00**. The per-candidate `assertCeilingNotReached` — the one
that re-reads the ledger before every single request — **was never reached**,
because the first `client.generate` threw before returning.

## 2. Deviations

1. **`redo: ['images']` was added** to `only: ['images']`. Without it the stage
   skips, for the reason above. The brief specified `only` alone.
2. **The ceiling was injected into the stage** through `runPipeline`'s `stages`
   hook, wrapping the real `generateImagesForPlan` with `ceilingUsd: 2.30` and
   changing nothing else. Without it the effective bound would have been $3.
   The hook is documented as being for injecting fakes; this injects the real
   function with one extra argument, and it is the only way the authorised
   ceiling binds each request.
3. **§3's free work was not done.** It is conditional on the spend succeeding.
   No cutouts, no placement, no build, no census. `ground-truth` remains
   unbuildable for exactly the reason session 6 recorded.
4. **No retry.** §1.7 forbids it and makes it the conversation's decision.

## 3. Failures & open problems

**Nothing was destroyed or lost.** Measured, not assumed:

| | before | after |
|---|---|---|
| ledger | 118 lines, `3f657131…` | **identical** |
| `ground-truth` plan | `0712e412…` | **identical**, 0 candidates, `pipeline.images` untouched |
| the other four plans | — | **identical** |
| cache | 46 entries / 55,363,681 B / 79 files | **identical**, none created, none evicted |
| seven references | — | **identical** |
| `templates/library.aep` | `1d7553e8…` | **identical** |

The one side effect: `generateImagesForPlan` calls `mkdirSync` on the cutout
directory before generating, so **`my files/test videos/cutouts/ground truth/`
now exists and is empty**. Gitignored, harmless, left in place rather than
deleted.

### 1. The image client does not retry a 5xx, and ARCHITECTURE §8 says it should

`service/src/images/gemini-client.ts` is 93 lines and has **one** `catch`, which
wraps the SDK error in `ImageGenerationError` and rethrows. There is no retry, no
backoff, no 5xx branch.

ARCHITECTURE §8: *"Automatic retries only for transient network/5xx (bounded,
jittered)."* A 503 whose own message says *"Spikes in demand are usually
temporary. Please try again later."* is precisely that case. The other billable
clients do have retry paths — `transcription/scribe.ts` classifies
`status >= 500 || status === 429` as `retryable`, and `analysis/keywords.ts`,
`analysis/slots.ts` and `transcription/correction.ts` each carry a retry.
**The image client is the one that does not, and it is the most expensive to
restart.**

This is a real gap and it is why the session produced nothing rather than
pausing a few seconds. Not fixed here — §4 scopes this session to spending and
the free work after it, and a change to a billable client deserves its own
session and its own test.

### 2. A retry costs the full $2.1708 — measured

Nothing was banked. The dry run, run after the failure:

```
ground-truth  images: 0 of 12 candidate images are cached; a run would generate 12,
              budgeted at most $2.17
```

**But the cache would protect a partial run, and that is measured rather than
assumed.** The same dry run on the two reels that have generated images:

```
test-1        8 of 8 candidate images are cached; a run would bill nothing
vitasilk      10 of 10 candidate images are cached; a run would bill nothing
```

So had the 503 arrived at candidate seven, the first six would have been cached
and a retry would have paid for six. The image is written to the cache before its
manifest, so an interrupted write reads as a miss rather than as a zero-byte
candidate. **This run banked nothing only because it failed on the first
request.**

### 3. `pipeline.images` records two stages at once

The slot stage and the image stage both write it. A plan therefore cannot say
"slots are planned but pictures are not", which is exactly `ground-truth`'s state,
and both the runner and the dry run report the images stage as `done`/`skip` while
zero pictures exist. Reported, not changed.

### 4. Everything §2 and §3 of the brief asked for is unanswered

No pictures exist, so: no gate results, no luminance figures against Block 9's
`luminance-test-1.json` and `luminance-vitasilk.json`, no verdict on whether
`img002`'s "two open doors" and `img006`'s "four cards" produce multi-subject
pictures, and **no test of whether the framing change reads as close/medium/macro
on actual output**. The framing change remains confirmed only as text — session 6
proved the six draws, session 5 proved the axis, and neither has been seen as a
picture.

### 5. `ground-truth` is still unbuildable

Unchanged from session 6: six slots with `position: null`, `scale: null` and zero
candidates. `assertAllPlaced` refuses with `UnplaceableElementsError`. No other
reel is affected.

### 6. Untested

The panel, CEP `evalScript`, the service's HTTP layer, the second machine. The
only `DoScript` calls this session were the two read-only state probes, both of
which returned `0` first time.

## 4. Repo state

- Branch **`main`**, HEAD **`bf69e72` *docs: report block 10 session 6*** — no
  code commit this session, because nothing in the repo changed. No test asserted
  `ground-truth` having images, so none needed rewriting.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 41 | 605 |
| `framopia-service` | 90 | 1159 |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Gates: `mode k2-syndicalia v12: ok (fonts set)` · `templates: 6 entries, ok` ·
  `extendscript: 13 .jsx file(s) ok` · `validate-templates: 6 template(s) ok` ·
  `validate:panel: ok` · `references: PASS` · both model pins ok.
- **Ledger: 118 lines, sha256
  `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`** — the same
  value session 6 closed at, and the value the next session should assert.
- All-time ledger spend **$12.365734**. **About $6.64 of credit remains**,
  unchanged.

## 5. Suggested next step

The spend is still authorised and still costs $2.1708 — nothing was banked and
nothing was lost, so the next session can simply run it again, and the model's own
message says the condition is temporary. The one thing worth doing first is
free and small: `service/src/images/gemini-client.ts` has no retry at all, while
ARCHITECTURE §8 requires bounded jittered retries on a 5xx and every other
billable client in the repo has one — so a run that meets another demand spike
half way through twelve requests currently throws away the rest of the batch
rather than waiting three seconds, and it is the most expensive client to
restart. Adding that, with a test, turns a $2.17 gamble into a $2.17 purchase.
Two smaller things belong in the same session because they cost nothing and both
misled this one: `runPipeline`'s `ceilingUsd` does not reach the image stage, so
the authorised figure had to be injected by hand; and `pipeline.images` is
written by both the slot stage and the image stage, so a plan cannot say that its
slots are planned and its pictures are not.
