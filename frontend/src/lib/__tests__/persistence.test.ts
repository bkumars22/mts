import { beforeEach, describe, expect, it } from "vitest"
import { clearLastAnalysis, loadLastAnalysis, saveLastAnalysis } from "../persistence"

beforeEach(() => {
  localStorage.clear()
})

describe("persistence", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadLastAnalysis()).toBeNull()
  })

  it("round-trips a single text file (CSV/JSON)", () => {
    saveLastAnalysis([
      { filename: "metrics.csv", data: "timestamp,metric_name,value\n2026-01-01,m,1\n" },
    ])
    const loaded = loadLastAnalysis()

    expect(loaded).toHaveLength(1)
    expect(loaded?.[0].filename).toBe("metrics.csv")
    expect(loaded?.[0].data).toBe("timestamp,metric_name,value\n2026-01-01,m,1\n")
  })

  it("round-trips multiple files, mixing text and binary content", () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 10, 13])
    saveLastAnalysis([
      { filename: "a.csv", data: "a,b,c" },
      { filename: "b.xlsx", data: bytes.buffer },
    ])
    const loaded = loadLastAnalysis()

    expect(loaded).toHaveLength(2)
    expect(loaded?.[0].filename).toBe("a.csv")
    expect(loaded?.[0].data).toBe("a,b,c")
    expect(loaded?.[1].filename).toBe("b.xlsx")
    expect(new Uint8Array(loaded?.[1].data as ArrayBuffer)).toEqual(bytes)
  })

  it("clears the stored analysis", () => {
    saveLastAnalysis([{ filename: "metrics.csv", data: "a,b,c" }])
    clearLastAnalysis()
    expect(loadLastAnalysis()).toBeNull()
  })

  it("treats a stale, non-array stored value as absent", () => {
    localStorage.setItem("mts:lastAnalysis", JSON.stringify({ filename: "old.csv", encoding: "text", content: "x" }))
    expect(loadLastAnalysis()).toBeNull()
  })
})
