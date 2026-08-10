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

## 4. Session report (mandatory, every session)

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
