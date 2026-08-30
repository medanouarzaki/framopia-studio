Status: PROBLEM — kw_slam's visible layer is named "TXT_MAIN " with a trailing space

# Block 9 session 9 — the rename is right in three comps and one character wrong in the fourth

**Spent $0.00. No API was called.** After Effects was driven over AppleScript
`DoScript` into the already-running instance; never launched, never quit, no
`aerender`, no `-r` process. **`templates/library.aep` was read and audited,
never written** — its sha256 is identical at both ends of this session.

**Steps 2 to 6 were not attempted**, and the reason is not a judgement call:
`npm run check` exits 1 on his file as it stands, so Step 7's requirement that
it pass could not be met by any amount of work here.

## 1. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, same sha256 — byte-identical |
| cache at start | **36 entries** — 11 transcription, 7 analysis, 4 imageslots, 14 images |
| cache at end | **36 entries, census identical** |
| After Effects at start | **1 instance, pid 79146, started Thu Aug 27 21:00:05** |
| After Effects at end | **1 instance, pid 79146, started Thu Aug 27 21:00:05** — same process |
| `aerender` at start / end | **0 / 0** |
| `library.aep` at start | `932e583a90a72f2fa8e3f7e653f0d91e67b719c18454f48adfe2e1e7d1acc69c` |
| `library.aep` at end | **identical** |

It differs from session 8's `1d265d1f…` because of the rename, which is
expected. 551,435 bytes, saved 01:22.

## 2. The rename, verified comp by comp

**The design is exactly as ruled, in all four comps.** Layer 1 is the light
visible word, layer 2 the red offset copy beneath it.

| comp | layer 1 (top) | layer 2 (below) | offset |
|---|---|---|---|
| `sub_pop` | `TXT_MAIN` — `#F4F4F4`, Inter-SemiBold 343 | `TXT_MAIN_SHADOW` — `#820000`, 343 | +8 / +15 |
| `sub_pop_ar` | `TXT_MAIN` — `#F4F4F4`, Almarai-Bold 367 | `TXT_MAIN_SHADOW` — `#820000`, 367 | +8 / +15 |
| `kw_slam` | **`TXT_MAIN `** — `#F4F4F4`, Inter-SemiBold 425 | `TXT_MAIN_SHADOW` — `#820000`, 425 | +8 / +15 |
| `kw_slam_ar` | `TXT_MAIN` — `#F4F4F4`, Almarai-Bold 455 | `TXT_MAIN_SHADOW` — `#820000`, 455 | +8 / +15 |

The offset is a Transform effect on the shadow layer, Anchor Point
`[1080, 550]` against Position `[1088, 565]`.

**Everything else on the checklist passes:**

- **The light layer is on top in all four.** Layer 1 is the `#F4F4F4` one
  everywhere; the red copy is layer 2. Both enabled.
- **The second text layer is called `TXT_MAIN_SHADOW`** in all four, exactly as
  asked, 15 characters, no surprises.
- **Comp settings unchanged**: 2160 × 1100, 29.97 fps, 2.0020 s, all four.
- **Type sizes unchanged**, and the same on both layers of each comp: 343, 367,
  425, 455.
- **Every keyframe time, value and easing is unchanged** — compared property by
  property against session 8's audit for all six comps, including the two image
  comps, and identical throughout. Read from `valueAtSampleTime`, never `value`.
- **The impact frame still derives to 4.06 frames on all six comps**, so no
  sound moves.
- **No stroke on any layer**, which is the ruling and not a defect.

I did not find a separate black shadow effect anywhere — the shadow is the red
offset copy and a Fast Box Blur that was already there. Recording that because
the brief mentioned one and it is not in the file.

## 3. The one character

**`kw_slam`'s visible layer is named `TXT_MAIN ` — nine characters, the last one
a space (code 32).** The other three comps are exactly `TXT_MAIN`, eight
characters.

Read straight out of the audit, character codes included:

```
kw_slam      "TXT_MAIN "        len 9   codes 84,88,84,95,77,65,73,78,32
kw_slam_ar   "TXT_MAIN"         len 8   codes 84,88,84,95,77,65,73,78
sub_pop      "TXT_MAIN"         len 8
sub_pop_ar   "TXT_MAIN"         len 8
```

**The existing template validator already catches it**, which is the good news —
this is not a hole, it is a guard doing its job:

```
validate-templates: 1 problem(s)
  - comp "kw_slam" declares placeholder "TXT_MAIN" but has no layer of that name (layers present: TXT_MAIN , TXT_MAIN_SHADOW)

npm run check exit code: 1
```

**`findLayer` in `build-reel.jsx` matches on an exact name**, so a build would
not find the placeholder in `kw_slam` and would stop there. That is a loud
failure rather than a wrong reel — unlike session 8's defect — but it is still a
stop, because `vitasilk`'s three keywords are all Latin and every one of them
uses `kw_slam`.

**Nothing was changed to work around it.** Not the layer name, not `findLayer`,
not the validator. A guard is narrowed by a ruling, never by a session that
wants to keep going, and trimming whitespace when matching a layer name would be
exactly that — layer names are matched exactly on purpose.

## 4. What was not done, and why

- **Step 2, fill both layers.** Not attempted. The work is straightforward and I
  could have written it, but it could not have been verified: Step 6's rebuild
  fails at `kw_slam`, so I would be shipping the central change of the session
  with no build behind it. That is the shape of defect these sessions keep
  finding.
- **Step 3, the undeclared-text-layer rule.** Not attempted, and this one is
  impossible rather than unwise. The rule is "every text layer is either a
  declared placeholder or declared as left alone". On his current file
  `TXT_MAIN ` is neither, so the rule would fail validation on his own
  templates, and Step 7 requires `npm run check` to pass. It cannot until the
  name is fixed.
- **Step 4, the band.** The shadow offset is measurable — it is +8 / +15 from
  the Transform effect and I have it — but re-deriving zones and placements and
  then proving the band moved needs a build to check against.
- **Step 5, the shadow colour field.** `#820000` is known and the field is one
  line. Left undone because adding a schema field in a session that cannot run
  the check to green is how a half-migration gets committed.
- **Step 6, rebuild.** Refused: it would fail at `kw_slam`.

## 5. Deviations

- **Nothing was committed.** Session 8 committed his pass and the re-stamped
  audit; this session does not, because `npm run check` now exits 1 and
  committing would leave `main` red. Both files are on disk and tracked as
  modified — `templates/library.aep` is his and untouched by me, and
  `templates/library.audit.json` is the re-stamped record of it, which is
  correct and which is what makes the validator's message accurate. They are
  one layer rename away from being committable together.

## 6. Failures and open problems

- **The working tree is not clean.** `templates/library.aep` and
  `templates/library.audit.json` are modified and uncommitted, deliberately, per
  the deviation above. Nothing is lost: his pass is on disk exactly as he saved
  it.
- **`npm run check` is red** for the one reason above and no other. Every test
  suite passes; the single failure is the template validator on `kw_slam`.
- **`library.aep` is open in After Effects**, left from session 8 and
  re-opened read-only by this session's inspection. It was clean when checked.
  While it is open an accidental edit and save would change the source of truth.
- **`SUBTITLE_BAND` still knows only Inter and Almarai**, and now also knows
  nothing about the shadow's +8 / +15 offset. Both gaps are unchanged and both
  are ready to close the moment a build can run.
- **The audit still records no fill colour.** Everything about the light and red
  layers in §2 came from a separate read-only inspection rather than from the
  audit, which means the audit alone cannot tell you which layer is the shadow.
  That is worth fixing when the shadow becomes a declared thing.
- No cache entry, plan, reference, ledger line or template content changed.

## 7. Repo state

- Branch **`main`**, HEAD unchanged at
  **`14b98d4 docs: report block 9 session 8`** plus this report.
- Working tree carries the two modified template files described above.
- **`npm run check`: FAILS, exit code 1**, with exactly one problem:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v9: ok (fonts set)
templates: 6 entries, ok
extendscript: 11 .jsx file(s) ok
validate-templates: 1 problem(s)
  - comp "kw_slam" declares placeholder "TXT_MAIN" but has no layer of that name (layers present: TXT_MAIN , TXT_MAIN_SHADOW)
```

Every workspace's tests pass on the way to that failure — core, service,
benchmarks and panel all green, and the sidecar's pytest suite green — but I am
not quoting counts as a result when the run they came from exited 1.

## 8. Suggested next step

One layer needs renaming in After Effects and it is a single character: in
`kw_slam`, the light top layer is called `TXT_MAIN ` and needs to be `TXT_MAIN`,
with the trailing space removed. The other three comps are already right.

Once that is done everything else in this session's plan is unblocked and should
go in one pass: fill `TXT_MAIN` and `TXT_MAIN_SHADOW` with the same word, font
and size while leaving the shadow's `#820000` alone; declare the shadow in the
manifest and amend `docs/TEMPLATE_LIBRARY_GUIDE.md` §4, which currently says
extra layers are never touched; add the rule that an undeclared text layer fails
validation; put the measured +8 / +15 shadow offset and Cormorant's extents into
`SUBTITLE_BAND` and re-derive zones and placements; add the one client field for
the shadow colour; and rebuild `vitasilk` to confirm no layer anywhere still
reads `kan9olo`, `Booster`, `المنطقة` or `شد طبيعي`.
