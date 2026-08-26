Status: OK

# Block 7 session 3 — the first template instance placed in After Effects

Spent **$0.00**. No Gemini call, no ElevenLabs call, no billable request. The
cost ledger is byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` is byte-identical at both ends: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects instances at session start: exactly 1**, PID 44015, command
line `/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects`
with **no arguments and no `-r`**. The nine other AE-related processes were the
documented helpers (`crashpad_handler`, `dynamiclinkmanager`,
`TeamProjectsLocalHub`, `CEPHtmlEngine` and four of its Helpers) and were not
counted. The count was re-checked before every `DoScript` — `assertOneInstance`
in `service/src/build/drive.ts` does it in code, and it never changed from 1.
Nothing was killed and nothing was launched.

**A subtitle card is on screen.** `.local/build/vitasilk-probe.aep`.

## Done

### Goal 1 — the audit records layer geometry

`tools/validate-templates/audit.jsx` now emits, per layer: `position`,
`anchorPoint`, `scale`, `opacity`, `width`/`height`, `sourceRect` at a named
`sampleTime`, and for text layers `font`, `fontSize`, `justification` (as a
name and as AE's raw enum value) and `tracking`. Every animated property is
found by walking the whole property tree, so **effects are covered as well as
transform**, and each is reported path-qualified with its keyframe count. A
property that cannot be read emits an explicit null plus a reason string.

**The first run was wrong, and catching it is the most useful thing in this
goal.** `prop.value` on an animated property returns its value at the
project's **current time indicator**, not at any time the script chose.
`sub_pop`'s `TXT_MAIN` came back at y **750** with opacity **0** — the *start
of its intro* — because the CTI happened to sit on frame 0. Computing the
card's position from that would have placed every subtitle **50 px low**, and
nothing downstream would have complained. Every property now carries both
`value` and **`valueAtSampleTime`**, side by side so the difference stays
visible, and everything downstream computes from the latter. The Source Text
document is read at the same time for the same reason.

**Measured geometry, `sub_pop` / `TXT_MAIN`**, sampleTime **1.001001001 s**
(comp mid-point), verbatim:

| field | value | valueAtSampleTime | keyframes |
|---|---|---|---|
| position | `[1080, 750, 0]` | **`[1080, 700, 0]`** | 2 |
| anchorPoint | `[0, 0, 0]` | `[0, 0, 0]` | 0 |
| scale | `[100, 100, 100]` | `[100, 100, 100]` | 0 |
| opacity | `0` | `100` | 2 |

- kind `text`, width **2160**, height **1100**
- sourceRect: top **−253.285423278809**, left **−641.366455078125**,
  width **1290.939453125**, height **257.137474060059**
- text: font **`Inter-SemiBold`**, fontSize **343**,
  justification **`CENTER_JUSTIFY`** (raw **7415**), tracking **0**
- animated: `Effects/Fast Box Blur/Blur Radius` 2 · `Transform/Position` 2 ·
  `Transform/Opacity` 2

**Measured geometry, `img_float` / `IMG_MAIN`**, same sampleTime:

| field | value | valueAtSampleTime | keyframes |
|---|---|---|---|
| position | `[540, 540, 0]` | `[540, 540, 0]` | 0 |
| anchorPoint | `[500, 500, 0]` | `[500, 500, 0]` | 0 |
| scale | `[100, 100, 100]` | `[100, 100, 100]` | 0 |
| opacity | `68.7097525652997` | `100` | 2 |

- kind `solid`, width **1000**, height **1000**, `text` null
- sourceRect: top 0, left 0, width 1000, height 1000
- animated: `Effects/Fast Box Blur/Blur Radius` 2 · `Transform/Opacity` 2

**Worth noticing:** `IMG_MAIN` is 1000 x 1000 inside a 1200 x 1200 comp and
sits at [540, 540] rather than the comp centre [600, 600], because it is
parented to `CARD` (solid, 1080 x 1080, position [600, 600, 0], anchorPoint
[540, 540, 0], scale animated 2 keys). Its position is in `CARD`'s coordinate
space. Anything computing image placement has to go through the parent.

**The type was widened where it lives.** `AuditLayer` is declared in
`core/src/templates.ts`, not in `tools/validate-templates/cli.ts` as the goal
supposed; it was widened there, and `AuditProperty`, `AuditAnimatedProperty`,
`AuditSourceRect` and `AuditTextStyle` were added and exported. Every new field
is **optional with a default**, so an audit file taken before this session
still parses.

Optional does not mean skippable. `requireGeometry` fails validation when a
layer a template **declares as a placeholder** has no audited `position` or
`anchorPoint`, or has one recorded as unreadable. Scoped to declared
placeholders deliberately: those are the layers a build reads, and a
decorative layer with no measurable anchor is not a manifest error — proven by
a test that adds a bare `CARD` layer and expects no problems.

`npm run audit:templates` re-run against the running AE; it re-stamped
`templates/library.audit.json` with `aepSha256`
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`, matching
the untouched AEP. `npm run validate:templates` reports **`6 template(s) ok`**.

Three tests were added under `validateTemplates > placeholder geometry`, and
the first **asserts the message text in full**, not the exit code:

> `comp "sub_pop" layer "TXT_MAIN" has no audited position: templates/library.audit.json predates layer geometry. Re-run: npm run audit:templates (After Effects must be open)`

The second asserts the wording when a field was audited but unreadable, quoting
back the reason AE gave. The third is the decorative-layer case above.

### Goal 2 — SFX bound to templates

`templates/manifest.json`:

| template | type | sfxId | offsetS | gainDb |
|---|---|---|---|---|
| `sub_pop`, `sub_pop_ar` | subtitle | — | — | — |
| `kw_slam`, `kw_slam_ar` | keyword | `hit_01` | **0.13** | −20 |
| `img_slide_left`, `img_float` | image | `whoosh_01` | **0** | −24 |

`hit_02` and `whoosh_02` are deliberately unused, for template styles not yet
built.

`npm run validate:templates` still reports **`6 template(s) ok`** and resolves
every declared `sfxId` against the real index; `npm run validate:modes` also
passes.

**Three tests, in `core/src/templates.test.ts`.** The mirrored-gain test the
goal asked for reads both files and requires every binding `gainDb` to equal
its index `defaultGainDb` — equality, not "the binding may override", because a
binding that genuinely wants a different level is a real possibility and this
test is what will force that to be decided explicitly rather than drifting. A
second pins the offsets by element type; a third pins the bindings themselves
and that subtitles stay silent. The session-2 test asserting *no* template
binds anything was replaced, since the ruling supersedes it.

**Goal 2.3 — validation does not check the audio file exists.**
`validateTemplateManifest` checks only that a binding's `sfxId` appears in the
index; `validateSfxIndex` type-checks the `file` string and never opens it. A
`core` test added in session 2 does check existence, but that runs at
`npm run check` time and is not a build-time gate. **Reported, not
implemented**, per instruction.

**Goal 2.4 — derivation now fires, and what it exposes matters more.**
`deriveSfxEvents` is pure (no API), so it was run **read-only** over all five
plans without touching any pipeline stage and without writing anything:

| reel | groups | keywords (templated) | slots (templated) | derived events | stored events |
|---|---:|---|---|---|---:|
| ground-truth | 40 | 0 (0) | 0 (0) | 0 | 0 |
| test-1 | 44 | 2 (**0**) | 4 (4) | **4** — all `whoosh_01` | 7 |
| test-2 | 38 | 3 (**0**) | 0 (0) | 0 | 0 |
| test-3 | 31 | 0 (0) | 0 (0) | 0 | 0 |
| vitasilk | 41 | 3 (**0**) | 5 (5) | **5** — all `whoosh_01` | 8 |

Two findings:

1. **No hit fires anywhere**, because **no keyword on any plan carries a
   `templateId`**. The keyword binding is live and completely unexercised.
2. **The stored events are stale and a re-derive contradicts them.** vitasilk
   stores 8 against 5 derived; test-1 stores 7 against 4. The stored ones carry
   gains **−12 / −9 / −6** and keyword events for `k001`–`k003` — the
   fingerprint of a run against the **stub** manifest, which stopped existing
   in Block 6 session 7. **No plan was rewritten.**

### Goal 3 — where subtitle display timing went (read-only)

No code was changed, no plan written, no pipeline stage run.

**Every site**, file and line:

| site | what |
|---|---|
| `service/src/editplan/types.ts:159-160` | `displayStart?` / `displayEnd?` declared, optional |
| `service/src/analysis/display-timing.ts:20-21` | `displayWindow` — **reads**, falls back to speech |
| `service/src/analysis/display-timing.ts:74` | `applyDisplayTiming` — **computes** |
| `service/src/analysis/display-timing.ts:150` | `return { ...group, displayStart: group.start, displayEnd: end }` — **writes, unconditionally** |
| `service/src/analysis/job.ts:319` | **the only call site**, inside `planImageSlotsForPlan` |
| `service/src/analysis/buildability.ts:75` | reads via `displayWindow` |
| `service/src/analysis/retiming.ts:35` | reads via `displayWindow` |
| `service/src/analysis/timing-budget.ts:111-112` | deliberately clears both, to sweep from speech |
| `service/src/analysis/timing-budget.ts:168` | reads with an inline `?? ` fallback |
| `service/src/editplan/validate.ts:234-241` | validates only when present |

**Goal 3.2 — it exists and is called; it is not a missing function.** Quoted:

```ts
// service/src/analysis/job.ts:319
const timing = applyDisplayTiming({
  groups: plan.subtitles.groups,
  templates,
  reelDurationS: plan.source.durationS,
});
plan.subtitles.groups = timing.groups;
```

```ts
// service/src/analysis/display-timing.ts:150
return { ...group, displayStart: group.start, displayEnd: end };
```

**Goal 3.3 — inputs and cost.** It needs the group list, the templates map and
the reel duration, all already on the plan or on disk. **It is pure local
computation: no API call, no cost.** Verified read-only on vitasilk — it
produces **41 of 41** windows, 0 merges, 1 unbuildable. Nothing was written.

**So why is the field absent?** The only stage that calls it has not been run
since the call was added. The evidence is on the plans: their stored SFX events
still carry the stub manifest's gains, and `deriveSfxEvents` is called eleven
lines after `applyDisplayTiming` in the same function — so both last ran
together, before either the display-timing wiring or the real manifest existed.
The `pre-script-grouping` backups from Block 6 session 6 already contain zero
display timing, which rules out re-grouping as the cause.

**But re-running the stage is not sufficient on its own.** `regroup.ts:167-178`
builds fresh group objects carrying `id`, `wordIds`, `start`, `end`,
`templateId`, `supersededBy` and optionally `edited` — display timing is not
among them, so the next re-group drops it again.

**Goal 3.4 — consumers when it is absent.** All three read through
`displayWindow`, which returns `group.displayStart ?? group.start`. So
`buildability.ts`, `retiming.ts` and `timing-budget.ts` **all silently fall
back to speech timing**. **Nothing skips a group and nothing fails.**
`validate.ts` validates the pair only when both are present.
That silence is the reason this went unnoticed for four blocks.

**Proposing nothing and fixing nothing**, per instruction.

### Goal 4 — one subtitle card, placed

**4.1 — the group.** `vitasilk.editplan.json`, group **`g027`**, index 26 of
41; wordIds `w0045`, `w0046`; text **`dernière génération`**; start **14.439**,
end **15.319** (duration 0.880 s against a 0.23 s floor); both words `latin`,
lang `fr`; `templateId` **`sub_pop`**; `supersededBy` null.

**The card is timed on its speech window, because no plan carries display
timing** (goal 3). This is a stated limitation of the probe, not a decision
about how the builder will work.

**4.2 — where the code lives.** `panel/jsx/build.jsx` (ES3: `var` only, no
arrow functions, no `const`/`let`), with `panel/jsx/json2.jsx` installing
`JSON.stringify` when the host lacks one. Driver in `service/src/build/` —
`drive.ts` (the `DoScript` transport and the instance guard) and
`build-comp-cli.ts`, wired to `npm run build:comp`. It follows
`tools/validate-templates/cli.ts` rather than inventing a second mechanism.

**The AppleScript names `Adobe After Effects 2026` as a literal string**
(`AE_APPLICATION` in `drive.ts`), so this is machine-specific: another AE
version or a differently-named install silently fails to find the app. Block
10 needs a golden run on a second machine and this is one of the things that
will not survive it unmodified.

**4.3/4.4 — what After Effects actually did.** Every line was an assertion
before today.

| | requested | AE reports | difference |
|---|---|---|---|
| master fps | 29.97002997003 | **29.9700317382812** | +1.7683e-06 |
| inPoint | 14.309 | **14.309017350684** | +0.0000174 s = **+0.00052 frames** |
| outPoint | 15.319 | **15.318986** | −0.0000143 s = **−0.00043 frames** |
| baseline y | 2480.4 | **2480.39990234375** | **−9.77e-05 px** |

**AE stores frame rate as a float32, and the master and the library comps hold
different ones.** The library comps read **29.9700012207031** — the value of a
comp authored by typing "29.97" — while a comp created from the exact rational
30000/1001 reads **29.9700317382812**. Both pass `REQUIRED_FPS` 29.97 within
its tolerance. The gap is 3.05e-05 fps, about 7.8e-04 frames across a 25.7 s
reel, so it changes nothing today. It is recorded because "the comps and the
master run at the same frame rate" is now known to be false in the strict
sense, and a 90 s reel plus a longer pipeline is where that stops being
harmless.

**The position arithmetic**, every term named and sourced:

```
target baseline        core/src/typography.ts
                       SUBTITLE_ANCHOR_X = 1080, SUBTITLE_ANCHOR_BASELINE_Y = 2480.4
placeholder baseline   templates/library.audit.json, sub_pop / TXT_MAIN,
                       position.valueAtSampleTime = [1080, 700, 0]
                       (anchorPoint [0,0,0], so position IS the baseline)
comp-layer anchor      read back from AE after the layer was added: [1080, 550, 0]
                       (half of 2160 x 1100 — measured, not assumed)

position = target − (placeholder − anchor)
  x = 1080   − (1080 − 1080) = 1080
  y = 2480.4 − ( 700 −  550) = 2330.4
```

AE stored `[1080, 2330.39990234375, 0]` and the baseline landed at
**y 2480.39990234375** — float32 storage of 2330.4, four orders of magnitude
below a pixel.

**Importing `library.aep` brings 11 items**, not 6: a `library.aep` folder, the
six comps, a `Solids` folder, and the three solid footage items (`CARD`,
`solid`, `solid`) the image comps use.

**Nothing was disturbed:**

- **Keyframes survived duplication exactly** — `Fast Box Blur/Blur Radius` 2,
  `Transform/Position` 2, `Transform/Opacity` 2, identical before and after.
- **`TXT_MAIN`'s style is unchanged after the Source Text swap** —
  `Inter-SemiBold`, 343, justification raw 7415, tracking 0.
- **The original `sub_pop` is unmodified** — 1 layer, source text still
  `kan9olo`, same three animated properties with the same keyframe counts, same
  style. Checked after the duplication and the text swap, not before.

Saved to `.local/build/vitasilk-probe.aep` (659,003 bytes).
`git check-ignore` confirms `.gitignore:1` (`.local/`) covers it; it is not
committed.

**4.5 — the structured-error contract holds.** Three deliberate failures, each
run for real against the running AE, each returning valid JSON with nothing
thrown:

```json
{"ok":false,"stage":"find-template","message":"Error: no comp named \"sub_does_not_exist\" in /Volumes/T7 Shield/INSEA/Projects/framopia-studio/templates/library.aep"}
```
```json
{"ok":false,"stage":"find-template","message":"Error: comp \"sub_pop\" has no layer named \"TXT_NOPE\""}
```
```json
{"ok":false,"stage":"import-footage","message":"Error: footage not found: /Volumes/T7 Shield/nope/missing-reel.mov"}
```

### Goal 5 — a solid `IMG_MAIN` does accept a replaced source

**It succeeded**, by **`AVLayer.replaceSource(FootageItem, false)`**.

Candidate used: **`img001-c1`** of vitasilk slot `img001`, as
`my files/test videos/cutouts/img001-c1.cutout.png`.

| | before | after |
|---|---|---|
| kind | `solid` | **`footage`** |
| source | (solid) | `img001-c1.cutout.png` |
| **width x height** | **1000 x 1000** | **2048 x 2048** |
| **anchorPoint** | **[500, 500, 0]** | **[1024, 1024, 0]** |
| position | [540, 540, 0] | [540, 540, 0] |
| scale | [100, 100, 100] | [100, 100, 100] |
| animated | Blur Radius 2, Opacity 2 | Blur Radius 2, Opacity 2 |

**Transforms and keyframes survived.** Position, scale and both keyframed
properties are identical.

**The layer takes the new source's size, and that is a builder requirement.**
Width and height went 1000 → 2048 and AE rescaled the anchor point with them —
[500,500] → [1024,1024] is the same *relative* point, the centre of the layer.
Scale stayed at 100%, so a replaced image renders at **2048 px inside a 1200 px
comp, 171% of comp width**. **The builder must set scale explicitly after
replacement**; the template's 100% is only correct for the original solid.

Placed in the master comp at [1080, 900] over 14.309–15.319 s so the user can
see it. No placement solver was run and no zone was consulted.

## Deviations

1. **`AuditLayer` was widened in `core/src/templates.ts`, not
   `tools/validate-templates/cli.ts`.** The goal named the CLI, but the type is
   declared in core and imported by the CLI. Widening it where it is declared
   is the only place that works.

2. **`panel/jsx/json2.jsx` is a minimal guarded shim, not the vendored
   json2.js.** It installs `JSON.stringify` only when the host has none, and
   implements stringify alone — the driver passes options in through a file, so
   only the return direction needs serialising. Vendoring ~500 lines for one
   function that AE 26 already provides seemed the worse trade; the guard means
   it costs nothing where JSON exists and works where it does not.

3. **Goal 4.5's three failures were driven through `runBuild` directly rather
   than through `npm run build:comp`.** For two of the three the CLI fails
   *earlier* with its own message — it checks the audit for the template and
   exits before reaching AE — so driving through the CLI would have proved the
   CLI's guard and left the ExtendScript contract untested. The failures were
   run against the real committed `build.jsx` through the real committed
   driver.

4. **Goal 5 used a PNG from `my files/test videos/cutouts/`, not
   `.local/cache/`.** The goal asked for a generated PNG in the cache; **the
   cache contains no PNGs** — the API returns `image/jpeg` and every cached
   candidate is `image.jpg`. The cutout is the same candidate (`img001-c1`),
   is a PNG, and carries alpha, which is the harder case.

5. **`npm run probe:image` was added.** Goal 5 did not ask for a command, but
   the alternative was committed code with no caller. The claim it settles is
   about After Effects rather than about this repo, so it has to be
   re-checkable on another machine and another AE version.

## Failures & open problems

- **`applyDisplayTiming` was not run for real and no plan was rewritten.** Goal
  3 was explicitly read-only. So the corpus still has zero display timing, and
  every buildability, retiming and timing-budget figure this project has
  published is measured on speech windows. Fixing it needs a decision about
  `regroup.ts` too, since it would drop the field again.

- **The stored SFX events on vitasilk and test-1 are stale and were left
  stale** — 8 stored against 5 derived, and 7 against 4, with gains from a stub
  manifest that no longer exists. Nothing was lost or deleted; the stale data
  is still on disk exactly as it was.

- **No keyword anywhere carries a `templateId`**, so `hit_01` has never fired
  and the keyword→hit binding is completely unexercised. Whether that is a
  defect in `assignTemplates` or simply a stage that has not been re-run is
  **not established** — I did not investigate it, because doing so was outside
  all five goals.

- **The card was looked at by AE, not by a human, and not by me.** Everything
  reported is a number AE returned. Whether `dernière génération` at 343 px
  actually *reads* on a 2160 x 3840 frame, whether it sits where a designer
  would want it, and whether the intro animation looks right at 4 frames are
  all still unjudged. That is the point of leaving it on screen.

- **One instance, one reel, one group, one template.** `sub_pop_ar` has never
  been instanced; nothing has placed two cards; the overlap question from
  session 2 (86% of consecutive pairs under the guide's reading) is untouched
  because a single instance cannot overlap anything.

- **The frame-rate mismatch is recorded, not resolved.** The library comps and
  a master built from 30000/1001 hold different float32 frame rates. It is
  harmless at 25 s and nobody has checked what it does at 90 s.

- **`npm run build:comp` starts a new project every time**, discarding whatever
  was open without asking. That is correct for a probe and wrong for a panel a
  designer is using. Nothing guards it.

- **The image probe's placement is arbitrary** — [1080, 900] at 100% scale, so
  the 2048 px image overflows its 1200 px comp. Deliberate: goal 5 forbade
  running the placement solver, and the overflow is the finding.

- Carried forward untouched: whole-term grouping is unimplemented (11 §6 terms
  render split); the pipeline is 4K-only; `npm run validate-plan` reports 11
  duration failures where `npm run timing-budget` reports 7 (**trust the 7**);
  the image gate's yield on vitasilk was 2/10.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 3 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit that contains it.
- Commits this session, in order: `feat: audit layer geometry and require it on
  placeholders`; `chore: re-stamp the template audit with layer geometry`;
  `feat: bind hits to keywords and whooshes to images`; `feat: place a subtitle
  card and probe image source replacement`; `docs: record block 7 session 3 in
  the operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **949 passed** across
  66 files (core 151 / 6, service 632 / 44, benchmarks 166 / 16); Python **141
  passed**. `validate-templates: 6 template(s) ok`; modes and manifest ok; all
  four references `v1.0.8-conformant`; both model pins ok.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — identical
  to the start-of-session values. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical to the start-of-session value. Opened only as an import source;
  never written.
- **After Effects instances: 1 at session start, 1 at session end**, PID 44015
  throughout. The count never changed. Nothing was launched, nothing was
  killed, and no `-r` was used.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

Look at the card before writing another line of the builder. Everything
measured today says the machinery is correct — the baseline lands within
0.0001 px of where the arithmetic says, the keyframes survive, the original
template is untouched — but "correct" and "right" are different questions, and
the second one needs a designer's eye on a 343 px line of French sitting at
y 2480 on a 4K vertical frame. The one decision waiting behind that look is the
retiming reading: the guide as written starts each card's intro 0.13 s before
its words, which overlaps the previous card on 86% of transitions, and the
alternative starts the intro on the word and is still fading in as you hear it.
A single instance cannot show that, so the next build should place two adjacent
cards under each reading and let the difference be judged rather than argued.

## What to look at in After Effects

After Effects is open with a project called **vitasilk-probe**, and the comp
you want is **master_vitasilk** — the full 4K vertical reel, 25.7 seconds. The
playhead is parked at about **14.9 seconds**, which is the middle of the shot
where the card appears.

Two things are on screen.

**The subtitle card.** It reads *dernière génération*, in Inter Semi-Bold at
343 px, sitting where the type spec says a subtitle should sit. This is the
first time this project has put a subtitle on a frame. What is worth your eye:
does it read at a glance, is it too big or too small for the frame, and does
it sit at the right height against the speaker — not too close to the chin,
not floating. Scrub back a few frames to about 14.3 s and you will see it
animate in: a 4-frame move up with a blur clearing and opacity coming on. The
whole entrance is four frames, which is fast; tell me if it feels snatched.

**The image.** A generated hair-serum picture sits above the card. **Ignore
where it is and how big it is** — it is deliberately dumped at an arbitrary
spot at full size, because the only question being asked was whether After
Effects would let the template swap in a real picture at all. It does. It also
came in at 2048 px inside a 1200 px frame, which is why it looks oversized;
that is a known thing to fix, not a mistake to report.

Nothing else in the project is finished. There is only one card — the reel has
41 of them — and no keyword, no watermark and no sound yet.
