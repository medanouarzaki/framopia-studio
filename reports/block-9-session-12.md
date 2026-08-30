Status: OK

# Block 9 session 12 — the image prompt, and a collision that cost eight cutouts

**Spent $1.220660**, against a $1.4472 ceiling, on `test-1`'s eight images. The
user's explicit go-ahead. After Effects was not contacted at all; nothing this
session did needs it. No project was left dirty.

## 1. Stop conditions

| | start | end |
|---|---|---|
| mount | `pwd` and `git rev-parse --show-toplevel` agree | agree |
| ledger lines | **108** | **116** (+8, one per image) |
| ledger sha256 | `50ec3f57bacb3f32054ae190…` | `e5e0a6e9d6735188065fdbcb…` |
| **dollar delta** | — | **$1.220660**, summed from the eight new ledger lines |
| cache entries | **36** | **44** (+8, all under `test-1`) |
| After Effects | 1 instance, **pid 79146** | 1 instance, **pid 79146** |
| `aerender` | 0 | 0 |
| `templates/library.aep` | `1d7553e894e10f82051131e8…` | **identical** |

**Cache census, by video.** The eight new entries are all `test-1`'s; no other
reel gained or lost one.

| video | start | end |
|---|---:|---:|
| ground-truth | 2 | 2 |
| test-2 | 2 | 2 |
| **test-1** `365967c9…` | **7** | **15** |
| **vitasilk** `99dfe0e5…` | **22** | **22** |
| test-3 | 3 | 3 |

**`vitasilk`'s images are untouched, proven by bytes and not by count.** All 28
files across its 14 image entries were hashed at both ends; the manifest of those
hashes is `b5d4e5c7888d9db5b3ecb17dd477d8b75b2905aa248df2bd2197d896bc97b7d3`
before and after, and `diff` reports no change.

The ledger's `images-generate` stage went **$2.99971 → $4.220370**, a delta of
$1.220660 — the same figure the eight lines sum to. All-time ledger
**$10.555772 → $11.776432**.

## 2. The prompts, old and new

**All four slots change, and none is a no-op.** The negative prompt is
**unchanged** and deliberately so — `no watermark` and `no logo` have still never
been tested as controls, `no text` was ignored outright when it was there, and
nothing was added to the negatives on the strength of hope.

Every slot's diff is the same two clauses, because the change is to the client's
invariant style rather than to any one idea:

```
- dominant colour palette of #1A0000, #820000 and #C9A96E
- lit against #1A0000, with #F8F6F2 reserved for highlights
+ the brighter end of the palette leads: #C9A96E and #F8F6F2 carry the subject,
+   with #820000 for depth and #1A0000 kept to the ground behind it
+ lit so the subject reads immediately at a glance, bright and clearly separated
+   from its ground, not sunk into it
```

`img001`, in full — the rest differ only in their idea and their variation draw:

**old** — `A woman gently touching her firm lifted jawline. a single clear idea,
readable at a glance. one subject, centred and unobstructed. dominant colour
palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2
reserved for highlights. seen from slightly above, looking down. macro, a single
detail standing for the whole. hard directional light with defined shadow.`

**new** — `A woman gently touching her firm lifted jawline. a single clear idea,
readable at a glance. one subject, centred and unobstructed. the brighter end of
the palette leads: #C9A96E and #F8F6F2 carry the subject, with #820000 for depth
and #1A0000 kept to the ground behind it. lit so the subject reads immediately at
a glance, bright and clearly separated from its ground, not sunk into it. seen
from slightly above, looking down. macro, a single detail standing for the whole.
hard directional light with defined shadow.`

**The negative prompt, both sides:** `no extraneous objects, no background
clutter, no incidental detail, nothing in frame that is not carrying the idea, no
busy or competing composition, no watermark, no logo`.

**Both fragments were applied as written**, from the decision document, with no
word changed. The only judgement was where the second one goes: the document says
"after the sentence about what a slot illustrates", and the fragment's own wording
depends on *the idea* already being defined, so it sits after the paragraph that
defines it — the next one down. Nothing else moved.

## 3. What was spent

Estimate printed before anything was generated: **$1.0720 published, $1.4472
budgeted** at `IMAGE_COST_MULTIPLIER` 1.35 — exactly the authorised ceiling, so
the run was permitted to start and did.

| candidate | actual | vs published $0.134 |
|---|---:|---:|
| img001-c1 | $0.152848 | +14.1% |
| img001-c2 | $0.153328 | +14.4% |
| img002-c1 | $0.153336 | +14.4% |
| img002-c2 | $0.149376 | +11.5% |
| img003-c1 | $0.158490 | **+18.3%** |
| img003-c2 | $0.155010 | +15.7% |
| img004-c1 | $0.148296 | **+10.7%** |
| img004-c2 | $0.149976 | +11.9% |
| **total** | **$1.220660** | mean **+13.9%** |

All eight billed **8 billed, 0 cached, 0 failed**, every one served at the
requested 2048x2048 2K 1:1, none carrying unexpected text. Actuals from
`usageMetadata`, never the table. $0.226540 of the ceiling unspent. Twenty-eight
images into the project nothing has ever billed under the published rate, and
the 1.35 gate cleared the worst of these by 14%.

## 4. Darkness, measured, old against new

`tools/image-luminance/measure.py`. Before being used on anything new it
**reproduces the decision document's published ten-row table exactly** — every
mean, median, p90 and percentage — which is what makes the new figures
comparable rather than merely plausible.

| | old prompt (`vitasilk`, 10) | new prompt (`test-1`, 8) |
|---|---:|---:|
| mean relative luminance | 0.0359 | **0.2248** |
| share of the frame below 0.05 | **87.4%** | **47.5%** |

Mid-grey is 0.216. The pictures went from about a sixth of mid-grey to slightly
above it.

| new candidate | mean | median | p90 | below 0.05 |
|---|---:|---:|---:|---:|
| img001-c1 | 0.2305 | 0.1596 | 0.5269 | 32.3% |
| img001-c2 | 0.2814 | 0.0578 | 0.8081 | 49.3% |
| **img002-c1** | **0.0443** | 0.0048 | 0.0730 | **88.9%** |
| img002-c2 | 0.2344 | 0.0762 | 0.6827 | 48.3% |
| img003-c1 | 0.2373 | 0.1311 | 0.6028 | 47.6% |
| img003-c2 | 0.2298 | 0.1096 | 0.5936 | 42.8% |
| img004-c1 | 0.2498 | 0.2072 | 0.5702 | 39.4% |
| img004-c2 | 0.2908 | 0.2902 | 0.6117 | 31.8% |

**Seven of eight moved decisively. `img002-c1` did not**, at 88.9% against the
old corpus's 87.4% average — a prompt is an instruction and not a control, which
the lighting axis had already established.

**And brighter pictures matte worse.** That one dark candidate is the only one of
the eight to pass the cutout gate; gate `edge_halo` rose from a 0.045–0.170 range
to 0.154–0.490, and the pass rate went 2-of-10 to 1-of-8. A near-black ground is
what made a subject easy to cut out. It costs nothing today — a poor matte falls
back to a card, and every slot is card-framed anyway since Block 7 session 9 —
and any later block that wants real cutouts will meet it.

**The honest limit of this comparison: the two halves are different reels.**
`test-1` had **no images at all** before this run — four planned slots, zero
candidates, nothing on disk — so there is no slot-for-slot before and after, and
the before is `vitasilk`'s ten under the old prompt. Both sets are the same model
at the same resolution and aspect ratio with the same negative prompt, and the
only deliberate difference is the two fragments; but the subjects differ. A 6.3x
change in mean luminance is far outside what subject choice plausibly explains,
and the per-image figures do not overlap at all except for `img002-c1`.

## 5. Literalness, per slot

| slot | she says | the idea | names | the new prompt asked for |
|---|---|---|---|---|
| img001 | *bghiti شد طبيعي للوجه* | a woman touching her firm lifted jawline | **a feeling** — a desired outcome | the same idea, lit to read at a glance |
| img002 | *3la محفزات الكولاجين* | a female doctor holding a small vial | **a thing** — collagen stimulators | the same idea, lit to read at a glance |
| img003 | *wki3tewna شد خفيف للبشرة* | a cheek showing subtle tightening | **a feeling** — an effect | the same idea, lit to read at a glance |
| img004 | *katji kat7ssn lik mn jawdat البشرة* | flawless deeply hydrated skin | **a feeling** — an outcome | the same idea, lit to read at a glance |

**One names a thing and three name a feeling, and the literalness rule did not
touch any of these eight images.** It governs which *ideas* get written, and this
run reused `test-1`'s four existing ideas.

**The budget forced that, and the arithmetic is why.** `IMAGE_SLOTS_PER_30S` went
to 8 at Block 8 session 35, so re-planning `test-1` (21.99 s) yields **6 slots,
not 4** — 12 images, $1.608 published and **$2.1708 budgeted, over the $1.4472
ceiling this run was authorised for**. It would also have replaced the ideas, so
there would have been nothing to compare. The brief's own gate says a run over
the ceiling does not start.

`test-1` is in any case the reel with least to prove on it: by the decision
document's own table all four of its slots are already served correctly. The
slots that fail literalness are `vitasilk`'s `img002` and `img005`, both brand
mentions, and `vitasilk` may not be regenerated.

**So the rule is in force for every slot planned from now on and has never been
observed working.** The first reel to plan slots afresh is its first test.

## 6. Fidelity, stated as unmeasured

**Nothing in this project compares a generated picture against the idea it came
from, and this session added nothing that does.**

That is deliberate rather than an omission. Inventing a metric would have been
inventing a number, and asking a model to grade its own output is not evidence —
it is the same model that produced the picture, answering about its own work. A
real check is a vision call per candidate: a billable stage with its own cache,
fingerprint and cost, and a decision the user has not been asked for.

So the four slots' ideas are printed beside their pictures on the comparison page
and the judgement is left with the person whose judgement it is. What can be said
without measuring: none of the eight carries unexpected text, and all eight came
back at the requested size.

## 7. Deviations

- **`test-1` had no existing images, so nothing was preserved and nothing could
  be.** Step 2 of the brief assumes its pictures were paid for; they were not.
  The cache held zero `images-*` entries for it and its four slots were
  `status: pending` with empty candidate lists.
- **The literalness fragment was applied but not exercised**, for the ceiling
  reason in §5. Both fragments are in the code; one of the three defects is
  therefore answered by argument rather than by evidence, and §5 says so.
- **A second reel, `test-2`, was not touched** and no slot was re-planned
  anywhere.
- **Five test files were rewritten** because they asserted the mode at v10 or
  `test-1` at zero candidates — retired behaviour after this session, not
  failures.

## 8. Failures and open problems

- **I destroyed eight of `vitasilk`'s ten cutouts, and restored them.** Every
  plan wrote to `<video-dir>/cutouts/` and slot ids restart at `img001` per reel,
  so generating `test-1`'s images overwrote `img001-c1` through `img004-c2` file
  for file at 03:17–03:20. Latent since Block 4: `vitasilk` was the only reel that
  had ever generated, so nothing had ever collided.

  **Restored and verified, not assumed.** A cutout is derived from the cached
  source image, free and local, and those sources were byte-identical throughout.
  The two files the collision happened to spare are the control: regenerating
  `img005-c1` reproduced the surviving 25 August file **bit-identically**, same
  sha256 `f5f3e784…`. All eleven files are back at their exact original byte
  sizes, and the restored metrics reproduce the published figures —
  `img001-c1` halo 0.100422, `img004-c1` holes 0.09251, `img004-c2` holes
  0.017394, `img005-c1` halo 0.0999574.

  **That it was recoverable is luck, not design.** The same collision on an input
  nothing can reproduce would have been permanent, and this is the set every image
  measurement in the project is written against. Fixed at source
  (`cutoutDirFor`, `cutouts/<plan stem>/`) with a test that two plans in one
  directory cannot produce one path, and both plans' pointers repointed —
  changing that field and nothing else, asserted.

- **A mode bump reports every pinned reel as behind, on the version alone.**
  `snapshotsAgree` compares the client's `version` along with the palette, faces,
  colour roles and `imageScale`. v11 touched none of the latter — strip the
  version and the pinned v10 snapshot and today's mode agree exactly — yet all
  three pinned plans now report `behind: true`. **Nothing was re-pinned**, because
  moving a reel forward is a control someone presses and never automatic.
  Reported rather than fixed: whether the version is provenance worth comparing is
  a design decision. It is the same shape as the two cache defects already fixed.

- **Brighter pictures matte worse**, §4. Measured, not acted on.

- **`img002-c1` ignored the brightness instruction entirely.** One of eight.

- **Fidelity remains unmeasured**, §6.

- **Nothing was lost.** No cache entry, plan block, reference, ledger line or
  template content changed outside what is listed. The two plans that changed
  moved in `meta`, `images` and `cutoutPath` only.

## 9. Repo state

- Branch **`main`**, twelve commits ahead of `49e97a5`, nothing force-pushed.
- HEAD: **`0bcef9f docs: record the image-prompt change and what it bought`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 38 | **541** |
| `framopia-service` | 89 | **1134** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 11.11 s** |

```
mode k2-syndicalia v11: ok (fonts set)
templates: 6 entries, ok
extendscript: 12 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
> tsx src/verify-references-cli.ts

  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 11.11s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 10. Suggested next step

`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-image-prompt/index.html`

The page puts the eight new pictures beside the ten old ones with each slot's
words and its idea, so the two questions left can be answered by looking: whether
they now read at a glance, and whether they show what they were asked for. The
second is the fidelity defect, still unmeasured by design, and his eye is the only
instrument there is for it.

About $6.82 of Gemini credit remains, which Block 10's golden runs on two
machines still have to come out of.
