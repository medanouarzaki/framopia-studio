# Alignment mis-pairs Arabic-script draft tokens against Arabizi corrected text

**Status: fixed for the cross-script tie, open for splits and merges.**
The transliteration-aware substitution cost was adopted on 2026-08-28 (§A.0).
What remains is one-to-many and many-to-one correspondence, measured in §A.5.

**Previously:** Found Block 7 session 7, diagnosed session 9, written up
session 10, re-derived against a single declared configuration in Block 8
session 2. **`service/src/transcription/align.ts` and `core/src/align.ts` are
unchanged**; a fix was written, measured as a regression and discarded.

This is Block 2 territory — transcription and alignment — not comp building.
It is recorded here because Block 7 is where it became visible.

**Read §A before §B.** The figures this document carried until Block 8 session
2 were not all derived from the same cache entry, and are kept verbatim in §B
with the entry each is now known to have come from. §A is the current evidence.

## A. Current evidence

Every figure in this section was derived at git sha **`ff9d06c`**, with the
aligner unmodified since **`fca6e58`** (`service/src/transcription/align.ts`)
and **`2419746`** (`core/src/align.ts`). All five reels were read from the
entry at the **pinned prompt version 4**, selected by
`selectTranscriptionEntry` in `core/src/cache-select.ts` rather than by
directory order. Free: no model call, no re-transcription.

Every reel's pinned entry is `transcription-758a3924d090d1b5`; the fingerprint
covers the prompt version, the Gemini model pin, the guide version, the Scribe
model and the keyterms, none of which differ per reel.

### A.0 The fix, adopted 2026-08-28

**The transliteration-aware substitution cost is the default**
(`ACTIVE_ALIGN_COST_MODEL` in `service/src/transcription/align.ts`). The flat
model stays selectable as `legacy`, which is what every figure recorded before
this date was measured with.

Under the flat model every cross-script pair costs exactly 1, so the comparison
carries no information: a run of them ties and the backtrace's preference order
decides which draft token each word gets. Scoring the pair against
ORTHOGRAPHY_GUIDE §2's character table gives it a minimum — `mn`/`من` costs 0.2
where `mn`/`غير` costs 1.

**The evidence, all of it human.** Two hand-made references, neither generated
by code:

| | |
|---|---|
| `benchmarks/references/align/vitasilk.json` | 73 rows, all judged. 54 correct, 18 wrong, 1 two-tokens. **74.0% human-confirmed.** Schema 1. |
| `benchmarks/references/align/vitasilk.rereview.json` | the 17 rows the change moved, judged **2026-08-28**. **7 correct, 2 misheard, 7 wrong, 1 unjudged.** Schema 3, `rowCount` 17, `markedCount` 16. |

The change moved **16 of the 18** pairings marked wrong and **not one** of the
54 marked correct. The second pass returned **nine repaired** (7 correct + 2
misheard) and **none damaged**. Reel `vitasilk`, entry
`transcription-758a3924d090d1b5`, prompt version 4, at sha `6708431`.

**The corpus safety check**, all five reels, from the cached Scribe responses
and corrected texts with no model call. The guard is Block 7's discarded fix,
which looked reasonable and took anchored words from 330 to 230:

| reel | words | anchored legacy → adopted | interpolated | anchors moved | zero-duration | duplicate intervals |
|---|---:|---|---:|---:|---|---:|
| ground-truth | 76 | 72 → **72** | 4 → 4 | 15 | 4 → 4 | 0 → 0 |
| test-1 | 67 | 64 → **64** | 3 → 3 | 17 | 3 → 3 | 0 → 0 |
| test-2 | 69 | 68 → **68** | 1 → 1 | 14 | 1 → 1 | 0 → 0 |
| test-3 | 58 | 56 → **56** | 2 → 2 | 4 | 2 → 2 | 0 → 0 |
| vitasilk | 73 | 70 → **70** | 3 → 3 | 17 | 3 → 3 | 0 → 0 |
| **corpus** | **343** | **330 → 330** | 13 → 13 | **67** | 13 → 13 | **0 → 0** |

**No reel loses an anchored word**, and the corpus total reproduces Block 7's
recorded 330 independently. Entry `transcription-758a3924d090d1b5` on every
reel, prompt version 4, sha `6708431`.

### A.0.1 One regression, which the adoption figures did not count

**`vitasilk` `w0036` (`26`) lost its anchor.** Under the legacy model it held
`وعشرين`; under the adopted model it holds nothing and is interpolated.

Part 1 reported "zero regressions" and that was true of what the scorer
measures: a regression there is a row the user had marked **correct** or
**misheard** that then moved, and `26` was marked **two-tokens**, which the
scorer buckets as *still inexpressible*. **The row still got worse**, and the
report should have said so. In the second pass the user left it **unjudged** —
the honest answer for a row whose correct pairing the aligner cannot express.

It is the **only merge regression**. Nine rows lost an anchor when the model
changed and nine gained one, a net wash consistent with 330 → 330:

- **lost**: ground-truth `tal`, `dial`, `wa7d`, `dial`; test-1 `dial`, `la`;
  vitasilk `eyyh`, **`26`**, `f`
- **gained**: ground-truth `pigmentés`, `3ndi`, `li`, `houa`; test-1 `tb3i`,
  `m3aya`; vitasilk `5`, `mn`, `chno`

Of the three losses on `vitasilk` — the only reel with a reference — the user
judged `eyyh` and `f` **wrong** in their new state, so neither is a regression
against human judgement; only `26` is. The six on `ground-truth` and `test-1`
are unjudged, because no reference exists for those reels.

### A.0.2 The corpus guard cannot fail for this class of change

Session 12's safety check before the adoption was **"anchored words must not
drop on any reel"**, on the precedent of Block 7's discarded fix, which took the
corpus from 330 to 230. It passed with every reel identical. **It is worth much
less than it reads.**

An anchored word is one the aligner gives a `sourceText`, so the count is the
number of match and substitute operations. Insertion and deletion cost 1 each,
so pairing two tokens instead of leaving both unpaired replaces a cost of 2 with
the substitution cost. **While every substitution costs less than 2, the DP will
always prefer to pair**, and the number of pairings is fixed by the token counts
and monotonicity rather than by which pair costs what. A substitution cost can
move *which* token a word anchors to; it can barely move *how many* anchor at
all.

Measured over the cached corpus, entry `transcription-758a3924d090d1b5`, prompt
version 4, with two deliberately terrible cost models — one returning a stable
pseudo-random cost in [0, 1] that ignores the tokens entirely, one inverting the
adopted model so that a pair the §2 table calls a good match becomes expensive:

| model | anchored, corpus | rows moved vs legacy, corpus |
|---|---:|---:|
| legacy (flat) | 330 | — |
| adopted (transliteration) | **330** | 66 of 343 |
| random | 329 | 112 of 343 |
| inverted | **332** | **332 of 343** |
| substitution cost 3 (out of class) | 115 | — |

**The inverted model reshuffles 332 of 343 pairings — 97% of the corpus — and
passes the guard with a better score than the adopted model.** The random model
moves a third of the corpus and costs one anchored word. Only the fourth row,
where a substitution costs more than an insert plus a delete, moves the count at
all — and that is what Block 7's discarded fix effectively did by forbidding
cross-script pairing outright, which is why the guard caught *that* one.

**So the guard detects a change that makes pairing structurally impossible, and
nothing else.** It cannot see a reshuffle, which is the failure mode a
substitution-cost change actually risks.

**What does detect it is the hand-made reference**, and by a wide margin. Scored
against `benchmarks/references/align/vitasilk.json`, over the rows the user
marked `correct` or `misheard`:

| model | regressions | confirmed rows held |
|---|---:|---:|
| adopted | **0** | 54 |
| random | 6 | 48 |
| inverted | **54** | **0** |

The inverted model destroys every single pairing a human confirmed, and the
reference says so immediately. **The adoption is safe because of the reference,
not because of the corpus guard.** For the four reels with no reference the
honest statement is that nothing has verified their 50 moved rows; the corpus
count bounds the structural damage and says nothing about correctness.

The adversarial cost models are a measurement fixture and are **not** in the
shipped cost-model table.

### A.0.3 The migration — the fix reaches the artifacts, 2026-08-28

The adoption in §A.0 changed the code. The five plans on disk still carried
timings from the flat model until Block 8 session 14 ran
`npm run migrate:alignment -- --apply`, which re-aligns each reel from its
pinned cache entry. **$0.00 and no API call**: alignment is pure, and the raw
Scribe response and the corrected texts are both in the entry.

| reel | words | retimed | `sourceText` changed | cards moved |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 15 | 15 | 19 |
| test-1 | 67 | 17 | 16 | 20 |
| test-2 | 69 | 14 | 14 | 15 |
| test-3 | 58 | 4 | 4 | 5 |
| vitasilk | 73 | 17 | 17 | 19 |
| **corpus** | **343** | **67** | **66** | **78** |

**67 is the same 67** §A.0.2 measured as rows moved against the legacy model,
derived independently here from the plans rather than from the aligner, which
is what makes it a check rather than a restatement.

Word **texts, ids, order, `lang`, `script`, `removed` and `edited` are
untouched**, and the migration refuses to write if `hashTranscript` moves —
nothing text-derived may change, so keyword selection and image prompts cannot.
Everything derived from a timing is recomputed in the same pass: card spans,
display timing, keyword and image-slot spans, SFX event times, and
`transcript.contentHash`, so `mergeIntoExistingPlan` never sees a changed hash
and never clears `keywords`, `images` or `sfx`.

**Clipped holds fell 28 to 23** across the corpus (ground-truth 9→8, test-1
7→5, test-2 4→3, test-3 3→2, vitasilk 5→5), because pairings that now sit on
their own token give cards that fit their template floor.

#### `vitasilk` 8.8–11.9 s, before and after

The span the user reported twice in Block 7. Timings in seconds; `sourceText`
is the draft token each word anchored to.

| word | text | before | after |
|---|---|---|---|
| w0027 | `Silk` | `Silk` 8.619–8.860 | `Silk` 8.619–8.860 |
| w0028 | `mn` | **`mn` 8.899–8.899 (interpolated)** | **`من` 8.939–9.000** |
| w0029 | `ghir` | `من` 8.939–9.000 | **`غير` 9.079–9.199** |
| w0030 | `anno` | `غير` 9.079–9.199 | **`أنه` 9.279–9.759** |
| w0031 | `il` | `أنه` 9.279–9.759 | `ينغى,` 9.779–9.800 |
| w0032 | `nourrit` | `ينغى,` 9.779–9.800 | `يهدئ.` 9.819–11.079 |
| w0033 | `il` | `يهدئ.` 9.819–11.079 | `فيه` 11.159–11.279 |
| w0034 | `hydrate` | `فيه` 11.159–11.279 | `ستة` 11.479–11.579 |
| w0035 | `fih` | `ستة` 11.479–11.579 | `وعشرين` 11.619–12.039 |
| w0036 | `26` | `وعشرين` 11.619–12.039 | **none, interpolated 12.059** |

**The head of the run is repaired.** `mn`, `ghir` and `anno` each now hold the
Arabic token they actually translate, and `mn` gained a real anchor where it had
been a zero-duration interpolated point.

**The tail is displaced, not repaired, and this is the split-and-merge limit in
§A.5 rather than a new defect.** `il nourrit` and `il hydrate` are two words
each against one draft token, and `26` is one word against two — shapes no
substitution cost can express. The one-token shift is pushed down the run to
`w0036`, which loses its anchor entirely, the regression already recorded in
§A.0.1. **Six corrected words against five draft tokens still needs an operation
the aligner does not have.**

### A.5 Splits and merges, measured against the adopted model

Runs between two exact anchors where the two sides differ in length. Read-only,
from the cached responses; entry `transcription-758a3924d090d1b5`, prompt
version 4, sha `6708431`.

| reel | split runs (corrected > draft) | merge runs (draft > corrected) |
|---|---:|---:|
| ground-truth | 3 | 1 |
| test-1 | 1 | 2 |
| test-2 | 1 | 1 |
| test-3 | 2 | 1 |
| vitasilk | 3 | 1 |
| **corpus** | **10** | **6** |

Part 1 sized many-to-one at "one merge in the corpus" and recorded that as a
floor. Against the fixed aligner it is **6 merge runs and 10 split runs** — the
floor was low by roughly an order of magnitude, and **splits outnumber merges**,
which part 1 never measured at all.

**`vitasilk` `w0031`–`w0036` needs both directions inside one span, and the
span is a French clause.** The run is
`mn ghir anno il nourrit il hydrate fih 26 vitamines` against
`من غير أنه ينغى, يهدئ. فيه ستة وعشرين vitamin`. The user identified the true
correspondence: the span is spoken in French and Scribe transcribes it to
Arabic script, collapsing each French pair into one token.

The evidence that it is French is inside the draft itself: Scribe wrote
**`vitamin` in Latin script** in the middle of that run, having heard enough
French to switch scripts for one word while rendering `il nourrit` and
`il hydrate` as `ينغى` and `يهدئ`. **Splits therefore concentrate where the
speaker switches language mid-clause**, which is the mechanism, whatever the
aggregate below does or does not detect.

```
il + nourrit  <- ينغى           one token, two words   (split)
il + hydrate  <- يهدئ           one token, two words   (split)
fih           <- فيه            one to one
26            <- ستة + وعشرين   two tokens, one word   (merge)
```

Six corrected words against five draft tokens, requiring a split **and** a merge
in the same span. No substitution cost can express either.

**No correlation between splits and code-switching was detected — by a measure
too coarse to detect one.** French is **16.9%** of the words inside split runs
(12 of 71) against **21.3%** of the corpus (73 of 343). That is not evidence of
no association, because the measure counts **every word inside a run that
happens to be uneven**, not the extra word itself, and the extra word cannot be
identified without the true correspondence — the thing being measured. A single
French collapse sitting inside an otherwise Darija run contributes one French
word and several Darija ones, so the mechanism dilutes its own signal.

Two of the ten split runs are counter-examples, and neither is morphology:

- **`الفيديو` → `la vidéo`** (test-1) is a code-switch, not a proclitic. The
  French noun and its French article were spoken in French and written by
  Scribe wholly in Arabic script — **the same mechanism as `il nourrit`**. It
  was listed under morphology in the first writing of this section, which was
  wrong: `ال` here is not the Darija definite article being separated, it is
  Scribe's rendering of French `la`.
- **`pigmentées` → `pigmentés`** (ground-truth, test-3) is a French word
  sitting inside a split run. Checked against the drafts, it is **not** an
  instance of the collapse mechanism: Scribe wrote `pigmentées?` and
  `pigmentées،` in **Latin** script and the pair is one-to-one. The split in
  each of those runs is elsewhere — `للخر` → `tal lkher` and `فهو` →
  `fa houa`. It is evidence that French appears in split runs, not evidence of
  why they split.

The remaining listed examples survive the same test as genuine Darija proclitic
morphology: `فهو` → `fa houa`, `فهذه` → `fa hadi`, `دالحلول` → `dial l7loul`,
where the correction pass separates a fused Arabic token into two Arabizi words
under §2's attachment rules.

**What would settle it** is a per-run judgement of where the extra word came
from, which is a human pass of the kind the reference files already are — not a
larger aggregate over the same coarse counts.

### A.1 Scale, per reel

| reel | entry | prompt | corrected words | draft word tokens | paired across scripts | share | cross-script runs |
|---|---|---:|---:|---:|---:|---:|---:|
| ground-truth | `transcription-758a3924d090d1b5` | v4 | 76 | 73 | 51 | 67% | 10 |
| test-1 | `transcription-758a3924d090d1b5` | v4 | 67 | 66 | 43 | 64% | 11 |
| test-2 | `transcription-758a3924d090d1b5` | v4 | 69 | 72 | 46 | 67% | 8 |
| test-3 | `transcription-758a3924d090d1b5` | v4 | 58 | 57 | 29 | 50% | 10 |
| vitasilk | `transcription-758a3924d090d1b5` | v4 | 73 | 71 | 39 | 53% | 10 |
| **corpus** | | v4 | **343** | **339** | **208** | **61%** | **49** |

"Paired across scripts" counts corrected words the aligner anchored to a draft
token in the other script. Those are the pairings plain Levenshtein had **no
evidence for**: `normalizeToken('mn')` and `normalizeToken('من')` are never
equal, so across such a run every candidate pairing costs exactly the same and
the path returned among the ties is an artifact of the DP's tie-break order.

**61% of every word in the corpus rests on a pairing the aligner had no
evidence for.** Most land correctly, because a run whose token counts agree
pairs positionally by accident of the DP rather than by design. The 49 runs are
where a count mismatch throws the whole run out.

### A.2 The `vitasilk` shift

Under the pinned entry the reel's whole alignment carries **three insertions
and one deletion**:

| op | index | token |
|---|---|---|
| insert | corrected 0 | `5` |
| **insert** | **corrected 28** | **`mn`** |
| insert | corrected 50 | `chno` |
| delete | draft 67 | `ما` (23.799–23.879) |

**There is no deletion of `من`.** The displacement in the reported 8.8–11.9 s
stretch comes from the **insertion of `mn` at corrected index 28**: `mn` is
given no draft token at all and is interpolated, and every corrected word after
it takes the interval of the draft token **before** its own.

```
op          draft  corrected  draft token   corrected word   interval
match         26      27      Silk          Silk             8.619-8.860
insert         —      28      —             mn               (interpolated)
substitute    27      29      من            ghir             8.939-9.000
substitute    28      30      غير           anno             9.079-9.199
substitute    29      31      أنه           il               9.279-9.759
substitute    30      32      ينغى,         nourrit          9.779-9.800
substitute    31      33      يهدئ.         il               9.819-11.079
substitute    32      34      فيه           hydrate          11.159-11.279
```

`ghir` — which *is* `غير` at draft 28 — takes `من`'s interval at draft 27.
The shift is one token and it persists to the end of the run.

### A.3 The `il` offset

`il` appears twice in the corrected text and both are displaced:

| corrected index | anchored to | its own token opens at | displacement |
|---:|---|---:|---:|
| 31 | draft 29 `أنه` 9.279–9.759 | 9.779 (`ينغى,`) | **0.500 s** |
| 33 | draft 31 `يهدئ.` 9.819–11.079 | 11.159 (`فيه`) | **1.340 s** |

The first is the one the user reported. The second is larger and was never
named before.

### A.4 Why the existing correspondence check cannot see any of this

`align.test.ts` asserts that a word's interval is the interval of the draft
token it *records* anchoring to, across a clean sequence, an insertion and a
deletion. **It passes on the current aligner, and it passed while the alignment
was wrong.**

That is not a weak test; it is a test of the wrong thing. The aligner never
gives a word an interval belonging to a token other than the one it *records*.
It records the wrong pairing, and the record is self-consistent with it.

**No checker reading the aligner's own output can detect this.** Detecting it
requires an independent statement of which draft token each corrected word
*should* correspond to — a hand-written correspondence for a fixture reel, or
the transliteration knowledge that would fix the aligner in the first place.
Block 7 session 6's weaker check ("does this interval exist somewhere in the
Scribe response") passed 21 of 21 on a span that was wrong, for the same
reason: an interval can be real and belong to a different word.

`npm run align:review -- --reel <label>` produces the sheet that collects the
human correspondence; `benchmarks/references/align/README.md` states what a
reference file is. **No reference has been recorded yet**, so as of this
writing there is still no non-circular measure of aligner correctness.

## B. Superseded figures

These are the figures this document carried from Block 7 session 10 until Block
8 session 2, **verbatim and unadjusted**. They are not wrong arithmetic; they
were derived from **three different transcription cache entries** and presented
as one measurement. Each is annotated with the entry it is now known to have
come from.

`vitasilk` holds three entries — prompt versions 1, 3 and 4 — and the other
four reels hold two each (3 and 4). Reproducing any figure below requires
`--entry <id>`.

### B.1 The scale table

| reel | words | at risk | share | cross-script runs |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 51 | 67% | 10 |
| test-1 | 67 | 43 | 64% | 11 |
| test-2 | 69 | 46 | 67% | 8 |
| test-3 | 58 | 29 | 50% | 10 |
| vitasilk | 73 | 40 | 55% | 10 |
| **all** | **343** | **209** | **61%** | **49** |

- The four non-`vitasilk` rows reproduce exactly from the **pinned prompt v4**
  entry and are unchanged in §A.1.
- The `vitasilk` row (73 words, **40** at risk, 10 runs) reproduces exactly and
  only from **`transcription-0cb5401192dbfbc7`, prompt version 1**. The v3
  entry gives 74 words / 40 / 10; the pinned v4 entry gives 73 / **39** / 10.
- The corpus total of **209** therefore mixes four v4 reels with one v1 reel.
  Against the pinned entry throughout it is **208**.

### B.2 The quoted trace

```
op          ref  hyp  draft        corrected    interval
match       26   27   Silk         Silk         8.619-8.860
delete      27        من                        8.939-9.000
substitute  28   28   غير          mn           9.079-9.199
substitute  29   29   أنه          ghir         9.279-9.759
substitute  30   30   ينغّي،       annaho       9.819-10.519
substitute  31   31   ييدرات.      inourri      10.559-11.059
```

Stated with it: "The aligner **deletes draft token 27 (`من`)** and shifts every
substitution after it by one" and "**The draft holds 72 word tokens against 73
corrected**."

- This is the **prompt version 1** entry throughout, reproduced from it token
  for token. Its draft reads `ينغّي،` and `ييدرات.` where the pinned v4 entry
  reads `ينغى,` and `يهدئ.`, and its corrected text carries `annaho` /
  `inourri` where v4 carries `anno` / `il` / `nourrit` / `il` / `hydrate`.
- 72 draft word tokens against 73 corrected is the **v1** entry's shape. The
  pinned v4 entry holds **71 against 73**.
- **Under the pinned entry there is no deletion of `من` at all** — see §A.2.
  The reel's only deletion is `ما` at draft 67, and the displacement is caused
  by an insertion. **The symptom survives; the quoted mechanism does not.**

### B.3 The `il` offset

Stated as **0.540 s**.

- Reproduces only from **`transcription-92adf5b1bf24601a`, prompt version 3**.
  Prompt v1's corrected text contains no `il` token at all. Under the pinned v4
  entry the same word is displaced **0.500 s** — see §A.3.

### B.4 The discarded fix, and its measurements

**The fix:** require an anchor to be an exact match, or a substitution between
tokens of the *same* script — on the reasoning that a cross-script substitution
is not evidence of correspondence, so a run containing one should be
interpolated rather than trusted.

**Measured on the reported interval before applying:**

| word | old interval | new interval | new anchor |
|---|---|---|---|
| mn | 8.899–8.899 | 9.262–9.262 | interpolated |
| ghir | 8.939–9.000 | 9.665–9.665 | interpolated |
| il | 9.279–9.759 | 10.470–10.470 | interpolated |
| fih | 11.479–11.579 | 12.079–12.739 | **`vitamin`** |
| 26 | 11.619–12.039 | 12.799–12.859 | **`et`** |
| vitamines | 12.079–12.739 | 12.920–13.179 | **`aussi`** |

Removing cross-script anchors removed nearly every anchor, and the surviving
Latin tokens then paired across long distances: **a three-token shift against
the original one-token one**, seven words collapsed to zero-duration points, and
**two duplicate intervals** where there had been none. Across the corpus it
moved 144 timings and dropped anchored words from 330 to 230.

**It is worse, and it was discarded.** The lesson is that the cross-script
substitutions are carrying most of the alignment correctly — they are wrong only
where the token counts differ. Removing them removes the good with the bad.

**Which entry these were measured against is not recorded anywhere and cannot
be recovered from the numbers**, since the experiment was never committed. The
`8.899–8.899` interval for `mn` matches no entry's draft token, being an
interpolated value. **Treat this table as a qualitative record of a discarded
experiment, not as a measurement to compare a future fix against.** Re-run the
experiment against the pinned entry before quoting it.

## C. Why the figures mixed three configurations

**Hypothesis, with its evidence — not a conclusion.** The document's figures
were produced by tools that selected a cache entry by directory order rather
than by any declared rule, so which configuration a figure described depended
on the filesystem.

The evidence:

1. **Three tools selected by `readdir` order.** `cachedFor` in
   `service/src/transcription/repair-source-text-cli.ts` and `scribeWordsFor`
   in `service/src/analysis/missing-cards-cli.ts` and
   `service/src/analysis/timing-defect-cli.ts` each took the **first**
   `transcription-*` directory the listing returned. All three are fixed as of
   Block 8 session 2 and now use `selectTranscriptionEntry`.
2. **On this volume that order yields exactly the observed mixture.** The
   listing returns, per reel: `758a…` (v4) first for `ground-truth`, `test-1`,
   `test-2` and `test-3`, and `0cb5…` (**v1**) first for `vitasilk`, because
   `0cb5` sorts ahead of `758a`. That is precisely the split in §B.1 — four
   reels at the pinned version and `vitasilk` at v1.
3. **The `il` figure is not explained by first-match** and remains unattributed.
   It matches the **v3** entry, which is *last* in the same listing on this
   volume. A selector that iterated and kept the last hit, or a session that
   named an entry by hand, would produce it. **Nothing in the repo records
   which**, and the tools that could have produced it no longer exist in that
   form.
4. **`readdir` order is not a stable property.** Node returns entries in the
   order the filesystem supplies. Nothing sorts them, and nothing about APFS
   guarantees the order across machines, volumes or entry churn, so the same
   command could have answered differently at any point.

**What this does not explain:** why a single write-up drew on three
configurations rather than one. First-match selection accounts for the
`vitasilk`/v1 mixture; the v3 figure needs a second explanation that the repo
does not carry.

## D. What a real fix needs

**A transliteration-aware distance between Arabic script and Arabizi**, so that
`من` and `mn` are *near* rather than *tied* with every other candidate. That
turns a flat cost surface into one with a minimum, and Levenshtein then has
something to find.

The mapping already exists in the repo: **`SCRIPT_RULES` in `core`** encodes the
Arabizi conventions for the correction prompt, and **ORTHOGRAPHY_GUIDE §2's
character table** is the canonical source — `7` for `ح`, `3` for `ع`, `9` for
`ق`, and so on. Turning that into a per-character cost and using it inside
`align` is the work.

Three things to keep in mind when doing it:

- **The merge case is separate.** Scribe's `ستة` + `وعشرين` became the single
  token `26`. `align` has no many-to-one operation at all — a merge is expressed
  as one substitution plus one deletion, so the merged word takes one token's
  interval and not the span of both. A transliteration cost does not fix that;
  it needs either a merge operation or an explicit rule that a merged word takes
  the union of its sources' intervals.
- **Re-aligning is free.** Every reel's raw Scribe response and corrected texts
  are in `.local/cache/<video-sha>/transcription-*/manifest.json`, so a fix can
  be measured across all five reels without re-transcribing anything.
- **Measure against one declared entry.** Use the pinned version, or state
  `--entry` explicitly. This document exists in two parts because that was not
  done once.
