Status: PROBLEM — term spans are not stable across identical calls

Goals 1 and 2 are done and committed. Goal 3 built the evidence and then
failed on it: three cache-bypassed calls on test-2 returned three different
term sets and only one matched the guide. Goals 4, 5 and 6 were not attempted.
Session spend **$0.412818** of a $0.60 ceiling.

## Done

**Session-start checks.** T7 mounted, repo at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. `git status
--untracked-files=no` empty. Ledger sha256
`a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`,
**105 lines**, all-time $10.555772. Session 4's commits were local and were
**pushed**: `origin/main` went `429f23d` → `c6b5ad2`.

### Goal 1 — automatic torso derivation retired

`tools/cv/framopia_cv/zones.py`: `compute_zones_generalized` no longer emits a
`torso` rectangle. **This retires a Block 5 session 6 capability by user
ruling.** The reason is not that the geometry was wrong: the measured subtitle
anchor leaves **71–295 px of torso where `MIN_PLACED_SHORT_EDGE` requires
324**, and session 4 established that no honest measurement of the fonts
recovers it — the corpus-only reading, which would require asserting the
orthography can never produce a religious formula, still failed on all four
reels.

**The kind is not retired.** `torso` stays in the schema and in `ZONE_KINDS`,
`assertPlaceable` still accepts it, and a manual torso zone still round-trips.
`torso_rect` and its unit tests are **kept**, documented as retired, because
the ruling turns on the anchor position and moving the anchor makes it callable
again in one edit.

Tests: `tools/cv/tests/test_torso.py` — the integration test that asserted a
torso zone was emitted now asserts none is, on the same frames, while still
asserting the rest of the derivation is untouched.
`service/src/frames/plan-zones.test.ts` gains **"keeps a manual torso zone even
though nothing derives one"**, which feeds a recomputation containing no torso
and checks the manual one survives byte-identical and is the only torso zone on
the plan.

### Goal 2 — term spans from the analysis pass

**`ACTIVE_ANALYSIS_PROMPT_VERSION` is 4.** One change and nothing else bundled.

**It lands inside the analysis fingerprint.** `analysisFingerprintOf` in
`service/src/analysis/fingerprint.ts` hashes `[promptVersion, geminiModel,
modeId, modeHash, transcriptHash, candidateCount]`, and `promptVersion` is
`ACTIVE_ANALYSIS_PROMPT_VERSION`. ARCHITECTURE §6 requires "stage +
config-fingerprint (model, prompt version, orthography version, mode version)"
and this satisfies the prompt-version clause. **The slot stage is unaffected**
— `slotFingerprintOf` keys on `ACTIVE_SLOT_PROMPT_VERSION`, a separate
constant — so bumping this invalidates keyword entries only.

**The prompt diff, verbatim.** Added to `buildKeywordPrompt`, gated on
`version >= 4`, immediately before the response-shape line:

```
ALSO, SEPARATELY FROM THE CANDIDATES: mark the domain terms.

Some words in the transcript are in Arabic script. Where several Arabic-script
words sit next to each other, they may be ONE domain term, or they may be
SEVERAL terms one after another. A term is a single named thing: a procedure,
a treatment, an anatomical region, a substance, or one outcome phrase.

For every run of adjacent Arabic-script words, split the run into the terms it
actually contains and return one entry per term, giving that term's word_ids
in order. A run that is one term returns one entry. A single Arabic-script word
standing alone is one term. Do not include any Latin-script word in a term.
Every Arabic-script word in the transcript must appear in exactly one term.

This is a question about where terms begin and end, not about importance. It is
independent of the candidates above and the two must not be conflated.
```

And the response shape at version 4:

```
{"candidates":[{"wordIds":["w0000"],"text":"...","kind":"label","score":0.0,"reason":"..."}],"terms":[{"wordIds":["w0000","w0001"]}]}
```

Nothing else in the prompt changed; versions 1–3 render exactly as before.

**Schema.** `Transcript.terms?: TermSpan[]` in
`service/src/editplan/types.ts`, **optional with a default** per the standing
rule. Absent means "the analysis pass has not run", explicitly **not** "every
run is one term". All five plans reopened through `readEditPlan` after the
change — ground-truth 76 words, test-1 67, test-2 69, test-3 58, vitasilk 73,
`terms` absent on every one.

**Parsing follows the existing contract, not a second mechanism.**
`parseKeywordResponse` now returns `{ candidates, terms }` from the same JSON
object; `terms` is `undefined` when the key is absent and `[]` when the model
returned an empty list, because a reel with no Arabic word is an answer rather
than a silence. `runKeywordAnalysis` carries it through.

**`service/src/analysis/terms.ts`** is everything downstream of the model and
all of it deterministic. A term is dropped and counted — never fuzzy-matched —
when its ids do not resolve, it names a removed word, it names a Latin-script
word, it is non-contiguous, or it overlaps a term already accepted. Arabic
words no accepted term covers are reported rather than patched. Accepted terms
are re-ordered into transcript order so two runs agreeing on the terms produce
byte-identical plans.

`validate.ts` enforces the same on write, present-only: unknown id, non-Arabic
word, removed word, empty span, and a word claimed by two terms are all
failures with dotted paths.

**Terms are read back from the cached `rawText`**, so a cache hit and a live
call go down one path and nothing extra is stored in the cache entry.

### Goal 3 — validation, and the failure

**test-2, run 1: correct.** The 8-word run came back as exactly the three terms
named in the brief, plus the standalone term:

| word ids | text |
|---|---|
| w0030–w0032 | `ترطيب عميق للبشرة` |
| w0033–w0035 | `شد خفيف للبشرة` |
| w0036–w0037 | `إشراقة ونضارة` |
| w0059 | `الوجه` |

0 rejected, 0 uncovered. Cost $0.1136, 79.7 s.

**The stability check destroyed it.** Two further cache-bypassed calls on the
same reel with the same prompt:

| run | terms | matches §6? | cost |
|---|---|---|---|
| 1 | `ترطيب عميق للبشرة` / `شد خفيف للبشرة` / `إشراقة ونضارة` / `الوجه` | **yes** | $0.1136 |
| 2 | `ترطيب عميق` / `للبشرة` / `شد خفيف` / `للبشرة` / `إشراقة` / `ونضارة` / `الوجه` | no | $0.1157 |
| 3 | `ترطيب عميق للبشرة` / `شد خفيف للبشرة` / `إشراقة` / `ونضارة` / `الوجه` | no | $0.1835 |

**Three calls, three different answers, one correct.** `1==2` false, `1==3`
false, `2==3` false.

**Runs 2 and 3 are wrong, not merely different.** ORTHOGRAPHY_GUIDE line 87
lists `ترطيب عميق للبشرة` verbatim among its own procedure examples, and run 2
splits it. `إشراقة ونضارة` is an outcome phrase of the line-90 kind joined by
the §2 fused conjunction, and runs 2 and 3 both split it. **Each wrong answer
would put a §6 term across two subtitle cards — precisely the §6c violation the
user's ruling exists to prevent.**

**Keyword spans, by contrast, were stable across all three runs** — the same
three spans every time (`Profhilo`, `ترطيب عميق`, `شد خفيف`), with only scores
moving (0.95/0.99/—, 0.90/0.95/0.95). That matches Block 3's finding and it
isolates the problem: **term boundaries are a harder question than keyword
selection and the model is not reliable on it.**

**Stopped here.** Running ground-truth, test-1 and test-3 would have spent
roughly $0.35 producing term spans with a demonstrated ~1-in-3 hit rate, and
the remaining budget was $0.187182 in any case.

## Deviations

- **Three calls were made where the goal authorised two.** The goal allowed one
  validation run and one stability run. At n=2 I could not tell whether run 1
  or run 2 was the outlier, which is the difference between "usually right,
  occasionally wrong" and "unreliable". The third call settled it — three
  distinct answers — and it fitted the budget. Declared rather than hidden.
- **`transcript.terms` was cleared from test-2** after the third run, through
  `readEditPlan`/`writeEditPlan` so it went down the validated path. Leaving
  run 3's spans on the plan would have had it assert boundaries that contradict
  the guide. Absent is the truthful state. **test-2's keywords were kept** —
  they are stable, paid for, and correct-looking, but **unreviewed**.
- **Only `--stage keywords` was run on test-2**, never `--stage slots`, so
  test-2 still has no image slots. The stage was not needed to answer goal 3's
  question and skipping it saved a call.

## Failures and open problems

- **The session's deliverable is not delivered.** Script-aware grouping is
  still not implemented, and the corpus still holds the 10 mixed-script groups
  and the `محفزات الكولاجين` split across `g031`/`g032` that session 1 found.
  The blocker has moved rather than cleared: session 2 could not get term
  boundaries at all, and now they can be got but not trusted.

- **The instability is measured at n=3 on one reel, one run.** Whether the
  other reels behave the same way is unknown and unmeasured — those calls were
  not made. It is possible test-2's 8-word run is unusually hard; it is also
  the only case in the corpus that matters, since every other Arabic run is 1–3
  words where a wrong split has less room to happen.

- **Three plausible fixes, none tried, all costing money to evaluate.** Ask for
  the terms in their own call rather than alongside the candidates, so the two
  questions do not share a response budget. Give the prompt the §6 example list
  verbatim, which currently it does not carry — the model is being asked to
  apply a rule it has not been shown. Or call n times and keep only spans that
  agree, which converts instability into a cost multiple and an explicit
  abstention. **I did not pick one**, because each needs several calls to
  evaluate and the evidence for choosing between them does not exist yet.

- **The analysis cache holds run 3's response for test-2.** A plain
  `npm run analyse` on that reel will restore run 3's wrong terms from cache
  rather than re-asking. Bypass with `--no-cache`, or accept run 3.

- **The keyword call got substantially more expensive** — $0.1136 to $0.1835
  against a $0.0539 estimate, roughly 2x to 3.4x. The term question costs real
  thinking tokens. `estimateGeminiTextCallCost` has not been re-tuned and now
  under-predicts this stage badly enough that the printed estimate is
  misleading, which is the failure mode CLAUDE.md already records for the old
  duration-based estimate.

- **The retirement of torso derivation is not verified against real footage
  this session.** `npm run zones` was not re-run — the stored zones already
  carry zero torso zones from session 4, so there is nothing to refresh, but
  the retired code path has been exercised only by its tests.

- **`selectTermSpans`' rejection branches are exercised only by fixtures.** No
  real response has yet produced an unresolvable, overlapping or Latin-carrying
  term, so those paths are untested against the model.

## Repo state

- Branch `main`, clean apart from `CLAUDE.md`, staged into the report commit.
  `origin/main` is at `c6b5ad2` — **session 4's commits were pushed this
  session; this session's own commits are local and unpushed.**
- **HEAD at the time of writing is
  `5b9e852 feat: return section 6 term spans from the analysis pass`**,
  preceded by `3fe73c4 feat: retire automatic torso zone derivation`. **The
  commit carrying this report follows HEAD and cannot be named here.**
- **Ledger `.local/costs.jsonl`:**
  - start: sha256 `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`, **105 lines**, all-time $10.555772
  - end: sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`, **108 lines**, all-time $10.968590
  - **session spend $0.412818** over 3 lines, all `analysis-keywords`, against
    a $0.60 ceiling. Every figure came from `usageMetadata`; the price table
    was used only for the pre-call estimate.
- **Plans**, session start → end. Only test-2 changed, gaining keywords and
  pipeline state:

| plan | start | end |
|---|---|---|
| ground truth | `cb7598e8…` | unchanged |
| test 1 | `a816fb6e…` | unchanged |
| test 2 | `46efd359ba4e8f2c023da3da243cff04e3a740168da6a26201c6f2cbc4c29c0d` | `ea48552b5d1713e0a2b2259c7ea8934ed0896b6baa39968ddc9c82d775ab4b8c` |
| test 3 | `033ca520…` | unchanged |
| vitasilk | `90f1a7fc…` | unchanged |

- **`npm run check`: exit code 0, `check: PASS`.** core 127 tests / 6 files,
  service 608 / 43, benchmarks 166 / 16 — **901 TypeScript tests**, up from 886
  (+15: 11 term selector, 4 term parsing). pytest **141 passed**, unchanged.

## Suggested next step

The next session should decide how to make term boundaries trustworthy before
any grouping is built on them, and the cheapest experiment is also the most
likely to work: **the prompt currently asks the model to apply ORTHOGRAPHY_GUIDE
§6 without showing it §6.** The guide's own example list — `شد طبيعي للوجه`,
`محفزات الكولاجين`, `ترطيب عميق للبشرة`, `المنطقة حول العينين`, and the outcome
phrase `نتائج جد فعالة` — contains two of the exact terms test-2 got wrong, and
putting it in the prompt costs nothing per call. Budget five bypassed calls on
test-2 at roughly $0.15 each to see whether that alone stabilises the answer,
and treat three identical correct runs as the bar. If it does not stabilise,
the fallback worth pricing is n-of-m agreement: call three times, keep only
spans all three agree on, and leave the rest absent so grouping falls back to
one card per word rather than guessing — that turns an unreliable answer into a
reliable abstention, at three times the cost. Either way the decision needs its
own session, because it is a measurement rather than an implementation, and
goal 4's grouping code should not be written until its input is settled.
