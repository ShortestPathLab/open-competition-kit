import { X, SlidersHorizontal } from "lucide-react"
import { SearchInput } from "./search-input"

export interface FilterChip {
  id: string
  label: string
}

interface FilterBarProps {
  filters?: FilterChip[]
  onRemoveFilter?: (id: string) => void
  searchPlaceholder?: string
}

export function FilterBar({ filters = [], onRemoveFilter, searchPlaceholder = "Search" }: FilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"
            onClick={() => onRemoveFilter?.(filter.id)}
          >
            {filter.label}
            <X className="h-3 w-3" />
          </button>
        ))}
        <button className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-3 w-3" />
          More filters
        </button>
      </div>
      <SearchInput placeholder={searchPlaceholder} className="w-64" />
    </div>
  )
}
