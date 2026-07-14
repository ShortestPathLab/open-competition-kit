import { TrendingUp, TrendingDown, MoreVertical } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  /** Omit when there is nothing to compare against — the trend row is then hidden. */
  change?: number
  changeLabel?: string
  hint?: string
}

export function StatCard({ title, value, change, changeLabel = "vs last month", hint }: StatCardProps) {
  const isPositive = (change ?? 0) >= 0

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <button className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-3xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {change === undefined ? (
        hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null
      ) : (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-green-600" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span className={isPositive ? "text-green-600" : "text-red-500"}>
            {isPositive ? "+" : ""}{change}%
          </span>
          <span className="text-muted-foreground">{changeLabel}</span>
        </div>
      )}
    </div>
  )
}
