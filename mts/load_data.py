"""Load and validate a metric records file (CSV or JSON).

v1 reads a single local file — no live database connection yet, per the
MVP scope. Required columns: timestamp, metric_name, value. sample_size
and any other columns pass through untouched.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger("mts.load_data")

REQUIRED_COLUMNS = {"timestamp", "metric_name", "value"}


class MTSDataError(Exception):
    """Raised when the input file is missing or malformed in a way that
    blocks analysis. Always carries an actionable message — never a bare
    stack trace."""


def load_data(path: str | Path, column_map: dict[str, str] | None = None) -> pd.DataFrame:
    """Read a CSV or JSON file of metric records and return a validated,
    sorted DataFrame.

    Args:
        column_map: optional mapping of {concept: actual column name in the
            file}, e.g. {"metric_name": "description", "timestamp": "date"}.
            Applied (as a rename) before the required-column check, for
            files that don't use the exact expected column names.

    Raises:
        MTSDataError: if the file type is unsupported, the file can't be
            read, or a required column is missing.
    """
    path = Path(path)
    suffix = path.suffix.lower()

    if not path.exists():
        raise MTSDataError(f"Input file not found: {path}")

    if suffix == ".csv":
        df = pd.read_csv(path)
    elif suffix == ".json":
        df = pd.read_json(path)
    else:
        raise MTSDataError(f"Unsupported input file type '{suffix}' - expected .csv or .json")

    if column_map:
        missing_sources = [source for source in column_map.values() if source not in df.columns]
        if missing_sources:
            raise MTSDataError(
                f"--map references column(s) not found in the file: {sorted(missing_sources)}. "
                f"Columns in the file are: {sorted(df.columns)}."
            )
        df = df.rename(columns={source: concept for concept, source in column_map.items()})

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise MTSDataError(
            f"Missing required column(s): {sorted(missing)}. "
            f"Required columns are: {sorted(REQUIRED_COLUMNS)}. "
            f"Columns found in the file: {sorted(df.columns)}. "
            f"If your file uses different names, use --map to point MTS at the right columns, "
            f"e.g. --map metric_name=your_column,timestamp=your_column,value=your_column."
        )

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(["metric_name", "timestamp"]).reset_index(drop=True)

    logger.info(
        "Loaded %d record(s) across %d metric(s) from %s",
        len(df),
        df["metric_name"].nunique(),
        path,
    )
    return df
