#!/usr/bin/env bash
# Creates tools/cv/.venv and installs the pinned sidecar dependencies.
# Python 3.11 specifically: onnxruntime and the rembg stack have no wheels for
# 3.14, which is this machine's default python3.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PYTHON="${FRAMOPIA_PYTHON:-python3.11}"
if ! command -v "$PYTHON" >/dev/null; then
  echo "need $PYTHON on PATH (brew install python@3.11), or set FRAMOPIA_PYTHON" >&2
  exit 1
fi

"$PYTHON" -m venv .venv
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet -r requirements.txt
echo "sidecar: ready"
