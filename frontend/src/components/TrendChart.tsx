import { useMemo, useState } from "react"
import type { TrendPoint } from "../lib/checks/types"
import { Card } from "../ui/Card"

interface TrendChartProps {
  metricName: string
  points: TrendPoint[]
}

const WIDTH = 640
const HEIGHT = 160
const PAD_X = 12
const PAD_Y = 16

export function TrendChart({ metricName, points }: TrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const hasOutliers = points.some((p) => p.isOutlier)

  const layout = useMemo(() => {
    if (points.length < 2) return null

    const times = points.map((p) => p.timestamp.getTime())
    const values = points.map((p) => p.value)
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    // Pad the value range so points at the exact min/max aren't drawn on
    // the chart's edge, and so a perfectly flat series still gets a range.
    const valueRange = maxValue - minValue || Math.abs(maxValue) || 1
    const valuePad = valueRange * 0.15
    const timeRange = maxTime - minTime || 1

    const scaleX = (t: number) => PAD_X + ((t - minTime) / timeRange) * (WIDTH - 2 * PAD_X)
    const scaleY = (v: number) =>
      HEIGHT -
      PAD_Y -
      ((v - (minValue - valuePad)) / (valueRange + 2 * valuePad)) * (HEIGHT - 2 * PAD_Y)

    const coords = points.map((p) => ({ x: scaleX(p.timestamp.getTime()), y: scaleY(p.value) }))
    return { coords }
  }, [points])

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm font-semibold text-mts-text">{metricName}</p>
        {hasOutliers && (
          <p className="flex items-center gap-1.5 text-xs text-mts-faint">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-mts-low)" }} />
            flagged outlier
          </p>
        )}
      </div>

      {!layout ? (
        <p className="mt-4 text-xs text-mts-faint">Not enough data points to chart a trend.</p>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full overflow-visible">
            <polyline
              points={layout.coords.map((c) => `${c.x},${c.y}`).join(" ")}
              fill="none"
              stroke="var(--color-mts-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {layout.coords.map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={points[i].isOutlier ? 5 : 3}
                fill={points[i].isOutlier ? "var(--color-mts-low)" : "var(--color-mts-accent)"}
                stroke="var(--color-mts-surface)"
                strokeWidth={1}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered((prev) => (prev === i ? null : prev))}
                style={{ cursor: "pointer" }}
              />
            ))}
          </svg>

          {hovered !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-mts-border bg-mts-surface px-2.5 py-1.5 text-xs whitespace-nowrap text-mts-text shadow-md"
              style={{
                left: `${(layout.coords[hovered].x / WIDTH) * 100}%`,
                top: `${(layout.coords[hovered].y / HEIGHT) * 100}%`,
                marginTop: -8,
              }}
            >
              <p className="font-mono font-semibold">{formatValue(points[hovered].value)}</p>
              <p className="text-mts-muted">{points[hovered].timestamp.toLocaleString()}</p>
              <p className={points[hovered].isOutlier ? "text-mts-low" : "text-mts-faint"}>
                {points[hovered].isOutlier ? "Flagged outlier" : "Normal"}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
