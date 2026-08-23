import pandas as pd
from rich.console import Console

from mts.output.terminal import render_terminal_report
from mts.trust_score import HIGH, LOW, MEDIUM, MetricTrustReport


def _render(reports: list[MetricTrustReport]) -> str:
    console = Console(record=True, width=160)
    render_terminal_report(reports, console=console)
    return console.export_text()


def test_high_trust_metric_shows_no_reason_placeholder() -> None:
    reports = [
        MetricTrustReport(
            metric_name="eval_accuracy",
            latest_value=95.03,
            latest_timestamp=pd.Timestamp("2026-08-02T05:00:00"),
            trust_score=HIGH,
            reasons=[],
            notes=[],
        )
    ]
    text = _render(reports)
    assert "eval_accuracy" in text
    assert "HIGH" in text


def test_medium_trust_metric_shows_specific_reason() -> None:
    reports = [
        MetricTrustReport(
            metric_name="latency_ms",
            latest_value=890.0,
            latest_timestamp=pd.Timestamp("2026-08-01T21:00:00"),
            trust_score=MEDIUM,
            reasons=["Modified Z-score: 4.8 (threshold: 3.5)."],
            notes=[],
        )
    ]
    text = _render(reports)
    assert "MEDIUM" in text
    assert "Modified Z-score: 4.8" in text


def test_low_trust_metric_shows_all_reasons_and_notes_are_deduped() -> None:
    note = "sample_size column not provided - skipping sample size adequacy check"
    reports = [
        MetricTrustReport(
            metric_name="m1",
            latest_value=1.0,
            latest_timestamp=pd.Timestamp("2026-08-01T00:00:00"),
            trust_score=LOW,
            reasons=["reason one", "reason two"],
            notes=[note],
        ),
        MetricTrustReport(
            metric_name="m2",
            latest_value=2.0,
            latest_timestamp=pd.Timestamp("2026-08-01T00:00:00"),
            trust_score=LOW,
            reasons=["reason three"],
            notes=[note],  # same note on two metrics - must appear only once
        ),
    ]
    text = _render(reports)
    assert "reason one" in text
    assert "reason two" in text
    assert "reason three" in text
    assert text.count("sample_size column not provided") == 1
