/**
 * Encodes a completed analysis (trust scores, reasons, and per-metric
 * history for the chart - not the raw input file, and not the skip notes,
 * which aren't part of what the spec asks a share link to carry) into a
 * gzip-compressed, base64url string for a URL fragment, so results can be
 * shared with no backend: the whole payload lives in the link itself.
 * Uses the browser's native CompressionStream/DecompressionStream - no
 * extra dependency for something this small.
 *
 * The wire format uses short keys and epoch-millisecond timestamps rather
 * than the verbose MetricTrustReport/TrendPoint shape - gzip can't recover
 * much of that verbosity on a small payload (a handful of points for one
 * or two metrics), where every byte before compression still counts.
 */
import type { MetricTrustReport, TrustScore } from "./checks/types"

export const SHARE_HASH_PREFIX = "s="

export class ShareLinkError extends Error {}

interface WireTrendPoint {
  t: number
  v: number
  o?: true // omitted (not just false) for the common non-outlier case
}

interface WireReport {
  mn: string
  lv: number
  lt: number
  ts: TrustScore
  rs: string[]
  hi: WireTrendPoint[]
}

interface WirePayload {
  l: string
  r: WireReport[]
}

export function isShareLinkSupported(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined"
}

export async function encodeShareableReports(
  label: string,
  reports: MetricTrustReport[],
): Promise<string> {
  const wire: WirePayload = { l: label, r: reports.map(toWireReport) }
  const json = JSON.stringify(wire)
  const compressed = await gzip(new TextEncoder().encode(json))
  return base64UrlEncode(compressed)
}

export async function decodeShareableReports(
  encoded: string,
): Promise<{ label: string; reports: MetricTrustReport[] }> {
  let json: string
  try {
    const compressed = base64UrlDecode(encoded)
    const bytes = await gunzip(compressed)
    json = new TextDecoder().decode(bytes)
  } catch {
    throw new ShareLinkError("This share link is corrupted or incomplete.")
  }

  let parsed: WirePayload
  try {
    parsed = JSON.parse(json) as WirePayload
  } catch {
    throw new ShareLinkError("This share link is corrupted or incomplete.")
  }

  if (!parsed || typeof parsed.l !== "string" || !Array.isArray(parsed.r)) {
    throw new ShareLinkError("This share link doesn't contain valid MTS results.")
  }

  return {
    label: parsed.l,
    reports: parsed.r.map(fromWireReport),
  }
}

function toWireReport(report: MetricTrustReport): WireReport {
  return {
    mn: report.metricName,
    lv: report.latestValue,
    lt: report.latestTimestamp.getTime(),
    ts: report.trustScore,
    rs: report.reasons,
    hi: report.history.map((point) =>
      point.isOutlier
        ? { t: point.timestamp.getTime(), v: point.value, o: true }
        : { t: point.timestamp.getTime(), v: point.value },
    ),
  }
}

/** Notes (why a check was skipped) aren't part of the payload, so they
 * always come back empty - a deliberate size tradeoff, not data loss of
 * anything the spec calls for a share link to reproduce. */
function fromWireReport(wire: WireReport): MetricTrustReport {
  return {
    metricName: wire.mn,
    latestValue: wire.lv,
    latestTimestamp: new Date(wire.lt),
    trustScore: wire.ts,
    reasons: wire.rs,
    notes: [],
    history: wire.hi.map((point) => ({
      timestamp: new Date(point.t),
      value: point.v,
      isOutlier: point.o === true,
    })),
  }
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip")
  const writer = stream.writable.getWriter()
  void writer.write(data as BufferSource)
  void writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("gzip")
  const writer = stream.writable.getWriter()
  void writer.write(data as BufferSource)
  void writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

/** Plain base64 uses `+`, `/`, and `=`, none of which are safe to put
 * straight into a URL fragment unescaped - swap in the base64url alphabet. */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const binary = atob(padded + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
