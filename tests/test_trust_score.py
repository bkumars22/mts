from pathlib import Path

import pandas as pd

from mts.checks.completeness import CompletenessResult, check_completeness
from mts.checks.outlier_influence import (
    OutlierInfluenceResult,
    OutlierRecord,
    check_outlier_influence,
)
from mts.checks.sample_size import FlaggedRecord, SampleSizeResult, check_sample_size
from mts.load_data import load_data
from mts.trust_score import HIGH, LOW, MEDIUM, compute_trust_score

FIXTURES = Path(__file__).parent / "fixtures"


def _df_for(metric_name: str, value: float) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "timestamp": pd.to_datetime(["2026-08-01T00:00:00"]),
            "metric_name": [metric_name],
            "value": [value],
        }
    )


def _clean_completeness(metric_name: str) -> CompletenessResult:
    return CompletenessResult(
        metric_name=metric_name,
        flagged=False,
        skipped=False,
        completeness_ratio=100.0,
        expected_records=30.0,
        actual_records=30,
        expected_gap_hours=1.0,
        reason="Completeness: 100.0% (30/30 expected records, based on EWMA-smoothed "
        "interval of 1.00h). Threshold: 95%.",
    )


def _flagged_completeness(metric_name: str) -> CompletenessResult:
    return CompletenessResult(
        metric_name=metric_name,
        flagged=True,
        skipped=False,
        completeness_ratio=80.0,
        expected_records=30.0,
        actual_records=24,
        expected_gap_hours=1.2,
        reason="Completeness: 80.0% (24/30 expected records, based on EWMA-smoothed "
        "interval of 1.20h). Threshold: 95%.",
    )


def _clean_sample_size(metric_name: str) -> SampleSizeResult:
    return SampleSizeResult(
        metric_name=metric_name, skipped=False, median_sample_size=200.0, threshold=100.0
    )


def _flagged_sample_size(metric_name: str) -> SampleSizeResult:
    return SampleSizeResult(
        metric_name=metric_name,
        skipped=False,
        median_sample_size=200.0,
        threshold=100.0,
        flagged_records=[
            FlaggedRecord(
                timestamp=pd.Timestamp("2026-08-01T00:00:00"),
                sample_size=42,
                reason="Sample size: 42 records (50% of historical median 200 = 100). "
                "Below threshold.",
            )
        ],
    )


def _skipped_sample_size(metric_name: str) -> SampleSizeResult:
    return SampleSizeResult(
        metric_name=metric_name,
        skipped=True,
        median_sample_size=None,
        threshold=None,
        note="sample_size column not provided — skipping sample size adequacy check",
    )


def _clean_outlier(metric_name: str) -> OutlierInfluenceResult:
    return OutlierInfluenceResult(metric_name=metric_name, skipped=False)


def _flagged_outlier(metric_name: str) -> OutlierInfluenceResult:
    return OutlierInfluenceResult(
        metric_name=metric_name,
        skipped=False,
        confirmed_outliers=[
            OutlierRecord(
                timestamp=pd.Timestamp("2026-08-01T00:00:00"),
                value=890.0,
                modified_z=4.8,
                reason="Modified Z-score: 4.8 (threshold: 3.5).",
            )
        ],
        mean_with=261.0,
        mean_without=199.6,
        pct_influence=30.8,
        reason="Modified Z-score: 4.8 (threshold: 3.5). Average: 261.0. "
        "Without 1 flagged outlier(s): 199.6 — outliers are inflating this metric by 31%.",
    )


def test_zero_flags_yields_high() -> None:
    metric_name = "m"
    reports = compute_trust_score(
        _df_for(metric_name, 95.0),
        [_clean_completeness(metric_name)],
        [_clean_sample_size(metric_name)],
        [_clean_outlier(metric_name)],
    )
    assert len(reports) == 1
    assert reports[0].trust_score == HIGH
    assert reports[0].reasons == []


def test_one_flag_yields_medium_with_reason() -> None:
    metric_name = "m"
    reports = compute_trust_score(
        _df_for(metric_name, 95.0),
        [_flagged_completeness(metric_name)],
        [_clean_sample_size(metric_name)],
        [_clean_outlier(metric_name)],
    )
    assert len(reports) == 1
    assert reports[0].trust_score == MEDIUM
    assert len(reports[0].reasons) == 1
    assert "Completeness:" in reports[0].reasons[0]


def test_two_flags_yields_low_with_both_reasons() -> None:
    metric_name = "m"
    reports = compute_trust_score(
        _df_for(metric_name, 95.0),
        [_flagged_completeness(metric_name)],
        [_flagged_sample_size(metric_name)],
        [_clean_outlier(metric_name)],
    )
    assert len(reports) == 1
    assert reports[0].trust_score == LOW
    assert len(reports[0].reasons) == 2


def test_three_flags_yields_low_with_all_reasons() -> None:
    metric_name = "m"
    reports = compute_trust_score(
        _df_for(metric_name, 95.0),
        [_flagged_completeness(metric_name)],
        [_flagged_sample_size(metric_name)],
        [_flagged_outlier(metric_name)],
    )
    assert len(reports) == 1
    assert reports[0].trust_score == LOW
    assert len(reports[0].reasons) == 3


def test_skipped_check_does_not_count_as_a_flag() -> None:
    """A skipped check (e.g. no sample_size column) must never push the
    score down — it's a note, not a flag."""
    metric_name = "m"
    reports = compute_trust_score(
        _df_for(metric_name, 95.0),
        [_flagged_completeness(metric_name)],
        [_skipped_sample_size(metric_name)],
        [_clean_outlier(metric_name)],
    )
    assert len(reports) == 1
    # Only completeness is a real flag; sample_size is skipped, not flagged.
    assert reports[0].trust_score == MEDIUM
    assert len(reports[0].reasons) == 1
    assert len(reports[0].notes) == 1
    assert "sample_size column not provided" in reports[0].notes[0]


def test_end_to_end_gap_fixture_is_medium() -> None:
    df = load_data(FIXTURES / "sample_metrics_gap.csv")
    reports = compute_trust_score(
        df, check_completeness(df), check_sample_size(df), check_outlier_influence(df)
    )
    assert len(reports) == 1
    assert reports[0].trust_score == MEDIUM
    assert len(reports[0].reasons) == 1


def test_end_to_end_clean_fixture_is_high() -> None:
    df = load_data(FIXTURES / "sample_metrics_clean.csv")
    reports = compute_trust_score(
        df, check_completeness(df), check_sample_size(df), check_outlier_influence(df)
    )
    assert len(reports) == 1
    assert reports[0].trust_score == HIGH
    assert reports[0].reasons == []
