import { TrendingUp, TrendingDown, MoreVertical } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  change: number
  changeLabel?: string
}

export function StatCard({ title, value, change, changeLabel = "vs last month" }: StatCardProps) {
  const isPositive = change >= 0

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <button className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-3xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
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
    </div>
  )
}
