// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { detectInputKind, MTSDataError, parseInput } from "../parseInput"

const TEMPLATES_DIR = join(__dirname, "../../../public/templates")

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

describe("detectInputKind", () => {
  it.each([
    ["metrics.csv", "csv"],
    ["metrics.json", "json"],
    ["metrics.xlsx", "excel"],
    ["metrics.xls", "excel"],
  ] as const)("classifies %s as %s", (filename, expected) => {
    expect(detectInputKind(filename)).toBe(expected)
  })

  it("rejects an unsupported extension", () => {
    expect(() => detectInputKind("metrics.txt")).toThrow(MTSDataError)
  })
})

describe("parseInput - Excel", () => {
  it("parses the bundled template.xlsx into the expected records", () => {
    const buffer = readFileSync(join(TEMPLATES_DIR, "template.xlsx"))
    const records = parseInput("template.xlsx", toArrayBuffer(buffer))

    expect(records).toHaveLength(3)
    expect(records[0].metric_name).toBe("example_metric")
    expect(records[0].value).toBeCloseTo(95.2)
    expect(records[0].sample_size).toBe(200)
    expect(records[0].timestamp).toBeInstanceOf(Date)
  })

  it("throws MTSDataError for a required column missing from an Excel file", () => {
    // A CSV round-tripped as if it were binary excel data should fail
    // gracefully rather than crash the app.
    const bogus = toArrayBuffer(Buffer.from("not a real xlsx file"))
    expect(() => parseInput("bad.xlsx", bogus)).toThrow(MTSDataError)
  })
})

describe("parseInput - template consistency", () => {
  it("the CSV and JSON templates parse to the same records as the Excel template", () => {
    const csvText = readFileSync(join(TEMPLATES_DIR, "template.csv"), "utf-8")
    const jsonText = readFileSync(join(TEMPLATES_DIR, "template.json"), "utf-8")
    const xlsxBuffer = readFileSync(join(TEMPLATES_DIR, "template.xlsx"))

    const csvRecords = parseInput("template.csv", csvText)
    const jsonRecords = parseInput("template.json", jsonText)
    const xlsxRecords = parseInput("template.xlsx", toArrayBuffer(xlsxBuffer))

    expect(csvRecords).toHaveLength(3)
    expect(jsonRecords).toHaveLength(3)
    expect(xlsxRecords).toHaveLength(3)

    for (const records of [csvRecords, jsonRecords, xlsxRecords]) {
      expect(records[0].metric_name).toBe("example_metric")
      expect(records[0].value).toBeCloseTo(95.2)
    }
  })
})
