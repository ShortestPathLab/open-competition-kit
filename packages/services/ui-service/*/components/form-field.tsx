import type { ReactNode } from "react"

interface FormFieldProps {
  label: string
  description?: string
  children: ReactNode
}

export function FormField({ label, description, children }: FormFieldProps) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-6 border-b border-border py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
