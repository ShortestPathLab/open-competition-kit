import type { ReactNode } from "react";
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
  /** Facts about what the page is showing, under the title row. See `HeaderMeta`. */
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
    <div className={cn("border-b border-border bg-card", className)}>
      <div
        className={cn(
          "mx-auto max-w-7xl px-6 pt-4",
          children ? "pb-0" : "pb-5",
        )}
      >
        {breadcrumb}
        {nav ? (
          // Its own rule, since the band's bottom border no longer sits under
          // the strip to close it off. Pulled out to the container edges so the
          // line runs the full width rather than stopping at the last tab.
          <div className="-mx-6 mt-2.5 border-b border-border px-6">{nav}</div>
        ) : null}
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-x-4 gap-y-3",
            (breadcrumb || nav) && "mt-4",
          )}
        >
          <div className="flex min-w-0 items-start gap-3.5">
            {media}
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-balance sm:text-2xl">
                {title}
              </h1>
              {description ? (
                <div className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </div>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
      {children ? (
        <div className="mx-auto max-w-7xl px-6 pt-3">{children}</div>
      ) : null}
    </div>
  );
}

/**
 * The facts row under a page title: what the page is showing, and how much of
 * it. Numbers inside are set in mono, so a count reads as a count.
 *
 * Takes plain children rather than label/value pairs, because most of these read
 * as short sentences ("Ranked by Total, highest first") rather than as a table
 * of two-part stats. Wrap the numbers in `<b>` and the styling follows.
 */
export function HeaderMeta({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground",
        "[&_b]:font-mono [&_b]:font-semibold [&_b]:tabular-nums [&_b]:text-foreground",
        className,
      )}
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
