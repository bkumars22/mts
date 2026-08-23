import { useCallback, useRef, useState } from "react"
import type { DragEvent, KeyboardEvent } from "react"

interface FileDropzoneProps {
  onFileSelected: (file: File) => void
}

export function FileDropzone({ onFileSelected }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const openFilePicker = useCallback(() => inputRef.current?.click(), [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) onFileSelected(file)
    },
    [onFileSelected],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        openFilePicker()
      }
    },
    [openFilePicker],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a CSV or JSON metrics file. Drag and drop, or press Enter to browse."
      onClick={openFilePicker}
      onKeyDown={handleKeyDown}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-mts-accent focus-visible:ring-offset-2 focus-visible:ring-offset-mts-bg
        ${
          isDragOver
            ? "border-mts-accent bg-mts-accent/10"
            : "border-mts-border bg-mts-surface hover:border-mts-border-hover"
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelected(file)
          e.target.value = ""
        }}
      />
      <svg
        className={`h-10 w-10 transition-colors ${isDragOver ? "text-mts-accent" : "text-gray-500 group-hover:text-gray-400"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-gray-200">
          Drag and drop your CSV or JSON file here
        </p>
        <p className="mt-1 text-xs text-gray-500">or click to browse - nothing leaves your browser</p>
      </div>
    </div>
  )
}
