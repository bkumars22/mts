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


def load_data(path: str | Path) -> pd.DataFrame:
    """Read a CSV or JSON file of metric records and return a validated,
    sorted DataFrame.

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

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise MTSDataError(
            f"Missing required column(s): {sorted(missing)}. "
            f"Required columns are: {sorted(REQUIRED_COLUMNS)}."
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
