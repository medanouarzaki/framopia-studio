Status: OK

Session 42. HEAD at the time of writing `f9bafe0`; this report's own commit
follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no build, and After Effects was not
contacted.** One After Effects instance and zero `aerender` at session start;
unchanged at the end. Working tree clean at start. **No behaviour changed**:
every control does exactly what it did, and nothing outside `panel/` was
touched.

## Done

### Goal 1 — one screen

The five-step rail is gone. Top to bottom:

| | |
|---|---|
| header | wordmark and version, unchanged |
| **readiness** | a dot, one word, and a **Details** link |
| **Video** | the picker |
| **Client** | the picker |
| **Cost** | what this video has cost, then what a run would cost |
| **Run pipeline** | the one red control, unchanged |
| **Build the composition** | directly beneath it, outlined |
| **Change something first** | Words · Emphasis · Pictures, each with its count |

**The editors are untouched.** The transcript editor, the keyword picker and the
picture picker keep every line of their content and behaviour; only how they are
reached changed. Each opens over the main screen with **Back** in the corner.

**What was on the Build step went with Build**: the watermark checkbox and its
three sizes, the client-font note, the preview of what the comp will contain,
what happened after a build, and the buildability issues — those now behind a
`details` summary reading *"5 cards are too short to hold"*, because they are
worth having and are not worth the top of the screen.

**The counts come from the build preview** (`subtitleCards`, `keywords`,
`images`), not parsed out of a sentence, and read `—` when the service has not
sent one. That is not the same as zero, and the panel does not pretend it is.

`StepRail`, `StepPane`, `stepContent` and `previousStep` are deleted.

### Goal 2 — sized for the panel

**Base 17px**, up from 13, at line-height 1.5. Every other size is in `em` so
one number moves the whole panel:

| | before | now |
|---|---|---|
| body | 13px | **17px** |
| section headings | 10.5px | 0.62em (**10.5px**), uppercase, unchanged in look |
| secondary text | 11–12px | 0.65–0.72em (**11–12px**) |
| card body text | inherited 13px | inherited **17px** |
| the spend figure | 17px | 1.05em (**17.8px**) |

The headings and captions keep their pixel size deliberately: they are labels,
and raising them would compete with the text he actually reads. What grew is
every sentence.

**The two-column layout above 830 px is retired.** This supersedes his own
session 9 ruling and he should see that said: a docked panel is a column, the
screen is short enough now not to need a second one, and reading down beats
reading across. `panel/src/panel-width.ts` is deleted with its measured
breakpoint. **One column at 380, 420, 700, 830, 1200 and 1920 px with nothing
overflowing at any of them**, asserted in a real browser.

### Goal 3 — picking a video starts at the top

`panel/src/steps.ts` is deleted with its tests: the remembered-step store, the
`framopia.panel.last-step` key, `stepViews`, `reconcileStep` and `openingStep`.
Selecting a video or a client now clears any open editor and shows the main
screen, and there is no state left that could put him anywhere else.

A stale `framopia.panel.last-step` entry may still sit in his browser storage.
Nothing reads it.

### Goal 4 — the words, against the shape

**Moved behind Details**, because none of them changes what he does next while
everything works: the ffmpeg and ffprobe versions with their paths and sources,
the CV sidecar's Python version, the resolved Node path, the template count, the
service version, which process answered with its pid and start time, and the
attempt counter. The main screen says **Ready**.

**Deleted:** the `Service` heading (a section for one word is not a section);
`Client mode` as a label, now **Client**; the mode version suffix on every
option (`K2 Syndicalia — v6` → `K2 Syndicalia`); and the five step promises,
which described steps that no longer exist.

**Reworded, because the shape changed what they should say:**

| was | is |
|---|---|
| `Not reachable` | `Not working` |
| `Running, with problems` | `Ready, with problems` |
| `6 valid` templates | `6 ready` |
| `CV sidecar` | `picture tools` |
| `Select a video…` / `Select a client…` | `Choose a video…` / `Choose a client…` |
| `every stage is cached; a run would read from disk` | `everything this video needs has already been paid for` |
| `budgeted ceiling for the stages that would call the API, not a forecast` | `the most it could cost, not what it will` |
| `Reusing a transcription made against an older orthography guide… will not bill.` | `Reusing the words from an earlier run. Nothing is re-transcribed and nothing is charged.` |
| `spent on this reel so far` | `spent on this video so far` |
| `is in the catalogue but the file is not on this machine` | `is in the list but the file is not on this machine` |
| `It continues if you leave this step.` | `It continues if you leave and come back.` |
| `No client saved for this reel yet.` | `…for this video yet.` |

**"Reel" is gone from everything he reads.** It survives in the code, where it
is the service's own word for a row in `footage.json`, and in test names.

**Kept, because each changes something he does:** the size of a picture in
pixels, every dollar figure, which service answered (behind Details), the file a
build wrote, the fonts a build will use, and every card the builder will have to
squeeze, named rather than counted.

### Goal 5 — handed back

`npm run service:build` and `npm run panel:build` both ran. The service is
unchanged this session; it was rebuilt so the pair on disk match.

**Driven in Playwright against the built bundle**: the four section headings in
order, the readiness line with the facts appearing only after Details is
pressed, one column and zero overflow at six widths, the three openers disabled
and then enabled after a run, an editor opening and Back returning to a run
still in progress, and that no control paints the brand accent but Run.

**What only his machine can confirm**: how it reads at the width he docks it at,
whether 17px is right in After Effects' own rendering rather than Playwright's,
and whether the order of the screen matches the order he works in. Every browser
claim here is Chromium 140 standing in for CEP's Chromium 99 — the capability
denylist is what guards that gap, and it passes against `panel/dist`.

## Deviations

**Goals 1 and 2 are one commit.** Both are `App.tsx` and `panel.css`: the
one-screen layout cannot compile while the two-column class is still emitted,
and the type scale is the same stylesheet. Goal 3 is its own commit because it
is whole-file deletions, and goal 4 is its own.

**One test flaked once** — `shows the picture the build will place` failed in a
full `npm run check` and passed alone and on re-run. It was a real weakness in
the test, not luck: it waited for `ol.slots li` and then read the `<img>` inside
it, and under parallel load those are far enough apart to miss. Three tests now
wait for the image. The check has run green twice since.

## Failures & open problems

**None from this session.** `npm run check` passes.

The panel test count fell from 167 to 133. That is deletion, not regression: the
step-rail describe (8 tests), the two-column describe (5) and `steps.test.ts`
(21) all asserted a shape that no longer exists, and were removed with it rather
than left green. Nine tests were added or rewritten for the new shape.

Unchanged and still open: frame analysis is reported rather than driven, so
Block 8's definition of done is not met; `dialogueLufs` reaches a plan only
through a migration; the image prompt is Block 9; `IMPACT_THRESHOLD` is
unresolved and the 17 SFX events remain 8 frames late.

## Repo state

HEAD `f9bafe0`, working tree clean. Four commits this session:

- `d8865e3 feat: make the panel one screen`
- `34513e1 refactor: retire the remembered step and the width switch`
- `f52f61c feat: say it in his words, now the shape is right`
- `f9bafe0 docs: record the one-screen panel`
- (this report's commit follows)

`npm run check` **passes**, counts measured per workspace: core **466**, service
**1057**, benchmarks **166**, panel **133 passed / 2 skipped** — **1822
TypeScript tests** — plus **149 pytest**, the mode validator, the panel manifest
parse, the template validator and both model checksums. The Chromium 99
capability denylist passes against the built `panel/dist`.

New: `panel/src/Readiness.tsx`. Deleted: `panel/src/steps.ts`,
`panel/src/steps.test.ts`, `panel/src/panel-width.ts`. Nothing outside `panel/`
changed. Nothing was staged with `git add -A`. `git log` carries no AI
attribution.

## Suggested next step

**Open it and see whether the shape matches how you work.** Reload first:

```
pkill -f "service/dist/service.js"
```

Then in After Effects, close the Framopia Studio panel and open it again from
Window → Extensions → Framopia Studio. It starts a fresh service itself.

Everything is on one screen now. Pick a video, pick a client, look at the cost,
press Run. When it finishes, press Build. Then — and this is the part that was
wrong before — if something bothers you in the comp, come back and press
**Words**, **Emphasis** or **Pictures**, change the one thing, and Build again.

Three questions:

1. **Is the order right?** Video, Client, Cost, Run, Build, then the three
   things to change. If you would put Build somewhere else, or want the three
   openers above the buttons rather than below, say so.
2. **Is 17px right?** It is a large jump from 13. Dock the panel at the width
   you actually use.
3. **Does Details hold the right things?** ffmpeg, ffprobe, the picture tools,
   Node, the templates, and which service answered are all behind it now. If you
   find yourself opening it often, something in there belongs on the main
   screen.

Next session is client authoring — a permanent client form and a short one-off
form, both reached from the Client picker. It is a `<select>`, so a "Set up a new
client…" entry is an added option and moves nothing else.
