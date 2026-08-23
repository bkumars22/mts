"""Rich-based terminal output for trust score reports."""

from __future__ import annotations

from rich.console import Console
from rich.table import Table

from mts.trust_score import HIGH, LOW, MEDIUM, MetricTrustReport

SCORE_STYLE = {HIGH: "bold green", MEDIUM: "bold yellow", LOW: "bold red"}


def render_terminal_report(
    reports: list[MetricTrustReport], console: Console | None = None
) -> None:
    """Print a color-coded trust score table, plus any skipped-check notes."""
    console = console or Console()

    table = Table(title="MTS - Metric Trust Score", show_lines=True)
    table.add_column("Metric")
    table.add_column("Latest Value", justify="right")
    table.add_column("Trust Score", justify="center")
    table.add_column("Reason(s)")

    for report in reports:
        style = SCORE_STYLE.get(report.trust_score, "")
        reasons_text = "\n".join(report.reasons) if report.reasons else "-"
        table.add_row(
            report.metric_name,
            f"{report.latest_value:g}",
            f"[{style}]{report.trust_score}[/{style}]",
            reasons_text,
        )

    console.print(table)

    all_notes = [note for report in reports for note in report.notes]
    if all_notes:
        console.print()
        for note in dict.fromkeys(all_notes):  # de-dupe while preserving order
            console.print(f"[dim]i  {note}[/dim]")
