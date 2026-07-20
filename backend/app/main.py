"""Framopia Studio backend — FastAPI application entry point."""

from fastapi import FastAPI

from app import __version__

# Server binding constants — the only place these are defined.
# T-005 will wire port to pydantic-settings; host is fixed to localhost by spec §21.
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000

app = FastAPI(title="Framopia Studio Backend", version=__version__)


@app.get("/health")
def health() -> dict:
    """Return service health. ffmpeg_ok and keys_ok are stubs until T-005."""
    return {
        "status": "ok",
        "version": __version__,
        "ffmpeg_ok": True,   # T-005: replace with real ffmpeg PATH check
        "keys_ok": True,     # T-005: replace with real GEMINI_API_KEY presence check
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=SERVER_HOST, port=SERVER_PORT, reload=True)
