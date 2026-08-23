import json
from pathlib import Path

import pandas as pd

from mts.output.json_export import to_json_dict, write_json_report
from mts.trust_score import HIGH, MEDIUM, MetricTrustReport


def _sample_reports() -> list[MetricTrustReport]:
    return [
        MetricTrustReport(
            metric_name="eval_accuracy",
            latest_value=95.03,
            latest_timestamp=pd.Timestamp("2026-08-02T05:00:00"),
            trust_score=HIGH,
            reasons=[],
            notes=[],
        ),
        MetricTrustReport(
            metric_name="latency_ms",
            latest_value=890.0,
            latest_timestamp=pd.Timestamp("2026-08-01T21:00:00"),
            trust_score=MEDIUM,
            reasons=["Modified Z-score: 4.8 (threshold: 3.5)."],
            notes=["sample_size column not provided - skipping sample size adequacy check"],
        ),
    ]


def test_to_json_dict_has_stable_schema() -> None:
    payload = to_json_dict(_sample_reports())

    assert set(payload.keys()) == {"metrics"}
    assert len(payload["metrics"]) == 2

    high = payload["metrics"][0]
    assert high["metric_name"] == "eval_accuracy"
    assert high["latest_value"] == 95.03
    assert high["latest_timestamp"] == "2026-08-02T05:00:00"
    assert high["trust_score"] == "HIGH"
    assert high["reasons"] == []
    assert high["notes"] == []

    medium = payload["metrics"][1]
    assert medium["trust_score"] == "MEDIUM"
    assert medium["reasons"] == ["Modified Z-score: 4.8 (threshold: 3.5)."]
    assert medium["notes"] == [
        "sample_size column not provided - skipping sample size adequacy check"
    ]


def test_write_json_report_produces_valid_json_file(tmp_path: Path) -> None:
    out_path = tmp_path / "report.json"
    write_json_report(_sample_reports(), out_path)

    assert out_path.exists()
    with open(out_path, encoding="utf-8") as f:
        loaded = json.load(f)

    assert loaded == to_json_dict(_sample_reports())
