/**
 * Outlier influence check - port of mts/checks/outlier_influence.py.
 *
 * Primary method: Modified Z-Score (MAD-based) - NOT plain Z-score and NOT
 * IsolationForest. Modified Z = 0.6745 * (x - median) / MAD. Flags
 * |Modified Z| > 3.5 (NIST-recommended threshold). Cross-checked against
 * the IQR method (Q1 - 1.5*IQR to Q3 + 1.5*IQR) - a point only counts as a
 * *confirmed* outlier if BOTH methods agree, reducing false positives.
 */
import { groupByMetricName, mad, mean, median, percentile } from "./stats"
import type { MetricRecord, OutlierInfluenceResult, OutlierRecord } from "./types"

export const MODIFIED_Z_THRESHOLD = 3.5
export const MIN_HISTORY_POINTS = 10
export const IQR_MULTIPLIER = 1.5

export function checkOutlierInfluence(records: MetricRecord[]): OutlierInfluenceResult[] {
  const groups = groupByMetricName(records)
  return Array.from(groups.entries()).map(([metricName, group]) =>
    checkOneMetric(metricName, group),
  )
}

function checkOneMetric(metricName: string, group: MetricRecord[]): OutlierInfluenceResult {
  const n = group.length

  if (n < MIN_HISTORY_POINTS) {
    return {
      metricName,
      skipped: true,
      note: `Insufficient history (${n} point(s), need >=${MIN_HISTORY_POINTS}) to assess outlier influence`,
      confirmedOutliers: [],
      meanWith: null,
      meanWithout: null,
      pctInfluence: null,
      reason: null,
    }
  }

  const values = group.map((r) => r.value)
  const med = median(values)
  const madValue = mad(values, med)

  if (madValue === 0) {
    return {
      metricName,
      skipped: true,
      note: "MAD is 0 (no variance in this metric's values) - cannot compute Modified Z-score",
      confirmedOutliers: [],
      meanWith: null,
      meanWithout: null,
      pctInfluence: null,
      reason: null,
    }
  }

  const modifiedZ = values.map((v) => (0.6745 * (v - med)) / madValue)
  const zFlagged = modifiedZ.map((z) => Math.abs(z) > MODIFIED_Z_THRESHOLD)

  const q1 = percentile(values, 25)
  const q3 = percentile(values, 75)
  const iqr = q3 - q1
  const lowerBound = q1 - IQR_MULTIPLIER * iqr
  const upperBound = q3 + IQR_MULTIPLIER * iqr
  const iqrFlagged = values.map((v) => v < lowerBound || v > upperBound)

  const confirmedMask = zFlagged.map((z, i) => z && iqrFlagged[i])

  if (!confirmedMask.some(Boolean)) {
    return {
      metricName,
      skipped: false,
      note: null,
      confirmedOutliers: [],
      meanWith: null,
      meanWithout: null,
      pctInfluence: null,
      reason: null,
    }
  }

  const confirmedOutliers: OutlierRecord[] = []
  confirmedMask.forEach((isConfirmed, i) => {
    if (isConfirmed) {
      confirmedOutliers.push({
        timestamp: group[i].timestamp,
        value: values[i],
        modifiedZ: modifiedZ[i],
        reason: `Modified Z-score: ${modifiedZ[i].toFixed(1)} (threshold: ${MODIFIED_Z_THRESHOLD}).`,
      })
    }
  })

  const meanWith = mean(values)
  const meanWithout = mean(values.filter((_, i) => !confirmedMask[i]))
  const pctInfluence = ((meanWith - meanWithout) / meanWithout) * 100

  const maxAbsZ = Math.max(...confirmedOutliers.map((o) => Math.abs(o.modifiedZ)))
  const direction = pctInfluence >= 0 ? "inflating" : "deflating"
  const reason =
    `Modified Z-score: ${maxAbsZ.toFixed(1)} (threshold: ${MODIFIED_Z_THRESHOLD}). ` +
    `Average: ${meanWith.toFixed(1)}. Without ${confirmedOutliers.length} flagged outlier(s): ` +
    `${meanWithout.toFixed(1)} - outliers are ${direction} this metric by ${Math.abs(pctInfluence).toFixed(0)}%.`

  return {
    metricName,
    skipped: false,
    note: null,
    confirmedOutliers,
    meanWith,
    meanWithout,
    pctInfluence,
    reason,
  }
}
