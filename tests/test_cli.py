import json
from pathlib import Path

from typer.testing import CliRunner

from mts.cli import app

runner = CliRunner()
FIXTURES = Path(__file__).parent / "fixtures"


def test_analyze_clean_fixture_reports_high() -> None:
    result = runner.invoke(app, ["analyze", "--input", str(FIXTURES / "sample_metrics_clean.csv")])
    assert result.exit_code == 0
    assert "HIGH" in result.stdout


def test_analyze_gap_fixture_reports_medium_with_reason() -> None:
    result = runner.invoke(app, ["analyze", "--input", str(FIXTURES / "sample_metrics_gap.csv")])
    assert result.exit_code == 0
    assert "MEDIUM" in result.stdout
    assert "Completeness:" in result.stdout


def test_analyze_writes_json_report_when_output_given(tmp_path: Path) -> None:
    out_path = tmp_path / "report.json"
    result = runner.invoke(
        app,
        [
            "analyze",
            "--input",
            str(FIXTURES / "sample_metrics_outliers.csv"),
            "--output",
            str(out_path),
        ],
    )
    assert result.exit_code == 0
    assert out_path.exists()

    with open(out_path, encoding="utf-8") as f:
        payload = json.load(f)
    assert payload["metrics"][0]["metric_name"] == "latency_ms"
    assert payload["metrics"][0]["trust_score"] == "MEDIUM"


def test_analyze_missing_file_exits_nonzero_with_clear_error() -> None:
    result = runner.invoke(app, ["analyze", "--input", "does_not_exist.csv"])
    assert result.exit_code == 1
    assert "not found" in result.output


def test_analyze_missing_required_column_exits_nonzero(tmp_path: Path) -> None:
    bad_csv = tmp_path / "bad.csv"
    bad_csv.write_text("metric_name,value\nfoo,1\n", encoding="utf-8")

    result = runner.invoke(app, ["analyze", "--input", str(bad_csv)])
    assert result.exit_code == 1
    assert "Missing required column" in result.output
