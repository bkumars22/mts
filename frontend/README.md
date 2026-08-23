# MTS frontend

Client-side analyzer for [MTS](../README.md). Ports the same three checks
(`../mts/checks/*.py`) to TypeScript so a CSV/JSON metrics file is analyzed
entirely in the browser - no backend, works offline once loaded. See the
project root README for the statistical detail.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npx vitest run        # unit tests + Python/TypeScript parity checks
npx tsc -b            # type-check
npx oxlint src        # lint
npm run build          # static output in dist/, deployable to GitHub Pages
```

## Structure

- `src/lib/checks/` - the ported statistics (completeness, sample size, outlier influence, trust score combination) plus `stats.ts` for the shared median/MAD/percentile helpers.
- `src/lib/checks/__tests__/parity.test.ts` - reads the canonical fixtures from `../tests/fixtures/` and asserts this TypeScript engine reproduces the same numbers already verified against the Python CLI.
- `src/lib/parseInput.ts` - CSV/JSON parsing and the same required-column validation as `mts/load_data.py`.
- `src/components/`, `src/ui/` - the single-screen analyzer UI (upload, example picker, results table) and its shared primitives (`Card`, `TrustScoreBadge`).
