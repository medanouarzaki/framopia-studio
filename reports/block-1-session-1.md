# Block 1, Session 1

## Done

- Cloned the existing private `framopia-studio` GitHub repo (it was not
  empty — see Deviations) to `~/dev/framopia-studio`, branch `main`.
- Full top-level layout created: `docs/`, `reports/`, `handoffs/`,
  `panel/{src,CSXS,jsx}`, `service/src/`, `tools/{cv,validate-templates}/`,
  `templates/`, `modes/`, `assets/{brand,watermark,sfx}/`, `benchmarks/`,
  `.local/`, with `.gitkeep` placeholders where a directory has no content
  yet.
- `.gitignore` covering `.local/`, `node_modules/`, `dist/`, logs, `.DS_Store`,
  `.env`, `tools/cv/.venv/`, video files (with a negation rule reserved for
  a future committed `assets/watermark/*.mov`), AE autosave folders/`*.aep~`.
- Copied the 7 foundation docs into `docs/` and `HANDOFF_00_FOUNDATION.md`
  into `handoffs/`. Wrote a short, plain `README.md`.
- `service/` package: TypeScript strict (`noUncheckedIndexedAccess` on),
  ESLint flat config (`recommended` + `typescript-eslint recommended`),
  Prettier defaults, Vitest. Root `package.json` with `npm run check`
  (typecheck + lint + test --run), which is green.
- Service skeleton in `service/src/`:
  - `config.ts` — loads and validates `.local/config.json`
    (`elevenLabsApiKey`, `googleApiKey`, `machineLabel`); throws a clear,
    field-listing error on missing file/field/empty value; accepts any
    non-empty Google key (warns, doesn't reject, on an unrecognized
    `AIza`/`AQ.` prefix) so the mid-rollout key format doesn't break it.
  - `server.ts` — binds to `127.0.0.1` on a random free port, writes
    `{ port, token }` to `.local/service.json` on start, requires
    `x-service-token` on every route except `GET /health`.
  - `jobs.ts` — in-memory job store (`pending → running → done/error`),
    one built-in `noop` type, structured 400 for unknown types.
  - `costs.ts` — `appendCost` writes JSON lines with an ISO timestamp to
    `.local/costs.jsonl`; `readCosts` totals by stage.
  - 14 unit/integration tests across the four modules, including a real
    HTTP server on an ephemeral localhost port for `server.test.ts`.
- `.local/config.json` created with empty-string placeholders (gitignored);
  `config.example.json` committed at repo root with placeholder values.
- `CLAUDE.md` written at repo root: one-liner, repo map, commands,
  conventions condensed from the guidelines, current status.
- `.nvmrc` pinned to `24` (installed Node is v24.14.1, current LTS).

## Deviations (what and why)

- **The GitHub repo already existed and was not empty.** It contained a
  substantially different prior implementation (Python/FastAPI backend,
  WhisperX, Gemini pipeline, ~19 commits, last pushed 2026-07-21) — not
  the Node/TypeScript companion-service architecture this session's brief
  describes. I stopped and asked before touching it. The user confirmed
  it is stale and should be overwritten. Before clearing it I pushed the
  old `main` tip to `archive/python-backend-2026-07-21` on origin as a
  recoverable backup, then replaced the working tree with the new
  scaffold via normal commits (no force-push, no history rewrite).
- **9 files existed in `~/Downloads/framopia-docs/`, not 8.** The brief
  said "the 7 foundation docs + HANDOFF_00_FOUNDATION.md." The extra file
  was `BLOCK_1_OPENING_PROMPT.md`, which is this session's own launch
  prompt, not reference documentation, so it was excluded. The remaining
  7 (`ARCHITECTURE.md`, `BLOCKS.md`, `CLAUDE_CODE_GUIDELINES.md`,
  `HANDOFF_PROTOCOL.md`, `ORTHOGRAPHY_GUIDE.md`, `PROJECT_SPEC.md`,
  `TEMPLATE_LIBRARY_GUIDE.md`) plus the handoff doc matched the expected
  count of 8 exactly, which supports this reading.
- **`npm audit` reports 5 dev-dependency advisories** (esbuild/vite, via
  vitest's transitive dependency chain) — all about vitest's dev server
  accepting requests from any origin, which only matters if that dev
  server is exposed; it isn't run here. Not fixed this session since the
  fix (`vitest@4`) is a breaking major-version bump; flagging for a
  deliberate upgrade later rather than doing it silently now.

## Failures & open problems

- None. `npm run check` is green and the live smoke test passed.

## Repo state

- Branch: `main`, ahead of `origin/main` by 6 commits before this push;
  `archive/python-backend-2026-07-21` also pushed as a backup of the prior
  content.
- Key commits (oldest to newest, this session):
  - `7d59767` chore: replace stale scaffold with framopia-studio layout
  - `e2c5f5b` docs: add foundation spec and handoff documents
  - `3b75b88` docs: add repo readme
  - `6fb714c` chore: set up TypeScript tooling for service package
  - `025b9eb` feat(service): add config loading, health server, jobs, cost ledger
  - `12f6785` docs: add repo operating memory (CLAUDE.md)
- `npm run check`: green (typecheck, lint, 14 tests across 4 files, all
  pass).
- Live smoke test (not faked): built the service, ran it, `curl /health`
  returned `{"ok":true,"version":"0.1.0"}`, an unauthenticated `POST /jobs`
  returned 401, a `noop` job created via the real HTTP API reached
  `status: "done"` on poll, then the server was stopped and build/run
  artifacts cleaned up.
- `git log` checked for AI attribution trailers (`co-authored`,
  `generated with`, `anthropic`) across this session's commits — none
  found.

## Suggested next step

Guided API-key acquisition (ElevenLabs Scribe access, Google AI Studio
key with billing) so `.local/config.json` has real values, then ffmpeg
audio extraction and the transcription benchmark harness — the remaining
Block 1 deliverables per `docs/BLOCKS.md`.
