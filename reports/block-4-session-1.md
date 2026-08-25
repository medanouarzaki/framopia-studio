Status: OK

Block 4 session 1 — preparation for image generation. No API call was made and
nothing was generated. Two things came out differently from the brief and both
are reported below rather than smoothed over: the reference defect is larger
than the 6.2 points Block 3 estimated, and the reference's version header had
already been bumped before the text conformed to it.

## Ledger

| | entries | total | sha256 of `.local/costs.jsonl` |
|---|---|---|---|
| session start | 84 | $7.556062 | `394f4960400c9a3585e7d2115ff64bed7a8afe50816419cf37e1248477c6b688` |
| session end | 84 | $7.556062 | `394f4960400c9a3585e7d2115ff64bed7a8afe50816419cf37e1248477c6b688` |

Byte-identical. The file was checked after every step that could have written
to it, including the full generation path run against the fake client.

## Done

### 1. Block 3 handoff committed alone

`handoffs/block-3.md` at `db0e027`, `docs: add block 3 handoff`, one file.

### 2. `ground-truth` reference corrected to guide v1.0.7

Five tokens on five lines of `.local/ground-truth/ground-truth.txt`, taken
from `RESULTS-block3-final.md`'s list rather than re-derived:

| line | before | after |
|---|---|---|
| 31 | `Mabin 7essa w 7essa` | `Mabin 7essa w7essa` |
| 33 | `W l'effet dialha kidom lmodat sana` | `Wl'effet dialha kidom lmodat sana` |
| 35 | `Li houa wa7d l cocktail dial lvitaminat` | `Li houa wa7d lcocktail dial lvitaminat` |
| 36 | `Wzayd 3lih l caféine` | `Wzayd 3lih lcaféine` |
| 38 | `Mabin 7essa w 7essa 15 yom` | `Mabin 7essa w7essa 15 yom` |

Nothing else moved — no spelling changed, no re-wrapping, and line 36's
trailing space is preserved. A grep for a standalone `w` or `l` now returns
nothing. **The reel goes from 81 reference words to 76**, so this correction
is not token-for-token and every WER denominator for it moved.

Re-scored with **no API call**: `npm run bench:tag` (pure, local) regenerated
the tagged JSON, `npm run bench:aggregate` regenerated `RESULTS-block1.md`
from recorded engine outputs on disk, and the production plans were scored
through `benchmarks/src/score-editplan.ts`.

- `benchmarks/RESULTS-block4-refcorrection.md` — per-engine, per-reel
  before/after plus the token list.
- `benchmarks/RESULTS-block1.md` — regenerated, notice added.
- Supersession notices added to `RESULTS-block2-noisefloor.md`,
  `-dialrule.md`, `-langtagging.md`, `-promptv2.md`,
  `RESULTS-block3-generalisation.md`, `-insertions.md`, `-final.md`.
  `RESULTS-block1-runA.md` and `-runB.md` already carry blanket notices.

### 3. Gemini image pricing verified and put in `core`

Page: **https://ai.google.dev/gemini-api/docs/pricing**, read **2026-08-25**.
Retirement dates cross-checked at
**https://ai.google.dev/gemini-api/docs/deprecations**, same date.

| model | input $/M | output $/M | 0.5K | 1K | 2K | 4K | retires |
|---|---|---|---|---|---|---|---|
| `gemini-3-pro-image` | 2.00 | 120.00 | — | **0.134** | **0.134** | 0.24 | none announced |
| `gemini-3.1-flash-image` | 0.50 | 60.00 | 0.045 | **0.067** | **0.101** | 0.151 | none announced |
| `gemini-3.1-flash-lite-image` | 0.50 | 1.50 | — | **0.0336** | — | — | none announced |
| `gemini-2.5-flash-image` | 0.50 | 30.00 | — | **0.039** | — | — | **2026-10-02** |

Every figure the brief carried is confirmed. Three corrections and additions
to it: Nano Banana 2 Lite's model id is **`gemini-3.1-flash-lite-image`** and
its 1K price is **$0.0336** (the brief said ~$0.034); `gemini-3.1-flash-image`
also has a 0.5K tier at $0.045 and a 2K tier at $0.101, neither of which the
brief listed; and the 2 October 2026 retirement of `gemini-2.5-flash-image` is
confirmed, but on the deprecations page, not the pricing page — the pricing
page carries only Imagen 4's 17 August 2026 retirement.

Batch pricing (50% off output on the 3.x models) is recorded in the note but
not used: the pipeline generates interactively for a human review step.

- `core/src/model-config.json` — `geminiImageModels` and `geminiImagePrices`,
  per-model, per-resolution-tier, with `asOf`, `source` and a note.
- `core/src/model-config.ts` — types, plus `GEMINI_IMAGE_MODEL_PRO` and
  `GEMINI_IMAGE_MODEL_FLASH` as named constants beside the text model pin.
  **No winner picked.**
- `core/src/pricing.ts` — `computeImageCost`, `imageModelPrices`,
  `estimateImageRunCost`, `ALLOWED_IMAGE_RESOLUTIONS`,
  `isAllowedImageResolution`, `UnknownImageModelError`,
  `UnsupportedImageResolutionError`.
- `core/src/pricing.test.ts` — 12 new tests, including that an unknown model
  id and an empty string both throw rather than returning zero, that the
  error names the priced models, and that a tier a model does not offer
  throws.

Nothing about image cost is hardcoded outside `core`.

### 4. The 1K–2K ruling, encoded

`ALLOWED_IMAGE_RESOLUTIONS = ['1K', '2K']` in `core/src/pricing.ts`, carrying
the reason as a comment: the largest negative zone in a 2160×3840 frame is
roughly 1700 px across and TEMPLATE_LIBRARY_GUIDE §3 has image comps at
1200×1200, so 4K is paid-for pixels that get scaled away.

Rejected in three places: `validateImageConfig` names 4K specifically rather
than lumping it in with a typo, `parseImageConfig` throws `ImageConfigError`
instead of silently downgrading, and `validateEditPlan` rejects a candidate
recording `4K`. 4K stays *priced* so a report can say what was avoided.
Default is 1K.

### 5. Image stage scaffolding — `service/src/images/`

| file | what |
|---|---|
| `config.ts` | resolution ruling, 2–4 candidates/slot (§5.4, default 3), `ceilingUsd` default $3, `validateImageConfig` reporting every issue with a dotted path |
| `client.ts` | `ImageGenerationClient` — one method, prompt in, bytes plus usage out |
| `gemini-client.ts` | the real implementation. **Never invoked this session** |
| `fingerprint.ts` | the cache key |
| `cache.ts` | `.local/cache/<video-sha256>/images-<fingerprint>/` |
| `estimate.ts` | the estimate, its printed form, and the ceiling gate |
| `generate.ts` | the generation path |
| `index.ts` | the module surface |

**Schema additions**, all optional and validated only when present, per the
standing schema fragility rule: `ImageCandidate` gains `modelId`,
`resolution`, `generatedAt`, `costUsd`, `promptFingerprint` and `metrics`
(ARCHITECTURE §5.4's alpha edge noise, hole ratio, foreground area, edge
halo, as a new `CutoutMetrics`).

**All five Edit Plans open through `readEditPlan` after the change:**

```
OK   vitasilk      schemaVersion=1 words=73 keywords=3 slots=5 candidates=0
OK   test 1        schemaVersion=1 words=67 keywords=3 slots=4 candidates=0
OK   ground truth  schemaVersion=1 words=76 keywords=0 slots=0 candidates=0
OK   test 2        schemaVersion=1 words=69 keywords=0 slots=0 candidates=0
OK   test 3        schemaVersion=1 words=58 keywords=0 slots=0 candidates=0
```

The brief asked for `vitasilk` and `test-1`; all five were checked because the
cost of the extra three was nil.

**Fingerprint** covers composed prompt, negative prompt, model id, resolution,
candidate index, mode id and mode version. Tested: identical inputs are
stable, each of the seven inputs changed alone produces a different and
mutually distinct hash, a mode version bump invalidates, and writing the
fields in reverse order produces the same hash.

**Cache**: stage-scoped eviction reusing `cacheEntryDir` and
`evictStaleEntries`, so an image write cannot evict the transcription entry.
The image is written before the manifest, so an interrupted write reads as a
miss rather than as an entry pointing at a file that does not exist; an entry
naming a missing file is a miss with a warning.

**Cost gate**: the estimate prints slots × candidates × per-image rate with
the model named, and `assertWithinCeiling` runs **before the first call**, so
an over-budget run costs nothing rather than aborting halfway.

**`appendCost` fires at the point of spend and nowhere else** — once per image
the client actually returned. Not in a wrapper, not on a cache hit, not when
the ceiling aborts. Three tests assert the ledger is byte-identical: after a
full 8-image run against the fake, after a cache-hit run with `bill: true`,
and after a ceiling abort with `bill: true`.

### 6. Mode palette without fonts — confirmed

**Functions checked: `loadMode`, `parseMode`, `validateMode`,
`renderStylePrompt`, `renderNegativePrompt`.** None calls `requireFonts`;
`requireFonts` is only ever called explicitly by a stage that needs a font.

Confirmed live against `k2-syndicalia` with `fonts.status: "tbd"`:

```
loaded id= k2-syndicalia version= 2 fonts.status= tbd
palette= {"background":"#1A0000","primary":"#820000","accent":"#C9A96E","light":"#F8F6F2"}
stylePrompt resolved: 4 fragments
negatives: 8
```

No font was invented. Prompt composition reaches the palette cleanly.

## The reference correction, measured

| engine | ground-truth before | after | move |
|---|---|---|---|
| scribe | 75.3% | 80.3% | +5.0 |
| gemini | 14.8% | 25.0% | +10.2 |
| whisper | 92.6% | 92.1% | −0.5 |
| hybrid (run C) | 16.0% | 23.7% | +7.7 |
| **production** | **22.2%** | **11.8%** | **−10.4** |

test-1, test-2 and test-3 did not move: 20.6/28.6/18.3 hybrid and
14.7/22.9/16.7 production, reproducing the recorded v1.0.7 figures exactly,
which is the control on the scoring path.

**Measured at 10.4 points, against Block 3's estimate of 6.2. That is
materially different and it is not being reconciled.** The 6.2 figure was the
production-vs-run-C *gap*, a different quantity: it netted the transcript's
penalty against the credit run C was getting for making the same
non-conformant choice the reference made. Correcting the reference moves both
sides — production improves 10.4, run C worsens 7.7 — so the gap swings 18.1
points, from +6.2 to **−11.9**.

**Production now beats run C hybrid on all four reels**, ground-truth by the
largest margin of the four. That was the one reel where the Block 1 frozen
config still looked better; it no longer does.

**The noise floor is 5.2 points, not 3.7.** Re-scored from the recorded
three-call set: 22.4 / 21.1 / 26.3 against the old 21.0 / 21.0 / 18.5. It
widened for the reason it widened last time — run 3 was the outlier and the
best of the three; it is now the outlier and the worst, and it is the run that
emitted 78 tokens instead of 81 because it was dropping conjunctions the old
reference paid it for.

## Deviations

- **The brief said six tokens; there are five.** The results file names five
  lines (31, 33, 35, 36, 38) and it was used as instructed. `CLAUDE.md`'s
  "standalone on four lines and the article on two" miscounts the same list —
  the conjunction is standalone on three lines. `CLAUDE.md` is corrected.
- **The `# reference-version:` header did not need bumping — it already read
  `v1.0.7-conformant`.** It was bumped in Block 3 session 6 while the text
  still violated the rule the version names, so the file has been asserting a
  conformance it did not have for the whole of the interval, and any tooling
  trusting that header was misled. The header was left as is because it is now
  true. `.local/` is gitignored so there is no history to date the bump from.
  **This is the more consequential of the two discrepancies**: a version
  header that can be bumped without a conformance check is a defect in the
  process, not in the file.
- **`bench:tag` re-derived the language tags and one moved.** `l cocktail` was
  tagged `fr` from the French lexicon; fused to `lcocktail` it no longer
  matches (the lexicon strips only `l'`, not a bare `l`) and now derives to
  `darija`. The reel goes from 15 fr/en words to 14. Left alone: it is the
  benchmark tagger's lexicon, a separate thing from `deriveLang` in
  `service/src/analysis/tagging.ts`, and changing a lexicon was not in scope.
  It affects the darija/fr-en subset columns, not overall WER.
- **All five plans were opened through `readEditPlan`, not the two asked for.**
- The image module's cache eviction keeps one entry **per candidate**
  (`slots × candidatesPerSlot`) rather than the transcription stage's three
  per video. Three would evict a five-slot reel's own images mid-run. Chosen,
  not measured — same footing as `MAX_ENTRIES_PER_VIDEO`.

## Failures and open problems

- **Nothing has been generated and the real client has never run.**
  `gemini-client.ts` is written against the SDK and typechecks, and that is
  the entire evidence for it. Its response parsing, its `imageConfig.imageSize`
  argument, and its handling of a refusal are all unverified against the API.
  The first live call is session 2 and it may well need changes.
- **`generate.ts` is proven only against a fake.** Every path through it —
  cache hit, cache miss, missing file, ceiling abort — is tested, but always
  with a client that returns three bytes instantly. Nothing here has met a
  timeout, a rate limit, a partial response, or a safety refusal.
- **The negative prompt is folded into the prompt text as `Avoid: …`.** The
  Gemini image models take no separate negative-prompt field the way Imagen
  does. Whether the models honour it in that form is untested and is a real
  risk to the §5.3 globals (no text, no watermark, no logo).
- **The cutout gate does not exist.** `ImageCandidate.metrics` has a type and a
  validator and nothing that fills it. `presentation` stays null.
- **No job writes candidates back onto a plan.** `generateImages` returns
  `GeneratedCandidate[]`; nothing turns those into `ImageCandidate` entries,
  sets `pipeline.images`, or records `costs.byStage.images`. That is the
  missing half of the stage.
- **The $3 ceiling and the 1K default are both guesses.** Five slots at three
  candidates is $1.005 on flash and $2.01 on pro, so $3 admits either but
  nothing larger. Whether 1K is visually sufficient at 1200×1200 is exactly
  what session 2 decides by eye.
- **The noise floor's new 5.2 figure describes prompt version 1 under an older
  guide.** Production is on version 4. Re-measuring the current prompt costs a
  sweep and was not done.
- **`cleaning.ts` still has never fired on real footage** and the Block 3
  insertions listening pass is still unjudged. Both carried forward.

## Repo state

- Branch `main`, HEAD `ad88a78` — `feat: scaffold the image generation stage`.
- Five commits this session: `db0e027`, `a8e68de`, `b7d08ce`, `a7ef398`,
  `ad88a78`.
- **`npm run check` exit code 0**, `check: PASS` present in the output.
  core **81** tests (5 files), service **414** (28 files), benchmarks **145**
  (15 files) — **640 total**, up from 588.
- `git log --oneline -15` reviewed and the last 25 commit bodies grepped for
  `claude`, `co-authored`, `generated with`, `anthropic` and `AI-assisted`:
  **no commit carries an AI attribution trailer**.
- Not pushed.

## Suggested next step

Session 2 is the model decision and it should be made on pictures, not on
prices. Take vitasilk's five slots and test-1's four, generate three
candidates each at 1K on both `gemini-3-pro-image` and `gemini-3.1-flash-image`
— 54 images, $3.62 at the pro rate plus $1.81 at flash, so raise `ceilingUsd`
deliberately for that run rather than letting the gate be edited out — and put
the two sets side by side for the user. The two questions that decide it are
whether flash holds the K2 palette as dominantly as pro does across a reel,
since that is the whole point of sending every slot the full `stylePrompt`,
and whether 1K survives the cutout at 1200×1200 or forces 2K. Before spending
anything, run one single image through `GeminiImageClient` and check that the
response actually parses and that the `Avoid:` phrasing suppresses text and
logos — that one call is worth $0.067 to avoid discovering a parsing bug 54
images in. Everything downstream of the bytes is still missing, so plan for
the job that writes candidates onto a plan to land in the same session.
