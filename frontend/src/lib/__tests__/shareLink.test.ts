import { describe, expect, it } from "vitest"
import { checkCompleteness } from "../checks/completeness"
import { checkOutlierInfluence } from "../checks/outlierInfluence"
import { checkSampleSize } from "../checks/sampleSize"
import { loadFixture } from "../checks/__tests__/testFixtures"
import { computeTrustScore } from "../checks/trustScore"
import { decodeShareableReports, encodeShareableReports, ShareLinkError } from "../shareLink"

function analyze(fixtureName: string) {
  const records = loadFixture(fixtureName)
  return computeTrustScore(
    records,
    checkCompleteness(records),
    checkSampleSize(records),
    checkOutlierInfluence(records),
  )
}

describe("shareLink", () => {
  it("round-trips label, trust scores, reasons, and history (including dates and outlier flags)", async () => {
    const reports = analyze("sample_metrics_outliers.csv")

    const encoded = await encodeShareableReports("outliers.csv", reports)
    const decoded = await decodeShareableReports(encoded)

    expect(decoded.label).toBe("outliers.csv")
    expect(decoded.reports).toHaveLength(reports.length)
    expect(decoded.reports[0].metricName).toBe(reports[0].metricName)
    expect(decoded.reports[0].trustScore).toBe(reports[0].trustScore)
    expect(decoded.reports[0].reasons).toEqual(reports[0].reasons)
    expect(decoded.reports[0].latestTimestamp).toBeInstanceOf(Date)
    expect(decoded.reports[0].latestTimestamp.getTime()).toBe(reports[0].latestTimestamp.getTime())

    expect(decoded.reports[0].history).toHaveLength(reports[0].history.length)
    for (const [i, point] of decoded.reports[0].history.entries()) {
      expect(point.timestamp).toBeInstanceOf(Date)
      expect(point.timestamp.getTime()).toBe(reports[0].history[i].timestamp.getTime())
      expect(point.value).toBe(reports[0].history[i].value)
      expect(point.isOutlier).toBe(reports[0].history[i].isOutlier)
    }
    expect(decoded.reports[0].history.some((p) => p.isOutlier)).toBe(true)
  })

  it("does not carry notes over - not part of the payload, so always empty on decode", async () => {
    const reports = analyze("sample_metrics_gap.csv")
    const encoded = await encodeShareableReports("gap.csv", reports)
    const decoded = await decodeShareableReports(encoded)
    for (const report of decoded.reports) {
      expect(report.notes).toEqual([])
    }
  })

  it("is meaningfully smaller than compressing the verbose report shape directly", async () => {
    const reports = analyze("sample_metrics_clean.csv")
    const encoded = await encodeShareableReports("clean.csv", reports)

    // What encoding would look like without the short-key/epoch-timestamp
    // wire format - i.e. gzip+base64url over MetricTrustReport as-is. This
    // is what regressed in practice: gzip alone doesn't recover verbose
    // keys/ISO date strings on a small payload, so the link came out
    // needlessly long. Guards against reintroducing that regression.
    const naiveJson = JSON.stringify({ label: "clean.csv", reports })
    const naiveGz = new CompressionStream("gzip")
    const writer = naiveGz.writable.getWriter()
    void writer.write(new TextEncoder().encode(naiveJson))
    void writer.close()
    const naiveBytes = new Uint8Array(await new Response(naiveGz.readable).arrayBuffer())
    let naiveBinary = ""
    for (const b of naiveBytes) naiveBinary += String.fromCharCode(b)
    const naiveEncoded = btoa(naiveBinary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

    expect(encoded.length).toBeLessThan(naiveEncoded.length * 0.85)
  })

  it("produces a URL-safe string with no padding characters", async () => {
    const reports = analyze("sample_metrics_clean.csv")
    const encoded = await encodeShareableReports("clean.csv", reports)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("compresses a repetitive payload smaller than its raw JSON", async () => {
    const reports = analyze("sample_metrics_clean.csv")
    const encoded = await encodeShareableReports("clean.csv", reports)
    const rawJsonLength = JSON.stringify(reports).length
    expect(encoded.length).toBeLessThan(rawJsonLength)
  })

  it("rejects a garbage/corrupted encoded string", async () => {
    await expect(decodeShareableReports("not-a-valid-payload!!!")).rejects.toBeInstanceOf(
      ShareLinkError,
    )
  })

  it("rejects a payload that decodes but isn't shaped like share data", async () => {
    const bogusJson = JSON.stringify({ hello: "world" })
    const compressed = new CompressionStream("gzip")
    const writer = compressed.writable.getWriter()
    void writer.write(new TextEncoder().encode(bogusJson))
    void writer.close()
    const bytes = new Uint8Array(await new Response(compressed.readable).arrayBuffer())
    let binary = ""
    for (const b of bytes) binary += String.fromCharCode(b)
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

    await expect(decodeShareableReports(encoded)).rejects.toBeInstanceOf(ShareLinkError)
  })
})
