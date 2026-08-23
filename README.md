# MTS — Metric Trust Score

> **Your evaluation dashboard says 94% accuracy. Is that based on enough data to mean anything? MTS checks before you trust it.**

[![CI](https://github.com/bkumars22/MTS/actions/workflows/ci.yml/badge.svg)](https://github.com/bkumars22/MTS/actions/workflows/ci.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[Try it in your browser](https://bkumars22.github.io/mts/)** — the same three checks, ported to TypeScript, running entirely client-side. No file ever leaves your device. (Will move to `mts.chaitrishodaya.com` once that DNS record is live.)

---

## The Problem

A metric can look healthy while the data behind it has real problems:

- **A gap in coverage** — 24 records this week when there should have been 200
- **A handful of outliers** — two runs that timed out are dragging the average up 30%
- **A sample too small to mean anything** — 12 evaluation runs, not the usual 200+

The number isn't wrong. Trusting it blindly would be.

```
$ mts analyze --input weekly_metrics.csv

  eval_accuracy   94.2%   LOW TRUST
    - Completeness: 68.3% (12/18 expected records). Threshold: 95%.
    - Sample size: 12 records (50% of historical median 210 = 105). Below threshold.
```

MTS runs three production-proven statistical checks against your metric data and tells you exactly *why* a number does or doesn't earn HIGH trust — never just a bare label.

## The Chaitrishodaya Portfolio

MTS is part of the [Chaitrishodaya](https://chaitrishodaya.com) AI quality systems portfolio — same "verify, don't just claim" philosophy as its siblings, extending that discipline into the metrics/evaluation layer.

| Project | What it verifies |
|---|---|
| [AIMO](https://aimo.chaitrishodaya.com) | Is your AI pipeline behaving correctly right now? |
| SCIP | Is your supply chain data telling the truth? |
| **MTS** | Is the metric on your dashboard backed by enough good data to trust it? |

## Install

```bash
pip install -e ".[dev]"
```

## Usage

```bash
mts analyze --input metrics.csv
mts analyze --input metrics.json --output report.json   # also save a structured JSON report
mts analyze --input metrics.csv --verbose                # debug logging
```

**Input format** — a CSV or JSON file of metric records:

| Column | Required | Description |
|---|---|---|
| `timestamp` | yes | When the record was reported |
| `metric_name` | yes | Which metric this record belongs to |
| `value` | yes | The metric's value |
| `sample_size` | no | Enables the sample size adequacy check when present |

## The Three Checks

1. **Completeness** — `(actual records / expected records) × 100`, where the expected count comes from an EWMA (λ=0.3) of the historical reporting gap per metric — trend-aware, not a flat average. Flags below 95%.

2. **Sample size adequacy** — flags any record whose `sample_size` falls below 50% of that metric's historical median. (Cochran's formula is the formally rigorous approach to survey sample sizing; comparing against the historical median is the pragmatic, directly-implementable MVP version — a deliberate tradeoff, not an oversight.)

3. **Outlier influence** — Modified Z-Score (`0.6745 × (x - median) / MAD`), the NIST-recommended, MAD-based method — more robust to skewed production data than plain Z-score, and doesn't need training the way IsolationForest does. Flags `|Modified Z| > 3.5`, then cross-checks against the IQR method (`Q1 - 1.5×IQR` to `Q3 + 1.5×IQR`) — a point only counts as a confirmed outlier if **both** methods agree, which cuts false positives. For confirmed outliers, MTS shows what the average would be with and without them, so the actual influence is visible.

**Combination logic**: all three checks clean → **HIGH**. One flagged → **MEDIUM** (with the specific reason). Two or more flagged → **LOW** (with all reasons). A check that can't run (no `sample_size` column, or fewer than 10 historical points for the outlier check) is skipped with a clear note — it never silently counts against the score.

## Web (client-side)

`frontend/` ports the same three checks to TypeScript so the browser can analyze an uploaded CSV, JSON, **or Excel** file directly — no backend, works fully offline once loaded. A parity test suite (`frontend/src/lib/checks/__tests__/parity.test.ts`) runs both engines against the same canonical fixtures in `tests/fixtures/` to keep them in sync. It also offers downloadable input templates, CSV/PDF report export, and a `/help` page — see `frontend/README.md` for detail.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build       # static output in frontend/dist, deployable to GitHub Pages
```

## Development

```bash
pip install -e ".[dev]"
pre-commit install

ruff check . && ruff format --check .
mypy mts/
pytest --cov=mts --cov-report=term-missing

cd frontend && npm ci && npx tsc -b && npx oxlint src && npx vitest run
```
