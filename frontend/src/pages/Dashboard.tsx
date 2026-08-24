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
import { detectInputKind, type InputKind, MTSDataError, parseInput } from "../lib/parseInput"
import type { InputFile } from "../lib/persistence"
import { clearLastAnalysis, loadLastAnalysis, saveLastAnalysis } from "../lib/persistence"

type ViewState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "results"; filename: string; reports: MetricTrustReport[] }

// Combines records from every uploaded file before running the checks, so
// uploading e.g. week1.csv + week2.csv for the same metric analyzes them
// together rather than as two unrelated reports.
function analyzeFiles(files: InputFile[]): MetricTrustReport[] {
  const records = files.flatMap((f) => {
    try {
      return parseInput(f.filename, f.data)
    } catch (err) {
      const message = err instanceof MTSDataError ? err.message : "Failed to analyze this file."
      throw new MTSDataError(files.length > 1 ? `${f.filename}: ${message}` : message)
    }
  })
  return computeTrustScore(
    records,
    checkCompleteness(records),
    checkSampleSize(records),
    checkOutlierInfluence(records),
  )
}

function displayName(files: InputFile[]): string {
  return files.map((f) => f.filename).join(", ")
}

// Restores the last successful analysis, so refreshing the page doesn't
// silently drop back to the empty upload screen. localStorage is read
// synchronously, so this runs as a lazy useState initializer rather than
// an effect - no extra render, no external system to synchronize with.
function initialState(): ViewState {
  const files = loadLastAnalysis()
  if (!files) return { kind: "idle" }
  try {
    const reports = analyzeFiles(files)
    return { kind: "results", filename: displayName(files), reports }
  } catch {
    // The stored data no longer parses (e.g. changed shape between
    // versions) - it's unusable, so clear it rather than failing on
    // every future load too.
    clearLastAnalysis()
    return { kind: "idle" }
  }
}

function readFile(file: File): Promise<InputFile> {
  return new Promise((resolve, reject) => {
    let kind: InputKind
    try {
      kind = detectInputKind(file.name)
    } catch (err) {
      reject(err)
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve({ filename: file.name, data: reader.result as string | ArrayBuffer })
    reader.onerror = () => reject(new MTSDataError(`Failed to read ${file.name}.`))
    if (kind === "excel") {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  })
}

const ACTION_BUTTON =
  "rounded-lg border border-mts-accent px-3 py-1.5 text-xs font-semibold text-mts-accent transition-colors hover:bg-mts-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent focus-visible:ring-offset-2 focus-visible:ring-offset-mts-bg"

const BACK_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg border border-mts-border px-3 py-1.5 text-xs font-semibold text-mts-muted transition-colors hover:border-mts-border-hover hover:text-mts-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent focus-visible:ring-offset-2 focus-visible:ring-offset-mts-bg"

export default function Dashboard() {
  const [state, setState] = useState<ViewState>(initialState)

  const handleFiles = useCallback((files: InputFile[], persist: boolean) => {
    try {
      const reports = analyzeFiles(files)
      setState({ kind: "results", filename: displayName(files), reports })
      if (persist) saveLastAnalysis(files)
    } catch (err) {
      const message = err instanceof MTSDataError ? err.message : "Failed to analyze this file."
      setState({ kind: "error", message })
    }
  }, [])

  const handleExampleSelected = useCallback(
    (filename: string, text: string) => handleFiles([{ filename, data: text }], false),
    [handleFiles],
  )

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      Promise.all(files.map(readFile))
        .then((inputFiles) => handleFiles(inputFiles, true))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to read the file(s)."
          setState({ kind: "error", message })
        })
    },
    [handleFiles],
  )

  // Returning to the dashboard doesn't discard the analysis - only
  // uploading new files (or clearing storage another way) does. This way
  // a refresh (or navigating away and back) doesn't lose your results.
  const reset = useCallback(() => setState({ kind: "idle" }), [])

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
            <FileDropzone onFilesSelected={handleFilesSelected} />
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
              <FileDropzone onFilesSelected={handleFilesSelected} />
              <ExampleDataPicker onExampleSelected={handleExampleSelected} />
              <TemplateDownloads />
            </div>
          </div>
        )}

        {state.kind === "results" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={reset} className={BACK_BUTTON}>
                  <span aria-hidden="true">&larr;</span> Back to Dashboard
                </button>
                <p className="font-mono text-sm text-mts-muted">{state.filename}</p>
              </div>
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
