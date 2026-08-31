/**
 * Commits whose messages carry an attribution trailer and cannot be corrected.
 *
 * `npm run check:attribution` found fourteen when it was first run, all
 * carrying `Co-Authored-By: Claude Sonnet 4.6` — and **all of them from
 * 2026-07-20 and 2026-07-21**, a superseded generation of this project with a
 * FastAPI backend and `T-1xx` ticket numbers, before the current architecture
 * existed. None is in a tracked file; every one is in a commit message.
 *
 * **They stay.** Removing them means rewriting pushed history, which
 * CLAUDE_CODE_GUIDELINES forbids without qualification, and the cost of
 * rewriting 687 commits of shared history to correct fourteen messages nobody
 * reads is out of all proportion to the fault. So they are listed here, dated,
 * with what they were — and everything not on this list fails.
 *
 * **This list is frozen.** A new entry is a new commit that broke the rule,
 * which is the thing the gate exists to prevent; the correct response is to fix
 * the commit before pushing, never to add it here. `attribution.test.ts` pins
 * the count.
 */
export const ATTRIBUTION_HISTORICAL_COMMITS: readonly string[] = [
  // 2026-07-20  feat(backend): FastAPI skeleton with /health, ruff + pytest
  '28bec1579894224f943e685be555a686be9d03f0',
  // 2026-07-20  feat(config): settings, secrets (SecretStr), cost meter, real /health
  '95957297595beb35b10ce8f3fb8c730d17e458e7',
  // 2026-07-20  feat(jobs): workspace, job manager, async stage runner (T-101)
  '987b1feeb33058156deac5cd6a74ba63608208c1',
  // 2026-07-20  chore: scaffold repo + state files
  'b16110c225cfd49d9ee1f934a97de5f78d9b5f0a',
  // 2026-07-20  test(models): lock bidi caption logical order (guard R2)
  'bc4598f609c9eef8b541514f0f39f779ee4429a5',
  // 2026-07-20  feat(models): Edit Plan schema, validator, golden example
  'f420ddc7e38166d35afa3c621ed22646e6121a6d',
  // 2026-07-21  feat(pipeline): add forced alignment stage (T-107)
  '147f55ee049c2ea119a00aeb710cb80067e371e8',
  // 2026-07-21  feat(api): add transcript correction gate (T-106)
  '1e1f376be58755332205442e0a9684a1e7253de6',
  // 2026-07-21  feat(pipeline): add ASR stage (T-105)
  '2709fdb8e6d710ee6127916a344be98639e38bb1',
  // 2026-07-21  feat(api): wire full pipeline + endpoints + live smoke (T-113)
  '80339387e617517dd0791e9f9062aa4ba6ab5928',
  // 2026-07-21  feat(pipeline): add understanding & segmentation stage (T-108)
  '8d7dc9b08a464efb6260151d9f29f7cd7c749e9b',
  // 2026-07-21  feat(pipeline): add ingest stage (T-102)
  'a1946b8e404008dc1423f6108c00b409a2aa610d',
  // 2026-07-21  feat(clients): add mockable Gemini client (T-104)
  'a7c52adc9aa9d0c043248804f2e19b6e447eb9f8',
  // 2026-07-21  feat(pipeline): add audio extraction stage and shared ffmpeg client (T-103)
  'be1b00eae9b988223c24964344856f1caf5a29f0',
];
