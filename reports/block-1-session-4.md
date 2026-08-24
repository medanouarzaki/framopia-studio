# Block 1, Session 4

Status: OK

## Done

### Step 0 — repo move

Nothing needed repairing. `benchmarks/src/paths.ts` derives every path from
its own module location, so the code was already location-independent, and
the whisper venv turned out to have been built at the T7 path in session 3
rather than under `~/dev` — `mlx_whisper --help` and a 10s transcription of
`test-1.wav` both ran without touching it. Grepping code, docs and
`CLAUDE.md` for `/Users/*/dev/framopia-studio` found exactly one hit, a
historical sentence in `reports/block-1-session-1.md`, which is out of scope
and was left alone. `CLAUDE.md` now states the T7 path at the top.

### Step 1 — orthography v1.0.1

None of the four transcripts contained a `# freeze:` line, so the freeze
list was mined entirely from usage: every Latin-script Darija word occurring
at least twice and not already in §4. **23 words added:**

`dial` · `diali` · `dialk` · `li` · `houa` · `joj` · `wa7d` · `7essa` ·
`7essass` · `mabin` · `tal` · `mn` · `3la` · `fa` · `lyoma` · `yom` ·
`nhdr` · `lik` · `likom` · `lkher` · `tb3i` · `kat7taji` · `kidom`

Plus four inflections folded into existing entries: `bghiti`, `3ndk`,
`3ndhom`, `m3aya`.

**One existing entry was overridden.** §4 froze `dyal`/`dyali`; the ground
truth writes `dial` eleven times and `dyal` never. §4's own rule is that the
user's habit wins, so v1.0.1 replaced them with `dial`/`diali`. Flagging it
explicitly because it changes a spelling that was already frozen — say the
word if you want `dyal` back.

The transcripts also disagreed with themselves in five places, resolved by
majority and recorded in §4 as deliberately-not-frozen variants: `dl`/`dla`
(reduced `dial`), **`main` (a typo for `mabin` — and it collides with the
French `les mains`, which really does appear in test-2)**, `ta` (reduced
`tal`), `yawm` (→ `yom`), `7sessa` (→ `7essa`). Apostrophes are now
specified straight, since the transcripts mixed `l'effet` and `l’acide`.

§6 gained the new rule: aesthetic and medical procedure/treatment terms in
Arabic script even mid-Darija, with branded and French technical terms
explicitly excluded. `benchmarks/src/freeze-list.json` matches the guide
word for word; the <4-character exclusion note in `orthography.ts` is
untouched.

### Step 2 — prompts and the mixed-script guard

Both Gemini prompts now share one `SCRIPT_RULES` block
(`benchmarks/src/engines/script-rules.ts`) so they cannot drift: Darija to
Latin Arabizi with 3/7/9 and attached article, French/English with accents
and straight apostrophes, Arabic script for procedure terms and formal MSA
only, no token mixing two scripts, strict JSON.

`splitScriptBoundaries` in `normalize.ts` splits joined tokens at script
boundaries. Importantly, **`computeWer` was not going through
`normalizeWords`**, so the guard would have been dead code on the path that
matters; `wer.ts` now splits both sides, and `computeSubsetWer` splits its
reference too so the lang-index mapping cannot desynchronize.

### Step 3 — ground truth conversion

All four transcripts converted to tagged JSON in `.local/ground-truth/`
(not committed). Word counts: ground-truth 81, test-1 67, test-2 69,
test-3 59. Every word tagged fr/en, for eyeballing:

- **ground-truth (16):** les, cernes, pigmentées, la, vidéo, Alors, les,
  polynucléotides, l'ADN, du, saumon, l'effet, la, mésothérapie, cocktail,
  caféine
- **test-1 (5):** vidéo, des, injections, kids[en], cabin[en]
- **test-2 (11):** les, le, profhilo, faiblement, réticulé, le, cou, le,
  décolleté, les, mains
- **test-3 (16):** la, mésothérapie, le, RRS, eyes[en], mésothérapie,
  l’acide, hyaluronique, non, réticulé, les, petites, ridules, les, cernes,
  pigmentées

The first pass mistagged `Main`/`main` as French (hand) in the ground-truth
and test-1 reels; it is the user's spelling of Darija `mabin`. Only the
plural `mains` stays in the French lexicon, which is correct for test-2's
`les mains`. Two judgement calls worth your eye: `RRS eyes` is a brand name
split across fr/en, and test-1's `kids cabin` is tagged English but reads
like a mishearing in the source transcript.

### Step 4 — the benchmark

All four engines against all four reels, 88.8s of audio, 16 engine runs.
Full tables in the committed `benchmarks/RESULTS-block1.md`. Aggregate:

| engine | overall WER | darija WER | fr/en WER | orthography | ts dev (med/p90) | null ts | cost | wall |
|---|---|---|---|---|---|---|---|---|
| scribe | 68.8% | 98.3% | **10.4%** | 100.0% (223 ar unscored) | — | 0 | $0.0054 | 11.2s |
| gemini | 40.6% | 36.6% | 14.6% | 97.3% (35 ar unscored) | 721ms / 2895ms | 0 | $0.5719 | 567.9s |
| whisper | 84.1% | 95.9% | 95.8% | 100.0% (223 ar unscored) | 155ms / 1460ms | 0 | $0.0000 | 50.2s |
| **hybrid** | **36.2%** | **35.5%** | **10.4%** | 97.2% (37 ar unscored) | 0ms / 1794ms | 0 | $0.5334 | 654.1s |

Spotcheck HTML for scribe, gemini, hybrid and whisper on the ground-truth
reel is in that reel's results directory (gitignored). Gemini was added to
the spotcheck set this session — its timestamps are self-reported by the
model, which is precisely why they need eyeballing.

## Deviations (what and why)

- **Cost overran the brief's expectation: $1.1452, not "well under $0.50".**
  The cause is a real bug I found and fixed rather than a pricing surprise.
  Gemini 3.1 Pro bills **thinking tokens** at the output rate and reports
  them in `thoughtsTokenCount`, separately from `candidatesTokenCount`.
  `computeGeminiCost` only counted the latter. On the first real reel
  thinking was 10,295 tokens against 2,084 of visible output — **five times
  the billable output the harness was recording**. Every Gemini figure in
  session 2's design was therefore ~5x low. The estimator carries the same
  multiplier now, so the pre-call gate quotes ~$0.09/reel instead of
  ~$0.015. I went ahead with the sweep at the corrected price because the
  absolute number is still small and the sweep is the session's whole
  deliverable, but you should know the per-call economics are 5x what
  session 2 assumed. One ledger line understates: the single Gemini call at
  19:50:06 was written before the fix.
- **`gemini-2.5-pro` was retired mid-Block-1.** The API now returns
  404 "no longer available to new users" and points at
  `gemini-3.1-pro-preview`, which is what `bench-config.json` now pins,
  with prices ($2/M input, $12/M output) taken from ai.google.dev. That page
  lists no separate audio input rate for this model, so audio and text input
  price identically — session 2's placeholder assumption was structurally
  right, just at the wrong absolute rate. This does mean the Pro tier is now
  a preview model, which session 2 had deliberately avoided; there is no GA
  Pro alternative left.
- **Gemini returned 503 "high demand" twice.** The SDK does not retry and
  the harness's retry helper only wrapped `fetch`, not the SDK path. Added
  `generateWithOneRetry`: one retry after 20s, and only for overload — a 4xx
  still surfaces immediately. No malformed JSON was ever returned, so the
  stricter-reminder retry path the brief anticipated was not needed.
- **No Gemini audio-price verification from `usageMetadata` was possible.**
  `usageMetadata` reports token counts, not prices; it confirmed the
  AUDIO/TEXT modality split (582 audio, 2,748 text on a 23s reel) but the
  rate itself had to come from the pricing page.
- **`--engines` sweeps write one results directory per invocation**, so the
  aggregate builder pairs each reel with its newest run by reading the audio
  filename back out of that run's `report.md`. It rescores from the stored
  normalized JSON, which meant the `computeWer` splitting fix could be
  applied to the completed sweep without paying for it again.

## Failures & open problems

- **Two scoring artifacts inflate the Darija WER of both Gemini rows, and
  neither is a transcription error.** Both are gaps in the guide, not model
  failures, and both are worth closing before the freeze decision hardens:
  - *Numerals.* The ground truth writes `4`, `15`, `18`; Gemini spells them
    out (`rb3a`, `khmstachr`, `tmntach`). **The orthography guide has no
    numeral rule at all**, so neither form is currently wrong. This is the
    single cheapest WER win available.
  - *Arabic-script scope.* The v1.0.1 §6 rule covers procedure and treatment
    terms, which is what the brief specified. The ground truth also puts
    **anatomical regions and substance names** in Arabic script
    (`المنطقة حول العينين`, `ومادة الكافيين`) where Gemini transliterated
    them (`lmnti9a 7awl l3inin`, `wmaddat lcaféine`). The rule as written
    does not reach them.

  On test-3 these two account for 7 of 59 reference words. I did not widen
  the frozen guide beyond what the brief authorised — both belong in a
  v1.0.2 alongside your freeze decision.
- **Whisper is not a usable baseline for this material and its 84.1% WER
  should not be read as an accuracy number.** It translates Darija into MSA
  (`عندك` → `هل لديك`) and mangles French (`les cernes` → `لسرن`), which is
  why its fr/en WER is 95.8%. Keep it as a free liveness check.
- **Hybrid lost to plain Gemini on test-1** (50.7% vs 46.3%) while winning
  the other three, decisively on test-3 (22.0% vs 37.3%). One reel out of
  four is not enough to explain the inversion; worth a look at that reel's
  spotcheck before treating hybrid's aggregate win as settled.
- **88.8 seconds of audio is a thin basis for a WER comparison.** The gaps
  between hybrid, gemini and the rest are large enough to survive it; the
  gap between hybrid and gemini (4.4 points) is not obviously outside the
  noise of four short reels.

## Repo state

- Branch `main`, clean tree, pushed. Commits this session, oldest first:
  - `docs: extend freeze list and add medical-term rule as v1.0.1`
  - `feat(benchmarks): sync freeze list with orthography guide v1.0.1`
  - `feat(benchmarks): teach gemini prompts the per-word script rules`
  - `fix(benchmarks): split mixed-script tokens before scoring`
  - `fix(benchmarks): repoint gemini to 3.1 pro and bill thinking tokens`
  - `feat(benchmarks): spotcheck gemini timestamps too`
  - `fix(benchmarks): apply script-boundary split on the wer path`
  - `feat(benchmarks): add cross-reel aggregate report builder`
  - `feat(benchmarks): record block 1 benchmark results`
  - `chore: add bench:tag and bench:aggregate scripts`
  - `docs: update operating memory for the block 1 benchmark`
- `npm run check`: green — `service/` 14 tests, `benchmarks/` 104 tests
  (up from 95), typecheck and lint clean on both.
- `git log` checked for AI attribution across this session's commits — none.
- **Total session spend: $1.1452** (scribe $0.0083, gemini $0.6035, hybrid
  $0.5334), against a corrected ledger.

## Suggested next step

**Recommendation, not a decision.** Hybrid is the strongest configuration in
these numbers: best overall WER (36.2%), best Darija WER (35.5%), and it
ties Scribe's best-in-class 10.4% on French and English while Gemini alone
gives up four points there — Scribe's acoustic front end is clearly better
at the code-switch boundaries, and hybrid keeps it. It also inherits
Scribe's word timings, which is the one thing neither Gemini nor Whisper can
offer honestly, and it is marginally cheaper than Gemini alone because the
correction prompt thinks less than a from-scratch transcription. The costs
against it are latency (654s of wall time for 89s of audio, roughly 7x
realtime) and its loss on test-1, which is unexplained. Before freezing, I
would close the numeral and Arabic-script-scope gaps in the guide and
re-run `npm run bench:aggregate` — it rescores from disk for free, and both
gaps push the same direction, so the real Darija WER for hybrid is
meaningfully better than 35.5%.
