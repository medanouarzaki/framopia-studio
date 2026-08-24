# CLAUDE.md

The repo lives on the external SSD at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`; the drive has to be
mounted before anything works. Test footage sits inside it under
`my files/test videos/` and is gitignored — never commit video or audio.

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
- `npm run bench:tag` — turn the hand-written `.local/ground-truth/*.txt`
  transcripts into tagged ground-truth JSON.
- `npm run bench:aggregate` — rescore every reel's latest run from disk (no
  API calls) into `benchmarks/RESULTS-block1.md`.

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

Block 1 is benchmarked and awaiting the freeze decision. Done: repo
scaffold, docs, the `service/` skeleton, the `benchmarks/` harness,
`docs/ORTHOGRAPHY_GUIDE.md` frozen at **v1.0.2** (freeze list extended from
all four ground-truth reels; §3a writes numbers as digits; §6 puts the whole
medical/aesthetic domain — procedures, anatomy, substances — in Arabic
script, brands and French technical terms excepted), the four reels catalogued in
`benchmarks/footage.json` with audio in `.local/bench-audio/`, hand-written
ground truth for all four reels in `.local/ground-truth/`, and a full live
sweep of all four engines over all four reels — scored under v1.0.1 in
`benchmarks/RESULTS-block1-runA.md` and rescored under v1.0.2 in
`benchmarks/RESULTS-block1.md`. The rescore is free (`npm run bench:aggregate`
reads stored outputs); no engine has been re-prompted with the v1.0.2 rules,
so the widened Arabic-script scope is not yet reflected in any engine output.

Two facts that shape everything downstream:

- **Scribe returns Darija in Arabic script, not Arabizi.** Transliteration
  is the Gemini pass's job; both Gemini prompts now carry explicit per-word
  script rules (`benchmarks/src/engines/script-rules.ts`).
- **Gemini bills thinking tokens at the output rate**, and on these reels
  thinking ran ~5x the visible output. `computeGeminiCost` counts them; any
  new Gemini caller must too, or it will under-report by ~5x.

Left in Block 1: pick and freeze a transcription config from the recorded
results. Panel, templates, and real job types are not started yet.

See `docs/BLOCKS.md` for the full block plan and `handoffs/` for prior
session context.
