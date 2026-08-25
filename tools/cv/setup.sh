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

# rembg fetches BiRefNet itself on first use. The MediaPipe segmenter has no
# such path, so it is fetched here. The URL says 'latest', which is a moving
# pointer: the sha256 in models.json is what actually pins the weights, and a
# download that does not match it is refused rather than kept.
mkdir -p models
if [ ! -f models/selfie_multiclass_256x256.tflite ]; then
  curl -sSfL -o models/selfie_multiclass_256x256.tflite \
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
fi
# Exit 2 is "not downloaded yet", which is the normal state of BiRefNet on a
# fresh machine: rembg fetches it on first use. Only a mismatch is fatal.
./verify-models.sh || [ "$?" -eq 2 ]

echo "sidecar: ready"
