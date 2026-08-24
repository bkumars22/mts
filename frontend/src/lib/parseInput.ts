/**
 * Parse a CSV, JSON, or Excel metric-records file into MetricRecord[] -
 * mirrors mts/load_data.py's validation (same required columns, same style
 * of error message) so the CLI and the web tool behave identically.
 *
 * Split into stages so column mapping (see columnDetection.ts) can slot in
 * between raw parsing and validation: parseRawRows -> [applyMapping] ->
 * rowsToRecords. parseInput() chains all three for the common case where
 * the file already uses the exact expected column names.
 */
import Papa from "papaparse"
import * as XLSX from "xlsx"
import type { MetricRecord } from "./checks/types"

export const CONCEPTS = ["metric_name", "timestamp", "value", "sample_size"] as const
export type Concept = (typeof CONCEPTS)[number]
export const REQUIRED_CONCEPTS = ["metric_name", "timestamp", "value"] as const satisfies readonly Concept[]
export type ColumnMapping = Partial<Record<Concept, string>>

export class MTSDataError extends Error {}

/** Thrown by rowsToRecords when one or more required concepts can't be
 * found by exact column name - carries structured data (not just a
 * message) so the UI can offer column mapping instead of a dead end. */
export class MissingColumnsError extends MTSDataError {
  readonly foundColumns: string[]
  readonly missingConcepts: Concept[]

  constructor(foundColumns: string[], missingConcepts: Concept[]) {
    super(
      `Missing required column(s): [${[...missingConcepts].sort().join(", ")}]. ` +
        `Required columns are: [${[...REQUIRED_CONCEPTS].sort().join(", ")}]. ` +
        `Columns found in the file: [${[...foundColumns].sort().join(", ")}].`,
    )
    this.foundColumns = foundColumns
    this.missingConcepts = missingConcepts
  }
}

export type RawRow = Record<string, string | number | undefined>

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
 * Parses the file into plain rows, with no column validation - just
 * "what's actually in this file." Used both by the fast path (parseInput)
 * and by the column-mapping flow, which needs to inspect a file's columns
 * before deciding whether mapping is needed.
 *
 * @param data Text content for CSV/JSON, or an ArrayBuffer for Excel files
 *   (Excel files are binary, so they can't be read as text).
 */
export function parseRawRows(filename: string, data: string | ArrayBuffer): RawRow[] {
  const kind = detectInputKind(filename)

  const rows =
    kind === "csv"
      ? parseCsv(asText(data, filename))
      : kind === "json"
        ? parseJson(asText(data, filename))
        : parseExcel(asBuffer(data, filename))

  if (rows.length === 0) {
    throw new MTSDataError("Input file has no data rows")
  }
  return rows
}

/** Renames columns per the mapping (concept -> actual column name) so
 * rowsToRecords sees the canonical names it expects. */
export function applyMapping(rows: RawRow[], mapping: ColumnMapping): RawRow[] {
  const renames = Object.entries(mapping).filter(([, source]) => source) as [Concept, string][]
  if (renames.length === 0) return rows

  return rows.map((row) => {
    const mapped: RawRow = { ...row }
    for (const [concept, source] of renames) {
      mapped[concept] = row[source]
    }
    return mapped
  })
}

/** Validates required columns are present and converts to MetricRecord[].
 * Throws MissingColumnsError (not a plain MTSDataError) when a required
 * concept can't be found, so callers can offer column mapping. */
export function rowsToRecords(rows: RawRow[]): MetricRecord[] {
  const columns = Object.keys(rows[0] ?? {})
  const columnSet = new Set(columns)
  const missing = REQUIRED_CONCEPTS.filter((c) => !columnSet.has(c))
  if (missing.length > 0) {
    throw new MissingColumnsError(columns, missing)
  }

  const hasSampleSize = columnSet.has("sample_size")

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

/** The fast path: exact column names, zero extra steps - unchanged
 * behavior from before column mapping existed. */
export function parseInput(filename: string, data: string | ArrayBuffer): MetricRecord[] {
  return rowsToRecords(parseRawRows(filename, data))
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
