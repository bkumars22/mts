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
    <div className="mt-6">
      <p className="text-center text-xs text-gray-500">Or try an example</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example.filename}
            type="button"
            onClick={() => onExampleSelected(example.filename, example.text)}
            className="rounded-lg border border-mts-border bg-mts-surface px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-mts-border-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent"
          >
            {example.label}
            <span className="ml-1.5 text-gray-500">- {example.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
