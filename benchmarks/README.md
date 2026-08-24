# Transcription benchmark harness

Compares transcription engines (ElevenLabs Scribe, Gemini, a local Whisper
baseline, and a Scribe+Gemini hybrid) against hand-written ground truth, and
scores WER, orthography conformance, and cross-engine timestamp deviation.
Nothing here makes a live API call except `npm run bench` itself, and that
requires an explicit `--yes` or an interactive confirmation after printing
estimated cost.

## Ground truth format

Hand-written, no timestamps by design — a human listens and types what they
hear, not when they heard it.

```json
{
  "words": [
    { "text": "wach", "lang": "darija", "script": "latin" },
    { "text": "salut", "lang": "fr", "script": "latin" }
  ]
}
```

`lang` is one of `darija` | `fr` | `en` | `msa`. `script` is `latin` |
`arabic`. See `docs/ORTHOGRAPHY_GUIDE.md` for the spelling conventions these
are checked against.

A plain-text source form is also accepted (one utterance per line): the
loader tokenizes it into words tagged `darija`/`latin` by default, for a
human to correct by hand afterwards.

## Running a benchmark

```
npm run bench -- --audio <path> (--ground-truth <path.json> | --no-ground-truth) \
  [--engines scribe,gemini,whisper,hybrid] [--keyterms <path.txt>] [--yes]
```

Paths are resolved relative to `benchmarks/`, so pass absolute paths when
invoking from the repo root.

`--no-ground-truth` runs the engines and skips WER scoring only; the raw
response, normalized JSON, plain-text transcript, cost record, spotcheck
HTML, and orthography conformance are still produced. Use it to validate
an engine's API shape before any ground truth exists.

`--audio` accepts a 16kHz mono WAV directly, or an mp4/mov that gets
extracted to `.local/bench-audio/` via ffmpeg first. Without `--yes`, the
runner prints per-engine cost estimates and asks for interactive
confirmation before any billable call.

`--dry-run` runs the full pipeline against `fixtures/` with no network
calls, useful for testing the harness itself.

Results land in `results/<timestamp>/` (gitignored): per-engine normalized
JSON, raw API responses, `report.md`, and spotcheck HTML pages for the
timestamp-bearing engines (scribe, whisper, hybrid — Gemini's timestamps
are self-reported by the model and not spot-checked separately here).

The reels this harness is calibrated against are catalogued in
`footage.json`; the videos themselves live on an external drive and are
never copied into the repo.

## Ground truth and aggregate scoring

`npm run bench:tag` (repo root) reads the hand-written transcripts in
`.local/ground-truth/<label>.txt` and writes `<label>.json` next to them,
tagging each word's lang and script: Arabic script becomes `msa`/`arabic`,
accents and elided articles plus a small embedded French/English lexicon
mark `fr`/`en`, and everything else defaults to `darija`. It prints the
fr/en words per reel so the tagging can be eyeballed in one pass.

`npm run bench:aggregate` pairs each reel with its most recent run under
`results/`, rescores every engine from the stored normalized JSON (no API
calls), and writes `RESULTS-block1.md` — per-reel tables plus a pooled
aggregate. Rescoring from disk means a scorer fix can be applied to an
existing sweep without paying for it twice.

## Local Whisper baseline

`whisper/setup.sh` creates `whisper/.venv` (gitignored) with `mlx-whisper`
and predownloads the `large-v3` weights. It's a free baseline for sanity,
not a production candidate — Apple Silicon only.
