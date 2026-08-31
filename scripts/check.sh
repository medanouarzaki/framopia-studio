#!/usr/bin/env bash
# The regression gate. Exit status is the only thing callers should read.
#
# Block 2 session 5 committed on a red check because the caller inferred
# success from `npm run check | grep -E "Tests"` — grep matched the error
# line and exited 0. Nothing here pipes, so no exit status can be masked, and
# the final line prints only on success: a caller that greps for
# "check: PASS" gets a correct answer even though grepping is the wrong
# habit.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

npm run build:core
npm run typecheck --workspaces --if-present
npm run lint --workspaces --if-present
# `--run` is not appended here: every workspace's own `test` script carries it,
# and vitest refuses the flag twice. `test:watch` is the watching one.
npm run test --workspaces --if-present
npm run validate:modes --workspace @framopia/core

# Every .jsx, parsed before it can reach After Effects. ExtendScript's reserved
# word list is Java's, and a file that will not parse measures nothing — which
# is how `short` and `long` as object keys reached the user's hands.
node scripts/check-extendscript.mjs

# TEMPLATE_LIBRARY_GUIDE §9: the manifest against what is really in the .aep.
# Validates the committed audit, and refuses it if the .aep has changed since.
npx tsx tools/validate-templates/cli.ts

# The CEP manifest must parse. A malformed one passes every test in this repo
# and fails silently at launch: After Effects drops the extension and says so
# only in a CEP log. Block 8 session 6 lost the panel to a `--` inside a
# comment.
npx tsx tools/validate-panel/cli.ts

# The hand-made references: present, readable and parseable, then each
# transcript's declared version against a clean scorer pass. The two are
# different questions — absent is a lost file that nothing can regenerate,
# non-conformant is a text to correct — and the gate says which.
#
# The version half exists because the `ground-truth` reference asserted v1.0.7
# conformance for an entire block while violating v1.0.7, and `test-3` carried
# two standalone conjunctions that three hand-written token lists all missed.
# The presence half exists because Block 10 session 12 found that a deleted
# transcript failed only as an uncaught ENOENT and a deleted alignment
# reference failed nothing at all. See CLAUDE_CODE_GUIDELINES.md §3.
npm run verify-refs --workspace framopia-benchmarks

# The CV sidecar's metric tests. Skipped with a notice when the venv is not
# built: the sidecar needs python3.11 and a ~1GB model download, and a
# contributor without it should still be able to run the gate for the
# TypeScript workspaces. It is never skipped silently.
if [ -x tools/cv/.venv/bin/python ]; then
  (cd tools/cv && ./.venv/bin/python -m pytest -q)
  # Model weights against their pinned checksums. A not-yet-downloaded model
  # exits 2 and is not a failure; a mismatch exits 1 and is.
  tools/cv/verify-models.sh || [ "$?" -eq 2 ]
else
  echo "check: SKIPPING sidecar tests — tools/cv/.venv missing, run tools/cv/setup.sh"
fi

echo "check: PASS"
