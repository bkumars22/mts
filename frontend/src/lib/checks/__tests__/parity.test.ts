/**
 * Parity gate: the TypeScript engine must reproduce the exact numbers
 * already verified against the Python CLI in tests/test_*.py, for all
 * four canonical fixtures. If someone changes the Python checks without
 * updating this port, one of these assertions should break.
 */
import { describe, expect, it } from "vitest"
import { checkCompleteness } from "../completeness"
import { checkOutlierInfluence } from "../outlierInfluence"
import { checkSampleSize } from "../sampleSize"
import { computeTrustScore } from "../trustScore"
import { TRUST_HIGH, TRUST_MEDIUM } from "../types"
import { loadFixture } from "./testFixtures"

function analyze(fixtureName: string) {
  const records = loadFixture(fixtureName)
  return computeTrustScore(
    records,
    checkCompleteness(records),
    checkSampleSize(records),
    checkOutlierInfluence(records),
  )
}

describe("Python/TypeScript parity", () => {
  it("clean.csv -> HIGH (matches tests/test_trust_score.py::test_end_to_end_clean_fixture_is_high)", () => {
    const [report] = analyze("sample_metrics_clean.csv")
    expect(report.trustScore).toBe(TRUST_HIGH)
    expect(report.reasons).toHaveLength(0)
  })

  it("gap.csv -> MEDIUM, ratio ~82.7% (matches tests/test_completeness.py::test_gap_fixture_is_flagged_below_threshold)", () => {
    const records = loadFixture("sample_metrics_gap.csv")
    const [completeness] = checkCompleteness(records)
    expect(completeness.completenessRatio).toBeCloseTo(82.7, 0)
    expect(completeness.actualRecords).toBe(24)

    const [report] = analyze("sample_metrics_gap.csv")
    expect(report.trustScore).toBe(TRUST_MEDIUM)
  })

  it("low_sample.csv -> MEDIUM, 3 records flagged (matches tests/test_sample_size.py::test_low_sample_fixture_flags_tail_records)", () => {
    const records = loadFixture("sample_metrics_low_sample.csv")
    const [sampleSize] = checkSampleSize(records)
    expect(sampleSize.flaggedRecords).toHaveLength(3)
    expect(sampleSize.medianSampleSize).toBe(200)
    expect(sampleSize.threshold).toBe(100)

    const [report] = analyze("sample_metrics_low_sample.csv")
    expect(report.trustScore).toBe(TRUST_MEDIUM)
  })

  it("outliers.csv -> MEDIUM, exactly 2 confirmed outliers, ~30.8% inflation (matches tests/test_outlier_influence.py)", () => {
    const records = loadFixture("sample_metrics_outliers.csv")
    const [outlier] = checkOutlierInfluence(records)
    const confirmedValues = outlier.confirmedOutliers.map((o) => o.value).sort((a, b) => a - b)
    expect(confirmedValues).toEqual([860, 890])
    expect(outlier.pctInfluence).toBeCloseTo(30.8, 0)

    const [report] = analyze("sample_metrics_outliers.csv")
    expect(report.trustScore).toBe(TRUST_MEDIUM)
  })
})
