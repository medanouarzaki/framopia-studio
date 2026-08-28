Status: PROBLEM — goal 2's fix is already in force; the flashing needs a ruling, not a rule

# Block 8 session 25 — heard and seen for the first time

**Spent $0.00; no API was called.** `.local/costs.jsonl` is byte-identical at
both ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**
After Effects was not driven and `templates/library.aep` was not opened.

## Done

### Goal 1 — the sound was measured against nothing

**The SFX are not missing and not double-attenuated.** They are placed once,
correctly, at the gain the manifest declares. The gain was the problem: −20 dB
and −24 dB are **absolute**, and a level below full scale says nothing about
the voice underneath it.

`npm run loudness:measure` (new, `tools/measure-loudness/`) measures each reel
with ffmpeg's `ebur128`. Every reel is mastered at **−13.9 to −14.6 LUFS with a
true peak of 0.0–0.2 dBFS** — loud, with no headroom. A hit peaking at −20 dBFS
sat **5.6 dB below `vitasilk`'s average speech level and about 20 dB below its
peaks**, which is why a short transient vanished.

The rule is now an offset from the reel's own loudness (`core/src/sfx-level.ts`):
hits at **dialogue + 6 dB**, whooshes at **dialogue + 0 dB**, both **CHOSEN,
NOT MEASURED** and anchored to a measurement rather than to nothing. On
`vitasilk`: hits **−19.28 → −7.68 dB (+11.6)**, whooshes **−22.77 → −13.17 dB
(+9.6)**. The reel's loudness is stored as `source.dialogueLufs`, optional with
a default; absent falls back to the file's absolute gain rather than a guess.
The −20/−24 figures are recorded as superseded, with the reason and the date, in
`TEMPLATE_LIBRARY_GUIDE.md` and `TEMPLATE_BUILD_SPEC.md`.

**Placement is untouched** — `IMPACT_THRESHOLD` is unresolved, so all 17 events
keep their in-points and stay 8 frames late, as instructed. The migration
changed only `meta`, `source.dialogueLufs` and `sfx`; transcript, keywords and
images are byte-identical and no in-point moved.

### Goal 3 — the frame is derived from the picture

Measured all ten candidates' outermost 2% ring: **relative luminance 0.0019 to
0.0266** — every image is dark at its edge, because every prompt carries the
mode's dark palette. Against a dark frame that is **1.01:1 to 1.30:1**, which
is why they disappear; against the palette's `light` it is 12.5:1 to 18.5:1.

`cardFrameColour` picks whichever palette role separates best from the measured
edge, at **WCAG 2.1's 3:1 minimum for a non-text boundary** — taken from the
standard rather than invented. The builder applies it as a **Fill effect on the
duplicated instance's `CARD` layer**, so the shared solid the template draws
from is untouched. New sidecar task `edge_luminance`. A light picture on a
future reel gets a dark frame without anyone deciding again.

### Goal 4 — image size is a client value, and the corner will not give 140%

`imageScale` is a mode field, optional, default 1.0; `k2-syndicalia` is **v7**
at **1.4**. The bump invalidates nothing — the image cache stopped keying on
`modeVersion` in Block 7 session 1.

**Nine of nine slots clamped.** The top-left rule already takes the largest
square that clears the face, so there is no slack above it: 749–837 px placed
against 1048–1166 px asked for. `TOP_LEFT_MARGIN` (65 px) and `HEAD_CLEARANCE`
(86 px) are **151 px between them against the ~300 px** a 40% increase needs, so
spending both to zero does not reach it — and spending the clearance puts the
picture against the face mask. **0 outside the frame, 0 overlapping the face.**
Per-slot table and the three remaining options in
`benchmarks/RESULTS-block8-image-scale.md`.

A defect was found on the way: at a clamped size the square sat exactly on the
clearance boundary and measurably touched the grown face box on four of nine
slots. Jitter is applied last now, so it stays a shrink at any scale.

### Goal 5 — the watermark comes from the plan

Confirmed: `build-reel-cli.ts` placed one whenever `.local/build/watermark.json`
and the asset existed. Both are properties of the repository, so every reel got
a mark and none could refuse one.

It reads `plan.watermark` now. **`Watermark.enabled` is optional with a default
of true**, so nothing is migrated and no reel silently loses its mark — absent
means nobody has said otherwise. `POST /watermark` writes it, the dry run
reports it, and the Build step carries a per-reel checkbox.

**The inset, reported and not changed:** 216 × 242 px at 11.2266%, **65 px from
the side edge and 205 px from the top**. The two are unequal because the one
`WATERMARK_MARGIN` 0.03 is carried into an axis 16:9 taller, not because anyone
decided it.

Every other place the builder acts on something the plan does not carry is
swept in `benchmarks/RESULTS-block8-builder-inputs.md`. **One is the same
defect: `plan.clientMode` is null on all five plans**, so no plan says which
client it was built for; the image prompts and now the frame colour all come
from a flag. Reported, not changed.

## Deviations

**Goal 2 was not implemented, and the reason is that it is already done.**
The fix asked for — a minimum on-screen duration taking time from the gap after
the word — is Block 7 session 9's hold rule, which has been in force since.
**336 of 343 cards already stay up past their own word**, all **22.039 s** of
post-word silence in the corpus is already on screen, and what is left unclaimed
across five reels is **one card and 0.080 s**. At every threshold from 0.20 s to
0.50 s, **zero** short cards can reach it from their own gap. Writing the rule
again would look like a fix and change one card, so it was not written.

The evidence is `benchmarks/RESULTS-block8-card-duration.md`: median card
0.300 s, p10 0.139 s, 236 of 343 under 0.40 s. The card is short because the
next word arrives, not because the card stops early. The two remaining sources
of time both reverse an earlier ruling of yours, so they are put to you rather
than taken: overlap the next card (337 of 338 pairs would stack), or put two
words on a card again (**173 cards, median 0.640 s, 22 under 0.40 s**).

Your earlier ruling that a card stays tight to its word was therefore **not
superseded** — nothing was implemented that would supersede it.

## Failures & open problems

- **The flashing cards need your ruling**, above. Nothing else in this session
  is blocked on it.
- **The frame colour has never been rendered.** The Fill effect is applied by
  ExtendScript, which cannot be tested outside a running After Effects; the
  colour choice either side of it is unit-tested. Judge it on the build.
- **140% is unreachable where the images are.** The mode value is honoured
  wherever geometry allows and refused where it does not.
- **`plan.clientMode` is null on every plan.** A transcription-stage question.
- **The SFX are still 8 frames late.** `IMPACT_THRESHOLD` stays unresolved, as
  instructed; you rule on 90% against 95% once you can hear them.

## Repo state

`npm run check` **passes, exit 0**: 428 + 922 + 166 + 131 TypeScript tests
(2 skipped) and 166 pytest. Read from the exit status, not the output.

HEAD is `1d658ad`, six commits this session, one per goal plus the retired
assertions:

    1d658ad test: assert the relative sfx gain the keyword view now derives
    2e57da0 feat: let the plan decide whether a reel is watermarked
    2ab5fcc feat: make image size a client-mode value
    58226fb feat: derive the card frame colour from the image's own edge
    91d33d3 docs: measure card duration against the silence available to it
    d669f2e feat: set sfx level against the reel's measured dialogue

This report's own commit follows. Two tests asserted the retired absolute gain
and were rewritten in the change that retired it, not left green.

## Suggested next step

**Build `vitasilk` and judge four things.** Nothing here has been rendered.

    npm run service:build && npm run panel:build
    npm run build:reel -- --plan "my files/test videos/vitasilk.editplan.json" --mode k2-syndicalia

After Effects must be open with the panel loaded; the build drives your
instance over AppleScript. `--mode` is needed because the plan does not name a
client — pass it or the frame colour is skipped and the card keeps the
template's own.

Judge:

1. **Can you hear the hits and whooshes**, and are they now too loud? The
   +6 dB and 0 dB offsets are the two numbers to move.
2. **Do the images read against their frames** now that the frame is derived?
3. **Watermark off**: untick it at Build on a reel, rebuild, confirm no mark.
4. **The flashing**, with the question above in front of you: two words per
   card, or cards that overlap.
