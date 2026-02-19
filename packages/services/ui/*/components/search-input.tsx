import { Search } from "lucide-react"

interface SearchInputProps {
  placeholder?: string
  className?: string
}

export function SearchInput({ placeholder = "Search", className }: SearchInputProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}
