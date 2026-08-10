# Framopia Studio

Internal After Effects automation tool for Framopia, a two-person Moroccan
video agency. It takes a finished talking-head reel and builds an AE
composition with animated subtitles (code-switched Darija/French/English),
emphasized-keyword animations, AI-generated contextual images, sound effects,
and a watermark overlay. Output is an editable AE project, not a rendered
video — a first-pass assistant, not a final cut.

## Repo structure

- `docs/` — locked project specification, architecture, and reference guides
- `handoffs/` — session handoff documents between blocks of work
- `reports/` — per-session work reports
- `panel/` — After Effects CEP panel (UI, CSXS manifest, JSX host scripts)
- `service/` — Node/TypeScript companion service the panel talks to
- `tools/cv/` — computer-vision helper scripts (negative-space detection)
- `tools/validate-templates/` — template validation tooling
- `templates/` — hand-made AE animation templates
- `modes/` — per-client style/mode configuration
- `assets/brand/`, `assets/watermark/`, `assets/sfx/` — shared brand assets
- `benchmarks/` — accuracy/cost benchmark fixtures and results
- `.local/` — machine-local config and secrets (gitignored)

## Setup

See `CLAUDE.md` for repo conventions and `docs/PROJECT_SPEC.md` for the full
specification.
