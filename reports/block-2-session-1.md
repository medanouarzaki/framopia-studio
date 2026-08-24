Status: OK

# Block 2 — session 1

Housekeeping session: commit the Block 1 handoff, correct a known-bad cost
ledger line, and run the frozen config on a reel outside the Block 1 sample.
No production pipeline code, as specified.

## Done

- **Preflight.** T7 Shield mounted; working directory
  `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. On `main`, in sync with
  `origin/main`. Baseline `npm run check` **green, 127 tests** (service 14,
  benchmarks 113).
- **`handoffs/block-1.md`** — committed verbatim (`docs: add block 1 handoff`).
- **Ledger correction** (`fix: record the understated gemini ledger entry from
  block 1 session 4`). The known-low line:

  ```
  {"stage":"benchmark-gemini","model":"gemini","unit":"run","usd":0.031668,"timestamp":"2026-08-24T19:50:06.011Z"}
  ```

  The raw response **was recoverable** — not from `.local/cache/` (that
  directory does not exist) but from
  `benchmarks/results/2026-08-24T19-48-01-202Z/raw/gemini.json`, which every
  run writes. Its `usageMetadata`: 2748 TEXT + 582 AUDIO input tokens, 2084
  visible output, **10295 thinking**. Re-costed with the current constants
  ($2.00/M in, $12.00/M out) the call was **$0.155208**, 4.9x the recorded
  figure. Reconstructing the old pre-fix formula from that same usage
  reproduces $0.031668 exactly, which is what identifies this raw response as
  that call rather than a guess.

  A delta-only entry of **$0.123540** (`stage: benchmark-gemini-correction`)
  was appended with a `note` naming the corrected timestamp. The original line
  was not touched. I also verified the next Gemini line (19:54:06, $0.156060)
  reproduces exactly *with* thinking tokens from its own raw response, so
  19:50:06 is the only affected entry — the ledger has no earlier Gemini line.
- **`benchmarks/RESULTS-block1.md`** — new closing subsection recording that
  the 19:50:06 line is known-low and must never be quoted as accurate.
- **Robustness run** (`test: run the frozen config on a reel outside the block
  1 sample`). `vitasilk.mov` identified — both checks agreed: the only file in
  `my files/test videos/` whose name contains `vitasilk`, and the only one with
  no `footage.json` entry. Catalogued as a fifth reel with `groundTruth: false`
  (the schema's existing way to say "none") plus a `notes` field. Scribe and
  hybrid only, frozen config untouched. Full write-up in
  **`benchmarks/RESULTS-block2-robustness.md`**; spotchecks mirrored to
  `benchmarks/results/latest-spotcheck/vitasilk-{hybrid,scribe}.html`.
- **`test: cover the unscored benchmark report mode`** — see Deviations.
- **`docs: update operating memory for block 2`** — CLAUDE.md now carries the
  fifth reel, the `--no-ground-truth` mode, and Block 2 as in progress.

### The three things to see without opening the results file

**1. "vitasilk" renderings — one distinct form, fully self-consistent.**

Both engines, both occurrences, four times out of four: **`Vita` `Silk`** —
split into two tokens, both title-cased.

- scribe: "…من la marque **Vita Silk** من غير أنه…" and "…3ndhom la marque **Vita Silk** ولقيتي…"
- hybrid: "…mn la marque **Vita Silk** mn ghir annaho…" and "…3ndhom la marque **Vita Silk** w l9iti…"

No misspelling, no drift between occurrences, no Arabic-script rendering, no
disagreement between scribe and hybrid. The correction pass passed the brand
through untouched. Nothing was corrected and no keyterm was added.

Read honestly: an unknown proper noun with no vocabulary behind it came out
stable, which is weak evidence *against* keyterm prompting being load-bearing
for brand names — but the split form (`Vita Silk` rather than `Vitasilk`) is a
real ambiguity only a client-supplied keyterm could settle.

**2. Arabic-script audit — the hybrid pass emitted zero Arabic-script words.**

There is no list. Scribe produced 42 Arabic-script tokens as always, and the
correction pass transliterated every one, hair-care vocabulary included:
`شعرك` → `ch3rk` (twice), `حرير مسبسب` → `7rir msbsb`, `ينغّي، ييدرات` →
`ynourri yhydrati`, `تهلّي` → `thllay`.

ORTHOGRAPHY_GUIDE §6(a) scopes the Arabic-script rule to the medical and
aesthetic domain and hair care sits on that boundary. On this reel the pipeline
placed hair care **outside** §6(a) — but with no instruction either way, so
that is the model's default, not a ruling. **Open question for you; the guide
was not edited and nothing is proposed here.** The four terms above are what a
§6(a) ruling would have to cover.

**3. `ou`/`و` corruption — it did not reappear.**

Every و came out as `w`: `ولقيتي` → `w` + `l9iti`; `ولا`/`وى` → `walaw`;
`وعشرين` → folded into `26` by the number rule. Exactly one hybrid token
contains `ou` — **`ynourri`** at 9.84 s, from scribe's `ينغّي` — and it is not
the corruption: it is a French-derived hair-care verb (*nourrir*) where `ou`
spells the /u/ vowel, not a conjunction resolved into French *ou*. Whether
v1.0.3 wants `ou` or `u` there is a separate question the guide does not
currently answer.

### Reel and run numbers

25.692 s, 2160×3840, 29.97 fps, ProRes, pcm_s24le 48 kHz stereo. Materially
consistent with the Block 1 reels (same resolution, frame rate and capture
chain); 25.7 s against their 21–23 s, longer but not materially so. One voice
throughout, no audible second speaker.

| engine | orthography | ts dev vs scribe | cost | wall | realtime |
|---|---|---|---|---|---|
| scribe | 100.0% (42 arabic-script unscored) | — | $0.001570 | 2.6 s | 0.10x |
| hybrid | 98.6% (0 arabic-script) | 0 ms / 0 ms (29 pairs) | $0.112576 | 66.3 s | 2.58x |

Estimated $0.1013, actually spent **$0.114146**, both recorded to the ledger —
well under the $0.50 stop threshold. Whole invocation 69.4 s, 2.70x realtime.
The Gemini correction billed 7433 thinking tokens against 1096 visible (6.8x,
above Block 1's ~5x).

Hybrid's single orthography flag is `bach`, matched as a near-miss of
freeze-list `wach` at edit distance 1. **False positive** — `bach` (باش) and
`wach` (واش) are different words and both were spelled correctly. Zero digit
substitutions, zero `sh`/`ch` errors.

## Deviations

- **Baseline tree was not strictly clean.** `handoffs/block-1.md` already
  existed untracked at session start. I diffed it against the prompt text
  before doing anything: **byte-identical**. The tree was otherwise clean, and
  halting over the exact file Goal 2 asks me to create would have been
  pointless, so I committed it as-is rather than reporting a dirty tree.
- **No `feat:` commit for the unscored runner mode — it already existed.**
  `--no-ground-truth` is implemented in `run.ts`/`report.ts` and documented in
  `benchmarks/README.md` and CLAUDE.md, and it already drops the WER columns
  rather than zeroing them. A test asserting the report drops those columns
  also already existed. What was missing was the "not faked" half, so I added
  one test asserting the header and data rows are genuinely six cells wide (no
  placeholder standing in for a dropped score) and that the orthography column
  stays real. Committed separately as `test:` rather than `feat:`, since no
  feature was added.
- **The ledger note went into `benchmarks/RESULTS-block1.md`, not a sibling
  file.** The prompt allowed either. Run C's results are the document people
  quote costs from, so the caveat belongs where the numbers are; a sibling
  file is a caveat nobody opens.
- **Added `note?: string` to `CostEntry`** in both `benchmarks/src/costs.ts`
  and `service/src/costs.ts`. The correction entry needs the field and the
  interface did not have it; adding it to only one copy would have widened the
  known duplication drift. One-line comment on each explaining when it is set.
- **`--dry-run` prices its 1.1 s fixture, not the real file** (by design — it
  never touches the audio). Its $0.0082 estimate was therefore meaningless
  here, so I called `estimateCosts` directly with the true 25.692 s duration to
  get $0.1013 before spending. Printed, and the real run printed the same
  figure.
- Removed two stray `latest-spotcheck/dry-run-*.html` files that my own
  dry-run wrote into the stable mirror. No user asset was touched; nothing in
  `my files/test videos/` was moved, renamed or modified.

## Failures & open problems

- **WER is unscored for `vitasilk`** — there is no ground truth. Everything
  reported for this reel is conformance, consistency, cost and timing. A
  fluent, confidently wrong transcript would score identically. This is the
  single biggest limit on the run.
- **The 0 ms / 0 ms deviation figure is thinner than it looks.**
  `crossEngineDeviation` matches by normalized text, and hybrid transliterates
  Darija out of Arabic script, so only **29 of 73** tokens can match at all —
  all of them French/English code-switches. The Darija spans, ~60% of the
  reel, are not covered by that statistic. Comparing position-by-position
  instead (a rough proxy, since hybrid legitimately re-tokenizes), 34 of 73
  tokens sit up to **740 ms** from the scribe token at the same index,
  concentrated in the first ~10 s where the correction pass inserted `هذا` →
  `a lala` and split `ولقيتي` → `w` + `l9iti`. That is what anchor alignment
  with interpolation is expected to do around insertions and is not evidence
  of a fault — but it is not evidence of correctness either. **Only the
  spotcheck HTML checked by ear can settle it, and I have not done that.**
- **The freeze-list fuzzy matcher produces false positives** on short words
  (`bach` flagged against `wach`). Known from Block 1; this run is a concrete
  instance. The 98.6% figure is really 100% with one bad flag.
- **Scribe emitted the CJK character `五`** ("five") at 1.60 s where the
  speaker said "5 minutes". Hybrid corrected it to `5`. A one-off, but any
  consumer of raw scribe output has to tolerate scripts from outside this
  language pair.
- The `--no-ground-truth` path is now unit-tested at the report layer only.
  The end-to-end runner path for it is exercised by this session's real run
  but not by an automated test.
- The `config.ts`/`costs.ts` duplication between `service/` and `benchmarks/`
  is untouched and now one field wider. Still a Block 2 unification target.
- Nothing was run for gemini-alone or whisper on this reel, deliberately.

## Repo state

- Branch `main`, pushed to `origin/main`.
- HEAD: `docs: update operating memory for block 2`.
- Commits this session, oldest first: `docs: add block 1 handoff`, `fix: record
  the understated gemini ledger entry from block 1 session 4`, `test: cover the
  unscored benchmark report mode`, `test: run the frozen config on a reel
  outside the block 1 sample`, `docs: update operating memory for block 2`,
  plus this report.
- `npm run check`: **green, 128 tests** (service 14, benchmarks 114) — one more
  than the 127-test baseline, the added unscored-mode test.

## Suggested next step

Two cheap things before pipeline code, both of which this run argued for. First,
hand-write ground truth for `vitasilk` into `.local/ground-truth/vitasilk.txt`
and run `npm run bench:tag` plus a rescore — the engine outputs are already on
disk, so a second speaker and second domain become *scored* evidence for the
price of transcription time and no API spend at all, which is the cheapest
widening of the evidence base available. Second, listen to
`latest-spotcheck/vitasilk-hybrid.html` and settle whether the timings hold on
Darija spans, since no automated check on this reel covers them and the
0 ms / 0 ms headline is measured on 29 code-switched tokens. Then begin the
production pipeline proper: npm workspace unification to kill the
`config.ts`/`costs.ts` duplication, the production hybrid module in `service/`
ported from the benchmark code, and Edit Plan schema v1. The one guide question
this run raises — whether hair-care vocabulary falls inside ORTHOGRAPHY_GUIDE
§6(a) — is yours to rule on and needs no code either way.
