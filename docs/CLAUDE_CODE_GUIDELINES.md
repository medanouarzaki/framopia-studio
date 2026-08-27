# Framopia Studio — Claude Code Guidelines

Version: 1.0. Binding for every Claude Code session. Restated in short form in every prompt; this file is the full reference and lives in the repo.

## 1. No AI fingerprints (hard requirement)

The repository must read as the work of a competent human developer. Concretely:

**Commits**
- Never add "Generated with Claude Code", "Co-Authored-By: Claude", or any AI attribution, tool banner, or link in commit messages, PRs, or anywhere else. If the tooling injects a trailer, remove it before committing (configure it off; verify with `git log` before pushing).
- Conventional-commit style: `feat: …`, `fix: …`, `chore: …`, `docs: …`, `refactor: …`, `test: …`. Lowercase after the colon, imperative, ≤72-char subject, body only when it adds information.
- Small, coherent commits — one logical change each. No "WIP", no mega-commits, no commit that mixes formatting with logic.

**Code & comments**
- Comments only where a human would write one: non-obvious decisions, gotchas, protocol quirks (ES3! CEP! alpha interpretation!). Never narrate the obvious ("// loop over the words"), never leave "Here we…" / "As an AI…" / "Note that…" filler, never over-doc-comment trivial functions.
- No decorative section banners, no emoji in code or docs, no TODO litter (a TODO must carry a reason and land in the session report too).
- Naming and structure follow the surrounding code; consistency over personal style.

**A comment must not break the file it documents**
- Before writing a comment, know what the file's syntax forbids inside one. In **XML, `--` is illegal anywhere inside a comment** — name flags without their leading hyphens (`enable-nodejs`), or put the explanation outside the comment entirely.
- This is not pedantry. A comment above `<CEFCommandLine>` explaining `--enable-nodejs` and `--mixed-context` made `panel/CSXS/manifest.xml` unparseable; After Effects dropped the extension, it vanished from the Extensions menu, and the only evidence was `XPATH Double hyphen within comment` in a CEP log. Every test in the repo passed. `npm run validate:panel` now parses the manifest so it cannot happen twice.

**Docs**
- README.md: short, plain, factual. Setup, commands, structure. No marketing tone, no badges wall, no emoji headers.
- All repo docs in the same sober voice as `docs/`.

## 2. Stack conventions

- **TypeScript (panel + service):** strict mode on; ESLint + Prettier configured once in Block 1 and never fought; no `any` except at genuinely untyped boundaries (annotated with a one-line reason); Node built-ins over dependencies where reasonable — every new dependency needs a reason in the session report.
- **ExtendScript:** ES3 only — no `const`/`let`/arrow functions/`JSON` global (ship a bundled json2 shim), `var` and prototypes; every AE-DOM mutation wrapped so failures return structured `{ok:false, stage, message}` JSON strings to the panel; no logic that could live in the service.
- **Python sidecar:** 3.11+, pinned `requirements.txt`, pure stdin-JSON → stdout-JSON per invocation, no prints outside the JSON contract (logs to stderr).
- **Secrets:** never committed, never logged. Keys live only in `.local/config.json` (gitignored); `config.example.json` documents the shape.

## 3. Testing expectations

- Unit tests for all pure logic: alignment merge, grouping, cleaning rules, placement solver, cache keys, manifest validation. Vitest (service/panel logic), pytest (sidecar).
- Fixture-based tests for pipeline stages (recorded API responses; no live API calls in tests).
- `npm run check` = typecheck + lint + all unit tests + template validation (once it exists). It must pass before every session's final commit; from Block 2 on it runs at session end and its result goes in the report. From Block 10, `npm run golden` joins it per BLOCKS.md.
- Live-API smoke scripts exist but are manual, cost-labeled, and never part of `check`.

### A conformance claim is written by the checker, never by hand

A `# reference-version:` header in `.local/ground-truth/*.txt` is a machine
assertion that the file passes the orthography conformance scorer clean
against that guide version. It is written **only** by
`npm run bench:verify-refs -- --write`, and only after a clean pass. Never
hand-edit it, and never bump it as part of "also updating the header" while
editing the text.

`npm run check` verifies every reference against its declared version and
fails the build on a mismatch. Do not remove that step to get a commit
through: correct the text and re-stamp.

The rule exists because `ground-truth` asserted `v1.0.7-conformant` for an
entire block while violating v1.0.7 — the header was bumped by hand in the
same session that was supposed to make it true, and nothing looked afterwards.
`test-3` then carried two standalone conjunctions past three separate
hand-written token lists, each of which disagreed with the other two.

The general form, which applies past this one file: **anything that asserts a
property is verified must be emitted by the thing that verifies it.** A claim
a human can type is a claim nobody checks. When a document states that a
checker enforces a rule, confirm the checker actually implements it — §2 of
the orthography guide said the scorer flagged a standalone `w` for a full
version before that was true.

### Never leave a test asserting retired behaviour

A test is a statement that something is true. When a rule changes, a test that
still asserts the old one is a false statement the build reports as passing, and
it is worse than no test: the next person reads it as the current contract and
reasons from it.

Rewrite or delete it in the same change that retires the rule. A test kept for
the record needs its name and its comment to say that is what it is.

Block 7 session 11 found four of them at once, after the entrance-compression
rule stopped splitting its budget evenly between intro and outro. One was named
"only the sum is ever compared" — a rule that had been true, was no longer, and
was still green.

### A rule shared by more than one tool is pinned by a test

The repo already does this for a constant mirrored between TypeScript and the
Python sidecar: a test reads both and fails when they drift. **The same applies
to a rule with more than one implementation**, which is easier to miss, because
the second copy is arithmetic rather than a named value.

Session 11 reconciled the reporting tools with the builder by pointing them at
`cardMinimumDurationS`, ran the figures, and found them still disagreeing:
`sweepTemplate` in `timing-budget.ts` held its own copy of how the budget splits
between intro and outro, which had been harmless while the split did not matter
and became a second source of truth the moment it did. Six possible homes of the
arithmetic were searched before the right one was found, and only because the
numbers still disagreed after the first fix.

If a rule cannot be reduced to one declaration, the test that pins the copies
together is the next best thing. A comment saying "keep this in sync" is not.

### A tool that can write to the plan is not a diagnostic

A diagnostic reads and reports; if it is wrong, a document is wrong and
someone re-runs it. A tool with a write path changes the artifact the rest of
the pipeline is built on, and if it is wrong it corrupts state that nothing
downstream will question. The two are not the same kind of thing and must not
be built to the same standard.

**Any tool carrying a write path resolves its inputs by the same declared
rules as production code, and is tested as production code.** Never by
`readdir` order, never by "the first one that looks right", never by a rule
invented in the file itself.

`repair-source-text-cli.ts` sat among the diagnostics and picked its
transcription cache entry the way the two beside it did — the first
`transcription-*` directory the listing returned. Unlike them it carried
`--apply`. On `vitasilk` that listing returns the prompt v1 entry, so Block 7
session 7 wrote nine `sourceText` values from a configuration the plan was not
built from, into a committed plan, and reported `343/343 correct` while doing
it. The other four reels were untouched only because their listings happened
to return the pinned entry first.

Two things follow. A tool is classified by its write path, not by where it
lives or what it is called. And a tool that reports a success count is
reporting against whatever it read: `343/343` was true of the draft it had,
which was the wrong draft.

### A tool names the inputs it selected, in the artifact and not only on stdout

This is the sibling of the rule above about verified properties: that one says
a claim must be emitted by the thing that checks it, this one says a figure
must carry what produced it. **Every tool that selects among several possible
inputs prints what it selected and writes it into whatever artifact it
produces.** An entry id, a version, a sha — enough that a reader a month later
can reproduce the figure or discover they cannot.

`docs/DEFECT-alignment-script-mismatch.md` carried its figures for an entire
block before anyone noticed they were drawn from three different transcription
cache entries. Nothing was fabricated and no arithmetic was wrong; the
document simply never said which configuration each number described, and by
the time the question was asked the answer had to be recovered by re-deriving
every figure against every entry on disk. One figure could not be attributed
at all and is still open.

Terminal output does not satisfy this. It scrolls away, it is not committed,
and the artifact outlives the session that produced it.

## 4. Session report (mandatory, every session)

### A defect report names the state it destroyed

When a defect corrupts or deletes state — cache entries, generated files, a
plan, a ledger line — the report records **what was lost**, not only that the
defect happened and was fixed. Name the entries, the files, the count.

The next session starts from the report. If it says "the fix is unverified"
but not "and two cache entries are gone", that session plans a verification
run it cannot afford and discovers the gap only by probing. Block 4 session 3
reported its eviction fix as unverified and did not record that two image
entries had been deleted; session 4's first instruction was therefore
unrunnable, and finding that out consumed the opening of the session.

The same applies to state a fix cannot restore. Say so explicitly: an entry
that will never come back is a permanent change to what the repo can
reproduce, and it belongs in **Failures & open problems**, not only in a
narrative of what went wrong.

File: `reports/block-N-session-M.md`, committed. Sections, in order:
1. **Done** — deliverables actually completed, with file paths.
2. **Deviations** — anything done differently than the prompt, and why.
3. **Failures & open problems** — honest, including flaky tests and untested paths.
4. **Repo state** — branch, HEAD subject line, `npm run check` result.
5. **Suggested next step** — one paragraph.

Never claim success for anything not actually run. If a command wasn't executed, say so.

## 5. CLAUDE.md maintenance

`CLAUDE.md` at repo root is Claude Code's only persistent memory. Keep it current in the same session as the change: project one-liner, repo map, bootstrap + everyday commands, active conventions (including §1 of this file in condensed form), current pipeline status (which blocks done), and pointers to `docs/`. It must never describe a state the repo isn't in.

## 6. Safety rails

- Work on `main` unless a prompt says otherwise (two trusted users, no PR ceremony) — but never force-push, never rewrite pushed history.
- Never delete user assets (footage, templates, mode files) — even when asked to "clean up".
- Anything touching billable APIs prints an estimated cost before running and records actuals to the cost ledger.
