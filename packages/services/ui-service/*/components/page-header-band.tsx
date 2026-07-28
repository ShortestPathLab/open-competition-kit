import type { ReactNode } from "react";
import { cn } from "*/lib/utils";

interface PageHeaderBandProps {
  /** Optional breadcrumb element, rendered above the title. */
  breadcrumb?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls (a switcher, a primary action, a search field). */
  actions?: ReactNode;
  /** Extra content below the title row, e.g. a tab bar or a meta strip. */
  children?: ReactNode;
  className?: string;
}

/**
 * The shared page-header band: a `bg-card` surface with a bottom border that
 * carries an optional breadcrumb, a title, a description, and right-aligned
 * actions. The content region sits in the `max-w-7xl` container below it. Every
 * value is a design token, so the whole header treatment retunes centrally and
 * every top-level page reads as one system.
 */
export function PageHeaderBand({
  breadcrumb,
  title,
  description,
  actions,
  children,
  className,
}: PageHeaderBandProps) {
  return (
    <div className={cn("border-b border-border bg-card", className)}>
      <div className={cn("mx-auto max-w-7xl px-6 pt-6", children ? "pb-0" : "pb-6")}>
        {breadcrumb}
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-4",
            breadcrumb && "mt-4",
          )}
        >
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">{children}</div>
      ) : null}
    </div>
  );
}
