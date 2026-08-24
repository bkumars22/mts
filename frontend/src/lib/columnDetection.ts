/**
 * Guesses which of a file's actual columns correspond to the four MTS
 * concepts, for pre-filling the column-mapping screen. These are always
 * suggestions - the UI shows them as editable, pre-selected dropdowns,
 * never applies them silently.
 */
import type { ColumnMapping, RawRow } from "./parseInput"

const SAMPLE_SIZE = 20

export function detectColumnMapping(rows: RawRow[], columns: string[]): ColumnMapping {
  const sample = rows.slice(0, SAMPLE_SIZE)
  const claimed = new Set<string>()

  const timestampCol = pickBest(columns, claimed, (col) => timestampScore(sample, col))
  if (timestampCol) claimed.add(timestampCol)

  const metricNameCol = pickBest(columns, claimed, (col) => metricNameScore(sample, col))
  if (metricNameCol) claimed.add(metricNameCol)

  // "value" is picked before "sample_size" and prefers columns with
  // decimal values - sample counts are conventionally whole numbers, so a
  // column with fractional values is a strong signal it's the metric
  // value, not a count. This matters when a count column happens to have
  // higher raw variance than the actual value column (e.g. a sample_size
  // that swings 200-210 next to a value that's tightly clustered 92-94).
  const valueCol = pickBest(columns, claimed, (col) => valueScore(sample, col))
  if (valueCol) claimed.add(valueCol)

  const sampleSizeCol = pickBest(columns, claimed, (col) => sampleSizeScore(sample, col))

  const mapping: ColumnMapping = {}
  if (timestampCol) mapping.timestamp = timestampCol
  if (metricNameCol) mapping.metric_name = metricNameCol
  if (valueCol) mapping.value = valueCol
  if (sampleSizeCol) mapping.sample_size = sampleSizeCol
  return mapping
}

function pickBest(
  columns: string[],
  claimed: Set<string>,
  score: (col: string) => number,
): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const col of columns) {
    if (claimed.has(col)) continue
    const s = score(col)
    if (s > bestScore) {
      bestScore = s
      best = col
    }
  }
  return bestScore > 0 ? best : null
}

function values(rows: RawRow[], col: string): (string | number)[] {
  return rows.map((r) => r[col]).filter((v): v is string | number => v !== undefined && v !== "")
}

/** Fraction of sampled values that parse as a real date - not bare
 * Date.parse, which happily (and wrongly) accepts plain numbers. */
function timestampScore(rows: RawRow[], col: string): number {
  const vals = values(rows, col)
  if (vals.length === 0) return 0
  const parseable = vals.filter((v) => looksLikeDate(String(v))).length
  return parseable / vals.length
}

function looksLikeDate(value: string): boolean {
  // Require actual date-shaped punctuation (- or /) so a bare number like
  // "200" or "92.1" is never mistaken for a date, unlike raw Date.parse.
  if (!/[-/]/.test(value)) return false
  const time = Date.parse(value)
  return !Number.isNaN(time)
}

/** Non-numeric column with a small number of distinct values relative to
 * row count - the shape of a repeated metric name, not free text or an ID. */
function metricNameScore(rows: RawRow[], col: string): number {
  const vals = values(rows, col).map(String)
  if (vals.length === 0) return 0
  const numericCount = vals.filter((v) => isNumeric(v)).length
  if (numericCount / vals.length > 0.5) return 0 // mostly numeric - not a name column

  const distinctRatio = new Set(vals).size / vals.length
  return 1 - distinctRatio // lower cardinality -> higher score
}

function valueScore(rows: RawRow[], col: string): number {
  const base = numericVarianceScore(rows, col)
  if (base === 0) return 0
  return hasAnyDecimal(rows, col) ? base + 1 : base
}

/** Sample counts are conventionally non-negative integers - require that
 * shape, then fall back to variance to break ties among candidates. */
function sampleSizeScore(rows: RawRow[], col: string): number {
  const vals = values(rows, col).map(String)
  if (vals.length === 0 || !vals.every(isNumeric)) return 0
  const looksLikeCount = vals.every((v) => Number.isInteger(Number(v)) && Number(v) >= 0)
  if (!looksLikeCount) return 0
  return numericVarianceScore(rows, col) || 0.01 // a constant count is still plausible
}

/** Numeric column with real variance - not constant, not a plain sequential
 * row-index-shaped column. */
function numericVarianceScore(rows: RawRow[], col: string): number {
  const vals = values(rows, col).map(String)
  if (vals.length === 0 || !vals.every(isNumeric)) return 0
  const nums = vals.map(Number)
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length
  if (variance === 0) return 0
  // Normalize so this is comparable across columns of very different
  // magnitudes (e.g. a 0-1 rate vs. a millisecond latency).
  const coefficientOfVariation = Math.sqrt(variance) / (Math.abs(mean) || 1)
  return Math.min(coefficientOfVariation, 1)
}

function hasAnyDecimal(rows: RawRow[], col: string): boolean {
  return values(rows, col).some((v) => !Number.isInteger(Number(v)))
}

function isNumeric(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(Number(value))
}
