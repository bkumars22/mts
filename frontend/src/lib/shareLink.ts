/**
 * Encodes a completed analysis (trust scores, reasons, and per-metric
 * history for the chart - not the raw input file) into a gzip-compressed,
 * base64url string suitable for a URL fragment, so results can be shared
 * with no backend: the whole payload lives in the link itself. Uses the
 * browser's native CompressionStream/DecompressionStream - no extra
 * dependency for something this small.
 */
import type { MetricTrustReport, TrendPoint } from "./checks/types"

export const SHARE_HASH_PREFIX = "s="

export class ShareLinkError extends Error {}

interface SharePayload {
  label: string
  reports: MetricTrustReport[]
}

/** JSON.stringify turns Date into an ISO string - this is what a payload
 * actually looks like on the wire, before dates are revived on decode. */
type SerializedTrendPoint = Omit<TrendPoint, "timestamp"> & { timestamp: string }
type SerializedReport = Omit<MetricTrustReport, "latestTimestamp" | "history"> & {
  latestTimestamp: string
  history: SerializedTrendPoint[]
}
interface SerializedPayload {
  label: string
  reports: SerializedReport[]
}

export function isShareLinkSupported(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined"
}

export async function encodeShareableReports(
  label: string,
  reports: MetricTrustReport[],
): Promise<string> {
  const json = JSON.stringify({ label, reports } satisfies SharePayload)
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

  let parsed: SerializedPayload
  try {
    parsed = JSON.parse(json) as SerializedPayload
  } catch {
    throw new ShareLinkError("This share link is corrupted or incomplete.")
  }

  if (!parsed || typeof parsed.label !== "string" || !Array.isArray(parsed.reports)) {
    throw new ShareLinkError("This share link doesn't contain valid MTS results.")
  }

  return {
    label: parsed.label,
    reports: parsed.reports.map(reviveReport),
  }
}

function reviveReport(report: SerializedReport): MetricTrustReport {
  return {
    ...report,
    latestTimestamp: new Date(report.latestTimestamp),
    history: report.history.map((point) => ({ ...point, timestamp: new Date(point.timestamp) })),
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
