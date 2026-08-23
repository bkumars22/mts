import { describe, expect, it } from "vitest"
import { checkCompleteness } from "../completeness"
import { loadFixture } from "./testFixtures"

describe("checkCompleteness", () => {
  it("reports ~100% completeness for the clean fixture", () => {
    const records = loadFixture("sample_metrics_clean.csv")
    const results = checkCompleteness(records)

    expect(results).toHaveLength(1)
    const result = results[0]
    expect(result.metricName).toBe("eval_accuracy")
    expect(result.skipped).toBe(false)
    expect(result.flagged).toBe(false)
    expect(result.actualRecords).toBe(30)
    expect(result.completenessRatio).toBeGreaterThanOrEqual(99)
  })

  it("flags the gap fixture below the 95% threshold", () => {
    const records = loadFixture("sample_metrics_gap.csv")
    const results = checkCompleteness(records)

    expect(results).toHaveLength(1)
    const result = results[0]
    expect(result.skipped).toBe(false)
    expect(result.flagged).toBe(true)
    expect(result.actualRecords).toBe(24)
    expect(result.completenessRatio).toBeLessThan(95)
    expect(result.completenessRatio).toBeCloseTo(82.7, 0)
    expect(result.expectedRecords).toBeGreaterThanOrEqual(28)
    expect(result.expectedRecords).toBeLessThanOrEqual(30)
    expect(result.reason).toContain("Completeness:")
    expect(result.reason).toContain("Threshold: 95%")
  })

  it("skips (does not flag) a metric with fewer than 2 records", () => {
    const records = [
      { timestamp: new Date("2026-08-01T00:00:00"), metric_name: "single_point", value: 1 },
    ]
    const results = checkCompleteness(records)

    expect(results).toHaveLength(1)
    expect(results[0].skipped).toBe(true)
    expect(results[0].flagged).toBe(false)
  })
})
