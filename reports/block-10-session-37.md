# Block 10 session 37 — a picture now stays until its words finish

**Status: OK.**

## A picture no longer disappears mid-sentence

**Every picture on every reel now stays on screen until the last word it was
written for has been said.** The entrance plays at exactly the speed it was
authored at — 0.4004 s — and then the picture simply sits there until the
sentence ends. Nothing is slowed down or sped up.

This was read back out of After Effects on the built comps rather than trusted
from the code. `sora`'s worst case, `img002`, used to vanish at 6.341 s while the
words ran to 7.159 — **24.5 frames early**. It now ends at 7.159.

| reel | picture | ended | now ends | words end | gained |
|---|---|---:|---:|---:|---:|
| **sora** | img002 | 6.341 | **7.159** | 7.159 | **24.5 f** |
| | img001 | 2.101 | **2.180** | 2.180 | 2.4 f |
| | img005 | 16.962 | **17.039** | 17.039 | 2.3 f |
| **vitasilk** | img002 | 8.261 | **8.860** | 8.860 | **18.0 f** |
| | img003 | 13.621 | **13.960** | 13.960 | 10.2 f |
| | img005 | 22.002 | **22.039** | 22.039 | 1.1 f |
| **test-1** | img004 | 21.721 | **21.940** | 21.940 | 6.6 f |
| | img002 | 6.601 | **6.759** | 6.759 | 4.7 f |

The other twelve slots across the three reels are shorter than the template and
are **untouched** — their windows and their out points are the same to the frame
as before.

## The three files to look at

All three are `sora`, built from the same plan, the same pictures and the same
words. **The only difference is how big the pictures are drawn.**

| | path | pictures |
|---|---|---|
| **A** | `.local/build/sora-size-A-one-size-669.aep` | all eleven at **669 px** — today's rule |
| **B** | `.local/build/sora-size-B-one-size-799.aep` | ten at **799 px**, `img003` at 669 |
| **C** | `.local/build/sora-size-C-each-its-own-max.aep` | **669 to 1085 px**, each as big as its own corner allows |

**Every picture in all three is clear of the speaker.** The build refuses and
stops if one is not, and all three exited cleanly.

His own reel, `.local/build/sora-995f2d27-full.aep`, was rebuilt last and is
still on **A**, today's rule — the three above are files to look at, not a change
to his reel.

## Done

### A — the hold, and how it is done

Read `service/src/build/short-card.ts` first, as instructed, and followed its
shape: the timing is decided in the planner and carried on the placement, and the
ExtendScript only applies it. A card carries `stretchPercent`; a picture now
carries **`holdLastFrameFromS`**, set in `service/src/build/reel-plan.ts` when
and only when a slot runs longer than **the template comp's own duration**, read
from the audit. No number of its own: a template rebuilt to a different length
moves the rule with it.

Deliberately **not** a stretch, which is what the user ruled against — a stretch
would slow the entrance in proportion to how long the words run. In
`panel/jsx/build-reel.jsx` the layer gets time remapping with two keyframes a
frame short of the source's end, placed as far apart in value as in time, so the
mapping is one-to-one and the animation plays at its authored speed; past the
last key the value is constant, and that constant is the still frame. **The
template's own keyframes are never touched** (TEMPLATE_LIBRARY_GUIDE §5).

Every image layer in the built `sora` reads **`stretch = 100`** — proof from the
comp itself that nothing was slowed.

**Where it breaks.** The hold is exactly `window − 2.002 s` and **nothing caps
how long a slot can be.** Across the twenty slots on the three reels that have
any, eight now hold, and the hold runs from **0.037 s to 0.818 s** — under a
second, which reads as a picture that stays rather than a picture that freezes.
The planner has a minimum gap between slots (`MIN_SLOT_GAP_S`) but **no maximum
slot length**, so a slow speaker with a long sentence could produce a six-second
slot and four seconds of a motionless picture. That is a bound being named, not
one that has been measured: no reel here is close to it. If it matters, the place
to cap it is the slot selection, not the builder.

### B — the three sizes, slot by slot

| slot | A (today) | B (799 floor) | C (own maximum) |
|---|---:|---:|---:|
| img001 | 669 | 799 | **1045** |
| img002 | 669 | 799 | **1045** |
| **img003** | 669 | **669** | **669** |
| img004 | 669 | 799 | 893 |
| img005 | 669 | 799 | 881 |
| img006 | 669 | 799 | **1057** |
| img007 | 669 | 799 | **1061** |
| img008 | 669 | 799 | **1073** |
| img009 | 669 | 799 | **1085** |
| img010 | 669 | 799 | **1061** |
| img011 | 669 | 799 | **1049** |
| **mean** | **669** (31.0%) | **787** (36.4%) | **992** (45.9%) |

`img003` is the same 669 px in all three — it is the slot where he leans forward
and his head sits higher in frame, and 669 px is genuinely all the corner holds
there. In A it sets the size for the other ten; in B and C it is simply the one
small picture.

Re-sizing cost nothing and no picture was regenerated: every candidate is
2048×2048, so at 669 px only 32.7% of the purchased pixels are drawn and at
1085 px 53%. The ledger did not move.

`--image-size` was added to `npm run build:reel` to make these three files. It is
a diagnostic for looking at a reel, not a rule: absent, the reel rule is byte for
byte what it was, which is what golden's four green reels show.

### C — what whichever rule wins has to survive

Where each option breaks, stated as mechanism rather than as a number:

- **A, one size at the reel minimum.** Correct and perfectly consistent, and it
  **falls as slots are added**, because a minimum only ever falls. Eight image
  slots per 30 s means a 40-second reel draws eleven samples of the speaker's
  position where a 22-second one draws four. It breaks on **length and on a
  speaker who moves**: `sora`'s spread is 416 px against `test-1`'s 20.
- **B, one size at a floor with tight slots left smaller.** Consistent for most
  of the reel and immune to slot count, but it is **not one size any more**, and
  **the floor is a number no video can be asked for**. 799 px came from the
  corpus's own range, which is exactly the kind of value the standing rule says
  must not be chosen here. If B wins, the floor has to come from his eye, and the
  report should say so rather than derive it.
- **C, each slot at its own maximum.** The largest pictures available and safe by
  construction, and it depends on nothing but this reel's own geometry — no slot
  count, no duration, no corpus. It breaks on **consistency**: the spread is
  whatever the speaker does, and on `sora` that is 669 to 1085. That variation is
  the reason the one-size rule exists.

`service/src/placement/reel-shape.test.ts` now covers all three over synthetic
reel shapes rather than over these reels — that A takes the minimum and a
generous slot added later gives nothing back, that B leaves a below-floor slot at
its own maximum and keeps every picture clear, and that C is safe at every size
and speaker position tried. Whichever he picks is already proven before it is
adopted.

**`imageScale: 1.4` in `modes/k2-syndicalia.json` is still inert** and was not
changed. Under **A** it can never do anything, because the wanted size is the
corner times 1.4 and the placement clamps it straight back to the corner. Under
**B** it would sensibly multiply the floor. Under **C** it is meaningless for the
same reason as A. If A or C wins, the honest thing is to remove it rather than
leave a setting that does nothing.

**The picture path's golden coverage is still two reels of four** — `test-2` and
`test-3` have no image slots at all. That is why all five of golden's differing
fields this session came from `test-1` and `vitasilk`: a size or timing
regression on a reel shaped like those two would not be caught by golden at all,
and `sora` is not in golden. Closing it means giving one of the two empty reels
image slots or adding a fifth reel; it was not closed here.

### D — the gates

**`npm run golden`: PASS, 4 of 4, 17,174 fields.** Before anything was
re-recorded, **exactly 5 fields differed and every one was an image layer's out
point:**

| reel | field | was | now | gained |
|---|---|---:|---:|---:|
| test-1 | `masters[0].layers[5].outPoint` | 21.721013 | 21.939982 | 6.6 f |
| test-1 | `masters[0].layers[7].outPoint` | 6.601018 | 6.759009 | 4.7 f |
| vitasilk | `masters[0].layers[6].outPoint` | 22.002002 | 22.038997 | 1.1 f |
| vitasilk | `masters[0].layers[8].outPoint` | 13.620996 | 13.960002 | 10.2 f |
| vitasilk | `masters[0].layers[9].outPoint` | 8.261011 | 8.859985 | 18.0 f |

**Nothing else moved.** No text, no font, no position, no scale, no count; the
field totals are identical reel for reel (4415 / 4280 / 3709 / 4770), and
`test-2` and `test-3` matched field for field untouched. All five gains match
session 36's measured losses exactly. The reference was then re-recorded and a
verify run passed.

**`npm run check` exits 1, and only at the panel**, on four of the five
image-picker tests session 35 measured — three cutout fixtures name files that
moved into per-reel subdirectories, so the panel's own `onError` removes the
`<img>` in a race with the assertion. **Nothing new is red.** Per workspace, from
its own output:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **757 passed** |
| service | 96 passed (96) | **1230 passed** — up 4 on the rewritten timing cases; `new-video.test.ts` passes |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 10 passed, **1 failed** (11) | 209 passed, 2 skipped, **4 failed** |

`check.sh` stops at the first failing step, so the gates after the test step were
run on their own: **modes ok, templates 6 entries ok, ExtendScript 15 files ok,
CLAUDE.md 9,342 of 20,000, references PASS, `validate-templates` 6 templates ok
against the audited `library.aep`**, and the Python sidecar's own suite, which
`check` does not run, **149 passed**.

**`sora.mov`, its eleven candidates and every cache entry are untouched** — the
cache is 71 entries / 128 files / 106 MB at both ends, `sora.mov` is
`344265a0…` at both ends, and **the ledger did not move: 144 lines,
`d886596…`, $0.00 spent.**

## Deviations

**`sora`'s comp was rebuilt four times** — once to verify the hold, then A, B and
C, then once more on the default rule so his own
`.local/build/sora-995f2d27-full.aep` and the plan are back where they were. He
had it open; it has changed, and that is the point of the session rather than an
accident.

## Failures & open problems

1. **Unproven by name: the extreme hold.** No reel here has a slot long enough to
   show a still frame for more than 0.818 s, so what a four-second hold looks like
   is asserted from arithmetic and not from anything watched. There is no maximum
   slot length in the planner.
2. **The picture path is still exercised by two golden reels of four**, and
   `sora` is not among them.
3. The two browser test files remain red for the cause session 35 measured;
   nothing was done to them.
4. The size rule is unchanged and unchosen — that is deliberate.

## Repo state

Branch `main`. Ledger **144 lines / `d886596…` at both ends**.
`templates/library.aep` `4b0cf05a…c52734` at both ends, never opened for writing.
The six references byte-identical. Cache 71 / 128 / 106 MB unchanged.
`sora.mov` `344265a0…` unchanged. No project of the user's own was saved.

## Suggested next step

He looks at the three files and rules on the size; whichever he picks is a
build-time change over pictures already paid for, and `reel-shape.test.ts`
already covers it. If B wins, the floor is his number and not one to derive.

---

**The three files, in order, and the one thing to look at in each**

1. `.local/build/sora-size-A-one-size-669.aep` — **today.** All eleven pictures
   the same size, and that size is the smallest one of them could be.
2. `.local/build/sora-size-B-one-size-799.aep` — **the same reel with the
   pictures a fifth bigger**, except the one at 8.4 s that cannot grow. Look at
   whether that one small picture stands out.
3. `.local/build/sora-size-C-each-its-own-max.aep` — **as big as each picture can
   be**, 669 to 1085. Look at whether the different sizes read as varied or as
   inconsistent.
