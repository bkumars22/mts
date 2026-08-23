import type { MetricTrustReport } from "../lib/checks/types"
import { Card } from "../ui/Card"
import { TrustScoreBadge } from "../ui/Badge"

interface TrustScoreTableProps {
  reports: MetricTrustReport[]
}

export function TrustScoreTable({ reports }: TrustScoreTableProps) {
  const notes = dedupe(reports.flatMap((r) => r.notes))

  return (
    <div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-mts-border text-xs tracking-wide text-gray-500 uppercase">
              <th scope="col" className="px-4 py-3 font-semibold">
                Metric
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Latest Value
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Trust Score
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Reason(s)
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.metricName} className="border-b border-mts-border last:border-0">
                <td className="px-4 py-3 font-mono text-gray-200">{report.metricName}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-200">
                  {formatValue(report.latestValue)}
                </td>
                <td className="px-4 py-3 text-center">
                  <TrustScoreBadge score={report.trustScore} />
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {report.reasons.length > 0 ? (
                    <ul className="space-y-1.5">
                      {report.reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {notes.map((note) => (
            <p key={note} className="flex items-start gap-1.5 text-xs text-gray-500">
              <span aria-hidden="true">i</span>
              <span>{note}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items))
}
