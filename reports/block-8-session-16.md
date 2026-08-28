Status: OK

Block 8 part 2, session 16. **$0.00 spent, no API was called, After Effects was
not driven, no plan was regenerated.** Four defects from the user's first real
pass are fixed, plus a second place the cost screen understated.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `146e379` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`correction.ts`, `align.ts`, `templates/library.aep` and both hand-made
reference files are untouched.

## Done

### Goal 1 — ffmpeg and ffprobe are resolved

**The diagnosis is confirmed on this machine.** `which ffmpeg` →
`/opt/homebrew/bin/ffmpeg`, `which ffprobe` → `/opt/homebrew/bin/ffprobe`. Both
are Homebrew, and Homebrew is not on the `PATH` a Finder-launched After Effects
gives a spawned process.

**Proven under the failing condition rather than argued.** Running the health
probe with `PATH` reduced to `/usr/bin:/bin` plus Node's own directory:

- the old bare-name probe returns **`spawnSync ffmpeg ENOENT`** and
  **`spawnSync ffprobe ENOENT`**;
- the new resolver returns `/opt/homebrew/bin/ffmpeg` and
  `/opt/homebrew/bin/ffprobe`, both `present`, `ok: true`.

`resolveFfmpegPath` in `core/src/ffmpeg-path.ts`, on the `resolveNodePath`
precedent: `.local/config.json` → `/opt/homebrew/bin` → `/usr/local/bin` →
`PATH`, each tool independently. **Nothing is version-pinned** — Homebrew's
`bin` is a directory of symlinks, so no Cellar version appears. `PATH` stays
last rather than absent, because a machine that installs elsewhere and puts it
on the path is working; `verified` records which case it is, and a failure names
every candidate tried and what each returned.

**Every call site now uses it**, found by grepping for the bare names rather
than by memory: `service/src/health.ts`, `service/src/transcription/media.ts`
(3), `service/src/frames/sample.ts` (2), `benchmarks/src/audio.ts` (2) and
`tools/measure-watermark/cli.ts` (6).

**The resolved path is in the health payload and on screen**, under each tool's
reported version — guidelines §3, a tool names the inputs it selected.
`config.example.json` now documents `ffmpegPath`, `ffprobePath` and `nodePath`,
the last of which was read by the code and documented nowhere.

Eleven tests, including one against the real machine asserting both tools
resolve to an absolute path that exists — so the resolver cannot report success
while disagreeing with the shell.

### Goal 2 — the panel says which service answered

`GET /health` reports the service's own `pid` and `startedAt`; `connect` reports
whether the panel **spawned** it or found it **already running**. One quiet line
in the service block, no new colour:

`Started by the panel · pid 21204 · since 01:34:13`

Both fields are optional, so an older service's payload still parses and the
line degrades to `pid unknown` rather than blanking the panel — which the
browser tests exercise, since their stub health has no `process`.

### Goal 3 — selection no longer navigates

**Selecting a reel or a mode never changes the current step.** The rail updates
availability; the user chooses. The only automatic move is off a step the new
plan cannot show.

**Which step a reel opens on is remembered per reel**, in `localStorage` under
`framopia.panel.last-step`. React state was not enough: **closing a CEP panel
unloads the page**, so "reopening restores where you were" requires storage.
It is a view preference and never reaches the Edit Plan — two people opening the
same reel are entitled to be looking at different steps. Every access is
guarded, because a `file://` page with site data disabled throws on the accessor
itself.

**`resumeAt` is removed** from the service payload, the panel type and the test
that pinned it. Nothing reads it now, and leaving it would be a test asserting
retired behaviour.

**The stale Build summary is fixed, and the cause was Goal 7's.** "Pick a video
and a client mode first" was the fallback shown when **no plan had arrived** —
and no plan arrived because the panel was talking to a service too old to have
the `/steps` route. The fallback now describes the situation it is shown in:
nothing picked, one picked, or both picked and the service not yet answering.

**A real bug surfaced while testing the restore** and is fixed: the remembered
step was applied when the picker changed, which is *before* the plan for the new
reel has arrived, so it could never be checked against it. The panel now tracks
which reel the current step belongs to and applies the remembered step when that
reel's plan lands.

### Goal 4 — Build's rule, stated

**Build opens whenever there are subtitle cards, and that is the answer.** A
subtitles-only comp is a legitimate build: `buildReel` places whatever the plan
carries, keywords and images are enrichments, and `ground-truth` builds 76 cards
with neither. The rule is now written in the code with that reasoning, so it is
declared rather than inherited.

**The pane says what the comp would and would not contain**, so "available"
never implies more than it means:

- `ground-truth` — *Would contain 76 subtitle cards; no emphasised keywords and
  no images and no sfx events.*
- `vitasilk` — *Would contain 73 subtitle cards, 3 emphasised keywords, 5
  images, 8 sfx events.*

**The issues are named, not counted.** "5 buildability issue(s)" became a list:
`subtitles.groups[2]: 0.05s long but sub_pop needs 0.12s (intro 0.13 + hold 0.1
+ outro 0) (short by 0.07s)` and the rest.

### Goal 5 — the estimate covers stages that have never run

Session 15 computed images from **uncached candidates**, so a reel with no slots
planned computed to zero and read $0.18 — the same defect session 14 fixed one
stage earlier, in a second place: a cost screen honest only about work someone
had already done.

The count now comes from `imageSlotCountFor`, **the planner's own rule**
(ARCHITECTURE §5.3's 5.5 slots per 30 s), so the estimate and the planner cannot
drift; a test asserts the density constant appears in the planner and not in the
estimate.

| reel | images stage | total |
|---|---|---:|
| ground-truth | none planned; a run would plan ~4 slots, 8 candidates | **$1.63** |
| test-1 | 0 of 8 candidates cached | **$1.63** |
| test-2 | none planned; ~4 slots, 8 candidates | **$1.63** |
| test-3 | none planned; ~4 slots, 8 candidates | **$1.63** |
| vitasilk | 10 of 10 cached | $0.18 |

**The figure is labelled as a planned slot count, not a known one.** The reels
are 21–23 s, so the density rule gives **4 slots** rather than the five or six
the brief anticipated for a 30 s reel; that is the rule applied to these
durations, not a different rule.

### Goal 6 — the red is pinned

Two browser tests against the built bundle. `button.run` paints
`rgb(237, 28, 36)` when enabled, and **nothing else inside the rail or the pane
does**.

**Stated plainly because it matters:** Run cannot currently be enabled — the
gate still reports "the pipeline runner is not built yet" — so the test
**removes the `disabled` attribute in the page** to read the enabled paint. That
exercises the real CSS rule in the real engine; it is **not** evidence that Run
works. The disabled state is separately asserted *not* to be red, so a control
that cannot be pressed never claims the accent.

The check is scoped to `nav.rail` and `main`, not the whole page: the brand
header's wordmark and logo carry the accent by design (PROJECT_SPEC §6), and the
user's ruling is about controls competing for attention in the work area.

### Goal 7 — both were rebuilt

**`npm run service:build` and `npm run panel:build` both ran.**
`service/dist/service.js` and `panel/dist/panel.js` are current. Session 15
rebuilt only the panel, which is why the panel asked a running service for
`/steps` and got nothing — the direct cause of the stale "Pick a video" message.

**Capability denylist: the built bundle passes.** `capabilities.test.ts` runs
against `panel/dist`, and a raw grep of the bundle returns **zero** matches for
every denylisted feature.

## Deviations

- **Goals 2, 4 and 6 share a commit with Goal 3.** The brief required Goals 1, 3
  and 5 in separate commits, and they are. Goals 2, 4 and 6 touch the same panel
  files as Goal 3 (`types.ts`, `App.tsx`, `render.browser.test.ts`) and could not
  be separated without partial-file staging; Goal 2's service half is its own
  commit.
- **Three browser tests asserting session 15's navigation were rewritten**, not
  added to: "opens where the plan says the reel actually is" asserted behaviour
  the user has now ruled against.
- **`localStorage` was used** where the brief said "the panel's own state". It is
  the panel's own state, and it is what makes "reopening restores the step" true
  at all — React state does not survive a CEP panel being closed. No new
  dependency.
- **I damaged `render.browser.test.ts` with a bad scripted edit** and restored it
  from git before reapplying the changes cleanly. Nothing else was affected and
  the final file is the intended one.

## Failures & open problems

- **Nothing was lost or destroyed.** No cache entry, ledger line, reference,
  plan, template or image file was modified. The ledger is byte-identical.
- **The running service is the old build.** pid 21204 started at 01:34:13, before
  this session's `service:build`. It has no `/steps` provenance fields, no
  process reporting and the old `PATH` probe. **The user must restart it**, not
  only the panel — steps below.
- **The ffmpeg fix is proven under a simulated PATH, not inside CEP.** I
  reproduced the failure and the fix by stripping `PATH` in a shell. Only the
  user's machine can confirm what a panel-spawned service reports, and that is
  the reading to check first.
- **Run pipeline has still never been seen enabled**, so the accent test removes
  the disabled attribute to read the paint. The gate is the next thing to
  change, and until then nobody has seen the button live.
- **Steps 2 to 5 remain empty states.** The transcript editor, keyword picker,
  image picker, zone editor, Build wiring and the pipeline runner are all still
  unbuilt.
- **`cacheProvenance` has still never rendered on real data** — no plan on disk
  carries it, because only a run writes it and no run has happened.
- **The images estimate for an unplanned reel assumes the default candidate
  count**, which a client mode may override; nothing reads the mode's
  `imageCandidates` here. It reads high rather than low, which is the safe
  direction for a spend gate.
- Carried forward: headless AE is not met; `vitasilk` is the only reel ever
  built; the CJK `五` is classified Latin; 23 cards carry a clipped hold; 13
  multi-word Arabic §6 terms split across cards; splits and merges need an
  aligner operation that does not exist.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`33e342c` `fix: estimate image stages that have
  never run`**, preceded by `fix: stop reel selection from navigating, and state
  Build's rule`, `feat: report which service answered, and its process`, and
  `fix: resolve ffmpeg and ffprobe instead of trusting PATH`, on session 15's
  `146e379`. **This report's own commit follows it.**
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — `@framopia/core` **364** (22
  files), `framopia-service` **802** (58 files), `framopia-benchmarks` **166**
  (16 files), `framopia-panel` **95** passed + 2 skipped (5 files), **1427 TS
  total** against session 15's 1402; pytest **141**, unchanged.
- New files: `core/src/ffmpeg-path.ts` (+ test). Changed:
  `config.example.json`, `service/src/health.ts`, `service/src/dry-run.ts`,
  `service/src/steps.ts`, `panel/src/steps.ts`, `panel/src/App.tsx`,
  `panel/src/panel.css`, and the four ffmpeg call sites.
- Both `service/dist` and `panel/dist` rebuilt this session.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Have the user restart the service and read the two new lines — which binary
answered, and which process. That is the one thing this session cannot verify
for itself, and every claim about ffmpeg rests on it. Then build the pipeline
runner behind Run, because it is the only thing that turns the rail from a
viewer into a tool: it is also what finally lets the accent test drop its
`removeAttribute` and assert the real enabled control. Before that run spends
anything on `test-1`, re-read the dry run rather than any figure in this report
— it is now honest about reels with nothing planned, which the earlier numbers
were not.

## What the user does next

**Restart the service, not just the panel.** Last time only the panel was
rebuilt, which is why it kept telling you to pick a video you had already
picked — it was asking a service that did not have the route it needed. Both are
rebuilt now.

1. In a terminal, stop the running service: `kill 21204`
   (that is the one currently registered; if it has changed,
   `cat .local/service.json` names the pid).
2. In After Effects, close the panel — Window → Extensions → untick **Framopia
   Studio** — and open it again from the same menu. It will start a fresh
   service itself.

**Do not start the service from a terminal this time.** That is what hid the
bug: a terminal gives it your shell's `PATH`, which finds Homebrew; After
Effects does not. Letting the panel start it is the only way to see what the
panel really has.

**What to look at:**

- **ffmpeg and ffprobe should both be present**, and each should now show the
  path underneath — `/opt/homebrew/bin/ffmpeg (homebrew)`. If either still says
  missing, the path line tells me where to look.
- **A new line in the service block**: "Started by the panel · pid … · since …".
  That is how you tell which process you are reading.
- **Picking a reel should no longer jump you anywhere.** You stay on step one
  and choose where to go. If you leave a reel on Keywords and come back to it
  later — even after closing the panel — it should open on Keywords.
- **The Build step** now says what the comp would contain and lists the timing
  problems by name instead of counting them.

**One number changed and you should know why.** The cost screen was reading
about $0.18 for `ground-truth`, `test-2` and `test-3` — because they have no
image slots planned, and it was only pricing images that already existed. A real
run would plan slots and generate them, so those reels now read **about $1.63**.
Nothing has been spent, and nothing will be until you press Run, which is still
disabled.
