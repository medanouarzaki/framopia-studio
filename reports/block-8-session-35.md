Status: OK

# Block 8 session 35 — the card is a border again, and there are more pictures

**Spent $0.00; no API was called and nothing was generated.**
`.local/costs.jsonl` byte-identical at both ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**

**After Effects was not contacted in any way.** 1 instance and 0 `aerender` at
session start, unchanged at the end.

## Done

### Goal 1 — the frame vanished because the frame and the fill are one layer

**What the card fill is, and where it comes from.** `img_float` has exactly
**two** layers: `IMG_MAIN`, the picture, 1000 px; and `CARD` behind it, 1080 px,
which shows as a **40 px border**. The builder paints `CARD` with a Fill effect,
and that is the frame.

- **A whole picture is opaque**, so the border sits against the picture. Frame
  and fill are different things, and one colour choice is enough. That is why
  the other four slots have a clear white frame.
- **A cut-out is transparent everywhere but the subject**, so `CARD` shows
  through the whole 1080 px square. **The frame and the fill are the same
  layer.** Their contrast is 1.00:1 by construction, no palette colour can
  change it, and there is no border to see — a dark red square with a bottle on
  it. Session 34 chose a frame that contrasts with the subject, which satisfied
  one constraint of two; the second was unsatisfiable while one layer did both
  jobs.

**So the cut-out is given a ground of its own**, composited before it is placed
by the sidecar's new `flatten_cutout`. `IMG_MAIN` becomes opaque, `CARD` is a
border again, and the two constraints are separable:

| | must contrast with | minimum |
|---|---|---|
| the **fill** | the lit part of the subject | **3:1**, WCAG 2.1 for a non-text boundary |
| the **frame** | the fill it sits against | **3:1**, the same |

`cardColours` searches the palette for the pair maximising the **smaller** of
the two, because a design with one comfortable contrast and one that fails is a
design that fails. Ties break on role name so the choice does not depend on the
order the palette is written in. **Nothing about the template changes, no
ExtendScript changes, and the cutout file on disk is untouched** — the flattened
picture is a build artefact beside it.

| candidate | renders | measured | fill | subject | frame | border |
|---|---|---:|---|---:|---|---:|
| img001-c1 | whole | 0.0066 | — | — | light | 17.18:1 |
| img001-c2 | whole | 0.0027 | — | — | light | 18.44:1 |
| **img002-c1** | **cut out** | **0.4640** | **background** | **9.85:1** | **light** | **18.64:1** |
| img002-c2 | cut out | 0.0389 | light | 10.94:1 | background | 18.64:1 |
| img003-c1 | whole | 0.0266 | — | — | light | 12.70:1 |
| img003-c2 | whole | 0.0053 | — | — | light | 17.60:1 |
| img004-c1 | whole | 0.0019 | — | — | light | 18.74:1 |
| img004-c2 | whole | 0.0083 | — | — | light | 16.67:1 |
| img005-c1 | whole | 0.0257 | — | — | light | 12.85:1 |
| img005-c2 | whole | 0.0101 | — | — | light | 16.19:1 |

**All ten clear both minimums**, so no fallback is needed on this corpus. The
one that is built, `img002-c1`, gets a dark ground and a **light frame — the
same frame the other four have.** `img002-c2` takes the pair the other way round
because its subject is genuinely dark, which is the rule being per-image.

**When no pair reaches 3:1 on both**, the closest pair is used and
`CardColours.fallback` says so in words. It is returned rather than thrown: a
build with the closest colours is better than no build, and naming it is what
stops it being a silent settle.

### Goal 2 — eight images per 30 seconds

`IMAGE_SLOTS_PER_30S` 5.5 → **8**, amending PROJECT_SPEC §5's 5–6 band. It stays
`imageSlotCountFor`, read by the planner **and** by the dry run, so the count a
run would plan and the count it is priced at cannot drift. It is a client-mode
value, `imageSlotsPer30s`, so K2 can differ in Block 9.

| reel | length | slots today | at 5.5 | **at 8** | images ceiling | why |
|---|---:|---:|---:|---:|---:|---|
| ground-truth | 23.3 s | 0 | 4 | **6** | **$2.17** | analysis pending; a run plans 6 and generates 12 |
| test-3 | 21.2 s | 0 | 4 | **6** | **$2.17** | the same |
| test-1 | 22.0 s | 4 | 4 | **6** | $0.00 | analysis already done, so a run **skips** it |
| test-2 | 22.3 s | 0 | 4 | **6** | $0.00 | the same |
| vitasilk | 25.7 s | 5 | 5 | **7** | $0.00 | the same, and its ten images are cached |
| **corpus** | | | | | **$4.34** | **$4.70** with analysis |

Read from the dry run, not computed a second time. **Three reels read $0.00 and
that is not a rounding** — a stage the plan records as done is skipped by a run,
so it is priced at nothing.

**What happens to a plan that already has slots: nothing, until someone asks.**
The new density applies when a reel's slots are *next planned*, and `planSlots`
**refuses** to overwrite generated candidates or a chosen candidate —
`SlotsReplaceBlockedError`, `--force` required. **Forcing it on `vitasilk`**
would take 5 slots to 7, generate **14 images at about $2.53**, and **strand the
10 already generated**: the files and cache entries survive, but new slot ideas
compose new prompts, which fingerprint differently, so nothing on the new plan
points at them and the $1.55 already spent buys nothing further.

**Nothing was generated and no plan was re-planned.**

### Goal 3 — literal or atmospheric, decided per moment

**What decides it today**: `slotPrompt` says a slot illustrates *"ONE idea or
sentence — a thing being explained, claimed or shown"* and asks for *"a one-line
idea in English describing what the image should show"*. **Nothing in it
mentions naming a concrete thing**, so when she says *"le filler glow mn la
marque Vita Silk"* nothing tells the model to depict Vita Silk.

All nine planned slots against their spans:

| slot | what she says | what the idea depicts | what would serve it |
|---|---|---|---|
| vitasilk img001 | five minutes | a clock showing five minutes | **literal**, and it is |
| vitasilk img002 | *the Filler Glow from Vita Silk* | *a cosmetic bottle of hair serum on a podium* | **literal — and it is not** |
| vitasilk img003 | *26 vitamins and enzymes* | *capsules and molecular structures* | **literal — and it is diluted** |
| vitasilk img004 | *what are you waiting for* | a woman at a mirror, thoughtful | **atmospheric**, and it is |
| vitasilk img005 | *if you find they have Vita Silk* | *a salon shelf of premium products* | **literal — and it is not** |
| test-1 img001 | *do you want a natural lift* | a lifted jawline | **atmospheric**, and it is |
| test-1 img002 | *collagen stimulators* | a doctor holding a vial | **literal**, and nearly is |
| test-1 img003 | *a light tightening* | a cheek, subtly tightened | **atmospheric**, and it is |
| test-1 img004 | *improves your skin quality* | flawless hydrated skin | **atmospheric**, and it is |

**Five of nine call for the concrete thing and four for the mood** — so neither
preference is right as a blanket rule, which is the ruling, measured. **Of the
five, three do not get it**: both mentions of the brand became a generic
category, and the third was diluted with atmosphere. **All four that call for
mood are served correctly**, so the model is not bad at atmosphere — nothing
asks it for the concrete thing.

A pasteable prompt addition is written out in `docs/DECISION-image-config.md`,
expressing the per-moment choice: what makes a moment call for the thing, what
makes it call for mood, that neither is the default, and that the two are not
blended (a concrete thing beside an abstract one is two subjects, which §5
already forbids).

**Recorded as one problem, not three.** The three amendments in that document —
fidelity, darkness, literalness — are all the image prompt, none is a threshold,
none is fixable in the gate, and they should be tested together because a prompt
change is a billable re-generation and doing it three times costs three times.
`test-1`, 8 images, about **$1.24** against a **$1.4472** ceiling, on the user's
explicit go-ahead. **Nothing generated, no prompt changed.** Block 9.

### Goal 4 — the build saves its own previous output

The guard stopped the user four times running, and every time the file was
`.local/build/vitasilk-full.aep`.

- **A project open from `.local/build/` is saved and the build proceeds**, and
  the result names the file it saved. `save()` with no argument, so it writes
  back where it came from — saved, never discarded.
- **Anything else keeps the refusal**, names the file, and tells him to save or
  close it himself. Nothing this tool did not write is ever closed.
- **A project never written to disk keeps its current handling** — `isOurs`
  needs a file to compare against, so a null file can never satisfy it.
- `build.jsx` and `measure-survey.jsx` are untouched; neither writes to
  `.local/build`.

Both branches are pinned in `core/src/audit-safety.test.ts`, including that the
guard's save takes no argument and that the single `close` still sits behind the
dirty check.

## Deviations

None. After Effects was not contacted, nothing was generated, no plan was
re-planned or written, and the placement, sound and corner rulings were left
alone.

**One thing worth naming about Goal 1's shape.** The brief asked me to satisfy
both constraints and to say plainly if no palette colour could. The honest
finding was stronger: with one layer doing both jobs, **no palette could ever
satisfy the second**, for any candidate. Rather than report that and leave the
picture broken, I separated the fill from the frame — which is a local,
testable composite and needs no change to the template or to any ExtendScript.
The alternative, adding a fill layer inside the duplicated comp, would have been
untested ES3 running on every image slot in a session that may not contact After
Effects.

**Tests asserting retired behaviour were rewritten in the same change**: the
per-30s image counts in `slot-select.test.ts`, and session 34's frame-colour
expectations, which now assert the pair rather than the single colour.

## Failures & open problems

- **Nothing here has been seen.** All four changes are asserted against the real
  files; the build is yours to run.
- **The flatten runs at build time and writes a file beside each cutout.** It is
  a build artefact and is regenerated every build, but it is the first time the
  builder writes an image, and preflight checks the cutout rather than the
  flattened file.
- **The new density does nothing to a reel already planned.** `vitasilk` keeps
  five slots unless you force a re-plan, which costs $2.53 and strands ten
  images.
- **All three image prompt defects are open**, and all three are Block 9.
- **`test-1` has 4 slots and 0 of 8 candidates**; generating is billable.

## Repo state

Branch `main`, HEAD **`4034b6a`** at the time of writing; this report's own
commit follows.

    4034b6a docs: record session 35 in the operating memory
    678c7a6 feat: let the build save its own previous output
    48d31d0 docs: specify when an image should be the thing she named
    34741a1 feat: raise image density to eight per thirty seconds
    20c3f78 fix: give a cut-out a ground so the card stays a border

`npm run service:build` and `npm run panel:build` both ran.

`npm run check` **passes, exit 0**, read from the exit status:

| workspace | tests |
|---|---:|
| `@framopia/core` | 462 |
| `framopia-service` | 992 |
| `framopia-benchmarks` | 166 |
| `framopia-panel` | 155 passed, 2 skipped |
| **TypeScript total** | **1775** |
| pytest (sidecar) | **169** |

Session 34 closed at 1755 TS and 166 pytest.

**The capability denylist passes against the built bundle**: no CSS feature
Chromium 99 would drop, no JavaScript API it lacks, no container query, and the
bundle is built from the current source.

## Suggested next step

**Kill the old service, then reload the panel.**

    pkill -f "service/dist/service.js"

Then in After Effects: **Window → Extensions → Framopia Studio**, close it and
open it again, and let the panel start the service itself.

To build:

    npm run build:reel -- \
      --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json"

**It should not refuse this time.** If your last build is still open, it will
save it and carry on, and say which file it saved.

**One thing to judge: does the serum picture now have a visible frame like the
others?** It should be the bottle on a dark ground inside a **white border** —
the same border the other four have. That slot was the only one that changed;
the other four are pixel-identical to your last build.

The reel still has five images. The new density of eight per thirty seconds
would give `vitasilk` seven, but it only applies when a reel's slots are next
planned, and re-planning this one would cost $2.53 and throw away the ten
pictures you already have. `ground-truth` and `test-3` are the two that would
take the new density for nothing extra, whenever you want them run.
