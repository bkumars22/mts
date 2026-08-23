"""Outlier influence check.

Primary method: Modified Z-Score (MAD-based) — NOT plain Z-score and NOT
IsolationForest for v1.

    Modified Z = 0.6745 * (x - median) / MAD
    where MAD = median(|x_i - median(x)|)

Flags |Modified Z| > 3.5, the NIST-recommended threshold for this method.
More robust to skewed production data than plain Z-score, and doesn't
require the training step IsolationForest needs — simpler and more
explainable in output.

Secondary cross-check: the IQR method (Q1 - 1.5*IQR to Q3 + 1.5*IQR). A
point is only a *confirmed* outlier if BOTH methods agree — this reduces
false positives from either method alone.

For confirmed outliers, the check also computes what the metric's mean
would be with vs. without them, to show actual influence rather than just
flag-and-stop.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

logger = logging.getLogger("mts.checks.outlier_influence")

MODIFIED_Z_THRESHOLD = 3.5
MIN_HISTORY_POINTS = 10
IQR_MULTIPLIER = 1.5


@dataclass
class OutlierRecord:
    timestamp: pd.Timestamp
    value: float
    modified_z: float
    reason: str


@dataclass
class OutlierInfluenceResult:
    metric_name: str
    skipped: bool
    note: str | None = None
    confirmed_outliers: list[OutlierRecord] = field(default_factory=list)
    mean_with: float | None = None
    mean_without: float | None = None
    pct_influence: float | None = None
    reason: str | None = None

    @property
    def flagged(self) -> bool:
        return bool(self.confirmed_outliers)


def check_outlier_influence(df: pd.DataFrame) -> list[OutlierInfluenceResult]:
    """Run the outlier influence check for every metric_name present in df."""
    return [
        _check_one_metric(str(metric_name), group)
        for metric_name, group in df.groupby("metric_name")
    ]


def _check_one_metric(metric_name: str, group: pd.DataFrame) -> OutlierInfluenceResult:
    n = len(group)

    if n < MIN_HISTORY_POINTS:
        return OutlierInfluenceResult(
            metric_name=metric_name,
            skipped=True,
            note=f"Insufficient history ({n} point(s), need >={MIN_HISTORY_POINTS}) "
            f"to assess outlier influence",
        )

    values = group["value"].to_numpy(dtype=float)
    timestamps = group["timestamp"].to_numpy()

    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median)))

    if mad == 0:
        return OutlierInfluenceResult(
            metric_name=metric_name,
            skipped=True,
            note="MAD is 0 (no variance in this metric's values) - cannot compute Modified Z-score",
        )

    modified_z = 0.6745 * (values - median) / mad
    z_flagged = np.abs(modified_z) > MODIFIED_Z_THRESHOLD

    q1, q3 = np.percentile(values, 25), np.percentile(values, 75)
    iqr = q3 - q1
    lower_bound = q1 - IQR_MULTIPLIER * iqr
    upper_bound = q3 + IQR_MULTIPLIER * iqr
    iqr_flagged = (values < lower_bound) | (values > upper_bound)

    # A point counts as a confirmed outlier only when BOTH methods agree.
    confirmed_mask = z_flagged & iqr_flagged

    if not confirmed_mask.any():
        return OutlierInfluenceResult(metric_name=metric_name, skipped=False)

    confirmed_outliers = [
        OutlierRecord(
            timestamp=pd.Timestamp(timestamps[i]),
            value=float(values[i]),
            modified_z=float(modified_z[i]),
            reason=f"Modified Z-score: {modified_z[i]:.1f} (threshold: {MODIFIED_Z_THRESHOLD}).",
        )
        for i in np.where(confirmed_mask)[0]
    ]

    mean_with = float(values.mean())
    mean_without = float(values[~confirmed_mask].mean())
    pct_influence = (mean_with - mean_without) / mean_without * 100.0

    max_abs_z = max(abs(o.modified_z) for o in confirmed_outliers)
    direction = "inflating" if pct_influence >= 0 else "deflating"
    reason = (
        f"Modified Z-score: {max_abs_z:.1f} (threshold: {MODIFIED_Z_THRESHOLD}). "
        f"Average: {mean_with:.1f}. Without {len(confirmed_outliers)} flagged outlier(s): "
        f"{mean_without:.1f} - outliers are {direction} this metric by {abs(pct_influence):.0f}%."
    )

    logger.info(
        "outlier_influence check confirmed %d outlier(s) for %s (influence: %.1f%%)",
        len(confirmed_outliers),
        metric_name,
        pct_influence,
    )

    return OutlierInfluenceResult(
        metric_name=metric_name,
        skipped=False,
        confirmed_outliers=confirmed_outliers,
        mean_with=mean_with,
        mean_without=mean_without,
        pct_influence=pct_influence,
        reason=reason,
    )
