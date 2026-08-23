import { useCallback, useState } from "react"
import { ExampleDataPicker } from "../components/ExampleDataPicker"
import { FileDropzone } from "../components/FileDropzone"
import { Header } from "../components/Header"
import { TemplateDownloads } from "../components/TemplateDownloads"
import { TrustScoreTable } from "../components/TrustScoreTable"
import { checkCompleteness } from "../lib/checks/completeness"
import { checkOutlierInfluence } from "../lib/checks/outlierInfluence"
import { checkSampleSize } from "../lib/checks/sampleSize"
import { computeTrustScore } from "../lib/checks/trustScore"
import type { MetricTrustReport } from "../lib/checks/types"
import { downloadCsvReport, downloadPdfReport } from "../lib/exportReport"
import { detectInputKind, MTSDataError, parseInput } from "../lib/parseInput"
import { clearLastAnalysis, loadLastAnalysis, saveLastAnalysis } from "../lib/persistence"

type ViewState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "results"; filename: string; reports: MetricTrustReport[] }

function analyze(filename: string, data: string | ArrayBuffer): MetricTrustReport[] {
  const records = parseInput(filename, data)
  return computeTrustScore(
    records,
    checkCompleteness(records),
    checkSampleSize(records),
    checkOutlierInfluence(records),
  )
}

// Restores the last successful analysis, so refreshing the page doesn't
// silently drop back to the empty upload screen. localStorage is read
// synchronously, so this runs as a lazy useState initializer rather than
// an effect - no extra render, no external system to synchronize with.
function initialState(): ViewState {
  const last = loadLastAnalysis()
  if (!last) return { kind: "idle" }
  try {
    const reports = analyze(last.filename, last.data)
    return { kind: "results", filename: last.filename, reports }
  } catch {
    clearLastAnalysis()
    return { kind: "idle" }
  }
}

const ACTION_BUTTON =
  "rounded-lg border border-mts-accent px-3 py-1.5 text-xs font-semibold text-mts-accent transition-colors hover:bg-mts-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent focus-visible:ring-offset-2 focus-visible:ring-offset-mts-bg"

export default function Dashboard() {
  const [state, setState] = useState<ViewState>(initialState)

  const handleData = useCallback((filename: string, data: string | ArrayBuffer, persist: boolean) => {
    try {
      const reports = analyze(filename, data)
      setState({ kind: "results", filename, reports })
      if (persist) saveLastAnalysis(filename, data)
    } catch (err) {
      const message = err instanceof MTSDataError ? err.message : "Failed to analyze this file."
      setState({ kind: "error", message })
    }
  }, [])

  const handleExampleSelected = useCallback(
    (filename: string, text: string) => handleData(filename, text, false),
    [handleData],
  )

  const handleFileSelected = useCallback(
    (file: File) => {
      const kind = (() => {
        try {
          return detectInputKind(file.name)
        } catch (err) {
          setState({ kind: "error", message: (err as MTSDataError).message })
          return null
        }
      })()
      if (!kind) return

      const reader = new FileReader()
      reader.onload = () => handleData(file.name, reader.result as string | ArrayBuffer, true)
      reader.onerror = () => setState({ kind: "error", message: "Failed to read the file." })
      if (kind === "excel") {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    },
    [handleData],
  )

  const reset = useCallback(() => {
    clearLastAnalysis()
    setState({ kind: "idle" })
  }, [])

  return (
    <div className="min-h-screen bg-mts-bg text-mts-text">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        {state.kind !== "results" && (
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-mts-text sm:text-3xl">
              Your dashboard says 94% accuracy.
            </h2>
            <p className="mt-2 text-lg text-mts-muted">
              Is that based on enough data to mean anything?
            </p>
          </div>
        )}

        {state.kind === "idle" && (
          <>
            <FileDropzone onFileSelected={handleFileSelected} />
            <ExampleDataPicker onExampleSelected={handleExampleSelected} />
            <TemplateDownloads />
          </>
        )}

        {state.kind === "error" && (
          <div>
            <div
              role="alert"
              className="rounded-xl border border-mts-low/30 bg-mts-low-bg px-5 py-4 text-sm"
            >
              <p className="font-semibold text-mts-low">Couldn&apos;t analyze this file</p>
              <p className="mt-1 text-mts-low/90">{state.message}</p>
            </div>
            <div className="mt-6">
              <FileDropzone onFileSelected={handleFileSelected} />
              <ExampleDataPicker onExampleSelected={handleExampleSelected} />
              <TemplateDownloads />
            </div>
          </div>
        )}

        {state.kind === "results" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-sm text-mts-muted">{state.filename}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadCsvReport(state.filename, state.reports)}
                  className={ACTION_BUTTON}
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadPdfReport(state.filename, state.reports)}
                  className={ACTION_BUTTON}
                >
                  Download PDF Report
                </button>
                <button type="button" onClick={reset} className={ACTION_BUTTON}>
                  Analyze another file
                </button>
              </div>
            </div>
            <TrustScoreTable reports={state.reports} />
          </div>
        )}
      </main>

      <footer className="px-6 py-8 text-center text-xs text-mts-faint">
        Runs entirely in your browser - no file ever leaves your device. Part of the{" "}
        <a href="https://chaitrishodaya.com" className="underline hover:text-mts-accent">
          Chaitrishodaya
        </a>{" "}
        AI quality systems portfolio.
      </footer>
    </div>
  )
}
