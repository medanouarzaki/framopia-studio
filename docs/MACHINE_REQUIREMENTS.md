# What this project needs from the machine it runs on

Derived from the code, not from memory: every place the repo reaches outside
itself. `npm run doctor` checks this list and is the thing to run rather than
this document to read; the table exists so the two can be compared and so a new
requirement has somewhere to be recorded.

**Blocking** says what an absence stops. `run` blocks the pipeline, `build`
blocks the After Effects build only, `money` costs a re-purchase but stops
nothing, `dev` blocks the checks rather than the product.

| # | requirement | needed by | blocking | when absent today |
|---|---|---|---|---|
| 1 | the volume mounted at `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` | `core/src/paths.ts` `REPO_ROOT`, and `core/src/repo-root.ts` which verifies a candidate against `package.json` and the `service/`, `modes/`, `core/` directories | run | `RepoRootError` naming every candidate tried |
| 2 | node at the version `.nvmrc` pins | `core/src/node-path.ts` `resolveNodePath`; the panel spawns this binary directly because After Effects inherits no shell `PATH` | run | the panel reports a state; nothing is spawned |
| 3 | installed workspace dependencies | every workspace; `node_modules` is not in git | dev, run | module-not-found at first import |
| 4 | the CV venv interpreter at `tools/cv/.venv/bin/python` | `service/src/images/sidecar.ts:16` `SIDECAR_PYTHON`, `service/src/build/content-box.ts:17`, `service/src/build/build-reel-cli.ts:179` `MASK_PY` | build | `buildRequirements` refuses with `cv-sidecar`; face masks unreadable |
| 5 | the packages inside that venv | `tools/cv/requirements.txt`, imported by `framopia_cv.cli` | build | the sidecar exits non-zero on import |
| 6 | `ffmpeg` on `PATH` or in `.local/config.json` | `core/src/ffmpeg-path.ts`; used by `service/src/transcription/media.ts`, `service/src/frames/sample.ts`, `core/src/loudness.ts`, `benchmarks/src/audio.ts`, `tools/measure-watermark/cli.ts` | run | audio extraction, frame sampling and loudness all fail |
| 7 | `ffprobe`, resolved independently | the same resolver, `tool: 'ffprobe'` | run | geometry and watermark measurement fail |
| 8 | the segmentation model `tools/cv/models/selfie_multiclass_256x256.tflite`, sha256 `c6748b12…` | `tools/cv/models.json`; loaded by the `segment_person` task | build | `FrameAnalysisUnavailableError` names the model and `tools/cv/setup.sh` |
| 9 | the cutout model `~/.rembg/models/birefnet-general/birefnet-general.onnx`, sha256 `58f621f0…`, 972,666,916 bytes | `tools/cv/models.json`; rembg fetches it on first use | build | rembg downloads ~928 MiB on the first cutout |
| 10 | After Effects running, one instance | `service/src/build/drive.ts` `assertOneInstance`; AppleScript `DoScript` into the already-running app | build | `AeDriveError`; nothing may launch it |
| 11 | **After Effects' "Allow Scripts to Write Files and Access Network"** | every driven script writes its result to a file — `drive.ts` reads `.build-result.json` back | build | the script cannot write and `runJsx` reports that AE wrote no result. **Off by default on a fresh install and checked nowhere in the repo before this session.** |
| 12 | the three K2 faces by PostScript name — `Inter-SemiBold`, `Almarai-Bold`, `CormorantGaramondItalic-SemiBoldItalic` | `modes/k2-syndicalia.json` `fonts.postScriptNames`; `service/src/build/required-fonts.ts`; checked in AE by `panel/jsx/fonts.jsx` | build | `build-reel.jsx`'s `check-fonts` refuses by name — **and a name AE cannot resolve is accepted silently**, so the check is the only defence |
| 13 | `templates/library.aep` matching `templates/library.audit.json`'s `aepSha256` | `tools/validate-templates/cli.ts`, `core/src/templates.ts` | build | the validator refuses a stale audit |
| 14 | the panel symlinked into `~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio` | `panel/scripts/install.mjs:20` | panel | After Effects does not list the extension |
| 15 | `PlayerDebugMode` = 1 on `com.adobe.CSXS.10`–`13` | `panel/scripts/install.mjs:37`; an unsigned extension will not load without it | panel | the extension is present and refuses to load |
| 16 | `panel/dist` built | `panel/CSXS/manifest.xml` `MainPath`; gitignored | panel | the panel opens blank |
| 17 | `.local/config.json` with `googleApiKey` and `elevenLabsApiKey` | `core/src/config.ts` | run | `ConfigError` |
| 18 | `.local/build/watermark.json` | `service/src/build/measurements.ts`; gitignored | build | the pipeline measures it itself now, by spawning `tools/measure-watermark/cli.ts` — **so this is expected absent on a cold machine and is not a fault** |
| 19 | `.local/build/loudness/<stem>.json` | `service/src/build/measurements.ts`, `core/src/loudness.ts` | build | measured on the transcription stage, same as the watermark |
| 20 | the five source reels named by `benchmarks/footage.json` | `service/src/catalogue.ts`; out of git | run | the reel lists as catalogued-but-absent |
| 21 | `.local/cache/<video-sha256>/` entries | `service/src/transcription/cache.ts` `CACHE_ROOT` | money | every stage re-bills |
| 22 | `.local/costs.jsonl` | `core/src/cost-ledger.ts` | money | spend history is lost; the ledger is append-only and irreplaceable |
| 23 | free disk space | the cutout models alone are ~945 MiB; the corpus footage is 11.9 GB | run | downloads and caches fail part-way |
| 24 | `xmllint` | `core/src/manifest-check.ts:64`, for the panel manifest gate | dev | the gate prints a notice and does not fail |

## What is recorded nowhere

- ~~**`benchmarks/footage.json` carries no hash and no fetch note.**~~ **Closed
  in Block 10 session 10**: every reel now carries its `sha256` and `bytes`, and
  the file carries a `fetchNote` saying where the files come from. The doctor
  checks against that, with the reel's own Edit Plan as the fallback.
- ~~**No disk-space figure is stated anywhere in the repo.**~~ **Closed in the
  same session**: `MIN_FREE_GB` in `tools/doctor/checks.ts` is **19 GB**, derived
  from 14.6 GB measured across eleven components plus a quarter again, with the
  components listed at the constant.

## Known limitation

**A cache entry copied to another machine resolves correctly, and this was
measured rather than reasoned about.** `readTranscriptionCache` recomputes
`audioPath` from the entry's own directory, so the absolute path stored in the
manifest is provenance and is never read: an entry copied into a temporary
directory still hits, with its audio resolved from where it now lives.

**Every absolute path on every Edit Plan points inside the repository root** —
52 of them across the five plans, none outside. So the plans are portable **if
and only if the repository sits at the same absolute path on both machines**,
which is requirement 1 above and what the doctor's `repo` check looks for.
