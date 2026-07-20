"""Backend configuration — typed settings loaded from a git-ignored .env (spec §16).

Design decisions (D-009, D-010, D-011):
- gemini_api_key is Optional[SecretStr] (not required) so a missing key does NOT crash
  import or startup. Absence is reported via GET /health keys_ok=false (boot-and-report).
- Both API keys use SecretStr so their values never appear in repr(), str(), logs, or
  tracebacks. The raw value is only available via .get_secret_value() — call this ONLY
  inside the code that actually sends the key (e.g. an HTTP client), never in logging paths.
- SERVER_HOST is NOT configurable here. It is hardcoded to "127.0.0.1" in main.py (§21).
  Putting host in config would risk someone setting it to 0.0.0.0 via .env — that must be
  structurally impossible, not just conventionally avoided.
"""

from __future__ import annotations

from functools import cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings read from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # API keys — both optional: a missing key is surfaced via /health, never a crash (D-009).
    gemini_api_key: SecretStr | None = None
    elevenlabs_api_key: SecretStr | None = None  # future hook

    # Server — host is NOT here by design (D-010 / §21)
    backend_port: int = 8000

    # Cost controls (§16.4)
    max_images_per_job: int = 8
    cheap_mode: bool = False
    cost_ceiling_usd: float = 5.0  # D-011: sane default for an internal two-operator tool


@cache
def get_settings(_env_file: str | None = None) -> Settings:
    """Return a (cached) Settings instance.

    Args:
        _env_file: Path to an env file to load. Defaults to ".env" (the production path).
                   Tests pass a fixture path here; the lru_cache key differs per path so
                   each fixture env gets its own cached instance without cross-contamination.

    Callers that want a fresh instance (e.g. after env mutation in tests) should call
    clear_settings_cache() before calling get_settings() again.
    """
    if _env_file is not None:
        return Settings(_env_file=_env_file)
    return Settings()


def clear_settings_cache() -> None:
    """Invalidate all cached Settings instances.

    Use this in tests so the next get_settings() constructs a fresh instance from the
    current environment rather than returning a stale cached one.
    """
    get_settings.cache_clear()
