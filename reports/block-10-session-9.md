Status: OK

# Block 10 session 9 — one command that tells a cold machine what it is missing

**Spent $0.00; no API was called.** Ledger **118 lines, sha256
`3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`**,
byte-identical at both ends. `templates/library.aep` `1d7553e894…2dc4a5d8`.
All seven hand-made references identical. **All five Edit Plans identical.**
Cache identical at 46 entries / 55,363,681 bytes / 79 files, nothing created.
`app.fonts.allFonts` **1198 → 1198** — no phantom name was created.

`npm run doctor` runs **24 checks**, all green on this machine, and **21 of the
24 have been watched failing.**

## 1. Done

### Preconditions (all nine pass)

Repo at the mount, one After Effects instance, no `aerender`, ledger 118 /
`3f657131…`, library `1d7553e8…`, branch `main` clean at `efd197d`, open project
`.local/build/test_3-full.aep` inside `.local/build/`, seven references
recorded, fonts 1198. No API key was printed, logged or written anywhere — the
doctor's own key check reports `present (value not shown)` and there is a unit
test that the redaction carries no part of the value.

### Deliverable A — the requirements, derived from the code

`docs/MACHINE_REQUIREMENTS.md`, commit `1921547`. **24 requirements**, each with
the file and line that needs it and what happens today when it is absent.

**Items found in the code that the brief did not name:**

| | why it matters |
|---|---|
| **`PlayerDebugMode` on `com.adobe.CSXS.10`–`13`** (`panel/scripts/install.mjs:37`) | an unsigned extension **will not load** without it; a fresh machine has it unset |
| **`panel/dist` built** (`panel/CSXS/manifest.xml` `MainPath`) | gitignored, so the panel opens blank on a fresh clone |
| **the rembg cutout model**, 972,666,916 bytes (`tools/cv/models.json`) | ~928 MiB fetched on the first cutout; the brief named only the segmentation model |
| **`xmllint`** (`core/src/manifest-check.ts:64`) | the panel-manifest gate degrades to a notice without it |
| **installed workspace dependencies** | `node_modules` is not in git |
| **the cost ledger** | append-only and irreplaceable; a fresh machine starts its own |

**And the one nothing in the repo checked at all: After Effects' "Allow Scripts
to Write Files and Access Network".** Every driven script writes its result to a
file for the caller to read back — `drive.ts` reads `.build-result.json` — so a
machine with that preference off produces *"After Effects wrote no result"* and
nothing that names the cause. It is **off by default on a fresh install** and
was checked nowhere before this session. Read on this machine: **on**.

**Two things recorded nowhere, both now stated in the document:**

- **`benchmarks/footage.json` carries no hash and no fetch note.** The only
  recorded hash for a reel is `source.sha256` on its own Edit Plan, so a machine
  with the wrong cut could discover it only by transcribing. The doctor checks
  against that and says where the figure came from.
- **No disk-space figure is stated anywhere.** The doctor's 20 GB is chosen, and
  the check says so in its own output.

### Deliverable B — the doctor

`npm run doctor` — `core/src/doctor.ts` (the decisions, 14 tests),
`tools/doctor/checks.ts` (the looking), `tools/doctor/probe.jsx` (the read-only
After Effects probe), `tools/doctor/cli.ts`. Commit `ff43d38`.

| rule | how |
|---|---|
| three states, never two | `present` / `absent` / **`unknown`**, and `summarise` never counts an unknown as a blocker. Two tests pin it. |
| a measured value beside every verdict | `ffmpeg 8.0.1 at /opt/homebrew/bin/ffmpeg`, not `ffmpeg ok`. An **absent** check reports where it looked; an **unknown** one reports what it could not reach. |
| exits non-zero and names what | `run` and `build` absences are blockers; `money`, `panel` and `dev` are not. Measured: degraded run **exit 1**, real run **exit 0**. |
| blocks-a-run vs blocks-part-of-one | the `blocking` field, printed and summarised. A missing watermark measurement is `money` and carries the note that the pipeline measures it itself; a missing cache is `money` and says it costs money, not correctness. |
| never prints a secret | `redact()` returns `present (value not shown)` and is a function a test calls, not a habit. |
| runs on a machine with nothing installed | every shell-out catches; the three After Effects checks degrade to `unknown`. **Proven** — see run 13 below. |
| the font caveat | reported, not certified: the output carries the phantom-name history and says to restart After Effects for a reading nothing could have polluted. |
| machine-readable output | `reports/doctor-<machine>.json`, carrying the schema version, the tool, the timestamp, and the machine's platform/release/arch/hostname/label, so two machines' files can be diffed line by line. |

**It reports and never repairs.** There is no `--fix`.

**One design decision worth naming.** Hashing the footage means reading five
2.4 GB reels — `readFileSync` refuses past 2 GiB, so the check streams in 1 MiB
chunks. It is **off by default** and `--hash-footage` turns it on; without it the
check says *"5 of 5 present; not hashed (--hash-footage does that)"* rather than
implying it verified something. Measured: **18.6 s** to hash all five, and all
five match.

### Deliverable C — every check watched failing

**21 of 24 proven.** Nothing real was moved, renamed or deleted: absence was
simulated with an environment override or a temporary empty directory in every
case, and the mechanism is named per row.

| check | how absence was simulated | what the doctor said | actionable |
|---|---|---|---|
| `ffmpeg` | `FRAMOPIA_DOCTOR_PATH` → empty dir | MISS · *not in .local/config.json, /opt/homebrew/bin, /usr/local/bin or PATH* | yes — `brew install ffmpeg, or set ffmpegPath` |
| `ffprobe` | same | MISS · same, naming `ffprobePath` | yes |
| `cv-venv` | `FRAMOPIA_DOCTOR_VENV` → nonexistent path | MISS · *nothing at …/python* | yes — `tools/cv/setup.sh` |
| `cv-packages` (cascade) | venv absent | **`????`** · *no interpreter to ask; the venv itself is missing* | yes, and correctly not a false absent |
| `cv-packages` (own) | `FRAMOPIA_DOCTOR_VENV` → system `python3` | MISS · *import failed: …* | yes |
| `model-selfie-multiclass-256x256` | `FRAMOPIA_DOCTOR_MODELS_DIR` → empty | MISS · *nothing at … (16 MiB expected)* | yes |
| `model-birefnet-general` | `FRAMOPIA_DOCTOR_REMBG_DIR` → empty | MISS · *nothing at … (928 MiB expected)* | yes |
| `templates` | `FRAMOPIA_DOCTOR_TEMPLATES_DIR` → empty | MISS · *nothing at …/library.aep* | yes |
| `after-effects` | `--no-after-effects` | **`????`** · *not asked* + *nothing here may launch After Effects* | yes |
| `ae-scripting` (unknown) | `--no-after-effects` | **`????`** · *not answering, so the preference could not be read* | yes |
| `ae-scripting` (absent) | injected `FRAMOPIA_DOCTOR_AE_STATE` with `scriptingAllowed: false` | MISS · *the preference is OFF; every driven script will fail to write its result file* | yes — names the exact Preferences path |
| `fonts` (unknown) | `--no-after-effects` | **`????`** · *After Effects is not answering, so nothing was checked* | yes |
| `fonts` (absent) | injected AE state listing one face | MISS · *missing: Almarai-Bold, CormorantGaramondItalic-SemiBoldItalic* | yes |
| `fonts` (no such client) | `--mode no-such-client` | **`????`** · *no-such-client did not load: ENOENT* | yes |
| `panel-installed` | `FRAMOPIA_DOCTOR_EXTENSIONS_DIR` → empty | MISS · *nothing at …/com.framopia.studio* | yes |
| `panel-built` | `FRAMOPIA_DOCTOR_PANEL_DIST` → missing file | MISS · *nothing at …/panel.js* | yes |
| `cep-debug-mode` | `FRAMOPIA_DOCTOR_PATH` → empty, so `defaults` is not found | MISS · *set on CSXS none; unset on 10, 11, 12, 13* | yes |
| `api-keys` (absent) | `FRAMOPIA_DOCTOR_LOCAL_DIR` → empty | MISS · *nothing at …/config.json* | yes |
| `api-keys` (unreadable) | a temp dir holding malformed JSON | **`????`** · *did not parse: Expected property name…* | yes, and correctly not a false absent |
| `watermark-facts` | `FRAMOPIA_DOCTOR_LOCAL_DIR` → empty | MISS, with the note that absent is **expected cold** | yes |
| `loudness-records` | same | MISS, same note | yes |
| `cache` | same | MISS · *absent costs money, not correctness* | yes |
| `ledger` | same | MISS · *append-only and irreplaceable* | yes |
| `footage` | `FRAMOPIA_DOCTOR_FOOTAGE_DIR` → empty | MISS · *0 of 5 present; missing: test-1, test-2, test-3, ground-truth, vitasilk* | yes |
| `disk` (absent) | `FRAMOPIA_DOCTOR_MIN_FREE_GB=999999` | MISS · *162.1 GB free* | yes |
| `disk` (unknown) | `FRAMOPIA_DOCTOR_PATH` → empty, so `df` is not found | **`????`** · *df did not run* | yes |
| `xmllint` | `FRAMOPIA_DOCTOR_PATH` → empty | MISS · *not on PATH*, with the note that it blocks nothing | yes |

**The whole-machine case**, with `PATH`, the venv, `.local` and the footage all
pointed at empty directories: **8 present, 11 absent, 5 could not be determined,
of 24**, exit **1**, five blockers named with their remedies, and the five
undetermined listed under *"could not be determined, which is not the same as
fine"*.

**Unit tests** cover `summarise`, `exitCodeFor`, `formatCheck`, `formatReport`
and `redact` — 14 in `core`. Everything that shells out is exercised by the runs
above rather than faked, which is why they are reported as runs and not as tests.

## 2. Deviations

1. **Three overrides were added mid-session** — `FRAMOPIA_DOCTOR_TEMPLATES_DIR`,
   `FRAMOPIA_DOCTOR_PANEL_DIST` and `FRAMOPIA_DOCTOR_AE_STATE` — because the
   checks they gate could otherwise only be falsified by moving
   `templates/library.aep`, deleting `panel/dist`, or changing the user's After
   Effects preference. All three are forbidden. The overrides are the mechanism
   that makes §3 possible without touching anything real.
2. **The footage hash is off by default.** Hashing 12 GB on every run would make
   the command something nobody runs. The check states which of the two it did.
3. **The models are checked by size, not sha256.** Hashing 928 MiB on every run
   is the same objection; `tools/cv/verify-models.sh` remains what hashes, and
   the check's own caveat says so.

## 3. Failures & open problems

**Nothing was destroyed or lost.** No file was moved, renamed or deleted; every
simulation used an override or a temporary directory. Ledger, plans, references,
cache, library all byte-identical.

### Three checks are unproven, by name

**`repo`, `node` and `dependencies`.** All three are unfalsifiable from inside a
working checkout: `REPO_ROOT` resolves from the module's own location at import
time, the node the doctor runs on is the node it reports, and `node_modules` is
what makes it runnable at all. Making any of them fail means moving something
real, which §3 forbids. **They have only ever been seen passing, and that is
exactly the shape this session exists to distrust** — the honest statement is
that they are untested, and the first cold machine tests all three at once.

### Every remedy is unverified

**All 24.** Not one remedy sentence was executed: doing so would install or
change something on this machine, which §4 forbids. The doctor marks each with
`(unverified remedy)` in its own output rather than letting them read like
instructions someone has checked. `npm run panel:install` and `tools/cv/setup.sh`
have been run in earlier blocks and are recorded as working there, but not by
this session and not against the state each remedy claims to fix.

### The three-state design has one hole worth naming

**An After Effects with the scripting preference off is indistinguishable from
one that is not answering.** The probe writes its result to a file, so if the
preference is off it cannot write, and the caller sees "wrote no result". The
doctor reports `unknown` and its reason says so in those words — but it cannot
tell the user *which* of the two it is, and the one it cannot rule out is the one
with a one-click fix.

### Other

- **The disk threshold of 20 GB is chosen**, not derived from anything in the
  repo. The check says so.
- **`benchmarks/footage.json` still has no fetch note.** The doctor can say a
  reel is missing but not where to get it; the sharing document is where that
  belongs, and this session does not write it.
- **The doctor has never run on a machine that is actually missing things.**
  Every absence was simulated. A second machine is the real test.
- **Untested:** the panel, CEP `evalScript`, the service's HTTP layer, the second
  machine. Every `DoScript` returned `0` first time.

## 4. Repo state

- Branch **`main`**. Commits: `1921547` *docs: inventory what the machine has to
  provide*, `ff43d38` *feat: one command that says what a machine is missing*,
  `87a8c92` *test: prove every doctor check by making it fail*, then the reports.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 43 | **644** |
| `framopia-service` | 90 | 1163 |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Core went 630 → 644 (14 doctor tests). **`extendscript: 14 .jsx file(s) ok`**,
  up from 13 — `tools/doctor/probe.jsx` is inside the gate. Other gates:
  `mode k2-syndicalia v12: ok` · `templates: 6 entries, ok` ·
  `validate-templates: 6 template(s) ok` · `validate:panel: ok` ·
  `references: PASS` · both model pins ok.
- **Ledger: 118 lines, sha256 `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`.**
- All-time spend **$12.365734**; **about $6.64 of credit remains**, unchanged.

## 5. Suggested next step

The doctor exists and 21 of its 24 checks have been watched failing, so the
sharing document can now be written around it rather than around a list someone
maintains by hand — *install these, then run `npm run doctor` until it exits
zero* is a sentence that is true, and the three unproven checks are exactly the
ones a second machine proves for free by being a second machine. The one thing
worth adding while writing it is a fetch note for the footage: the doctor can say
a reel is missing and cannot say where to get it, and `benchmarks/footage.json`
is the file that should carry that. Everything else here is deliberately
unverified — all 24 remedies are marked as such in the doctor's own output — and
the honest way to verify them is to run them on the machine that actually needs
them rather than to rehearse them on this one.
