/** A single row of the input file, after parsing and validation. */
export interface MetricRecord {
  timestamp: Date
  metric_name: string
  value: number
  sample_size?: number
}

export const TRUST_HIGH = "HIGH"
export const TRUST_MEDIUM = "MEDIUM"
export const TRUST_LOW = "LOW"
export type TrustScore = typeof TRUST_HIGH | typeof TRUST_MEDIUM | typeof TRUST_LOW

export interface CompletenessResult {
  metricName: string
  skipped: boolean
  flagged: boolean
  completenessRatio: number | null
  expectedRecords: number | null
  actualRecords: number
  expectedGapHours: number | null
  reason: string
}

export interface FlaggedSampleRecord {
  timestamp: Date
  sampleSize: number
  reason: string
}

export interface SampleSizeResult {
  metricName: string
  skipped: boolean
  medianSampleSize: number | null
  threshold: number | null
  flaggedRecords: FlaggedSampleRecord[]
  note: string | null
}

export interface OutlierRecord {
  timestamp: Date
  value: number
  modifiedZ: number
  reason: string
}

export interface OutlierInfluenceResult {
  metricName: string
  skipped: boolean
  note: string | null
  confirmedOutliers: OutlierRecord[]
  meanWith: number | null
  meanWithout: number | null
  pctInfluence: number | null
  reason: string | null
}

export interface MetricTrustReport {
  metricName: string
  latestValue: number
  latestTimestamp: Date
  trustScore: TrustScore
  reasons: string[]
  notes: string[]
}
