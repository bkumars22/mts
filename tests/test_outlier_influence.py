from pathlib import Path

import pandas as pd

from mts.checks.outlier_influence import check_outlier_influence
from mts.load_data import load_data

FIXTURES = Path(__file__).parent / "fixtures"


def test_outliers_fixture_confirms_exactly_two_and_suppresses_the_moderate_point() -> None:
    df = load_data(FIXTURES / "sample_metrics_outliers.csv")
    results = check_outlier_influence(df)

    assert len(results) == 1
    result = results[0]
    assert result.metric_name == "latency_ms"
    assert not result.skipped
    assert result.flagged

    # Exactly the two far-out points (860, 890) should be confirmed by BOTH
    # methods — the moderate point (190) is flagged by IQR alone and must
    # be excluded, proving the cross-check suppresses a false positive.
    confirmed_values = sorted(o.value for o in result.confirmed_outliers)
    assert confirmed_values == [860.0, 890.0]
    assert 190.0 not in confirmed_values

    # The with-vs-without comparison must exclude only the confirmed
    # outliers, not any single-method candidate.
    assert result.mean_with is not None
    assert result.mean_without is not None
    assert (
        result.mean_with
        == sum(
            [
                195,
                198,
                200,
                202,
                197,
                199,
                201,
                203,
                196,
                200,
                198,
                204,
                199,
                202,
                197,
                201,
                199,
                203,
                190,
                209,
                860,
                890,
            ]
        )
        / 22
    )
    assert (
        result.mean_without
        == sum(
            [
                195,
                198,
                200,
                202,
                197,
                199,
                201,
                203,
                196,
                200,
                198,
                204,
                199,
                202,
                197,
                201,
                199,
                203,
                190,
                209,
            ]
        )
        / 20
    )

    assert result.pct_influence is not None
    assert result.pct_influence > 25.0  # clear inflation, matches ~30.8% hand-computed
    assert "inflating" in result.reason
    assert "2 flagged outlier(s)" in result.reason


def test_clean_fixture_has_no_confirmed_outliers() -> None:
    df = load_data(FIXTURES / "sample_metrics_clean.csv")
    results = check_outlier_influence(df)

    assert len(results) == 1
    result = results[0]
    assert not result.skipped
    assert not result.flagged
    assert result.confirmed_outliers == []


def test_insufficient_history_is_skipped_not_flagged() -> None:
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2026-08-01", periods=5, freq="h"),
            "metric_name": ["short_metric"] * 5,
            "value": [1.0, 2.0, 1.5, 2.5, 1.8],
        }
    )
    results = check_outlier_influence(df)

    assert len(results) == 1
    assert results[0].skipped
    assert not results[0].flagged
    assert results[0].note is not None
    assert "need >=10" in results[0].note
