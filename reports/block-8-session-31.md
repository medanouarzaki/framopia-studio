Status: OK

# Block 8 session 31 — the gate advises, and the picker shows what gets built

**Spent $0.00; no API was called and nothing was generated.**
`.local/costs.jsonl` byte-identical at both ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**

**After Effects: 1 instance and 0 `aerender` at session start, unchanged at the
end. AE was not contacted** — nothing this session did needs it, and no build
was run.

## Done

### Goal 1 — the gate advises, it never blocks

**It never has.** A verdict answers one question — is this matte clean enough to
render as a cutout — and ARCHITECTURE §5.4 makes its consequence a
**presentation fallback**, not a refusal. That is why five images were built
from candidates the gate had rejected: nothing was going wrong.

Made explicit so it cannot be "fixed" into something that drops images:

- `buildChoiceFor` in `service/src/build/choose-candidate.ts` is **the one
  declaration**, read by the builder and by the picker. The rule was written
  twice before this — once in `candidateFileFor` and once in the view's
  `buildsWith` — which is exactly how a build comes to differ from what the
  screen says it will be.
- The chosen candidate is built; with none chosen the **first** is built,
  whatever its verdict, and both callers say which of the two happened.
- Pinned by `choose-candidate.test.ts`, including that **all five of
  `vitasilk`'s slots build with eight of ten candidates rejected**, that a
  rejected candidate chosen over a passing one is built, and that the rule does
  not quietly prefer a passing candidate.
- Recorded in `docs/DECISION-image-config.md` with the date.

### Goal 2 — the picker shows what the build will show

It showed **a cut-out on a grey square for every candidate**. Only `img002` is a
cutout slot; the other four render the whole picture inside a frame. So on eight
of ten candidates the user was judging a version of the picture that never gets
built.

- `CandidateView.renderedPath` is derived **from the same `presentation` the
  builder reads** — the cut-out on a cutout slot, the generated picture
  otherwise — so the panel does not decide it a second time.
- It is the primary and largest image on each candidate.
- The raw picture is kept as a small second image with a caption, **only on a
  cutout slot**, where it differs from what gets built. Showing it twice on a
  card slot would say the build does something it does not.
- Each slot says in plain words which it is: *"This one is shown with its
  background removed, so only the subject appears"* or *"This one is shown
  whole, inside a frame."*

### Goal 3 — cutout metrics judge cutout slots only

`edge_halo`, `hole_ratio` and `alpha_edge_noise` measure one thing: how cleanly
the background came away. **Every rejection in the corpus is on a slot that
shows the whole picture**, where the matte is never drawn.

| | candidates | judged clean | judged poor |
|---|---:|---:|---:|
| before | 10 | 2 | **8** |
| after | 10 | 2 | **0** |
| on the one cutout slot | 2 | 2 | 0 |
| on whole-picture slots | 8 | — | **not judged** |

The eight that stop being reported: `img001-c1`/`c2` and `img003-c1`/`c2` (edge
halo), `img004-c1`/`c2` (holes), `img005-c1`/`c2` (edge noise). `img002`'s two
are the only ones the measurement was ever about, and both pass. The other four
reels have no generated candidates, so nothing changes for them.

**The measurement still happens and still decides the presentation, and I want
to be exact about why.** §5.4's fallback is what turns a slot into a
whole-picture slot in the first place — the metrics are its input. Removing them
would remove the fallback, so what is scoped is the **verdict**: whether a
candidate is *reported as failing something*, which past that fallback has no
consequence. `verdictFor` in `service/src/images/verdict.ts` is the one
declaration; a test walks the whole corpus and asserts no candidate is reported
as failing anywhere.

**A card slot then has no metric left at all, and the panel says so:** *"Nothing
is checked automatically about these pictures — judge them by eye."* That is a
true statement about what the gate can currently measure, and it leads directly
to Goal 4.

**One claim in `DECISION-image-config.md` is now superseded and marked as such:**
*"The `card` fallback has never fired on a generated image."* It has fired on
**8 of 10**. It is the normal case, not the exception.

### Goal 4 — the real defect, named and not fixed

**Nothing compares a generated picture against the idea it was generated from.**
Once the cutout metrics are scoped to the slots they affect, that is plain
rather than hidden: a whole-picture candidate carries no verdict because there
is none to carry.

| slot | the idea asked for | both candidates show |
|---|---|---|
| `img001` | a clock face showing exactly five minutes | roughly quarter past |
| `img003` | capsules and molecular structures | an undifferentiated swirl |
| `img004` | a woman at a mirror | two women, no clear mirror |

Every one passes every check that exists. Recorded in
`docs/DECISION-image-config.md` with what it would take — a reworked prompt, a
billable vision check per candidate with its own stage and cache, or a human
pass — and that it is **Block 9**, which owns the client's visual identity and
the prompts that carry it. **Nothing was attempted.**

### Language

The strings this session owns were rewritten for the user rather than for the
schema. Gone from his screen: `alpha_edge_noise 0.0897 > 0.02`, `edge_halo`,
`gate rejected`, `gate passed`, `cacheProvenance`, the cache entry id, and a slot
header reading `img003 11.62–13.96s card z_left_4 img_float`. In their place:
*"on screen 11.6s to 14.0s"*, *"background came away cleanly"*, *"Made for
k2-syndicalia. $1.55 spent generating pictures for this reel so far."*

The identifiers were not moved somewhere quieter — they were dropped, because
they are provenance for an artifact and the plan already records them. **A full
pass over the whole panel is the last session of this block; this only avoids
adding to what it will have to undo.**

## Deviations

**Goal 4's record landed in its own commit rather than Goal 3's**, though only
Goals 1–3 were required to be separate. It documents no code change, so folding
it into the fix would have made one commit two logical changes.

**Two things beyond the letter of the goals**, both reported: `buildChoiceFor`
was extracted because the rule Goal 1 asks me to pin existed in two places and
pinning one of them would have proved nothing; and the picker's source line,
which I wrote last session, was rewritten because it was carrying
`cacheProvenance` and a cache entry id onto his screen.

**Two tests asserting retired behaviour were rewritten in the same change**: the
browser test asserting `gate rejected` and `edge_halo 0.1004 > 0.1` appear on
screen — both now scoped away — and the panel's `metricsLine`, which rendered
four raw metrics and is deleted rather than left as an unused export.

## Failures & open problems

- **Nothing here has been seen by the user.** It is asserted in a real browser
  against a fixture shaped like the service's output; CEP is where it counts.
- **The fidelity defect is untouched by design.** Every picture in the reel is
  judged by eye and nothing else, and three of `vitasilk`'s five slots show
  something other than what their idea asked for.
- **`test-1` still has 4 slots and 0 of 8 candidates.** Generating is billable
  and the go-ahead has not been given.
- **`img005`'s candidates carry 47 and 11 unexpected words** from the
  multi-subject shelf idea. Still shown, still a prompt problem.
- **The 140% image-size question from session 30 is unresolved** and waiting on
  a ruling.

## Repo state

Branch `main`, HEAD **`fd838b0`** at the time of writing; this report's own
commit follows.

    fd838b0 docs: record session 31 in the operating memory
    75801df docs: name the image defect nothing measures
    f42d89d fix: judge cutout quality only where the cutout is used
    ce3a7ba fix: show the picture the build will place
    9fc3ee0 feat: declare the build choice once, and pin that the gate never blocks

`npm run service:build` and `npm run panel:build` both ran.

`npm run check` **passes, exit 0**, read from the exit status:

| workspace | tests |
|---|---:|
| `@framopia/core` | 445 |
| `framopia-service` | 973 |
| `framopia-benchmarks` | 166 |
| `framopia-panel` | 141 passed, 2 skipped |
| **TypeScript total** | **1725** |
| pytest (sidecar) | **166** |

Session 30 closed at 1707 TS and 166 pytest.

**The capability denylist passes against the built bundle**: no CSS feature
Chromium 99 would drop, no JavaScript API it lacks, no container query, and the
bundle is built from the current source.

## Suggested next step

**Reload the panel and look at step 4 again.**

    Window → Extensions → Framopia Studio   (close and reopen it)

If a service is running from a terminal, restart it — the routes changed.

**You do not have to choose anything.** With the gate advising and the first
picture of each slot used by default, the reel builds exactly as you have
already seen it. The picker is there for when you want to override, not a step
that must be completed. To build, unchanged from session 30:

    npm run build:reel -- \
      --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json"

**What to look at:**

1. **Each candidate now shows the picture the build will place** — the whole
   framed picture on four slots, the cut-out subject on `img002` alone. That
   grey cut-out you were judging is gone from the four it never applied to.
2. **The rejections are gone**, because they were never about anything you would
   see. Only `img002` is judged now, and both its candidates are clean.
3. **Four of the five slots now say nothing is checked about them.** That is
   true, and it is the real problem: `img001`'s clock shows quarter past when
   the idea asked for five minutes, and nothing in the pipeline can tell. Block
   9 is where that gets solved, and it will be solved in the prompt, not in a
   threshold.
