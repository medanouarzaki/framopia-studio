#!/usr/bin/env bash
# Sets up the local Whisper baseline (Apple Silicon only). Creates a venv
# under benchmarks/whisper/.venv, installs mlx-whisper, and predownloads
# the large-v3 weights so the first benchmark run isn't a cold download.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install mlx-whisper

# mlx_whisper fetches weights from the Hugging Face Hub cache on first use;
# predownloading here just means the first real benchmark run isn't also a
# multi-GB download.
.venv/bin/python -c "
from huggingface_hub import snapshot_download
snapshot_download('mlx-community/whisper-large-v3-mlx')
print('large-v3 weights cached')
"
