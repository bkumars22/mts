# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- Drag-and-drop + clearer mismatch errors (v0.2 Feature 3): the dropzone already had drag-and-drop with a visual drag-over state, and a single mismatched-column file already skips straight to the mapping screen rather than erroring out - so this closed the two remaining gaps. The mapping screen now lists "Expected columns" alongside "Columns found in your file" instead of only implying the expected set through field labels. The rare case of uploading a batch of files with two-or-more genuinely different (non-matching) column layouts now reports each file group's actual found columns, instead of just naming the files.

### Changed
- "Try with sample data" (v0.2 Feature 2): the existing example-data picker was already functionally most of this feature (four scenario buttons, immediate real analysis, no upload required), so this made it match the spec's intent more directly rather than rebuilding it - a labeled divider, a "Try it with sample data" heading with supporting copy, and slightly more prominent buttons, replacing the small "Or try an example" caption.

### Added
- Flexible column mapping (v0.2 Feature 1): a file whose columns don't match the exact expected names (`metric_name`/`timestamp`/`value`/`sample_size`) no longer dead-ends with an error. The web app auto-detects a best-guess mapping (date-shaped column -> timestamp, low-cardinality text -> metric_name, highest-variance numeric with decimals -> value, non-negative-integer column -> sample_size) and shows it as an editable, pre-filled confirmation screen - nothing is applied silently. A confirmed mapping is remembered per column-set in `localStorage`, so re-uploading a similarly-shaped file skips straight to results. The CLI gets the same capability via an explicit `--map metric_name=col,timestamp=col,value=col` flag (no auto-detection there, per spec); the "missing required columns" error now also lists the columns actually found in the file and points at `--map`. The existing exact-column-name fast path is unchanged for both.

### Fixed
- "Back to Dashboard" no longer clears the persisted analysis. It previously called `clearLastAnalysis()`, so going back and then refreshing (or navigating away and back) silently lost your results - the exact opposite of what persistence was supposed to do. It now only leaves the results view; a new upload (or an unparseable stored entry) is what actually replaces/clears the stored data.

### Added
- Multiple file upload/drop: `FileDropzone` now accepts `multiple` files at once (drag-and-drop or the file picker), and all of them are combined into a single dataset before running the three checks - so e.g. `week1.csv` + `week2.csv` for the same metric are analyzed together, not as two separate reports. Persistence, the results table, and CSV/PDF export all work the same way against the combined result; the filename display and CSV/PDF export naming reflect all uploaded files.

### Changed
- Switched the web frontend from a dark theme to a light one, with green as the single accent color (upload dropzone, buttons, focus states, links). All text/surface colors are now driven by tokens in `index.css` (`--color-mts-*`) instead of hardcoded dark-mode Tailwind grays, so a future theme change only touches one file.
- Re-themed the accent from green to chaitrishodaya.com's own gold/cream/navy palette (measured directly from the live site: `#faf7f1` background, `#a9790f` accent, `#1e2a3b` text, `#e7dfcc` borders), so MTS reads as part of the same portfolio. Trust score colors (HIGH/MEDIUM/LOW) are unchanged - they're a separate semantic system from the brand accent.
- Made "Analyze another file" visually distinct from the Download CSV/PDF buttons on the results screen: moved it to the left next to the filename with a neutral (non-accent) style and a `←` prefix, so it clearly reads as the way back rather than a third identical-looking action button.

### Fixed
- `mts.chaitrishodaya.com` DNS is now live - switched `vite.config.ts` `base` from `/mts/` back to `/` and `404.html`'s `pathSegmentsToKeep` from `1` to `0` to match serving from the domain root instead of the `bkumars22.github.io/mts/` subpath. Repointed the README's demo link accordingly. Note: this means the plain `bkumars22.github.io/mts/` URL's assets will 404 again - a single build can only be correct for one of the two.

### Added
- `frontend/`: React + Vite + TypeScript + Tailwind client-side analyzer. Ports all three checks to TypeScript so a CSV/JSON file is analyzed entirely in the browser - no backend, works offline once loaded.
- Parity test suite (`frontend/src/lib/checks/__tests__/parity.test.ts`) that runs the TypeScript engine against the same canonical fixtures in `tests/fixtures/` and asserts the exact numbers already verified against the Python CLI, so the two implementations can't silently drift apart.
- "Try an example" picker bundling the four fixtures for a zero-setup demo; drag-and-drop and keyboard-accessible file upload.
- CI: added a `frontend` job (tsc, oxlint, vitest, build) to `.github/workflows/ci.yml`; added `.github/workflows/pages.yml` to deploy `frontend/dist` to GitHub Pages.
- Excel (`.xlsx`/`.xls`) as a third supported input format, alongside CSV/JSON, using SheetJS's officially patched CDN build (the npm-published `xlsx` package has unpatched prototype-pollution/ReDoS advisories - installed `xlsx` from `cdn.sheetjs.com` instead).
- Downloadable input templates (CSV/JSON/Excel), generated from one source of truth (`frontend/scripts/generate-templates.mjs`) and committed as static assets.
- Report export once analysis completes: `Download CSV` and `Download PDF Report` (client-side, `jspdf` - no backend involved).
- A `/help` page explaining the three checks, supported formats, and how to read a trust score; client-side routing (`react-router-dom`) with a GitHub-Pages-compatible deep-link redirect (`404.html` + a receiver script in `index.html`, matching AIMO's pattern).
- The last successful analysis now persists to `localStorage`, so refreshing the page restores the results instead of resetting to the upload screen.

### Changed
- Removed the GitHub link from the dashboard header; replaced with a `Help` link.
- Softened the dark theme: moved off a near-black background to a blue-slate palette with a subtle accent-tinted gradient, and gave cards a shadow for more depth.
- `vite.config.ts` `base` set to `/mts/` (GitHub Pages currently serves this at `bkumars22.github.io/mts/`; the `mts.chaitrishodaya.com` DNS record isn't live yet - change back to `/` once it is).

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
