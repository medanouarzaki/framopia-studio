Status: OK

# Block 8 session 30 — the plan names its client, and step 4 exists

**Spent $0.00; no API was called and nothing was generated.**
`.local/costs.jsonl` byte-identical at both ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**

**After Effects: 1 instance and 0 `aerender` at session start, unchanged at the
end. AE was not contacted at all** — nothing this session did needs it.

## Done

### Goal 1 — the plan records its client

**The answer was already on every plan and nobody had read it.** The analysis
and slot stages have always written a config label naming the mode and its
version — `keywords-prompt-v3-k2-syndicalia-v5`. So no plan's client had to be
guessed:

| reel | client recorded | determined from |
|---|---|---|
| ground-truth | **null** | analysis pending; nothing on disk says which client |
| test-1 | k2-syndicalia v5 | `keywords-prompt-v3-k2-syndicalia-v5` |
| test-2 | k2-syndicalia v5 | `keywords-prompt-v4-k2-syndicalia-v5` |
| test-3 | **null** | analysis pending; nothing on disk says which client |
| vitasilk | k2-syndicalia v5 | `keywords-prompt-v3-k2-syndicalia-v5` |

Two are left null deliberately. There is exactly one mode in the repository, so
guessing `k2-syndicalia` would have been right — and would have been a guess,
which is the thing that stops being safe the moment Block 9 adds a second
client.

`modeFromConfigLabel` is the **inverse of the function that writes the label**,
lives beside it, and is pinned by a round-trip test in both directions plus the
awkward case (a mode id containing hyphens, so the version is the last `-v<n>`
and not the first).

- The analysis and slot stages write `clientMode` at the point the mode is
  chosen, so new plans carry it without a migration.
- `npm run migrate:client-mode [-- --apply]` gave it to the existing five, and
  **asserts it changed only `meta` and `clientMode`** by diffing the file rather
  than by intending to.
- `build:reel` reads it; **`--mode` is now an override**, and the build prints
  `client mode k2-syndicalia, from the plan (recorded v5)` or names the override.
- The dry run carries it and the panel shows it.

### Goal 2 — the image candidate picker, step 4

`service/src/image-view.ts`, `panel/src/Images.tsx`, `GET /images?reel=` and
`POST /images/choose`.

**Every candidate is shown, rejected ones included** — the gate rejects **8 of
`vitasilk`'s 10** and four are genuine halo. Per slot: interval, presentation,
zone, template, the idea, and what the builder would use. Per candidate: the
image, the cutout, the four §5.4 metrics, the verdict **with its reason
verbatim**, model, resolution and recorded cost. Images load over `file://`, as
the keyword picker's audio does — no new dependency and no new route.

**Choosing writes `chosenCandidateId`, which is itself the human-flagged
marker**: `humanFlaggedItems` reads it and `PlanMergeBlockedError` refuses to
discard a slot carrying one, so a re-run cannot lose the choice.

**A rejected candidate can be chosen, and the plan records the argument.**
`ImageSlot.overriddenGateFailures` (schema addition, optional with a default)
holds the verdict that was overridden, so the plan says the gate was disagreed
with rather than that it passed. Choosing a passing candidate records nothing;
clearing a choice clears both.

**What happens today with `chosenCandidateId` null — asked, not assumed. It is a
documented placeholder, not an accident.** `candidateFileFor` takes
`candidates[0]` under a comment reading *"No slot carries a `chosenCandidateId`
— the editor picks in Block 8 — so the probe takes the first candidate"*. It was
written for exactly this session's absence. The builder honours a choice now and
its report says which of the two happened, so a build nobody chose for is never
mistaken for a choice.

**Presentation — both reports were right, which is why they disagreed.** Block 7
session 9's `cardTemplateId` forces `img_float` on **every** slot, so every image
is framed whatever the gate settled on; and `presentation` still selects *which
file* goes inside that frame — the cutout PNG for a `cutout` slot, the generated
image otherwise. On `vitasilk`, `img002` is `cutout` and renders its cut-out
picture inside a card frame. **Unchanged**; the picker states it on screen.

**The per-candidate cost reads $0.0000 on all ten**, because the plan was last
written from a cached run and a cached run costs nothing. The view shows the
reel's cumulative **$1.550444** beside it rather than implying the images were
free.

**A slot with nothing generated says what generating would cost, read from the
dry run** rather than computed a second time — two implementations of what a
stage costs is how the dry run and the runner came to disagree on screen. On
`test-1`: *"0 of 8 candidate images are cached; a run would generate 8, budgeted
at most $1.45."*

### Goal 3 — image size, reopened as a placement question

`benchmarks/RESULTS-block8-image-placement.md`. **Read-only. Nothing
implemented, nothing changed.**

**140% fits nowhere.** It wants 1076–1172 px; the largest face-clearing square
anywhere on the frame is 765–937 px — short by 140 to 335 px on all nine slots.

**The corner rule is not the main constraint, but it is costing about 17%.** The
band above the face holds 905–937 px on eight of nine slots against the corner's
749–818. Moving off the corner is worth 1.04×–1.25×, mean ≈1.17×; the remaining
~20% is where the speaker's face sits, not where the rule puts the picture.

**The stored zones do not contain a large enough region.** `vitasilk`'s largest
zone square is **816 px** and `test-1`'s **959 px** — the zones come from the
**person** mask, so shoulders and arms bound them, which is why they are smaller
than a face-only band.

**Recommended: place above the face rather than in the corner.** Worth ≈1.17×,
reopens only Block 7 session 9's corner ruling, needs no new measurement (it
reads the same face masks the corner rule reads today), and **leaves the
subject-bounding-box scaling untouched** — that sizes the picture inside its
1200 px comp while placement sizes the comp layer in the master, so the two are
orthogonal. Jitter carries over unchanged, being a one-sided shrink.

Reaching 1.4 needs one of: a controlled bleed off the frame edge (the only route
that keeps the face clear), spending `HEAD_CLEARANCE` and `TOP_LEFT_MARGIN`
(151 px, which fixes one slot in nine), or accepting less than 140%.

**A units error was found and corrected while measuring this** — my first pass
converted a width fraction to a height fraction by multiplying by the frame
aspect instead of dividing, which understated the band above the face by about
190 px. It is the same mistake as Goal 4's, in a different file, and the numbers
above are the corrected ones.

### Goal 4 — the watermark inset

**`WATERMARK_MARGIN` was one number used for both axes**, and the vertical
placement multiplied it by the frame's aspect ratio where it should divide:

| | fraction | pixels |
|---|---|---:|
| from the side | 0.030000 of frame **width** | **64.8** |
| from the top | 0.053333 of frame **height** | **204.8** |

Now `WATERMARK_MARGIN_X` and `WATERMARK_MARGIN_Y`, with the second defined as
exactly what the single constant produced — **no default changed, the mark sits
where it sat**, and a test asserts both pixel figures. Candidate insets, all
equal on both axes, are in `benchmarks/RESULTS-block8-watermark-inset.md`:
0.03 → 65 px, 0.04 → 86, **0.05 → 108**, 0.06 → 130, 0.08 → 173.

The complaint is about the **horizontal** inset: the mark is nearly four times
closer to the side than to the top. 0.05 is the one I would try first.

## Deviations

**Goal 3's placement change was not implemented**, as instructed — it is a
proposal with the numbers behind it, for the user to rule on.

**Two small fixes beyond the letter of the goals**, both reported: a sentence in
the keyword picker still read *"and fires a hit"*, false since session 27
removed them; and the panel's new client-mode line uses a nullish check so a
service too old to send the field renders rather than throws, which is the
panel's standing rule.

**Two tests asserting retired behaviour were rewritten in the same change**: the
browser test that used Images as its example of a step "not built yet" — every
step is built now, so it asserts instead that a built step renders its own
content — and the dry-run fixture, which gained the field it was missing.

## Failures & open problems

- **Nothing in step 4 has been seen by the user.** It is asserted in a real
  browser against a fixture shaped like the service's own output, but the
  `file://` image loading is only exercised there; CEP is where it counts.
- **`ground-truth` and `test-3` still have no client**, correctly. They will get
  one the first time analysis runs for them.
- **`test-1` has 4 slots and 0 of 8 candidates.** Generating them is billable
  and the user has not given the go-ahead, so the picker prices it and stops.
- **140% remains unreachable** and the three routes to it are all rulings.
- **The two `img005` candidates carry 47 and 11 unexpected OCR words** — the
  multi-subject shelf idea from Block 4. The picker shows them; the idea is
  still the underlying defect.

## Repo state

Branch `main`, HEAD **`017d13b`** at the time of writing; this report's own
commit follows.

    017d13b docs: record session 30 in the operating memory
    07613b4 docs: measure where a larger image would fit
    2c60161 refactor: make the watermark inset a per-axis value
    3097dcc feat: add the image candidate picker
    5dc3aa2 feat: record on the plan which client it was built for

`npm run service:build` and `npm run panel:build` both ran.

`npm run check` **passes, exit 0**, read from the exit status:

| workspace | tests |
|---|---:|
| `@framopia/core` | 445 |
| `framopia-service` | 959 |
| `framopia-benchmarks` | 166 |
| `framopia-panel` | 137 passed, 2 skipped |
| **TypeScript total** | **1707** |
| pytest (sidecar) | **166** |

Session 29 closed at 1679 TS and 166 pytest.

**The capability denylist passes against the built bundle**: no CSS feature
Chromium 99 would drop, no JavaScript API it lacks, no container query, and the
bundle is built from the current source.

## Suggested next step

**Reload the panel and open step 4 on `vitasilk`.**

    Window → Extensions → Framopia Studio   (close and reopen it)

The service is rebuilt; if one is already running from a terminal, restart it so
the new routes are live.

To build:

    npm run build:reel -- \
      --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json"

**`--mode` is no longer required** — the plan records `k2-syndicalia v5` and the
build says so. Pass `--mode` only to build a reel against a different client on
purpose. The build refuses if the open project has unsaved changes.

**Three things to judge in step 4:**

1. **Can you see every candidate, including the eight the gate rejected?** Each
   should show its picture, its cutout, the metrics, and the reason it was
   rejected in the gate's own words.
2. **Does choosing one hold?** Click a candidate; it should mark as chosen, and
   the line above should change from "first candidate, nothing chosen" to
   "chosen". Choosing a rejected one should say which verdict it overrides.
   Reopen the step — the choice is on the plan and should still be there.
3. **What do the slots look like?** The gate passed 2 of 10, so eight slots are
   showing you pictures it did not like. If they look fine, the thresholds are
   what is wrong; if they look bad, the prompts are.
