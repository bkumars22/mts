import { beforeEach, describe, expect, it } from "vitest"
import { clearLastAnalysis, loadLastAnalysis, saveLastAnalysis } from "../persistence"

beforeEach(() => {
  localStorage.clear()
})

describe("persistence", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadLastAnalysis()).toBeNull()
  })

  it("round-trips text content (CSV/JSON)", () => {
    saveLastAnalysis("metrics.csv", "timestamp,metric_name,value\n2026-01-01,m,1\n")
    const loaded = loadLastAnalysis()

    expect(loaded?.filename).toBe("metrics.csv")
    expect(loaded?.data).toBe("timestamp,metric_name,value\n2026-01-01,m,1\n")
  })

  it("round-trips binary content (Excel) via base64", () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 10, 13])
    saveLastAnalysis("metrics.xlsx", bytes.buffer)
    const loaded = loadLastAnalysis()

    expect(loaded?.filename).toBe("metrics.xlsx")
    expect(new Uint8Array(loaded?.data as ArrayBuffer)).toEqual(bytes)
  })

  it("clears the stored analysis", () => {
    saveLastAnalysis("metrics.csv", "a,b,c")
    clearLastAnalysis()
    expect(loadLastAnalysis()).toBeNull()
  })
})
