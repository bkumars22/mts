"""Structured JSON export of trust score reports.

This schema is deliberately kept clean and stable — it doubles as the
future frontend's data contract (see Phase 6 in the build plan).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from mts.trust_score import MetricTrustReport


def to_json_dict(reports: list[MetricTrustReport]) -> dict[str, Any]:
    return {
        "metrics": [
            {
                "metric_name": r.metric_name,
                "latest_value": r.latest_value,
                "latest_timestamp": r.latest_timestamp.isoformat(),
                "trust_score": r.trust_score,
                "reasons": r.reasons,
                "notes": r.notes,
            }
            for r in reports
        ]
    }


def write_json_report(reports: list[MetricTrustReport], path: str | Path) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(to_json_dict(reports), f, indent=2)
