"""Framopia Studio backend — FastAPI application entry point."""

import shutil

from fastapi import FastAPI

from app import __version__
from app.config import get_settings

# SERVER_HOST is hardcoded and NOT sourced from config (spec §21 / D-010).
# Binding to anything other than 127.0.0.1 must be structurally impossible,
# not just conventionally avoided. SERVER_PORT comes from Settings.backend_port.
SERVER_HOST = "127.0.0.1"

app = FastAPI(title="Framopia Studio Backend", version=__version__)


@app.get("/health")
def health() -> dict:
    """Return service readiness. Checks ffmpeg on PATH and Gemini key presence."""
    settings = get_settings()
    ffmpeg_ok: bool = shutil.which("ffmpeg") is not None
    keys_ok: bool = (
        settings.gemini_api_key is not None
        and len(settings.gemini_api_key.get_secret_value()) > 0
    )
    return {
        "status": "ok",
        "version": __version__,
        "ffmpeg_ok": ffmpeg_ok,
        "keys_ok": keys_ok,
    }


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("app.main:app", host=SERVER_HOST, port=settings.backend_port, reload=True)
