"""Tests for config loading, secret masking, and CostMeter (T-005)."""

from __future__ import annotations

import logging
from pathlib import Path

import pytest

from app.config import Settings, clear_settings_cache, get_settings
from app.util.cost import CostMeter

FIXTURE_ENV = Path(__file__).parent / "fixtures" / ".env.test"


# ---------------------------------------------------------------------------
# Settings loading from fixture env
# ---------------------------------------------------------------------------


def test_settings_load_from_fixture_env() -> None:
    """Settings read all fields correctly from the fixture .env.test file."""
    settings = Settings(_env_file=str(FIXTURE_ENV))

    assert settings.backend_port == 9999
    assert settings.max_images_per_job == 4
    assert settings.cheap_mode is True
    assert settings.cost_ceiling_usd == pytest.approx(2.50)
    # Key is present and readable via get_secret_value (not logged here)
    assert settings.gemini_api_key is not None
    assert settings.gemini_api_key.get_secret_value() == "test-key-not-real"


def test_settings_defaults_when_no_env() -> None:
    """Settings with no .env file falls back to coded defaults."""
    # _env_file set to a nonexistent path so no file is loaded.
    settings = Settings(_env_file="/nonexistent/.env")

    assert settings.backend_port == 8000
    assert settings.max_images_per_job == 8
    assert settings.cheap_mode is False
    assert settings.cost_ceiling_usd == pytest.approx(5.0)
    assert settings.gemini_api_key is None


# ---------------------------------------------------------------------------
# Missing key: no crash, surfaces via health
# ---------------------------------------------------------------------------


def test_missing_gemini_key_does_not_crash_import() -> None:
    """Settings with no gemini_api_key loads without raising (D-009: boot-and-report)."""
    settings = Settings(_env_file="/nonexistent/.env")
    assert settings.gemini_api_key is None  # None, not an exception


def test_missing_gemini_key_keys_ok_false() -> None:
    """When gemini_api_key is None, keys_ok check returns False (not a crash)."""
    settings = Settings(_env_file="/nonexistent/.env")
    keys_ok = (
        settings.gemini_api_key is not None
        and len(settings.gemini_api_key.get_secret_value()) > 0
    )
    assert keys_ok is False


# ---------------------------------------------------------------------------
# Secret masking: key never appears in repr/str/logs
# ---------------------------------------------------------------------------


def test_secret_key_not_in_repr() -> None:
    """The raw API key value is NOT visible in Settings repr or str."""
    settings = Settings(_env_file=str(FIXTURE_ENV))
    rendered = repr(settings)
    assert "test-key-not-real" not in rendered
    assert str(settings.gemini_api_key) != "test-key-not-real"


def test_secret_key_not_in_log_output(caplog: pytest.LogCaptureFixture) -> None:
    """Logging the Settings object does not expose the raw key value."""
    settings = Settings(_env_file=str(FIXTURE_ENV))
    with caplog.at_level(logging.DEBUG):
        logging.getLogger(__name__).debug("Settings: %s", settings)
    assert "test-key-not-real" not in caplog.text


def test_secret_key_only_via_get_secret_value() -> None:
    """The raw key is only accessible via .get_secret_value() — not str() or repr()."""
    settings = Settings(_env_file=str(FIXTURE_ENV))
    assert settings.gemini_api_key is not None
    # str() masks the value
    assert "test-key-not-real" not in str(settings.gemini_api_key)
    # get_secret_value() returns the real value
    assert settings.gemini_api_key.get_secret_value() == "test-key-not-real"


# ---------------------------------------------------------------------------
# get_settings() cache and cache_clear
# ---------------------------------------------------------------------------


def test_get_settings_returns_same_instance() -> None:
    """get_settings() with the same path returns the cached instance."""
    clear_settings_cache()
    a = get_settings(str(FIXTURE_ENV))
    b = get_settings(str(FIXTURE_ENV))
    assert a is b
    clear_settings_cache()


def test_clear_settings_cache_forces_fresh_load() -> None:
    """clear_settings_cache() causes the next get_settings() to construct a new instance."""
    clear_settings_cache()
    a = get_settings(str(FIXTURE_ENV))
    clear_settings_cache()
    b = get_settings(str(FIXTURE_ENV))
    assert a is not b  # different object after cache clear
    clear_settings_cache()


# ---------------------------------------------------------------------------
# CostMeter
# ---------------------------------------------------------------------------


def test_cost_meter_accumulates() -> None:
    """CostMeter.total() sums all add() calls correctly."""
    meter = CostMeter()
    meter.add(0.04)
    meter.add(0.002)
    meter.add(0.10)
    assert meter.total() == pytest.approx(0.142)


def test_cost_meter_does_not_exceed_ceiling() -> None:
    """exceeds_ceiling returns False when total is below the ceiling."""
    meter = CostMeter()
    meter.add(1.00)
    assert meter.exceeds_ceiling(5.0) is False


def test_cost_meter_exceeds_ceiling() -> None:
    """exceeds_ceiling returns True when total crosses the ceiling."""
    meter = CostMeter()
    meter.add(3.00)
    meter.add(2.01)
    assert meter.exceeds_ceiling(5.0) is True


def test_cost_meter_at_exactly_ceiling_not_exceeded() -> None:
    """exceeds_ceiling is False when total equals the ceiling exactly (strictly greater)."""
    meter = CostMeter()
    meter.add(5.0)
    assert meter.exceeds_ceiling(5.0) is False


def test_cost_meter_rejects_negative() -> None:
    """add() raises ValueError for a negative amount."""
    meter = CostMeter()
    with pytest.raises(ValueError, match="non-negative"):
        meter.add(-0.01)


def test_cost_meter_reset() -> None:
    """reset() zeroes the accumulated total."""
    meter = CostMeter()
    meter.add(1.5)
    meter.reset()
    assert meter.total() == pytest.approx(0.0)
    assert meter.exceeds_ceiling(0.5) is False
