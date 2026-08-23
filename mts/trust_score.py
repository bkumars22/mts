"""Combines the three check results into a single HIGH/MEDIUM/LOW trust
score per metric.

Combination rule:
  - All three checks clean (or skipped): HIGH
  - One check flagged: MEDIUM — show which, and why, with real numbers
  - Two or more checks flagged: LOW — show all reasons, with real numbers

A skipped check (e.g. sample_size column not provided, or not enough
history for the outlier check) never counts as a flag — it's surfaced as
an informational note instead, never silently dropped.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from mts.checks.completeness import CompletenessResult
from mts.checks.outlier_influence import OutlierInfluenceResult
from mts.checks.sample_size import SampleSizeResult

HIGH = "HIGH"
MEDIUM = "MEDIUM"
LOW = "LOW"


@dataclass
class MetricTrustReport:
    metric_name: str
    latest_value: float
    latest_timestamp: pd.Timestamp
    trust_score: str
    reasons: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def compute_trust_score(
    df: pd.DataFrame,
    completeness_results: list[CompletenessResult],
    sample_size_results: list[SampleSizeResult],
    outlier_results: list[OutlierInfluenceResult],
) -> list[MetricTrustReport]:
    """Combine per-metric check results with the input data's latest values."""
    completeness_by_metric = {r.metric_name: r for r in completeness_results}
    sample_size_by_metric = {r.metric_name: r for r in sample_size_results}
    outlier_by_metric = {r.metric_name: r for r in outlier_results}

    reports = []
    for metric_name, group in df.groupby("metric_name"):
        metric_name = str(metric_name)
        latest_row = group.sort_values("timestamp").iloc[-1]

        reasons: list[str] = []
        notes: list[str] = []
        flag_count = 0

        completeness = completeness_by_metric.get(metric_name)
        if completeness is not None:
            if completeness.skipped:
                notes.append(completeness.reason)
            elif completeness.flagged:
                flag_count += 1
                reasons.append(completeness.reason)

        sample_size = sample_size_by_metric.get(metric_name)
        if sample_size is not None:
            if sample_size.skipped:
                notes.append(sample_size.note or "sample_size check skipped")
            elif sample_size.flagged:
                flag_count += 1
                reasons.append(_sample_size_reason(sample_size))

        outlier = outlier_by_metric.get(metric_name)
        if outlier is not None:
            if outlier.skipped:
                notes.append(outlier.note or "outlier influence check skipped")
            elif outlier.flagged:
                flag_count += 1
                assert outlier.reason is not None
                reasons.append(outlier.reason)

        if flag_count == 0:
            trust_score = HIGH
        elif flag_count == 1:
            trust_score = MEDIUM
        else:
            trust_score = LOW

        reports.append(
            MetricTrustReport(
                metric_name=metric_name,
                latest_value=float(latest_row["value"]),
                latest_timestamp=latest_row["timestamp"],
                trust_score=trust_score,
                reasons=reasons,
                notes=notes,
            )
        )

    return reports


def _sample_size_reason(result: SampleSizeResult) -> str:
    """Surface the most recent flagged record's reason, noting the total
    count when more than one record was affected."""
    worst = max(result.flagged_records, key=lambda r: r.timestamp)
    count = len(result.flagged_records)
    suffix = f" ({count} records affected)" if count > 1 else ""
    return worst.reason + suffix
