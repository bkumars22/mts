"""Completeness check.

Uses the Data Completeness Ratio: (actual records / expected records) x 100.
The expected record count is derived from an EWMA (Exponentially Weighted
Moving Average, lambda=0.3) of the historical gap between consecutive
timestamps for each metric_name, so the baseline is trend-aware rather than
a flat average. Flags anything below the 95% industry-standard completeness
threshold.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import pandas as pd

logger = logging.getLogger("mts.checks.completeness")

EWMA_LAMBDA = 0.3
COMPLETENESS_THRESHOLD_PCT = 95.0


@dataclass
class CompletenessResult:
    metric_name: str
    flagged: bool
    skipped: bool
    completeness_ratio: float | None
    expected_records: float | None
    actual_records: int
    expected_gap_hours: float | None
    reason: str


def check_completeness(df: pd.DataFrame) -> list[CompletenessResult]:
    """Run the completeness check for every metric_name present in df."""
    return [
        _check_one_metric(str(metric_name), group)
        for metric_name, group in df.groupby("metric_name")
    ]


def _check_one_metric(metric_name: str, group: pd.DataFrame) -> CompletenessResult:
    group = group.sort_values("timestamp")
    timestamps = pd.to_datetime(group["timestamp"]).tolist()
    n = len(timestamps)

    if n < 2:
        return CompletenessResult(
            metric_name=metric_name,
            flagged=False,
            skipped=True,
            completeness_ratio=None,
            expected_records=None,
            actual_records=n,
            expected_gap_hours=None,
            reason="Insufficient history (<2 records) to assess completeness",
        )

    gaps_hours = [(timestamps[i] - timestamps[i - 1]).total_seconds() / 3600.0 for i in range(1, n)]

    ewma = gaps_hours[0]
    for gap in gaps_hours[1:]:
        ewma = EWMA_LAMBDA * gap + (1 - EWMA_LAMBDA) * ewma
    expected_gap_hours = ewma

    if expected_gap_hours <= 0:
        return CompletenessResult(
            metric_name=metric_name,
            flagged=False,
            skipped=True,
            completeness_ratio=None,
            expected_records=None,
            actual_records=n,
            expected_gap_hours=expected_gap_hours,
            reason="Expected reporting interval is zero or negative - cannot assess completeness",
        )

    window_hours = (timestamps[-1] - timestamps[0]).total_seconds() / 3600.0
    expected_records = window_hours / expected_gap_hours + 1
    completeness_ratio = n / expected_records * 100.0
    flagged = completeness_ratio < COMPLETENESS_THRESHOLD_PCT

    reason = (
        f"Completeness: {completeness_ratio:.1f}% "
        f"({n}/{expected_records:.0f} expected records, "
        f"based on EWMA-smoothed interval of {expected_gap_hours:.2f}h). "
        f"Threshold: {COMPLETENESS_THRESHOLD_PCT:.0f}%."
    )

    if flagged:
        logger.info("completeness check flagged %s: %s", metric_name, reason)

    return CompletenessResult(
        metric_name=metric_name,
        flagged=flagged,
        skipped=False,
        completeness_ratio=completeness_ratio,
        expected_records=expected_records,
        actual_records=n,
        expected_gap_hours=expected_gap_hours,
        reason=reason,
    )
