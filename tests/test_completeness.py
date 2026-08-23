from pathlib import Path

from mts.checks.completeness import check_completeness
from mts.load_data import load_data

FIXTURES = Path(__file__).parent / "fixtures"


def test_clean_fixture_is_fully_complete() -> None:
    df = load_data(FIXTURES / "sample_metrics_clean.csv")
    results = check_completeness(df)

    assert len(results) == 1
    result = results[0]
    assert result.metric_name == "eval_accuracy"
    assert not result.skipped
    assert not result.flagged
    assert result.actual_records == 30
    assert result.completeness_ratio is not None
    assert result.completeness_ratio >= 99.0


def test_gap_fixture_is_flagged_below_threshold() -> None:
    df = load_data(FIXTURES / "sample_metrics_gap.csv")
    results = check_completeness(df)

    assert len(results) == 1
    result = results[0]
    assert result.metric_name == "eval_accuracy"
    assert not result.skipped
    assert result.flagged
    assert result.actual_records == 24
    assert result.completeness_ratio is not None
    assert result.completeness_ratio < 95.0
    # expected records should reflect the ~29-hour span at ~1h cadence
    assert result.expected_records is not None
    assert 28.0 <= result.expected_records <= 30.0
    assert "Completeness:" in result.reason
    assert "Threshold: 95%" in result.reason


def test_insufficient_history_is_skipped_not_flagged() -> None:
    import pandas as pd

    df = pd.DataFrame(
        {
            "timestamp": ["2026-08-01T00:00:00"],
            "metric_name": ["single_point"],
            "value": [1.0],
        }
    )
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    results = check_completeness(df)

    assert len(results) == 1
    assert results[0].skipped
    assert not results[0].flagged
