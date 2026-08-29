Status: OK

# Block 9 session 2 — K2 Syndicalia's real identity

**Spent $0.00. No API was called.** No transcription, correction, analysis or
image generation ran, on any video. After Effects was not contacted in any way:
no `osascript`, no `DoScript`, no `aerender`, nothing launched and nothing quit.

## 1. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, and `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| cache at start | **36 entries** — 11 transcription, 7 analysis, 4 imageslots, 14 images; 61 files, 34 MB |
| cache at end | **36 entries, census identical** — same directories, same file lists, per-entry hashes unchanged |
| After Effects at start / end | **1** instance, pid 79146 (unchanged) |
| `aerender` at start / end | **0 / 0** |

The census is a sha256 of each entry's sorted file list, taken per
`<video-sha>/<stage>-<fingerprint>` directory, and `diff` reports the two runs
identical.

`templates/library.aep`, `.local/ground-truth/` and the hand-made alignment
references are untouched.

## 2. The cache gate

### 2.1 Exactly which fields go into each key

**Transcription** — `fingerprintOf` in
`service/src/transcription/fingerprint.ts`:

```ts
export function fingerprintOf(inputs: FingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.promptVersion,
    inputs.geminiModel,
    inputs.guideVersion,
    inputs.scribeModel,
    inputs.keyterms,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
```

**The correction pass has no key of its own.** It is the second leg of the
hybrid transcription and shares that entry; `promptVersion` above *is* the
correction prompt's version (`ACTIVE_PROMPT_VERSION`, frozen at 4), and
`guideVersion` is read out of `ORTHOGRAPHY_GUIDE.md` so a guide bump invalidates
by itself.

**Semantic analysis** — two keys, same scheme, in
`service/src/analysis/fingerprint.ts`:

```ts
export function analysisFingerprintOf(inputs: AnalysisFingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.promptVersion,
    inputs.geminiModel,
    inputs.modeId,
    inputs.modeHash,
    inputs.transcriptHash,
    inputs.candidateCount,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
```

`slotFingerprintOf` is the same array with `ACTIVE_SLOT_PROMPT_VERSION` and its
own `modeHash`.

**Image generation** — `imageFingerprintOf` in
`service/src/images/fingerprint.ts`:

```ts
export function imageFingerprintOf(inputs: ImageFingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.prompt,
    inputs.negativePrompt,
    inputs.modelId,
    inputs.resolution,
    inputs.aspectRatio,
    inputs.candidateIndex,
    inputs.modeId,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
```

### 2.2 Does the mode version participate? Does its content?

**The mode version participates in none of the four.** ARCHITECTURE §6's wording
— "model, prompt version, orthography version, mode version" — **is out of date
and the code is what governs.** It was true until Block 4 session 4 for
analysis and until Block 7 session 1 for images, and both were changed precisely
because a version bump for an edit the model never saw invalidated paid work.
`service/src/images/fingerprint.ts` carries the history in its own doc comment:
the v5 → v6 bump "stranded 14 generated images, $2.064064 of billed API spend,
for an edit the model could not have seen."

Mode **content** participates, and only these parts:

| stage | what of the mode reaches the key |
|---|---|
| transcription | **nothing.** The mode is never read; `keyterms` defaults to `[]` and the pipeline runner passes none |
| keywords | `mode.id`, plus `keywordModeContentHash` = `contentHash([mode.name, mode.vocabulary])` |
| image slots | `mode.id`, plus `slotModeContentHash` = `contentHash([mode.name])` |
| images | `mode.id`, plus the **composed** `prompt` and `negativePrompt` strings verbatim — which is how the palette and `imageStyle` reach it |

### 2.3 What happens on disk at 7 → 8

**Nothing.** The edit adds `fonts`, `textColours` and a `note`, and bumps
`version`. It touches no `name`, no `vocabulary`, no `palette` value and no
`imageStyle` fragment, so no input to any of the four keys moves.

Measured before and after the edit rather than argued, on the real corpus:

| | at v7 | at v8 |
|---|---|---|
| `keywordModeContentHash` | `7756f1e7883417fc` | `7756f1e7883417fc` |
| `slotModeContentHash` | `a654c324f198ed37` | `a654c324f198ed37` |
| `compositionContentHash` | `c5b43f23a3bd4b0b` | `c5b43f23a3bd4b0b` |
| all 18 image keys, `test-1` ×8 and `vitasilk` ×10 | — | **byte-identical** |
| all five reels' dry runs — action, provenance, entry id, estimate | — | **byte-identical** |

So: **`test-1`'s four slots (8 images) and `vitasilk`'s five (10 images) all
still hit, and all five reels' transcription entries still resolve
`compatible` to `transcription-758a3924d090d1b5`.** The 36-entry census is
identical at both ends of the session.

**Decision: the bump is safe, and the session continued.** The three hashes are
now pinned by a test in `core/src/mode.test.ts`, so a future edit that moves one
fails the check instead of silently costing money.

## 3. Inventory

### 3.1 Where a subtitle's colour comes from at build time

**It is not mode-driven, and this session did not make it so.**

The build never sets a fill colour. Text reaches a card through
`framopiaSetText` in `panel/jsx/text-fit.jsx`, whose doc comment is explicit:

```js
/** Sets a point-text layer's string without touching any other style. */
function framopiaSetText(layer, value) {
    var prop = layer.property('Source Text');
    var doc = prop.value;
    doc.text = value;
    prop.setValue(doc);
}
```

Only `doc.text` is assigned. The colour lives in the template comp's own
`TXT_MAIN` text layer in `templates/library.aep`, which the user authored by
hand. The one place the build *does* set a colour is a **Fill effect on an
image card's `CARD` layer** (`panel/jsx/build-reel.jsx`, the `e.cardColor`
branch), derived per picture by `cardColours` — that is the frame around a
picture, not type.

`textColours` is recorded on the mode this session and **read by nothing at
build time**. Making the build colour-driven is a change the user rules on by
looking at a build.

### 3.2 How the ExtendScript sets a font

**It does not, and this is the honest answer rather than an evasion.** A grep
for an assignment to `.font` across `panel/jsx/` and `tools/validate-templates/`
returns **nothing**: no script in this project has ever written
`TextDocument.font`.

What is known, and it is a read rather than a write: the property is
`layer.property('Source Text').value.font`, and `audit.jsx` reads it
(`build.jsx:74`, `td.font`). What After Effects **reported** on this machine, in
`templates/library.audit.json`:

| comp | layer | font as AE reports it |
|---|---|---|
| `sub_pop` | `TXT_MAIN` | `Inter-SemiBold` |
| `sub_pop_ar` | `TXT_MAIN` | `Almarai-Bold` |
| `kw_slam` | `TXT_MAIN` | `Inter-SemiBold` |
| `kw_slam_ar` | `TXT_MAIN` | `Almarai-Bold` |

Those are **PostScript names**, and they differ from `core/src/typography.ts`'s
`Inter Semi-Bold` and `Almarai Bold`.

**What name form a write accepts, and what After Effects does when a name does
not resolve, are not knowable from this repository.** Nothing has ever set the
property, so there is no observation to report and none was invented. Both
questions are answered by one measurement inside After Effects on the user's
machine, and that is where `Cormorant Garamond SemiBold Italic` has to be
resolved too.

### 3.3 The `dialogueLufs` contradiction

**Neither document is wrong; they describe two different steps of a two-step
path, and session 1's report implied one step where there are two.**

| | writes | where |
|---|---|---|
| `npm run loudness:measure` (`tools/measure-loudness/cli.ts`) | the **measurement** of every reel — `integratedLufs`, `lraLu`, `truePeakDbfs` | `.local/build/loudness.json` |
| `npm run migrate:sfx-placement` (`service/src/analysis/migrate-sfx-placement-cli.ts`) | **`plan.source.dialogueLufs` and `dialoguePeakDbfs`**, read out of that file | the Edit Plan |

**The build reads the plan, never `loudness.json`** — `build-reel-cli.ts:513`
tests `plan.source.dialogueLufs`, and `buildRequirements` refuses a build
without it.

So `handoffs/block-8.md` §9 is right that `dialogueLufs` reaches a plan only
through `migrate:sfx-placement`, and `reports/block-9-session-1.md` is right
that `loudness:measure` writes its own file. **What session 1 got wrong is its
inference**: it said the two commands "already write their file; what neither
has is a caller inside the pipeline", which reads as one hop each. Loudness is
two hops, and driving it means running the measurement *and* getting the figures
onto the plan.

## 4. Done

### 4.1 The client's identity

`modes/k2-syndicalia.json` is **version 8** and the validator prints
`mode k2-syndicalia v8: ok (fonts set)`.

- **Three faces**, recorded family-and-style as one string — the representation
  `LATIN_FONT` and `ARABIC_FONT` already use, **not a PostScript name**:
  `Inter Semi-Bold`, `Almarai Bold`, `Cormorant Garamond SemiBold Italic`.
- **`fonts.emphasis` is a third, optional face.** `buildFonts` returns it when a
  client has one and the ordinary Latin face when it does not, recording which
  in `emphasisSource`. A two-face client builds exactly as before, pinned by two
  tests.
- **`textColours`** — `{ ordinary: "light", emphasis: "accent" }`, both optional
  with a default that is what every build has drawn. Roles, never hex.
- **`EMPHASIS_SIZE_RATIO = 1.0`** in `core/src/typography.ts`, marked **CHOSEN,
  NOT MEASURED** and stated to be near-certainly wrong, with the reason and the
  measurement that would settle it. `ARABIC_SIZE_RATIO`'s comment now says it
  was measured against Inter and is **unverified against Cormorant**.
- The `note` is rewritten: what came from the brand document, and what is still
  open.
- **`vocabulary` is still `[]`** and `imageStyle` / `imageVariation` are
  untouched, as instructed.

### 4.2 A reel is built against a snapshot

- `core/src/client-snapshot.ts` — `ClientSnapshot`, `snapshotOfMode`,
  `snapshotsAgree`, `snapshotIsBehind`. It carries id, name, the client's own
  version, palette, fonts, resolved colour roles and `imageScale`. **A client's
  own pictures are deliberately absent**: they are hand-chosen paths, and a
  pinned path breaks the moment one is moved.
- `EditPlan.clientSnapshot` — **optional with a default**, validated only when
  present. All five plans reopen through `readEditPlan`.
- `service/src/build/client-identity.ts` — `resolveClientIdentity`, the one
  declaration, read by `build-reel-cli.ts` and by `steps.ts`. Order: `--mode`
  wins, then the reel's copy, then the live mode file — **and the fallback is
  reported, never assumed**.
- `analysis/job.ts` writes the copy alongside the pointer at the moment the mode
  is chosen, in both stages.
- `POST /client-snapshot` moves a reel forward. `PlanEditError` gives `withPlan`
  a general 400 path instead of a second bespoke error class.

**The migration**: `npm run migrate:client-snapshot [-- --apply]`, run for real.

```
ground truth   no client on the plan — left to fall back, and it says so
test 1         pinning to K2 Syndicalia v8
test 2         pinning to K2 Syndicalia v8
test 3         no client on the plan — left to fall back, and it says so
vitasilk       pinning to K2 Syndicalia v8

3 pinned, 0 already current, 2 left without a client
```

`ground truth` and `test 3` are left alone because their analysis never ran and
nothing on disk says which client they belong to; pinning them to a guess would
be worse than the reported fallback. It **does not read through `readEditPlan`**
and changes exactly `clientSnapshot`, asserted by comparing the file before and
after. Re-running it reports `3 already current`, so it is idempotent.

**The test that is the whole point** is
`service/src/build/client-identity.test.ts` — *"builds a pinned reel with its own
fonts and palette after the client changes"*. It **was verified to fail**: with
the snapshot branch disabled, 4 of its 7 tests go red, including that one. The
file was restored and all 7 pass.

The migrated-equals-fresh claim is asserted in
`service/src/editplan/migrate-client-snapshot.test.ts` via `snapshotsAgree`,
which ignores `capturedAt` for exactly that reason.

### 4.3 The panel

The Build preview says *"Built with K2 Syndicalia's look as it was when this
video was set up."* When the client has moved on it adds *"K2 Syndicalia has
changed since. This video keeps the older look until you say otherwise."* with
one control: **"Use the client's look as it is now"**. No version numbers on
screen — two browser tests assert the wording, that no `v8` or `clientSnapshot`
appears, and that no control is offered when there is nothing to update to.

The fonts line now names the emphasis face when it differs from the ordinary
one. The whole client block is **optional**: a service older than this sends no
`client` field and the pane renders what it always did.

### 4.4 The chore

`npm test` ran Vitest in **watch mode in all four workspaces**, not only the
panel. All four now run once, with the watching one under `test:watch`.
`scripts/check.sh` no longer appends `-- --run` — vitest rejects the flag twice,
which the check itself caught.

### 4.5 The mode file in full

```json
{
  "id": "k2-syndicalia",
  "name": "K2 Syndicalia",
  "version": 8,
  "note": "The palette is locked (PROJECT_SPEC §5). Fonts, their colour roles and the palette role names come from the client's own brand document, supplied by the user at Block 9 session 2: Noir Abyssal #1A0000 is the dominant ground, Blanc Cassé/Crème #F8F6F2 is text, Or Signature #C9A96E carries highlights and emphasis, and Rouge K2 #820000 is used sparingly in gradients and background motion. The three faces are Inter Semi-Bold for ordinary words, Cormorant Garamond SemiBold Italic for emphasized ones and Almarai Bold for Arabic; all three are installed on both machines. Still open: the emphasis size ratio, which is 1.0 because nobody has measured it (see EMPHASIS_SIZE_RATIO); the PostScript names After Effects wants, which only After Effects can give; whether the build should set colour and font at all, which today live in the template comps; and vocabulary, which is deliberately still empty because it keys the keyword cache and the brand document's terms -- Loi 18-00, CNDP, copropriété, syndic, assemblée générale, recouvrement -- are load-bearing on transcription. imageStyle and imageVariation are untouched: they change only in the billable image session, on the user's explicit go-ahead, because editing them strands images already paid for.",
  "palette": {
    "background": "#1A0000",
    "primary": "#820000",
    "accent": "#C9A96E",
    "light": "#F8F6F2"
  },
  "fonts": {
    "status": "set",
    "latin": "Inter Semi-Bold",
    "arabic": "Almarai Bold",
    "emphasis": "Cormorant Garamond SemiBold Italic",
    "note": "Family and style as one string, the representation LATIN_FONT and ARABIC_FONT already use -- not a PostScript name. After Effects reports its own fonts as Inter-SemiBold and Almarai-Bold, and nothing in this project has ever written TextDocument.font, so resolving these to what AE accepts is a measurement to take inside After Effects on the user's machine."
  },
  "textColours": {
    "ordinary": "light",
    "emphasis": "accent"
  },
  "imageStyle": {
    "stylePrompt": [
      "a single clear idea, readable at a glance",
      "one subject, centred and unobstructed",
      "dominant colour palette of {{palette.background}}, {{palette.primary}} and {{palette.accent}}",
      "lit against {{palette.background}}, with {{palette.light}} reserved for highlights"
    ],
    "negativePrompt": [
      "no extraneous objects",
      "no background clutter",
      "no incidental detail",
      "nothing in frame that is not carrying the idea",
      "no busy or competing composition"
    ]
  },
  "imageVariation": {
    "note": "The user's ruling (Block 3 session 3): the mode palette is dominant in every image, and the slots of one reel vary so the set reads as designed rather than batched. imageStyle.stylePrompt is the invariant half and applies unchanged to every slot -- that is what keeps the palette dominant. These axes are the varying half. Block 4 session 3 replaced the composition axis: when the quality gate returns `cutout` the background is discarded, so any variation expressed as where the subject sits inside the generated frame is erased, and the set would read as batched precisely where cutouts work best. The three axes here are properties of the subject itself, which survive being cut out. Placement language is gone from both halves except `centred`, which the invariant fragment keeps because it helps the cutout by holding the subject clear of the frame edge. The specific terms are placeholders like the rest of this stub and are refined with the user at Block 9; the axis names are the part that is settled. Block 4 session 5 pruned the flat/frontal/unmodelled lighting entry: a cutout needs the subject separated from its ground and flat frontal light removes that separation. Stated honestly, the prune's effect is unmeasured -- all six corpus images carried `flat frontal light, no modelling` and the pro model rendered dramatic rim light regardless, so this axis is not reliably obeyed. `soft diffuse light, shadows barely readable` was pruned at session 6 by the user's ruling: the prune targets the flat characterless look, and barely-readable shadows are that look under a gentler name. Diffuse light itself is fine -- an entry that is diffuse *and* modelled belongs here, and none is written yet. The axis is at the validator's minimum of two values; a third is the user's to write at Block 9, like the fonts.",
    "axes": {
      "cameraAngle": [
        "seen straight on at eye level",
        "seen from slightly below, looking up",
        "seen from slightly above, looking down",
        "seen at a three-quarter turn"
      ],
      "framingTightness": [
        "wide, the whole subject with air around it",
        "medium, the subject from the waist",
        "close, the subject filling most of the height",
        "macro, a single detail standing for the whole"
      ],
      "lighting": [
        "hard directional light with defined shadow",
        "rim light separating the subject from the ground"
      ]
    }
  },
  "imageCandidates": 2,
  "allowedTemplates": {
    "subtitle": [
      "sub_pop",
      "sub_pop_ar"
    ],
    "keyword": [
      "kw_slam",
      "kw_slam_ar"
    ],
    "image": [
      "img_slide_left",
      "img_float"
    ]
  },
  "vocabulary": [],
  "imageScale": 1.4
}
```

## 5. Deviations

- **All four workspaces got the `--run` fix**, not the panel alone. The trap is
  identical in `core`, `service` and `benchmarks`, and leaving three would mean
  the next session hits it in a different directory. No workspace had a watch
  convention, so `test:watch` was added to each.
- **`buildFonts` records the emphasis face's provenance in a new
  `emphasisSource` field**, not in `source`. `source` answers one question about
  the whole result — mode or global — and overloading it could not express "the
  client's own pair, but no third face", which is every mode written before
  today.
- **The snapshot carries `imageScale`.** It is not visual identity in the brand
  sense, but it is read at build time from the mode file, so leaving it out
  would have left a way for a rebuild to change silently.
- **`assertOnlyChanged` was extracted to `migrate-guard.ts`** and
  `migrate-client-mode-cli.ts` now uses it too. Two migrations had the same rule
  in two copies; the shared one is pinned by a test.
- **`textColours` is recorded and read by nothing.** Step 4.1's instruction was
  to report and stop if the build is not colour-driven, which it is not.

## 6. Failures and open problems

- **The three faces are unverified inside After Effects.** Nothing here resolves
  `Cormorant Garamond SemiBold Italic` to whatever `TextDocument.font` accepts,
  and no build has been run with any of them. The user's confirmation that all
  three are installed is taken as given; this session observed neither the
  install nor a successful set.
- **`EMPHASIS_SIZE_RATIO = 1.0` is wrong and shipped anyway**, deliberately: 1.0
  is the only value that asserts nothing, and Cormorant will read smaller than
  the words around it until it is measured. It is pinned by a test so the day it
  moves is a deliberate change.
- **`ARABIC_SIZE_RATIO` 1.07 is now unverified** for a corpus that has an
  emphasis face. It was measured against Inter.
- **Nothing draws a subtitle in the client's colours or faces yet.** The build
  sets neither; both live in the template comps. The mode now says what they
  should be, and the gap between the two is not closed.
- **No build was run**, so the snapshot has never been exercised by an actual
  After Effects pass. It is proven by unit tests, by the full corpus reopening,
  and by the failure check above — not by a comp.
- **`ground truth` and `test 3` are unpinned** and will follow the live mode file
  until their analysis runs. That is reported on screen and in the build's own
  output, not silent.
- **The panel's client block is untested on CEP**, like everything else in the
  panel. It passes the Chromium 99 denylist against the built bundle and uses no
  API the panel did not already use.
- **ARCHITECTURE §6 still says a cache key includes the mode version.** It is out
  of date in two of the three places it applies. Not corrected here: §2 above
  records the discrepancy, and amending the architecture document is a decision
  about which claim is authoritative rather than a typo fix.
- Nothing was lost or discarded. No cache entry, plan block, reference or ledger
  line changed; the three pinned plans changed in `clientSnapshot` only.

## 7. Repo state

- Branch **`main`**, seven commits ahead of `971306f`, nothing force-pushed.
- HEAD: **`390eca2 docs: record the client's identity and the snapshot`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 33 | **488** |
| `framopia-service` | 87 | **1111** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **157 passed, 2 skipped (159)** |
| `tools/cv` pytest | — | **149 passed in 7.77 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v8: ok (fonts set)
templates: 6 entries, ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 7.77s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

The panel bundle is rebuilt by its own test script before its tests run, so the
Chromium 99 denylist ran against `panel/dist` as built from this session's
source.

## 8. Suggested next step

The faces are recorded and nothing draws with them, so the next session should
be the one inside After Effects: set `TextDocument.font` on a duplicated
`sub_pop` and a duplicated `kw_slam`, find out what name form it accepts and
what it does with one it cannot resolve, and take the `sourceRectAtTime`
measurement that gives `EMPHASIS_SIZE_RATIO` a real value. All three questions
have the same answer source and the same cost — one build the user runs — and
until it is taken, the emphasis face is a string in a JSON file. That pass is
also the natural place to settle whether the build should set colour and font at
all or leave them in the template comps, which is a ruling the user makes by
looking at a card rather than at code. The three image-prompt defects in
`docs/DECISION-image-config.md` remain the other Block 9 thread, and still need
his go-ahead to spend about $1.24.
