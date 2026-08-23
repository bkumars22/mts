# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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
