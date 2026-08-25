# Block 4 — amendment sweep

Every amendment Block 4 produced, with the doc, the section, and the text as
it now stands. **Each was verified against the repo when this was written**;
an amendment list that misdescribes the code is worse than none, so where a
claim could be checked mechanically it was.

## Applied — already in the docs

### PROJECT_SPEC §5 (Images) — the frozen config

> **The image config is frozen: `gemini-3-pro-image` at 2K, 1:1, 2 candidates
> per slot.** Evidence, costs and caveats in `docs/DECISION-image-config.md`.
> The candidate count is 2 rather than §5.4's 3 because pro's measured cost
> puts three on a five-slot reel outside the budget envelope below.

Verified: `DEFAULT_IMAGE_CONFIG` in `service/src/images/config.ts` holds
exactly these values, and `service/src/decisions.test.ts` fails if the doc and
the constant diverge.

### PROJECT_SPEC §5 (Images) — single-subject ideas

> **A slot idea depicts one subject.** The planner may not write a
> multi-subject idea — no shelves, displays, ranges, collections or plural
> product nouns. […] Enforced at plan time as a hard failure naming the slot
> (`checkSlotIdea`, Block 4 session 7); never silently rewritten, because the
> planner is what needs to change.

Verified: `checkSlotIdea` in `core/src/mode.ts`, thrown as
`MultiSubjectIdeaError` from `planSlots` in
`service/src/analysis/slot-select.ts`.

### PROJECT_SPEC §5 — candidate count in the panel line

> The generated default is 2 (`DECISION-image-config.md`); a mode may raise it
> via `imageCandidates`.

Verified: `ClientMode.imageCandidates` exists, is validated to the 2–4 band,
and `k2-syndicalia` sets 2.

### ARCHITECTURE §5.4 — four amendments

1. **Candidate default** 3 → 2, with the arithmetic.
2. **Single-subject ideas**, a hard failure at plan time.
3. **`edge_halo` compares against the original**, threshold unchanged.
4. **Cost fields**: `byStage` is last-run, `spentUsd`/`spentByStage` are
   cumulative; slot planning writes `imageSlots` so the two image stages do
   not share a bucket.

Verified: all four are in the file, and §5.4's base statement and cutout-gate
sentence now precede them rather than being absorbed into one.

### CLAUDE_CODE_GUIDELINES §4 — a defect report names the state it destroyed

Added at session 4. Verified present.

### DECISION-transcription-config.md — prompt version 4

The amendment chain stopped at version 3 while the code ran 4 for three
sessions. Written at session 7 and now enforced: `decisions.test.ts` reads the
highest `ACTIVE_PROMPT_VERSION` in the doc and asserts it equals the constant.

### DECISION-image-config.md — new

The block's freeze record. Says plainly that the cutout metrics did **not**
separate the two models, so the decision rests on the user's judgement of
prompt fidelity and must not be defended with the metrics.

## Schema additions — ARCHITECTURE §3

Twelve fields, **every one optional with a default**, under the standing
schema fragility rule. Verified by reading `service/src/editplan/types.ts`:
each is declared with `?`, and each is validated only when present.

| field | shape | why |
|---|---|---|
| `ImageCandidate.modelId` | `string?` | which model produced it; the two differ enough that guessing is a fabricated provenance record |
| `ImageCandidate.resolution` | `string?` | `1K` or `2K`; 4K rejected |
| `ImageCandidate.generatedAt` | `string?` | ISO 8601, set when the bytes were written |
| `ImageCandidate.costUsd` | `number?` | what the image actually cost |
| `ImageCandidate.promptFingerprint` | `string?` | the cache entry the bytes live under |
| `ImageCandidate.metrics` | `CutoutMetrics \| null?` | §5.4's four metrics; null once the gate ran and produced nothing usable |
| `ImageCandidate.detectedText` | `DetectedText[] \| null?` | what OCR read; absent means the pass has not run |
| `ImageCandidate.textVerdict` | `TextVerdict \| null?` | whether that text is text this slot may show |
| `ImageCandidate.gate` | `CandidateGate \| null?` | the gate's verdict and why it failed, per candidate |
| `ImageSlot.promptModeVersion` | `number?` | which mode version composed the prompt |
| `Costs.spentUsd` | `number?` | cumulative money spent on the reel |
| `Costs.spentByStage` | `Record<string, number>?` | the same, per stage |

`ImageSlot.presentation` was already nullable; session 6 gave it the rule that
it is set **only when every candidate agrees**, because it follows whichever
candidate the editor picks.

## Not amendments, but load-bearing decisions recorded elsewhere

- **`IMAGE_COST_MULTIPLIER = 1.35`** (`core/src/pricing.ts`), a deliberately
  pessimistic gate on the `THINKING_TOKEN_MULTIPLIER` precedent, with all
  observed ratios listed at the constant. Twenty of twenty images billed over
  published.
- **The image ceiling is a running check** re-read from the ledger before
  every request, bounding a session rather than a call.
- **The BiRefNet model is pinned by sha256** (`tools/cv/models.json`), verified
  inside `npm run check`.
- **Gate thresholds are provisional and none has been refitted.** Declared
  before the corpus was measured, examined twice since, moved never.

## Open, for whoever rules on them

- **The gate's yield is 2/10.** Four candidates fail on `edge_halo` alone, and
  session 7 established those are genuine retained background rather than
  misclassified rim light. Raising the bound would admit real halo.
- **Four of sixteen images sit within one per cent of the halo bound**, one at
  0.4 per cent. A threshold deciding that finely is not doing real work on
  those images.
- **The multi-subject marker list is incomplete by construction** and misses
  `scientific molecular structures`.
- **`no watermark` and `no logo` have never been tested** as controls.
- **The ledger has no reel identifier**, so cumulative per-reel spend can only
  accumulate forward; it cannot be reconstructed for past runs.
