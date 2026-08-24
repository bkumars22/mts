import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { detectColumnMapping } from "../columnDetection"
import { parseRawRows } from "../parseInput"

const FIXTURES = join(__dirname, "../../../../tests/fixtures")

describe("detectColumnMapping", () => {
  it("correctly maps sample_6's renamed columns (description/date/score/n)", () => {
    const text = readFileSync(join(FIXTURES, "v2_samples/sample_6_renamed_columns.csv"), "utf-8")
    const rows = parseRawRows("sample_6_renamed_columns.csv", text)
    const columns = Object.keys(rows[0])

    const mapping = detectColumnMapping(rows, columns)

    expect(mapping.timestamp).toBe("date")
    expect(mapping.metric_name).toBe("description")
    expect(mapping.value).toBe("score")
    expect(mapping.sample_size).toBe("n")
  })

  it("never guesses a concept it has no reasonable candidate for", () => {
    const rows = [
      { colA: "2026-01-01", colB: "metric_x" },
      { colA: "2026-01-02", colB: "metric_x" },
      { colA: "2026-01-03", colB: "metric_x" },
    ]
    const mapping = detectColumnMapping(rows, ["colA", "colB"])

    expect(mapping.timestamp).toBe("colA")
    expect(mapping.metric_name).toBe("colB")
    expect(mapping.value).toBeUndefined()
    expect(mapping.sample_size).toBeUndefined()
  })

  it("does not mistake a plain numeric column for a timestamp", () => {
    const rows = [
      { when: "42", who: "m", how_much: "1.5" },
      { when: "43", who: "m", how_much: "2.5" },
    ]
    const mapping = detectColumnMapping(rows, ["when", "who", "how_much"])

    expect(mapping.timestamp).toBeUndefined()
  })
})
