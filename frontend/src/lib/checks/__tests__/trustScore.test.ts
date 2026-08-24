import { describe, expect, it } from "vitest"
import { checkCompleteness } from "../completeness"
import { checkOutlierInfluence } from "../outlierInfluence"
import { checkSampleSize } from "../sampleSize"
import { computeTrustScore } from "../trustScore"
import type {
  CompletenessResult,
  MetricRecord,
  OutlierInfluenceResult,
  SampleSizeResult,
} from "../types"
import { TRUST_HIGH, TRUST_LOW, TRUST_MEDIUM } from "../types"
import { loadFixture } from "./testFixtures"

const RECORD: MetricRecord = {
  timestamp: new Date("2026-08-01T00:00:00"),
  metric_name: "m",
  value: 95,
}

function cleanCompleteness(): CompletenessResult {
  return {
    metricName: "m",
    skipped: false,
    flagged: false,
    completenessRatio: 100,
    expectedRecords: 30,
    actualRecords: 30,
    expectedGapHours: 1,
    reason: "Completeness: 100.0% (30/30 expected records). Threshold: 95%.",
  }
}

function flaggedCompleteness(): CompletenessResult {
  return { ...cleanCompleteness(), flagged: true, completenessRatio: 80 }
}

function cleanSampleSize(): SampleSizeResult {
  return {
    metricName: "m",
    skipped: false,
    medianSampleSize: 200,
    threshold: 100,
    flaggedRecords: [],
    note: null,
  }
}

function flaggedSampleSize(): SampleSizeResult {
  return {
    ...cleanSampleSize(),
    flaggedRecords: [{ timestamp: RECORD.timestamp, sampleSize: 42, reason: "Below threshold." }],
  }
}

function skippedSampleSize(): SampleSizeResult {
  return {
    metricName: "m",
    skipped: true,
    medianSampleSize: null,
    threshold: null,
    flaggedRecords: [],
    note: "sample_size column not provided - skipping sample size adequacy check",
  }
}

function cleanOutlier(): OutlierInfluenceResult {
  return {
    metricName: "m",
    skipped: false,
    note: null,
    confirmedOutliers: [],
    meanWith: null,
    meanWithout: null,
    pctInfluence: null,
    reason: null,
  }
}

function flaggedOutlier(): OutlierInfluenceResult {
  return {
    ...cleanOutlier(),
    confirmedOutliers: [
      { timestamp: RECORD.timestamp, value: 890, modifiedZ: 4.8, reason: "Modified Z: 4.8." },
    ],
    reason: "Modified Z-score: 4.8 (threshold: 3.5). Average: 261.0. inflating this metric by 31%.",
  }
}

describe("computeTrustScore branch logic", () => {
  it("zero flags -> HIGH", () => {
    const reports = computeTrustScore(
      [RECORD],
      [cleanCompleteness()],
      [cleanSampleSize()],
      [cleanOutlier()],
    )
    expect(reports[0].trustScore).toBe(TRUST_HIGH)
    expect(reports[0].reasons).toHaveLength(0)
  })

  it("one flag -> MEDIUM", () => {
    const reports = computeTrustScore(
      [RECORD],
      [flaggedCompleteness()],
      [cleanSampleSize()],
      [cleanOutlier()],
    )
    expect(reports[0].trustScore).toBe(TRUST_MEDIUM)
    expect(reports[0].reasons).toHaveLength(1)
  })

  it("two flags -> LOW", () => {
    const reports = computeTrustScore(
      [RECORD],
      [flaggedCompleteness()],
      [flaggedSampleSize()],
      [cleanOutlier()],
    )
    expect(reports[0].trustScore).toBe(TRUST_LOW)
    expect(reports[0].reasons).toHaveLength(2)
  })

  it("three flags -> LOW with all reasons", () => {
    const reports = computeTrustScore(
      [RECORD],
      [flaggedCompleteness()],
      [flaggedSampleSize()],
      [flaggedOutlier()],
    )
    expect(reports[0].trustScore).toBe(TRUST_LOW)
    expect(reports[0].reasons).toHaveLength(3)
  })

  it("marks confirmed-outlier points in history, leaves the rest unmarked", () => {
    const older: MetricRecord = { ...RECORD, timestamp: new Date("2026-07-01T00:00:00") }
    const reports = computeTrustScore(
      [older, RECORD],
      [cleanCompleteness()],
      [cleanSampleSize()],
      [flaggedOutlier()],
    )
    expect(reports[0].history).toHaveLength(2)
    expect(reports[0].history[0].isOutlier).toBe(false)
    expect(reports[0].history[1].isOutlier).toBe(true)
    expect(reports[0].history[1].value).toBe(RECORD.value)
  })

  it("history is empty of outlier flags when the check is skipped", () => {
    const reports = computeTrustScore(
      [RECORD],
      [cleanCompleteness()],
      [cleanSampleSize()],
      [{ ...cleanOutlier(), skipped: true, note: "not enough history" }],
    )
    expect(reports[0].history).toEqual([
      { timestamp: RECORD.timestamp, value: RECORD.value, isOutlier: false },
    ])
  })

  it("a skipped check never counts as a flag", () => {
    const reports = computeTrustScore(
      [RECORD],
      [flaggedCompleteness()],
      [skippedSampleSize()],
      [cleanOutlier()],
    )
    expect(reports[0].trustScore).toBe(TRUST_MEDIUM)
    expect(reports[0].reasons).toHaveLength(1)
    expect(reports[0].notes).toHaveLength(1)
    expect(reports[0].notes[0]).toContain("sample_size column not provided")
  })
})

describe("computeTrustScore end-to-end against fixtures", () => {
  it("gap fixture is MEDIUM", () => {
    const records = loadFixture("sample_metrics_gap.csv")
    const reports = computeTrustScore(
      records,
      checkCompleteness(records),
      checkSampleSize(records),
      checkOutlierInfluence(records),
    )
    expect(reports[0].trustScore).toBe(TRUST_MEDIUM)
    expect(reports[0].reasons).toHaveLength(1)
  })

  it("clean fixture is HIGH", () => {
    const records = loadFixture("sample_metrics_clean.csv")
    const reports = computeTrustScore(
      records,
      checkCompleteness(records),
      checkSampleSize(records),
      checkOutlierInfluence(records),
    )
    expect(reports[0].trustScore).toBe(TRUST_HIGH)
    expect(reports[0].reasons).toHaveLength(0)
  })
})
