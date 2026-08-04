import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * What a state means, not what it is called. A job's `done` and a track's
 * `open` are different words for the same good news, and a list showing both
 * should colour them the same way.
 */
export type PillTone = "success" | "destructive" | "pending" | "unknown";

const TONE_STYLES: Record<PillTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  pending: "border-warning/30 bg-warning/10 text-warning",
  unknown: "border-border bg-muted text-muted-foreground",
};

const DOT_STYLES: Record<PillTone, string> = {
  success: "bg-success",
  destructive: "bg-destructive",
  pending: "bg-warning",
  unknown: "bg-muted-foreground",
};

/**
 * A state, as a dot and a word.
 *
 * The dot is a span rather than an icon so a state that is still moving can
 * pulse without a second element, and so every tone lines up on one baseline
 * whatever its label says.
 */
export function StatusPill({
  tone,
  pulse = false,
  className,
  children,
}: {
  tone: PillTone;
  /** For a state that may change on its own, e.g. a job still running. */
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 px-2 py-0.5", TONE_STYLES[tone], className)}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          DOT_STYLES[tone],
          pulse && "motion-safe:animate-pulse",
        )}
      />
      {children}
    </Badge>
  );
}
