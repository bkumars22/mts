/**
 * Remembers a confirmed column mapping per column-set, so re-uploading a
 * similarly-shaped file doesn't require re-mapping every time. Keyed by
 * the file's column names, sorted and joined - a plain deterministic
 * string is sufficient here; a real hash function would add nothing a
 * sorted join doesn't already give for this purpose.
 */
import type { ColumnMapping } from "./parseInput"

const STORAGE_PREFIX = "mts:columnMapping:"

function keyFor(columns: string[]): string {
  return STORAGE_PREFIX + [...columns].sort().join(",")
}

export function saveColumnMapping(columns: string[], mapping: ColumnMapping): void {
  try {
    localStorage.setItem(keyFor(columns), JSON.stringify(mapping))
  } catch {
    // Remembering a mapping is a convenience, not a requirement.
  }
}

export function loadColumnMapping(columns: string[]): ColumnMapping | null {
  try {
    const raw = localStorage.getItem(keyFor(columns))
    if (!raw) return null
    return JSON.parse(raw) as ColumnMapping
  } catch {
    return null
  }
}
