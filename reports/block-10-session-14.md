Status: OK

# Block 10 session 14 — `npm run golden`

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. `templates/library.aep` `1d7553e894…` at both
ends. Cache **46 entries / 79 files / 55,363,681 bytes**, nothing created. All
five Edit Plans and all six declared hand-made references byte-identical. After
Effects **pid 79146** throughout — the same instance since Block 9 session 12 —
no project saved, no font set or installed. Free space **173.2 GB**.

**Twenty-eight builds this session, all free.** `npm run golden` exists, four
reels match field for field, and the harness has been watched failing on eight
distinct kinds of difference.

---

## Done

### A. What legitimately varies, measured rather than reasoned about

Each reel was built **three times**, censused immediately after its own build,
and the three censuses diffed field by field. Then the census was extended (see
below) and **the whole measurement was repeated**, because an exclusion list
inherited across a schema change would be evidence about a different artifact.

**Pass 1 — 12 builds, the census as it stood:**

| reel | fields per census | varied | which |
|---|---:|---:|---|
| test-1 | 4,350 | 2 | `aepSha256`, `measuredAt` |
| test-2 | 4,283 | 2 | `aepSha256`, `measuredAt` |
| test-3 | 3,712 | 2 | `aepSha256`, `measuredAt` |
| vitasilk | 4,688 | 2 | `aepSha256`, `measuredAt` |
| **total** | **17,033** | **8 paths** | **51,099 readings across three passes** |

**Pass 2 — 12 more builds, after the census learned to record image sources:**

| reel | fields per census | varied | which |
|---|---:|---:|---|
| test-1 | 4,418 | 2 | `aepSha256`, `measuredAt` |
| test-2 | 4,283 | 2 | `aepSha256`, `measuredAt` |
| test-3 | 3,712 | 2 | `aepSha256`, `measuredAt` |
| vitasilk | 4,773 | 2 | `aepSha256`, `measuredAt` |
| **total** | **17,186** | **8 paths** | **51,558 readings across three passes** |

**Exactly two fields move, and they move on every reel.** `measuredAt` is the
wall clock; `aepSha256` moves because After Effects embeds a timestamp in the
project file, so two builds of one comp never have the same bytes. Everything
else is identical run to run: every card's text, face, size, tracking and fill
colour, every shrink factor, every position and scale, every audio level, every
in-point and out-point, every layer count, and — after the extension — the file
behind every picture.

**Nothing surprised me, and the one thing worth saying plainly is the absence of
a surprise.** Session 3's shrink-to-fit and session 4's break-before-shrink both
depend on After Effects measuring text at build time through `sourceRectAtTime`,
and a measurement taken inside a running application is exactly where run-to-run
drift would be expected. **It does not drift**: all four cards that break and
all seven that shrink came out identical in all three runs, to the last decimal
of `fontSize`.

**The exclusion list is those two fields and nothing else**, and each carries
its evidence in the code — the values observed and the 24 builds behind them.
A test pins the list at exactly two, because that list is the one place this
harness could be quietly weakened: adding a path to it makes a real difference
invisible.

**Absolute paths are normalised, not excluded.** Three fields hold one —
`aepPath`, `masters[].layers[].sourceFile`, `imageComps[].layers[].sourceFile`
— and every value on every reel points inside the repository. They are made
repo-relative, so a repository in another folder compares equal (session 11) and
a path differing in any other way still fails. Proven by a test that re-roots a
census onto a different prefix and asserts the two normalise identical.

**Nothing was pre-excluded on the grounds that another machine might differ.**
`aeVersion` and `fontNameCount` are compared like everything else. **They will
very likely differ on the partner's Mac**, and that is a deliberate consequence
rather than an oversight: no measurement here justifies excluding them, and a
difference in either is a real fact about his machine that the run should say
out loud. **If they prove noisy in practice that is a ruling to take, not
something to pre-empt** — the harness prints both versions side by side in its
header so the cause is visible immediately.

### The census recorded nothing about the pictures, and now does

Found by trying to perturb an image path for §3.2 and discovering **there was
none to perturb**. A master's image layers are *comp* layers pointing at the
duplicated element comp, so they carry no `sourceFile`; the census kept masters
and text comps and dropped image element comps entirely. Searching the whole
recorded census for `cutout`, `.png`, `.jpg` or a candidate id returned **zero
hits**.

**So a build that placed the wrong picture would have matched a golden reference
perfectly** — and "saved work that did not copy across completely" is one of the
three likeliest ways the second machine differs.

`ImageCompCensus` is a **schema addition, optional with a default**: per image
element comp, each layer's name, source name, source file, position and scale.
The raw ExtendScript dump already carried it; only `shapeCensus` was discarding
it, so **no `.jsx` changed**. `vitasilk` now records five image comps, and the
distinction between a cached `image.jpg` and a flattened cutout PNG is visible:

```
img001__img_float  IMG_MAIN -> .local/cache/…/images-699c0a38a9c512ff/image.jpg
img002__img_float  IMG_MAIN -> my files/test videos/cutouts/vitasilk/img002-c1.cutout.on-fill.png
```

### B. `npm run golden`

Pure comparison and normalisation in `core/src/golden.ts`, so `npm run check`
runs them; `tools/golden/cli.ts` builds, censuses and reports, and decides
nothing.

- **Free by construction, not by sampling.** The harness builds and censuses;
  neither reaches a paid API. `golden.test.ts` pins that by reading the CLI's own
  source for `appendCost`, `generateImages`, `runPipeline`, `transcribeHybrid`,
  `GoogleGenAI` and `@google/genai` — the same shape the align-review tools are
  pinned read-only with. The ledger's line count and sha256 are printed at both
  ends and a move fails the run.
- **A difference names the reel, the field path, the expected value and the
  actual one.** Not a count; session 13 fixed exactly that shape in the
  references gate.
- **It records its own inputs**: machine, repo root, git commit, the reels, the
  reel excluded and why, the ledger, the reference's own sha256 and when and
  where it was recorded, and the After Effects version on both sides.
- **It states its exclusions and their evidence in its own output**, so a reader
  never has to go looking for the definition of the number in front of them.
- **Recording is `--record`**, a separate action. A command that quietly
  rewrites what it checks against is a check that cannot fail.

**One correction to the brief's assumption, and it matters.** §2.1 asks the run
to refuse if any stage would bill. Implemented literally against the pipeline
dry run, it **refused `test-3`** — whose analysis and images were never run, so
a *pipeline* run would cost $2.3508 — even though `test-3` builds perfectly well
from what is already on disk and building spends nothing. The dry-run figure
answers a different question from the one the harness asks. It is now printed as
information beside each reel and is **not** a refusal; the guarantees that carry
the weight are the structural one and the ledger check.

### C. Recorded, and watched failing

**The reference**: `benchmarks/references/golden/census.json`, **737,224 bytes**,
sha256 `1355117110bdf441…`, recorded on this machine at After Effects 26.0x67.

| reel | fields compared |
|---|---:|
| test-1 | 4,416 |
| test-2 | 4,281 |
| test-3 | 3,710 |
| vitasilk | 4,771 |
| **total** | **17,178** |

**A clean run: `4 of 4 reels matched, field for field`, exit 0.**

**Every failure below was produced against a perturbed *copy*. The committed
reference was never modified** — its sha256 is the one recorded above, before
and after.

| case | what was changed | what the harness said | names field + both values |
|---|---|---|---|
| card text | `vitasilk` `g001` `TXT_MAIN.text` `5` → `FIVE` | `vitasilk.textComps[0].layers[0].text` expected `"FIVE"` actual `"5"` | yes |
| font size | `test-1` first card `fontSize` 343 → 999 | `test-1.textComps[0].layers[0].fontSize` expected 999 actual 343 | yes |
| layer count | `test-2` `master_final.numLayers` 69 → 99 | `test-2.masters[0].numLayers` expected 99 actual 69 | yes |
| position | `vitasilk` an image layer's position → `[1,2]` | `vitasilk.masters[0].layers[6].position[0]` expected 1 actual 516.357116699219 | yes |
| source file | `vitasilk` the whoosh's `sourceFile` → a made-up path | `…layers[0].sourceFile` expected `"my files/…/elsewhere.png"` actual `"assets/sfx/whoosh_01.wav"` | yes |
| **image file** | `vitasilk` `img001`'s `IMG_MAIN` → a different candidate | `vitasilk.imageComps[0].layers[0].sourceFile` expected `"my files/…/img001-c2.cutout.png"` actual `".local/cache/…/image.jpg"` | yes |
| missing reel | `test-3` deleted from the reference | `… has no census for test-3` | yes |
| missing reference | no file at the path | `there is no golden reference at …. Record one with npm run golden -- --record; a comparison against nothing passes trivially.` | yes |
| unparseable | `not json at all` | `… is not readable JSON: Unexpected token 'o' …` | yes |
| wrong schema | `schemaVersion` 1 → 7 | `… has schemaVersion 7; this build reads 1` | yes |

**All ten exit non-zero.** Every difference case also prints the summary line
*"golden: 3 of 4 reels matched; N field(s) differ across <reel>. A difference is
a finding, not a fault: send this output rather than changing anything."*

**19 unit tests** in `core/src/golden.test.ts` cover normalisation (exclusion,
re-rooting, key order, a path outside the repository left alone), comparison
(field path and both values, an array length change, a key present on one side
only, a type change), the reference parse, and the no-billing pin. **Nothing in
a test opens After Effects or builds anything** — all of it runs off fixtures.

### D. In the partner's hands

- **`docs/SECOND_MACHINE.md` §15** is the final step, after the doctor stops
  printing blockers: what it does in his terms ("about 17,000 details … every
  word on every card, the typeface and size each was set in, which words had to
  be made smaller to fit, where every picture sits, which picture file each one
  used"), that it costs nothing, that After Effects has to be open, and what
  `PASS` looks like.
- **If it does not pass: send the output and stop.** In those words, with *"do
  not change anything, do not rebuild, do not reinstall"* and the reason — a
  difference is the finding, and more useful than a clean run.
- **The three likely causes are named** so he is not alarmed: a different After
  Effects version (both are printed side by side), a font that resolved
  differently (§7's trap), or saved work that did not copy completely — which is
  now detectable precisely because of the image-source extension above.
- **The handover section names the golden set** and says `ground-truth` is
  excluded because its pictures were never bought, so it cannot be built at all.
- `CLAUDE.md` gains the command and a section; `docs/ARCHITECTURE.md` gains
  **§7.1 The check surface**, distinguishing the three commands that are
  routinely confused: `npm run check` (is the code correct here),
  `npm run doctor` (can this machine run it at all), `npm run golden` (does this
  machine build the same thing).

---

## Deviations

**One, reported above rather than absorbed**: §2.1's billing refusal, taken
literally against the pipeline dry run, refuses `test-3` — a reel that builds
fine. The refusal was replaced by a structural guarantee (the harness imports
nothing that bills, pinned by a test that reads its source) plus the ledger
check at both ends, and the pipeline figure is printed as information.

**One thing done that the brief did not ask for**: extending the census to
record image sources. It was not optional — §3.2 asks for an image-path
perturbation, and there was no image path in the census to perturb. The variance
measurement was then re-run in full rather than inherited.

Nothing else outside the deliverables was touched. No billable stage ran, no
reel was added to the golden set, no ruled constant, mode, template, cache
entry, Edit Plan, generated image or hand-made reference changed, and the panel
was not exercised.

## Failures & open problems

**Unproven, by name:**

- **The ledger guard has never fired end to end.** Its logic runs on every
  golden run and reported the ledger unmoved every time, but a run in which the
  ledger actually moves was not staged — that would mean writing to the real cost
  ledger, which is a user asset. **The comparison is exercised; the failure path
  is not.**
- **`aeVersion` and `fontNameCount` differing has not been observed**, because
  there is one machine and one After Effects here. They are compared
  deliberately (§1.4) and are the two fields most likely to make his first run
  read as a failure.
- **The harness has never run against a differently-built comp** — only against
  perturbed references. A real second After Effects producing a real difference
  is what his machine supplies, and is the whole point.

**Open:**

- **`ground-truth` is still unbuildable and outside the golden set.** Its six
  pictures cost about $2.17 and the image service has answered with a capacity
  error since session 7.
- **The golden set is one machine's output.** Until his run, "the reference is
  correct" means "it is what this Mac produces", not "it is what the tool should
  produce".
- **`build-reel.jsx`'s unsaved-changes guard** and **the panel suite's 5000 ms
  timeout** are untouched by instruction; sessions 12 and 13 wrote up what each
  would need, and each needs a ruling rather than a patch.
- **The census still records no keyframes**, so an animation that differed would
  not be caught. Out of scope here and worth naming: what is compared is the
  built structure and its type, not its motion.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `d01c35c` *fix: type the golden normalisation test's reads* |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at start and end |
| `templates/library.aep` | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| cache | **46 entries / 79 files / 55,363,681 bytes**, nothing created |
| fonts | **445 families / 1,198 face names** — one reading counted two ways — at start and end |
| After Effects | pid **79146**, 0 `aerender`; left on `.local/build/vitasilk-full.aep`, clean, the golden run's own output |
| free space | **173.2 GB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references, sha256, identical at start and end:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Edit Plans, sha256, identical at start and end:**

```
0712e4124d8b5f09641de4ed4276897f3c8cb6781e705df64d49c84dc5db7034  ground truth.editplan.json
1acf10bf06925473c501f30b8ebb290c5fa8f091fcc5ca32485e1ff316221e35  test 1.editplan.json
94da6dd60af1d138a87e1c8f2cc235f542014605d14c4795f165d35c11d27f0a  test 2.editplan.json
dbf28f9bafb55b126d97076b16df56baa1a2d7775343dc07ed6af83468302594  test 3.editplan.json
c8501bcafc79ed3bd74fec776a2401efa8e68caab41cea5b8d2d1ac221c63c20  vitasilk.editplan.json
```

**`npm run check`: PASS** (exit 0), counts read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 685 | **704** |
| service | 1168 | **1168** |
| benchmarks | 173 | **173** |
| panel | 159 + 2 skipped | **159 + 2 skipped** |
| references | 6 hand-made files, `references: PASS` | unchanged |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| ExtendScript | `14 .jsx file(s) ok` | unchanged |
| panel manifest | `manifest.xml ok` | unchanged |

The +19 in core is `golden.test.ts` exactly; no other file's count moved.

## Suggested next step

**Send it.** Everything Block 10 set out to build exists: a doctor that says
what a cold machine is missing, a gate that notices a lost reference, an install
document whose every claim is either measured or marked unverified, and now a
command that answers the block's actual question in one line.

The remaining uncertainty is not reducible from here. The reference is one
machine's output, `aeVersion` and `fontNameCount` have only ever been observed
agreeing with themselves, and the three doctor checks never seen failing can
only be tested by a machine that has never run this. **His first run is the
measurement**, and the documentation now tells him that a difference is what we
want rather than something to hide.

## Commits

| | |
|---|---|
| `6c3685b` | `feat: measure what a build legitimately varies in` |
| `f5032f7` | `feat: add npm run golden` |
| `41f8077` | `test: record the golden reference for four reels` |
| `e70cab9` | `docs: hand the golden run to the second machine` |
| `d01c35c` | `fix: type the golden normalisation test's reads` |
| this one | these reports |
