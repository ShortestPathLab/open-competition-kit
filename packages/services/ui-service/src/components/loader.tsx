import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoaderProps {
  label?: string;
  className?: string;
  spinnerClassName?: string;
}

export function Loader({ label = "Loading...", className, spinnerClassName }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-24 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <Spinner className={cn("size-5", spinnerClassName)} />
      <span>{label}</span>
    </div>
  );
}
