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
npm run test --workspaces --if-present -- --run
npm run validate:modes --workspace @framopia/core

# Every reference file's declared version against a clean scorer pass. The
# `ground-truth` reference asserted v1.0.7 conformance for an entire block
# while violating v1.0.7, and `test-3` carried two standalone conjunctions
# that three hand-written token lists all missed, because nothing ever
# checked. See CLAUDE_CODE_GUIDELINES.md §3.
npm run verify-refs --workspace framopia-benchmarks

# The CV sidecar's metric tests. Skipped with a notice when the venv is not
# built: the sidecar needs python3.11 and a ~1GB model download, and a
# contributor without it should still be able to run the gate for the
# TypeScript workspaces. It is never skipped silently.
if [ -x tools/cv/.venv/bin/python ]; then
  (cd tools/cv && ./.venv/bin/python -m pytest -q)
else
  echo "check: SKIPPING sidecar tests — tools/cv/.venv missing, run tools/cv/setup.sh"
fi

echo "check: PASS"
