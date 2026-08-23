import type { TrustScore } from "../lib/checks/types"
import { TRUST_HIGH, TRUST_LOW, TRUST_MEDIUM } from "../lib/checks/types"

const TRUST_STYLES: Record<TrustScore, { text: string; bg: string; border: string; dot: string }> = {
  [TRUST_HIGH]: {
    text: "text-mts-high",
    bg: "bg-mts-high-bg",
    border: "border-mts-high/40",
    dot: "bg-mts-high",
  },
  [TRUST_MEDIUM]: {
    text: "text-mts-medium",
    bg: "bg-mts-medium-bg",
    border: "border-mts-medium/40",
    dot: "bg-mts-medium",
  },
  [TRUST_LOW]: {
    text: "text-mts-low",
    bg: "bg-mts-low-bg",
    border: "border-mts-low/40",
    dot: "bg-mts-low",
  },
}

export function TrustScoreBadge({ score }: { score: TrustScore }) {
  const style = TRUST_STYLES[score]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold tracking-wide ${style.text} ${style.bg} ${style.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {score}
    </span>
  )
}
