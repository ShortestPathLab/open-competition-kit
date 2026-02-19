import type { ReactNode } from "react"

interface SectionHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-border pb-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
