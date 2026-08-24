# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [0.2.0] - 2026-08-24

The web app grows from a bare upload-and-analyze tool into a genuinely
usable one: any file's columns can be mapped instead of rejected, there's
a zero-setup way to see what MTS does before uploading anything, results
get a chart alongside the table, and a completed analysis can be shared
as a link with no backend involved.

### Added
- Flexible column mapping (v0.2 Feature 1): a file whose columns don't match the exact expected names (`metric_name`/`timestamp`/`value`/`sample_size`) no longer dead-ends with an error. The web app auto-detects a best-guess mapping (date-shaped column -> timestamp, low-cardinality text -> metric_name, highest-variance numeric with decimals -> value, non-negative-integer column -> sample_size) and shows it as an editable, pre-filled confirmation screen - nothing is applied silently. A confirmed mapping is remembered per column-set in `localStorage`, so re-uploading a similarly-shaped file skips straight to results. The CLI gets the same capability via an explicit `--map metric_name=col,timestamp=col,value=col` flag (no auto-detection there, per spec); the "missing required columns" error now also lists the columns actually found in the file and points at `--map`. The existing exact-column-name fast path is unchanged for both, and the confirmation screen always appears for a first-seen mismatched schema, however confident the guess - never applied silently.
- Multiple file upload/drop: `FileDropzone` accepts `multiple` files at once (drag-and-drop or the file picker), combined into a single dataset before running the three checks - so e.g. `week1.csv` + `week2.csv` for the same metric are analyzed together, not as two separate reports.
- Drag-and-drop + clearer mismatch errors (v0.2 Feature 3): the dropzone has drag-and-drop with a visual drag-over state; a mismatched-column file skips straight to the mapping screen rather than erroring out. The mapping screen lists "Expected columns" alongside "Columns found in your file". Uploading a batch of files with two-or-more genuinely different (non-matching) column layouts reports each file group's actual found columns rather than just naming the files.
- Visual trend chart (v0.2 Feature 4): each metric's results include a lightweight SVG line chart of its value over time, alongside the existing text table (not replacing it). Points the outlier-influence check confirmed render larger and in red, with a "flagged outlier" legend; hovering any point shows its exact value, timestamp, and flagged/normal status. No new dependency - built as plain SVG.
- Shareable results link (v0.2 Feature 5): a "Copy shareable link" button on the results screen (shown only in browsers that support it) encodes the source label, trust scores, reasons, and each metric's chart history as gzip-compressed, base64url JSON in the URL fragment (`#s=...`) - no backend, nothing server-side. Opening a link with that fragment decodes it and renders the results directly, with no re-analysis and no need for the original file; a corrupted or unrecognized fragment shows a clear error instead of failing silently. Uses the browser's native CompressionStream/DecompressionStream - no new dependency. The wire format uses short keys and epoch-millisecond timestamps rather than the verbose report shape, and drops the (spec-optional) skip notes - for a small analysis, gzip alone can't recover much of that verbosity, so the first version produced needlessly long links; this cuts a typical single-metric link by roughly half.
- `frontend/`: React + Vite + TypeScript + Tailwind client-side analyzer. Ports all three checks to TypeScript so a CSV/JSON/Excel file is analyzed entirely in the browser - no backend, works offline once loaded.
- Parity test suite (`frontend/src/lib/checks/__tests__/parity.test.ts`) that runs the TypeScript engine against the same canonical fixtures in `tests/fixtures/` and asserts the exact numbers already verified against the Python CLI, so the two implementations can't silently drift apart.
- "Try it with sample data" picker (v0.2 Feature 2) bundling four scenarios (clean/gap/low-sample/outliers) for a zero-setup demo that runs real analysis with no upload required.
- CI: added a `frontend` job (tsc, oxlint, vitest, build) to `.github/workflows/ci.yml`; added `.github/workflows/pages.yml` to deploy `frontend/dist` to GitHub Pages.
- Excel (`.xlsx`/`.xls`) as a third supported input format, alongside CSV/JSON, using SheetJS's officially patched CDN build (the npm-published `xlsx` package has unpatched prototype-pollution/ReDoS advisories - installed `xlsx` from `cdn.sheetjs.com` instead).
- Downloadable input templates (CSV/JSON/Excel), generated from one source of truth (`frontend/scripts/generate-templates.mjs`) and committed as static assets.
- Report export once analysis completes: `Download CSV` and `Download PDF Report` (client-side, `jspdf` - no backend involved).
- A `/help` page explaining the three checks, supported formats, and how to read a trust score; client-side routing (`react-router-dom`) with a GitHub-Pages-compatible deep-link redirect (`404.html` + a receiver script in `index.html`, matching AIMO's pattern).
- The last successful analysis persists to `localStorage`, so refreshing the page restores the results instead of resetting to the upload screen.

### Changed
- Switched the web frontend from a dark theme to a light one, then re-themed the accent to chaitrishodaya.com's own gold/cream/navy palette (measured from the live site: `#faf7f1` background, `#a9790f` accent, `#1e2a3b` text, `#e7dfcc` borders), so MTS reads as part of the same portfolio. Trust score colors (HIGH/MEDIUM/LOW) are unchanged - a separate semantic system from the brand accent. All text/surface colors are driven by tokens in `index.css` (`--color-mts-*`).
- Made "Back to Dashboard" visually distinct from the Download CSV/PDF buttons on the results screen: moved to the left next to the filename with a neutral (non-accent) style and a `←` prefix.
- Removed the GitHub link from the dashboard header; replaced with a `Help` link.

### Fixed
- "Back to Dashboard" no longer clears the persisted analysis. It previously called `clearLastAnalysis()`, so going back and then refreshing (or navigating away and back) silently lost your results - the exact opposite of what persistence was supposed to do.
- `mts.chaitrishodaya.com` DNS is now live - switched `vite.config.ts` `base` from `/mts/` back to `/` and `404.html`'s `pathSegmentsToKeep` from `1` to `0` to match serving from the domain root instead of the `bkumars22.github.io/mts/` subpath.

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
