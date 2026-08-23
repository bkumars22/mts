"""Sample size adequacy check.

Cochran's formula is the formal statistical basis for "how large should a
sample be" in survey methodology. For this tool's MVP, comparing each
record's sample_size against the historical median (per metric_name) is the
more practical, directly-implementable version — a deliberate tradeoff, not
an oversight.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import pandas as pd

logger = logging.getLogger("mts.checks.sample_size")

MEDIAN_FRACTION_THRESHOLD = 0.5
SAMPLE_SIZE_COLUMN = "sample_size"


@dataclass
class FlaggedRecord:
    timestamp: pd.Timestamp
    sample_size: float
    reason: str


@dataclass
class SampleSizeResult:
    metric_name: str
    skipped: bool
    median_sample_size: float | None
    threshold: float | None
    flagged_records: list[FlaggedRecord] = field(default_factory=list)
    note: str | None = None

    @property
    def flagged(self) -> bool:
        return bool(self.flagged_records)


def check_sample_size(df: pd.DataFrame) -> list[SampleSizeResult]:
    """Run the sample size adequacy check for every metric_name present in df.

    If the sample_size column isn't present at all, returns one skipped
    result per metric_name with a clear note — graceful degradation, never
    a crash or a silent no-op.
    """
    if SAMPLE_SIZE_COLUMN not in df.columns:
        note = "sample_size column not provided - skipping sample size adequacy check"
        logger.info(note)
        return [
            SampleSizeResult(
                metric_name=str(metric_name),
                skipped=True,
                median_sample_size=None,
                threshold=None,
                note=note,
            )
            for metric_name in df["metric_name"].unique()
        ]

    return [
        _check_one_metric(str(metric_name), group)
        for metric_name, group in df.groupby("metric_name")
    ]


def _check_one_metric(metric_name: str, group: pd.DataFrame) -> SampleSizeResult:
    median_sample_size = float(group[SAMPLE_SIZE_COLUMN].median())
    threshold = MEDIAN_FRACTION_THRESHOLD * median_sample_size

    flagged_records = []
    for _, row in group.iterrows():
        sample_size = row[SAMPLE_SIZE_COLUMN]
        if sample_size < threshold:
            reason = (
                f"Sample size: {sample_size:.0f} records "
                f"(50% of historical median {median_sample_size:.0f} = {threshold:.0f}). "
                f"Below threshold."
            )
            flagged_records.append(
                FlaggedRecord(timestamp=row["timestamp"], sample_size=sample_size, reason=reason)
            )

    if flagged_records:
        logger.info(
            "sample_size check flagged %d record(s) for %s", len(flagged_records), metric_name
        )

    return SampleSizeResult(
        metric_name=metric_name,
        skipped=False,
        median_sample_size=median_sample_size,
        threshold=threshold,
        flagged_records=flagged_records,
    )
