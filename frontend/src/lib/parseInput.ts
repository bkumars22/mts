/**
 * Parse a CSV, JSON, or Excel metric-records file into MetricRecord[] -
 * mirrors mts/load_data.py's validation (same required columns, same style
 * of error message) so the CLI and the web tool behave identically.
 */
import Papa from "papaparse"
import * as XLSX from "xlsx"
import type { MetricRecord } from "./checks/types"

const REQUIRED_COLUMNS = ["timestamp", "metric_name", "value"] as const

export class MTSDataError extends Error {}

type RawRow = Record<string, string | number | undefined>

export type InputKind = "csv" | "json" | "excel"

export function detectInputKind(filename: string): InputKind {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".csv")) return "csv"
  if (lower.endsWith(".json")) return "json"
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel"
  throw new MTSDataError(
    `Unsupported input file type - expected .csv, .json, .xlsx, or .xls (got '${filename}')`,
  )
}

/**
 * @param data Text content for CSV/JSON, or an ArrayBuffer for Excel files
 *   (Excel files are binary, so they can't be read as text).
 */
export function parseInput(filename: string, data: string | ArrayBuffer): MetricRecord[] {
  const kind = detectInputKind(filename)

  let rows: RawRow[]
  if (kind === "csv") {
    rows = parseCsv(asText(data, filename))
  } else if (kind === "json") {
    rows = parseJson(asText(data, filename))
  } else {
    rows = parseExcel(asBuffer(data, filename))
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

function asText(data: string | ArrayBuffer, filename: string): string {
  if (typeof data !== "string") {
    throw new MTSDataError(`Expected text content for '${filename}'`)
  }
  return data
}

function asBuffer(data: string | ArrayBuffer, filename: string): ArrayBuffer {
  if (typeof data === "string") {
    throw new MTSDataError(`Expected binary content for '${filename}'`)
  }
  return data
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

function parseExcel(buffer: ArrayBuffer): RawRow[] {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: false })
  } catch (err) {
    throw new MTSDataError(`Failed to parse Excel file: ${(err as Error).message}`)
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new MTSDataError("Excel file has no sheets")
  }
  return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], { defval: undefined })
}
