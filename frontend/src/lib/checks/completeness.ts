/**
 * Completeness check - port of mts/checks/completeness.py.
 *
 * Data Completeness Ratio: (actual records / expected records) x 100.
 * Expected record count is derived from an EWMA (lambda=0.3) of the
 * historical gap between consecutive timestamps, so the baseline is
 * trend-aware rather than a flat average. Flags below the 95% threshold.
 */
import { groupByMetricName } from "./stats"
import type { CompletenessResult, MetricRecord } from "./types"

export const EWMA_LAMBDA = 0.3
export const COMPLETENESS_THRESHOLD_PCT = 95.0

export function checkCompleteness(records: MetricRecord[]): CompletenessResult[] {
  const groups = groupByMetricName(records)
  return Array.from(groups.entries()).map(([metricName, group]) =>
    checkOneMetric(metricName, group),
  )
}

function checkOneMetric(metricName: string, group: MetricRecord[]): CompletenessResult {
  const sorted = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const n = sorted.length

  if (n < 2) {
    return {
      metricName,
      skipped: true,
      flagged: false,
      completenessRatio: null,
      expectedRecords: null,
      actualRecords: n,
      expectedGapHours: null,
      reason: "Insufficient history (<2 records) to assess completeness",
    }
  }

  const gapsHours: number[] = []
  for (let i = 1; i < n; i++) {
    gapsHours.push((sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime()) / 3_600_000)
  }

  let ewma = gapsHours[0]
  for (let i = 1; i < gapsHours.length; i++) {
    ewma = EWMA_LAMBDA * gapsHours[i] + (1 - EWMA_LAMBDA) * ewma
  }
  const expectedGapHours = ewma

  if (expectedGapHours <= 0) {
    return {
      metricName,
      skipped: true,
      flagged: false,
      completenessRatio: null,
      expectedRecords: null,
      actualRecords: n,
      expectedGapHours,
      reason: "Expected reporting interval is zero or negative - cannot assess completeness",
    }
  }

  const windowHours =
    (sorted[n - 1].timestamp.getTime() - sorted[0].timestamp.getTime()) / 3_600_000
  const expectedRecords = windowHours / expectedGapHours + 1
  const completenessRatio = (n / expectedRecords) * 100
  const flagged = completenessRatio < COMPLETENESS_THRESHOLD_PCT

  const reason =
    `Completeness: ${completenessRatio.toFixed(1)}% ` +
    `(${n}/${expectedRecords.toFixed(0)} expected records, ` +
    `based on EWMA-smoothed interval of ${expectedGapHours.toFixed(2)}h). ` +
    `Threshold: ${COMPLETENESS_THRESHOLD_PCT.toFixed(0)}%.`

  return {
    metricName,
    skipped: false,
    flagged,
    completenessRatio,
    expectedRecords,
    actualRecords: n,
    expectedGapHours,
    reason,
  }
}
