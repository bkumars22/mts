/**
 * Parse a CSV or JSON metric-records file into MetricRecord[] - mirrors
 * mts/load_data.py's validation (same required columns, same style of
 * error message) so the CLI and the web tool behave identically.
 */
import Papa from "papaparse"
import type { MetricRecord } from "./checks/types"

const REQUIRED_COLUMNS = ["timestamp", "metric_name", "value"] as const

export class MTSDataError extends Error {}

type RawRow = Record<string, string | number | undefined>

export function parseInput(filename: string, text: string): MetricRecord[] {
  const lower = filename.toLowerCase()
  let rows: RawRow[]

  if (lower.endsWith(".csv")) {
    rows = parseCsv(text)
  } else if (lower.endsWith(".json")) {
    rows = parseJson(text)
  } else {
    throw new MTSDataError(
      `Unsupported input file type - expected .csv or .json (got '${filename}')`,
    )
  }

  if (rows.length === 0) {
    throw new MTSDataError("Input file has no data rows")
  }

  const columns = new Set(Object.keys(rows[0]))
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.has(c))
  if (missing.length > 0) {
    throw new MTSDataError(
      `Missing required column(s): [${missing.sort().join(", ")}]. ` +
        `Required columns are: [${[...REQUIRED_COLUMNS].sort().join(", ")}].`,
    )
  }

  const hasSampleSize = columns.has("sample_size")

  return rows.map((row) => {
    const timestamp = new Date(String(row.timestamp))
    if (Number.isNaN(timestamp.getTime())) {
      throw new MTSDataError(`Invalid timestamp value: '${row.timestamp}'`)
    }

    const record: MetricRecord = {
      timestamp,
      metric_name: String(row.metric_name),
      value: Number(row.value),
    }
    if (hasSampleSize && row.sample_size !== undefined && row.sample_size !== "") {
      record.sample_size = Number(row.sample_size)
    }
    return record
  })
}

function parseCsv(text: string): RawRow[] {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  })
  if (result.errors.length > 0) {
    throw new MTSDataError(`Failed to parse CSV: ${result.errors[0].message}`)
  }
  return result.data
}

function parseJson(text: string): RawRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new MTSDataError(`Failed to parse JSON: ${(err as Error).message}`)
  }
  if (!Array.isArray(parsed)) {
    throw new MTSDataError("JSON input must be an array of metric records")
  }
  return parsed as RawRow[]
}
