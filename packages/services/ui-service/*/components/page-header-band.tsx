import type { ReactNode } from "react";
import { StatStrip } from "*/components/stat-strip";
import { cn } from "*/lib/utils";

interface PageHeaderBandProps {
  /** Optional breadcrumb element, rendered above the title. */
  breadcrumb?: ReactNode;
  /**
   * Section nav for whatever the breadcrumb just named, directly under it and
   * above the title.
   *
   * Above rather than below, because a tab bar takes its meaning from what sits
   * over it. Under the title it read as navigation within the page, which is
   * wrong: these tabs move you between a competition's sections, and the
   * competition is named one line up.
   */
  nav?: ReactNode;
  /** Leading visual, e.g. a competition's avatar. Sits left of the title block. */
  media?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls (a switcher, a primary action, a search field). */
  actions?: ReactNode;
  /** Facts about what the page is showing, under the title row. See `HeaderStats`. */
  meta?: ReactNode;
  /** Extra content along the bottom edge. */
  children?: ReactNode;
  className?: string;
}

/**
 * The shared page-header band: a `bg-card` surface with a bottom border that
 * carries an optional breadcrumb, a title, a description, and right-aligned
 * actions. The content region sits in the `max-w-7xl` container below it. Every
 * value is a design token, so the whole header treatment retunes centrally and
 * every top-level page reads as one system.
 *
 * One band per route rather than one per section of the app. A page states what
 * it is in its own title and leaves the trail back up to the breadcrumb, so a
 * leaderboard reads as a leaderboard instead of as a subpage of whichever
 * competition happens to contain it.
 */
export function PageHeaderBand({
  breadcrumb,
  nav,
  media,
  title,
  description,
  actions,
  meta,
  children,
  className,
}: PageHeaderBandProps) {
  return (
    <div
      className={cn(
        "border-b border-border bg-card [view-transition-name:page-header]",
        className,
      )}
    >
      <div className={cn("", children ? "pb-0" : "pb-6")}>
        {breadcrumb ?
          <div className="mx-auto max-w-7xl px-6 pt-6">{breadcrumb}</div>
        : null}
        {nav ?
          <div className="mx-auto max-w-7xl px-6 min-h-max pt-4 pb-0 sm:pb-2">
            {nav}
          </div>
        : null}
        <div
          className={cn(
            "mx-auto max-w-7xl px-6 pt-0 flex flex-wrap items-start justify-between gap-4",
            (breadcrumb || nav) && "mt-4",
          )}
        >
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            {media}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                {title}
              </h1>
              {description ?
                <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </div>
              : null}
            </div>
          </div>
          {actions ?
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          : null}
        </div>
        {meta ?
          <div className="mt-5">{meta}</div>
        : null}
      </div>
      {children ?
        <div className="mx-auto max-w-7xl px-6 pt-4">{children}</div>
      : null}
    </div>
  );
}

/**
 * What the `meta` slot takes: a strip of stat panels, lined up with the rest of
 * the band and pulled down onto its bottom border, so the strip closes the
 * header off rather than floating inside it.
 *
 * Carries its own container because the band gives each row its own, and the
 * `-mb-6` only makes sense against the band's bottom padding. Fill it with
 * `Stat`.
 */
export function HeaderStats({
  className,
  ...props
}: React.ComponentProps<typeof StatStrip>) {
  return (
    <StatStrip
      surface={false}
      className={cn("mx-auto max-w-7xl px-6 gap-2", className)}
      {...props}
    />
  );
}

/** The content region under a header band. */
export function PageBody({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main className={cn("mx-auto max-w-7xl px-6 py-8", className)} {...props} />
  );
}
