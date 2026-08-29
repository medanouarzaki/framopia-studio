Status: OK

Session 38. HEAD at the start `c5ca7e4`, at the time of writing `bb3e4c4`; this
report's own commit follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no reel re-planned, and After Effects was
not contacted in any way.** One After Effects instance, zero `aerender` and no
stray `-r` process at session start; unchanged at the end. Working tree clean at
start.

## Done

### Goal 1 — Build, from the panel

`POST /jobs {type:"build", params:{reel, planPath, mode}}`, polled every 500 ms
like the pipeline. Step 5 has a **Build the composition** control.

**It runs the same file `npm run build:reel` runs.** The job spawns
`service/dist/build/build-reel-cli.js` as a child process rather than importing
it, for two reasons that both matter. `runBuildReel` blocks synchronously on
AppleScript, so calling it in-process would freeze the service's event loop for
the whole build — `GET /jobs/:id` could not be answered until it finished and
the panel would see nothing at all until the end, the opposite of the progress
the pipeline gives. And it settles the drift question the dry run and the runner
once lost a session to: the two are not equivalent code, they are one file. A
test pins the command.

**Progress comes from the build's own output.** `service/src/build/stages.ts`
declares three stages — `prepare`, `after-effects`, `check` — and the CLI emits a
marker per stage. Matching English prose would have broken silently the next
time a line was reworded, so a test reads `build-reel-cli.ts` and asserts it
emits every declared stage in order. The markers print **only when
`FRAMOPIA_BUILD_STAGES=1`**, which the job sets and a terminal does not, so
stdout in a terminal is byte-for-byte what it was.

**The unsaved-changes refusal reaches him as an instruction.** The CLI now
prints `build refused at <stage>: <message>` to stderr as well as the JSON — until
now the guard's sentence reached a person only inside a pretty-printed object.
`failureMessage` prefers that line, then a thrown error's message, and only then
the last thing said: an uncaught throw ends with a stack and a Node version
banner, so taking the last line would have put `Node.js v24.14.1` on screen as
the reason a build failed. A test pins all three.

**On success it names the file and does not open it.** `savePath` is read out of
the build's own JSON result rather than out of a sentence, so a reworded line
cannot quietly turn the file's name into null. The pane says nothing was
rendered and the project was not opened.

**The reentrancy question — and it is not settled.** I could not answer it
without running a build, which this session may not do, so it is written down
rather than assumed away:

- The reasoning says it should work. The panel's JavaScript runs in
  `CEPHtmlEngine`, a **separate process** from After Effects; the service is a
  **third** process; and the blocking `execFileSync('osascript')` is inside the
  **spawned child**, not the service. So nothing the panel depends on for
  polling is waiting on AE's main thread.
- What is genuinely unknown is whether After Effects **accepts a `DoScript`
  Apple event while a CEP extension is open**. Every build this project has ever
  run was triggered from a terminal. AE's main thread will be inside the
  ExtendScript for the duration, so the panel may not repaint while it runs.
- **The specific thing to try** is in "Suggested next step", with an escape
  hatch: the build is a child process, so `pkill -f build-reel-cli` frees the
  service without touching After Effects.

### Goal 2 — the pane says what will happen

`plan.build` on `GET /steps` is the preview, derived from the plan rather than
described in prose the builder could drift away from. Before he presses:

- **which reel and which client**, and where the client came from — the plan's
  own `clientMode` with the picker as an override, which is the builder's rule,
  so a reel whose analysis has never run says "the picker" rather than echoing
  the picker back as if it were the plan's;
- **where the file goes**, and that it replaces what is there. `buildOutputPath`
  is a second copy of the builder's naming rule and is **pinned equal to it by a
  test** that reads `build-reel-cli.ts` — a preview naming the wrong file would
  be worse than one naming none;
- **what the comp will contain** — cards, keywords, images, sounds — plus the
  watermark and its size in pixels, and the two faces the type is set in;
- every buildability issue by name, as before;
- **"Building is free. It calls nothing and bills nothing."** Every other
  control in this panel that runs something can spend money, so saying nothing
  about cost would itself have been read as a cost.

After it runs: the stages going past, how long it took, the file that was
written, and — when it happens — that a previous build of ours was open and got
saved on the way through.

**A service older than the preview is not read as a fact.** The pane says the
service is older and disables the control rather than inventing an output path.
Six browser tests against the built bundle cover the preview, a running build, a
finished one, the refusal, the older-service case, and that Build is not painted
in the brand accent.

**One false sentence retired.** `StepPane`'s empty state ended "This step is not
built yet." All five steps are built now, so for Build that state means "not
ready for this reel" and the reason already says why.

### Goal 3 — the end-to-end path, honestly assessed

**Block 8's definition of done is NOT met.** Everything the panel does works;
what is missing is that a reel has to visit a terminal before its comp is
correct, and **nothing on screen says so**.

**The sharpest finding, and it is new.** Image placement has read the **face
masks** rather than zones since session 33. `faceBoxesFor` returns an empty map
when `.local/cv/<video>/masks-2fps/` is absent; placement then falls back to the
frame alone and puts a slot at **2030 px on a 2160 px frame** — nearly the full
width, straight over the speaker's face. `placementIsSafe` **passes it**, because
with no face box there is no face to clear. So a reel that has never been through
the sidecar does not fail: it builds a wrong comp quietly. All five corpus reels
have masks (178–214 files each), which is why this has never been seen.

**Stage by stage, for a reel with only a transcript** (`ground-truth`, read from
the dry run):

| stage | what a run does | cost |
|---|---|---:|
| transcription | skipped, reusing an older guide | $0.00 |
| analysis | runs — keywords and image slots | $0.18 |
| images | runs — about 6 slots, 12 candidates | $2.17 |
| zones | **skipped, with instructions** | $0.00 |
| | | **$2.35** |

`test-1` and `vitasilk` are fully cached at **$0.00**; `test-2` reads $0.00 with
its images stage marked `run`, which is correct and confusing — its analysis
planned no slots, so the stage executes and generates nothing.

**What still needs a terminal:**

1. **Frame analysis.** `npm run frames`, `npm run segment`, `npm run zones`. The
   runner reports it and never drives it (`zonesNotDriven`), which session 17
   established deliberately — the sidecar takes minutes and has its own
   commands. It is a hole in the DoD and, given the placement fallback above, the
   most consequential one.
2. **`npm run watermark:measure`.** The builder reads
   `.local/build/watermark.json` and places **no watermark at all** without it.
   That directory is gitignored, so a second machine starts without it — a
   Block 10 problem as much as this one.
3. **`plan.source.dialogueLufs`.** Only `npm run migrate:sfx-placement` ever
   writes it. A newly transcribed reel has none, so the mix attenuates nothing
   and every sound falls back to its absolute gain.
4. **`npm run audit:templates`** if the template library ever changes, and
   `npm run service:build` / `npm run panel:install` for setup.

**What is missing for the DoD**, stated as work rather than as a complaint: the
runner has to drive the sidecar (or the panel has to refuse to build a reel with
no masks, which is the smaller and more honest first step), loudness has to be
measured where the transcript is written rather than in a migration, and the
watermark measurement has to survive a fresh clone. Nothing in this list was
fixed this session; the brief scoped Goal 3 to walking the path.

### Goal 4 — handed back

`npm run service:build` and `npm run panel:build` both ran. Both are needed: the
service gained the build job and the preview, and the panel gained step 5.

## Deviations

**Goal 2's rendering landed in Goal 1's commit.** `panel/src/Build.tsx` holds
both the control and the preview card, so `feat: build the composition from the
panel` carries the pane and `feat: say what a build will do before it runs`
carries the service-side derivation the pane reads. Splitting the file across
two commits would have left the first one unable to compile. The two goals are
in two commits; the seam is not exactly where the brief drew it.

**A fourth commit updates `CLAUDE.md`**, which the brief asks for when structure
changes. It records the build path, the reentrancy question and the
frame-analysis hole.

## Failures & open problems

**None from this session's own work.** What Goal 3 found is above, and none of
it is new breakage — the placement fallback has been latent since session 33.

Unchanged and still open, none of them this session's scope:

- **The image prompt** — fidelity, darkness and literalness. Block 9.
- **`IMPACT_THRESHOLD`** unresolved; the 17 SFX events remain 8 frames late.
- **Headless building** does not work on this machine and is Block 10's golden
  run problem. The panel does not change that: it triggers a build in the After
  Effects a person already has open.

## Repo state

HEAD `bb3e4c4`, working tree clean. Four commits this session:

- `265e5a6 feat: build the composition from the panel`
- `892edac feat: say what a build will do before it runs`
- `bb3e4c4 docs: record the panel build path and the frame-analysis hole`
- (this report's commit follows)

`npm run check` **passes**, counts read off the run rather than carried:
core **463**, service **1021**, benchmarks **166**, panel **164 passed / 2
skipped** — **1814 TypeScript tests** — plus **149 pytest**, the mode validator,
the panel manifest parse, the template validator and both model checksums. The
Chromium 99 capability denylist passes against the built `panel/dist`.

Nothing was staged with `git add -A`. `templates/library.aep`, `align.ts`,
`correction.ts` and every hand-made reference file are untouched. No plan was
written. `git log` carries no AI attribution.

## Suggested next step

**Build from the panel, and tell me what After Effects did.** This is the one
thing nobody has observed.

```
pkill -f "service/dist/service.js"
```

Then in After Effects: close the Framopia Studio panel if it is open, and reopen
it from Window → Extensions → Framopia Studio. It starts a fresh service itself.

Pick `vitasilk`, go to step 5, read what it says it will build, and press
**Build the composition**.

**What to expect, and what to watch for:**

- **If your previous build is still open**, the guard saves it and carries on,
  and the pane says which file it saved. Any *other* project with unsaved
  changes is refused by name, and the pane shows that sentence — save or close
  it and press Build again.
- The three stages should go past and it should finish in a few seconds. The
  panel may not repaint while After Effects is inside the script; that is
  expected.
- **If it hangs**, that is the answer to the question this session could not
  test, and it is worth knowing. Run `pkill -f build-reel-cli` — that frees the
  service and does not touch After Effects.
- Nothing is rendered and the project is not opened. Open
  `.local/build/vitasilk-full.aep` yourself when you want to look at it.

After that, the honest gap is frame analysis: a reel that has never been through
`npm run frames` and `npm run segment` builds an image 2030 px wide over your
face, and nothing warns. The smallest fix is for the Build step to refuse a reel
with no masks and say which command to run — worth doing before the DoD is
claimed.
