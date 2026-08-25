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

echo "check: PASS"
