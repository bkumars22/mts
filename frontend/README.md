# MTS frontend

Client-side analyzer for [MTS](../README.md). Ports the same three checks
(`../mts/checks/*.py`) to TypeScript so a CSV, JSON, or Excel metrics file is
analyzed entirely in the browser - no backend, works offline once loaded. See
the project root README for the statistical detail.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npx vitest run        # unit tests + Python/TypeScript parity checks
npx tsc -b            # type-check
npx oxlint src        # lint
npm run build          # static output in dist/, deployable to GitHub Pages

node scripts/generate-templates.mjs   # regenerate public/templates/* after changing the sample data
```

## Structure

- `src/lib/checks/` - the ported statistics (completeness, sample size, outlier influence, trust score combination) plus `stats.ts` for the shared median/MAD/percentile helpers.
- `src/lib/checks/__tests__/parity.test.ts` - reads the canonical fixtures from `../tests/fixtures/` and asserts this TypeScript engine reproduces the same numbers already verified against the Python CLI.
- `src/lib/parseInput.ts` - CSV/JSON/Excel parsing and the same required-column validation as `mts/load_data.py`. Excel parsing uses SheetJS's officially patched CDN build (see `package.json` - the npm-published `xlsx` package has unpatched security advisories).
- `src/lib/persistence.ts` - persists the last successful analysis to `localStorage` so a page refresh restores it.
- `src/lib/exportReport.ts` - client-side CSV/PDF report export (`jspdf`).
- `src/pages/` - `Dashboard` (upload, examples, templates, results) and `Help`; routed via `react-router-dom`. `public/404.html` + a receiver script in `index.html` make deep links and refreshes work on GitHub Pages' static hosting (same pattern as AIMO).
- `src/components/`, `src/ui/` - shared UI (`FileDropzone`, `TrustScoreTable`, `Header`, `Card`, `TrustScoreBadge`).
- `scripts/generate-templates.mjs` - generates `public/templates/template.{csv,json,xlsx}` from one source of truth; run it after changing the sample data, not at runtime.
