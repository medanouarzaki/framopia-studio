"""Per-job cost metering (spec §16.4).

Accumulates estimated USD spend across a job's API calls and enforces a
configurable ceiling. Intentionally dependency-light and free of I/O — the
caller drives it; the pipeline stages call add() after each billable call.

No secrets, keys, or PII ever pass through this module.
"""

from __future__ import annotations


class CostMeter:
    """Accumulate estimated USD spend for a single job.

    Usage::

        meter = CostMeter()
        meter.add(0.04)   # image generation
        meter.add(0.002)  # ASR call
        print(meter.total())          # 0.042
        print(meter.exceeds_ceiling(5.0))  # False
    """

    def __init__(self) -> None:
        self._total: float = 0.0

    def add(self, amount_usd: float) -> None:
        """Add a cost amount (in USD) to the running total.

        Args:
            amount_usd: Estimated cost of one billable operation. Must be >= 0.
        """
        if amount_usd < 0:
            raise ValueError(f"Cost amount must be non-negative, got {amount_usd}")
        self._total += amount_usd

    def total(self) -> float:
        """Return the accumulated spend in USD."""
        return self._total

    def exceeds_ceiling(self, ceiling_usd: float) -> bool:
        """Return True if the accumulated spend has exceeded ceiling_usd.

        Args:
            ceiling_usd: The spending limit in USD.
        """
        return self._total > ceiling_usd

    def reset(self) -> None:
        """Reset the meter to zero (e.g. for testing or reuse across retries)."""
        self._total = 0.0
