from pathlib import Path

from mts.checks.sample_size import check_sample_size
from mts.load_data import load_data

FIXTURES = Path(__file__).parent / "fixtures"


def test_low_sample_fixture_flags_tail_records() -> None:
    df = load_data(FIXTURES / "sample_metrics_low_sample.csv")
    results = check_sample_size(df)

    assert len(results) == 1
    result = results[0]
    assert result.metric_name == "eval_accuracy"
    assert not result.skipped
    assert result.flagged
    assert len(result.flagged_records) == 3

    flagged_sizes = sorted(r.sample_size for r in result.flagged_records)
    assert flagged_sizes == [42, 48, 55]

    assert result.median_sample_size == 200.0
    assert result.threshold == 100.0
    assert all("Below threshold" in r.reason for r in result.flagged_records)
    assert all("historical median 200" in r.reason for r in result.flagged_records)


def test_clean_fixture_has_no_flags() -> None:
    df = load_data(FIXTURES / "sample_metrics_clean.csv")
    results = check_sample_size(df)

    assert len(results) == 1
    result = results[0]
    assert not result.skipped
    assert not result.flagged
    assert result.flagged_records == []


def test_missing_sample_size_column_is_skipped_gracefully() -> None:
    # sample_metrics_outliers.csv has no sample_size column at all.
    df = load_data(FIXTURES / "sample_metrics_outliers.csv")
    results = check_sample_size(df)

    assert len(results) == 1
    result = results[0]
    assert result.skipped
    assert not result.flagged
    assert result.note is not None
    assert "sample_size column not provided" in result.note
