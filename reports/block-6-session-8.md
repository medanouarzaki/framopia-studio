Status: OK

Block 6 is closed. The ambiguous validator message is rewritten, the three
guide amendments are applied, and the five deliberately-open items are recorded
where a future session will read them. No API call was made and nothing was
billed.

## Done

**Session-start checks.** T7 mounted, repo at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. `git status
--untracked-files=no` empty and the working tree fully clean. Ledger sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`,
**108 lines**. Session 7's commits were local and were **pushed**:
`origin/main` went `0cf2462` → `fb546d5`.

### Goal 1 — the ambiguous message

`core/src/templates.ts`. **New message, verbatim:**

```
comp "kw_slam" exceeds the intro+outro budget — reduce introS+outroS by 0.150s. Declared: introS 0.13 + outroS 0.15 = 0.280s. Allowed: 0.130s. See docs/TEMPLATE_BUILD_SPEC.md §4
```

**The fixture still exits 1**, confirmed, and the other six fixtures are
unchanged and still exit 1. The real library still passes.

Three things changed, and the reasoning is in a comment at the call site:

- **It leads with the action and a number that appears nowhere else** —
  `reduce introS+outroS by 0.150s`. That is the one figure the user acts on.
- **Declared values are quoted as authored, computed ones to three decimals.**
  `introS 0.13` against `Allowed: 0.130s` — the coincidence cannot be removed,
  since the budget and an addend can genuinely be the same number, so the two
  are given different precision and different roles.
- **The arithmetic is shown as an equation**, `0.13 + 0.15 = 0.280s`, which
  anchors each value as an addend or a total rather than leaving it to the
  reader.

**The other six were checked for the same defect and none has it.** A number
appearing twice with two meanings:

| message | numbers it carries | verdict |
|---|---|---|
| audit failed | none | clean |
| stale audit | two sha prefixes, labelled `audit` and `file` | clean — different values, both labelled |
| manifest id with no comp | none | clean |
| comp with no manifest entry | none | clean |
| missing placeholder | none | clean |
| wrong layer kind | none | clean |
| wrong fps | actual and required, separated by "is required" | clean |
| timings over duration | duration, floor, and the three named addends | clean — every addend carries its field name |

Nothing else was changed.

### Goal 2 — the guide amendments

`docs/TEMPLATE_LIBRARY_GUIDE.md`, all three applied plus the §5 note. Diff:

**§3 frame rate** — was "30 fps (matches footage — mandatory)":

> **Settings:** **29.97 fps** (30000/1001 — matches footage, mandatory).
> Square-pixel. Duration: at least intro + 2 s hold + outro; longer is fine,
> the system trims. The "30 fps" this section carried until Block 6 predates
> anyone reading a file header: every reel the project has handled is
> 30000/1001, and Block 5's frame sampling reads real presentation timestamps
> that diverge from a nominal 30 fps grid from the second frame onward.
> `npm run validate:templates` requires 29.97 and rejects 30.

**§3 comp size** — was "2160 wide × a sensible band height (e.g., 2160×600)":

> **Size:** subtitle/keyword comps: **2160×1100** — the comp is placed as a
> unit, so its size defines its footprint. The 2160×600 band this section
> suggested until Block 6 cannot hold a two-line keyword: Block 6 session 4
> measured the worst case, two lines at the keyword size in the Arabic face, at
> **1017.4 px** from the top of the ascent to the bottom of the descender.
> Image comps: 1200×1200 default working size (…).

**§5, two bullets added** after the intro/outro length guidance:

> - **`outroS` may be 0, and validation must accept it as a declared value
>   rather than a missing one.** With no fixed outro phase the structure is
>   intro + hold, the element hard-cuts at the end of its window, and the whole
>   budget goes to the entrance. `introS + minHoldS + outroS` is still what has
>   to fit inside the element's duration.
> - **The first template set declares `outroS: 0` on all six comps.** That is a
>   convention the user chose for fast-reel subtitles — a card cuts straight
>   into the next one — and not an oversight. It is also not a rule: a later
>   template may legitimately declare a non-zero `outroS`, provided
>   `introS + outroS` stays inside the same total. Block 6 measured that total
>   at **0.13 s, 4 frames at 29.97 fps**, from what the corpus can actually
>   carry; `docs/TEMPLATE_BUILD_SPEC.md` §4 records the measurement and what a
>   longer budget costs.

Each states the reason, not only the new value, and the second §5 bullet
answers the question the first invites — whether zero is now mandatory. It is
not.

### Goal 3 — what is left open

A new `CLAUDE.md` section, **"Block 6 is complete — deliberately left open"**,
with all five items, each pointing at the report carrying its reasoning:
whole-term grouping; the image cache over-invalidating on mode version, marked
**fix before Block 9**; the 4K-only pipeline; `assertRenderable` no longer
guarding while the SFX index is still a stub; and the validate-plan/timing-budget
discrepancy, which says plainly that **7 is the number and why**.

## Block 6 — closing figures

**`npm run check`: exit code 0, `check: PASS`.**
core 145 tests / 6 files, service 617 / 43, benchmarks 166 / 16 — **928
TypeScript tests**. pytest **141 passed**. `mode k2-syndicalia v6: ok (fonts
tbd)` and `validate-templates: 6 template(s) ok, audited against library.aep`
both run inside the gate.

**`templates/library.aep`** — **432,197 bytes**, sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`, unchanged
since it was committed in session 7.

**The manifest, `stub: false`:**

| id | type | placeholder | introS | outroS | minHoldS | anchor | presentation | sfx |
|---|---|---|---|---|---|---|---|---|
| `sub_pop` | subtitle | `TXT_MAIN` | 0.13 | 0 | 0.10 | center | null | `[]` |
| `sub_pop_ar` | subtitle | `TXT_MAIN` | 0.13 | 0 | 0.10 | center | null | `[]` |
| `kw_slam` | keyword | `TXT_MAIN` | 0.13 | 0 | 0.10 | center | null | `[]` |
| `kw_slam_ar` | keyword | `TXT_MAIN` | 0.13 | 0 | 0.10 | center | null | `[]` |
| `img_slide_left` | image | `IMG_MAIN` | 0.13 | 0 | 0.10 | center | `cutout` | `[]` |
| `img_float` | image | `IMG_MAIN` | 0.13 | 0 | 0.10 | center | `card` | `[]` |

**Ledger** — sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`,
**108 lines**, all-time **$10.968590**.
**Block 6 spend: $0.412818 over 3 lines**, all `analysis-keywords` in session 5,
all from `usageMetadata`. Seven of the block's eight sessions spent nothing.

**Files added or changed across sessions 1–8**, 32 commits from `10790a7`:

*Templates and validation (new this block)*
`templates/library.aep`, `templates/library.audit.json`,
`templates/manifest.json`, `tools/validate-templates/audit.jsx`,
`tools/validate-templates/cli.ts`

*Typography and placement*
`core/src/typography.ts`, `core/src/typography.test.ts`,
`service/src/placement/constants.ts`,
`service/src/placement/constants.test.ts`,
`service/src/placement/solve.test.ts`

*Grouping and terms*
`service/src/analysis/regroup.ts`, `service/src/analysis/regroup.test.ts`,
`service/src/analysis/terms.ts`, `service/src/analysis/terms.test.ts`,
`service/src/analysis/keywords.ts`, `service/src/analysis/keywords.test.ts`,
`service/src/analysis/job.ts`, `service/src/editplan/types.ts`,
`service/src/editplan/validate.ts`

*Timing budget*
`service/src/analysis/timing-budget.ts`,
`service/src/analysis/timing-budget-cli.ts`,
`service/src/analysis/timing-budget.test.ts`

*CV sidecar*
`tools/cv/framopia_cv/zones.py`, `tools/cv/framopia_cv/overlay.py`,
`tools/cv/tests/test_torso.py`, `service/src/frames/plan-zones.test.ts`

*Core plumbing*
`core/src/templates.ts`, `core/src/templates.test.ts`, `core/src/index.ts`,
`core/src/mode.test.ts`, `modes/k2-syndicalia.json`

*Docs and results*
`docs/TEMPLATE_BUILD_SPEC.md`, `docs/TEMPLATE_LIBRARY_GUIDE.md`,
`docs/PROJECT_SPEC.md`, `benchmarks/RESULTS-block6-timing-budget.md`,
`benchmarks/RESULTS-block6-band-repertoire.md`,
`benchmarks/RESULTS-block6-script-grouping.md`, `handoffs/block-5.md`,
`CLAUDE.md`, `reports/block-6-session-1.md` … `-8.md`, `reports/latest.md`

*Build and config*
`package.json`, `service/package.json`, `scripts/check.sh`, `.gitignore`

## Deviations

- **The unit test for the over-budget message was tightened rather than just
  updated.** It asserted a substring of the old wording; it now pins the
  action clause, the equation and the allowed value separately, so a future
  reword that reintroduces the ambiguity fails rather than passing on a loose
  regex.
- Nothing else. No new behaviour was designed this session.

## Failures and open problems

The five deliberate ones are in `CLAUDE.md` and are not repeated here. What is
genuinely unresolved:

- **The five messages that carry no numbers were judged clean by reading, not
  by test.** Only the over-budget message has assertions pinning its wording.
  A future edit to any of the others could reintroduce ambiguity silently.

- **The over-budget message is longer than the others** — four sentences
  against one. It is the clearest of the seven now and the least uniform;
  whether that trade is right is the user's call once they have seen it in
  anger.

- **`docs/PROJECT_SPEC.md` still says 30 fps.** Session 3 amended §5 for the
  Arabic font and subtitle geometry, and this session amended
  TEMPLATE_LIBRARY_GUIDE §3 for the frame rate, but the spec's own "30 fps"
  was not in scope for either and is now the last document stating it.
  **It should be amended before Block 7 reads it.**

- **Nothing has retimed a comp.** The validator proves the six comps match the
  manifest; no instance has been placed, stretched or rendered, so `outroS: 0`,
  the 29.97 fps timeline and the baseline anchor are all still assertions
  rather than observations.

- **The AE audit path is machine-specific and undiscovered.**
  `tools/validate-templates/cli.ts` names `Adobe After Effects 2026` in its
  AppleScript, and `-r` is known not to work here. A different machine or
  version needs that string changed by hand.

## Repo state

- Branch `main`, clean. **`origin/main` and local `main` are equal** — see the
  push note below.
- **HEAD at the time of writing is
  `7ed7724 docs: record what block 6 leaves open on purpose`**, preceded by
  `69579ba docs: amend the template guide for fps, comp size and outro` and
  `0c8717d fix: state the intro+outro overrun without reusing a number`.
  **The commit carrying this report follows HEAD and cannot be named here**,
  and the push that makes local and remote equal happens after it.
- **Ledger `.local/costs.jsonl`, session start and session end, identical:**
  sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`,
  **108 lines** at both ends. No billable call was made.
- **`templates/library.aep` sha256 unchanged:**
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

## Suggested next step

Block 7 is the builder, and the smallest useful first move is unchanged from
session 7's suggestion: place one `sub_pop` instance on one reel and look at
it. That single instance settles four things this block could only assert —
that `outroS: 0` retimes with no outro phase, that a 29.97 fps comp lands on a
29.97 fps timeline without drift, that the baseline anchor at y 2480.4 puts
type where session 3's arithmetic says, and that a solid `IMG_MAIN` accepts a
replaced source. Drive it over `DoScript` into a running After Effects, since
`-r` is known not to work here and that constraint should shape the builder
rather than be rediscovered inside it. Two things are worth doing before the
first build rather than after: amend PROJECT_SPEC's "30 fps", which is now the
last document carrying the wrong figure, and fix the image cache's
`modeVersion` keying — it is a small change today and becomes an expensive one
the moment a font lands at Block 9 and strands every cached image on every reel.
