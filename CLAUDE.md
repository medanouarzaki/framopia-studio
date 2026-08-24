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
- `benchmarks/` — transcription benchmark harness (Scribe, Gemini, local
  Whisper baseline, Scribe+Gemini hybrid), scored on WER, orthography
  conformance, and cross-engine timestamp deviation. See `benchmarks/README.md`.
- `tools/cv/`, `tools/validate-templates/` — helper scripts (not started)
- `templates/`, `modes/` — AE templates and per-client config (not started)
- `assets/brand/`, `assets/watermark/`, `assets/sfx/` — shared assets (not started)
- `.local/` — machine-local config, secrets, run state (gitignored, never committed)

## Commands

- `npm run check` (repo root) — typecheck + lint + test for `service/` and
  `benchmarks/`. This is the regression gate; it must pass before any
  commit that touches code.
- Start the service: `npm run build --prefix service && npm run start --prefix service`.
  On start it writes `.local/service.json` with `{ port, token }`.
- Run the transcription benchmark: `npm run bench -- --audio <abs path>
  (--ground-truth <path.json> | --no-ground-truth)` (add `--dry-run` to
  exercise the harness against fixtures with no network calls, or `--yes` to
  skip the interactive cost confirmation). Paths resolve relative to
  `benchmarks/`, so pass absolute ones from the repo root. See
  `benchmarks/README.md` for the ground-truth format and full flag list.
  `benchmarks/whisper/setup.sh` installs the local Whisper baseline
  (Apple Silicon only, not run by `npm run check`).

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

Block 1 in progress. Done: repo scaffold, docs, the `service/` skeleton,
the `benchmarks/` harness, `docs/ORTHOGRAPHY_GUIDE.md` frozen at v1.0
(only the freeze-list extension is open, landing as v1.0.1 once ground
truth exists), the four test reels catalogued in `benchmarks/footage.json`
with audio extracted to `.local/bench-audio/`, the local Whisper baseline
installed and smoke-tested, and Scribe validated against the live API.

Left in Block 1: the user hand-writes ground truth using the kit in
`.local/ground-truth/`, then Gemini and hybrid run for real and a winning
transcription config is frozen. **Scribe returns Darija in Arabic script,
not Arabizi** — transliteration is the Gemini pass's job, which makes the
hybrid engine the presumed production shape rather than one option among
four. Panel, templates, and real job types are not started yet.

See `docs/BLOCKS.md` for the full block plan and `handoffs/` for prior
session context.
