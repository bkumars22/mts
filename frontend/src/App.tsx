import { useCallback, useState } from "react"
import { ExampleDataPicker } from "./components/ExampleDataPicker"
import { FileDropzone } from "./components/FileDropzone"
import { TrustScoreTable } from "./components/TrustScoreTable"
import { checkCompleteness } from "./lib/checks/completeness"
import { checkOutlierInfluence } from "./lib/checks/outlierInfluence"
import { checkSampleSize } from "./lib/checks/sampleSize"
import { computeTrustScore } from "./lib/checks/trustScore"
import type { MetricTrustReport } from "./lib/checks/types"
import { MTSDataError, parseInput } from "./lib/parseInput"

type ViewState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "results"; filename: string; reports: MetricTrustReport[] }

function analyze(filename: string, text: string): MetricTrustReport[] {
  const records = parseInput(filename, text)
  return computeTrustScore(
    records,
    checkCompleteness(records),
    checkSampleSize(records),
    checkOutlierInfluence(records),
  )
}

export default function App() {
  const [state, setState] = useState<ViewState>({ kind: "idle" })

  const handleText = useCallback((filename: string, text: string) => {
    try {
      const reports = analyze(filename, text)
      setState({ kind: "results", filename, reports })
    } catch (err) {
      const message = err instanceof MTSDataError ? err.message : "Failed to analyze this file."
      setState({ kind: "error", message })
    }
  }, [])

  const handleFileSelected = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => handleText(file.name, String(reader.result))
      reader.onerror = () => setState({ kind: "error", message: "Failed to read the file." })
      reader.readAsText(file)
    },
    [handleText],
  )

  const reset = useCallback(() => setState({ kind: "idle" }), [])

  return (
    <div className="min-h-screen bg-mts-bg text-gray-100">
      <header className="border-b border-mts-border px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">MTS</h1>
            <p className="text-xs text-gray-500">Metric Trust Score</p>
          </div>
          <a
            href="https://github.com/bkumars22/mts"
            className="text-xs text-gray-500 transition-colors hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent rounded"
          >
            GitHub &#8599;
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {state.kind !== "results" && (
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Your dashboard says 94% accuracy.
            </h2>
            <p className="mt-2 text-lg text-gray-400">
              Is that based on enough data to mean anything?
            </p>
          </div>
        )}

        {state.kind === "idle" && (
          <>
            <FileDropzone onFileSelected={handleFileSelected} />
            <ExampleDataPicker onExampleSelected={handleText} />
          </>
        )}

        {state.kind === "error" && (
          <div>
            <div
              role="alert"
              className="rounded-xl border border-mts-low/40 bg-mts-low-bg px-5 py-4 text-sm text-red-300"
            >
              <p className="font-semibold text-red-200">Couldn&apos;t analyze this file</p>
              <p className="mt-1 text-red-300/90">{state.message}</p>
            </div>
            <div className="mt-6">
              <FileDropzone onFileSelected={handleFileSelected} />
              <ExampleDataPicker onExampleSelected={handleText} />
            </div>
          </div>
        )}

        {state.kind === "results" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-sm text-gray-400">{state.filename}</p>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-mts-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-mts-border-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent"
              >
                Analyze another file
              </button>
            </div>
            <TrustScoreTable reports={state.reports} />
          </div>
        )}
      </main>

      <footer className="px-6 py-8 text-center text-xs text-gray-600">
        Runs entirely in your browser - no file ever leaves your device. Part of the{" "}
        <a href="https://chaitrishodaya.com" className="underline hover:text-gray-400">
          Chaitrishodaya
        </a>{" "}
        AI quality systems portfolio.
      </footer>
    </div>
  )
}
