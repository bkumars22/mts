/**
 * Persists the last successfully analyzed file so a page refresh restores
 * the results instead of resetting to the upload screen. Everything is
 * stored client-side (localStorage) - nothing is sent anywhere.
 */

const STORAGE_KEY = "mts:lastAnalysis"

interface StoredAnalysis {
  filename: string
  encoding: "text" | "base64"
  content: string
}

export function saveLastAnalysis(filename: string, data: string | ArrayBuffer): void {
  try {
    const stored: StoredAnalysis =
      typeof data === "string"
        ? { filename, encoding: "text", content: data }
        : { filename, encoding: "base64", content: arrayBufferToBase64(data) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // localStorage can be unavailable (private browsing, quota) - persistence
    // is a convenience, not a requirement, so fail silently.
  }
}

export function loadLastAnalysis(): { filename: string; data: string | ArrayBuffer } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredAnalysis
    const data = stored.encoding === "text" ? stored.content : base64ToArrayBuffer(stored.content)
    return { filename: stored.filename, data }
  } catch {
    return null
  }
}

export function clearLastAnalysis(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
