import { useCallback, useEffect, useState } from "react"
import { ColumnMappingScreen } from "../components/ColumnMappingScreen"
import { ExampleDataPicker } from "../components/ExampleDataPicker"
import { FileDropzone } from "../components/FileDropzone"
import { Header } from "../components/Header"
import { TemplateDownloads } from "../components/TemplateDownloads"
import { TrendChart } from "../components/TrendChart"
import { TrustScoreTable } from "../components/TrustScoreTable"
import { checkCompleteness } from "../lib/checks/completeness"
import { checkOutlierInfluence } from "../lib/checks/outlierInfluence"
import { checkSampleSize } from "../lib/checks/sampleSize"
import { computeTrustScore } from "../lib/checks/trustScore"
import type { MetricTrustReport } from "../lib/checks/types"
import { detectColumnMapping } from "../lib/columnDetection"
import { downloadCsvReport, downloadPdfReport } from "../lib/exportReport"
import { loadColumnMapping, saveColumnMapping } from "../lib/mappingStorage"
import {
  applyMapping,
  type ColumnMapping,
  detectInputKind,
  type InputKind,
  MissingColumnsError,
  MTSDataError,
  parseRawRows,
  type RawRow,
  rowsToRecords,
} from "../lib/parseInput"
import type { InputFile } from "../lib/persistence"
import { clearLastAnalysis, loadLastAnalysis, saveLastAnalysis } from "../lib/persistence"
import {
  decodeShareableReports,
  encodeShareableReports,
  isShareLinkSupported,
  SHARE_HASH_PREFIX,
  ShareLinkError,
} from "../lib/shareLink"

interface NeedsMapping {
  filename: string
  rows: RawRow[]
  columns: string[]
}

type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "mapping"
      allFiles: InputFile[]
      persist: boolean
      filenames: string[]
      columns: string[]
      guesses: ColumnMapping
    }
  | { kind: "results"; filename: string; reports: MetricTrustReport[] }

/** A shared-results link puts its payload after `#s=` in the URL fragment
 * (see shareLink.ts) - null when the current URL isn't one. */
function readShareHash(): string | null {
  const hash = window.location.hash
  const prefix = `#${SHARE_HASH_PREFIX}`
  return hash.startsWith(prefix) ? hash.slice(prefix.length) : null
}

type Resolved =
  | { ok: true; records: ReturnType<typeof rowsToRecords> }
  | ({ ok: false } & NeedsMapping)

/** Tries the exact-name fast path, then a remembered mapping for this
 * file's exact column set, before giving up and asking the caller to
 * show the mapping screen. Used both for fresh uploads and for restoring
 * a persisted analysis, so the two stay behaviorally identical. */
function resolveFile(file: InputFile): Resolved {
  const rows = parseRawRows(file.filename, file.data)
  try {
    return { ok: true, records: rowsToRecords(rows) }
  } catch (err) {
    if (!(err instanceof MissingColumnsError)) throw err
    const columns = Object.keys(rows[0] ?? {})
    const remembered = loadColumnMapping(columns)
    if (remembered) {
      return { ok: true, records: rowsToRecords(applyMapping(rows, remembered)) }
    }
    return { ok: false, filename: file.filename, rows, columns }
  }
}

type ProcessResult =
  | { kind: "results"; reports: MetricTrustReport[] }
  | { kind: "mapping"; filenames: string[]; columns: string[]; guesses: ColumnMapping }
  | { kind: "error"; message: string }

/** The single place that turns "files the user gave us" into either
 * results, a request to map columns, or an error - shared by fresh
 * uploads, mapping confirmation, and restoring a persisted analysis. */
function processFiles(files: InputFile[]): ProcessResult {
  let resolved: Resolved[]
  try {
    resolved = files.map(resolveFile)
  } catch (err) {
    const message = err instanceof MTSDataError ? err.message : "Failed to analyze this file."
    return { kind: "error", message }
  }

  const needsMapping = resolved.filter((r): r is { ok: false } & NeedsMapping => !r.ok)
  if (needsMapping.length > 0) {
    const groups = new Map<string, { filenames: string[]; columns: string[] }>()
    for (const f of needsMapping) {
      const signature = [...f.columns].sort().join(",")
      const group = groups.get(signature)
      if (group) {
        group.filenames.push(f.filename)
      } else {
        groups.set(signature, { filenames: [f.filename], columns: f.columns })
      }
    }
    if (groups.size > 1) {
      const groupLines = [...groups.values()]
        .map((g) => `${g.filenames.join(", ")} - columns: [${g.columns.join(", ")}]`)
        .join("; ")
      return {
        kind: "error",
        message:
          `These files have different column layouts and can't be mapped together in one batch: ` +
          `${groupLines}. Upload files with matching columns together, or one at a time.`,
      }
    }
    const first = needsMapping[0]
    return {
      kind: "mapping",
      filenames: needsMapping.map((f) => f.filename),
      columns: first.columns,
      guesses: detectColumnMapping(first.rows, first.columns),
    }
  }

  const records = resolved.flatMap((r) => (r.ok ? r.records : []))
  try {
    const reports = computeTrustScore(
      records,
      checkCompleteness(records),
      checkSampleSize(records),
      checkOutlierInfluence(records),
    )
    return { kind: "results", reports }
  } catch (err) {
    const message = err instanceof MTSDataError ? err.message : "Failed to analyze this file."
    return { kind: "error", message }
  }
}

function displayName(files: InputFile[]): string {
  return files.map((f) => f.filename).join(", ")
}

function toViewState(result: ProcessResult, files: InputFile[], persist: boolean): ViewState {
  if (result.kind === "results") {
    return { kind: "results", filename: displayName(files), reports: result.reports }
  }
  if (result.kind === "mapping") {
    return {
      kind: "mapping",
      allFiles: files,
      persist,
      filenames: result.filenames,
      columns: result.columns,
      guesses: result.guesses,
    }
  }
  return { kind: "error", message: result.message }
}

// Restores the last successful analysis, so refreshing the page doesn't
// silently drop back to the empty upload screen. localStorage is read
// synchronously, so this runs as a lazy useState initializer rather than
// an effect - no extra render, no external system to synchronize with.
// If the stored files would need a mapping screen (e.g. the remembered
// mapping was separately cleared), fall back to idle rather than
// surprising the user with a mapping step on page load.
function initialState(): ViewState {
  // A shared-results link takes priority over restoring a local analysis,
  // and decoding it is async - render "loading" now, resolve it in an
  // effect, rather than briefly flashing a stale local restore first.
  if (readShareHash()) return { kind: "loading" }

  const files = loadLastAnalysis()
  if (!files) return { kind: "idle" }
  try {
    const result = processFiles(files)
    if (result.kind === "results") {
      return { kind: "results", filename: displayName(files), reports: result.reports }
    }
    clearLastAnalysis()
    return { kind: "idle" }
  } catch {
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
  const [shareStatus, setShareStatus] = useState<"idle" | "copying" | "copied" | "error">("idle")

  useEffect(() => {
    const encoded = readShareHash()
    if (!encoded) return

    let cancelled = false
    decodeShareableReports(encoded)
      .then(({ label, reports }) => {
        if (!cancelled) setState({ kind: "results", filename: label, reports })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof ShareLinkError ? err.message : "Failed to load the shared results."
        setState({ kind: "error", message })
      })
      .finally(() => {
        // Don't let a refresh (or clicking around) re-trigger this link.
        window.history.replaceState(null, "", window.location.pathname + window.location.search)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCopyShareLink = useCallback(() => {
    if (state.kind !== "results") return
    setShareStatus("copying")
    encodeShareableReports(state.filename, state.reports)
      .then((encoded) => {
        const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${SHARE_HASH_PREFIX}${encoded}`
        return navigator.clipboard.writeText(url)
      })
      .then(() => setShareStatus("copied"))
      .catch(() => setShareStatus("error"))
      .finally(() => {
        setTimeout(() => setShareStatus("idle"), 2000)
      })
  }, [state])

  const handleFiles = useCallback((files: InputFile[], persist: boolean) => {
    const result = processFiles(files)
    setState(toViewState(result, files, persist))
    if (result.kind === "results" && persist) saveLastAnalysis(files)
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

  const handleMappingConfirm = useCallback(
    (mapping: ColumnMapping) => {
      if (state.kind !== "mapping") return
      saveColumnMapping(state.columns, mapping)
      handleFiles(state.allFiles, state.persist)
    },
    [state, handleFiles],
  )

  // Returning to the dashboard doesn't discard the analysis - only
  // uploading new files (or clearing storage another way) does. This way
  // a refresh (or navigating away and back) doesn't lose your results.
  const reset = useCallback(() => setState({ kind: "idle" }), [])

  return (
    <div className="min-h-screen bg-mts-bg text-mts-text">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        {state.kind === "loading" && (
          <p className="text-center text-sm text-mts-muted">Loading shared results...</p>
        )}

        {state.kind !== "results" && state.kind !== "mapping" && state.kind !== "loading" && (
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

        {state.kind === "mapping" && (
          <ColumnMappingScreen
            filenames={state.filenames}
            columns={state.columns}
            guesses={state.guesses}
            onConfirm={handleMappingConfirm}
            onCancel={reset}
          />
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
                {isShareLinkSupported() && (
                  <button type="button" onClick={handleCopyShareLink} className={ACTION_BUTTON}>
                    {shareStatus === "copied"
                      ? "Copied!"
                      : shareStatus === "copying"
                        ? "Copying..."
                        : shareStatus === "error"
                          ? "Couldn't copy"
                          : "Copy shareable link"}
                  </button>
                )}
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

            <div className="mt-8">
              <p className="text-xs font-semibold tracking-wide text-mts-faint uppercase">Trends</p>
              <div className="mt-3 space-y-4">
                {state.reports.map((report) => (
                  <TrendChart
                    key={report.metricName}
                    metricName={report.metricName}
                    points={report.history}
                  />
                ))}
              </div>
            </div>
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
