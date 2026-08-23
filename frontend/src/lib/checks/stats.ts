/**
 * Statistical helpers shared by the checks. `percentile` matches NumPy's
 * default 'linear' interpolation method exactly, since the outlier check's
 * IQR bounds depend on it lining up with the Python implementation.
 */

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export function mad(values: number[], centerValue: number): number {
  return median(values.map((v) => Math.abs(v - centerValue)))
}

/** NumPy-compatible percentile (default 'linear' interpolation), p in [0, 100]. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 1) return sorted[0]

  const index = (p / 100) * (n - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]

  const fraction = index - lower
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower])
}

export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Group records by metric_name, matching pandas' groupby('metric_name'). */
export function groupByMetricName<T extends { metric_name: string }>(
  records: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const record of records) {
    const existing = groups.get(record.metric_name)
    if (existing) {
      existing.push(record)
    } else {
      groups.set(record.metric_name, [record])
    }
  }
  return groups
}
