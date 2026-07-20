"""Backend configuration.

# T-005: full config — pydantic-settings Settings class with:
#   - gemini_api_key (required)
#   - elevenlabs_api_key (optional, future)
#   - backend_port (default 8000, will replace SERVER_PORT in main.py)
#   - max_images_per_job (default 8)
#   - cheap_mode (bool, default False)
#   - cost_ceiling_usd (float)
# Also in T-005: CostMeter util, /health ffmpeg_ok and keys_ok real checks.
"""
