from pathlib import Path

import pytest

from mts.load_data import MTSDataError, load_data

FIXTURES = Path(__file__).parent / "fixtures"
V2_SAMPLES = FIXTURES / "v2_samples"


def test_loads_exact_column_names_without_a_map() -> None:
    df = load_data(V2_SAMPLES / "sample_1_clean.csv")
    assert len(df) == 10
    assert set(df.columns) >= {"metric_name", "timestamp", "value", "sample_size"}


def test_column_map_renames_before_validation() -> None:
    df = load_data(
        V2_SAMPLES / "sample_6_renamed_columns.csv",
        column_map={
            "metric_name": "description",
            "timestamp": "date",
            "value": "score",
            "sample_size": "n",
        },
    )
    assert len(df) == 10
    assert set(df["metric_name"]) == {"eval_accuracy"}
    assert df["value"].iloc[0] == 92.1
    assert df["sample_size"].iloc[0] == 200


def test_column_map_without_optional_sample_size() -> None:
    df = load_data(
        V2_SAMPLES / "sample_6_renamed_columns.csv",
        column_map={"metric_name": "description", "timestamp": "date", "value": "score"},
    )
    assert "sample_size" not in df.columns


def test_missing_column_error_lists_found_and_expected() -> None:
    with pytest.raises(MTSDataError) as exc_info:
        load_data(V2_SAMPLES / "sample_6_renamed_columns.csv")
    message = str(exc_info.value)
    assert "Missing required column(s)" in message
    assert "description" in message  # found columns are listed
    assert "--map" in message  # points the user at the fix


def test_column_map_referencing_unknown_source_column_errors_clearly() -> None:
    with pytest.raises(MTSDataError, match="not found in the file"):
        load_data(
            V2_SAMPLES / "sample_6_renamed_columns.csv",
            column_map={"metric_name": "does_not_exist"},
        )
