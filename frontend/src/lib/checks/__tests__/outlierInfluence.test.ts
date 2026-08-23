import { describe, expect, it } from "vitest"
import { checkOutlierInfluence } from "../outlierInfluence"
import { loadFixture } from "./testFixtures"

describe("checkOutlierInfluence", () => {
  it("confirms exactly two outliers and suppresses the moderate point", () => {
    const records = loadFixture("sample_metrics_outliers.csv")
    const results = checkOutlierInfluence(records)

    expect(results).toHaveLength(1)
    const result = results[0]
    expect(result.metricName).toBe("latency_ms")
    expect(result.skipped).toBe(false)

    const confirmedValues = result.confirmedOutliers.map((o) => o.value).sort((a, b) => a - b)
    expect(confirmedValues).toEqual([860, 890])
    expect(confirmedValues).not.toContain(190)

    expect(result.meanWithout).toBeCloseTo(199.65, 1)
    expect(result.pctInfluence).toBeGreaterThan(25)
    expect(result.reason).toContain("inflating")
    expect(result.reason).toContain("2 flagged outlier(s)")
  })

  it("has no confirmed outliers for the clean fixture", () => {
    const records = loadFixture("sample_metrics_clean.csv")
    const results = checkOutlierInfluence(records)

    expect(results).toHaveLength(1)
    expect(results[0].skipped).toBe(false)
    expect(results[0].confirmedOutliers).toHaveLength(0)
  })

  it("skips a metric with fewer than 10 points", () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date(2026, 7, 1, i),
      metric_name: "short_metric",
      value: [1, 2, 1.5, 2.5, 1.8][i],
    }))
    const results = checkOutlierInfluence(records)

    expect(results).toHaveLength(1)
    expect(results[0].skipped).toBe(true)
    expect(results[0].note).toContain("need >=10")
  })
})
