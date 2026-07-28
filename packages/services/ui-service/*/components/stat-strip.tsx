import { cn } from "*/lib/utils";

/**
 * A row of key/value stats sharing one bordered surface. The grid reflows to
 * whatever number of `Stat`s it is given, so a competition with fewer known
 * facts still reads as intentional rather than broken.
 *
 * Pass `surface={false}` to drop the card chrome (border, radius, fill) when the
 * strip runs edge to edge inside a header band; the caller then supplies its own
 * divider, e.g. `border-t border-border`.
 */
export function StatStrip({
  className,
  surface = true,
  ...props
}: React.ComponentProps<"div"> & { surface?: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] overflow-hidden",
        surface && "rounded-xl border border-border bg-card",
        className,
      )}
      {...props}
    />
  );
}

interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Tint the value with the brand/primary colour. */
  emphasis?: boolean;
  className?: string;
}

export function Stat({ label, value, emphasis = false, className }: StatProps) {
  return (
    <div
      className={cn(
        "border-l border-border px-5 py-4 first:border-l-0",
        className,
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tracking-tight tabular-nums",
          emphasis ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
