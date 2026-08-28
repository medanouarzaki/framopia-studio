Status: OK

Block 8 part 2, session 15. **$0.00 spent, no API was called, After Effects was
not driven, no plan was regenerated.** The panel is a five-step flow whose state
comes from the Edit Plan on disk.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `0d30e2e` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`correction.ts`, `align.ts`, `templates/library.aep` and both hand-made
reference files are untouched.

## Done

### Goal 1 — a referenced cache entry is never evicted

Contained, as the cap required: one new module, one guard in the existing
evictor, one test file.

`protectedEntryDirs` in `service/src/transcription/protected-entries.ts`
**derives the protected set from the reference files**. The reference names its
reel; the reel names its plan; the plan carries the video hash; the entry is
whichever one `selectTranscriptionEntry` picks. **No directory name is typed
anywhere.** Add a reference for another reel and its entry is protected without
anyone remembering to say so.

`evictStaleEntries` already took a `protect` list, so the wiring is one call in
`cached.ts`, which also logs each protected entry by name before writing. The
new behaviour is the loud failure: when everything over budget is protected it
throws `ProtectedEvictionError` naming the entries, rather than evicting or
silently leaving the video over budget for ever — which from the outside reads
exactly like a budget that works.

**Pinned by 11 tests**, including the one that matters: the same three-entry
fixture with the referenced entry oldest is evicted **without** the guard and
survives **with** it. A twelfth checks the committed references against the real
cache on this machine, so the guard cannot report success while protecting
nothing.

**What it does not cover**: a reference records its reel but not its entry id,
so protection resolves through the pinned prompt version. That is exact while
`ACTIVE_PROMPT_VERSION` is frozen — it is, for Block 8 — and would need
revisiting if it moved.

### Goal 2 — the staged flow

**Step state is derived from the plan, and this is the load-bearing part.**
`stepsFor` in `service/src/steps.ts`, served at `GET /steps?reel=&mode=`, reads
the plan's `pipeline` bookkeeping and its contents and returns per step:
availability, the reason it is not available, and a summary built from real
figures. The panel renders it and decides none of it.

Derived from the five plans as they stand:

| reel | resumes at | transcript | keywords | images | build |
|---|---|---|---|---|---|
| ground-truth | **transcript** | 76 words / 76 cards | locked | locked | open |
| test-1 | **build** | 67 words / 64 rendered | 2 keywords | 4 slots, 0 candidates | open |
| test-2 | **keywords** | 69 words / 64 rendered | 3 keywords | locked | open |
| test-3 | **transcript** | 58 words / 58 cards | locked | locked | open |
| vitasilk | **build** | 73 words / 68 rendered | 3 keywords | 5 slots, 10 candidates, 10 on disk | open |

**`resumeAt` is the end of the unbroken run of available steps, not the furthest
available one.** `build` is available whenever there are cards, so the furthest
would open a reel with no keywords straight on Build and hide the gap that is
the actual next thing to do. That distinction is a test.

**Steps 2 to 5 are honest empty states.** Each names what will live there and
shows figures already on the plan — including image candidates counted by
**checking the files exist**, not by trusting the plan's pointers. Every pane
ends with "This step is not built yet." Nothing is mocked.

**The user's layout rulings, all honoured.** Run pipeline is still the one red
control; the rail's current marker is a **white** underline and white text.
"Pick a video." still attaches to its control. The pickers, the service block
and the section labels are untouched. The 830 px `ResizeObserver` split is
unchanged.

**Docked at 420 px the rail shows the five numbers and only the current step's
name**, on one row. Asserted by measuring `offsetTop` (one distinct row) and
`scrollWidth` against `clientWidth` (no sideways scroll) in a real engine, not
by reading the CSS. Labels return at the two-column width.

**A malformed `/steps` payload degrades to a locked rail rather than throwing.**
Found by the existing dry-run tests failing with `Cannot read properties of
undefined` when their stub answered `/steps` with the dry-run body. That is the
part-1 failure mode — a throw taking the panel down — arriving from the service
side instead of the host side, so it was fixed at the boundary and pinned by two
tests.

**No new dependency. No routing library.** `panel/src/steps.ts` is a pure
function of the plan plus the current step.

**Capability gate: the built bundle passes.** `capabilities.test.ts` runs
against `panel/dist`, not the source. A raw grep of the bundle for the denylist
returns **zero** matches for every entry — container queries, the parent
selector, `@scope`, colour mixing, `text-wrap`, `Object.groupBy`,
`Array.fromAsync`, the array-copy methods, `AbortSignal.timeout`,
`URL.canParse`. Two matches existed before this session and both were **inside
CSS comments** that named the features literally; the gate strips comments so it
passed correctly, but shipping a stylesheet containing the strings a scanner
looks for is the same hazard as the XML `--` rule, so both comments were
reworded. The rail's own CSS tops out at flex `gap` (Chrome 84).

**Evidence, and its limits.** Ten new Playwright tests drive the **built
bundle** in a real engine: five steps present before any reel is picked, steps
2–5 locked with reasons, resume at the plan's step, unreachable steps not
clickable, rail navigation and Back, the rail on one row at 420 px with one
label, all five labels at 1000 px, the plan summary on an unbuilt step, no red
in the rail, and zero uncaught errors walking the whole flow.

**What only the user's machine can confirm**, per guidelines §3: that CEP's
Chromium 99 lays the rail out as Playwright's newer Chromium does; that
`getComputedStyle` agrees there; and that the rail reads correctly docked at the
real panel width rather than at a 420 px viewport. The engine here is roughly
three years newer than the host — that gap is exactly what cost part 1 six
sessions — so the layout claims are **plausible and unconfirmed on CEP** until
he looks.

### Goal 3 — the `test-1` figure, stated precisely

**Session 14's characterisation was wrong, and the $1.55 was not a
measurement.** The dry run carried a flat `STAGE_ESTIMATES.images = 1.55` —
`vitasilk`'s five-slot actual — and reported it for **every** reel whatever its
slot count. `test-1` has four slots. So "$1.73" was $0.18 analysis plus a
constant that had nothing to do with `test-1`, and calling it "the ~$1.21
approved in principle, now measured" was not true.

`test-1`: **4 slots × 2 candidates = 8 images**, at the frozen config
(`gemini-3-pro-image`, 2K, 1:1).

| figure | per image | 8 images | source |
|---|---:|---:|---|
| published rate | $0.1340 | **$1.0720** | `core/src/model-config.json` |
| expected actual, bake-off mean (+12.2%) | $0.150366 | **$1.2028** | `docs/DECISION-image-config.md` |
| expected actual, production mean (+15.7%) | $0.155044 | **$1.2404** | `vitasilk`'s recorded $1.550444 over 10 images |
| **budgeted ceiling** (`IMAGE_COST_MULTIPLIER` 1.35) | $0.1809 | **$1.4472** | `core/src/pricing.ts` |

**Part 1's "~$1.21" was right and remains right** — it is the measured
four-slot row in `docs/DECISION-image-config.md` ($1.203). There is no increase
to explain: there was a wrong constant.

**Behaviour changed, deliberately.** The goal said to change nothing unless the
displayed figure's meaning is unlabelled. It was unlabelled *and* wrong for the
reel, and labelling a wrong number as a ceiling would have made it a wrong
ceiling. The dry run now computes the images figure from **that reel's own
uncached candidates** and the panel labels the total "budgeted ceiling for the
stages that would call the API, not a forecast". `test-1` reads **$1.6272**
($0.18 + $1.4472); `vitasilk` reads $0.18 with images at zero, all ten cached.

**The user should be told one number: about $1.24 expected, $1.45 budgeted.**

### Goal 4 — handing it back

`npm run panel:build` ran; `panel/dist` is current (`panel.js` 163.9 kb).
**`npm run panel:install` was not needed**: the extension is already a symlink
from `~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio` to
`panel/`, so a rebuild is visible without touching the install. `PlayerDebugMode`
is already set.

**`panel/CSXS/manifest.xml` was not modified this session**, which is what
decides whether After Effects has to restart: AE reads the extensions folder at
launch, so a manifest change needs a relaunch and a bundle change does not.

**To reload without restarting After Effects:**

1. Close the panel: its tab's ☰ menu → Close, or Window → Extensions → untick
   **Framopia Studio**.
2. Reopen it: **Window → Extensions → Framopia Studio**.

That reloads `panel/dist`, which is already rebuilt. If it looks unchanged,
force a hard reload from the debugger: with the panel open, visit
`http://localhost:8099` in Chrome, pick the Framopia Studio target, and press
Cmd-Shift-R. A restart of After Effects is only needed if the panel does not
appear in the Extensions menu at all.

## Deviations

- **Goal 3 changed behaviour.** Explained above: the figure was unlabelled and
  wrong for the reel, so labelling alone would have dignified a wrong number.
  It is a separate commit from Goals 1 and 2.
- **Two CSS comments were reworded**, in `panel.css`, one of them written in
  session 10 rather than by me. They named denylisted features literally inside
  the shipped stylesheet. The gate strips comments and passed correctly either
  way; this removes the trap for the next person who greps the bundle.
- **One test assertion was updated rather than added** — the dry-run caption
  string changed with the label, and guidelines §3 forbids leaving a test
  asserting retired wording.
- **A `/steps` stub was added to two existing panel tests.** They previously
  answered every non-health URL with the dry-run body, which the new fetch read
  as a step payload.

## Failures & open problems

- **Nothing was lost or destroyed.** No cache entry, ledger line, reference,
  plan, template or image file was modified. The ledger is byte-identical.
- **Every CEP-side claim in Goal 2 is unconfirmed on the host.** The rail, the
  420 px behaviour and the colour assertions are proven in an engine three
  years newer than CEP's. This is the exact gap that cost part 1 six sessions,
  and only the user's machine settles it.
- **Steps 2 to 5 do nothing.** They are empty states by design, so the block's
  remaining deliverables — transcript editor, keyword picker, image candidate
  picker, zone editor, Build wiring — are all still unbuilt, as is the pipeline
  runner behind Run.
- **`cacheProvenance` has never rendered on real data.** The transcript step
  says a transcription came from an older guide when the plan records it, and
  **no plan on disk carries the field** — it is written only by a run, and no
  run has happened since session 14 added it. The code path is exercised by
  tests only.
- **The eviction guard resolves through the pinned prompt version**, because a
  reference does not record its entry id. Exact today; it would need revisiting
  if `ACTIVE_PROMPT_VERSION` moved.
- **`test-1`'s images are the largest spend left in the block** — about $1.24
  expected against a $1.45 budgeted ceiling — and nothing has been spent.
- Carried forward: headless AE is not met; `vitasilk` is the only reel ever
  built; the CJK `五` is classified Latin; 23 cards carry a clipped hold; 13
  multi-word Arabic §6 terms split across cards; splits and merges need an
  aligner operation that does not exist.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`29e7849` `fix: compute the image estimate per
  reel and label it a ceiling`**, preceded by `feat: restructure the panel into
  the staged flow` and `feat: never evict a cache entry a reference depends on`,
  on session 14's `0d30e2e`. **This report's own commit follows it.** Goals 1
  and 2 are in separate commits as required.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — `@framopia/core` **353** (21
  files), `framopia-service` **796** (58 files), `framopia-benchmarks` **166**
  (16 files), `framopia-panel` **87** passed + 2 skipped (5 files), **1402 TS
  total** against session 14's 1361; pytest **141**, unchanged.
- The capability denylist ran against the built bundle and passed; a raw grep of
  `panel/dist` returns zero matches for every denylisted feature.
- New files: `service/src/transcription/protected-entries.ts` (+ test),
  `service/src/steps.ts` (+ test), `panel/src/steps.ts` (+ test). New route:
  `GET /steps`.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Have the user open the rail before anything else is built on it — docked and
floating — because every layout claim in this session rests on an engine newer
than CEP's, and a rail that is wrong at 420 px is wrong under all four screens
that will hang off it. Then build step 2, the transcript editor, which is the
step with the most data already on the plan and the one where the migrated
timings become visible: word text, per-token `dir` for Arabic, the card
grouping, confidence highlighting from the aligner's own `confidence` field, and
the removed-word restore. It needs no new spend, unlike steps 3 and 4, and it is
where the user can finally see the alignment work of sessions 12 to 14 on the
words themselves rather than in a report.

## What the user does next

**Please look at the panel.** Close it and reopen it from **Window → Extensions
→ Framopia Studio** — no need to restart After Effects. You should see a row of
five steps across the top: Reel, Transcript, Keywords, Images, Build.

**What to check, and why I am asking.** Everything I know about how that row
looks comes from a test browser that is about three years newer than the one
inside After Effects. That gap is what broke the two-column layout in part 1 and
showed nothing on screen. So:

- Docked narrow, the row should show five numbered circles and only the current
  step's name — on **one line**, with no sideways scrolling.
- Floating wide, all five names should appear.
- The current step should be marked in **white**. Red belongs to Run pipeline
  and nothing else. If you see red anywhere in that row, tell me.

**Steps 2 to 5 are deliberately empty.** Each says what it will do and shows the
real numbers already known about that reel — `vitasilk` will say 73 words in 73
cards, 3 keywords, 5 slots with 10 images on disk. Nothing there is a mock-up,
and nothing there works yet.

**A correction about the `test-1` image cost.** I told you last session it was
$1.73. That was wrong: the panel was showing a fixed number taken from
`vitasilk`, regardless of which reel you picked. `test-1` has four slots, so
eight images: **about $1.24 expected, $1.45 at the pessimistic budget** the
spend gate uses. Your original ~$1.21 was right all along. The panel now works
this out per reel and says on screen that the figure is a ceiling, not a
forecast.

**One safety change you asked for is in.** The cache entry your two reference
files describe can no longer be deleted by a later run. If a run ever needs to
free space and everything it could delete is protected, it stops and says so
instead.
