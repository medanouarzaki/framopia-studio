# The image stage on a real reel — vitasilk, ten candidates

The first full production run: five slots, two candidates each, generated,
cut out, gated, text-checked and written onto the Edit Plan. This is Block 4's
definition-of-done evidence.

Config as frozen in `docs/DECISION-image-config.md`: `gemini-3-pro-image`, 2K,
1:1, 2 candidates per slot, mode `k2-syndicalia` v5.

## Cost

| | |
|---|---|
| probe (1 image) | $0.157948 |
| run (9 images) | $1.392496 |
| **session total** | **$1.550444** |
| ceiling | $2.25 |
| published rate for 10 | $1.3400 |
| budgeted at x1.35 | $1.8090 |

Per image, actual against the $0.1340 published rate:

| # | actual | over published |
|---|---|---|
| 1 (probe) | $0.157948 | +17.9% |
| 2 | $0.155668 | +16.2% |
| 3 | $0.155084 | +15.7% |
| 4 | $0.153404 | +14.5% |
| 5 | $0.152204 | +13.6% |
| 6 | $0.154124 | +15.0% |
| 7 | $0.153650 | +14.7% |
| 8 | $0.158690 | +18.4% |
| 9 | $0.158436 | +18.2% |
| 10 | $0.151236 | +12.9% |

Mean **+15.7%**, range +12.9% to +18.4%. Every image again billed over
published, never under — eleven of eleven counting the earlier bake-off, now
twenty of twenty across the block. The 1.35 gate covered all of them with
room; the mean has crept up from the +12.2% measured on three pro images in
session 3, which is a reason to keep the gate where it is rather than tighten
it to the mean.

**All ten returned 2048x2048**, read from the decoded bytes. All ten
`image/jpeg`.

## The probe

The frozen config had never been sent to the API. One image first:

| check | result |
|---|---|
| response parsed | pass |
| dimensions exactly 2048x2048 from decoded bytes | pass |
| `usageMetadata` present, actual within budget | pass — $0.157948 against $0.180900 |
| exactly one ledger line | pass — 95 to 96 |
| model id matches `gemini-3-pro-image` | pass |

## Per candidate

| candidate | edge noise | hole ratio | fg area | edge halo | gate | quality | text |
|---|---|---|---|---|---|---|---|
| img001-c1 | 0.00000 | 0.00000 | 0.3178 | **0.1004** | card | 0.000 | none |
| img001-c2 | 0.00000 | 0.00000 | 0.3354 | **0.1187** | card | 0.000 | unexpected: `iaia` |
| img002-c1 | 0.00000 | 0.00000 | 0.1257 | 0.0532 | **cutout** | 0.174 | unexpected: `elixir, luxe` |
| img002-c2 | 0.00000 | 0.00000 | 0.4275 | 0.0455 | **cutout** | 0.545 | **ok: `hair, serum`** |
| img003-c1 | 0.00000 | 0.00000 | 0.3794 | **0.1214** | card | 0.000 | none |
| img003-c2 | 0.00000 | 0.00000 | 0.2980 | **0.1703** | card | 0.000 | none |
| img004-c1 | 0.00000 | **0.09251** | 0.2273 | 0.0960 | card | 0.000 | none |
| img004-c2 | 0.01125 | **0.01739** | 0.2331 | **0.1395** | card | 0.000 | none |
| img005-c1 | **0.08965** | 0.00000 | 0.2437 | 0.0963 | card | 0.000 | unexpected: 47 words |
| img005-c2 | **0.38286** | 0.00000 | 0.1523 | 0.0824 | card | 0.000 | unexpected: 11 words |

Bold marks a value past its threshold.

Slot presentations: `img002` **cutout**, the other four **card**. Every slot's
two candidates agreed, so no slot got the null "candidates disagree" outcome —
that path is still untested on real data. **`chosenCandidateId` is null on
every slot**: the editor picks in Block 8.

## Two of ten passed the gate

This is the run's real finding and it is not a good number.

### Five failed on edge halo — four of them on halo alone

`img001` ×2, `img003` ×2, `img004-c2` — all over the 0.10 bound, up to 0.1703.
**img004-c2 fails `hole_ratio` regardless**, so the number that matters for a
ruling is **four**: fixing halo takes yield from 2/10 to 6/10 and leaves
img004 and img005 on `card`.

(This section said six in the first version of this file. The three stated
reasons summed to 10 against 8 failing candidates, because img004-c2 was
counted under both halo and hole. Corrected in session 7.)

`edge_halo` measures alpha just outside the subject and **cannot tell a rim
the model drew from a rim the remover left** — a limit recorded at
`MAX_EDGE_HALO` in session 5, when the user established by comparing originals
against cutouts that the bright edge in the corpus images was rendered, not
retained. **Session 7 fixed the metric rather than the threshold**; see
`RESULTS-block4-halo.md`.

**Mode v5's lighting prune is a plausible contributing cause and nothing here
isolates it.** The clean corpus was six images of one slot; these ten span
five slots with different subjects. Lighting changed, but so did subject and
slot, and session 5 recorded that the axis is not reliably obeyed and the
prune's effect unmeasured. One variable per experiment; this run varied
several.

### Two failed on holes, which is a genuine matte defect

`img004-c1` at 0.09251 and `img004-c2` at 0.01739. The idea is
`A woman looking at a mirror touching her hair with a thoughtful expression`;
background punched through a subject is exactly what `hole_ratio` is for.
**This is the metric's first firing on a real image** — it read 0.00000 on all
six corpus images and needed deliberate degradation in session 5 to prove it
worked at all.

### Two failed on edge noise, and one of those is arguable

`img005-c1` at 0.08965 and `img005-c2` at 0.38286. Also a first firing on real
input.

But `img005`'s idea is **`A salon shelf displaying premium hair care
products`** — inherently many objects. `alpha_edge_noise` counts every solid
pixel outside the *largest connected component* as speckle, so a shelf of
bottles scores as noise by construction. The metric assumes one subject; the
mode's invariant fragment says `one subject, centred and unobstructed` while
this slot's idea asks for a shelf.

**The idea and the invariant contradict each other**, and the gate is
reporting that contradiction as a matte failure. That is a mode and prompt
problem surfacing through a metric, and neither the metric nor the threshold
is the thing to change.

## Text: the check earns its place

`no text` was removed from the negative prompt at session 5 because it never
worked. The correctness check that replaced it caught, on real generated
images:

- **`img002-c1`: `elixir, luxe`** — invented product branding on a reel that is
  Darija for a Moroccan clinic.
- **`img005-c1`: 47 unexpected words** including `velvet`, `golden`, `noir`,
  `repair`, `mask`, `solde`, and a long tail of gibberish
  (`accseriacertsog`, `agaocdaavraufdro`, `popchicmngngb`). A shelf rendered
  full of fake labels.
- **`img005-c2`: 11 unexpected words**, same character.
- **`img001-c2`: `iaia`** — a single gibberish mark.

And one clean pass: **`img002-c2` reads `hair, serum`**, which is what the slot
is about.

Four of ten candidates carry text the slot did not ask for. Every one is
advisory — recorded on the candidate as `textVerdict`, surfaced to the editor,
**nothing deleted**. A negative prompt could not have prevented this; a check
after the fact reports it.

## Cache

The re-run, immediately after, on the identical command:

```
10 already cached, 0 to generate
estimated cost: $0.0000
billed 0, cached 10, this run $0.000000
ledger sha UNCHANGED
```

**The first full multi-batch exercise of the eviction fix**, which had been
unverified since session 3 broke it. Ten entries across five slots survived
the run that wrote them, and a second run regenerated nothing.

The probe's image was also correctly served from cache by the full run —
`1 already cached, 9 to generate` — so the probe cost nothing twice.

**Cutouts are not cached.** The sidecar re-ran all ten on the second pass,
about three minutes of local CPU and no money, because it loads the ~928 MiB
BiRefNet model per subprocess. That is ARCHITECTURE §1.4's "subprocess per
task, no server, no state" working as specified, and it is the obvious thing
to cache when a reel has more slots.

## Review page

`benchmarks/results/latest-cutouts/vitasilk/index.html`, grouped by slot with
each slot's idea above its candidates, four views each (original, checkerboard,
on the mode's `light`, on its `background`). Gitignored; rebuild with
`npm run plan-page -- --plan <abs path>`.

## What this does not say

No candidate was chosen and no image was judged for quality. Two of ten
passing the gate is a statement about mattes and lighting, not about whether
the pictures are any good — and whether a slot's image carries its idea is a
judgement nobody has made yet.
