/**
 * Sample size adequacy check - port of mts/checks/sample_size.py.
 *
 * Cochran's formula is the formal statistical basis for "how large should a
 * sample be" in survey methodology. Comparing each record's sample_size
 * against the historical median (per metric_name) is the pragmatic,
 * directly-implementable MVP version - a deliberate tradeoff, not an
 * oversight.
 */
import { groupByMetricName, median } from "./stats"
import type { FlaggedSampleRecord, MetricRecord, SampleSizeResult } from "./types"

export const MEDIAN_FRACTION_THRESHOLD = 0.5

export function checkSampleSize(records: MetricRecord[]): SampleSizeResult[] {
  const hasSampleSize = records.some((r) => r.sample_size !== undefined)
  const groups = groupByMetricName(records)

  if (!hasSampleSize) {
    const note = "sample_size column not provided - skipping sample size adequacy check"
    return Array.from(groups.keys()).map((metricName) => ({
      metricName,
      skipped: true,
      medianSampleSize: null,
      threshold: null,
      flaggedRecords: [],
      note,
    }))
  }

  return Array.from(groups.entries()).map(([metricName, group]) =>
    checkOneMetric(metricName, group),
  )
}

function checkOneMetric(metricName: string, group: MetricRecord[]): SampleSizeResult {
  const sampleSizes = group.map((r) => r.sample_size as number)
  const medianSampleSize = median(sampleSizes)
  const threshold = MEDIAN_FRACTION_THRESHOLD * medianSampleSize

  const flaggedRecords: FlaggedSampleRecord[] = []
  for (const record of group) {
    const sampleSize = record.sample_size as number
    if (sampleSize < threshold) {
      flaggedRecords.push({
        timestamp: record.timestamp,
        sampleSize,
        reason:
          `Sample size: ${sampleSize.toFixed(0)} records ` +
          `(50% of historical median ${medianSampleSize.toFixed(0)} = ${threshold.toFixed(0)}). ` +
          `Below threshold.`,
      })
    }
  }

  return {
    metricName,
    skipped: false,
    medianSampleSize,
    threshold,
    flaggedRecords,
    note: null,
  }
}
