# Block 6 — script-aware subtitle grouping

**At intro+outro 0.13 s with minHold 0.10 s, 7 of 190 subtitle groups are
unbuildable, against session 1's 6 of 182.**

Of that difference, **one group is the cost of this change and one is not**.
Script-aware grouping makes `hia` on test-1 unbuildable and rescues `mn` on the
same reel, netting zero; the seventh failure, `le` on test-2, is a lone group
that already existed on disk before this session and arrived when session 5
added test-2's first keywords. **Script-aware grouping is net neutral on
buildability.**

Session 6, no API calls. Free, local, read-only until the corpus write.

## What was implemented, and what deliberately was not

**Implemented: one script per subtitle card.** A group's words all share one
`script` value. A Latin word never pairs with an Arabic-script word. The rule
is enforced in `service/src/analysis/regroup.ts` by cutting at every script
change, which like everything else in that pass only ever splits, so
PROJECT_SPEC §5's 1–2 word rule cannot be broken by it.

**Not implemented: whole-term grouping.** ORTHOGRAPHY_GUIDE §6c requires an
Arabic domain term to render whole, and after this change **a multi-word term
can still land across two or more cards, exactly as it does today**. This is a
known violation of §6c, accepted deliberately, and §5 below records every
instance of it.

The reason is evidence, not oversight. Block 6 session 5 added
`ACTIVE_ANALYSIS_PROMPT_VERSION` 4 to get term boundaries out of the analysis
pass and then measured them: three cache-bypassed calls on test-2 returned
three different term sets, and only one matched the guide. Two of the three
split `ترطيب عميق للبشرة`, which §6 lists verbatim among its own examples.
Grouping on that would trade a violation that is visible and constant for one
that is invisible and varies per run.

`Transcript.terms`, `service/src/analysis/terms.ts`, the validator rules and
prompt version 4 all remain in place and are **not read by grouping**. They are
the groundwork for the revisit in Block 7, once the user can judge a split term
on a built comp. They are not dead code and should not be removed as such.

## 1. Group counts

| reel | groups before | after | changed |
|---|---|---|---|
| ground truth | 38 | 40 | 4 |
| test 1 | 38 | 44 | 12 |
| test 2 | 37 | 38 | 2 |
| test 3 | 30 | 31 | 2 |
| vitasilk | 41 | 41 | 0 |
| **pooled** | **184** | **194** | **20** |

Ten new groups, one for each mixed-script group that existed. vitasilk is
untouched because it is entirely Latin script.

**test-2's "before" is 37, not the 35 session 1 swept.** Session 5 ran keyword
analysis on that reel for the first time, and the keyword-aware pass split two
groups. That change is not this session's and is the source of the seventh
timing failure below.

## 2. Mixed-script groups

**Ten before, zero after.** Every one named, with the reel it was on:

| reel | group | text |
|---|---|---|
| ground truth | `g031` | `3lih الكافيين` |
| ground truth | `g037` | `wki3tiw نتائج` |
| test 1 | `g005` | `bghiti تحفيز` |
| test 1 | `g018` | `للكولاجين f` |
| test 1 | `g031` | `fa محفزات` |
| test 1 | `g032` | `الكولاجين hia` |
| test 1 | `g034` | `إبر katji` |
| test 1 | `g037` | `jawdat البشرة` |
| test 2 | `g032` | `diri الوجه` |
| test 3 | `g022` | `kay3ti نتائج` |

This matches session 1's count of ten exactly. **Three have the Arabic word
first** (`g018`, `g032` on test-1, and `g037` on test-1 reads Latin-first while
`g032` reads Arabic-first), which is why the cut is made on any change of
script rather than on the position of the Latin word.

A post-condition in `regroupForKeywords` throws if any rebuilt group mixes
scripts. It is unreachable by construction and is there because a mixed card
would reach a client's screen needing a font switch mid-string, which Block 7's
ExtendScript does not do.

## 3. One keyword was lost, and it is the expected conflict

**test-1 `k003` "jawdat البشرة" is dropped**, with the new reason
`span-is-mixed-script`. It is the only keyword in the corpus whose span
straddles a script boundary, and session 1 flagged it as the one mixed keyword.

It is dropped rather than narrowed: which half of a mixed span carries the
emphasis is a judgement the re-grouping pass has no basis to make. test-1 keeps
two of its three keywords. No other reel lost one.

**No other conflict between script splitting and keyword alignment occurred.**
Every surviving keyword span still maps to exactly one group.

**`supersededBy` survives**, verified rather than assumed. Session 2 recorded
that merging renumbers groups and breaks those links; splitting does not,
because the pass rebuilds every group from the cut set and re-attaches the
owner by the span's start position. A test drives a split elsewhere in the reel
and asserts the keyword's group keeps both its words and its `supersededBy`.

## 4. Speech duration

Group speech duration, min / p10 / median / max in seconds:

| reel | before | after |
|---|---|---|
| ground truth | 0.087 / 0.221 / 0.520 / 1.060 | 0.087 / 0.211 / 0.480 / 1.021 |
| test 1 | 0.030 / 0.180 / 0.500 / 1.020 | 0.030 / 0.160 / 0.379 / 1.020 |
| test 2 | 0.139 / 0.281 / 0.520 / 1.099 | 0.139 / 0.280 / 0.480 / 1.099 |
| test 3 | 0.231 / 0.300 / 0.581 / 1.199 | 0.231 / 0.300 / 0.579 / 1.199 |
| vitasilk | 0.000 / 0.220 / 0.521 / 1.260 | 0.000 / 0.220 / 0.521 / 1.260 |
| **pooled** | **0.000 / 0.240 / 0.520 / 1.260** | **0.000 / 0.220 / 0.480 / 1.260** |

The median falls 0.520 → 0.480 s and the p10 0.240 → 0.220 s. **Neither the
minimum nor the maximum moves on any reel**, because splitting a pair produces
two shorter groups but cannot produce one shorter than the shortest word
already present.

## 5. §6 terms still split across cards — the accepted violation

**Eleven multi-word §6 terms render across more than one card.** This is the
recorded state of the violation described at the top. Each is named with its
reel, the groups it now spans, and the text as each card would show it.

| reel | term | cards | as rendered |
|---|---|---|---|
| ground truth | `نتائج جد فعالة` | `g039` `g040` | `نتائج` / `جد فعالة` |
| test 1 | `شد طبيعي للوجه` | `g002` `g003` `g004` | `شد` / `طبيعي` / `للوجه` |
| test 1 | `تحفيز طبيعي للكولاجين` | `g006` `g007` | `تحفيز` / `طبيعي للكولاجين` |
| test 1 | `تحفيز طبيعي للكولاجين` | `g018` `g019` | `تحفيز طبيعي` / `للكولاجين` |
| test 1 | `شد خفيف للبشرة` | `g023` `g024` | `شد خفيف` / `للبشرة` |
| test 1 | `محفزات الكولاجين` | `g034` `g035` | `محفزات` / `الكولاجين` |
| test 2 | `ترطيب عميق للبشرة` | `g017` `g018` | `ترطيب عميق` / `للبشرة` |
| test 2 | `شد خفيف للبشرة` | `g019` `g020` | `شد خفيف` / `للبشرة` |
| test 3 | `منطقة حول العينين` | `g005` `g006` | `منطقة` / `حول العينين` |
| test 3 | `نتائج جد فعالة` | `g023` `g024` | `نتائج` / `جد فعالة` |
| test 3 | `نتائج جد فعالة` | `g030` `g031` | `نتائج جد` / `فعالة` |

Term identity here is read off ORTHOGRAPHY_GUIDE §6's own example list, by eye
rather than from the plans: line 87 names `شد طبيعي للوجه`,
`محفزات الكولاجين` and `ترطيب عميق للبشرة`, §6c names
`تحفيز طبيعي للكولاجين` and `المنطقة حول العينين`, and line 90 names
`نتائج جد فعالة` as an outcome phrase. **`شد خفيف للبشرة` is not in the list**
and is judged a term by its identical construction to `شد طبيعي للوجه`.

**test-2's eight-word run is the one case where the splitting is partly
right.** It holds three adjacent terms and now renders as five cards —
`ترطيب عميق` / `للبشرة` / `شد خفيف` / `للبشرة` / `إشراقة ونضارة`. Two of the
four boundaries fall inside a term and are violations; the third term,
`إشراقة ونضارة`, comes out whole by accident of its length.

**This list is an upper bound on nothing and a lower bound on nothing.** It
counts what the guide's examples let us identify. A term the guide does not
name and that no one has recognised by eye would not appear here.

## 6. Timing budget on the new grouping

Same grid as session 1: intro+outro ∈ {0.13, 0.20, 0.27, 0.33, 0.40} s ×
minHold ∈ {0.10, 0.15, 0.20, 0.25, 0.30} s. Display timing is re-derived from
speech timings for every cell, so no stored value is read.

Pooled percentage of subtitle groups buildable — **session 1 first, this
session in bold**:

| intro+outro | 0.10 | 0.15 | 0.20 | 0.25 | 0.30 |
|---|---|---|---|---|---|
| 0.13 s (4f) | 97% / **96%** | 93% / **93%** | 86% / **86%** | 81% / **81%** | 74% / **74%** |
| 0.20 s (6f) | 92% / **91%** | 84% / **83%** | 78% / **78%** | 72% / **72%** | 66% / **67%** |
| 0.27 s (8f) | 81% / **81%** | 77% / **77%** | 67% / **68%** | 63% / **63%** | 55% / **55%** |
| 0.33 s (10f) | 74% / **74%** | 67% / **68%** | 62% / **62%** | 55% / **55%** | 47% / **47%** |
| 0.40 s (12f) | 66% / **67%** | 57% / **57%** | 53% / **54%** | 43% / **45%** | 35% / **36%** |

**The shape of the surface is unchanged.** No cell moves more than 2 points and
the loosest cell remains the best. Ten more groups spread over the same audio
does not change what the budget can carry.

### Which groups changed verdict

Compared by reel and text rather than by id: the failure ids the sweep prints
are post-merge, and the merge pass renumbers.

**Newly unbuildable:**

- **test 1 `hia`** — 0.099 s of speech. It was half of the mixed group
  `الكولاجين hia`, which at 0.700 s was comfortably buildable. Splitting leaves
  the Latin word alone and it cannot be extended or merged into a card that
  holds. **This is the cost of the ruling, and it is one group.**
- **test 2 `le`** — 0.139 s of speech, a lone group. **Not caused by this
  change**: it is byte-identical before and after, and it became a lone group
  when session 5 ran keyword analysis on test-2 for the first time. Session 1
  swept test-2 at 35 groups; it is at 37 now for that reason.

**Newly buildable:**

- **test 1 `mn`** — 0.100 s of speech, unchanged in itself, but now rescued by
  a merge. Splitting created adjacent single-word groups around it, and the
  merge rescue fires only when a pair totals two words or fewer.

The other five failures are the same on both sweeps: ground-truth
`cernes pigmentés` (short by 0.009 s) and `houa wa7d` (0.083 s), test-1 `شد`
(0.030 s) and `tb3i m3aya` (0.170 s), and vitasilk `mn` (0.190 s). Two of those
remain the degenerate word timings session 1 identified — vitasilk `mn` at
0.000 s and test-1 `tb3i m3aya` at 0.030 s — which no intro or outro choice
rescues and which are a Block 2 alignment question.

### The merge rescue woke up

**Merges went from 20 to 245 across the grid, and from 0 to 4 at the loosest
budget.** Session 1 recorded that the rescue barely fired because grouping had
already paired words wherever it could, leaving few adjacent single-word
groups. Splitting mixed pairs creates exactly those, so the pass that was
nearly inert now does real work. It is what rescues test-1 `mn`.

This is worth knowing before templates are built: the merge is a display-timing
behaviour, so **two cards the plan lists separately can be shown as one**, and
the count of groups on the plan is not the count of cards on screen at a given
budget.

## Caveat

Five reels, one client, two speakers, and a corpus in which one reel is
entirely Latin. The mixed-script count of ten and the eleven split terms are
what these five reels contain, not a rate.
