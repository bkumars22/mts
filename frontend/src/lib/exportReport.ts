/**
 * Client-side report export - CSV and PDF, so a completed analysis can be
 * downloaded and shared (e.g. by email or Slack) without any backend.
 */
import { jsPDF } from "jspdf"
import type { MetricTrustReport } from "./checks/types"

export function downloadCsvReport(sourceFilename: string, reports: MetricTrustReport[]): void {
  const header = ["metric_name", "latest_value", "trust_score", "reasons", "notes"]
  const lines = [header.join(",")]

  for (const report of reports) {
    lines.push(
      [
        csvCell(report.metricName),
        csvCell(String(report.latestValue)),
        csvCell(report.trustScore),
        csvCell(report.reasons.join(" | ")),
        csvCell(report.notes.join(" | ")),
      ].join(","),
    )
  }

  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), reportFilename(sourceFilename, "csv"))
}

export function downloadPdfReport(sourceFilename: string, reports: MetricTrustReport[]): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 48
  let y = 56

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text("MTS - Metric Trust Score Report", marginX, y)

  y += 20
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(`Source file: ${sourceFilename}`, marginX, y)
  y += 14
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y)
  y += 28

  for (const report of reports) {
    if (y > 740) {
      doc.addPage()
      y = 56
    }

    doc.setTextColor(20)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text(report.metricName, marginX, y)

    const scoreColor = TRUST_COLORS[report.trustScore] ?? [80, 80, 80]
    doc.setTextColor(...scoreColor)
    doc.text(report.trustScore, 400, y)
    y += 16

    doc.setTextColor(90)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text(`Latest value: ${report.latestValue}`, marginX, y)
    y += 16

    const reasonLines = report.reasons.length > 0 ? report.reasons : ["-"]
    for (const reason of reasonLines) {
      const wrapped = doc.splitTextToSize(reason, 500) as string[]
      for (const line of wrapped) {
        if (y > 760) {
          doc.addPage()
          y = 56
        }
        doc.text(line, marginX, y)
        y += 14
      }
    }

    for (const note of report.notes) {
      const wrapped = doc.splitTextToSize(`Note: ${note}`, 500) as string[]
      doc.setTextColor(140)
      for (const line of wrapped) {
        if (y > 760) {
          doc.addPage()
          y = 56
        }
        doc.text(line, marginX, y)
        y += 14
      }
    }

    y += 18
  }

  doc.save(reportFilename(sourceFilename, "pdf"))
}

const TRUST_COLORS: Record<string, [number, number, number]> = {
  HIGH: [22, 163, 74],
  MEDIUM: [217, 119, 6],
  LOW: [220, 38, 38],
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function reportFilename(sourceFilename: string, extension: string): string {
  const base = sourceFilename.replace(/\.[^./]+$/, "")
  return `${base}-mts-report.${extension}`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
