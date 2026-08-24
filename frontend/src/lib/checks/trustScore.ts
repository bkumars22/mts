/**
 * Combines the three check results into HIGH/MEDIUM/LOW per metric - port
 * of mts/trust_score.py.
 *
 * All three checks clean (or skipped): HIGH. One flagged: MEDIUM. Two or
 * more flagged: LOW. A skipped check never counts as a flag - it's
 * surfaced as a note instead.
 */
import { groupByMetricName } from "./stats"
import {
  TRUST_HIGH,
  TRUST_LOW,
  TRUST_MEDIUM,
  type CompletenessResult,
  type MetricRecord,
  type MetricTrustReport,
  type OutlierInfluenceResult,
  type SampleSizeResult,
} from "./types"

export function computeTrustScore(
  records: MetricRecord[],
  completenessResults: CompletenessResult[],
  sampleSizeResults: SampleSizeResult[],
  outlierResults: OutlierInfluenceResult[],
): MetricTrustReport[] {
  const completenessByMetric = new Map(completenessResults.map((r) => [r.metricName, r]))
  const sampleSizeByMetric = new Map(sampleSizeResults.map((r) => [r.metricName, r]))
  const outlierByMetric = new Map(outlierResults.map((r) => [r.metricName, r]))

  const groups = groupByMetricName(records)

  return Array.from(groups.entries()).map(([metricName, group]) => {
    const sorted = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const latest = sorted[sorted.length - 1]

    const reasons: string[] = []
    const notes: string[] = []
    let flagCount = 0

    const completeness = completenessByMetric.get(metricName)
    if (completeness) {
      if (completeness.skipped) {
        notes.push(completeness.reason)
      } else if (completeness.flagged) {
        flagCount += 1
        reasons.push(completeness.reason)
      }
    }

    const sampleSize = sampleSizeByMetric.get(metricName)
    if (sampleSize) {
      if (sampleSize.skipped) {
        notes.push(sampleSize.note ?? "sample_size check skipped")
      } else if (sampleSize.flaggedRecords.length > 0) {
        flagCount += 1
        reasons.push(sampleSizeReason(sampleSize))
      }
    }

    const outlier = outlierByMetric.get(metricName)
    const outlierTimestamps = new Set<number>()
    if (outlier) {
      if (outlier.skipped) {
        notes.push(outlier.note ?? "outlier influence check skipped")
      } else if (outlier.confirmedOutliers.length > 0) {
        flagCount += 1
        reasons.push(outlier.reason as string)
        for (const o of outlier.confirmedOutliers) outlierTimestamps.add(o.timestamp.getTime())
      }
    }

    const trustScore = flagCount === 0 ? TRUST_HIGH : flagCount === 1 ? TRUST_MEDIUM : TRUST_LOW

    const history = sorted.map((record) => ({
      timestamp: record.timestamp,
      value: record.value,
      isOutlier: outlierTimestamps.has(record.timestamp.getTime()),
    }))

    return {
      metricName,
      latestValue: latest.value,
      latestTimestamp: latest.timestamp,
      trustScore,
      reasons,
      notes,
      history,
    }
  })
}

function sampleSizeReason(result: SampleSizeResult): string {
  const worst = [...result.flaggedRecords].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )[0]
  const count = result.flaggedRecords.length
  const suffix = count > 1 ? ` (${count} records affected)` : ""
  return worst.reason + suffix
}
