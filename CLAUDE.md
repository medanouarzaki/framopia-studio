# CLAUDE.md

Operating memory for Claude Code sessions on this repo. Keep this file in
sync with what actually exists — update it at the end of every session.

## What this is

Framopia Studio: an internal After Effects automation tool for a
two-person Moroccan video agency. It turns a finished talking-head reel
into an AE composition with animated subtitles, emphasized keywords,
AI-generated contextual images, SFX, and a watermark. Full spec in
`docs/PROJECT_SPEC.md`.

## Repo map

- `docs/` — locked spec, architecture, orthography, template library guide
- `handoffs/` — session handoff documents
- `reports/` — per-session work reports
- `panel/` — After Effects CEP panel (not started)
- `service/` — Node/TypeScript companion service
- `tools/cv/`, `tools/validate-templates/` — helper scripts (not started)
- `templates/`, `modes/` — AE templates and per-client config (not started)
- `assets/brand/`, `assets/watermark/`, `assets/sfx/` — shared assets (not started)
- `benchmarks/` — accuracy/cost benchmarks (not started)
- `.local/` — machine-local config, secrets, run state (gitignored, never committed)

## Commands

- `npm run check` (repo root) — typecheck + lint + test for `service/`. This
  is the regression gate; it must pass before any commit that touches code.
- Start the service: `npm run build --prefix service && npm run start --prefix service`.
  On start it writes `.local/service.json` with `{ port, token }`.

## Conventions (binding — see docs/CLAUDE_CODE_GUIDELINES.md)

- No AI attribution anywhere: no "Generated with Claude Code", no
  "Co-Authored-By: Claude", no AI-tool banners in commits, code, or docs.
- Conventional commits: `feat: …`, `fix: …`, `chore: …`, `docs: …`,
  `test: …`. Lowercase after the colon, imperative mood, subject ≤72 chars.
  Small, coherent commits.
- Comments only where a human would write one — explain non-obvious why,
  never what. No decorative banners, no emoji anywhere.
- Secrets (API keys, tokens) live only in `.local/`, which is gitignored.
  Never log secret values. `config.example.json` at repo root documents
  the shape of `.local/config.json` with placeholder values.

## Status

Block 1 in progress: repo scaffold, docs, and the `service/` skeleton
(config loading, health endpoint, in-memory job framework, cost ledger)
are done. Benchmarks, panel, templates, and real job types are not
started yet.

See `docs/BLOCKS.md` for the full block plan and `handoffs/` for prior
session context.
