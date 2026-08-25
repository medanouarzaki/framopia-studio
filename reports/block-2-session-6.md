Status: OK

# Block 2 — session 6

All six goals completed. Check harness fixed, ground truth corrected and
versioned, cache hardened, language tagging measured.

## Read this first

### The corrected noise floor: 3.7 WER points

Against the `v1.0.1-conformant` reference, the three identical correction
calls now score **14.8% / 16.0% / 18.5%** — a **3.7-point** spread, wider than
the old 2.5. The floor grew because correcting the reference removed the
accidental credit the outlier run was getting: run 3 was the one that produced
the fused `dl7loul` forms, and it was the best-scoring of six only because the
reference itself was non-conformant. Against the corrected reference it is now
the worst.

**Every other run improved by 4.9–6.2 points** purely from the reference edit:

| run | old ref | new ref | delta |
|---|---|---|---|
| run C gemini | 21.0% | 14.8% | −6.2 |
| run C hybrid | 22.2% | 16.0% | −6.2 |
| session 3 prompt v2 | 22.2% | 16.0% | −6.2 |
| noise floor run 1 | 21.0% | 14.8% | −6.2 |
| noise floor run 2 | 21.0% | 16.0% | −4.9 |
| noise floor run 3 | 18.5% | **18.5%** | **+0.0** |
| dial v1.0.5 run 1 | 22.2% | 16.0% | −6.2 |
| dial v1.0.5 run 2 | 21.0% | 14.8% | −6.2 |
| dial v1.0.5 run 3 | 21.0% | 14.8% | −6.2 |

The **2.5-point figure is superseded**, and every results file scored against
the old reference now says so at the top.

A side effect worth naming: re-scoring flips the v1.0.4-vs-v1.0.5 comparison.
Under the old reference v1.0.5 looked slightly worse (21.4% vs 20.2%); under
the corrected one it is slightly better (15.2% vs 16.4%) with a third the
spread. Both differences are inside the floor, so neither is measurable — but
the direction changed, and the reason is that the old reference rewarded the
spelling the rule forbids.

### Language tagging: coverage complete, stability good except on one boundary

**Coverage: 81 of 81 words tagged in all three runs. Zero null, zero
out-of-enum.** The null-fallback path was never exercised.

**Stability: 75 of 81 words carry the same tag in all three runs.** All six
that move are the Arabic-script tokens, and they move as a block — `darija` in
runs 1 and 2, `msa` in run 3:

| token | run 1 | run 2 | run 3 |
|---|---|---|---|
| `الإبرة` | darija | darija | **msa** |
| `الحريرية` | darija | darija | **msa** |
| `الكافيين` | darija | darija | **msa** |
| `نتائج` | darija | darija | **msa** |
| `جد` | darija | darija | **msa** |
| `فعالة` | darija | darija | **msa** |

These are exactly the medical and aesthetic domain terms §6 mandates be
written in Arabic script. The guide says which script they take and never says
which language they are, so the model has no basis to choose. Practical
answer: **the tags are dependable for Latin-script words and not for
Arabic-script domain terms** — and those six are precisely the words that
drive the Latin-vs-Arabic rendering decision PROJECT_SPEC §5 wants the tags
for.

**Model versus local derivation: 15 agree, 66 no-opinion, 0 disagreements.**
That is a weak result, not a strong one: the derivation is silent on 81% of
the transcript, so it can only confirm the easy French words. No word in any
plan carries `langDisagreement` from this run. `mixed` and `en` were never
produced by any run.

**WER did not move beyond the floor.** Version 3: 17.3% / 14.8% / 18.5%, mean
16.9%, spread 3.7 — which *is* the floor. Version 1 from the dial experiment,
same reference: 16.0% / 14.8% / 14.8%, mean 15.2%, spread 1.2. The 1.7-point
mean difference is not resolvable here. Text stability also dropped, 74/81
against 79/81. Both differences point the same way and both are inside the
noise; three runs cannot separate them from sampling. Version 3 is **not
active** — the user rules.

### Check harness: exit codes observed

`npm run check` is now `scripts/check.sh`, with `set -euo pipefail` and no
pipes at all.

| scenario | direct exit | `\| grep -E "Tests  "` | `\| grep -q "check: PASS"` |
|---|---|---|---|
| clean | 0 | 0 | 0 |
| lint error | **1** | **1** | **1** |
| failing test | **1** | **0** | **1** |

The audit found **no masked exit status in any tracked file** — the npm
scripts are `&&`-chained with no pipes, and the one shell script in the repo
(`benchmarks/whisper/setup.sh`) already sets `-euo pipefail`. The session-5
failure was in the caller, not the harness. That is also the honest limit
here: no change to the script can stop a caller piping into grep, and the
middle column shows the old pattern **still returns 0 when a test fails**,
because a failing run does print a "Tests" line. What the script adds is a
grep that is correct — `check: PASS` prints only on success.

### Total spend: $0.437754

Three new lines in `.local/costs.jsonl`:

```
{"stage":"langtagging-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.15647000000000003,"note":"language-tagging run 1/3 on the recorded ground-truth scribe draft, prompt version 3, guide v1.0.5; no scribe call made","timestamp":"2026-08-24T23:53:59.706Z"}
{"stage":"langtagging-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.13553,"note":"language-tagging run 2/3 on the recorded ground-truth scribe draft, prompt version 3, guide v1.0.5; no scribe call made","timestamp":"2026-08-24T23:55:17.605Z"}
{"stage":"langtagging-gemini","model":"gemini-3.1-pro-preview","unit":"run","usd":0.145754,"note":"language-tagging run 3/3 on the recorded ground-truth scribe draft, prompt version 3, guide v1.0.5; no scribe call made","timestamp":"2026-08-24T23:56:43.440Z"}
```

Estimated $0.6863. No Scribe calls; the recorded draft was replayed. Goals 2,
3 and 4 cost nothing.

### Goals completed

**All six.** The prompt allowed stopping after Goal 4; that was not needed.

## Done

- **Preflight.** T7 mounted; `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`.
  Clean tree, on `main`, in sync. Baseline `npm run check` green, exit 0,
  **302 tests**.
- **Goal 2 — `fix: make the check harness fail on any component failure`.**
  `scripts/check.sh`, `npm run check` points at it. Exit codes proven with a
  deliberate lint error and a deliberate failing test, both reverted; neither
  was committed.
- **Goal 3 — `fix: bring the ground truth into conformance with the frozen
  dial spelling`.** Three tokens in `.local/ground-truth/ground-truth.txt`:

  | before | after |
  |---|---|
  | `Alors 3ndi lik joj dl 7olol` | `Alors 3ndi lik joj dial l7olol` |
  | `Kat7taji joj dl 7essass ` | `Kat7taji joj dial l7essass ` |
  | `Li houa wa7d l cocktail dl vitaminat` | `Li houa wa7d l cocktail dial lvitaminat` |

  Noun spellings unchanged; word count still 81. The reference is versioned
  `v1.0.1-conformant` via a `# reference-version:` header that
  `npm run bench:tag` copies into the JSON, with `GroundTruth.version`
  exposing it. Regenerating confirmed **test-1, test-2 and test-3 are
  byte-unchanged**; the ground-truth JSON diff is exactly the three tokens
  plus the version field. Re-scored table and the corrected floor appended to
  `benchmarks/RESULTS-block2-dialrule.md`; `-noisefloor.md` and the original
  `-dialrule.md` section carry supersession notices.
- **Goal 4 — cache hardening**, three commits.
  `fix: consult the cache before extracting audio`: `extractAudio` reuses an
  existing extraction, and where none exists the cached entry's audio is
  copied back instead of running ffmpeg. `perf: hash the source video once
  per run`: the CLI passes its hash down via a new `videoSha256` option.
  `feat: bound the transcription cache size`: `evictStaleEntries` keeps
  `MAX_ENTRIES_PER_VIDEO = 3` per video hash, least-recently-written first.
- **Goal 5 — language tagging**, three commits. `feat: add prompt version 3
  requesting per-word language tags`, `feat: cross-check model language tags
  against a local derivation` (`deriveLang`, `langDisagreement` on the plan
  word), `test: measure language tagging against the noise floor`
  (`benchmarks/RESULTS-block2-langtagging.md`).
- **Goal 6 — CLAUDE.md** updated for all of it.

## Deviations

- **Goal 2 found nothing to fix in the harness.** The audit turned up no
  masked exit status in any tracked file; the npm chain was already correct
  and both failure modes already exited 1. Rather than report "nothing to do",
  I addressed the actual failure mode — a caller inferring success from
  output — with a script that prints an unambiguous success marker. The
  limitation is stated above and in the script's comment.
- **Three cache changes were committed as one and then split.** Caught before
  pushing; `git reset --soft` and re-staged into the three commits the prompt
  named. The hash-once change spans `job.ts` and `transcribe-cli.ts`, and
  `job.ts` landed in the earlier `fix:` commit — both compile and test green
  independently, but that one commit boundary is not perfectly clean.
- **`transcribeVideo` gained an `audioDir` option.** It wrote to a fixed
  `.local/audio`, so a test picked up the real extraction left by session 5's
  live run and reported zero extractions. Injectable now, defaulting to the
  same path.
- **`PlanWord.langDisagreement` is a departure from ARCHITECTURE §3.** The
  schema has nowhere to say "two sources conflict", and silently preferring
  one would discard the only signal that either is wrong. Optional, set only
  when true; the derivation itself is not stored because it is recomputable.
- **The cache payload gained `correctedWords`.** Storing only texts would have
  dropped the language tags on a cache hit. Optional, so entries written
  before version 3 existed still rehydrate correctly with no tags — which is
  right, since those runs genuinely produced none.
- **Only `ground-truth` is versioned.** Adding a marker to test-1/2/3 would
  have meant editing ground-truth files I was told not to touch. Flagged
  below.
- **No new dependencies.**

## Failures & open problems

- **Three of four reference files are unversioned.** Any result scored against
  test-1, test-2 or test-3 still cannot name its reference.
- **The darija-versus-msa call on Arabic-script terms is undecided and
  unstable.** No amount of re-running fixes it; the guide has to say which
  language a clinical term in Arabic script is. This is the one question the
  tags were wanted for.
- **The reference tags Arabic script `msa` by construction**, not by
  judgement — its tagger assigns it from the script alone. So the reference
  cannot settle the question above either.
- **Version 3 is measured but not decided**, and both its signals (WER mean
  1.7 points worse, text stability 74/81 against 79/81) point mildly against
  it while sitting inside the noise.
- **`mixed` and `en` have never been produced** by any run, so those two enum
  values are exercised by unit tests only.
- **The eviction bound is a guess.** Three entries per video, chosen not
  measured, and eviction is by manifest mtime — a cache entry that is read
  constantly but never rewritten looks as old as one nobody wants.
- **Nothing prunes whole video directories.** Eviction is per video hash, so
  ten videos leave ten directories however stale.
- **`readEditPlan` is still called by nothing**, so the schema-version gate
  has never run in anger.
- **Cleaning has still never marked a word on real output.** No filler or
  stutter has appeared in any real transcript.
- The corrected floor rests on three runs of one 23-second reel. It is a
  better number than the old one, not a good one.
- I did not re-run the live CLI this session, so the cache-before-ffmpeg and
  hash-once paths are covered by tests but were not observed end to end on the
  real 2.8 GB reel.

## Repo state

- Branch `main`, pushed to `origin/main`.
- HEAD: `docs: update operating memory for language tagging`.
- Ten commits this session.
- `npm run check`: **green, exit 0, 324 tests** — core 23, service 165,
  benchmarks 136. Baseline was 302.

## Suggested next step

The §6 language question is now the blocker for anything that depends on the
tags, and it is a one-line ruling rather than a build: decide whether a
clinical term written in Arabic script is `darija` (the speaker's language) or
`msa` (the term's register), state it in ORTHOGRAPHY_GUIDE §6 next to the
script rule, and the six unstable words become stable by construction — after
which version 3 is worth a decision on the same evidence plus a re-run. Purely
mechanical and worth doing regardless: version the other three reference
files, which costs nothing and closes the provenance gap that Block 1 already
learned the hard way. Then the analysis stage is the natural build — the Edit
Plan has typed empty `keywords` and `images` containers, the transcript that
feeds them is cached, and a cache miss is now the only thing that costs money,
so iterating on the analysis prompt is finally cheap. Worth folding in when
convenient: eviction by last read rather than last write, and pruning whole
video directories.
