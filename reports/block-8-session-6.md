Status: OK

Block 8, session 6. **$0.00 spent, no API called, After Effects not driven.**
The panel's blank screen is fixed and proved fixed by a real browser; the first
hand-made reference is committed; the three insertions are diagnosed and the
experiment behind them measured and **not adopted**.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `main` / `origin/main` at start | `3748efe` / `3748efe` |
| tree at start | no modified or staged files; two expected untracked user assets |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start / end | **1 / 1**, left open and untouched |
| `aerender` processes at start / end | **0 / 0** |

## Done

### Goal 1 — the panel threw inside the environment it requires

Two faults, stacked. Both diagnosed before anything was changed.

**Fault A — the manifest, not the detection.** `panel/CSXS/manifest.xml`
declared only:

```
<Parameter>--allow-file-access</Parameter>
<Parameter>--allow-file-access-from-files</Parameter>
```

CEP injects `cep_node` **only when `--enable-nodejs` is declared**, and only
puts it on the page's own window when **`--mixed-context`** merges the Node and
browser contexts. Both were missing, so the panel loaded into a Chromium with
no Node at all.

**The code was testing the right thing.** `host.ts` read
`(globalThis as {...}).cep_node`, and in a browser `globalThis` *is* `window`,
so `globalThis.cep_node` and `window.cep_node` are the same lookup. **The
manifest was at fault, and only the manifest.**

Confirmed against a working extension rather than from memory:
`flow-v1.5.2`, which loads in this same AE, declares

```
--enable-nodejs   --allow-file-access-from-files   --allow-file-access   --mixed-context
```

and the running `CEPHtmlEngine` process carries the same four on its command
line. All four are now in our manifest.

**Fault B — a missing capability was a throw at module load.** `cepNode()`
threw when the global was absent, and `index.tsx` resolved the host at **module
scope** (`const repo = repoRoot(extensionPath)`), so the throw ran **before
React mounted**. The panel's own error surface — built for exactly this — never
rendered, and the user got a black rectangle. That is the `Ae` → `Hc` frame pair
in the reported stack.

Restructured:

- `detectHost(): HostEnvironment` returns a discriminated union and **never
  throws**; everything host-resolving happens inside its `try`.
- `index.tsx` mounts unconditionally: `createRoot(root).render(<App env={detectHost()} />)`.
- An unavailable host is a **first-class screen** with the brand header, the
  cause verbatim per ARCHITECTURE §8, and a `prevents` line in plain words —
  "cep_node is not available" means nothing to a motion designer looking at a
  blank panel.
- The two failures are told apart: no `cep_node` names the manifest and the
  restart; a `cep_node` that is present but unusable reports `host bridge`.
  Telling a user who plainly *is* inside After Effects that he is not would send
  him looking in the wrong place.

**Every other startup throw found, and what each became:**

| site | was | now |
|---|---|---|
| `index.tsx` — `#root` missing | `throw new Error('index.html has no #root')` | plain DOM message naming `npm run panel:build`; no throw |
| `index.tsx` — host resolution at module scope | threw through `repoRoot` → `cepNode` | `detectHost()` value |
| `host.ts` — `createHost`, `loadReels`, `loadModes`, `logoPath` | each threw via `cepNode()` | all reached only inside `detectHost`'s try |
| `service.ts` — `connect()` | `host.readHandshake()` and `host.processAlive()` called unguarded; either throwing became an unhandled rejection inside an effect | wrapped, returns a `service-handshake` error state |
| `App.tsx` — `loadReels().then(setReels)` | a rejection was unhandled | `.then(set, () => set([]))`; the empty picker already words itself |

**Why the tests passed.** happy-dom never provides `cep_node`, so the throwing
branch was **the only one ever taken** and it passed by being universal — a test
of the failure path only. Six new tests exercise the global **present**,
**absent** and **malformed**, asserting the app mounts in all three: absent
renders the manifest guidance, malformed renders `host bridge` and *not* the
manifest guidance, present mounts the real screen. A seventh drives six hostile
shapes of the global (`undefined`, `null`, `0`, `''`, `{}`,
`{ require: 'not a function' }`) and asserts `detectHost` never throws.

### Goal 2 — proved it renders, without a human

**It runs, reliably.** `panel/src/render.browser.test.ts`, Playwright over the
built `panel/dist` loaded from `file://`, with `cep_node` stubbed rather than
the real bridge. **Nine assertions, ~750 ms**, inside `npm run check`.

It asserts what happy-dom cannot: `#root` has a **measured** bounding box over
300×300, the header has real height, the brand mark renders with non-zero
width, the four section headings are exactly `Service / Video / Client mode /
Build`, each of the **three service states** renders (starting with a hanging
fetch, unreachable with no handshake, healthy with a stubbed one — and the
healthy card contains no `{`, so the payload is read as words), the Run control
is disabled with a non-empty reason, the logo `<img>` replaces the fallback mark
once the file is on disk, and the **page's own uncaught-error count is zero**.

A tenth reproduces the fixed fault from the other side: with **no** `cep_node`
at all, the panel still mounts, still lays out over 100 px tall, and its first
card names `cep_node` and `--enable-nodejs`.

Two robustness details: the panel's `test` script builds first, so the check
always has something to check; and if the browser binary is absent the suite
**skips with a printed notice** naming `npx playwright install chromium`,
never silently.

### Goal 3 — the reference and the logo

**`benchmarks/references/align/vitasilk.json`** validated against the schema
before committing: schema 1, reel `vitasilk`, 73 entries — **54 correct, 18
wrong, 1 two-tokens, 0 no-token**, 0 notes. Matches 54/18/1/0 exactly.
Committed alone as `docs: add hand-made alignment reference for vitasilk`.

**`assets/brand/Framopia_LOGO.png`**: **962 × 1077**, 8-bit RGBA, colour type 6,
**alpha channel present**, 15,073 bytes — exactly what PROJECT_SPEC §6
describes. Committed separately. **The panel header now uses it rather than the
fallback**, pinned by a browser test that asserts an `<img>` renders with
`assets/brand/Framopia_LOGO.png` in its `src` and the `.mark` fallback is gone.

### Goal 4 — a reference judges the aligner, not the repo

`core/src/aligner-hash.ts`. **The hashed set, enumerated:**

- `core/src/align.ts` — the DP and the backtrace
- `core/src/normalize.ts` — what both sides are compared through
- `core/src/align-review.ts` — the projection from pairs to rows

Nothing else can change which draft token a corrected word is paired with.
Stored as **`alignerHash`** beside `headSha`, which stays as provenance.
Optional with a default: a reference lacking it is **noticed, not rejected**.

**Did the aligner change between `dcc3b1d` and HEAD?** `git diff` over the four
alignment files reports **one** change: `core/src/align-review.ts` gained
`type SheetRow` on a re-export line. `align.ts`, `normalize.ts` and
`service/src/transcription/align.ts` are untouched. **No pairing could have
moved.**

**`vitasilk.json` scores clean without `--allow-sha-drift`**, verified live:

```
note: this reference predates alignerHash, so drift can only be judged from headSha,
which has moved (dcc3b1d7392a -> 280eb853bab2). Whether the aligner itself changed
is not recorded in the file.
73 of 73 rows judged
74.0% of judged pairings have a human-confirmed alignment (54 correct + 0 misheard of 73).
```

The file was **not hand-edited and not regenerated**; it carries no hash, and
any hash it gains will be written by the tool.

**Known limitation, stated rather than engineered around:** `align-review.ts`
also holds the reference schema and re-exports the sheet renderer, so an edit to
either bumps the hash without any pairing changing — a false positive on one
file, against `headSha`'s false positive on the whole repository.

### Goal 5 — the fifth verdict

**`misheard`**: the pairing is in the right place, the draft token is a
different word from the one spoken. Schema **2**; version 1 files stay valid and
are read **without migration**, keeping the version they were written at — a v1
file rewritten as v2 would claim the reviewer was offered a button he was not.
A `misheard` verdict inside a v1 file is refused, naming the version.

It **counts as a correct alignment** and is **reported on its own line**:

```
74.0% of judged pairings have a human-confirmed alignment (54 correct + 0 misheard of 73).
```

Never folded together — `correct` measures the aligner, `misheard` measures
Scribe, and a number hiding which is which is the reason the verdict exists. In
comparison mode a moved `misheard` row is a **regression**, exactly like
`correct`. The button is on both sheets with the hint *the pairing is in the
right place but the machine heard a different word*, and both footers explain
it.

Ten new tests: the tally and its cross/same split, the confirmed share, moved
`misheard` bucketing as a regression, held when unmoved, refusal inside v1,
v1 read without migration, `alignerHash` carried through and type-checked, the
unknown-version message naming what it can read, five-way exclusivity on a row,
the counter, the hint text, the download at schema 2 with the hash, and the
button on the re-review sheet.

**`vitasilk.json` is untouched** and still reads 54/18/1/0 with no `misheard`.

### Goal 6 — the mechanism. Nothing was changed.

**All three insertions are ties, not wins.**

| insert | next draft token | run | closes at | DP cell | winning path | straight pairing |
|---|---|---:|---|---|---:|---:|
| `5` at corrected 0 | `خمس` (draft 0) | 5 subs | `minutes.` | i=0, j=1 | 1 insert + 5 subs = **6** | 6 subs + 1 insert = **6** |
| `mn` at corrected 28 | `من` (draft 27) | 9 subs | `et` | i=27, j=29 | 1 insert + 9 subs = **10** | 10 subs + 1 insert = **10** |
| `chno` at corrected 50 | `شنو` (draft 48) | 7 subs | `salon.` | i=48, j=51 | 1 insert + 7 subs = **8** | 8 subs + 1 insert = **8** |

Exact cell costs:

- **`5`, cell (0, 1).** Row 0, so substitute and delete do not exist — the
  boundary is initialised to `j`. Insert: `d[0][0]=0 + 1 = 1`. `d[0][1] = 1`.
  Accumulated: `d` before the insert 0, `d` at the closing match `minutes.` 6,
  so the run costs 6.
- **`mn`, cell (27, 29).** Match unavailable (`silk` ≠ `mn`). Substitute
  `d[26][28]=19 + 1 = 20`. Delete `d[26][29]=20 + 1 = 21`. Insert
  `d[27][28]=18 + 1 = 19`. `d[27][29] = 19`. Accumulated 18 → 28 across the
  run: **10**.
- **`chno`, cell (48, 51).** Match unavailable (`brésilien` ≠ `chno`).
  Substitute `d[47][50]=30 + 1 = 31`. Delete `d[47][51]=31 + 1 = 32`. Insert
  `d[48][50]=29 + 1 = 30`. `d[48][51] = 30`. Accumulated 29 → 37: **8**.

**Which rule breaks the tie — proved, not asserted.** Re-running the identical
DP with only the backtrace preference flipped from `substitute > insert` to
`insert > substitute` moves every insertion to the **end** of its run — `5` from
corrected 0 to corrected 5, and so on — with the **total edit cost identical at
45 either way**. The rule is the `else if` chain at `core/src/align.ts:43-53`,
combined with the reverse traversal from `(n, m)` and the final `reverse()`.

**What the normaliser does:** `normalizeToken` trims and strips edge
punctuation on both sides, and additionally lowercases and collapses whitespace
on Latin. `'5' → '5'`, `'خمس' → 'خمس'`; `'mn' → 'mn'`, `'من' → 'من'`;
`'chno' → 'chno'`, `'شنو' → 'شنو'`. **None equal.** It never crosses scripts,
so a match is impossible and every pairing in the run costs exactly 1.

**The mechanism, in one paragraph.** Where the corrected side of a run carries
one more token than the draft side and every pairing in it is cross-script,
each pairing costs 1 and no pairing can cost 0, so *every* path through the run
performs the same number of operations: one insertion and *k* substitutions,
whatever order they occur in. The DP therefore has many optimal paths of equal
total cost, and the value table cannot distinguish them. The backtrace picks
one, walking backwards from the end of the run — which is an exact match, the
only place the two sides agree — and at every cell it prefers a substitution to
an insertion whenever a substitution lies on an optimal path. Walking backwards
that preference consumes substitutions for as long as it can, so the single
insertion is deferred all the way to the **earliest** hypothesis index in the
run. The visible result is a phantom word at the start with no draft token and
every word after it holding the interval of the token *before* its own, until
the closing match resynchronises. Nothing about the cost model prefers this; it
is the arbitrary half of a tie.

**Insert operations across all five reels**, with the run being the consecutive
substitutions that follow, and whether it closes at an exact match:

| reel | inserts | runs ending at an exact match | run lengths |
|---|---:|---:|---|
| ground-truth | 4 | 3 | 5, 8, 6 (and one trailing insert with no run) |
| test-1 | 3 | 1 | 9 (and two trailing inserts with no run) |
| test-2 | 1 | 1 | 5 |
| test-3 | 2 | 2 | 1, 3 |
| vitasilk | 3 | 3 | 5, 9, 7 |
| **corpus** | **13** | **10** | — |

**The many-to-one question, sized.** Across all five reels there are **14 bare
numerals**; **1** has a draft side spanning two or more tokens under the current
alignment — ground-truth's `20`, with `يوم` ("day") deleted beside it, which is
a deletion rather than a merge. **The known `26` ← `ستة` + `وعشرين` case does
not show as spanning at all**: it anchors to `وعشرين` alone, because the
neighbouring shift absorbed `ستة`. The aligner's own output therefore
**undercounts merges for exactly the reason this defect exists**, and the only
non-circular count is the human one — **1 `two-tokens` row in 73**. One
occurrence by either measure does not justify an operation.

### Goal 7 — experiment 1, measured and not adopted

One change only: `AlignCosts` is a parameter on `align()`, defaulting to
`DEFAULT_ALIGN_COSTS` (1/1/1, the Block 2 values). `EXPENSIVE_INSERT_COSTS`
raises insertion to **2**. **No transliteration cost. No many-to-one
operation.** Selected with `--cost-model expensive-insert`; nothing in the
pipeline passes it.

**Why 2**: substitution costs 1, the competing paths tie *exactly*, and the
smallest integer above 1 is the only value worth trying first. Lower than 2
(1.5) would break the same ties in the same direction and differ only in which
*other* alignments it disturbs; higher (3, 4) buys nothing here and would
suppress genuine insertions, of which the corpus has several at reel ends.

**Against the committed reference, `vitasilk`:**

| bucket | count |
|---|---:|
| wrong, now pairs differently (**candidate repairs**) | **0** |
| correct or misheard, now pairs differently (**regressions**) | **0** |
| two tokens, still inexpressible | 1 |
| wrong, unmoved | 18 |
| correct, held | 54 |

**The regression count is zero.** So is the repair count. **Nothing moved on
`vitasilk` at all.** The re-review sheet was emitted and is empty of moved rows.

The repair count is a **candidate figure** in any case: a pairing that changes
from wrong to differently-wrong scores as an improvement here, and only a human
can tell the difference. Here there is nothing even to review.

**And the arithmetic says no value of the insertion cost could have worked.**
Both competing paths contain **exactly one insertion** — insert-then-shift, and
pair-directly-then-insert-at-the-end — so raising its price raises both equally
and the tie survives. The experiment was worth running and its result is
negative for a structural reason, not for want of a better constant.

**The other four reels**, movement only, no reference and no claim about
correctness:

| reel | rows moved | inserts, default → variant |
|---|---:|---|
| ground-truth | **13** | 4 → 3 |
| test-1 | 0 | 3 → 3 |
| test-2 | 0 | 1 → 1 |
| test-3 | 0 | 2 → 2 |
| vitasilk | 0 | 3 → 3 |

ground-truth moves because one of its runs carries **two** competing insertions,
where dropping one genuinely saves cost. That is consistent with the mechanism
and is not evidence the variant helps.

**The variant is not adopted.** **The default path is unchanged, verified**:
pairings for all five reels are byte-identical to before under the default
model.

### Goal 8 — the duplicated helper, and the CJK token

**`processAlive` has one home**, `core/src/process-alive.ts`, imported by
`service/src/lock.ts` and `panel/src/host.ts`. A single home beats two pinned
copies because the rule is four lines and there was no reason for two; the
module has **no imports**, so the panel bundles it without pulling Node into a
browser build. A test asserts both callers import it **and that neither signals
a pid directly**, so a re-introduced copy fails the gate. Its own behaviour —
EPERM as alive, ESRCH as dead, nonsense pids rejected without signalling — moved
with it.

**Recorded as a known issue, not changed:** `vitasilk` draft token 5 is **`五`**,
CJK for five. It is the **only CJK codepoint across all five drafts** (1 of
339 draft tokens carries one). `tokenScript('五')` returns **`latin`**, the same
as `tokenScript('5')`, because the classifier tests only for Arabic script and
everything else falls through to Latin. So the row is treated as **same-script**
and is **dimmed on the review sheet as a pairing Levenshtein had evidence for**,
when it had none — `normalizeToken('五') === '五' ≠ '5'`. The pairing happens to
be right; the classification is not.

### Goal 9 — CLAUDE.md and the gate

CLAUDE.md carries the host-detection contract as a binding convention
("nothing in the panel's startup path may throw"), the headless render check,
the reference file and the five verdicts, `alignerHash` and what it covers, the
`--cost-model` flag with the default unchanged, and a session section with the
mechanism and the measurements.

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against session 4 |
|---|---:|---|
| `@framopia/core` | 235 (11 files) | 215 |
| `framopia-service` | 753 (54 files) | 757 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| `framopia-panel` | 33 + 1 skipped (2 files) | 17 |
| **TS total** | **1187** | **1155** |
| pytest (sidecar) | **141** | 141 unchanged |

The service count falls by 4 because `processAlive`'s four behaviour tests moved
to core with the function.

## New dependencies

| dependency | reason |
|---|---|
| `playwright` (devDependency of `framopia-panel`) | the only way to assert a panel actually lays out and reports uncaught errors; happy-dom parses and executes but measures nothing, which is how a blank panel passed a green suite |
| `@framopia/core` re-added to `framopia-panel` dependencies | the panel now imports `processAlive` from its single home |

## Deviations

- **The `--cost-model` flag was added to `align:score` only**, not to
  `align:review`. The review sheet is what a human marks up, and offering a
  non-default model there would produce a reference judging an aligner nothing
  ships.
- **Goal 6's DP costs are reported for `vitasilk` in full and for the other
  reels as run counts**, which is what the goal asks; the per-cell breakdown for
  thirteen inserts across five reels would be noise.
- **The many-to-one count is reported two ways**, because the single number the
  goal asks for is measured from the aligner's own output and that output
  undercounts merges. Both are given, with the reason.

## Failures & open problems

- **Nothing was lost or corrupted.** No plan, cache entry, ledger line or
  template was written. The ledger is byte-identical at both ends and
  `templates/library.aep` was not opened. `vitasilk.json` was committed exactly
  as the user left it.
- **The panel has still never been seen inside After Effects with the fix.** It
  is proved in a real browser engine with a stubbed bridge, which is a
  materially stronger claim than before — but `cep_node` itself, the real
  `CSInterface`, and the manifest change all need an AE restart to be exercised.
  **The manifest change cannot take effect until AE is restarted**, which this
  session was forbidden to do.
- **`createHost`, `loadReels`, `loadModes` and `logoPath` still only run against
  a stub.** The browser test drives a fake `cep_node`; the real one is
  untested.
- **Spawning the service has never been exercised**, in any environment.
- **The `misheard` verdict has never been used.** The button exists and is
  tested; no human has pressed it, and `vitasilk.json` predates it.
- **`alignerHash` cannot help the one reference that exists.** It predates the
  field, so its drift check is the weaker `headSha` notice. The next reference
  gets the real check.
- **Experiment 1 is a dead end and the code stays.** `EXPENSIVE_INSERT_COSTS` is
  kept as the record of a measured negative result, unused by any pipeline. If
  that reads as clutter later, it should be deleted with its report cited, not
  quietly.
- **The CJK classification is wrong and unchanged**, by instruction.
- **The re-review sheet has still never been produced from a real change**, only
  from a comparison that moved nothing.
- Carried forward: the aligner defect itself is untouched, headless AE is not
  met, `vitasilk` is the only reel ever built, 28 cards have a clipped hold, all
  13 multi-word Arabic §6 terms split across cards, `runSidecar` still lives in
  `service/`, and a third copy of the Arabic-script regex remains unpinned.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`784a9a0` `refactor: give processAlive one
  home`**, preceded by `feat: make the align cost model selectable`,
  `feat: hash the aligner, and add the misheard verdict`, `chore: add the
  framopia logo`, `docs: add hand-made alignment reference for vitasilk`,
  `test: render the built panel in a real browser` and `fix: mount the panel
  even when the host is unavailable`, on session 4's `3748efe`. **This report's
  own commit (`docs: record block 8 session 6`) follows it** and is not
  reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — 1187 TS tests across four
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at start and
  end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** at start and end, **0** `aerender`. Left open,
  never driven.

## Suggested next step

Restart After Effects with the rebuilt panel, because the manifest change is
inert until it does and every remaining claim about the panel rests on a stub.
Then take the aligner where the diagnosis actually points: the insertion is a
tie, so no cost on insertion can break it, and the two levers that can are a
**transliteration-aware substitution cost** — which makes `mn`/`من` cheaper than
every other candidate and turns a flat surface into one with a minimum — and a
**tie-break that prefers the pairing with more same-script or
transliteration-adjacent anchors**. The first is real work against
ORTHOGRAPHY_GUIDE §2's table and is the one the defect record has named since
Block 7; the second is small and worth measuring first, precisely because this
session proved the tie-break is what decides. Run either as a single experiment
against the committed reference with `--compare`, and read the regression count
before the repair count.

## What the user does next

**Rebuild and reinstall the panel:**

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run panel:build && npm run panel:install
```

**Then quit After Effects and open it again.** This time it is not optional.
The fix included a change to the extension's manifest — the file that tells
After Effects to give the panel access to the file system — and After Effects
only reads that file when it starts. Until you restart, the panel will keep
behaving exactly as it did.

Open it from *Window → Extensions → Framopia Studio*.

What should be different: it will render. Before, it was a black rectangle,
because the panel was asking After Effects for something the manifest had never
requested, and the way it complained about that killed the screen before
anything could be drawn. Both halves are fixed — the manifest now asks properly,
and if anything is ever missing again the panel will show you a card explaining
what and what it stops you doing, instead of going blank.

You should see the Framopia logo at the top — your PNG is in the project now and
the panel uses it. Below it, a **Service** card that turns green and says
**Ready**, then your five reels, the K2 Syndicalia mode, and a greyed-out **Run
pipeline** button with a line under it saying the pipeline runner is not built
yet. That line is honest, not a placeholder.

One new thing in the review sheet when you next open it: a fifth button,
**misheard**, for the case you ran into — where the pairing is in the right
place but the machine simply heard a different word, like `msbsb` against
`مصبوغ`. It counts as a correct alignment and is tracked separately, so those
rows stop being forced into either "wrong" or "correct" when neither is what you
mean.

Your existing marks are safe. The file you produced is committed exactly as you
saved it, and nothing has rewritten it.
