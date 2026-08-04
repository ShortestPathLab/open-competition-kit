import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-border bg-muted text-muted-foreground",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
} as const;

export type StatusScreenProps = {
  /** A short status marker: an HTTP code, or a one word label. */
  code: string;
  tone?: keyof typeof toneClasses;
  title: string;
  description: ReactNode;
  /** Detail block, rendered between the description and the actions. */
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * The frame shared by the two pages that stand in for a page: the 404 and the
 * error boundary.
 *
 * It renders in two very different slots. A missing competition replaces the
 * whole layout under the navbar, while a missing track renders inside that
 * competition's `<main>`, which already has its own padding and max width. So
 * this sizes itself from a soft minimum rather than from the viewport, and
 * centres one narrow column instead of filling the space it is given.
 */
export function StatusScreen({
  code,
  tone = "neutral",
  title,
  description,
  children,
  actions,
  className,
}: StatusScreenProps) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] w-full items-center justify-center px-6 py-16 sm:py-20",
        className,
      )}
    >
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs font-medium",
            toneClasses[tone],
          )}
        >
          {code}
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <div className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          {description}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
        {actions ?
          <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
        : null}
      </div>
    </div>
  );
}
