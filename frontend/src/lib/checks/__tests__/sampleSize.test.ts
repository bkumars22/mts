import { describe, expect, it } from "vitest"
import { checkSampleSize } from "../sampleSize"
import { loadFixture } from "./testFixtures"

describe("checkSampleSize", () => {
  it("flags the tail records of the low_sample fixture", () => {
    const records = loadFixture("sample_metrics_low_sample.csv")
    const results = checkSampleSize(records)

    expect(results).toHaveLength(1)
    const result = results[0]
    expect(result.skipped).toBe(false)
    expect(result.flaggedRecords).toHaveLength(3)

    const flaggedSizes = result.flaggedRecords.map((r) => r.sampleSize).sort((a, b) => a - b)
    expect(flaggedSizes).toEqual([42, 48, 55])
    expect(result.medianSampleSize).toBe(200)
    expect(result.threshold).toBe(100)
    expect(result.flaggedRecords.every((r) => r.reason.includes("Below threshold"))).toBe(true)
  })

  it("has no flags for the clean fixture", () => {
    const records = loadFixture("sample_metrics_clean.csv")
    const results = checkSampleSize(records)

    expect(results).toHaveLength(1)
    expect(results[0].skipped).toBe(false)
    expect(results[0].flaggedRecords).toHaveLength(0)
  })

  it("skips gracefully when sample_size is not present at all", () => {
    // sample_metrics_outliers.csv has no sample_size column.
    const records = loadFixture("sample_metrics_outliers.csv")
    const results = checkSampleSize(records)

    expect(results).toHaveLength(1)
    expect(results[0].skipped).toBe(true)
    expect(results[0].note).toContain("sample_size column not provided")
  })
})
