Status: OK

Session 37. HEAD at the start `0d31581`, at the time of writing `acfb9df`; this
report's own commit follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no reel re-planned, After Effects not
contacted.** One After Effects instance and zero `aerender` processes at session
start; unchanged at the end. Working tree clean at start.

## Done

### Goal 1 — every picture in a reel is the same size

`reelPlacements` in `service/src/placement/top-left.ts` computes each slot's own
maximum as before, takes the **minimum across the reel**, and places every slot
at it. It is the one declaration, read by the builder, by `npm run place:images`
**and by the panel's image picker** — the picker computed its own per-slot size
and would otherwise have shown the user a number the build does not use.

| reel | slot | own max | placed | gives up | bounded by |
|---|---|---:|---:|---:|---|
| vitasilk | img001 | 937 | **837** | 100 | the space above the speaker |
| vitasilk | **img002** | **837** | **837** | 0 | **the space beside the speaker** |
| vitasilk | img003 | 905 | **837** | 68 | the space above the speaker |
| vitasilk | img004 | 925 | **837** | 88 | the space above the speaker |
| vitasilk | img005 | 913 | **837** | 76 | the space above the speaker |
| test-1 | img001 | 937 | **917** | 20 | the space above the speaker |
| test-1 | img002 | 925 | **917** | 8 | the space above the speaker |
| test-1 | img003 | 925 | **917** | 8 | the space above the speaker |
| test-1 | **img004** | **917** | **917** | 0 | the space above the speaker |

`vitasilk` is **five pictures at 837 px**, set by `img002`; `test-1` is four at
**917 px**, set by `img004`. **0 outside the frame, 0 overlapping the face**
across all nine, asserted per slot by the builder and by `npm run place:images`,
which still exits non-zero if either bound breaks.

**Positional jitter survives intact.** `img002` still nudges 31 px **down** and
the other eight nudge 6 to 42 px **right**, and session 36's by-construction
guarantee is asserted again at the common size — which is where there is the
most slack and so the most that could go wrong. A slot placed smaller than its
own corner can now be both above and left of the face; the second axis is still
measured after the first has been applied, so the two cannot walk onto it.

**The risk, named:** one tight slot shrinks the whole reel. `npm run
place:images` prints each slot's own maximum beside the common size and what
each gives up, so a reel pulled down by a single slot is visible rather than
merely small, and a test asserts that adding one cramped slot to a roomy reel
takes every other picture down with it.

**Nothing in the corpus comes out badly small.** Both sizes clear
`MIN_PLACED_SHORT_EDGE` (324 px) with room:

| reel | slots | own maxima | one size | set by |
|---|---:|---|---:|---|
| ground-truth | 0 | — | — | no slots planned yet |
| test-1 | 4 | 917–937 px | **917** | img004 |
| test-2 | 0 | — | — | no slots planned yet |
| test-3 | 0 | — | — | no slots planned yet |
| vitasilk | 5 | 837–937 px | **837** | img002 |

The three reels with no slots have no common size until they have slots; at
8 slots per 30 s they will each plan about six, and a sixth slot could set a
tighter size than any of the first five. Nothing was re-planned.

Recorded in `docs/PROJECT_SPEC.md` §5 with the date and the reason. **No test
asserted per-slot independent sizing**, so none had to be retired — the
single-slot function is still correct as a component and still tested as one;
six tests were added for the reel rule.

### Goal 2 — three watermark sizes

`Watermark.size` — `small | medium | large`, **schema addition, optional with a
default of `medium`**, validated only when present. All five plans still open.

| size | width | height | scale of the 1924 x 2154 artwork |
|---|---:|---:|---:|
| small | **216 px** | **242 px** | 11.2266% |
| medium (default) | **324 px** | **363 px** | 16.8399% |
| large | **432 px** | **484 px** | 22.4532% |

**The 108 px inset holds at every size in every corner** — measured live against
the real artwork, all four corners at all three sizes reading 108.0 px from the
near side and 108.0 from the near top or bottom, and asserted by a test that
walks every corner the seeded draw reaches at each size. The two bottom corners
measure from the far edge and are where an error would have hidden. **Large fits
the frame with no clamping**: 432 + 216 against 2160, and 484 + 216 against 3840.

`POST /watermark` takes `enabled`, `size`, or both, so setting one does not
silently rewrite the other. The panel's Build step shows three buttons beside
the checkbox, labelled with their widths — and **the buttons disappear entirely
against a service too old to send the size**, rather than the panel inventing a
choice the user could press and have ignored. Three browser tests, one for each
of those cases.

**`vitasilk`'s next build will show a mark 1.5x the one he just saw.** No plan
records a size, so every reel takes the default.

### Goal 3 — handed back

`npm run service:build` and `npm run panel:build` both ran. Both are needed:
goal 1 changed service-side placement and the image view, goal 2 changed the
route, the dry run and the panel.

## Deviations

**The watermark size is not a human-flagged item, and neither is the on/off
control the brief describes as one.** Checked rather than assumed: `enabled` has
never been in `humanFlaggedItems`, and neither field needs to be, because
`clearBlocks` clears `keywords`, `images` and `sfx` and **never touches
`plan.watermark`** — a re-run cannot lose either setting. Adding a flag would
have been worse than useless: `PlanMergeBlockedError` throws whenever any flag is
present, so every reel whose watermark had been set would refuse an ordinary
re-transcription until it was forced. The intent — a re-run cannot discard it —
is already met by a stronger mechanism, and two merge tests now pin it, since it
is a property of the merge rather than a field anyone can point at.

**The brief's "small = 0.112266 of frame width, 216 px" conflates two figures.**
216 px is **0.1** of a 2160-wide frame; 0.112266 is the layer scale against the
1924 px artwork. The brief also says small is "the size in today's build", which
is unambiguous, so `small` is 0.1 of frame width — 216 px, exactly what shipped.

**Session 36's closing test count was wrong, and I wrote it.** Its report says
1775 TypeScript tests; that figure was carried from the session brief rather
than measured, because I read only the last four lines of `npm run check`. The
true baseline at the start of this session was **1778** — core 463, service 994,
benchmarks 166, panel 155, measured here before anything was added. Exactly the
rule in guidelines §3: a claim a human can type is a claim nobody checks.

## Failures & open problems

**None from this session.** One incidental fix: an import in
`service/src/image-view.ts` became unused when the picker moved to the reel rule
and failed lint; removed.

Unchanged and still open, none of them this session's scope:

- **The image prompt** — fidelity, darkness and literalness. All Block 9, all
  the prompt, none of them the placement.
- **`imageScale` 1.4 is unreachable**, and now further out of reach: a reel's
  common size is bounded by its tightest slot. Making the pictures larger is a
  placement ruling — spend `HEAD_CLEARANCE`, bleed off the frame edge, or
  overlap the speaker — not a constant.
- **`IMPACT_THRESHOLD`** unresolved; the 17 SFX events remain 8 frames late.
  Sound was not touched.

## Repo state

HEAD `acfb9df`, working tree clean. Four commits this session:

- `abdb9d9 feat: give every picture in a reel one size`
- `3b94e9d feat: pick the watermark size per reel`
- `acfb9df docs: record the reel image size and the watermark sizes`
- (this report's commit follows)

`npm run check` **passes**: core **463**, service **1006**, benchmarks **166**,
panel **158 passed / 2 skipped** — **1793 TypeScript tests** — plus **149
pytest**, the mode validator, the panel manifest parse, the template validator
and both model checksums. The Chromium 99 capability denylist passes against the
built `panel/dist`.

Nothing was staged with `git add -A`. `templates/library.aep`, `align.ts`,
`correction.ts` and every hand-made reference file are untouched. No plan was
written and no reel was re-planned. `git log` carries no AI attribution.

## Suggested next step

Reload and build. Kill the running service first, then reopen the panel so
**After Effects spawns the new one itself** — a service started from a terminal
inherits a different `PATH` and that hid a real defect for a whole session:

```
pkill -f "service/dist/service.js"
```

Then in After Effects: Window → Extensions → Framopia Studio (close it first if
it is already open). Then:

```
npm run build:reel -- --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json"
```

Two questions:

1. **Do the five pictures read as one size now?** They are all 837 px. Four of
   them gave up 68 to 100 px to match `img002`, the one beside your head. If
   they read as consistent, this is settled; if they now read as too small, the
   next question is whether a picture may overlap you, which is a ruling rather
   than a constant.
2. **Is medium the right watermark size?** The mark is 324 x 363 px, half again
   as large as the one you just saw. Small and Large are one press away in the
   Build step — the choice is saved per reel, so it survives a rebuild.
