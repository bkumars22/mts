# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [0.1.0] - 2026-08-23

### Added
- Project scaffolded: package layout, `pyproject.toml`, CI (lint job), pre-commit config, MIT license.
- Four test fixtures (`clean`, `gap`, `low_sample`, `outliers`) defining correct behavior for each trust check, verified against the exact spec'd formulas before any implementation was written.
- `load_data`: reads CSV/JSON, validates required columns, fails fast with `MTSDataError`.
- `completeness_check`: EWMA-smoothed (λ=0.3) expected-gap baseline, 95% Data Completeness Ratio threshold.
- CI: added `test` job (pytest + coverage) alongside the existing `lint` job.
- `sample_size_check`: flags records below 50% of the historical median `sample_size` per metric_name; degrades gracefully (with a visible note) when the column isn't present at all.
- `outlier_influence_check`: Modified Z-score (MAD-based) cross-checked against the IQR method — only confirms an outlier when both agree — plus the mean-with-vs-without influence comparison.
- `trust_score`: combines the three checks into HIGH/MEDIUM/LOW; a skipped check never counts as a flag.
- `rich`-based terminal output (color-coded trust scores) and structured JSON export (`--output`).
- `mts analyze` CLI (typer), with `--input`, `--output`, and `--verbose`.
- Full README (insight-first, ecosystem table, worked example), coverage floor (90%) enforced in CI.

### Fixed
- Pinned `numpy<2.5` — numpy 2.5's type stubs require a newer mypy than is currently released on PyPI, which broke type-checking entirely (both in the project venv and in the pre-commit mypy hook's isolated environment).
- Typer collapses a single-command app into the top-level invocation by default, which would have silently broken the documented `mts analyze --input ...` interface — added a no-op `@app.callback()` to keep `analyze` as an explicit subcommand.
- Reason/note strings used em dashes, which rendered as `�` on a stock Windows console — switched to plain ASCII hyphens in all runtime-visible output.
