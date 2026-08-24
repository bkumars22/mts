import cleanCsv from "../assets/example-data/clean.csv?raw"
import gapCsv from "../assets/example-data/gap.csv?raw"
import lowSampleCsv from "../assets/example-data/low_sample.csv?raw"
import outliersCsv from "../assets/example-data/outliers.csv?raw"

interface Example {
  label: string
  filename: string
  text: string
  hint: string
}

const EXAMPLES: Example[] = [
  { label: "Clean", filename: "clean.csv", text: cleanCsv, hint: "HIGH trust" },
  { label: "Coverage gap", filename: "gap.csv", text: gapCsv, hint: "MEDIUM trust" },
  { label: "Low sample size", filename: "low_sample.csv", text: lowSampleCsv, hint: "MEDIUM trust" },
  { label: "Outliers", filename: "outliers.csv", text: outliersCsv, hint: "MEDIUM trust" },
]

interface ExampleDataPickerProps {
  onExampleSelected: (filename: string, text: string) => void
}

export function ExampleDataPicker({ onExampleSelected }: ExampleDataPickerProps) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-mts-border" />
        <span className="text-xs font-medium tracking-wide text-mts-faint uppercase">or</span>
        <div className="h-px flex-1 bg-mts-border" />
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm font-semibold text-mts-text">Try it with sample data</p>
        <p className="mt-1 text-xs text-mts-faint">
          See what MTS finds before uploading your own file
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        {EXAMPLES.map((example) => (
          <button
            key={example.filename}
            type="button"
            onClick={() => onExampleSelected(example.filename, example.text)}
            className="rounded-lg border border-mts-accent/40 bg-mts-surface px-4 py-2 text-sm font-medium text-mts-text transition-colors hover:border-mts-accent hover:bg-mts-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent"
          >
            {example.label}
            <span className="ml-1.5 text-mts-faint">- {example.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
