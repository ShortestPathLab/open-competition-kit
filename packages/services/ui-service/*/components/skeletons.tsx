import { Skeleton } from "*/components/ui/skeleton"
import { cn } from "*/lib/utils"

/**
 * Generic full-page loading placeholder used while a route's primary data
 * resolves. Mirrors the common heading + hero + content layout so the page
 * doesn't jump when the real content arrives.
 */
export function PageSkeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("space-y-6", className)}
      {...props}
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

/**
 * A vertical list of item-shaped rows, matching the `ItemGroup` lists the
 * browsers render once their data loads.
 */
export function ListSkeleton({
  rows = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  )
}

/**
 * Label + control rows for a form that is still loading its definition.
 */
export function FormSkeleton({
  fields = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { fields?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("space-y-4", className)}
      {...props}
    >
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  )
}

/**
 * A single media-over-text card placeholder, matching the cards rendered in
 * the competitions/tracks grids. Drop several inside the caller's grid or
 * flex wrapper while the list loads.
 */
export function CardSkeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "overflow-hidden rounded-lg border border-border",
        className
      )}
      {...props}
    >
      <Skeleton className="aspect-4/3 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
