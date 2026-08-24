import { useMemo, useState } from "react"
import type { ColumnMapping, Concept } from "../lib/parseInput"
import { Card } from "../ui/Card"

interface ConceptField {
  concept: Concept
  label: string
  required: boolean
}

const FIELDS: ConceptField[] = [
  { concept: "metric_name", label: "Metric name", required: true },
  { concept: "timestamp", label: "Timestamp", required: true },
  { concept: "value", label: "Value", required: true },
  { concept: "sample_size", label: "Sample size (optional)", required: false },
]

interface ColumnMappingScreenProps {
  filenames: string[]
  columns: string[]
  guesses: ColumnMapping
  onConfirm: (mapping: ColumnMapping) => void
  onCancel: () => void
}

export function ColumnMappingScreen({
  filenames,
  columns,
  guesses,
  onConfirm,
  onCancel,
}: ColumnMappingScreenProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(guesses)

  const selectedValues = useMemo(
    () => FIELDS.map((f) => mapping[f.concept]).filter(Boolean),
    [mapping],
  )
  const requiredFilled = FIELDS.filter((f) => f.required).every((f) => mapping[f.concept])
  const noDuplicates = new Set(selectedValues).size === selectedValues.length
  const canAnalyze = requiredFilled && noDuplicates

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-bold text-mts-text">
        We couldn&apos;t find the expected columns
      </h2>
      <p className="mt-2 text-sm text-mts-muted">
        {filenames.length > 1
          ? `${filenames.join(", ")} don't use MTS's expected column names.`
          : `${filenames[0]} doesn't use MTS's expected column names.`}{" "}
        Match each one below to a column in your file - we&apos;ve pre-filled our best guess, but
        you should confirm it&apos;s right.
      </p>

      <Card className="mt-6 p-6">
        <p className="text-xs font-semibold tracking-wide text-mts-faint uppercase">
          Columns found in your file
        </p>
        <p className="mt-1 font-mono text-sm text-mts-text">{columns.join(", ")}</p>

        <div className="mt-6 space-y-4">
          {FIELDS.map((field) => (
            <div key={field.concept} className="flex items-center justify-between gap-4">
              <label htmlFor={`map-${field.concept}`} className="text-sm font-medium text-mts-text">
                {field.label}
                {field.required && <span className="text-mts-low"> *</span>}
              </label>
              <select
                id={`map-${field.concept}`}
                value={mapping[field.concept] ?? ""}
                onChange={(e) =>
                  setMapping((prev) => ({
                    ...prev,
                    [field.concept]: e.target.value || undefined,
                  }))
                }
                className="rounded-lg border border-mts-border bg-mts-surface px-3 py-1.5 text-sm text-mts-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent"
              >
                <option value="">{field.required ? "Choose a column..." : "— none —"}</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {!noDuplicates && (
          <p className="mt-4 text-xs text-mts-low">
            Each column can only be used for one field - two fields currently point at the same
            column.
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={!canAnalyze}
            onClick={() => onConfirm(mapping)}
            className="rounded-lg border border-mts-accent bg-mts-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mts-accent-hover disabled:cursor-not-allowed disabled:border-mts-border disabled:bg-mts-border disabled:text-mts-faint"
          >
            Analyze
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-mts-border px-4 py-2 text-sm font-semibold text-mts-muted transition-colors hover:border-mts-border-hover hover:text-mts-text"
          >
            Cancel
          </button>
        </div>
      </Card>
    </div>
  )
}
