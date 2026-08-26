Status: OK

The six comps are committed, the manifest is real, and the validator audits the
built AEP and fails loudly on seven deliberately broken copies. Block 6's
definition of done is met. No API call was made and nothing was billed.

## Done

**Session-start checks.** T7 mounted, repo at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. `git status
--untracked-files=no` empty; `templates/library.aep` untracked as expected.
Ledger sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`,
**108 lines**. Session 6's commits were local and were **pushed**:
`origin/main` went `a16ea9c` → `0cf2462`.

### Goal 1 — the AEP

`templates/library.aep`, committed alone as `8f5674b`.

- **432,197 bytes**
- **sha256 `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`**
- `git check-ignore` exits 1 — **not ignored**. `.gitignore` carries `*.aep~`
  (autosave) only, so ARCHITECTURE §2's requirement that template AEPs be
  committed is satisfied.

### Goal 2 — the manifest

`templates/manifest.json` rewritten with six entries. **`stub` is `false`, not
removed** — `validateTemplateManifest` requires the key to be a boolean, so
deleting it fails validation. `assertRenderable` no longer throws.

All six: `introS` 0.13, `outroS` 0, `minHoldS` 0.10, `anchor: "center"`,
`sfx: []`. `img_slide_left` is `cutout`, `img_float` is `card`, the four text
comps are `null`.

`modes/k2-syndicalia.json` is **v6**, with `sub_pop_ar` and `kw_slam_ar` added
to `allowedTemplates`.

**Which caches the bump invalidates, precisely:**

| stage | keys on | affected |
|---|---|---|
| analysis / keywords | `keywordModeContentHash` — client name, vocabulary | **no** |
| analysis / slots | `slotModeContentHash` — client name | **no** |
| prompt composition | `compositionContentHash` — palette, imageStyle, axes | **no** |
| **image generation** | `modeId` **and `modeVersion`** | **yes** |

`service/src/images/fingerprint.ts` carries `modeVersion` in its inputs, so
**14 cached image entries are now unreachable and would regenerate at roughly
$1.55** if `npm run images` runs. Nothing was re-run this session and nothing
was billed. This is the cost of the bump and it is the user's to spend or not.

### Goal 3 — the validator

**Can ExtendScript run headlessly here? Partly, and the distinction matters.**

- **`-r` from a cold launch does not work.** A script whose entire body is
  `app.quit()` left After Effects running for 120 s. The GUI comes up and the
  script is never reached, so nothing writes and nothing exits. `aerender`
  exists but renders comps; it has no script-run mode.
- **AppleScript `DoScript` into an already-running instance does work.**
  AE **26.0x67**, and it writes files, so the scripting file-access preference
  is on. This is what the audit uses.

**Nothing parses the binary `.aep`.** `file` reports it as RIFF; guessing at
that format and calling the result an audit would certify comps never read.

`tools/validate-templates/audit.jsx` is the §9 ExtendScript run: it opens the
project and dumps every comp's name, frame rate, size, duration and layers with
their kinds. `tools/validate-templates/cli.ts` has two modes:

- **`npm run audit:templates`** drives AE and writes
  `templates/library.audit.json`, stamped with the `.aep`'s sha256. Needs AE
  open.
- **`npm run validate:templates`** checks the manifest against that dump. No
  AE, fast, and **wired into `scripts/check.sh`** beside `validate:modes`.

**The audit is stamped so it cannot go quietly stale.** A `.aep` edited after
its audit fails with a message saying so and naming the re-run command, rather
than being validated against an out-of-date picture of itself.

The pure comparison lives in `core/src/templates.ts` as `validateTemplates`,
beside the manifest validation it belongs with, and is unit tested without AE —
**16 new tests** in `core/src/templates.test.ts`.

It fails on all seven required conditions: a manifest id with no comp; a
`sub_`/`kw_`/`img_` comp with no manifest entry; a placeholder missing or of
the wrong kind; fps ≠ 29.97; `introS + minHoldS + outroS` over comp duration;
an `sfxId` `assets/sfx/sfx.json` does not define; and
**`introS + outroS > 0.13`**, the measured budget, which §9 does not list.

**What the audit found in the built library** — six comps, all 29.97 fps, all
2.002 s:

| comp | size | layers |
|---|---|---|
| `sub_pop` | 2160x1100 | `TXT_MAIN` (text) |
| `sub_pop_ar` | 2160x1100 | `TXT_MAIN` (text) |
| `kw_slam` | 2160x1100 | `TXT_MAIN` (text) |
| `kw_slam_ar` | 2160x1100 | `TXT_MAIN` (text) |
| `img_slide_left` | 1200x1200 | `IMG_MAIN` (solid) |
| `img_float` | 1200x1200 | `IMG_MAIN` (solid), `CARD` (solid) |

`img_float`'s decorative `CARD` layer is handled: only declared placeholders
are checked, and an undeclared layer is ignored.

**`IMG_MAIN` is a solid, not the placeholder still §4 suggests.** A solid's
source replaces exactly as well, so the validator accepts `footage` or `solid`
for it and rejects `text`. Recorded rather than failed — requiring a PNG would
reject a working build for no functional reason.

### Goal 4 — proving it fails

**Four of the seven fixtures are real broken `.aep` files**, produced by
scripting AE to open the library, break one thing, and `save()` to a copy.
**`templates/library.aep` was never mutated** — its sha256 is unchanged at
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`, verified
after the fixture build. Each broken copy was audited for real through the same
AE path, not hand-edited JSON.

Verbatim, each exiting **1**:

**1. missing placeholder** (`TXT_MAIN` deleted from `sub_pop`)
```
validate-templates: 1 problem(s)
  - comp "sub_pop" declares placeholder "TXT_MAIN" but has no layer of that name (layers present: none)
```

**2. renamed comp** (`kw_slam` → `kw_slam2`)
```
validate-templates: 2 problem(s)
  - manifest template "kw_slam" has no comp of that name in library.aep
  - comp "kw_slam2" looks like a template but templates/manifest.json has no entry for it
```

**3. wrong fps** (`img_float` set to 30)
```
validate-templates: 1 problem(s)
  - comp "img_float" is 30 fps; 29.97 is required (every source reel is 30000/1001)
```

**4. wrong layer kind** (`sub_pop_ar`'s `TXT_MAIN` replaced with a solid)
```
validate-templates: 1 problem(s)
  - comp "sub_pop_ar" layer "TXT_MAIN" is a solid layer; an editable text layer is required
```

**5. over-budget intro+outro** (manifest fixture, `kw_slam` `outroS` 0.15)
```
validate-templates: 1 problem(s)
  - comp "kw_slam" spends 0.280s on intro+outro; the measured budget is 0.13s (introS 0.13 + outroS 0.15) — see docs/TEMPLATE_BUILD_SPEC.md §4
```

**6. stale audit** (audit of the real library, checked against a different AEP)
```
validate-templates: 1 problem(s)
  - templates/library.audit.json is stale: it was taken from a different templates/library.aep (audit dac234ce443e, file 89ac3e4153aa). Re-run: npm run audit:templates
```

**7. unknown sfxId** (manifest fixture, `img_float` binds `whoosh_99`)
```
validate-templates: 1 problem(s)
  - comp "img_float" binds sfxId "whoosh_99", which assets/sfx/sfx.json does not define
```

Every message names the comp; the placeholder messages name the layer and list
the layers that are present.

### Goal 5 — the real timings

**7 of 190 subtitle groups unbuildable — unchanged from session 6.**

**It does not differ, and the reason is that the user built to the spec.** The
comps' timings are `introS` 0.13 + `outroS` 0 + `minHoldS` 0.10, a **0.23 s
floor**, which is exactly the sweep's loosest grid cell — the one session 6
already reported 7 of 190 at. The stub's old 0.33 s floor is gone. So this run
**confirms** the number rather than moving it, which is the outcome
`docs/TEMPLATE_BUILD_SPEC.md` was written to produce.

`benchmarks/RESULTS-block6-timing-budget.md` regenerated; the sweep still finds
no clean cell.

**`npm run validate-plan` reports 11 duration failures and it is not
comparable**, which is worth stating because the two numbers invite being read
side by side. It reads **stored** `displayStart`/`displayEnd`, which no plan
has, so it measures the case with no extension into silence and no merge; and
it **skips any group with no `templateId`**, which is every group on
ground-truth, test-2 and test-3. Three of five reels are not duration-checked
by it at all. The 11 is test-1's 6 and vitasilk's 5.

## Deviations

- **`validateTemplates` was moved into `core/src/templates.ts`** rather than
  left in `tools/`. Nothing under `tools/` is in a vitest glob, so the pure
  logic would have had no unit tests at all; core already holds the manifest
  validation it sits beside.
- **Three fixtures beyond the four required** — stale audit, unknown sfxId,
  over-budget. The first two exercise checks the goal listed but did not ask to
  be proven, and the staleness guard is the one thing standing between this
  validator and certifying an unaudited file.
- **Two existing tests were changed, both because reality changed.**
  `core/src/templates.test.ts` asserted the manifest was still a stub;
  `core/src/mode.test.ts` pinned the mode at version 5. Both now assert the new
  state and say why.
- **`npm run check` does not run the AE audit.** It validates the committed
  audit and refuses a stale one. Driving AE takes minutes and needs the app
  open, which would make the gate unusable on a machine without it.

## Failures and open problems

- **`npm run check` cannot detect a `.aep` whose audit was never taken.** It
  detects a *stale* audit by hash, and a *missing* one by absence, but if
  someone commits a new `.aep` and a matching audit taken from a broken AE
  session, the gate trusts it. The audit is only as good as the run that
  produced it.

- **The audit depends on an AE instance being open, and on its version string.**
  `cli.ts` targets `Adobe After Effects 2026` by name in the AppleScript. A
  different AE version needs that string changed; it is not discovered.

- **`aerender` was not tried as an audit path** beyond confirming it exists.
  It has no documented script-run mode, so I did not pursue it, but I did not
  exhaustively rule it out either.

- **`IMG_MAIN` being a solid is a departure from §4 that nothing downstream has
  exercised.** The builder does not exist yet, so "a solid replaces exactly as
  well as a still" is a claim about AE's API, not something this pipeline has
  demonstrated.

- **`outroS: 0` has never been through a build.** The validator accepts it and
  the timing sweep counts it, but no comp has been retimed by the system, so
  the intro+hold structure with no outro phase is untested end to end.

- **The mode bump stranded 14 cached images** (~$1.55 to regenerate). Nothing
  forced this — the fingerprint keys on `modeVersion` deliberately — but adding
  two template ids that no image call reads is exactly the over-invalidation
  session 4 fixed for the analysis stages and did not fix for images.

- **`assertRenderable` now passes**, so the guard that kept rendering stages
  away from placeholder timings is off. The SFX index is still a stub, and
  nothing checks *that* before a build.

## Amendments to propose

### TEMPLATE_LIBRARY_GUIDE §3, frame rate

Current: "**Settings:** 30 fps (matches footage — mandatory)."

Proposed: "**Settings:** **29.97 fps** (30000/1001 — matches footage,
mandatory). PROJECT_SPEC's '30 fps' predates anyone reading a file header;
every source reel this project has handled is 30000/1001, and Block 5's frame
sampling reads real presentation timestamps that diverge from a nominal 30 fps
grid from the second frame onward. `npm run validate:templates` requires 29.97
and rejects 30."

### TEMPLATE_LIBRARY_GUIDE §3, comp size

Current: "subtitle/keyword comps: 2160 wide × a sensible band height (e.g.,
2160×600)".

Proposed: "subtitle/keyword comps: **2160×1100**. The 600 px band in earlier
drafts cannot hold a two-line keyword — Block 6 session 4 measured the
worst-case type block, two lines at the keyword size in Almarai Bold, at
**1017.4 px** from the top of the ascent to the bottom of the descender."

### TEMPLATE_LIBRARY_GUIDE §5, the outro phase

Current: "All *exit* keyframes start at `outS`."

Proposed: add — "**`outroS` may be 0, and for subtitles it is.** A subtitle
card hard-cuts into the next one, which is the fast-reel convention and spends
the whole animation budget on the entrance. The structure is then intro + hold
with no outro phase, and `outroS: 0` is a legitimate declared value rather than
a missing one. Validation must accept it."

### A new known limitation: the pipeline is 4K-only

PROJECT_SPEC §4 locks 2160×3840 and nothing reads a frame size from the
footage. **Scoped, not implemented.**

**Hardcoded absolute pixels that would need converting:**

| constant | file | note |
|---|---|---|
| `FRAME_WIDTH`, `FRAME_HEIGHT` | `service/src/placement/constants.ts` | |
| `SOURCE_WIDTH`, `SOURCE_HEIGHT` | `service/src/frames/zones.ts` | **a second copy of the same fact** |
| `SUBTITLE_ANCHOR_X`, `SUBTITLE_ANCHOR_BASELINE_Y` | `core/src/typography.ts` | measured off a 4K delivery |
| `SUBTITLE_FONT_SIZE`, `KEYWORD_FONT_SIZE`, `LINE_SPACING` | `core/src/typography.ts` | |
| `COMP_SIDE_PX` | `service/src/placement/constants.ts` | 1200, the image comp side |
| comp sizes 2160×1100 and 1200×1200 | `templates/library.aep` | **the hard half — authored, not computed** |

**Already fractions of the frame, and scale on their own:**
`BOTTOM_EXCLUSION`, `MIN_ZONE_SHORT_EDGE`, `MIN_PLACED_SHORT_EDGE`,
`CARD_EDGE_CLEARANCE`, `CUTOUT_EDGE_CLEARANCE`, `FILL_FRACTION`,
`SCALE_JITTER`, `ZONE_MARGIN`, `LATERAL_INSET`, `VERTICAL_INSET`,
`HEAD_CLEARANCE`, `PERSON_COMPONENT_FLOOR`, `GRID_DOWNSAMPLE`, and the entire
`SUBTITLE_BAND` derivation, which divides by `FRAME_HEIGHT` at the end.

The first step, whenever it is taken, is collapsing the two duplicated frame-size
declarations into one, since they can already drift today.

## Repo state

- Branch `main`, clean apart from `CLAUDE.md`, staged into the report commit.
  `origin/main` is at `0cf2462` — **session 6's commits were pushed this
  session; this session's own commits are local and unpushed.**
- **HEAD at the time of writing is
  `716a125 docs: regenerate the timing budget against the real manifest`**,
  preceded by `cd3cf19 test: pin the mode at version 6 with both script
  variants`, `9659a32 feat: validate the template manifest against the built
  aep`, `21193a7 feat: fill the template manifest from the built comps` and
  `8f5674b feat: add the template library after effects project`. **The commit
  carrying this report follows HEAD and cannot be named here.**
- **`templates/library.aep` sha256 unchanged from the moment it was committed:**
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.
- **Ledger `.local/costs.jsonl`, session start and session end, identical:**
  sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`,
  **108 lines** at both ends. No billable call was made.
- **`npm run check`: exit code 0, `check: PASS`.** core 145 tests / 6 files,
  service 617 / 43, benchmarks 166 / 16 — **928 TypeScript tests**, up from 910
  (+16 validator, +2 mode). pytest **141 passed**, unchanged.
  `validate-templates: 6 template(s) ok, audited against library.aep` runs
  inside the gate.

## Suggested next step

Block 6 is done and Block 7 is the builder, so the next session should start
where the validator stops: it proves the comps match the manifest, but nothing
has yet retimed one. The first thing worth doing is the smallest possible end
to end — take one reel, assign templates to its groups, and have ExtendScript
place a single `sub_pop` instance at the measured anchor with its intro at the
group's display start — because that one instance tests four things this block
could only assert: that `outroS: 0` retimes correctly with no outro phase, that
a 29.97 fps comp lands on a 29.97 fps timeline without drift, that the baseline
anchor at y 2480.4 puts the type where session 3's arithmetic says, and that a
solid `IMG_MAIN` really does accept a replaced source. Drive it the way this
session's audit does — a running After Effects over `DoScript` — since `-r` is
now known not to work on this machine, and that constraint should shape the
builder's design rather than be discovered again in the middle of it.
