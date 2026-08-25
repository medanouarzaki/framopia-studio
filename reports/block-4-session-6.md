Status: OK

Block 4's definition of done is met. `vitasilk` is a fixture Edit Plan with
candidates on every slot, gated cutouts on disk with metrics, costs recorded
from `usageMetadata`, and a cache that regenerated nothing on a second run.

The run's substantive result is not the DoD, though. **Two of ten candidates
passed the quality gate**, and the reasons are worth more than the checkbox.

## Ledger

| | entries | total | sha256 |
|---|---|---|---|
| start | 95 | $9.005328 | `66e02a42e711d8d608770e5442761f7139d65cb4da01ba6e2761ede32d3dd29d` |
| end | 105 | $10.555772 | `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` |

**Session spend $1.550444** against a $2.25 ceiling and a $1.81 budgeted
figure. Ten ledger lines, one per image, at the point of spend.

## Done

### A1 — decision docs tested against their constants

`service/src/decisions.test.ts`, in `npm run check`. It parses the frozen
values out of the markdown and asserts them against the code, the way
`quality.test.ts` reads the Python gate's source. The table parser **throws**
rather than returning undefined, so a restructured table cannot quietly stop
the checking.

Verified to fail in both directions — doc drifting from code and code drifting
from doc.

**It immediately caught real drift.** `DECISION-transcription-config.md`
recorded `ACTIVE_PROMPT_VERSION = 3` while the code has run 4 since Block 3
session 6. The freeze record named a configuration nobody used, for three
sessions. The amendment is now written.

### A2 — mode v5

`soft diffuse light, shadows barely readable` pruned. The lighting axis is at
the validator's minimum of two values; a diffuse **and** modelled entry is the
user's to write at Block 9, like the fonts — inventing one would be inventing
client vocabulary. Fonts stay tbd.

Both plans recomposed free. **All four analysis cache entries still hit at
$0.00:**

```
vitasilk   keywords  Cache hit — no billable calls
vitasilk   slots     Cache hit — no billable calls
test 1     keywords  Cache hit — no billable calls
test 1     slots     Cache hit — no billable calls
ledger sha UNCHANGED
```

### B1 — the probe

The frozen config had never been sent to the API. One image, then halt:

| check | result |
|---|---|
| response parsed | **pass** |
| dimensions exactly 2048x2048 from decoded bytes | **pass** |
| `usageMetadata` present, actual within budget | **pass** — $0.157948 against $0.180900 |
| exactly one ledger line | **pass** — 95 → 96 |
| model id matches `gemini-3-pro-image` | **pass** |

### B2 — the run

Nine more images. Full table in `benchmarks/RESULTS-block4-vitasilk.md`.

**All ten returned 2048x2048**, all `image/jpeg`.

| # | actual | over published $0.1340 |
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

Mean **+15.7%**, never under. Twenty of twenty across the block. The mean has
crept up from session 3's +12.2% on three images, which argues for leaving the
1.35 gate where it is rather than tightening it toward the mean.

Per candidate, gate and text:

| candidate | edge noise | hole | fg area | halo | gate | quality | text verdict |
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

Slot presentations: `img002` cutout, the other four card. `chosenCandidateId`
null on all five.

### B3 — the cache re-run

```
10 already cached, 0 to generate
estimated cost: $0.0000
billed 0, cached 10, this run $0.000000
ledger 105 lines, sha a7e85e4b… UNCHANGED
```

**The first full multi-batch exercise of the eviction fix**, unverified since
session 3 broke it. Ten entries across five slots survived the run that wrote
them. The probe's image was also correctly cached by the full run
(`1 already cached, 9 to generate`), so it was paid for once.

### B4 — review page

`benchmarks/results/latest-cutouts/vitasilk/index.html`, grouped by slot with
each slot's idea above its candidates and the composed prompt collapsible.
Four views each. `npm run plan-page` rebuilds it.

## Block 4 cost summary (C2)

| session | spend | what |
|---|---|---|
| 1 | $0.000000 | scaffolding, pricing verified |
| 2 | $0.122593 | halted probe — the `aspectRatio` defect |
| 3 | $1.326676 | bake-off, plus the ceiling overrun |
| 4 | $0.000000 | sidecar, gate, OCR |
| 5 | $0.000000 | blocked on depleted credits |
| 6 | $1.550444 | the production run |
| **Block 4 images** | **$2.999713** | 21 images billed |

**Wasted: $0.514522** — session 3's images 1–3 (overwritten by a cache-miss
regeneration) and image 10 (killed before its review copy was written). That
is **17.2%** of the block's image spend, all of it from the eviction defect.

All-time ledger: **$10.555772 over 105 entries.** Images are now the largest
stage at $2.999710, ahead of transcription correction at $1.763362.

**Per reel, at the frozen config:** 5 slots × 2 candidates at the measured
+15.7% is **$1.5504** for images. `vitasilk`'s transcription was ~$0.16
(Scribe + one Gemini correction). That is **~$1.71 per five-slot reel**,
inside PROJECT_SPEC §5's $0.50–2.00 envelope with about $0.29 of headroom —
enough for one regenerated slot, not for a second full pass. A four-slot reel
comes to ~$1.40.

## DoD statement (C1)

| item | met | evidence |
|---|---|---|
| a fixture Edit Plan where every slot has candidates | **yes** | `vitasilk.editplan.json`: 5 slots, 10 candidates, all `status: generated` |
| gated cutouts on disk with metrics | **yes** | 10 PNGs in `my files/test videos/cutouts/`; every candidate carries four §5.4 metrics, a `gate` verdict and `cutoutQuality` |
| costs recorded | **yes** | 10 ledger lines at the point of spend, $1.550444, actuals from `usageMetadata`, never the price table |
| cache preventing regeneration | **yes** | re-run: `10 already cached, 0 to generate`, `billed 0`, ledger sha unchanged |

## Deviations

- **A `--probe` mode was added to the images CLI.** B1 asked for one candidate
  then a halt, and the job had no way to stop after one. It returns without
  writing the plan, because a probe covering one candidate must not rewrite a
  plan as though every slot had been generated.
- **`RESULTS-block4-vitasilk.md` is a new results file**, not asked for. The
  gate outcomes needed somewhere fuller than a report section.
- **`test-1` was not run**, as instructed.

## Failures and open problems

- **Two of ten candidates passed the gate.** Not a defect in the code, but the
  pipeline as configured sends 80% of what it generates to the `card`
  fallback, and that is not a usable yield.
- **Five failures are `edge_halo`; four of those fail on halo alone.**
  (Corrected in session 7: this said six. Counting the table against the 0.10
  bound gives img001-c1 0.1004, img001-c2 0.1187, img003-c1 0.1214, img003-c2
  0.1703 and img004-c2 0.1395. The three stated reasons summed to 10 against 8
  failing candidates because img004-c2 fails on both halo and hole and was
  counted twice.)

  **The number that matters for the ruling is four**, because img004-c2 fails
  `hole_ratio` regardless. A halo fix moves yield from 2/10 to 6/10 and leaves
  img004 and img005 on `card`.

  `edge_halo` cannot tell a rim the model drew from a rim the remover left, so
  the gate may be rejecting correct renders. **This is a tension between two
  deliberate decisions and needs a ruling, not a fix.** Options: raise the
  bound with evidence, make the metric compare the cutout against the
  original, or accept `card` for rim-lit slots. **I refitted nothing.**
- **Attributing the halo failures to the v5 lighting prune is a hypothesis,
  not a measurement.** (Added in session 7.) The clean corpus was six images
  of **one slot**; these ten span five slots with different subjects. Lighting
  changed, but so did subject and slot, and session 5 recorded that the
  lighting axis is not reliably obeyed and the prune's effect unmeasured. The
  prune is a plausible contributing cause and nothing here isolates it. One
  variable per experiment; this run varied several.
- **`img005`'s edge-noise failure is arguably a false positive.** Its idea is
  `A salon shelf displaying premium hair care products` — many objects — while
  the metric counts everything outside the largest connected blob as speckle
  and the mode's invariant fragment says `one subject, centred and
  unobstructed`. **The idea contradicts the invariant**, and nothing validates
  slot ideas against it the way `validateMode` validates axis terms against
  it. The gate is reporting a prompt problem as a matte problem.
- **Four of ten images carry text the slot did not ask for**, including a
  shelf rendered full of fake labels. The check reports it; nothing prevents
  it, and `no watermark`/`no logo` remain untested as controls.
- **The "candidates disagree" presentation is still untested on real data** —
  every slot's two candidates agreed.
- **`plan.costs.byStage.images` reads 0 after the cached re-run**, because the
  field records what *this run* cost. Consistent with transcription's
  established behaviour and diffable across runs, but it means the plan no
  longer states what producing it cost; only the ledger does. Worth a decision
  before Block 8 reads these numbers.
- **Cutouts are not cached.** The sidecar re-ran all ten on the second pass —
  about three minutes of local CPU, no money — because it loads the ~928 MiB
  model per subprocess. Fine at five slots, the obvious thing to cache later.
- **Pro's wall clock remains unexplained**, and this run took roughly 25–30 s
  per image against session 3's 33–215 s spread.
- Carried forward: `cleaning.ts` has never fired on real footage; the Block 3
  insertions listening pass is unjudged; two pro cache entries deleted in
  session 3 are permanently gone.

## Repo state

- Branch `main`, HEAD `64e7300` — `feat: add a probe mode and a per-plan
  review page` at the last code commit; docs commits follow.
- Six commits this session.
- **`npm run check` exit 0**, `check: PASS`. core **113** (5 files), service
  **506** (34 files), benchmarks **166** (16 files) — **785** TypeScript tests,
  plus **48** sidecar pytest tests. `references: PASS`,
  `models: birefnet-general ok`.
- No commit carries an AI attribution trailer.
- Pushed at session end.

## Suggested next step

Open `benchmarks/results/latest-cutouts/vitasilk/index.html` and look at the
five slots as a set, with the ideas visible. Two questions are waiting on your
eye and neither can be answered from the metrics. First: do the four
`card` slots actually look wrong, or is the halo bound rejecting images you
would happily use? Five of the eight failures involve that one metric and four
turn on it alone, and the ruling — raise the bound, make the metric compare
cutout against original, or accept `card` for rim-lit slots — should come from
seeing them. Second: does `img005` want to be a shelf at
all? Its idea asks for many objects while the mode's invariant asks for one
subject, and if the invariant is right then the slot planner is writing ideas
it should not. Both are prompt-and-mode questions rather than code, which is
why Block 4 can close with them open. After that, Block 5 is the CV zones
work, and `test-1` can be run for $1.21 whenever a second fixture is worth it.
