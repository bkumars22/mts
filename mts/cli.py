"""MTS CLI entry point.

mts analyze --input metrics.csv
mts analyze --input metrics.json --output report.json
"""

import logging
from pathlib import Path

import typer

from mts.checks.completeness import check_completeness
from mts.checks.outlier_influence import check_outlier_influence
from mts.checks.sample_size import check_sample_size
from mts.load_data import MTSDataError, load_data
from mts.output.json_export import write_json_report
from mts.output.terminal import render_terminal_report
from mts.trust_score import compute_trust_score

app = typer.Typer(
    help="MTS - Metric Trust Score. Audits AI metric data for statistical trustworthiness."
)

VALID_MAP_CONCEPTS = {"metric_name", "timestamp", "value", "sample_size"}


def _parse_column_map(raw: str | None) -> dict[str, str] | None:
    """Parse --map's `concept=column,concept=column` syntax into a dict."""
    if not raw:
        return None

    mapping: dict[str, str] = {}
    for pair in raw.split(","):
        if "=" not in pair:
            raise MTSDataError(
                f"Invalid --map entry '{pair}' - expected concept=column, "
                f"e.g. metric_name=description"
            )
        concept, _, source = pair.partition("=")
        concept = concept.strip()
        source = source.strip()
        if concept not in VALID_MAP_CONCEPTS:
            raise MTSDataError(
                f"Unknown concept '{concept}' in --map - "
                f"expected one of {sorted(VALID_MAP_CONCEPTS)}"
            )
        if not source:
            raise MTSDataError(f"--map entry for '{concept}' is missing a column name")
        mapping[concept] = source

    sources = list(mapping.values())
    duplicates = sorted({s for s in sources if sources.count(s) > 1})
    if duplicates:
        raise MTSDataError(f"--map assigns the same column to more than one concept: {duplicates}")

    return mapping


@app.callback()
def main() -> None:
    """MTS - Metric Trust Score.

    A callback is registered here (even though it does nothing) so Typer
    keeps `analyze` as an explicit subcommand - with only one command
    registered, Typer would otherwise collapse it into the top-level
    invocation and `mts analyze --input ...` would stop working.
    """


@app.command()
def analyze(
    input: Path = typer.Option(..., "--input", help="CSV or JSON file of metric records."),
    output: Path | None = typer.Option(
        None, "--output", help="Also save a structured JSON report to this path."
    ),
    map: str | None = typer.Option(
        None,
        "--map",
        help="Column mapping for files that don't use the exact expected names, e.g. "
        "metric_name=description,timestamp=date,value=score",
    ),
    verbose: bool = typer.Option(False, "--verbose", help="Enable debug logging."),
) -> None:
    """Analyze a metrics file and print a trust score report."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.WARNING,
        format="%(name)s: %(message)s",
    )

    try:
        column_map = _parse_column_map(map)
        df = load_data(input, column_map=column_map)
    except MTSDataError as exc:
        typer.secho(f"Error: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc

    completeness_results = check_completeness(df)
    sample_size_results = check_sample_size(df)
    outlier_results = check_outlier_influence(df)

    reports = compute_trust_score(df, completeness_results, sample_size_results, outlier_results)

    render_terminal_report(reports)

    if output is not None:
        write_json_report(reports, output)
        typer.echo(f"Structured report written to {output}")


if __name__ == "__main__":
    app()
