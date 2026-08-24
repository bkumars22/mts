/**
 * Persists the last successfully analyzed file(s) so a page refresh
 * restores the results instead of resetting to the upload screen.
 * Everything is stored client-side (localStorage) - nothing is sent
 * anywhere. Supports multiple files since a single analysis can now
 * combine records from more than one upload.
 */

const STORAGE_KEY = "mts:lastAnalysis"

export interface InputFile {
  filename: string
  data: string | ArrayBuffer
}

interface StoredFile {
  filename: string
  encoding: "text" | "base64"
  content: string
}

export function saveLastAnalysis(files: InputFile[]): void {
  try {
    const stored: StoredFile[] = files.map((f) =>
      typeof f.data === "string"
        ? { filename: f.filename, encoding: "text", content: f.data }
        : { filename: f.filename, encoding: "base64", content: arrayBufferToBase64(f.data) },
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // localStorage can be unavailable (private browsing, quota) - persistence
    // is a convenience, not a requirement, so fail silently.
  }
}

export function loadLastAnalysis(): InputFile[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as unknown
    if (!Array.isArray(stored) || stored.length === 0) return null
    return (stored as StoredFile[]).map((f) => ({
      filename: f.filename,
      data: f.encoding === "text" ? f.content : base64ToArrayBuffer(f.content),
    }))
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
