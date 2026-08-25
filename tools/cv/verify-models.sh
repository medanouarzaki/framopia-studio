#!/usr/bin/env bash
# Verifies the sidecar's downloaded model weights against tools/cv/models.json.
#
# rembg fetches ~1GB to ~/.rembg/ on first use and checks nothing. A silently
# different model changes every matte the gate judges, which is the kind of
# drift a golden run on a second machine cannot diagnose from the repo.
#
# Exit 0 when every pinned model matches, 1 on a mismatch, 2 when a model has
# not been downloaded yet (run the sidecar once, or tools/cv/setup.sh).
# FRAMOPIA_MODELS_DIR points the check at a different models.json. It exists so
# the test suite can prove the mismatch branch rejects a tampered file, rather
# than reimplementing the comparison and asserting against itself.
set -uo pipefail
cd "${FRAMOPIA_MODELS_DIR:-$(dirname "${BASH_SOURCE[0]}")}"

status=0
while IFS=$'\t' read -r name file expected; do
  path="${file/#\~/$HOME}"
  if [ ! -f "$path" ]; then
    echo "models: $name NOT DOWNLOADED ($path)"
    [ "$status" -eq 0 ] && status=2
    continue
  fi
  actual="$(shasum -a 256 "$path" | cut -d' ' -f1)"
  if [ "$actual" = "$expected" ]; then
    echo "models: $name ok"
  else
    echo "models: $name MISMATCH" >&2
    echo "  expected $expected" >&2
    echo "  actual   $actual" >&2
    echo "  Delete $path and let the sidecar refetch, or update models.json if" >&2
    echo "  the change is intended and record why." >&2
    status=1
  fi
done < <(python3 - <<'PYEOF'
import json
for name, model in json.load(open("models.json"))["models"].items():
    print("\t".join([name, model["file"], model["sha256"]]))
PYEOF
)

exit "$status"
