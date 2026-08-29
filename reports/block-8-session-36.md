Status: OK

Session 36. HEAD at the start `adb7469`, at the end `2f30108`; this report's own
commit follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, After Effects not contacted.** One After
Effects instance and zero `aerender` processes at the start, unchanged at the end.

## Done

### Goal 1 — the pictures are different sizes

**Diagnosed before anything was changed.** Every figure read from
`topLeftPlacementDetail` against the real face masks; no build, no model call.

| reel | slot | corner holds | jitter took | placed | bounded by |
|---|---|---:|---:|---:|---|
| vitasilk | img001 | 937 | 24 | 912 | the space above the speaker |
| vitasilk | img002 | **837** | 36 | 801 | **the space beside the speaker** |
| vitasilk | img003 | 905 | 53 | 852 | the space above the speaker |
| vitasilk | img004 | 925 | 7 | 917 | the space above the speaker |
| vitasilk | img005 | 913 | 42 | 871 | the space above the speaker |
| test-1 | img001 | 937 | 25 | 912 | the space above the speaker |
| test-1 | img002 | 925 | 35 | 890 | the space above the speaker |
| test-1 | img003 | 925 | 12 | 912 | the space above the speaker |
| test-1 | img004 | 917 | 34 | 883 | the space above the speaker |

**Both causes are real and they are not the same size.** On `vitasilk` the
geometry alone spreads 100 px — but 100 of that is `img002` on its own, which is
bounded by the space **beside** the speaker rather than above him; the other four
corners agree to within **32 px**. Jitter then subtracted a further 7 to 53 px,
and it is what puts 917 next to 852. On `test-1`, where every slot is bounded the
same way, the geometry spread is **20 px** and jitter is the whole visible
difference.

**Jitter varies position now, not size.** `TOP_LEFT_JITTER` (0.06, a shrink) is
replaced by `TOP_LEFT_POSITION_JITTER` — **0.02 of frame width, up to 43 px**,
CHOSEN NOT MEASURED, and deliberately small against the 65 px margin so the image
still reads as being in the corner. Renamed rather than repurposed, so a stale
meaning cannot hide under an unchanged name.

**The move is one-sided and inward, and holds by construction rather than by a
clamp.** A square bounded *above* the speaker may only move **right** — sliding it
sideways cannot change that it sits above him — and one bounded *beside* him may
only move **down**, for the mirror reason. Each axis is offered only the move its
own bound already guarantees, and the second is measured **after** the first has
been applied, so the two together cannot walk onto the face. The frame is bounded
by the same arithmetic. All of it in source pixels, converted once at the end.

Every slot now takes the whole square the corner can hold:

| reel | slot | was | now | nudge (right, down) |
|---|---|---:|---:|---|
| vitasilk | img001 | 912 | **937** | 19, 0 |
| vitasilk | img002 | 801 | **837** | **0, 31** |
| vitasilk | img003 | 852 | **905** | 42, 0 |
| vitasilk | img004 | 917 | **925** | 6, 0 |
| vitasilk | img005 | 871 | **913** | 33, 0 |
| test-1 | img001 | 912 | **937** | 19, 0 |
| test-1 | img002 | 890 | **925** | 27, 0 |
| test-1 | img003 | 912 | **925** | 10, 0 |
| test-1 | img004 | 883 | **917** | 27, 0 |

Every picture is bigger. `vitasilk`'s four above-bounded slots are **905–937 px**,
a 32 px spread against 116; `img002` stays 837 because the space beside the
speaker is genuinely smaller, and it is the one slot that nudges **down** instead
of right, because its right edge is already on his clearance.

`npm run place:images` reports the nudge per slot and asserts both bounds:
**0 outside the frame, 0 overlapping the face** across all nine. The builder
asserts the same two per slot on its own path.

Recorded in `docs/PROJECT_SPEC.md` §5 with the date, the ruling and the reason —
sizes varying between consecutive images read as inconsistency, not as variation.

**Three tests asserting size jitter were retired in the same change**, not left
green: "jitters only downward", "keeps jitter inside its declared bound", and
"keeps jitter a shrink at any scale". They are replaced by tests that every seed
gets the whole corner square, that the nudge stays inside its bound and only ever
moves inward, that position varies while size does not, that a beside-bounded
square moves down rather than right, and that the placement clears the face and
stays in the frame at every scale. One further test — "anchors the same distance
from the top as from the side", the one guarding the units bug — now passes
`jitter: 0`, because it is about the anchor and the nudge is what varies.

### Goal 2 — the watermark inset

**108 px, equal on both axes**, in the units the constants already use:
`WATERMARK_MARGIN_X` is **0.05** of frame width and `WATERMARK_MARGIN_Y` is
**0.05 ÷ 1.7778 = 0.028125** of frame **height**. Both are 108.0 px on a
2160 × 3840 frame. The horizontal inset grows by 43 px; the vertical falls from
205 to 108.

**Both pixel figures are asserted, not just the fractions.** This is the fourth
width-versus-height conversion in this block and the other three were bugs, so a
test pins `watermarkMarginPx()` at 108 on each axis and a second pins that y is x
**divided** by the aspect.

**Confirmed per corner.** The inset is measured from the **near** edge on each
axis, so it is the same figure wherever the seeded draw lands; a test walks every
corner the draw can reach and asserts 108.0 px on both axes in each. Live against
the real plans: `vitasilk` lands **top-right** at 108.0 / 108.0, `test-1` lands
**bottom-left** at 108.0 / 108.0.

`benchmarks/RESULTS-block8-watermark-inset.md` carries the ruling in a new
"Ruled" section; its measurement is unaltered, and the two sentences saying
nothing had changed are corrected rather than deleted. Nothing else about the
watermark changed — corner selection, width fraction, duration and gain are
untouched.

### Goal 3 — handed back

`npm run service:build` and `npm run panel:build` both ran. **Both are needed**:
goals 1 and 2 changed service-side placement, and the panel bundle is rebuilt so
a reloaded panel cannot be older than the service it talks to.

## Deviations

**One extra commit, `chore: ignore the flattened cutout the build writes`.**
`git status` opened the session with one untracked file, `my files/test
videos/cutouts/img002-c1.cutout.on-fill.png` — the flattened cutout session 35's
`flatten_cutout` wrote when the user ran his build. `.gitignore` covers
`*.cutout.png`, which the `.on-fill.png` suffix escapes, so a regenerated build
artefact was showing as untracked in every `git status`. A gap session 35 left;
closed rather than reported and left.

## Failures & open problems

**None from this session.** `npm run check` passes: **1775 TypeScript tests, 149
pytest**, the mode validator, the panel manifest parse, the template validator and
both model checksums. The Chromium 99 capability denylist passes against
`panel/dist`.

Unchanged and still open, none of them this session's scope:

- **The image prompt.** Fidelity, darkness and literalness are all Block 9 and
  all the prompt, not the placement.
- **`imageScale` 1.4 is unreachable** and all nine slots clamp. Making the
  pictures larger than the corner holds is a placement ruling — spend
  `HEAD_CLEARANCE`, bleed off the frame edge, or overlap the speaker — not a
  constant.
- **`IMPACT_THRESHOLD`** is unresolved and the 17 SFX events remain 8 frames
  late. Sound is otherwise finished and was not touched.

## Repo state

HEAD `2f30108`, working tree clean apart from this report. Three commits:

- `3a6fce9 feat: jitter varies an image's position, never its size`
- `07d86fc feat: inset the watermark 108 px on both axes`
- `2f30108 chore: ignore the flattened cutout the build writes`

Nothing was staged with `git add -A`. `templates/library.aep`, `align.ts`,
`correction.ts` and every hand-made reference file are untouched. No plan was
written. No schema changed.

## Suggested next step

Reload and build, then judge the two things this session changed:

```
pkill -f "service/dist/service.js"
npm run service
```

Reopen the panel (Window → Extensions → Framopia Studio), then:

```
npm run build:reel -- --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json"
```

Two questions, and only these two:

1. **Do the five pictures now read as the same size as each other?** Four are
   905–937 px and one — `img002`, the one beside your head rather than above it —
   is 837. If that one still reads as wrong, the fix is a placement ruling about
   what a picture may overlap, not another constant.
2. **Does the watermark sit far enough in?** It is 108 px from the top and 108
   from the right, against 65 and 205 before.

If both are right, the remaining image work is the prompt: what the pictures
actually show, and how dark they are. That is Block 9 and it costs money.
