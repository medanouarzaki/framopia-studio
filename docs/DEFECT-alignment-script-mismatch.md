# Alignment mis-pairs Arabic-script draft tokens against Arabizi corrected text

**Status: open.** Found Block 7 session 7, diagnosed session 9, written up
session 10 so Block 8 does not re-derive it. **`service/src/transcription/align.ts`
is unchanged**; a fix was written, measured as a regression and discarded.

This is Block 2 territory — transcription and alignment — not comp building.
It is recorded here because Block 7 is where it became visible.

## 1. The symptom

Subtitles out of step with the speech: a word appears while a different word is
being said, and the effect reads as clumsy and arbitrary rather than as a
constant offset. Reported by the user on `vitasilk` at **8.8–11.9 s**, and
confirmed still present after one-word cards, the hold rule and short-card
intros — none of which touch it.

It is not a display problem. Grouping, display timing and the builder all
reproduce the word timings faithfully; the timings themselves are attached to
the wrong words.

## 2. The mechanism

`alignCorrectedOntoDraft` anchors corrected words onto draft timings with plain
Levenshtein alignment over normalized tokens:

```ts
const pairs = align(
  draftWords.map((w) => normalizeToken(w.text)),
  correctedTexts.map((t) => normalizeToken(t)),
);

for (const pair of pairs) {
  if (pair.hypIndex === null) continue;
  if (pair.op !== 'match' && pair.op !== 'substitute') continue;
  const anchor = draftWords[pair.refIndex as number];
  if (anchor === undefined) continue;
  output[pair.hypIndex] = {
    text: correctedTexts[pair.hypIndex]!,
    start: anchor.start,
    end: anchor.end,
    confidence: anchor.confidence,
    sourceText: anchor.text,
  };
}
```

**Scribe returns Darija in Arabic script; the correction pass returns Arabizi in
Latin script.** `normalizeToken('mn')` and `normalizeToken('من')` are not equal
and never will be, so across such a run **every candidate pairing costs exactly
the same**. Levenshtein has no signal to prefer one path over another, and the
path it returns among the ties is an artifact of the DP's tie-break order.

Reproduced from the transcription cache, free, on `vitasilk`:

```
op          ref  hyp  draft        corrected    interval
match       26   27   Silk         Silk         8.619-8.860
delete      27        من                        8.939-9.000
substitute  28   28   غير          mn           9.079-9.199
substitute  29   29   أنه          ghir         9.279-9.759
substitute  30   30   ينغّي،       annaho       9.819-10.519
substitute  31   31   ييدرات.      inourri      10.559-11.059
```

The aligner **deletes draft token 27 (`من`)** and shifts every substitution
after it by one. `mn` — which *is* `من` — takes `غير`'s interval; `ghir` — which
is `غير` — takes `أنه`'s. **`il` opens 0.540 s before its own token.** The draft
holds 72 word tokens against 73 corrected, so one net insertion has to go
somewhere, and with all costs tied it went here.

The Latin-script tokens (`Silk`, `vitamin`) do match, so they anchor correctly
and the sequence re-synchronises after them. The damage is confined to runs
between such anchors — which is most of a Darija reel.

## 3. What was tried, and why it is worse

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

## 4. Why the existing correspondence check cannot see it

`align.test.ts` asserts that a word's interval is the interval of the draft
token it records anchoring to, across a clean sequence, an insertion and a
deletion. **It passes on the current aligner, and it passed while the alignment
was wrong.**

That is not a weak test; it is a test of the wrong thing. The aligner never
gives a word an interval belonging to a token other than the one it *records*.
It records the wrong pairing, and the record is self-consistent with it.

**No checker reading the aligner's own output can detect this.** Detecting it
requires an independent statement of which draft token each corrected word
*should* correspond to — either a hand-written correspondence for a fixture reel,
or the transliteration knowledge that would fix the aligner in the first place.
Session 6's weaker check ("does this interval exist somewhere in the Scribe
response") passed 21 of 21 on a span that was wrong, for the same reason: an
interval can be real and belong to a different word.

## 5. What a real fix needs

**A transliteration-aware distance between Arabic script and Arabizi**, so that
`من` and `mn` are *near* rather than *tied* with every other candidate. That
turns a flat cost surface into one with a minimum, and Levenshtein then has
something to find.

The mapping already exists in the repo: **`SCRIPT_RULES` in `core`** encodes the
Arabizi conventions for the correction prompt, and **ORTHOGRAPHY_GUIDE §2's
character table** is the canonical source — `7` for `ح`, `3` for `ع`, `9` for
`ق`, and so on. Turning that into a per-character cost and using it inside
`align` is the work.

Two things to keep in mind when doing it:

- **The merge case is separate.** Scribe's `ستة` + `وعشرين` became the single
  token `26`. `align` has no many-to-one operation at all — a merge is expressed
  as one substitution plus one deletion, so the merged word takes one token's
  interval and not the span of both. A transliteration cost does not fix that;
  it needs either a merge operation or an explicit rule that a merged word takes
  the union of its sources' intervals.
- **Re-aligning is free.** Every reel's raw Scribe response and corrected texts
  are in `.local/cache/<video-sha>/transcription-*/manifest.json`, so a fix can
  be measured across all five reels without re-transcribing anything.

## 6. Scale

How many words sit in a cross-script substitution run and are therefore at risk
of being mis-paired. Measured from the cached responses, no model call:

| reel | words | at risk | share | cross-script runs |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 51 | 67% | 10 |
| test-1 | 67 | 43 | 64% | 11 |
| test-2 | 69 | 46 | 67% | 8 |
| test-3 | 58 | 29 | 50% | 10 |
| vitasilk | 73 | 40 | 55% | 10 |
| **all** | **343** | **209** | **61%** | **49** |

**61% of every word in the corpus rests on a pairing the aligner had no evidence
for.** Most of them land correctly, because a run whose token counts agree pairs
positionally by accident of the DP rather than by design. The 49 runs are where
a count mismatch can throw the whole run out — and one of them is what the user
sees at 9 seconds.
