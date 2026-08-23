import type { ReactNode } from "react"

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-mts-border bg-mts-surface shadow-sm shadow-slate-200/60 ${className}`}
    >
      {children}
    </div>
  )
}
